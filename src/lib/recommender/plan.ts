import { z } from 'zod';
import {
  Activity,
  ActivityType,
  LatestActivityFeedback,
  Mood,
  NEEDS,
  PlanLater,
  PlanNextItem,
  PlanNowItem,
  Rating,
  Situation,
  SituationActionStep,
  Theme,
  THEMES,
  Understanding,
  WellbeingPlan,
} from '@/types';
import { getAllActivities } from '../catalog';
import { checkSafety } from '../safety';
import {
  extractFeedbackPreference,
  extractRating,
  generateTemplatedReason,
  scoreCandidates,
  ScoredActivity,
} from './rules';
import { getFallbackGuidance, selectPrimaryTheme } from './fallbackTemplates';

export type MoodGoal = 'calm' | 'lift';

export interface PoolConstraints {
  maxMinutes?: number | null;
  excludeTypes?: ActivityType[];
  includeTypes?: ActivityType[];
  excludeActivityIds?: string[];
}

export interface PoolsResult {
  now_pool: Activity[];
  next_pool: Activity[];
  constraints_relaxed: boolean;
  scoredMap: Map<string, ScoredActivity>;
}

export const countWords = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

export const ALLOWED_THEMES_SET = new Set<string>(THEMES);

/**
 * Shared safety and non-clinical / non-legal / non-financial advice regex.
 * Carefully avoids false-positives on benign emotional phrasing (e.g. "waiting for medical test results").
 */
export const PLAN_UNSAFE_ADVICE_TERMS =
  /\b(lawyer|attorney|lawsuit|legal\s+(?:advice|action|counsel)|sue|court|litigat(?:e|ion)|breach\s+of\s+contract|medication|medicine|prescribe|prescription|pills|supplements?|diet|diets|diagnos(?:e|is|ed)|medical\s+(?:advice|treatment|diagnosis)|clinical|psychiatric|therapist|psychiatrist|therapy|retaliat(?:e|ion)|revenge|financial\s+(?:advice|advisor)|guaranteed\s+cure)\b/i;

export function isTextSafeForPlan(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  if (checkSafety(text).triggered) return false;
  if (PLAN_UNSAFE_ADVICE_TERMS.test(text)) return false;
  return true;
}

/**
 * Mood goals determine what kind of quick relief fits the "Right now" stage:
 * - Anxious, Stressed, Overwhelmed -> 'calm'
 * - Sad -> 'lift' (gentle)
 * - Okay -> 'lift' (lift or maintain via 'lift' / 'both')
 */
export function getMoodGoal(mood: Mood): MoodGoal {
  if (mood === 'Sad' || mood === 'Okay') {
    return 'lift';
  }
  return 'calm';
}

export function isQuickActivity(activity: Activity): boolean {
  return activity.quick === true || activity.duration_minutes <= 2;
}

export function matchesMoodGoal(activity: Activity, mood: Mood): boolean {
  const relief = activity.relief || 'calm';
  if (relief === 'both') return true;
  const goal = getMoodGoal(mood);
  return relief === goal;
}

export function isGeneralPurpose(activity: Activity): boolean {
  if (!activity.target_themes || activity.target_themes.length === 0) {
    return true;
  }
  return activity.target_themes.includes('general');
}

