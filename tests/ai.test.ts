import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { recommend, getAiPlan, stripCodeFences } from '../src/lib/recommender';
import { detectThemes } from '../src/lib/recommender/themes';
import {
  buildPools,
  contradictsWhatNotToSuggest,
  isQuickActivity,
  isWorkOrStudyActivity,
  matchesMoodGoal,
  validatePlan,
} from '../src/lib/recommender/plan';
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

  describe('AI-First Open-Ended Understanding, Guards & 16+ Diverse Scenarios (AI Mocked + AI Off)', () => {
    const sixteenScenarios: Array<{
      mood: Mood;
      note: string;
      timeContext?: string;
      whatNotToSuggest?: string[];
      lateNight?: boolean;
      rulesMatched?: boolean;
      forbiddenUnmatchedTopics?: RegExp;
    }> = [
      {
        mood: 'Anxious',
        note: "3am can't sleep exam tomorrow",
        timeContext: '3am before exam tomorrow',
        whatNotToSuggest: ['studying', 'caffeine', 'screens', 'new tasks', 'focus sprint'],
        lateNight: true,
        rulesMatched: true,
      },
      {
        mood: 'Stressed',
        note: 'my phone broke and my trip is tomorrow',
        timeContext: 'night before trip',
        whatNotToSuggest: ['caffeine'],
        rulesMatched: false,
        forbiddenUnmatchedTopics: /\b(financial|budget|bills|paycheck|rent)\b/i,
      },
      {
        mood: 'Sad',
        note: 'argued with my dad tonight',
        timeContext: 'tonight after argument',
        whatNotToSuggest: ['confrontation'],
        rulesMatched: true,
      },
      {
        mood: 'Sad',
        note: 'my pet is sick',
        timeContext: 'today',
        whatNotToSuggest: ['intense exercise'],
        rulesMatched: false,
        forbiddenUnmatchedTopics: /\b(physician|primary care|medical test|hospital)\b/i,
      },
      {
        mood: 'Anxious',
        note: 'I have a job interview in an hour',
        timeContext: '1 hour before interview',
        whatNotToSuggest: ['new tasks'],
        rulesMatched: false,
        forbiddenUnmatchedTopics: /\b(quarterly|inbox|manager|spreadsheet)\b/i,
      },
      {
        mood: 'Overwhelmed',
        note: 'tired',
        timeContext: '',
        whatNotToSuggest: ['caffeine'],
        rulesMatched: false,
        forbiddenUnmatchedTopics: /\b(insomnia|bedtime|nightmare)\b/i,
      },
      {
        mood: 'Okay',
        note: '',
        timeContext: '',
        whatNotToSuggest: [],
        rulesMatched: false,
      },
      {
        mood: 'Anxious',
        note: 'Exams are approaching and I am falling behind',
        timeContext: 'daytime',
        whatNotToSuggest: ['cramming'],
        rulesMatched: true,
      },
      {
        mood: 'Overwhelmed',
        note: 'Wide awake at 2am worrying about everything',
        timeContext: '2am sleepless',
        whatNotToSuggest: ['studying', 'work', 'screens'],
        lateNight: true,
        rulesMatched: true,
      },
      {
        mood: 'Sad',
        note: 'I feel lonely and disconnected in a new town',
        timeContext: 'evening',
        whatNotToSuggest: [],
        rulesMatched: true,
      },
      {
        mood: 'Anxious',
        note: 'Money is tight and utility bills are overdue',
        timeContext: 'today',
        whatNotToSuggest: ['impulse spending'],
        rulesMatched: true,
      },
      {
        mood: 'Sad',
        note: 'Had a painful breakup with my girlfriend yesterday',
        timeContext: 'day after breakup',
        whatNotToSuggest: ['confrontation'],
        rulesMatched: true,
      },
      {
        mood: 'Stressed',
        note: 'My car broke down on the highway before a wedding',
        timeContext: 'afternoon',
        whatNotToSuggest: [],
        rulesMatched: false,
        forbiddenUnmatchedTopics: /\b(financial|budget|bills|paycheck|rent)\b/i,
      },
      {
        mood: 'Stressed',
        note: 'Stuck in a terrible two-hour commute both ways',
        timeContext: 'commute',
        whatNotToSuggest: [],
        rulesMatched: false,
      },
      {
        mood: 'Overwhelmed',
        note: 'Moving apartments tomorrow and surrounded by unpacked boxes',
        timeContext: 'evening before move',
        whatNotToSuggest: ['caffeine'],
        rulesMatched: false,
      },
      {
        mood: 'Anxious',
        note: 'Waiting to hear back about my apartment lease renewal',
        timeContext: 'today',
        whatNotToSuggest: [],
        rulesMatched: false,
      },
    ];

    it('handles all 16 diverse notes with mocked Gemini: valid plans, open-ended understanding, raw_note sent without user_id, zero console leaks, and late-night safety', async () => {
      const logSpy = vi.spyOn(console, 'log');
      const warnSpy = vi.spyOn(console, 'warn');
      const errorSpy = vi.spyOn(console, 'error');

      for (const s of sixteenScenarios) {
        const pools = buildPools(s.mood, []);
        const valid = makeValidPlanJsonForMood(s.mood, s.note, {
          understanding: {
            main_concern: `Supporting ${s.mood.toLowerCase()} state around note.`,
            urgency: s.lateNight ? 'high' : 'medium',
            time_context: s.timeContext || '',
            constraints: s.lateNight ? ['needs sleep now'] : [],
            what_not_to_suggest: s.whatNotToSuggest || [],
            need: s.lateNight ? 'rest' : 'calm',
          },
          relevant_themes: [],
        });

        // Pick a non-work/non-contradicting activity when needed or let validatePlan repair if violated
        mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(valid) });

        const res = await recommend(s.mood, s.note, 'private-user-id-abc');
        const plan = res.plan!;

        expect(plan).toBeDefined();
        expect(plan.now.activity).toBeDefined();
        expect(plan.next).toHaveLength(2);
        expect(plan.later.action_steps).toHaveLength(3);
        expect(plan.later.action_steps.some((st) => st.time === 'now')).toBe(true);
        expect(isQuickActivity(plan.now.activity)).toBe(true);
        expect(matchesMoodGoal(plan.now.activity, s.mood)).toBe(true);

        const ids = [plan.now.activity.id, plan.next[0].activity.id, plan.next[1].activity.id];
        expect(new Set(ids).size).toBe(3);

        // Verify what_not_to_suggest is never contradicted by any chosen activity, instruction, or step
        const whatNot = plan.understanding?.what_not_to_suggest || [];
        expect(contradictsWhatNotToSuggest(plan.now.activity, whatNot)).toBe(false);
        expect(contradictsWhatNotToSuggest(plan.now.instruction, whatNot)).toBe(false);
        for (const n of plan.next) {
          expect(contradictsWhatNotToSuggest(n.activity, whatNot)).toBe(false);
        }
        for (const st of plan.later.action_steps) {
          expect(contradictsWhatNotToSuggest(`${st.step} ${st.detail}`, whatNot)).toBe(false);
        }

        // Late-night notes never receive work, study, or focus_sprint activities
        if (s.lateNight) {
          expect(isWorkOrStudyActivity(plan.now.activity)).toBe(false);
          for (const n of plan.next) {
            expect(isWorkOrStudyActivity(n.activity)).toBe(false);
          }
        }

        // Verify payload sent raw_note and NO user_id
        const lastCall = mockGenerateContent.mock.calls[mockGenerateContent.mock.calls.length - 1];
        const sentPayload = JSON.parse(lastCall[0].contents);
        expect(sentPayload).not.toHaveProperty('user_id');
        expect(sentPayload).not.toHaveProperty('userId');
        expect(JSON.stringify(sentPayload)).not.toContain('private-user-id-abc');
        if (s.note.trim()) {
          expect(sentPayload.raw_note).toBe(s.note.trim());
        }
      }

      // Zero note text leaked to console
      const allConsole = [
        ...logSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ]
        .flat()
        .map(String)
        .join(' ');
      expect(allConsole).not.toContain('my phone broke and my trip is tomorrow');
      expect(allConsole).not.toContain('my pet is sick');
      expect(allConsole).not.toContain('argued with my dad tonight');

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('AI-off mode across all 16 diverse notes: honest line for unmatched notes, no unrelated templates, late-night never gets study/work', async () => {
      process.env.DEMO_MODE = 'true';

      for (const s of sixteenScenarios) {
        const res = await recommend(s.mood, s.note);
        const plan = res.plan!;

        expect(plan.now.by).toBe('rules');
        expect(plan.next).toHaveLength(2);
        expect(plan.later.action_steps).toHaveLength(3);
        expect(isQuickActivity(plan.now.activity)).toBe(true);
        expect(matchesMoodGoal(plan.now.activity, s.mood)).toBe(true);

        const ids = [plan.now.activity.id, plan.next[0].activity.id, plan.next[1].activity.id];
        expect(new Set(ids).size).toBe(3);

        if (s.lateNight) {
          expect(isWorkOrStudyActivity(plan.now.activity)).toBe(false);
          for (const n of plan.next) {
            expect(isWorkOrStudyActivity(n.activity)).toBe(false);
          }
          expect(plan.situation.summary.toLowerCase()).not.toContain('exam');
        }

        if (s.note.trim() && !s.rulesMatched) {
          expect(plan.note_interpreted).toBe(false);
          expect(plan.acknowledgement).toContain(
            'Turn on AI mode to get suggestions based on your note.'
          );
          if (s.forbiddenUnmatchedTopics) {
            const fullText = `${plan.acknowledgement} ${plan.situation.summary} ${plan.situation.what_is_in_your_control} ${JSON.stringify(plan.later.action_steps)}`;
            expect(fullText).not.toMatch(s.forbiddenUnmatchedTopics);
          }
        }
      }
    });

    it('code-side guards replace ONLY violating AI parts against what_not_to_suggest and late-night rule', () => {
      const mood: Mood = 'Anxious';
      const note = "3am can't sleep exam tomorrow";
      const pools = buildPools(mood, []);

      // Deliberately inject a work/study activity, caffeine instruction, and studying step
      const rawViolating = makeValidPlanJsonForMood(mood, note, {
        understanding: {
          main_concern: 'Anxious at 3am before tomorrow exam.',
          urgency: 'medium',
          time_context: '3am late night before exam',
          constraints: ['must sleep now'],
          what_not_to_suggest: ['studying', 'caffeine', 'screens', 'focus sprint'],
          need: 'rest',
        },
        now: {
          activity_id: pools.now_pool[0].id,
          reason: 'Gentle breathing slows down nighttime racing thoughts.',
          instruction: 'Drink coffee and open your laptop to read notes.',
        },
        next: [
          {
            activity_id: 'break-it-into-one-small-step', // tagged study/work!
            reason: 'Break exam studying into tasks.',
          },
          {
            activity_id:
              pools.next_pool.filter((a) => !isWorkOrStudyActivity(a) && !contradictsWhatNotToSuggest(a, ['studying', 'caffeine', 'screens', 'focus sprint']))[2]?.id ||
              'sleep-wind-down',
            reason: 'Park worries calmly for the morning.',
          },
        ],
        situation: {
          summary: 'Awake at 3am feeling anxious about tomorrow exam.',
          what_is_in_your_control: 'You can protect sleep tonight and handle review tomorrow.',
          action_steps: [
            { step: 'Dim room lights now', detail: 'Turn off bright ceiling lights and rest your eyes.', time: 'now' },
            { step: 'Review flashcards now', detail: 'Study your hardest exam chapters for thirty minutes.', time: 'today' },
            { step: 'Rest before morning', detail: 'Leave exam preparation until after waking up.', time: 'this_week' },
          ],
        },
      });

      const outcome = validatePlan(rawViolating, { mood, note, detectedThemes: [], pools });
      const plan = outcome.plan;

      // Acknowledgement stayed AI
      expect(plan.acknowledgement_by).toBe('ai');
      // Instruction contradicted caffeine/screens -> replaced cleanly with rules
      expect(plan.now.by).toBe('rules');
      expect(contradictsWhatNotToSuggest(plan.now.instruction, ['studying', 'caffeine', 'screens'])).toBe(false);
      // next[0] was study/work at 3am -> replaced ONLY next[0], preserving next[1] as AI
      expect(plan.next[0].by).toBe('rules');
      expect(isWorkOrStudyActivity(plan.next[0].activity)).toBe(false);
      expect(plan.next[1].by).toBe('ai');
      // action_steps[1] contradicted studying -> replaced ONLY violating step!
      expect(plan.later.action_steps[0].step).toBe('Dim room lights now');
      expect(plan.later.action_steps[1].step.toLowerCase()).not.toContain('flashcard');
      expect(plan.later.action_steps[2].step).toBe('Rest before morning');
      expect(plan.later.by).toBe('rules');
    });
  });
});
