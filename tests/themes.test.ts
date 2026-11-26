import { describe, it, expect } from 'vitest';
import { detectThemes } from '../src/lib/recommender/themes';
import { rankActivities, scoreCandidates } from '../src/lib/recommender/rules';
import { getAllActivities } from '../src/lib/catalog';
import { THEMES, Mood, MOODS } from '../src/types';

describe('Situation Theme Detection (detectThemes)', () => {
  it('returns empty array for empty, whitespace, null, or undefined notes', () => {
    expect(detectThemes('')).toEqual([]);
    expect(detectThemes('   ')).toEqual([]);
    expect(detectThemes(null)).toEqual([]);
    expect(detectThemes(undefined)).toEqual([]);
  });

  it('detects academics theme across all required keywords and phrases', () => {
    const testCases = [
      { text: 'I have a huge exam tomorrow morning', expected: 'academics' },
      { text: 'Worried about my semester marks', expected: 'academics' },
      { text: 'My grades have been dropping', expected: 'academics' },
      { text: 'Stuck on this final assignment', expected: 'academics' },
      { text: 'I need to study but cannot focus', expected: 'academics' },
      { text: 'The upcoming project deadline is crushing me', expected: 'academics' },
      { text: 'The pressure of performing well is terrifying', expected: 'academics' },
      { text: 'I am so scared of failing this semester', expected: 'academics' },
    ];

    for (const { text, expected } of testCases) {
      const themes = detectThemes(text);
      expect(themes).toContain(expected);
    }
  });

  it('enforces whole-word matching and ignores partial word matches', () => {
    // "example" should NOT trigger "exam"
    expect(detectThemes('This is a great example of good code')).toEqual([]);

    // "studious" should NOT trigger "study"
    expect(detectThemes('My roommate is very studious')).toEqual([]);

    // "gradebook" should NOT trigger "grade"
    expect(detectThemes('The gradebook was closed for the weekend')).toEqual([]);
  });

  it('detects other situational themes accurately', () => {
    expect(detectThemes('My boss called a surprise meeting at work')).toContain('work');
    expect(detectThemes('I have severe insomnia and cannot sleep')).toContain('sleep');
    expect(detectThemes('Had an intense argument with my partner')).toContain('relationships');
    expect(detectThemes('I feel so lonely and completely isolated')).toContain('loneliness');
    expect(detectThemes('Worried about my medical symptoms after visiting the doctor')).toContain('health_worry');
    expect(detectThemes('Struggling to pay my rent and monthly bills')).toContain('money');
  });

  it('returns empty array for unrelated notes', () => {
    expect(detectThemes('Just drinking a warm cup of peppermint tea')).toEqual([]);
    expect(detectThemes('Watching the clouds pass by the window on Tuesday')).toEqual([]);
    expect(detectThemes('Listening to ambient rain sounds')).toEqual([]);
  });

  it('detects multiple themes in a note and maintains deterministic THEMES order', () => {
    const note = 'Stressed about my exam deadline and I cannot sleep at night';
    const themes = detectThemes(note);

    expect(themes).toContain('academics');
    expect(themes).toContain('sleep');

    // Order matches THEMES constant order
    const expectedOrder = THEMES.filter((t) => themes.includes(t));
    expect(themes).toEqual(expectedOrder);
  });
});

