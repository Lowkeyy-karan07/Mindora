import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseConstraints } from '../src/lib/chat/intent';
import { rankActivitiesWithConstraints } from '../src/lib/recommender/rules';
import { handleChatRefinement, buildTemplateReply } from '../src/lib/chat/ai';
import { getAllActivities } from '../src/lib/catalog';
import { Activity, Mood } from '../src/types';

// Mock the GoogleGenAI client from @google/genai
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = {
      generateContent: mockGenerateContent,
    };
  }
  return {
    GoogleGenAI: MockGoogleGenAI,
  };
});

describe('Follow-up Chat & Intent Constraints', () => {
  const originalEnv = { ...process.env };
  const allActivities = getAllActivities();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.GEMINI_MODEL = 'gemini-2.5-flash';
    delete process.env.DEMO_MODE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('parseConstraints for each phrase type', () => {
    it('parses duration constraints: numeric minutes and relative phrases', () => {
      expect(parseConstraints('only 2 minutes').max_minutes).toBe(2);
      expect(parseConstraints('2 minutes').max_minutes).toBe(2);
      expect(parseConstraints('under 3 mins').max_minutes).toBe(3);
      expect(parseConstraints('less than 5 minutes').max_minutes).toBe(5);
      expect(parseConstraints('short').max_minutes).toBe(2);
      expect(parseConstraints('Shorter please').max_minutes).toBe(2);
      expect(parseConstraints('quick pause').max_minutes).toBe(2);
    });

    it('parses type exclusions: breathing, grounding, journaling, break', () => {
      expect(parseConstraints('No breathing exercises').exclude_types).toEqual(['breathing']);
      expect(parseConstraints("don't like breathing").exclude_types).toEqual(['breathing']);
      expect(parseConstraints('no grounding').exclude_types).toEqual(['grounding']);
      expect(parseConstraints('no journaling').exclude_types).toEqual(['journaling']);
      expect(parseConstraints('no writing').exclude_types).toEqual(['journaling']);
      expect(parseConstraints('no movement break').exclude_types).toEqual(['break']);
    });

    it('parses swap intent', () => {
      expect(parseConstraints('something else').wants_swap).toBe(true);
      expect(parseConstraints('another option').wants_swap).toBe(true);
      expect(parseConstraints('Something different').wants_swap).toBe(true);
      expect(parseConstraints('swap these').wants_swap).toBe(true);
      expect(parseConstraints('give me different options').wants_swap).toBe(true);
    });

    it('parses why / explanation intent', () => {
      expect(parseConstraints('why').wants_why).toBe(true);
      expect(parseConstraints('Why these?').wants_why).toBe(true);
      expect(parseConstraints('explain why').wants_why).toBe(true);
      expect(parseConstraints('what is the reason for these').wants_why).toBe(true);
    });

    it('parses steps / how-to intent', () => {
      expect(parseConstraints('how do I do this').wants_steps).toBe(true);
      expect(parseConstraints('how to do').wants_steps).toBe(true);
      expect(parseConstraints('steps').wants_steps).toBe(true);
      expect(parseConstraints('how does it work').wants_steps).toBe(true);
      expect(parseConstraints('show me the instructions').wants_steps).toBe(true);
    });

    it('returns empty defaults for empty or general message', () => {
      const res = parseConstraints('');
      expect(res.max_minutes).toBeNull();
      expect(res.exclude_types).toEqual([]);
      expect(res.wants_swap).toBe(false);
      expect(res.wants_why).toBe(false);
      expect(res.wants_steps).toBe(false);
    });
  });

  describe('Constraint-based ranking in rankActivitiesWithConstraints', () => {
    it('a "no breathing" message returns zero breathing activities', () => {
      const result = rankActivitiesWithConstraints('Anxious', undefined, undefined, {
        excludeTypes: ['breathing'],
      });

      expect(result.recommendations).toHaveLength(3);
      for (const rec of result.recommendations) {
        expect(rec.activity.type).not.toBe('breathing');
      }
    });

    it('"2 minutes" returns only activities of 2 minutes or less', () => {
      const result = rankActivitiesWithConstraints('Anxious', undefined, undefined, {
        maxMinutes: 2,
      });

      expect(result.recommendations).toHaveLength(3);
      for (const rec of result.recommendations) {
        expect(rec.activity.duration_minutes).toBeLessThanOrEqual(2);
      }
    });

    it('"something else" changes at least 2 of 3 cards while still obeying mood_fit', () => {
      // 1. Initial top 3 recommendations for Anxious
      const initial = rankActivitiesWithConstraints('Anxious');
      expect(initial.recommendations).toHaveLength(3);
      const initialIds = initial.recommendations.map((r) => r.activity.id);

      // 2. Request a swap by excluding the initial IDs
      const swapped = rankActivitiesWithConstraints('Anxious', undefined, undefined, {
        excludeActivityIds: initialIds,
      });

      expect(swapped.recommendations).toHaveLength(3);
      const swappedIds = swapped.recommendations.map((r) => r.activity.id);

      // Count how many changed
      const changedCount = swappedIds.filter((id) => !initialIds.includes(id)).length;
      expect(changedCount).toBeGreaterThanOrEqual(2);

      // Ensure every returned activity still obeys mood_fit >= 1
      for (const rec of swapped.recommendations) {
        expect(rec.activity.mood_fit['Anxious']).toBeGreaterThanOrEqual(1);
      }
    });

    it('relaxes constraints when fewer than 3 activities match', () => {
      // Impose conflicting constraints leaving < 3 activities
      const impossible = rankActivitiesWithConstraints('Anxious', undefined, undefined, {
        maxMinutes: 1, // only physiological-sigh is 1 min for Anxious
        excludeTypes: ['breathing'], // leaves 0 activities of 1 min
      });

      expect(impossible.recommendations).toHaveLength(3);
      expect(impossible.relaxationNote).toBeDefined();
    });
  });

  describe('handleChatRefinement & Safety Gate', () => {
    const currentActs: Activity[] = allActivities.slice(0, 3);

    it('safety trigger returns { safety: true } with NO Gemini call', async () => {
      const crisisMessage = 'I want to end my life right now';
      const result = await handleChatRefinement({
        message: crisisMessage,
        mood: 'Anxious',
        themes: ['general'],
        currentActivities: currentActs,
      });

      expect(result.safety).toBe(true);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('missing key or DEMO_MODE=true uses template replies', async () => {
      process.env.DEMO_MODE = 'true';

      // 1. "why these?" template
      const whyRes = await handleChatRefinement({
        message: 'Why these?',
        mood: 'Anxious',
        themes: ['general'],
        currentActivities: currentActs,
      });
      expect(whyRes.personalised_by).toBe('rules');
      expect(whyRes.reply.toLowerCase()).toContain('because');
      expect(mockGenerateContent).not.toHaveBeenCalled();

      // 2. "steps" template
      const stepsRes = await handleChatRefinement({
        message: 'how do I do this',
        mood: 'Anxious',
        themes: ['general'],
        currentActivities: currentActs,
      });
      expect(stepsRes.personalised_by).toBe('rules');
      expect(stepsRes.reply).toContain('steps for');

      // 3. "something different" template
      const swapRes = await handleChatRefinement({
        message: 'something different',
        mood: 'Anxious',
        themes: ['general'],
        currentActivities: currentActs,
      });
      expect(swapRes.personalised_by).toBe('rules');
      expect(swapRes.reply).toContain("I've refreshed your options");
      expect(swapRes.recommendations).toHaveLength(3);
    });

    it('invalid Gemini JSON falls back cleanly to template reply', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: 'This is not JSON at all!',
      });

      const res = await handleChatRefinement({
        message: 'No breathing exercises',
        mood: 'Anxious',
        themes: ['general'],
        currentActivities: currentActs,
      });

      expect(res.personalised_by).toBe('rules');
      expect(res.reply).toContain('removed breathing exercises');
      expect(res.recommendations).toHaveLength(3);
      for (const rec of res.recommendations) {
        expect(rec.activity.type).not.toBe('breathing');
      }
    });

    it('timeout falls back cleanly to template reply', async () => {
      mockGenerateContent.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 6000))
      );

      const res = await handleChatRefinement({
        message: 'shorter please',
        mood: 'Anxious',
        themes: ['general'],
        currentActivities: currentActs,
        timeoutMs: 50, // short timeout for test speed
      });

      expect(res.personalised_by).toBe('rules');
      expect(res.reply).toContain('minutes or less');
      expect(res.recommendations).toHaveLength(3);
      for (const rec of res.recommendations) {
        expect(rec.activity.duration_minutes).toBeLessThanOrEqual(2);
      }
    });

    it('valid Gemini response merges AI constraints and returns personalised_by: "ai"', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          reply: 'I heard you prefer grounded practices, so I adjusted your list accordingly.',
          constraints: {
            max_minutes: null,
            exclude_types: ['breathing'],
            wants_swap: false,
          },
        }),
      });

      const res = await handleChatRefinement({
        message: 'I would prefer not to breathe right now',
        mood: 'Anxious',
        themes: ['general'],
        currentActivities: currentActs,
      });

      expect(res.personalised_by).toBe('ai');
      expect(res.reply).toContain('grounded practices');
      expect(res.recommendations).toHaveLength(3);
      for (const rec of res.recommendations) {
        expect(rec.activity.type).not.toBe('breathing');
        expect(rec.personalised_by).toBe('ai');
      }
    });

    it('no message text appears in console output (spy on console)', async () => {
      const logSpy = vi.spyOn(console, 'log');
      const warnSpy = vi.spyOn(console, 'warn');
      const errorSpy = vi.spyOn(console, 'error');

      const sensitiveText = 'super-secret-confidential-user-message-12345';
      await handleChatRefinement({
        message: sensitiveText,
        mood: 'Anxious',
        themes: ['general'],
        currentActivities: currentActs,
      });

      const allCalls = [
        ...logSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ].flat();

      for (const arg of allCalls) {
        expect(String(arg)).not.toContain(sensitiveText);
      }

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('chat refinement response is decoupled from suggestions and never returns or regenerates situation or later', async () => {
      const res = await handleChatRefinement({
        message: 'No breathing exercises',
        mood: 'Anxious',
        themes: ['general'],
        currentActivities: currentActs,
      });

      // Returns reply, now, next, recommendations, personalised_by only
      expect(res).toHaveProperty('reply');
      expect(res).toHaveProperty('now');
      expect(res).toHaveProperty('next');
      expect(res).toHaveProperty('recommendations');
      expect(res).toHaveProperty('personalised_by');
      // Never returns situation, later, action_steps, or suggestions
      expect(res).not.toHaveProperty('suggestions');
      expect(res).not.toHaveProperty('suggestions_by');
      expect(res).not.toHaveProperty('situation');
      expect(res).not.toHaveProperty('later');
      expect(res).not.toHaveProperty('action_steps');
    });

    it('"no breathing" and "something else" update now and next appropriately while Gemini request omits action steps and identifying info', async () => {
      // 1. "no breathing" removes breathing from both now and next
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          reply: 'Switched to non-breathing grounding and reflection options.',
          constraints: { max_minutes: null, exclude_types: ['breathing'], wants_swap: false },
        }),
      });

      const noBreath = await handleChatRefinement({
        message: 'No breathing exercises',
        mood: 'Anxious',
        note: 'Exam stress',
        themes: ['academics'],
        currentActivities: currentActs,
      });

      expect(noBreath.now?.activity.type).not.toBe('breathing');
      expect(noBreath.next?.every((n) => n.activity.type !== 'breathing')).toBe(true);
      expect(noBreath).not.toHaveProperty('situation');
      expect(noBreath).not.toHaveProperty('later');

      // Check Gemini payload has no action steps or user_id
      const sentPayload = JSON.parse(mockGenerateContent.mock.calls[0][0].contents);
      expect(sentPayload).not.toHaveProperty('action_steps');
      expect(sentPayload).not.toHaveProperty('situation');
      expect(sentPayload).not.toHaveProperty('later');
      expect(sentPayload).not.toHaveProperty('user_id');

      // 2. "something else" swaps current activities
      const baseline = await handleChatRefinement({
        message: 'Why these?',
        mood: 'Anxious',
        note: 'Exam stress',
        themes: ['academics'],
        currentActivities: currentActs,
      });
      const shownActs = [
        baseline.now!.activity,
        ...baseline.next!.map((n) => n.activity),
      ];
      const shownIds = new Set(shownActs.map((a) => a.id));

      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          reply: 'Refreshed your Right now and Next activities.',
          constraints: { max_minutes: null, exclude_types: [], wants_swap: true },
        }),
      });

      const swapped = await handleChatRefinement({
        message: 'something else',
        mood: 'Anxious',
        note: 'Exam stress',
        themes: ['academics'],
        currentActivities: shownActs,
      });

      expect(swapped.now?.activity.id).not.toBe(shownActs[0].id);
      const swappedIds = [swapped.now!.activity.id, ...swapped.next!.map((n) => n.activity.id)];
      const newCount = swappedIds.filter((id) => !shownIds.has(id)).length;
      expect(newCount).toBeGreaterThanOrEqual(2);
    });
  });
});
