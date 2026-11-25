import {
  Mood,
  Recommendation,
  RecommendationResult,
  WellbeingPlan,
} from '@/types';
import { scoreCandidates } from './rules';
import { FeedbackSummaryItem, getAiPlan } from './ai';
import {
  getActivityCompletionCounts,
  getLatestFeedbackPerActivity,
  getRecentSessions,
} from '../db';
import { checkSafety } from '../safety';
import { detectThemes } from './themes';
import { buildPools, buildRulesPlan, PoolConstraints } from './plan';
import { getFallbackSuggestions } from './fallbackSuggestions';

export * from './rules';
export * from './ai';
export * from './themes';
export * from './fallbackTemplates';
export * from './plan';

function createPlanRecommendationResult(
  mood: Mood,
  plan: WellbeingPlan,
  constraints_relaxed: boolean,
  has_note: boolean
): RecommendationResult & Recommendation[] {
  const recommendations: Recommendation[] = [
    {
      activity: plan.now.activity,
      reason: plan.now.reason,
      personalised_by: plan.now.by,
    },
    ...plan.next.map((item) => ({
      activity: item.activity,
      reason: item.reason,
      personalised_by: item.by,
    })),
  ];

  return Object.assign([...recommendations], {
    plan,
    constraints_relaxed,
    acknowledgement: plan.acknowledgement,
    recommendations,
    next_step: plan.later.next_step,
    need: plan.understanding?.need,
    understanding: plan.understanding,
    situation: plan.situation,
    situation_by: plan.situation_by || plan.later.by,
    relevant_themes: plan.relevant_themes || [],
    has_note,
    suggestions: getFallbackSuggestions(mood, plan.relevant_themes || []),
    suggestions_by: 'rules' as const,
  }) as RecommendationResult & Recommendation[];
}

/**
 * Main recommendation entry point.
 * Builds constrained now/next pools, optionally invokes Gemini to decide the ordered plan,
 * validates every AI choice and safety rule, and falls back deterministically via buildRulesPlan.
 */
export async function recommend(
  mood: Mood,
  note?: string | null,
  userId: string = 'demo-user',
  constraints?: PoolConstraints,
  diagnosticHook?: (info: string) => void
): Promise<RecommendationResult & Recommendation[]> {
  const hasNote = Boolean(note && note.trim().length > 0);
  const latestFeedback = getLatestFeedbackPerActivity(userId, mood);
  const recentSessions = getRecentSessions(userId, 20);
  const completionCounts = getActivityCompletionCounts(userId);
  const detectedThemes = detectThemes(note);

  const scored = scoreCandidates(mood, latestFeedback, recentSessions, {
    detectedThemes,
    note,
  });

  const pools = buildPools(mood, detectedThemes, scored, latestFeedback, constraints);

  // 1. Safety check guard: NEVER call Gemini if safety trigger is present
  if (note && checkSafety(note).triggered) {
    const rulesPlan = buildRulesPlan(mood, detectedThemes, note, pools);
    return createPlanRecommendationResult(mood, rulesPlan, pools.constraints_relaxed, hasNote);
  }

  // 2. Rules-only conditions: DEMO_MODE or missing API key
  const isDemoMode = process.env.DEMO_MODE === 'true';
  const apiKey = process.env.GEMINI_API_KEY;
  if (isDemoMode || !apiKey || apiKey.trim() === '') {
    const rulesPlan = buildRulesPlan(mood, detectedThemes, note, pools);
    return createPlanRecommendationResult(mood, rulesPlan, pools.constraints_relaxed, hasNote);
  }

  // 3. Build anonymised feedback summary (rating under this mood + completion count, never user_id)
  const feedbackSummary: Record<string, FeedbackSummaryItem> = {};
  const feedbackMap = new Map(latestFeedback.map((f) => [f.activity_id, f]));
  const allPoolIds = new Set([
    ...pools.now_pool.map((a) => a.id),
    ...pools.next_pool.map((a) => a.id),
  ]);
  for (const id of allPoolIds) {
    const fb = feedbackMap.get(id);
    const timesDone = completionCounts[id] || 0;
    if (fb || timesDone > 0) {
      feedbackSummary[id] = {
        rating:
          fb?.rating === 'yes'
            ? 'liked'
            : fb?.rating === 'a_little'
            ? 'neutral'
            : fb?.rating === 'no'
            ? 'disliked'
            : 'neutral',
        times_done: timesDone,
      };
    }
  }

  // 4. Call Gemini once to decide the ordered plan, then validate with validatePlan
  const aiOutcome = await getAiPlan({
    mood,
    note,
    detectedThemes,
    pools,
    feedbackSummary,
    timeoutMs: 8000,
    diagnosticHook,
  });

  if (aiOutcome) {
    return createPlanRecommendationResult(
      mood,
      aiOutcome.plan,
      pools.constraints_relaxed,
      hasNote
    );
  }

  // 5. Complete fallback to deterministic rules plan
  const fallbackPlan = buildRulesPlan(mood, detectedThemes, note, pools);
  return createPlanRecommendationResult(mood, fallbackPlan, pools.constraints_relaxed, hasNote);
}
