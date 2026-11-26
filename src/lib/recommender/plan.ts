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
import {
  getFallbackGuidance,
  highConfidenceToTheme,
  matchHighConfidenceSituation,
} from './fallbackTemplates';

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
  _themes: Theme[] = [],
  ranked?: ScoredActivity[] | Activity[] | null,
  feedbackMap?:
    | Map<string, Rating>
    | Record<string, Rating>
    | LatestActivityFeedback[]
    | null
): ScoredActivity[] {
  // POOLS WITHOUT THEMES: buildPools uses mood_fit, feedback, 24h penalty, quick/relief, and constraints only.
  // Never pass themes into pool scoring so unexpected notes have unbiased pools.
  if (!ranked || !Array.isArray(ranked) || ranked.length === 0) {
    return scoreCandidates(mood, feedbackMap, undefined, {
      detectedThemes: [],
    });
  }

  const firstItem = ranked[0] as ScoredActivity | Activity;
  if (!('score' in firstItem) || typeof firstItem.score !== 'number') {
    return scoreCandidates(mood, feedbackMap, undefined, {
      allActivities: ranked as Activity[],
      detectedThemes: [],
    });
  }

  const hasExplicitFeedback = Boolean(
    feedbackMap &&
      (feedbackMap instanceof Map
        ? feedbackMap.size > 0
        : Array.isArray(feedbackMap)
        ? feedbackMap.length > 0
        : Object.keys(feedbackMap).length > 0)
  );

  const adjusted = (ranked as ScoredActivity[]).map((item) => {
    const fit = item.activity.mood_fit?.[mood] ?? 0;
    // Strip any weak theme tie-breaker so pools strictly ignore themes
    let rating = item.rating;
    let pref = item.rating
      ? item.rating === 'yes'
        ? 2
        : item.rating === 'a_little'
        ? 1
        : -2
      : 0;

    if (hasExplicitFeedback && feedbackMap) {
      const { preference: newPref, rating: newRating } = extractFeedbackPreference(
        feedbackMap,
        item.activity.id
      );
      pref = newPref;
      rating = newRating ?? extractRating(feedbackMap, item.activity.id);
    }

    const pureScore = fit * 3 + pref - (item.isRecentlyCompleted ? 1.5 : 0);

    return {
      ...item,
      score: pureScore,
      rating,
      matchedTheme: undefined,
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

  // 2. next_pool: up to 8 other mood-fitting activities excluding now_pool,
  //    balancing >= 3 general-purpose AND diverse situational categories (calm/sleep, interpersonal/comfort, practical)
  //    so Gemini has sensible choices for any situation without using theme gating.
  const nextEligibleAll = moodEligible.filter((s) => !nowIds.has(s.activity.id));
  const { filtered: nextFiltered, relaxed: nextRelaxed } = filterWithRelaxation(
    nextEligibleAll,
    constraints,
    2
  );

  const isWorkOrStudy = (a: Activity): boolean =>
    Boolean(a.tags?.some((t) => t === 'work' || t === 'study' || t === 'focus_sprint'));
  const isRestOrCalmNonWork = (a: Activity): boolean =>
    !isWorkOrStudy(a) &&
    Boolean(
      a.tags?.some((t) => t === 'sleep' || t === 'rest' || t === 'calm') ||
        a.type === 'breathing' ||
        a.type === 'grounding'
    );
  const isInterpersonalOrComfort = (a: Activity): boolean =>
    Boolean(
      a.tags?.some((t) => t === 'conflict' || t === 'social' || t === 'comfort' || t === 'communication') ||
        a.target_themes?.some((t) => t === 'conflict' || t === 'relationships' || t === 'loneliness')
    );

  const selectedIds = new Set<string>();
  const selectedNextScored: ScoredActivity[] = [];
  const tryAddNext = (item: ScoredActivity | undefined) => {
    if (!item || selectedNextScored.length >= 8 || selectedIds.has(item.activity.id)) return;
    selectedIds.add(item.activity.id);
    selectedNextScored.push(item);
  };

  // Seed diverse situational anchors (if present in mood-eligible pool)
  tryAddNext(nextFiltered.find((s) => s.activity.target_themes?.includes('sleep') || s.activity.tags?.includes('sleep')));
  tryAddNext(nextFiltered.find((s) => isRestOrCalmNonWork(s.activity)));
  tryAddNext(nextFiltered.find((s) => isInterpersonalOrComfort(s.activity)));

  // Ensure at least 3 general-purpose activities
  const generalInNextEligible = nextFiltered.filter((s) => isGeneralPurpose(s.activity));
  for (const gen of generalInNextEligible) {
    const currentGeneralCount = selectedNextScored.filter((s) => isGeneralPurpose(s.activity)).length;
    if (currentGeneralCount >= Math.min(3, generalInNextEligible.length)) break;
    tryAddNext(gen);
  }

  // Fill remaining slots up to 8 by highest score, keeping at least 1 practical/work/focus item if available
  tryAddNext(nextFiltered.find((s) => isWorkOrStudy(s.activity)));
  for (const item of nextFiltered) {
    if (selectedNextScored.length >= 8) break;
    tryAddNext(item);
  }

  selectedNextScored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.activity.id.localeCompare(b.activity.id);
  });

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
  matchedSituationTheme?: Theme
): string {
  const scored = scoredMap.get(activity.id);
  const rawReason = generateTemplatedReason(
    activity,
    mood,
    scored?.rating,
    scored ? scored.isMoodMatch : true,
    matchedSituationTheme && activity.target_themes?.includes(matchedSituationTheme)
      ? matchedSituationTheme
      : undefined
  );
  return trimToMaxWords(rawReason, 25);
}

// --------------------------------------------------------------------------
// CODE-SIDE GUARDS (what_not_to_suggest + universal late-night guard)
// --------------------------------------------------------------------------

const WORK_OR_STUDY_TAGS = new Set(['work', 'study', 'focus_sprint']);

export function isWorkOrStudyActivity(activity: Activity): boolean {
  if (activity.tags?.some((t) => WORK_OR_STUDY_TAGS.has(t.toLowerCase()))) {
    return true;
  }
  if (/focus[\s_-]*sprint/i.test(activity.id) || /focus[\s_-]*sprint/i.test(activity.title)) {
    return true;
  }
  return false;
}

const LATE_NIGHT_OR_SLEEPLESS_REGEX =
  /\b(can(?:'|no)?t\s+sleep|cannot\s+sleep|unable\s+to\s+sleep|hard\s+to\s+sleep|struggling\s+to\s+sleep|insomnia|sleepless|wide\s+awake|lying\s+awake|staying\s+awake|restless\s+night|(?:1[0-2]|0?[1-5])\s*(?::\d{2})?\s*a\.?m\.?|midnight|late\s+night|late-night|middle\s+of\s+the\s+night)\b/i;

export function isLateNightOrSleeplessContext(
  note?: string | null,
  timeContext?: string | null,
  mainConcern?: string | null,
  whatNotToSuggest?: string[] | null
): boolean {
  const combined = [note || '', timeContext || '', mainConcern || '', ...(whatNotToSuggest || [])]
    .join(' ')
    .trim();
  if (!combined) return false;
  return LATE_NIGHT_OR_SLEEPLESS_REGEX.test(combined);
}

const AVOIDANCE_FRAMING_REGEX =
  /\b(avoid|no|don't|do not|stop|skip|without|away from|face down|put .{0,20} down|close|mute|turn off|set .{0,20} aside|park .{0,20} for|leave .{0,20} for|wait until|instead of)\b/i;

const FORBIDDEN_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'any',
  'more',
  'new',
  'right',
  'now',
  'tonight',
  'today',
  'late',
  'night',
  'before',
  'heavy',
  'intense',
  'extra',
  'doing',
  'things',
  'stuff',
  'tasks',
]);

interface ConceptRule {
  trigger: RegExp;
  activityCheck: (act: Activity) => boolean;
  textRegex: RegExp;
}

const CONCEPT_GUARD_RULES: ConceptRule[] = [
  {
    trigger: /\b(study|studying|cram|cramming|homework|coursework|revision|exam\s+prep)\b/i,
    activityCheck: (act) =>
      Boolean(act.tags?.some((t) => t === 'study' || t === 'focus_sprint')) ||
      /\b(study|focus\s*sprint|plan\s*b|one\s*small\s*step)\b/i.test(act.title + ' ' + act.id),
    textRegex:
      /\b(study|studying|cram|cramming|homework|coursework|flashcards|syllabus|textbook|review\s+(?:notes|chapters)|memorize|exam\s+prep|focus\s+sprint)\b/i,
  },
  {
    trigger: /\b(work|working|workplace|work\s+tasks|emails|overtime|focus\s*sprint|focus_sprint)\b/i,
    activityCheck: (act) =>
      Boolean(act.tags?.some((t) => t === 'work' || t === 'focus_sprint')) ||
      /\b(focus\s*sprint|draft\s+one\s+clear\s+ask|list\s+who\s+owns|plan\s*b)\b/i.test(act.title),
    textRegex:
      /\b(work\s+(?:tasks?|emails?|inbox|projects?|deliverables?)|check\s+(?:email|inbox|slack)|spreadsheets?|office\s+tasks?|focus\s+sprint)\b/i,
  },
  {
    trigger: /\b(new\s+tasks?|to-?do\s+lists?|planning|productivity)\b/i,
    activityCheck: (act) => isWorkOrStudyActivity(act),
    textRegex:
      /\b(start\s+a\s+new\s+task|add\s+tasks?|tackle\s+your\s+to-?do|focus\s+sprint)\b/i,
  },
  {
    trigger: /\b(caffeine|coffee|energy\s*drinks?|espresso)\b/i,
    activityCheck: () => false,
    textRegex: /\b(caffeine|coffee|espresso|energy\s*drinks?|caffeinated|black\s+tea|green\s+tea)\b/i,
  },
  {
    trigger: /\b(screens?|phones?|devices?|scrolling|social\s*media|laptop|blue\s*light)\b/i,
    activityCheck: (act) =>
      Boolean(act.tags?.some((t) => t === 'phone' || t === 'screen_break')) ||
      /\b(screen|message\s+one\s+friend|reach\s+out\s+to\s+one\s+person)\b/i.test(act.title),
    textRegex:
      /\b(scroll|social\s*media|browse\s+online|watch\s+(?:tv|videos?)|text\s+(?:a\s+friend|someone)|send\s+(?:a\s+)?(?:text|message|emoji)|check\s+your\s+phone|use\s+your\s+(?:phone|laptop|computer)|open\s+(?:tabs|app|website))\b/i,
  },
  {
    trigger: /\b(breathing|breathwork)\b/i,
    activityCheck: (act) =>
      act.type === 'breathing' || Boolean(act.tags?.includes('breathing')),
    textRegex: /\b(box\s+breathing|4-7-8\s+breathing|physiological\s+sigh|breathing\s+exercise)\b/i,
  },
  {
    trigger: /\b(grounding)\b/i,
    activityCheck: (act) =>
      act.type === 'grounding' || Boolean(act.tags?.includes('grounding')),
    textRegex: /\b(5-4-3-2-1\s+grounding|grounding\s+exercise)\b/i,
  },
  {
    trigger: /\b(journaling|journal|writing)\b/i,
    activityCheck: (act) => act.type === 'journaling',
    textRegex: /\b(journaling\s+exercise|brain\s+dump|write\s+an\s+unsent)\b/i,
  },
  {
    trigger: /\b(exercise|workout|cardio|running|stretching|intense\s+exercise)\b/i,
    activityCheck: (act) =>
      Boolean(act.tags?.includes('movement')) ||
      /\b(stretch|movement)\b/i.test(act.title),
    textRegex: /\b(intense\s+exercise|cardio|workout|running|jogging|stand\s+and\s+stretch|shoulder\s+release\s+stretch)\b/i,
  },
  {
    trigger: /\b(confrontation|arguing|angry\s+reply|texting|messaging)\b/i,
    activityCheck: (act) =>
      Boolean(act.tags?.some((t) => t === 'social' || t === 'communication')) ||
      /\b(message\s+one\s+friend|reach\s+out|draft\s+one\s+clear\s+ask|pick\s+your\s+conversation)\b/i.test(
        act.title
      ),
    textRegex: /\b(confront|argue\s+now|reply\s+immediately|send\s+(?:an\s+)?angry|demand\s+answers)\b/i,
  },
];

function escapeGuardRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSentencePositivelyMatching(text: string, regex: RegExp): boolean {
  const clauses = text.split(/[.!?;]+/);
  for (const clause of clauses) {
    const trimmed = clause.trim();
    if (!trimmed) continue;
    if (regex.test(trimmed) && !AVOIDANCE_FRAMING_REGEX.test(trimmed)) {
      return true;
    }
  }
  return false;
}

export function contradictsWhatNotToSuggest(
  target: Activity | string,
  whatNotToSuggest: string[] = []
): boolean {
  if (!whatNotToSuggest || whatNotToSuggest.length === 0) return false;

  const forbiddenItems = whatNotToSuggest
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);
  if (forbiddenItems.length === 0) return false;

  if (typeof target !== 'string') {
    const activity = target;
    const actText = [
      activity.type,
      activity.title,
      activity.id.replace(/-/g, ' '),
      ...(activity.tags || []),
      activity.description || '',
    ]
      .join(' ')
      .toLowerCase();

    for (const forbidden of forbiddenItems) {
      let matchedRule = false;
      for (const rule of CONCEPT_GUARD_RULES) {
        if (rule.trigger.test(forbidden)) {
          matchedRule = true;
          if (rule.activityCheck(activity)) {
            return true;
          }
        }
      }

      if (!matchedRule) {
        const words = forbidden
          .toLowerCase()
          .split(/[^a-z0-9_]+/)
          .filter((w) => w.length >= 4 && !FORBIDDEN_STOPWORDS.has(w));
        for (const w of words) {
          const rx = new RegExp(`\\b${escapeGuardRegExp(w)}\\b`, 'i');
          if (rx.test(actText)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // String target (now.instruction or action step text)
  const text = target.trim();
  if (!text) return false;

  for (const forbidden of forbiddenItems) {
    let matchedRule = false;
    for (const rule of CONCEPT_GUARD_RULES) {
      if (rule.trigger.test(forbidden)) {
        matchedRule = true;
        if (isSentencePositivelyMatching(text, rule.textRegex)) {
          return true;
        }
      }
    }

    if (!matchedRule) {
      const words = forbidden
        .toLowerCase()
        .split(/[^a-z0-9_]+/)
        .filter((w) => w.length >= 4 && !FORBIDDEN_STOPWORDS.has(w));
      for (const w of words) {
        const rx = new RegExp(`\\b${escapeGuardRegExp(w)}\\b`, 'i');
        if (isSentencePositivelyMatching(text, rx)) {
          return true;
        }
      }
    }
  }

  return false;
}

const SAFE_STEP_POOL: Array<{ step: string; detail: string }> = [
  {
    step: 'Pause for sixty quiet seconds',
    detail: 'Let your shoulders drop and take three slow, unhurried breaths right where you are.',
  },
  {
    step: 'Anchor with gentle touch',
    detail: 'Rest both feet flat on the floor and notice the steady physical support beneath you.',
  },
  {
    step: 'Offer yourself gentle patience',
    detail: 'Give yourself permission to slow down for tonight and let tomorrow wait.',
  },
  {
    step: 'Dim surrounding room light',
    detail: 'Soften the lighting around you and let your eyes rest comfortably away from stimulation.',
  },
  {
    step: 'Rest and unwind quietly',
    detail: 'Choose the quietest, lowest-effort comfort nearby so your body can settle.',
  },
];

function pickSafeStepReplacement(
  time: 'now' | 'today' | 'this_week',
  whatNotToSuggest: string[],
  usedSteps: Set<string>,
  fallbackCandidate?: SituationActionStep
): SituationActionStep {
  if (
    fallbackCandidate &&
    isTextSafeForPlan(fallbackCandidate.step) &&
    isTextSafeForPlan(fallbackCandidate.detail) &&
    !contradictsWhatNotToSuggest(fallbackCandidate.step + ' ' + fallbackCandidate.detail, whatNotToSuggest) &&
    !usedSteps.has(fallbackCandidate.step.toLowerCase())
  ) {
    return {
      step: fallbackCandidate.step,
      detail: fallbackCandidate.detail,
      time,
    };
  }

  const safePick = SAFE_STEP_POOL.find(
    (s) =>
      !usedSteps.has(s.step.toLowerCase()) &&
      !contradictsWhatNotToSuggest(s.step + ' ' + s.detail, whatNotToSuggest)
  );
  if (safePick) {
    return { step: safePick.step, detail: safePick.detail, time };
  }
  return {
    step: 'Take one quiet pause',
    detail: 'Rest quietly for one slow minute without adding any new demands.',
    time,
  };
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
 * Only uses a situational match when Honest Rules Mode matched one of the 6 high-confidence situations,
 * and enforces the universal late-night guard (never work/study/focus_sprint at night).
 */
function pickDeterministicNextItems(
  mood: Mood,
  matchedRuleTheme: Theme | undefined,
  nowAct: Activity,
  pools: PoolsResult,
  disallowWorkStudy: boolean = false
): PlanNextItem[] {
  const nextPool = pools.next_pool;
  const chosen: Activity[] = [nowAct];
  const nextActivities: Activity[] = [];
  const isAllowed = (a: Activity) => !disallowWorkStudy || !isWorkOrStudyActivity(a);

  let slot0: Activity | undefined;
  if (matchedRuleTheme && matchedRuleTheme !== 'general') {
    slot0 =
      nextPool.find(
        (a) =>
          !chosen.some((c) => c.id === a.id) &&
          isAllowed(a) &&
          a.target_themes?.includes(matchedRuleTheme) &&
          (a.type === 'journaling' || a.type === 'break') &&
          canAddWithDiversity(a, chosen, mood)
      ) ||
      nextPool.find(
        (a) =>
          !chosen.some((c) => c.id === a.id) &&
          isAllowed(a) &&
          a.target_themes?.includes(matchedRuleTheme) &&
          canAddWithDiversity(a, chosen, mood)
      );
  }

  if (!slot0) {
    slot0 =
      nextPool.find(
        (a) =>
          !chosen.some((c) => c.id === a.id) &&
          isAllowed(a) &&
          canAddWithDiversity(a, chosen, mood)
      ) ||
      nextPool.find((a) => !chosen.some((c) => c.id === a.id) && isAllowed(a)) ||
      getAllActivities().find(
        (a) =>
          !chosen.some((c) => c.id === a.id) &&
          isAllowed(a) &&
          (a.mood_fit?.[mood] ?? 0) >= 1 &&
          canAddWithDiversity(a, chosen, mood)
      );
  }

  if (slot0) {
    chosen.push(slot0);
    nextActivities.push(slot0);
  }

  let slot1 =
    nextPool.find(
      (a) =>
        !chosen.some((c) => c.id === a.id) &&
        isAllowed(a) &&
        canAddWithDiversity(a, chosen, mood)
    ) ||
    nextPool.find((a) => !chosen.some((c) => c.id === a.id) && isAllowed(a)) ||
    getAllActivities().find(
      (a) =>
        !chosen.some((c) => c.id === a.id) &&
        isAllowed(a) &&
        (a.mood_fit?.[mood] ?? 0) >= 1 &&
        canAddWithDiversity(a, chosen, mood)
    );

  if (slot1) {
    chosen.push(slot1);
    nextActivities.push(slot1);
  }

  if (nextActivities.length < 2) {
    const fallbackAll = getAllActivities().filter(
      (a) => !chosen.some((c) => c.id === a.id) && isAllowed(a)
    );
    for (const f of fallbackAll) {
      if (nextActivities.length >= 2) break;
      nextActivities.push(f);
      chosen.push(f);
    }
  }

  return nextActivities.map((act) => ({
    activity: act,
    reason: buildRulesReason(act, mood, pools.scoredMap, matchedRuleTheme),
    by: 'rules',
    personalised_by: 'rules',
  }));
}

/**
 * Builds the complete deterministic fallback plan from pools and Honest Rules templates.
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
    buildPools(mood, [], undefined, undefined, options?.constraints);

  const matchedSituation = matchHighConfidenceSituation(note);
  const matchedRuleTheme = matchedSituation ? highConfidenceToTheme(matchedSituation) : undefined;
  const guidance = getFallbackGuidance(mood, detectedThemes, note);

  const disallowWorkStudy = isLateNightOrSleeplessContext(
    note,
    guidance.understanding?.time_context,
    guidance.understanding?.main_concern,
    guidance.understanding?.what_not_to_suggest
  );

  const validNowPool = pools.now_pool.filter(
    (a) => !disallowWorkStudy || !isWorkOrStudyActivity(a)
  );
  const effectiveNowPool =
    validNowPool.length > 0
      ? validNowPool
      : getAllActivities().filter(
          (a) =>
            isQuickActivity(a) &&
            (a.mood_fit?.[mood] ?? 0) >= 1 &&
            (!disallowWorkStudy || !isWorkOrStudyActivity(a))
        );

  let nowAct =
    options?.intensity === 'high'
      ? findGentlestQuickActivity(effectiveNowPool, mood) || effectiveNowPool[0]
      : effectiveNowPool[0];

  if (!nowAct) {
    const fallbackQuick =
      getAllActivities().find(
        (a) => isQuickActivity(a) && (!disallowWorkStudy || !isWorkOrStudyActivity(a))
      ) || getAllActivities()[0];
    nowAct = fallbackQuick;
  }

  const nowItem: PlanNowItem = {
    activity: nowAct,
    reason: buildRulesReason(nowAct, mood, pools.scoredMap, matchedRuleTheme),
    instruction: trimToMaxWords(
      guidance.now_instruction ||
        `Pause briefly for sixty seconds and follow ${nowAct.title}.`,
      25
    ),
    by: 'rules',
    personalised_by: 'rules',
  };

  const nextItems = pickDeterministicNextItems(
    mood,
    matchedRuleTheme,
    nowAct,
    pools,
    disallowWorkStudy
  );

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
    relevant_themes: matchedRuleTheme ? [matchedRuleTheme] : [],
    note_interpreted: Boolean(guidance.note_interpreted),
  };
}

// --------------------------------------------------------------------------
// CODE VALIDATION FOR AI-DECIDED PLANS (validatePlan)
// --------------------------------------------------------------------------

const understandingSchema = z
  .object({
    main_concern: z.string().min(1),
    urgency: z.enum(['low', 'medium', 'high']).optional(),
    intensity: z.enum(['low', 'medium', 'high']).optional(),
    time_context: z.string().optional().default(''),
    constraints: z.array(z.string()).optional().default([]),
    what_not_to_suggest: z.array(z.string()).optional().default([]),
    need: z.enum(NEEDS).optional(),
  })
  .refine((u) => Boolean(u.urgency || u.intensity), {
    message: 'Either urgency or intensity is required',
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
  const hasNote = Boolean(note && typeof note === 'string' && note.trim().length > 0);
  const matchedSituation = hasNote ? matchHighConfidenceSituation(note) : null;
  const matchedRuleTheme = matchedSituation ? highConfidenceToTheme(matchedSituation) : undefined;

  if (!rawAi || typeof rawAi !== 'object' || Array.isArray(rawAi)) {
    return {
      plan: baseRulesPlan,
      relevant_themes: [],
      understanding_valid: false,
      any_ai_used: false,
    };
  }

  const raw = rawAi as Record<string, unknown>;
  const nowPoolMap = new Map<string, Activity>(pools.now_pool.map((a) => [a.id, a]));
  const nextPoolMap = new Map<string, Activity>(pools.next_pool.map((a) => [a.id, a]));

  // 1. relevant_themes: optional and informational only (never a gate)
  let finalThemes: Theme[] = [];
  if (Array.isArray(raw.relevant_themes)) {
    finalThemes = raw.relevant_themes
      .filter((t): t is Theme => typeof t === 'string' && ALLOWED_THEMES_SET.has(t))
      .slice(0, 3);
  }

  // 2. open-ended understanding
  let finalUnderstanding: Understanding = baseRulesPlan.understanding!;
  let understandingValid = false;
  const uParse = understandingSchema.safeParse(raw.understanding);
  if (uParse.success && isTextSafeForPlan(uParse.data.main_concern)) {
    const resolvedUrgency = uParse.data.urgency ?? uParse.data.intensity ?? 'medium';
    const cleanWhatNot = (uParse.data.what_not_to_suggest || [])
      .filter((w) => typeof w === 'string' && w.trim().length > 0)
      .map((w) => w.trim())
      .slice(0, 12);
    const cleanConstraints = (uParse.data.constraints || [])
      .filter((c) => typeof c === 'string' && c.trim().length > 0)
      .map((c) => c.trim())
      .slice(0, 10);

    finalUnderstanding = {
      main_concern: uParse.data.main_concern.trim(),
      urgency: resolvedUrgency,
      intensity: uParse.data.intensity ?? resolvedUrgency,
      time_context: (uParse.data.time_context || '').trim(),
      constraints: cleanConstraints,
      what_not_to_suggest: cleanWhatNot,
      need: uParse.data.need ?? baseRulesPlan.understanding?.need ?? 'calm',
    };
    understandingValid = true;
  }

  const whatNotToSuggest = finalUnderstanding.what_not_to_suggest || [];
  const disallowWorkStudy = isLateNightOrSleeplessContext(
    note,
    finalUnderstanding.time_context,
    finalUnderstanding.main_concern,
    whatNotToSuggest
  );

  const isActivityAllowed = (act: Activity): boolean => {
    if (disallowWorkStudy && isWorkOrStudyActivity(act)) return false;
    if (contradictsWhatNotToSuggest(act, whatNotToSuggest)) return false;
    return true;
  };

  const isTextAllowed = (text: unknown): text is string => {
    if (typeof text !== 'string' || !isTextSafeForPlan(text)) return false;
    if (contradictsWhatNotToSuggest(text, whatNotToSuggest)) return false;
    return true;
  };

  const isHighIntensity =
    finalUnderstanding.urgency === 'high' || finalUnderstanding.intensity === 'high';
  const rulesPlan = isHighIntensity
    ? buildRulesPlan(mood, detectedThemes, note, pools, { intensity: 'high' })
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

  // 5. now item (must be in now_pool, quick, pass what_not_to_suggest & late-night guards, gentlest if high urgency/intensity)
  const validNowCandidates = pools.now_pool.filter(isActivityAllowed);
  const catalogQuickFallback = getAllActivities().filter(
    (a) => isQuickActivity(a) && (a.mood_fit?.[mood] ?? 0) >= 1 && isActivityAllowed(a)
  );
  const gentlestValidQuick =
    findGentlestQuickActivity(validNowCandidates, mood) ||
    findGentlestQuickActivity(catalogQuickFallback, mood) ||
    findGentlestQuickActivity(pools.now_pool, mood) ||
    rulesPlan.now.activity;

  const safeNowInstruction = isTextAllowed(rulesPlan.now.instruction)
    ? rulesPlan.now.instruction
    : `Pause quietly for sixty seconds and follow ${gentlestValidQuick.title}.`;

  let finalNow: PlanNowItem = {
    ...rulesPlan.now,
    activity: isActivityAllowed(rulesPlan.now.activity)
      ? rulesPlan.now.activity
      : gentlestValidQuick,
    reason: isActivityAllowed(rulesPlan.now.activity)
      ? rulesPlan.now.reason
      : buildRulesReason(gentlestValidQuick, mood, pools.scoredMap, matchedRuleTheme),
    instruction: safeNowInstruction,
  };

  const rawNow = raw.now as Record<string, unknown> | undefined;
  if (rawNow && typeof rawNow === 'object') {
    const actId = typeof rawNow.activity_id === 'string' ? rawNow.activity_id : '';
    const candidateAct = nowPoolMap.get(actId);
    const isValidQuick = Boolean(
      candidateAct && isQuickActivity(candidateAct) && isActivityAllowed(candidateAct)
    );
    const satisfiesHighIntensity =
      !isHighIntensity || !gentlestValidQuick || candidateAct?.id === gentlestValidQuick.id;

    const reasonOk = isWordValid(rawNow.reason, 25) && isTextSafeForPlan(rawNow.reason);
    const instructionOk = isWordValid(rawNow.instruction, 25) && isTextAllowed(rawNow.instruction);

    if (candidateAct && isValidQuick && satisfiesHighIntensity && reasonOk && instructionOk) {
      finalNow = {
        activity: candidateAct,
        reason: (rawNow.reason as string).trim(),
        instruction: (rawNow.instruction as string).trim(),
        by: 'ai',
        personalised_by: 'ai',
      };
    } else if (candidateAct && isValidQuick && satisfiesHighIntensity && reasonOk && !instructionOk) {
      // Activity & reason valid; only instruction failed -> replace ONLY instruction with safe fallback
      const repairInstruction = isTextAllowed(rulesPlan.now.instruction)
        ? rulesPlan.now.instruction
        : `Take sixty calm seconds with ${candidateAct.title}.`;
      finalNow = {
        activity: candidateAct,
        reason: (rawNow.reason as string).trim(),
        instruction: trimToMaxWords(repairInstruction, 25),
        by: 'rules',
        personalised_by: 'rules',
      };
    } else {
      // Replace invalid/violating now activity with ranker's gentlest valid quick choice
      const safeFallbackAct = gentlestValidQuick;
      finalNow = {
        activity: safeFallbackAct,
        reason: buildRulesReason(safeFallbackAct, mood, pools.scoredMap, matchedRuleTheme),
        instruction: trimToMaxWords(
          isTextAllowed(rulesPlan.now.instruction)
            ? rulesPlan.now.instruction
            : `Take sixty calm seconds with ${safeFallbackAct.title}.`,
          25
        ),
        by: 'rules',
        personalised_by: 'rules',
      };
    }
  }

  // 6. next items (exactly 2 items from next_pool, no duplicates, type cap <= 2, Okay diversity, guards)
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
        isActivityAllowed(candidateAct) &&
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
      // Replace ONLY this invalid/violating slot using ranker's gentlest valid choice
      const pickBestValid = (candidates: Activity[]) => {
        const filtered = candidates.filter(
          (a) => !usedIds.has(a.id) && isActivityAllowed(a)
        );
        // Prefer gentle calming activities (shorter duration / non-work) respecting diversity
        const withDiv = filtered.filter((a) => canAddWithDiversity(a, chosenActivities, mood, 3));
        const poolToSort = withDiv.length > 0 ? withDiv : filtered;
        return poolToSort[0];
      };

      const moodFittingCatalog = getAllActivities().filter(
        (a) => (a.mood_fit?.[mood] ?? 0) >= 1
      );
      const fallbackAct =
        pickBestValid(pools.next_pool) ||
        pickBestValid(moodFittingCatalog) ||
        pickBestValid(getAllActivities()) ||
        pools.next_pool.find((a) => !usedIds.has(a.id)) ||
        getAllActivities().find((a) => !usedIds.has(a.id))!;

      usedIds.add(fallbackAct.id);
      chosenActivities.push(fallbackAct);
      finalNext.push({
        activity: fallbackAct,
        reason: buildRulesReason(fallbackAct, mood, pools.scoredMap, matchedRuleTheme),
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

  // 8. later (3 action_steps + next_step), repairing ONLY violating steps if any step contradicts what_not_to_suggest
  let finalSteps: SituationActionStep[] = rulesPlan.later.action_steps;
  let stepsOk = false;
  let anyStepRepairedByGuard = false;

  if (rawSit && typeof rawSit === 'object') {
    const stepsParse = actionStepsArraySchema.safeParse(rawSit.action_steps);
    if (stepsParse.success) {
      const structurallySafe = stepsParse.data.every(
        (s) =>
          isTextSafeForPlan(s.step) &&
          isTextSafeForPlan(s.detail) &&
          !chosenTitlesLower.has(s.step.toLowerCase().trim())
      );
      if (structurallySafe) {
        const usedStepTitles = new Set<string>();
        finalSteps = stepsParse.data.map((s, idx) => {
          const combinedStepText = `${s.step.trim()} ${s.detail.trim()}`;
          if (!contradictsWhatNotToSuggest(combinedStepText, whatNotToSuggest)) {
            usedStepTitles.add(s.step.trim().toLowerCase());
            return {
              step: s.step.trim(),
              detail: s.detail.trim(),
              time: s.time,
            };
          }
          anyStepRepairedByGuard = true;
          const replacement = pickSafeStepReplacement(
            s.time,
            whatNotToSuggest,
            usedStepTitles,
            rulesPlan.later.action_steps[idx]
          );
          usedStepTitles.add(replacement.step.toLowerCase());
          return replacement;
        });
        stepsOk = true;
      }
    }
  }

  let finalNextStep = rulesPlan.later.next_step;
  let nextStepOk = false;
  if (isWordValid(raw.next_step, 30) && isTextAllowed(raw.next_step)) {
    finalNextStep = (raw.next_step as string).trim();
    nextStepOk = true;
  }

  // If high intensity/urgency and AI steps didn't mention reaching out gently, ensure a gentle support step
  if (isHighIntensity && stepsOk && !anyStepRepairedByGuard) {
    const reachOutRegex =
      /\b(reach\s+out|trusted|friend|family|someone|talk\s+to|check\s+in|mentor|advisor|supervisor|teacher|share)\b/i;
    const hasReachOut = finalSteps.some(
      (s) => reachOutRegex.test(s.step) || reachOutRegex.test(s.detail)
    );
    if (!hasReachOut) {
      const idx = finalSteps.findIndex((s) => s.time !== 'now');
      if (idx !== -1) {
        const reachCandidate: SituationActionStep = {
          step: 'Reach out to someone trusted',
          detail:
            'When you feel ready, let a trusted friend, family member, or supportive person know things feel heavy today.',
          time: finalSteps[idx].time,
        };
        if (
          !contradictsWhatNotToSuggest(
            `${reachCandidate.step} ${reachCandidate.detail}`,
            whatNotToSuggest
          )
        ) {
          finalSteps[idx] = reachCandidate;
        }
      }
    }
  }

  const laterValid = stepsOk && nextStepOk && !anyStepRepairedByGuard;
  if (!stepsOk) {
    const usedFallbackTitles = new Set<string>();
    finalSteps = rulesPlan.later.action_steps.map((s) => {
      if (!contradictsWhatNotToSuggest(`${s.step} ${s.detail}`, whatNotToSuggest)) {
        usedFallbackTitles.add(s.step.toLowerCase());
        return s;
      }
      const rep = pickSafeStepReplacement(s.time, whatNotToSuggest, usedFallbackTitles);
      usedFallbackTitles.add(rep.step.toLowerCase());
      return rep;
    });
  }
  if (!nextStepOk) {
    finalNextStep = isTextAllowed(rulesPlan.later.next_step)
      ? rulesPlan.later.next_step
      : 'Take one quiet, low-effort step that respects your current limits.';
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

  const noteInterpreted = Boolean(
    hasNote && (anyAiUsed || understandingValid || rulesPlan.note_interpreted)
  );

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
      relevant_themes: finalThemes,
      note_interpreted: noteInterpreted,
    },
    relevant_themes: finalThemes,
    understanding_valid: understandingValid,
    any_ai_used: anyAiUsed,
  };
}