describe('Theme-Aware Recommender (Prompt 13 Updated to New Weighted Scoring)', () => {
  it('returns at least one academic activity in the top 3 for an academics note with Anxious', () => {
    const mood: Mood = 'Anxious';
    const academicNote = 'Terrified about my final exam deadline tomorrow';

    const recs = rankActivities(mood, {}, [], { note: academicNote });
    expect(recs).toHaveLength(3);

    // At least one activity has 'academics' in target_themes
    const academicRecs = recs.filter((r) => r.activity.target_themes?.includes('academics'));
    expect(academicRecs.length).toBeGreaterThanOrEqual(1);

    // Verify small-step, focus-sprint, or name-worry-park-it activities surface
    const hasTargetAcademic = recs.some(
      (r) =>
        r.activity.id === 'break-it-into-one-small-step' ||
        r.activity.id === '25-minute-focus-sprint' ||
        r.activity.id === 'name-worry-park-it' ||
        r.activity.id === 'box-breathing'
    );
    expect(hasTargetAcademic).toBe(true);

    // Verify reason mentions the situation (templated per theme)
    const matchingThemeRec = academicRecs[0];
    expect(matchingThemeRec.reason).toContain('Since academics feel heavy right now');
  });

  it('empty note behaves exactly as before without themes', () => {
    const mood: Mood = 'Anxious';

    const baselineRecs = rankActivities(mood);
    const emptyNoteRecs = rankActivities(mood, null, null, { note: '' });
    const whitespaceRecs = rankActivities(mood, null, null, { note: '   ' });
    const nullNoteRecs = rankActivities(mood, null, null, { note: null });

    expect(emptyNoteRecs.map((r) => r.activity.id)).toEqual(baselineRecs.map((r) => r.activity.id));
    expect(emptyNoteRecs.map((r) => r.reason)).toEqual(baselineRecs.map((r) => r.reason));

    expect(whitespaceRecs.map((r) => r.activity.id)).toEqual(baselineRecs.map((r) => r.activity.id));
    expect(nullNoteRecs.map((r) => r.activity.id)).toEqual(baselineRecs.map((r) => r.activity.id));
  });

  it('unrelated note produces no theme and ranks identically to no note', () => {
    const mood: Mood = 'Stressed';
    const unrelatedNote = 'The leaves are falling gently outside the garden';

    const baselineRecs = rankActivities(mood);
    const unrelatedRecs = rankActivities(mood, null, null, { note: unrelatedNote });

    expect(unrelatedRecs.map((r) => r.activity.id)).toEqual(baselineRecs.map((r) => r.activity.id));
    expect(unrelatedRecs.map((r) => r.reason)).toEqual(baselineRecs.map((r) => r.reason));
  });

  it('ranking stays strictly deterministic across repeated calls with identical note', () => {
    const mood: Mood = 'Overwhelmed';
    const note = 'So many assignments and tests coming up';

    const run1 = rankActivities(mood, null, null, { note });
    const run2 = rankActivities(mood, null, null, { note });
    const run3 = rankActivities(mood, null, null, { note });

    expect(run1.map((r) => r.activity.id)).toEqual(run2.map((r) => r.activity.id));
    expect(run2.map((r) => r.activity.id)).toEqual(run3.map((r) => r.activity.id));

    expect(run1.map((r) => r.reason)).toEqual(run2.map((r) => r.reason));
  });

  it('tiny theme tie-breaker (+0.25 for fit >= 1) breaks equal-score ties without overriding mood_fit or feedback', () => {
    const mood: Mood = 'Anxious';

    // name-worry-park-it has fit 3 for Anxious (9) + tiny academics tie-breaker (+0.25) = 9.25
    // 4-7-8-breathing has fit 3 for Anxious (9) + yes feedback (+2) = 11 (user feedback strictly wins)
    const feedback = { '4-7-8-breathing': 'yes' as const };
    const scored = scoreCandidates(mood, feedback, [], ['academics']);

    const academicWorry = scored.find((s) => s.activity.id === 'name-worry-park-it')!;
    const breathingWithFeedback = scored.find((s) => s.activity.id === '4-7-8-breathing')!;
    const grounding = scored.find((s) => s.activity.id === '5-4-3-2-1-grounding')!;

    expect(academicWorry.score).toBe(9.25); // 9 + 0.25
    expect(breathingWithFeedback.score).toBe(11); // 9 + 2
    expect(breathingWithFeedback.score).toBeGreaterThan(academicWorry.score);
    expect(grounding.score).toBe(9);
    expect(academicWorry.score).toBeGreaterThan(grounding.score);
  });
});

