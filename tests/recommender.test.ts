import { describe, it, expect } from 'vitest';
import {
  rankActivities,
  scoreCandidates,
  isCompletedInLast24Hours,
} from '../src/lib/recommender/rules';
import { getAllActivities } from '../src/lib/catalog';
import { MOODS, Mood, Rating } from '../src/types';

describe('Rules-Based Recommender - rankActivities', () => {
  const allActivities = getAllActivities();

  it('returns exactly 3 recommendations for every mood', () => {
    for (const mood of MOODS) {
      const recs = rankActivities(mood);
      expect(recs).toHaveLength(3);

      for (const rec of recs) {
        expect(rec.activity).toBeDefined();
        expect(rec.activity.id).toBeDefined();
        expect(rec.activity.title).toBeDefined();
        expect(typeof rec.reason).toBe('string');
        expect(rec.reason.length).toBeGreaterThan(10);
        expect(rec.personalised_by).toBe('rules');
      }
    }
  });

  it('mood-matching activities rank higher than non-matching ones', () => {
    const mood: Mood = 'Sad';
    const scored = scoreCandidates(mood);

    // Filter into matching and non-matching
    const matching = scored.filter((s) => s.isMoodMatch);
    const nonMatching = scored.filter((s) => !s.isMoodMatch);

    expect(matching.length).toBeGreaterThan(0);
    expect(nonMatching.length).toBeGreaterThan(0);

    // Every matching activity without negative feedback should score higher than non-matching
    const minMatchingScore = Math.min(...matching.map((m) => m.score));
    const maxNonMatchingScore = Math.max(...nonMatching.map((nm) => nm.score));

    expect(minMatchingScore).toBeGreaterThan(maxNonMatchingScore);

    // Top 3 for Sad should all target Sad
    const top3 = rankActivities(mood);
    for (const rec of top3) {
      expect(rec.activity.target_moods).toContain(mood);
    }
  });

  it('a "no" demotes and a "yes" promotes an activity', () => {
    const mood: Mood = 'Anxious';
    const baselineScored = scoreCandidates(mood, {});
    const targetActivity = baselineScored[1].activity; // pick the second ranked activity

    // 1. Promote with 'yes' (+2)
    const promotedScored = scoreCandidates(mood, { [targetActivity.id]: 'yes' });
    const targetPromoted = promotedScored.find((s) => s.activity.id === targetActivity.id);
    expect(targetPromoted?.score).toBe(baselineScored[1].score + 2);

    // 2. Demote with 'no' (-2)
    const demotedScored = scoreCandidates(mood, { [targetActivity.id]: 'no' });
    const targetDemoted = demotedScored.find((s) => s.activity.id === targetActivity.id);
    expect(targetDemoted?.score).toBe(baselineScored[1].score - 2);

    // Position of targetActivity in demoted list should be worse (higher index)
    const promotedIndex = promotedScored.findIndex((s) => s.activity.id === targetActivity.id);
    const demotedIndex = demotedScored.findIndex((s) => s.activity.id === targetActivity.id);
    expect(promotedIndex).toBeLessThan(demotedIndex);
  });

  it('changing an activity feedback changes its rank on an equivalent subsequent check-in', () => {
    const mood: Mood = 'Overwhelmed';

    // Activity that is initially in top 3
    const initialRecs = rankActivities(mood, {});
    const topActivityId = initialRecs[0].activity.id;

    // Checkin 1: User gives 'no' to this top activity
    const feedbackCheckin1 = { [topActivityId]: 'no' as Rating };
    const recsAfterNo = rankActivities(mood, feedbackCheckin1);
    const scoredAfterNo = scoreCandidates(mood, feedbackCheckin1);
    const rankAfterNo = scoredAfterNo.findIndex((s) => s.activity.id === topActivityId);

    // The activity with 'no' should be demoted and not be #1 anymore
    expect(recsAfterNo[0].activity.id).not.toBe(topActivityId);

    // Checkin 2: Later, user tries it again or updates feedback to 'yes'
    const feedbackCheckin2 = { [topActivityId]: 'yes' as Rating };
    const recsAfterYes = rankActivities(mood, feedbackCheckin2);
    const scoredAfterYes = scoreCandidates(mood, feedbackCheckin2);
    const rankAfterYes = scoredAfterYes.findIndex((s) => s.activity.id === topActivityId);

    // With 'yes', it should rank higher than when it had 'no'
    expect(rankAfterYes).toBeLessThan(rankAfterNo);
    expect(recsAfterYes.some((r) => r.activity.id === topActivityId)).toBe(true);
  });

  it('tie-breaking is deterministic by activity id', () => {
    const mood: Mood = 'Stressed';

    // Calling multiple times with identical inputs produces the identical result
    const run1 = rankActivities(mood);
    const run2 = rankActivities(mood);
    const run3 = rankActivities(mood);

    expect(run1.map((r) => r.activity.id)).toEqual(run2.map((r) => r.activity.id));
    expect(run2.map((r) => r.activity.id)).toEqual(run3.map((r) => r.activity.id));

    // Specifically test that among equal scores, activity id alphabetical order wins
    const scored = scoreCandidates(mood, {});
    for (let i = 0; i < scored.length - 1; i++) {
      if (scored[i].score === scored[i + 1].score) {
        expect(scored[i].activity.id.localeCompare(scored[i + 1].activity.id)).toBeLessThan(0);
      }
    }
  });

  it('recent completion penalty works for activities completed in the last 24h', () => {
    const mood: Mood = 'Anxious';
    const now = new Date('2026-11-24T12:00:00Z');

    // Find two mood-matching activities with the same mood_fit where actA comes before actB alphabetically
    const matching = allActivities
      .filter((a) => (a.mood_fit?.[mood] ?? 0) === 3)
      .sort((a, b) => a.id.localeCompare(b.id));

    const actA = matching[0];
    const actB = matching[1];

    // Baseline with no recent sessions: actA ranks ahead of actB due to tie-break by ID
    const baseline = scoreCandidates(mood, {}, [], { now });
    const baselineRankA = baseline.findIndex((s) => s.activity.id === actA.id);
    const baselineRankB = baseline.findIndex((s) => s.activity.id === actB.id);
    expect(baselineRankA).toBeLessThan(baselineRankB);

    // Now record that actA was completed 2 hours ago (within 24h)
    const recentSessions = [
      {
        activity_id: actA.id,
        completed: true,
        completed_at: new Date('2026-11-24T10:00:00Z').toISOString(),
      },
    ];

    const withPenalty = scoreCandidates(mood, {}, recentSessions, { now });
    const scoredA = withPenalty.find((s) => s.activity.id === actA.id)!;
    const scoredB = withPenalty.find((s) => s.activity.id === actB.id)!;

    // actA received -1.5 penalty
    expect(scoredA.score).toBe(scoredB.score - 1.5);
    expect(scoredA.isRecentlyCompleted).toBe(true);
    expect(scoredB.isRecentlyCompleted).toBe(false);

    // In rank, actB should now be ahead of actA
    const penaltyRankA = withPenalty.findIndex((s) => s.activity.id === actA.id);
    const penaltyRankB = withPenalty.findIndex((s) => s.activity.id === actB.id);
    expect(penaltyRankB).toBeLessThan(penaltyRankA);
  });

  it('does not penalize sessions completed more than 24h ago or incomplete sessions', () => {
    const now = new Date('2026-11-24T12:00:00Z');

    // Completed 25 hours ago
    const oldSession = [
      {
        activity_id: 'box-breathing',
        completed: true,
        completed_at: new Date('2026-11-23T10:00:00Z').toISOString(),
      },
    ];
    expect(isCompletedInLast24Hours('box-breathing', oldSession, now)).toBe(false);

    // Incomplete session started recently
    const incompleteSession = [
      {
        activity_id: 'box-breathing',
        completed: false,
        started_at: new Date('2026-11-24T11:30:00Z').toISOString(),
      },
    ];
    expect(isCompletedInLast24Hours('box-breathing', incompleteSession, now)).toBe(false);
  });

  it('accepts Map, Record, and LatestActivityFeedback[] as feedback input', () => {
    const mood: Mood = 'Stressed';

    // 1. Record
    const recRecord = rankActivities(mood, { 'box-breathing': 'yes' });
    expect(recRecord[0].activity.id).toBe('box-breathing');

    // 2. Map
    const map = new Map<string, Rating>();
    map.set('box-breathing', 'yes');
    const recMap = rankActivities(mood, map);
    expect(recMap[0].activity.id).toBe('box-breathing');

    // 3. Array of LatestActivityFeedback
    const array = [
      {
        activity_id: 'box-breathing',
        rating: 'yes' as Rating,
        created_at: new Date().toISOString(),
        session_id: 'sess-1',
      },
    ];
    const recArray = rankActivities(mood, array);
    expect(recArray[0].activity.id).toBe('box-breathing');
  });
});