function normalizeScoredCandidates(
  mood: Mood,
  themes: Theme[] = [],
  ranked?: ScoredActivity[] | Activity[] | null,
  feedbackMap?:
    | Map<string, Rating>
    | Record<string, Rating>
    | LatestActivityFeedback[]
    | null
): ScoredActivity[] {
  const effectiveThemes = themes.filter((t) => ALLOWED_THEMES_SET.has(t));

  // If no pre-ranked array passed, or raw Activity[] passed, compute fresh via scoreCandidates
  if (!ranked || !Array.isArray(ranked) || ranked.length === 0) {
    return scoreCandidates(mood, feedbackMap, undefined, {
      detectedThemes: effectiveThemes,
    });
  }

  const firstItem = ranked[0] as ScoredActivity | Activity;
  if (!('score' in firstItem) || typeof firstItem.score !== 'number') {
    return scoreCandidates(mood, feedbackMap, undefined, {
      allActivities: ranked as Activity[],
      detectedThemes: effectiveThemes,
    });
  }

  // Normalize ScoredActivity[] so explicit feedbackMap and themes args always apply cleanly without double-counting
  const hasExplicitFeedback = Boolean(
    feedbackMap &&
      (feedbackMap instanceof Map
        ? feedbackMap.size > 0
        : Array.isArray(feedbackMap)
        ? feedbackMap.length > 0
        : Object.keys(feedbackMap).length > 0)
  );

  const adjusted = (ranked as ScoredActivity[]).map((item) => {
    let score = item.score;
    let rating = item.rating;
    let matchedTheme = item.matchedTheme;
    const fit = item.activity.mood_fit?.[mood] ?? 0;

    if (hasExplicitFeedback && feedbackMap) {
      const existingPref = item.rating
        ? item.rating === 'yes'
          ? 2
          : item.rating === 'a_little'
          ? 1
          : -2
        : 0;
      const { preference: newPref, rating: newRating } = extractFeedbackPreference(
        feedbackMap,
        item.activity.id
      );
      if (newRating !== item.rating || newPref !== existingPref) {
        score += newPref - existingPref;
        rating = newRating ?? extractRating(feedbackMap, item.activity.id);
      }
    }

    if (effectiveThemes.length > 0 && fit >= 1) {
      const targetThemes = item.activity.target_themes || [];
      const firstMatch = effectiveThemes.find((t) => targetThemes.includes(t));
      if (!item.matchedTheme && firstMatch) {
        score += 5;
        matchedTheme = firstMatch;
      }
    }

    return {
      ...item,
      score,
      rating,
      matchedTheme,
    };
  });

  adjusted.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.activity.id.localeCompare(b.activity.id);
  });

  return adjusted;
}

function passesConstraints(
  activity: Activity,
  constraints: PoolConstraints
): boolean {
  if (
    constraints.excludeActivityIds &&
    constraints.excludeActivityIds.includes(activity.id)
  ) {
    return false;
  }
  if (
    typeof constraints.maxMinutes === 'number' &&
    activity.duration_minutes > constraints.maxMinutes
  ) {
    return false;
  }
  if (
    constraints.excludeTypes &&
    constraints.excludeTypes.includes(activity.type)
  ) {
    return false;
  }
  if (
    constraints.includeTypes &&
    constraints.includeTypes.length > 0 &&
    !constraints.includeTypes.includes(activity.type)
  ) {
    return false;
  }
  return true;
}

function filterWithRelaxation(
  candidates: ScoredActivity[],
  constraints: PoolConstraints | undefined,
  minCount: number
): { filtered: ScoredActivity[]; relaxed: boolean } {
  if (!constraints) {
    return { filtered: candidates, relaxed: false };
  }

  const hasActiveConstraints = Boolean(
    typeof constraints.maxMinutes === 'number' ||
      (constraints.excludeTypes && constraints.excludeTypes.length > 0) ||
      (constraints.includeTypes && constraints.includeTypes.length > 0) ||
      (constraints.excludeActivityIds && constraints.excludeActivityIds.length > 0)
  );

  if (!hasActiveConstraints) {
    return { filtered: candidates, relaxed: false };
  }

  let filtered = candidates.filter((s) => passesConstraints(s.activity, constraints));
  if (filtered.length >= minCount) {
    return { filtered, relaxed: false };
  }

  // Step 1: relax excludeActivityIds (swap)
  const step1: PoolConstraints = { ...constraints, excludeActivityIds: undefined };
  filtered = candidates.filter((s) => passesConstraints(s.activity, step1));
  if (filtered.length >= minCount) {
    return { filtered, relaxed: true };
  }

  // Step 2: also relax maxMinutes
  const step2: PoolConstraints = { ...step1, maxMinutes: undefined };
  filtered = candidates.filter((s) => passesConstraints(s.activity, step2));
  if (filtered.length >= minCount) {
    return { filtered, relaxed: true };
  }

  // Step 3: relax type constraints
  return { filtered: candidates, relaxed: true };
}

