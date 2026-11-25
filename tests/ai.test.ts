import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { recommend, getAiPlan, stripCodeFences } from '../src/lib/recommender';
import { detectThemes } from '../src/lib/recommender/themes';
import { buildPools, isQuickActivity, matchesMoodGoal } from '../src/lib/recommender/plan';
import { getAiTelemetry, resetAiTelemetry } from '../src/lib/ai/gemini';
import { Mood } from '../src/types';

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

describe('AI Plan Recommender & Gemini Integration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    resetAiTelemetry();
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.GEMINI_MODEL = 'gemini-flash-lite-latest';
    delete process.env.DEMO_MODE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const makeValidPlanJsonForMood = (mood: Mood, noteText = 'Studying for exams', override: Record<string, any> = {}) => {
    const pools = buildPools(mood, detectThemes(noteText));
    const nowAct = pools.now_pool[0];
    const next0 = pools.next_pool.find((a) => a.id !== nowAct.id) || pools.next_pool[0];
    const next1 =
      pools.next_pool.find(
        (a) =>
          a.id !== nowAct.id &&
          a.id !== next0.id &&
          !(nowAct.type === next0.type && a.type === next0.type) &&
          !(mood === 'Okay' && (nowAct.type === 'breathing' || nowAct.type === 'grounding') && (next0.type === 'breathing' || next0.type === 'grounding') && (a.type === 'breathing' || a.type === 'grounding'))
      ) || pools.next_pool[1];
    return {
      understanding: {
        main_concern: `Coping with ${mood.toLowerCase()} feelings around: ${noteText || 'today'}.`,
        intensity: 'medium',
        need: mood === 'Sad' ? 'comfort' : 'focus',
      },
      relevant_themes: ['academics'],
      acknowledgement: 'Feeling stretched before important milestones makes complete sense right now.',
      why_this_order: 'Calming acute physical tension first clears focus for practical next actions.',
      situation: {
        summary: 'Managing stress and pressure around an upcoming deadline.',
        what_is_in_your_control: 'You can organize your top priority and communicate clearly today.',
        action_steps: [
          { step: 'Write down top task', detail: 'List the single concrete step you need to finish next.', time: 'now' },
          { step: 'Protect 25 study minutes', detail: 'Turn off notifications during one focused block.', time: 'today' },
          { step: 'Check in with mentor', detail: 'Send one short question about any unclear requirement.', time: 'this_week' },
        ],
      },
      now: {
        activity_id: nowAct.id,
        reason: 'Provides immediate physical relief to clear racing thoughts.',
        instruction: 'Close tabs for sixty seconds and follow one slow breathing round.',
      },
      next: [
        {
          activity_id: next0.id,
          reason: 'Addresses your core workload situation systematically.',
        },
        {
          activity_id: next1.id,
          reason: 'Reinforces steadiness without pushing yourself too hard.',
        },
      ],
      next_step: 'Outline the one task that relieves the most pressure today.',
      ...override,
    };
  };

  it('stripCodeFences cleans code fences from raw LLM output', () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripCodeFences('```\n{"b":2}\n```')).toBe('{"b":2}');
    expect(stripCodeFences('  {"c":3}  ')).toBe('{"c":3}');
  });

  it('valid AI plan response sets plan parts with by: "ai" and exact schema', async () => {
    const payload = makeValidPlanJsonForMood('Anxious', 'Not performing well in academics');
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(payload),
    });

    const result = await recommend('Anxious', 'Not performing well in academics');
    const plan = result.plan!;

    expect(result).toHaveLength(3);
    expect(plan.now.by).toBe('ai');
    expect(plan.next).toHaveLength(2);
    expect(plan.next[0].by).toBe('ai');
    expect(plan.next[1].by).toBe('ai');
    expect(plan.later.by).toBe('ai');
    expect(plan.situation_by).toBe('ai');
    expect(plan.acknowledgement_by).toBe('ai');
    expect(plan.why_this_order_by).toBe('ai');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('parses fenced markdown JSON from Gemini correctly', async () => {
    const payload = makeValidPlanJsonForMood('Stressed', 'Work deadline pressure');
    mockGenerateContent.mockResolvedValueOnce({
      text: '```json\n' + JSON.stringify(payload) + '\n```',
    });

    const result = await recommend('Stressed', 'Work deadline pressure');
    expect(result.plan?.now.by).toBe('ai');
  });

  it('invalid JSON once then valid on retry: succeeds on attempt 2', async () => {
    const payload = makeValidPlanJsonForMood('Anxious', 'Exam worries');
    mockGenerateContent
      .mockResolvedValueOnce({ text: 'NOT JSON AT ALL' })
      .mockResolvedValueOnce({ text: JSON.stringify(payload) });

    const result = await recommend('Anxious', 'Exam worries');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result.plan?.now.by).toBe('ai');
  });

  it('fallbacks: invalid twice, timeout, missing key, DEMO_MODE, and failing call each return full rules plan with identical shape', async () => {
    const expectedKeys = ['understanding', 'acknowledgement', 'why_this_order', 'situation', 'now', 'next', 'later'];

    // 1. Invalid JSON twice
    mockGenerateContent.mockResolvedValue({ text: '{ broken json' });
    const resInvalidTwice = await recommend('Anxious', 'Study test');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(resInvalidTwice.plan?.now.by).toBe('rules');
    expect(Object.keys(resInvalidTwice.plan!)).toEqual(expect.arrayContaining(expectedKeys));

    // 2. Timeout
    vi.clearAllMocks();
    mockGenerateContent.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ text: '{}' }), 200))
    );
    const pools = buildPools('Stressed', []);
    const timeoutOutcome = await getAiPlan({ mood: 'Stressed', note: 'Busy', pools, timeoutMs: 30 });
    expect(timeoutOutcome).toBeNull();
    expect(getAiTelemetry().last_ai_call).toBe('timeout');

    // 3. Rejecting/failing SDK call
    vi.clearAllMocks();
    mockGenerateContent.mockRejectedValueOnce(new Error('503 Service Unavailable'));
    const resFailingCall = await recommend('Stressed', 'Busy week');
    expect(resFailingCall.plan?.now.by).toBe('rules');
    expect(resFailingCall.plan?.next).toHaveLength(2);
    expect(resFailingCall.plan?.later.action_steps).toHaveLength(3);

    // 4. Missing API key
    vi.clearAllMocks();
    delete process.env.GEMINI_API_KEY;
    const resNoKey = await recommend('Sad', 'Missing friends');
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(resNoKey.plan?.now.by).toBe('rules');
    expect(Object.keys(resNoKey.plan!)).toEqual(expect.arrayContaining(expectedKeys));

    // 5. DEMO_MODE=true
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.DEMO_MODE = 'true';
    const resDemo = await recommend('Overwhelmed', 'Too many tasks');
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(resDemo.plan?.now.by).toBe('rules');
    expect(Object.keys(resDemo.plan!)).toEqual(expect.arrayContaining(expectedKeys));
  });

  it('partial validation: out-of-pool id or unsafe later drops ONLY invalid part while keeping rest AI', async () => {
    const mood: Mood = 'Anxious';
    const note = 'Not performing well in academics';
    const valid = makeValidPlanJsonForMood(mood, note);
    // Out-of-pool id in next[0] and unsafe medical advice in later action_steps
    valid.next[0].activity_id = 'does-not-exist-anywhere';
    valid.situation.action_steps[1] = {
      step: 'Buy medication',
      detail: 'Start taking prescription pills and supplements immediately.',
      time: 'today',
    };

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(valid),
    });

    const result = await recommend(mood, note);
    const plan = result.plan!;

    expect(plan.now.by).toBe('ai');
    expect(plan.next[0].by).toBe('rules');
    expect(plan.next[1].by).toBe('ai');
    expect(plan.later.by).toBe('rules');
    expect(plan.acknowledgement_by).toBe('ai');
    expect(JSON.stringify(plan.later.action_steps).toLowerCase()).not.toContain('medication');
  });

  describe('Privacy & Input Order', () => {
    it('payload sends raw_note first, mood, labelled detected_themes hints, both pools, and feedback_summary with zero user_id', async () => {
      const valid = makeValidPlanJsonForMood('Stressed', 'My teammate is slacking off');
      mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(valid) });

      const rawNote = 'My teammate is slacking off and deadline is close';
      await recommend('Stressed', rawNote, 'secret-user-999');

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const sentBody = JSON.parse(mockGenerateContent.mock.calls[0][0].contents);
      const keys = Object.keys(sentBody);

      expect(keys[0]).toBe('raw_note');
      expect(sentBody.raw_note).toBe(rawNote);
      expect(sentBody.mood).toBe('Stressed');
      expect(sentBody.detected_themes.note).toContain('hints, may be wrong or empty');
      expect(Array.isArray(sentBody.now_pool)).toBe(true);
      expect(sentBody.now_pool.length).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(sentBody.next_pool)).toBe(true);
      expect(sentBody.next_pool.length).toBeGreaterThanOrEqual(3);
      expect(sentBody).toHaveProperty('feedback_summary');

      // Zero identifying fields
      const serialized = JSON.stringify(sentBody);
      expect(serialized).not.toContain('secret-user-999');
      expect(sentBody).not.toHaveProperty('user_id');
      expect(sentBody).not.toHaveProperty('userId');

      expect(getAiTelemetry().last_ai_call).toBe('ok');
      expect(getAiTelemetry().note_sent).toBe(true);
      expect(JSON.stringify(getAiTelemetry())).not.toContain(rawNote);
    });

    it('empty note marks raw_note empty and sets note_sent: false in telemetry', async () => {
      const valid = makeValidPlanJsonForMood('Okay', '');
      mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(valid) });

      await recommend('Okay', '');

      const sentBody = JSON.parse(mockGenerateContent.mock.calls[0][0].contents);
      expect(sentBody.raw_note).toContain('empty');
      expect(getAiTelemetry().note_sent).toBe(false);
    });

    it('unclassified note with no keyword themes still triggers Gemini AI call', async () => {
      const noteText = 'A bizarre afternoon watching clouds go sideways';
      const valid = makeValidPlanJsonForMood('Anxious', noteText);
      mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(valid) });

      const res = await recommend('Anxious', noteText);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(res.plan?.now.by).toBe('ai');
    });

    it('safety trigger makes NO Gemini call', async () => {
      const res = await recommend('Sad', 'I want to end my life right now');
      expect(mockGenerateContent).not.toHaveBeenCalled();
      expect(res.plan?.now.by).toBe('rules');
    });

    it('never logs note text, prompt, or AI response to console', async () => {
      const logSpy = vi.spyOn(console, 'log');
      const warnSpy = vi.spyOn(console, 'warn');
      const errorSpy = vi.spyOn(console, 'error');

      const privateNote = 'Confidential private string xy-7788-zz';
      mockGenerateContent.mockResolvedValue({ text: 'invalid-non-json-response-marker' });

      await recommend('Anxious', privateNote);

      const allArgs = [
        ...logSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ].flat();

      for (const arg of allArgs) {
        expect(String(arg)).not.toContain(privateNote);
        expect(String(arg)).not.toContain('invalid-non-json-response-marker');
      }

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('Situation Coverage Across 12 Notes (AI Mocked)', () => {
    const twelveScenarios: Array<{ mood: Mood; note: string }> = [
      { mood: 'Anxious', note: 'Exams are approaching and I am falling behind' },
      { mood: 'Stressed', note: 'My manager keeps piling extra work on me' },
      { mood: 'Stressed', note: 'My teammate is not contributing anything to our project' },
      { mood: 'Sad', note: 'Had an argument and fight with my parents today' },
      { mood: 'Overwhelmed', note: 'Cannot sleep with insomnia again all week' },
      { mood: 'Sad', note: 'I feel lonely and disconnected in a new town' },
      { mood: 'Anxious', note: 'Money is tight and utility bills are overdue' },
      { mood: 'Anxious', note: 'I have a medical test result coming tomorrow morning' },
      { mood: 'Stressed', note: 'Stuck in a terrible two-hour commute both ways' },
      { mood: 'Sad', note: 'Just having a bad day with no clear reason at all' },
      { mood: 'Okay', note: '' },
      { mood: 'Overwhelmed', note: 'tired' },
    ];

    it('handles all 12 diverse notes cleanly with valid duplicate-free quick-first AI plans', async () => {
      for (const s of twelveScenarios) {
        const mockResp = makeValidPlanJsonForMood(s.mood, s.note);
        mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(mockResp) });

        const res = await recommend(s.mood, s.note);
        const plan = res.plan!;

        expect(plan.now.by).toBe('ai');
        expect(plan.next).toHaveLength(2);
        expect(plan.later.action_steps).toHaveLength(3);
        expect(isQuickActivity(plan.now.activity)).toBe(true);
        expect(matchesMoodGoal(plan.now.activity, s.mood)).toBe(true);

        const ids = [plan.now.activity.id, plan.next[0].activity.id, plan.next[1].activity.id];
        expect(new Set(ids).size).toBe(3);
      }
    });
  });
});