describe('Mood Distinctness, Dominance & Diversity (Prompt 14 Requirements)', () => {
  it('for each of the 5 moods, top-3 sets differ from every other mood in at least 2 of 3 activities (empty note, no feedback)', () => {
    const topThreeMap = new Map<Mood, string[]>();

    for (const mood of MOODS) {
      const recs = rankActivities(mood);
      expect(recs).toHaveLength(3);
      topThreeMap.set(
        mood,
        recs.map((r) => r.activity.id)
      );
    }

    // Compare all pairs of moods
    for (let i = 0; i < MOODS.length; i++) {
      for (let j = i + 1; j < MOODS.length; j++) {
        const moodA = MOODS[i];
        const moodB = MOODS[j];
        const listA = topThreeMap.get(moodA)!;
        const listB = topThreeMap.get(moodB)!;

        // Overlap should be at most 1 (differing in at least 2 of 3)
        const overlap = listA.filter((id) => listB.includes(id));
        expect(
          overlap.length,
          `Moods ${moodA} and ${moodB} share ${overlap.length} activities (${overlap.join(
            ', '
          )}), but must differ in at least 2 of 3.`
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it('Okay and Sad share at most 1 activity in top 3', () => {
    const okayRecs = rankActivities('Okay').map((r) => r.activity.id);
    const sadRecs = rankActivities('Sad').map((r) => r.activity.id);

    const overlap = okayRecs.filter((id) => sadRecs.includes(id));
    expect(overlap.length).toBeLessThanOrEqual(1);
  });

  it('feedback cannot promote an activity with fit 0 into the top 3', () => {
    const allActivities = getAllActivities();

    for (const mood of MOODS) {
      // Find an activity that has fit 0 (omitted from mood_fit) for this mood
      const fitZeroActivities = allActivities.filter((a) => (a.mood_fit?.[mood] ?? 0) === 0);
      expect(fitZeroActivities.length).toBeGreaterThan(0);

      // Give the fit-0 activity maximum positive feedback ('yes' = +2)
      // And give all fit-3 activities maximum negative feedback ('no' = -2)
      const targetFitZero = fitZeroActivities[0];
      const feedback: Record<string, 'yes' | 'no'> = {
        [targetFitZero.id]: 'yes',
      };

      for (const act of allActivities) {
        if ((act.mood_fit?.[mood] ?? 0) === 3) {
          feedback[act.id] = 'no';
        }
      }

      const recs = rankActivities(mood, feedback);
      const topIds = recs.map((r) => r.activity.id);

      // The fit-0 activity must NOT be in top 3
      expect(topIds).not.toContain(targetFitZero.id);
    }
  });

  it('same-type cap holds: top 3 includes at most 2 activities of the same type across all moods', () => {
    for (const mood of MOODS) {
      const recs = rankActivities(mood);
      const typeCounts: Record<string, number> = {};

      for (const r of recs) {
        typeCounts[r.activity.type] = (typeCounts[r.activity.type] || 0) + 1;
      }

      for (const [type, count] of Object.entries(typeCounts)) {
        expect(
          count,
          `Mood ${mood} returned ${count} activities of type '${type}', exceeding the maximum of 2.`
        ).toBeLessThanOrEqual(2);
      }
    }
  });

  it('Okay must never return only breathing/grounding activities', () => {
    const recs = rankActivities('Okay');
    const types = recs.map((r) => r.activity.type);

    const allBreathingOrGrounding = types.every(
      (t) => t === 'breathing' || t === 'grounding'
    );
    expect(
      allBreathingOrGrounding,
      `Top 3 for Okay must include at least one journaling or break activity, but got: [${types.join(
        ', '
      )}]`
    ).toBe(false);
  });

  it('ranking is strictly deterministic across all moods', () => {
    for (const mood of MOODS) {
      const run1 = rankActivities(mood).map((r) => r.activity.id);
      const run2 = rankActivities(mood).map((r) => r.activity.id);
      const run3 = rankActivities(mood).map((r) => r.activity.id);

      expect(run1).toEqual(run2);
      expect(run2).toEqual(run3);
    }
  });

  it('mood-aware feedback counts different-mood feedback at half weight', () => {
    const mood: Mood = 'Anxious';
    const allActivities = getAllActivities();

    // Pick an activity with fit 3 for Anxious (e.g. 5-4-3-2-1-grounding)
    const act = allActivities.find((a) => (a.mood_fit[mood] ?? 0) === 3)!;

    // Feedback under same mood ('Anxious') -> weight 1.0 (preference = +2)
    const sameMoodFeedback = [
      {
        activity_id: act.id,
        rating: 'yes' as const,
        mood: 'Anxious' as const,
        weight: 1.0,
        created_at: new Date().toISOString(),
        session_id: 's1',
      },
    ];
    const scoredSame = scoreCandidates(mood, sameMoodFeedback);
    const itemSame = scoredSame.find((s) => s.activity.id === act.id)!;

    // Feedback under different mood ('Stressed') -> weight 0.5 (preference = +1)
    const diffMoodFeedback = [
      {
        activity_id: act.id,
        rating: 'yes' as const,
        mood: 'Stressed' as const,
        weight: 0.5,
        created_at: new Date().toISOString(),
        session_id: 's2',
      },
    ];
    const scoredDiff = scoreCandidates(mood, diffMoodFeedback);
    const itemDiff = scoredDiff.find((s) => s.activity.id === act.id)!;

    // Same mood feedback preference is +2 (score = 9 + 2 = 11)
    // Different mood feedback preference is +1 (score = 9 + 1 = 10)
    expect(itemSame.score).toBe(11);
    expect(itemDiff.score).toBe(10);
    expect(itemSame.score).toBeGreaterThan(itemDiff.score);
  });
});