/**
 * Pure pool builder for Mindora's ordered plan:
 * - now_pool: up to 5 quick activities (duration <= 2), mood_fit >= 1, relief matching mood goal
 * - next_pool: up to 8 other activities, mood_fit >= 1, excluding now_pool, >= 3 general-purpose activities
 * - empty or "general" themes never shrink or skip pools
 * - applies chat constraints before AI sees pools; sets constraints_relaxed if relaxed
 */
export function buildPools(
  mood: Mood,
  themes: Theme[] = [],
  ranked?: ScoredActivity[] | Activity[] | null,
  feedbackMap?:
    | Map<string, Rating>
    | Record<string, Rating>
    | LatestActivityFeedback[]
    | null,
  constraints?: PoolConstraints
): PoolsResult {
  const scored = normalizeScoredCandidates(mood, themes, ranked, feedbackMap);
  const scoredMap = new Map<string, ScoredActivity>();
  for (const s of scored) {
    scoredMap.set(s.activity.id, s);
  }

  const moodEligible = scored.filter((s) => (s.activity.mood_fit?.[mood] ?? 0) >= 1);

  // 1. now_pool: quick, mood_fit >= 1, relief matches mood goal
  const nowEligible = moodEligible.filter(
    (s) => isQuickActivity(s.activity) && matchesMoodGoal(s.activity, mood)
  );

  const { filtered: nowFiltered, relaxed: nowRelaxed } = filterWithRelaxation(
    nowEligible,
    constraints,
    1
  );
  const now_pool = nowFiltered.slice(0, 5).map((s) => s.activity);
  const nowIds = new Set(now_pool.map((a) => a.id));

  // 2. next_pool: up to 8 other mood-fitting activities excluding now_pool, >= 3 general-purpose
  const nextEligibleAll = moodEligible.filter((s) => !nowIds.has(s.activity.id));
  const { filtered: nextFiltered, relaxed: nextRelaxed } = filterWithRelaxation(
    nextEligibleAll,
    constraints,
    2
  );

  const top8 = nextFiltered.slice(0, 8);
  const generalInNextEligible = nextFiltered.filter((s) => isGeneralPurpose(s.activity));
  const targetGeneralCount = Math.min(3, generalInNextEligible.length);
  const generalInTop8 = top8.filter((s) => isGeneralPurpose(s.activity));

  let selectedNextScored = [...top8];
  if (generalInTop8.length < targetGeneralCount) {
    const top8Ids = new Set(selectedNextScored.map((s) => s.activity.id));
    const missingCount = targetGeneralCount - generalInTop8.length;
    const extraGenerals = generalInNextEligible
      .filter((s) => !top8Ids.has(s.activity.id))
      .slice(0, missingCount);

    // Replace lowest-ranked non-general items in selectedNextScored
    let replaceIdx = selectedNextScored.length - 1;
    for (const extra of extraGenerals) {
      while (replaceIdx >= 0 && isGeneralPurpose(selectedNextScored[replaceIdx].activity)) {
        replaceIdx--;
      }
      if (replaceIdx >= 0) {
        selectedNextScored[replaceIdx] = extra;
        replaceIdx--;
      }
    }

    selectedNextScored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.activity.id.localeCompare(b.activity.id);
    });
  }

  const next_pool = selectedNextScored.map((s) => s.activity);

  return {
    now_pool,
    next_pool,
    constraints_relaxed: nowRelaxed || nextRelaxed,
    scoredMap,
  };
}

/**
 * Finds the gentlest, shortest option in now_pool (used when intensity is 'high').
 */
export function findGentlestQuickActivity(
  nowPool: Activity[],
  mood: Mood
): Activity | undefined {
  if (!nowPool || nowPool.length === 0) return undefined;

  const typePriority: Record<ActivityType, number> =
    mood === 'Sad'
      ? { break: 1, grounding: 2, breathing: 3, journaling: 4 }
      : { breathing: 1, grounding: 2, break: 3, journaling: 4 };

  const sorted = [...nowPool].sort((a, b) => {
    if (a.duration_minutes !== b.duration_minutes) {
      return a.duration_minutes - b.duration_minutes;
    }
    const tpA = typePriority[a.type] ?? 5;
    const tpB = typePriority[b.type] ?? 5;
    if (tpA !== tpB) return tpA - tpB;

    const fitA = a.mood_fit?.[mood] ?? 0;
    const fitB = b.mood_fit?.[mood] ?? 0;
    if (fitB !== fitA) return fitB - fitA;

    return a.id.localeCompare(b.id);
  });

  return sorted[0];
}

function trimToMaxWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ').replace(/[,;:]$/, '') + '.';
}

function buildRulesReason(
  activity: Activity,
  mood: Mood,
  scoredMap: Map<string, ScoredActivity>,
  primaryTheme?: Theme
): string {
  const scored = scoredMap.get(activity.id);
  const rawReason = generateTemplatedReason(
    activity,
    mood,
    scored?.rating,
    scored ? scored.isMoodMatch : true,
    scored?.matchedTheme || (primaryTheme && activity.target_themes?.includes(primaryTheme) ? primaryTheme : undefined)
  );
  return trimToMaxWords(rawReason, 25);
}

/**
 * Checks whether adding candidate violates diversity rules across chosen items:
 * - max 2 of same type across total plan (now + next[0] + next[1])
 * - Okay must never consist solely of breathing/grounding across all 3 items
 */
function canAddWithDiversity(
  candidate: Activity,
  alreadyChosen: Activity[],
  mood: Mood,
  totalSlots: number = 3
): boolean {
  const sameTypeCount = alreadyChosen.filter((a) => a.type === candidate.type).length;
  if (sameTypeCount >= 2) return false;

  if (mood === 'Okay' && alreadyChosen.length === totalSlots - 1) {
    const allSoFarPassive = alreadyChosen.every(
      (a) => a.type === 'breathing' || a.type === 'grounding'
    );
    const candidatePassive =
      candidate.type === 'breathing' || candidate.type === 'grounding';
    if (allSoFarPassive && candidatePassive) {
      return false;
    }
  }

  return true;
}

/**
 * Picks up to 2 deterministic Next items from next_pool.
 * When teamwork/conflict or another situational theme is detected, ensures the first Next item
 * prioritizes a theme-matching practical activity (rather than a purely passive breathing exercise).
 */
function pickDeterministicNextItems(
  mood: Mood,
  primaryTheme: Theme | undefined,
  nowAct: Activity,
  pools: PoolsResult
): PlanNextItem[] {
  const nextPool = pools.next_pool;
  const chosen: Activity[] = [nowAct];
  const nextActivities: Activity[] = [];

  const isInterpersonalOrSituational =
    Boolean(primaryTheme && primaryTheme !== 'general');

  // Slot 0: if situational theme is present (especially teamwork/conflict), prioritize a theme-matching practical activity
  let slot0: Activity | undefined;
  if (isInterpersonalOrSituational && primaryTheme) {
    // Prefer practical journaling/break matching primaryTheme first
    slot0 =
      nextPool.find(
        (a) =>
          !chosen.some((c) => c.id === a.id) &&
          a.target_themes?.includes(primaryTheme) &&
          (a.type === 'journaling' || a.type === 'break') &&
          canAddWithDiversity(a, chosen, mood)
      ) ||
      nextPool.find(
        (a) =>
          !chosen.some((c) => c.id === a.id) &&
          a.target_themes?.includes(primaryTheme) &&
          canAddWithDiversity(a, chosen, mood)
      );
  }

  if (!slot0) {
    slot0 =
      nextPool.find(
        (a) =>
          !chosen.some((c) => c.id === a.id) && canAddWithDiversity(a, chosen, mood)
      ) || nextPool.find((a) => !chosen.some((c) => c.id === a.id));
  }

  if (slot0) {
    chosen.push(slot0);
    nextActivities.push(slot0);
  }

  // Slot 1: next highest-ranked respecting diversity & no duplicates
  let slot1 = nextPool.find(
    (a) => !chosen.some((c) => c.id === a.id) && canAddWithDiversity(a, chosen, mood)
  );
  if (!slot1) {
    slot1 = nextPool.find((a) => !chosen.some((c) => c.id === a.id));
  }

  if (slot1) {
    chosen.push(slot1);
    nextActivities.push(slot1);
  }

  // Final safety net in case pools are severely constrained in synthetic tests
  if (nextActivities.length < 2) {
    const fallbackAll = getAllActivities().filter((a) => !chosen.some((c) => c.id === a.id));
    for (const f of fallbackAll) {
      if (nextActivities.length >= 2) break;
      nextActivities.push(f);
      chosen.push(f);
    }
  }

  return nextActivities.map((act) => ({
    activity: act,
    reason: buildRulesReason(act, mood, pools.scoredMap, primaryTheme),
    by: 'rules',
    personalised_by: 'rules',
  }));
}

