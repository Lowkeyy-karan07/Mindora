import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildPools,
  buildRulesPlan,
  findGentlestQuickActivity,
  getMoodGoal,
  isGeneralPurpose,
  isQuickActivity,
  matchesMoodGoal,
  validatePlan,
} from '../src/lib/recommender/plan';
import { scoreCandidates } from '../src/lib/recommender/rules';
import { detectThemes } from '../src/lib/recommender/themes';
import { recommend } from '../src/lib/recommender';
import { MOODS, Mood, Theme } from '../src/types';

describe('Ordered Plan: Pools, Coverage, Validation, Teamwork & Feedback', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DEMO_MODE = 'true';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. buildPools invariants & constraints', () => {
    it('now_pool is always quick (<=2m), matches mood goal, mood_fit >= 1, up to 5 items across all 5 moods', () => {
      for (const mood of MOODS) {
        const pools = buildPools(mood, []);
        expect(pools.now_pool.length).toBeGreaterThanOrEqual(3);
        expect(pools.now_pool.length).toBeLessThanOrEqual(5);

        for (const act of pools.now_pool) {
          expect(isQuickActivity(act)).toBe(true);
          expect(act.duration_minutes).toBeLessThanOrEqual(2);
          expect(act.mood_fit[mood] ?? 0).toBeGreaterThanOrEqual(1);
          expect(matchesMoodGoal(act, mood)).toBe(true);
        }

        // Verify expected mood goal mapping
        if (mood === 'Sad' || mood === 'Okay') {
          expect(getMoodGoal(mood)).toBe('lift');
        } else {
          expect(getMoodGoal(mood)).toBe('calm');
        }
      }
    });

    it('next_pool excludes now_pool, mood_fit >= 1, up to 8 items, and includes >= 3 general-purpose activities', () => {
      for (const mood of MOODS) {
        const themesToTest: Theme[][] = [[], ['academics'], ['teamwork'], ['health_worry'], ['general']];
        for (const themes of themesToTest) {
          const pools = buildPools(mood, themes);
          const nowIds = new Set(pools.now_pool.map((a) => a.id));

          expect(pools.next_pool.length).toBeGreaterThanOrEqual(3);
          expect(pools.next_pool.length).toBeLessThanOrEqual(8);

          for (const act of pools.next_pool) {
            expect(nowIds.has(act.id)).toBe(false);
            expect(act.mood_fit[mood] ?? 0).toBeGreaterThanOrEqual(1);
          }

          const generalCount = pools.next_pool.filter((a) => isGeneralPurpose(a)).length;
          expect(generalCount).toBeGreaterThanOrEqual(3);
        }
      }
    });

    it('empty or "general" themes do not shrink or skip pools', () => {
      for (const mood of MOODS) {
        const baseline = buildPools(mood, []);
        const generalOnly = buildPools(mood, ['general']);

        expect(baseline.now_pool.length).toBeGreaterThanOrEqual(3);
        expect(generalOnly.now_pool.length).toBeGreaterThanOrEqual(3);
        expect(baseline.next_pool.length).toBeGreaterThanOrEqual(5);
        expect(generalOnly.next_pool.length).toBeGreaterThanOrEqual(5);
      }
    });

    it('applies constraints before AI sees pools and flags constraints_relaxed when relaxed', () => {
      // No breathing filter leaves valid pools without relaxing on Anxious
      const noBreathing = buildPools('Anxious', [], undefined, undefined, {
        excludeTypes: ['breathing'],
      });
      expect(noBreathing.constraints_relaxed).toBe(false);
      expect(noBreathing.now_pool.every((a) => a.type !== 'breathing')).toBe(true);
      expect(noBreathing.next_pool.every((a) => a.type !== 'breathing')).toBe(true);

      // Impossible constraints (<= 1m + exclude breathing) on Anxious forces relaxation
      const impossible = buildPools('Anxious', [], undefined, undefined, {
        maxMinutes: 1,
        excludeTypes: ['breathing'],
      });
      expect(impossible.constraints_relaxed).toBe(true);
      expect(impossible.now_pool.length).toBeGreaterThanOrEqual(1);
      expect(impossible.next_pool.length).toBeGreaterThanOrEqual(2);
    });

    it('ignores themes completely in buildPools (pools depend on mood_fit, quick/relief, feedback, and constraints only)', () => {
      for (const mood of MOODS) {
        const noThemes = buildPools(mood, []);
        const examThemes = buildPools(mood, ['academics', 'work']);
        const sleepThemes = buildPools(mood, ['sleep', 'conflict']);

        expect(examThemes.now_pool.map((a) => a.id)).toEqual(noThemes.now_pool.map((a) => a.id));
        expect(sleepThemes.now_pool.map((a) => a.id)).toEqual(noThemes.now_pool.map((a) => a.id));
        expect(examThemes.next_pool.map((a) => a.id)).toEqual(noThemes.next_pool.map((a) => a.id));
        expect(sleepThemes.next_pool.map((a) => a.id)).toEqual(noThemes.next_pool.map((a) => a.id));
      }
    });

    it('is deterministic across repeated calls with identical inputs', () => {
      const p1 = buildPools('Stressed', ['teamwork', 'work'], undefined, { 'box-breathing': 'yes' });
      const p2 = buildPools('Stressed', ['teamwork', 'work'], undefined, { 'box-breathing': 'yes' });
      expect(p1.now_pool.map((a) => a.id)).toEqual(p2.now_pool.map((a) => a.id));
      expect(p1.next_pool.map((a) => a.id)).toEqual(p2.next_pool.map((a) => a.id));
    });
  });

  describe('2. Honest Rules Mode high-confidence situations vs unmatched notes', () => {
    it('detects teamwork keywords as informational hints without gating pools', () => {
      expect(detectThemes('My TEAMMATE is not contributing to our group project')).toContain('teamwork');
      expect(detectThemes('Huge argument and fight where I felt disrespected and ignored')).toContain('conflict');
    });

    it('"argued with my dad tonight" with Sad matches high-confidence conflict in Honest Rules Mode', () => {
      const note = 'argued with my dad tonight';
      const pools = buildPools('Sad', []);
      const plan = buildRulesPlan('Sad', [], note, pools);

      expect(isQuickActivity(plan.now.activity)).toBe(true);
      expect(matchesMoodGoal(plan.now.activity, 'Sad')).toBe(true);
      expect(plan.note_interpreted).toBe(true);
      expect(plan.acknowledgement.toLowerCase()).toMatch(/disagreement|conflict|hurt|conversation/);
      expect(plan.acknowledgement).not.toContain('Turn on AI mode');
    });
  });

  describe('3. Situation coverage across 12+ diverse notes (AI-off)', () => {
    const situations: Array<{ label: string; mood: Mood; note: string; unrecognised?: boolean }> = [
      { label: 'exam', mood: 'Anxious', note: 'Not performing well in academics, exams are next week' },
      { label: 'unmatched work', mood: 'Stressed', note: 'My boss added two urgent reports to my workload today', unrecognised: true },
      { label: 'unmatched teammate', mood: 'Stressed', note: 'My teammate is not contributing to our group project', unrecognised: true },
      { label: 'conflict', mood: 'Sad', note: 'Had an intense argument and fight with my family last night' },
      { label: 'sleep', mood: 'Overwhelmed', note: 'Insomnia again, I cannot sleep and feel exhausted' },
      { label: 'loneliness', mood: 'Sad', note: 'Feel completely lonely and isolated since moving here' },
      { label: 'money', mood: 'Anxious', note: 'Rent and monthly bills are piling up and money is tight' },
      { label: 'romance', mood: 'Sad', note: 'Painful breakup with my girlfriend yesterday' },
      { label: 'long commute', mood: 'Stressed', note: 'Stuck in brutal traffic on a two-hour commute every morning', unrecognised: true },
      { label: 'bad day no reason', mood: 'Sad', note: 'Everything feels heavy and grey today without a clear reason', unrecognised: true },
      { label: 'empty note', mood: 'Okay', note: '' },
      { label: 'very short note', mood: 'Overwhelmed', note: 'tired', unrecognised: true },
    ];

    it('produces complete, duplicate-free plans for all 12 scenarios and shows honest "Turn on AI mode" line for unrecognised notes', async () => {
      for (const s of situations) {
        const res = await recommend(s.mood, s.note);
        const plan = res.plan!;

        expect(plan).toBeDefined();
        expect(plan.acknowledgement.length).toBeGreaterThan(10);
        expect(plan.why_this_order.length).toBeGreaterThan(10);
        expect(plan.now.activity).toBeDefined();
        expect(plan.next).toHaveLength(2);
        expect(plan.later.action_steps).toHaveLength(3);
        expect(plan.later.action_steps.some((st) => st.time === 'now')).toBe(true);
        expect(plan.later.next_step.length).toBeGreaterThan(5);

        // No repeated activities across now + next
        const ids = [plan.now.activity.id, plan.next[0].activity.id, plan.next[1].activity.id];
        expect(new Set(ids).size).toBe(3);

        // Right now activity is always quick and matches mood goal
        expect(isQuickActivity(plan.now.activity)).toBe(true);
        expect(matchesMoodGoal(plan.now.activity, s.mood)).toBe(true);

        if (s.unrecognised) {
          expect(plan.note_interpreted).toBe(false);
          expect(plan.acknowledgement).toContain(
            'Turn on AI mode to get suggestions based on your note.'
          );
          expect(plan.situation.what_is_in_your_control).toContain(
            'Turn on AI mode to get suggestions based on your note.'
          );
        }
      }
    });
  });

  describe('4. Code validation (validatePlan)', () => {
    const mood: Mood = 'Anxious';
    const note = 'Exams are next week and I am stressed';
    const themes = detectThemes(note);
    const pools = buildPools(mood, themes);

    const makeValidRawAi = () => ({
      understanding: {
        main_concern: 'Worried about upcoming exam readiness.',
        intensity: 'medium',
        need: 'focus',
      },
      relevant_themes: ['academics', 'invalid_made_up_theme', 'work'],
      acknowledgement: 'Feeling anxious before approaching exams makes complete sense when deadlines pile up.',
      why_this_order: 'Calming racing thoughts first helps you break down your study outline next.',
      situation: {
        summary: 'Upcoming exams are causing worry about study preparation.',
        what_is_in_your_control: 'You can pick one core topic today and organize your study notes.',
        action_steps: [
          { step: 'List 3 exam topics', detail: 'Write down the three highest-weight chapters first.', time: 'now' },
          { step: 'Review one summary sheet', detail: 'Read one core lecture outline for twenty minutes.', time: 'today' },
          { step: 'Ask TA one question', detail: 'Email a specific question to clarify weak concepts.', time: 'this_week' },
        ],
      },
      now: {
        activity_id: pools.now_pool[0].id,
        reason: 'Slowing your breathing reduces exam adrenaline rapidly.',
        instruction: 'Close your study tabs for sixty seconds and breathe steadily.',
      },
      next: [
        {
          activity_id: pools.next_pool[0].id,
          reason: 'Slicing study tasks down restores manageable exam momentum.',
        },
        {
          activity_id: pools.next_pool[1].id,
          reason: 'Parking swirling exam worries clears your working focus.',
        },
      ],
      next_step: 'Open one chapter outline and review the key definitions.',
    });

    it('honours valid AI picks across all parts and drops disallowed themes', () => {
      const outcome = validatePlan(makeValidRawAi(), { mood, note, detectedThemes: themes, pools });

      expect(outcome.plan.now.by).toBe('ai');
      expect(outcome.plan.next[0].by).toBe('ai');
      expect(outcome.plan.next[1].by).toBe('ai');
      expect(outcome.plan.later.by).toBe('ai');
      expect(outcome.plan.situation_by).toBe('ai');
      expect(outcome.plan.acknowledgement_by).toBe('ai');
      expect(outcome.relevant_themes).toEqual(['academics', 'work']);
    });

    it('replaces ONLY out-of-pool ID while preserving remaining AI plan', () => {
      const badNext0 = makeValidRawAi();
      badNext0.next[0].activity_id = 'non-existent-id';

      const outcome = validatePlan(badNext0, { mood, note, detectedThemes: themes, pools });
      expect(outcome.plan.now.by).toBe('ai');
      expect(outcome.plan.next[0].by).toBe('rules');
      expect(outcome.plan.next[1].by).toBe('ai');
      expect(pools.next_pool.some((a) => a.id === outcome.plan.next[0].activity.id)).toBe(true);
    });

    it('rejects non-quick activity placed in now and keeps rest AI', () => {
      const nonQuickNow = makeValidRawAi();
      nonQuickNow.now.activity_id = '25-minute-focus-sprint'; // not quick and not in now_pool

      const outcome = validatePlan(nonQuickNow, { mood, note, detectedThemes: themes, pools });
      expect(outcome.plan.now.by).toBe('rules');
      expect(isQuickActivity(outcome.plan.now.activity)).toBe(true);
      expect(outcome.plan.next[0].by).toBe('ai');
      expect(outcome.plan.later.by).toBe('ai');
    });

    it('fixes duplicate activity IDs without duplicating across now + next', () => {
      const duplicateNext = makeValidRawAi();
      duplicateNext.next[1].activity_id = duplicateNext.next[0].activity_id;

      const outcome = validatePlan(duplicateNext, { mood, note, detectedThemes: themes, pools });
      const ids = [
        outcome.plan.now.activity.id,
        outcome.plan.next[0].activity.id,
        outcome.plan.next[1].activity.id,
      ];
      expect(new Set(ids).size).toBe(3);
      expect(outcome.plan.next[0].by).toBe('ai');
      expect(outcome.plan.next[1].by).toBe('rules');
    });

    it('enforces same-type cap (max 2 of one type across now+next)', () => {
      // Find 3 journaling items or 3 items of same type across pools
      const sPools = buildPools('Stressed', ['teamwork', 'work']);
      const nowJournaling = sPools.now_pool.find((a) => a.type === 'journaling') || sPools.now_pool.find((a) => a.type === 'breathing');
      const sameTypeNext = sPools.next_pool.filter((a) => a.type === nowJournaling!.type);

      if (nowJournaling && sameTypeNext.length >= 2) {
        const overCap = makeValidRawAi();
        overCap.now.activity_id = nowJournaling.id;
        overCap.next[0].activity_id = sameTypeNext[0].id;
        overCap.next[1].activity_id = sameTypeNext[1].id;

        const outcome = validatePlan(overCap, { mood: 'Stressed', note, detectedThemes: ['teamwork'], pools: sPools });
        const types = [
          outcome.plan.now.activity.type,
          outcome.plan.next[0].activity.type,
          outcome.plan.next[1].activity.type,
        ];
        const countOfTarget = types.filter((t) => t === nowJournaling.type).length;
        expect(countOfTarget).toBeLessThanOrEqual(2);
        expect(outcome.plan.next[1].by).toBe('rules');
      }
    });

    it('forces gentlest quick activity in now_pool when intensity is high', () => {
      const highInt = makeValidRawAi();
      highInt.understanding.intensity = 'high';
      const gentlest = findGentlestQuickActivity(pools.now_pool, mood)!;
      const nonGentlest = pools.now_pool.find((a) => a.id !== gentlest.id)!;
      highInt.now.activity_id = nonGentlest.id;

      const outcome = validatePlan(highInt, { mood, note, detectedThemes: themes, pools });
      expect(outcome.plan.now.activity.id).toBe(gentlest.id);
      expect(outcome.plan.now.by).toBe('rules');
      // Action steps ensure gentle reaching-out step on high intensity
      const stepsCombined = JSON.stringify(outcome.plan.later.action_steps).toLowerCase();
      expect(stepsCombined).toMatch(/reach out|trusted|friend|family|mentor|ta|talk/);
    });

    it('drops ONLY the part containing crisis, medical advice, or legal terms while keeping safe AI parts', () => {
      const unsafeLater = makeValidRawAi();
      unsafeLater.situation.action_steps[0] = {
        step: 'Hire a lawyer',
        detail: 'Take prescribed medication and file a lawsuit immediately.',
        time: 'now',
      };

      const outcome = validatePlan(unsafeLater, { mood, note, detectedThemes: themes, pools });
      expect(outcome.plan.now.by).toBe('ai');
      expect(outcome.plan.next[0].by).toBe('ai');
      expect(outcome.plan.acknowledgement_by).toBe('ai');
      // Only later was dropped to rules templates
      expect(outcome.plan.later.by).toBe('rules');
      expect(JSON.stringify(outcome.plan.later.action_steps).toLowerCase()).not.toContain('lawyer');
      expect(JSON.stringify(outcome.plan.later.action_steps).toLowerCase()).not.toContain('medication');
    });

    it('wrong action_steps count drops later to templates while keeping AI now and next', () => {
      const badStepsCount = makeValidRawAi();
      badStepsCount.situation.action_steps = badStepsCount.situation.action_steps.slice(0, 2);

      const outcome = validatePlan(badStepsCount, { mood, note, detectedThemes: themes, pools });
      expect(outcome.plan.later.by).toBe('rules');
      expect(outcome.plan.later.action_steps).toHaveLength(3);
      expect(outcome.plan.now.by).toBe('ai');
      expect(outcome.plan.next[0].by).toBe('ai');
    });
  });

  describe('5. Feedback loop effect on now_pool', () => {
    it('a "yes" raises and a "no" lowers a quick activity in now_pool for that mood', () => {
      const mood: Mood = 'Stressed';
      const basePools = buildPools(mood, []);
      const targetAct = basePools.now_pool[1]; // tied at mood_fit=3 (score 9)

      const withYes = buildPools(mood, [], undefined, { [targetAct.id]: 'yes' });
      const withNo = buildPools(mood, [], undefined, { [targetAct.id]: 'no' });

      const yesIdx = withYes.now_pool.findIndex((a) => a.id === targetAct.id);
      const noIdx = withNo.now_pool.findIndex((a) => a.id === targetAct.id);

      expect(yesIdx).toBe(0); // Raised to top above tied peers
      if (noIdx === -1) {
        expect(noIdx).toBe(-1);
      } else {
        expect(noIdx).toBeGreaterThan(1); // Lowered behind tied peers
        expect(yesIdx).toBeLessThan(noIdx);
      }
    });
  });
});