/**
 * Builds the complete deterministic fallback plan from pools and mood x theme templates.
 */
export function buildRulesPlan(
  mood: Mood,
  detectedThemes: Theme[] = [],
  note?: string | null,
  poolsInput?: PoolsResult,
  options?: { intensity?: 'low' | 'medium' | 'high'; constraints?: PoolConstraints }
): WellbeingPlan {
  const pools =
    poolsInput ||
    buildPools(mood, detectedThemes, undefined, undefined, options?.constraints);

  const primaryTheme = selectPrimaryTheme(detectedThemes);
  const guidance = getFallbackGuidance(mood, detectedThemes, note);

  let nowAct =
    options?.intensity === 'high'
      ? findGentlestQuickActivity(pools.now_pool, mood) || pools.now_pool[0]
      : pools.now_pool[0];

  if (!nowAct) {
    const fallbackQuick = getAllActivities().find((a) => isQuickActivity(a)) || getAllActivities()[0];
    nowAct = fallbackQuick;
  }

  const nowItem: PlanNowItem = {
    activity: nowAct,
    reason: buildRulesReason(nowAct, mood, pools.scoredMap, primaryTheme),
    instruction: trimToMaxWords(
      guidance.now_instruction ||
        `Pause briefly for sixty seconds and follow ${nowAct.title}.`,
      25
    ),
    by: 'rules',
    personalised_by: 'rules',
  };

  const nextItems = pickDeterministicNextItems(mood, primaryTheme, nowAct, pools);

  const situation = guidance.situation!;
  const later: PlanLater = {
    action_steps: situation.action_steps,
    next_step: trimToMaxWords(guidance.next_step, 30),
    by: 'rules',
    personalised_by: 'rules',
  };

  return {
    understanding: guidance.understanding,
    acknowledgement: guidance.acknowledgement,
    acknowledgement_by: 'rules',
    why_this_order: trimToMaxWords(
      guidance.why_this_order ||
        'Starting with brief relief first creates clear headspace for your next activities.',
      25
    ),
    why_this_order_by: 'rules',
    situation,
    situation_by: 'rules',
    now: nowItem,
    next: nextItems,
    later,
    relevant_themes: detectedThemes,
  };
}

// --------------------------------------------------------------------------
// CODE VALIDATION FOR AI-DECIDED PLANS (validatePlan)
// --------------------------------------------------------------------------

const understandingSchema = z.object({
  main_concern: z.string().min(1),
  intensity: z.enum(['low', 'medium', 'high']),
  need: z.enum(NEEDS),
});

const actionStepSchema = z.object({
  step: z
    .string()
    .min(1)
    .refine((v) => countWords(v) <= 6),
  detail: z
    .string()
    .min(1)
    .refine((v) => countWords(v) <= 40),
  time: z.enum(['now', 'today', 'this_week']),
});

const actionStepsArraySchema = z
  .array(actionStepSchema)
  .length(3)
  .refine((arr) => arr.some((s) => s.time === 'now'));

export interface ValidatePlanParams {
  mood: Mood;
  note?: string | null;
  detectedThemes: Theme[];
  pools: PoolsResult;
  rulesPlan?: WellbeingPlan;
}

export interface ValidatedPlanOutcome {
  plan: WellbeingPlan;
  relevant_themes: Theme[];
  understanding_valid: boolean;
  any_ai_used: boolean;
}

function isWordValid(val: unknown, maxWords: number): val is string {
  return typeof val === 'string' && val.trim().length > 0 && countWords(val) <= maxWords;
}

/**
 * Validates raw Gemini JSON against strict schemas, pool membership, quick constraint,
 * no duplicates, type diversity, high-intensity gentlest selection, and safety/medical/legal checks.
 * Drops and replaces ONLY invalid parts using rulesPlan/ranker choices while preserving valid AI parts.
 */
export function validatePlan(
  rawAi: unknown,
  params: ValidatePlanParams
): ValidatedPlanOutcome {
  const { mood, note, detectedThemes, pools } = params;
  const baseRulesPlan =
    params.rulesPlan || buildRulesPlan(mood, detectedThemes, note, pools);

  if (!rawAi || typeof rawAi !== 'object' || Array.isArray(rawAi)) {
    return {
      plan: baseRulesPlan,
      relevant_themes: detectedThemes,
      understanding_valid: false,
      any_ai_used: false,
    };
  }

  const raw = rawAi as Record<string, unknown>;
  const nowPoolMap = new Map<string, Activity>(pools.now_pool.map((a) => [a.id, a]));
  const nextPoolMap = new Map<string, Activity>(pools.next_pool.map((a) => [a.id, a]));
  const primaryTheme = selectPrimaryTheme(detectedThemes);

  // 1. relevant_themes: filter strictly against allowed THEMES list
  let finalThemes: Theme[] = [];
  if (Array.isArray(raw.relevant_themes)) {
    finalThemes = raw.relevant_themes
      .filter((t): t is Theme => typeof t === 'string' && ALLOWED_THEMES_SET.has(t))
      .slice(0, 3);
  }
  const mergedThemes =
    finalThemes.length > 0
      ? finalThemes
      : detectedThemes;

  // 2. understanding
  let finalUnderstanding: Understanding = baseRulesPlan.understanding!;
  let understandingValid = false;
  const uParse = understandingSchema.safeParse(raw.understanding);
  if (uParse.success && isTextSafeForPlan(uParse.data.main_concern)) {
    finalUnderstanding = uParse.data;
    understandingValid = true;
  }

  const isHighIntensity = finalUnderstanding.intensity === 'high';
  const rulesPlan = isHighIntensity
    ? buildRulesPlan(mood, mergedThemes, note, pools, { intensity: 'high' })
    : baseRulesPlan;

  // 3. acknowledgement (max 60 words, safe)
  let finalAcknowledgement = rulesPlan.acknowledgement;
  let acknowledgementBy: 'ai' | 'rules' = 'rules';
  if (isWordValid(raw.acknowledgement, 60) && isTextSafeForPlan(raw.acknowledgement)) {
    finalAcknowledgement = raw.acknowledgement.trim();
    acknowledgementBy = 'ai';
  }

  // 4. why_this_order (max 25 words, safe)
  let finalWhyOrder = rulesPlan.why_this_order;
  let whyOrderBy: 'ai' | 'rules' = 'rules';
  if (isWordValid(raw.why_this_order, 25) && isTextSafeForPlan(raw.why_this_order)) {
    finalWhyOrder = raw.why_this_order.trim();
    whyOrderBy = 'ai';
  }

  // 5. now item (must be in now_pool, quick, safe reason <= 25w, safe instruction <= 25w, gentlest if high intensity)
  let finalNow: PlanNowItem = rulesPlan.now;
  const rawNow = raw.now as Record<string, unknown> | undefined;
  const gentlestQuick = findGentlestQuickActivity(pools.now_pool, mood);

  if (rawNow && typeof rawNow === 'object') {
    const actId = typeof rawNow.activity_id === 'string' ? rawNow.activity_id : '';
    const candidateAct = nowPoolMap.get(actId);
    const isValidQuick = Boolean(candidateAct && isQuickActivity(candidateAct));
    const satisfiesHighIntensity =
      !isHighIntensity || !gentlestQuick || candidateAct?.id === gentlestQuick.id;

    const reasonOk = isWordValid(rawNow.reason, 25) && isTextSafeForPlan(rawNow.reason);
    const instructionOk =
      isWordValid(rawNow.instruction, 25) && isTextSafeForPlan(rawNow.instruction);

    if (candidateAct && isValidQuick && satisfiesHighIntensity && reasonOk && instructionOk) {
      finalNow = {
        activity: candidateAct,
        reason: (rawNow.reason as string).trim(),
        instruction: (rawNow.instruction as string).trim(),
        by: 'ai',
        personalised_by: 'ai',
      };
    } else if (candidateAct && isValidQuick && satisfiesHighIntensity && reasonOk && !instructionOk) {
      // Activity and reason valid, only instruction failed -> replace instruction with template & mark rules
      finalNow = {
        activity: candidateAct,
        reason: (rawNow.reason as string).trim(),
        instruction: rulesPlan.now.instruction,
        by: 'rules',
        personalised_by: 'rules',
      };
    } else if (isHighIntensity && gentlestQuick) {
      // Force gentlest in now_pool if intensity high and AI picked non-gentlest or invalid
      finalNow = {
        activity: gentlestQuick,
        reason: buildRulesReason(gentlestQuick, mood, pools.scoredMap, primaryTheme),
        instruction: rulesPlan.now.instruction,
        by: 'rules',
        personalised_by: 'rules',
      };
    }
  }

  // 6. next items (exactly 2 items from next_pool, no duplicates with now or each other, type cap <= 2, Okay diversity)
  const chosenActivities: Activity[] = [finalNow.activity];
  const usedIds = new Set<string>([finalNow.activity.id]);
  const finalNext: PlanNextItem[] = [];

  const rawNextArr = Array.isArray(raw.next) ? raw.next : [];
  const hasExactTwoRawNext = rawNextArr.length === 2;

  for (let i = 0; i < 2; i++) {
    const rawSlot = hasExactTwoRawNext ? (rawNextArr[i] as Record<string, unknown> | undefined) : undefined;
    let pickedAiSlot: PlanNextItem | null = null;

    if (rawSlot && typeof rawSlot === 'object') {
      const actId = typeof rawSlot.activity_id === 'string' ? rawSlot.activity_id : '';
      const candidateAct = nextPoolMap.get(actId);
      const reasonOk = isWordValid(rawSlot.reason, 25) && isTextSafeForPlan(rawSlot.reason);

      if (
        candidateAct &&
        !usedIds.has(candidateAct.id) &&
        canAddWithDiversity(candidateAct, chosenActivities, mood, 3) &&
        reasonOk
      ) {
        pickedAiSlot = {
          activity: candidateAct,
          reason: (rawSlot.reason as string).trim(),
          by: 'ai',
          personalised_by: 'ai',
        };
      }
    }

    if (pickedAiSlot) {
      usedIds.add(pickedAiSlot.activity.id);
      chosenActivities.push(pickedAiSlot.activity);
      finalNext.push(pickedAiSlot);
    } else {
      // Fallback for ONLY this invalid slot using highest-ranked valid item from next_pool
      const fallbackAct =
        pools.next_pool.find(
          (a) => !usedIds.has(a.id) && canAddWithDiversity(a, chosenActivities, mood, 3)
        ) ||
        pools.next_pool.find((a) => !usedIds.has(a.id)) ||
        getAllActivities().find((a) => !usedIds.has(a.id))!;

      usedIds.add(fallbackAct.id);
      chosenActivities.push(fallbackAct);
      finalNext.push({
        activity: fallbackAct,
        reason: buildRulesReason(fallbackAct, mood, pools.scoredMap, primaryTheme),
        by: 'rules',
        personalised_by: 'rules',
      });
    }
  }

  const chosenTitlesLower = new Set(chosenActivities.map((a) => a.title.toLowerCase().trim()));

  // 7. situation card (summary <= 25 words, what_is_in_your_control <= 30 words, safe)
  const rawSit = raw.situation as Record<string, unknown> | undefined;
  let finalSummary = rulesPlan.situation.summary;
  let finalControl = rulesPlan.situation.what_is_in_your_control;
  let situationBy: 'ai' | 'rules' = 'rules';

  if (
    rawSit &&
    typeof rawSit === 'object' &&
    isWordValid(rawSit.summary, 25) &&
    isTextSafeForPlan(rawSit.summary) &&
    isWordValid(rawSit.what_is_in_your_control, 30) &&
    isTextSafeForPlan(rawSit.what_is_in_your_control)
  ) {
    finalSummary = (rawSit.summary as string).trim();
    finalControl = (rawSit.what_is_in_your_control as string).trim();
    situationBy = 'ai';
  }

  // 8. later (3 action_steps + next_step)
  let finalSteps: SituationActionStep[] = rulesPlan.later.action_steps;
  let stepsOk = false;

  if (rawSit && typeof rawSit === 'object') {
    const stepsParse = actionStepsArraySchema.safeParse(rawSit.action_steps);
    if (stepsParse.success) {
      const allStepsSafeAndDistinct = stepsParse.data.every(
        (s) =>
          isTextSafeForPlan(s.step) &&
          isTextSafeForPlan(s.detail) &&
          !chosenTitlesLower.has(s.step.toLowerCase().trim())
      );
      if (allStepsSafeAndDistinct) {
        finalSteps = stepsParse.data.map((s) => ({
          step: s.step.trim(),
          detail: s.detail.trim(),
          time: s.time,
        }));
        stepsOk = true;
      }
    }
  }

  let finalNextStep = rulesPlan.later.next_step;
  let nextStepOk = false;
  if (isWordValid(raw.next_step, 30) && isTextSafeForPlan(raw.next_step)) {
    finalNextStep = (raw.next_step as string).trim();
    nextStepOk = true;
  }

  // If high intensity and AI steps didn't mention reaching out gently, ensure a gentle support step is included cleanly
  if (isHighIntensity && stepsOk) {
    const reachOutRegex =
      /\b(reach\s+out|trusted|friend|family|someone|talk\s+to|check\s+in|mentor|advisor|supervisor|teacher|share)\b/i;
    const hasReachOut = finalSteps.some(
      (s) => reachOutRegex.test(s.step) || reachOutRegex.test(s.detail)
    );
    if (!hasReachOut) {
      const idx = finalSteps.findIndex((s) => s.time !== 'now');
      if (idx !== -1) {
        finalSteps[idx] = {
          step: 'Reach out to someone trusted',
          detail:
            'When you feel ready, let a trusted friend, family member, or supportive person know things feel heavy today.',
          time: finalSteps[idx].time,
        };
      }
    }
  }

  // Check rules: "later = action_steps + next_step" -> if action_steps failed (e.g. wrong count or unsafe terms), fall back later to rules
  const laterValid = stepsOk && nextStepOk;
  if (!stepsOk) {
    finalSteps = rulesPlan.later.action_steps;
  }
  if (!nextStepOk) {
    finalNextStep = rulesPlan.later.next_step;
  }
  const laterBy: 'ai' | 'rules' = laterValid ? 'ai' : 'rules';

  const finalSituation: Situation = {
    summary: finalSummary,
    what_is_in_your_control: finalControl,
    action_steps: finalSteps,
  };

  const anyAiUsed =
    acknowledgementBy === 'ai' ||
    whyOrderBy === 'ai' ||
    situationBy === 'ai' ||
    finalNow.by === 'ai' ||
    finalNext.some((n) => n.by === 'ai') ||
    laterBy === 'ai';

  return {
    plan: {
      understanding: finalUnderstanding,
      acknowledgement: finalAcknowledgement,
      acknowledgement_by: acknowledgementBy,
      why_this_order: finalWhyOrder,
      why_this_order_by: whyOrderBy,
      situation: finalSituation,
      situation_by: situationBy,
      now: finalNow,
      next: finalNext,
      later: {
        action_steps: finalSteps,
        next_step: finalNextStep,
        by: laterBy,
        personalised_by: laterBy,
      },
      relevant_themes: mergedThemes,
    },
    relevant_themes: finalThemes,
    understanding_valid: understandingValid,
    any_ai_used: anyAiUsed,
  };
}
