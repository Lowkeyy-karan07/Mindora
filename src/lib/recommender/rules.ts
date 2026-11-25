import { Activity, ActivityType, LatestActivityFeedback, Mood, Rating, Recommendation, Session, Theme } from '@/types';
import { getAllActivities } from '../catalog';
import { detectThemes } from './themes';

export interface ScoredActivity {
  activity: Activity;
  score: number;
  isMoodMatch: boolean;
  matchedTheme?: Theme;
  rating?: Rating;
  isRecentlyCompleted: boolean;
}

export interface RankOptions {
  now?: Date;
  allActivities?: Activity[];
  detectedThemes?: Theme[];
  note?: string | null;
  limit?: number;
  disableDiversityCap?: boolean;
  maxMinutes?: number | null;
  excludeTypes?: ActivityType[];
  includeTypes?: ActivityType[];
  excludeActivityIds?: string[];
  wantsSwap?: boolean;
}

export interface ConstraintRankResult {
  recommendations: Recommendation[];
  relaxationNote?: string;
  appliedConstraints: {
    maxMinutes?: number | null;
    excludeTypes: ActivityType[];
    includeTypes: ActivityType[];
    excludeActivityIds: string[];
  };
}

/**
 * Extracts detected themes from RankOptions or Theme[] input.
 */
export function extractDetectedThemes(options?: RankOptions | Theme[]): Theme[] {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  if (options.detectedThemes && Array.isArray(options.detectedThemes)) {
    return options.detectedThemes;
  }
  if (options.note) {
    return detectThemes(options.note);
  }
  return [];
}

/**
 * Extracts the user's latest rating for a given activity from various feedback representations.
 */
export function extractRating(
  feedbackMap:
    | Map<string, Rating>
    | Record<string, Rating>
    | LatestActivityFeedback[]
    | undefined
    | null,
  activityId: string
): Rating | undefined {
  if (!feedbackMap) {
    return undefined;
  }

  if (feedbackMap instanceof Map) {
    return feedbackMap.get(activityId);
  }

  if (Array.isArray(feedbackMap)) {
    const item = feedbackMap.find((f) => f.activity_id === activityId);
    return item?.rating;
  }

  if (typeof feedbackMap === 'object') {
    return (feedbackMap as Record<string, Rating>)[activityId];
  }

  return undefined;
}

/**
 * Extracts weighted feedback preference value (capped to -2..+2).
 */
export function extractFeedbackPreference(
  feedbackMap:
    | Map<string, Rating>
    | Record<string, Rating>
    | LatestActivityFeedback[]
    | undefined
    | null,
  activityId: string
): { preference: number; rating?: Rating } {
  if (!feedbackMap) {
    return { preference: 0 };
  }

  if (Array.isArray(feedbackMap)) {
    const item = feedbackMap.find((f) => f.activity_id === activityId);
    if (!item) return { preference: 0 };
    const weight = typeof item.weight === 'number' ? item.weight : 1.0;
    const baseVal =
      item.rating === 'yes' ? 2 : item.rating === 'a_little' ? 1 : item.rating === 'no' ? -2 : 0;
    const capped = Math.min(2, Math.max(-2, baseVal * weight));
    return { preference: capped, rating: item.rating };
  }

  let rating: Rating | undefined = undefined;
  if (feedbackMap instanceof Map) {
    rating = feedbackMap.get(activityId);
  } else if (typeof feedbackMap === 'object') {
    rating = (feedbackMap as Record<string, Rating>)[activityId];
  }

  if (!rating) return { preference: 0 };
  const baseVal = rating === 'yes' ? 2 : rating === 'a_little' ? 1 : rating === 'no' ? -2 : 0;
  return { preference: baseVal, rating };
}

/**
 * Checks whether an activity was completed in the last 24 hours.
 */
export function isCompletedInLast24Hours(
  activityId: string,
  recentSessions:
    | Session[]
    | { activity_id: string; completed?: boolean | number; completed_at?: string | null; started_at?: string }[]
    | undefined
    | null,
  now: Date = new Date()
): boolean {
  if (!recentSessions || !Array.isArray(recentSessions)) {
    return false;
  }

  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();

  return recentSessions.some((s) => {
    if (s.activity_id !== activityId) return false;
    const isCompleted = Boolean(s.completed);
    if (!isCompleted) return false;

    const timeString = s.completed_at || s.started_at;
    if (!timeString) return false;

    const sessionTime = new Date(timeString).getTime();
    if (isNaN(sessionTime)) return false;

    const diff = nowMs - sessionTime;
    return diff >= 0 && diff <= twentyFourHoursMs;
  });
}

/**
 * Generates situation-specific templated reasons mentioning the detected theme.
 */
function generateThemeTemplatedReason(
  activity: Activity,
  theme: Theme
): string {
  const situationPhrases: Record<Theme, string> = {
    academics: 'Since academics feel heavy right now',
    work: 'Since work feels heavy right now',
    sleep: 'Since sleep feels difficult right now',
    relationships: 'Since relationship moments feel tender right now',
    loneliness: 'When feeling isolated or lonely right now',
    health_worry: 'When health worries are weighing on your mind',
    money: 'Since financial thoughts feel heavy right now',
    teamwork: 'Since group collaboration feels challenging right now',
    conflict: 'Since interpersonal tension is weighing on you right now',
    general: 'Since things feel heavy right now',
  };

  const situation = situationPhrases[theme] || 'Since things feel heavy right now';

  if (activity.id === 'break-it-into-one-small-step') {
    return `${situation}, slicing your task down into one tiny starter step creates calm, manageable momentum.`;
  }
  if (activity.id === '25-minute-focus-sprint') {
    return `${situation}, a gentle 25-minute focus sprint gives you structure without overwhelming pressure.`;
  }
  if (activity.id === 'name-worry-park-it') {
    return `${situation}, a brief 5-minute worry pause lets you acknowledge what feels hard and park it for later.`;
  }
  if (activity.id === 'reach-out-to-one-person') {
    return `${situation}, sending a low-pressure note to one person can bring gentle warmth and connection.`;
  }
  if (activity.id === 'sleep-wind-down') {
    return `${situation}, this calming rhythm helps slow your nervous system and prepare your body for rest.`;
  }
  if (activity.id === 'self-kindness-pause') {
    return `${situation}, taking a pause for self-kindness offers supportive perspective without self-criticism.`;
  }
  if (activity.id === 'brain-dump' || activity.id === 'brain-dump-pick-one') {
    return `${situation}, unloading mental clutter onto paper gives your swirling thoughts room to settle.`;
  }
  if (activity.id === 'small-comfort-act') {
    return `${situation}, choosing one tiny comfort gives your body immediate warmth and care.`;
  }
  if (activity.id === 'savour-the-moment') {
    return `${situation}, lingering on a pleasant sensation anchors you in quiet ease.`;
  }
  if (activity.id === 'set-one-intention') {
    return `${situation}, anchoring on one purposeful intention helps you move through your day with steady clarity.`;
  }
  if (activity.id === 'shoulder-release-stretch') {
    return `${situation}, releasing shoulder and neck tension frees up physical and mental breathing room.`;
  }
  if (activity.id === 'box-breathing' || activity.id === '4-7-8-breathing' || activity.id === 'physiological-sigh') {
    return `${situation}, a steady breathing pattern helps unburden physical tension and restore ease.`;
  }
  if (activity.id === 'screen-movement-break') {
    return `${situation}, stepping away for a physical movement break helps reset your focus and posture.`;
  }
  if (activity.id === 'list-who-owns-what') {
    return `${situation}, writing down who owns each task clarifies shared deliverables objectively.`;
  }
  if (activity.id === 'draft-one-clear-ask') {
    return `${situation}, drafting one direct, calm ask with a clear deadline moves things forward.`;
  }
  if (activity.id === 'write-the-unsent-message') {
    return `${situation}, venting privately without sending helps release emotional heat first.`;
  }
  if (activity.id === 'pick-conversation-moment') {
    return `${situation}, planning when and how to open the dialogue supports calmer outcomes.`;
  }
  if (activity.id === 'separate-facts-feelings') {
    return `${situation}, separating observable events from feelings clarifies your options constructively.`;
  }
  if (activity.id === 'plan-b-deadline') {
    return `${situation}, defining your realistic Plan B protects your progress near deadlines.`;
  }
  if (activity.id === 'pick-one-thing-matters') {
    return `${situation}, isolating the single priority that matters restores clear focus.`;
  }
  if (activity.id === 'write-it-down-park-it') {
    return `${situation}, parking open concerns on paper frees mental bandwidth right now.`;
  }
  if (activity.id === 'decide-next-20-minutes') {
    return `${situation}, committing to just the next twenty minutes makes starting approachable.`;
  }
  if (activity.id === 'music-reset' || activity.id === 'name-one-good-thing' || activity.id === 'message-one-friend') {
    return `${situation}, a gentle 2-minute emotional lift offers warm steadiness right now.`;
  }

  return `${situation}, this supportive ${activity.duration_minutes}-minute practice is tailored to offer you relief.`;
}

/**
 * Generates a warm, empathetic, non-clinical reason for the recommendation.
 */
export function generateTemplatedReason(
  activity: Activity,
  mood: Mood,
  rating?: Rating,
  isMoodMatch: boolean = true,
  matchedTheme?: Theme
): string {
  // If a situation theme was matched, return a warm situation-specific templated reason
  if (matchedTheme) {
    return generateThemeTemplatedReason(activity, matchedTheme);
  }

  // If user previously rated this activity positively
  if (rating === 'yes') {
    return `You previously found this helpful, and it is a gentle way to support yourself while feeling ${mood.toLowerCase()}.`;
  }
  if (rating === 'a_little') {
    return `Offered some comfort in a past session; a familiar, low-pressure option for feeling ${mood.toLowerCase()}.`;
  }

  // If this activity is recommended for variety (not a primary mood target)
  if (!isMoodMatch) {
    return `A gentle change of pace to help shift your environment and bring fresh ease into your day.`;
  }

  // Type and mood specific supportive wording
  const reasonsByTypeAndMood: Record<ActivityType, Record<Mood, string>> = {
    breathing: {
      Anxious: 'A gentle breathing pattern designed to steady your breath and quiet racing thoughts.',
      Stressed: 'A calming breath rhythm to help release physical tension and reset your nervous system.',
      Overwhelmed: 'A simple, focused breathing pause to create quiet space when things feel like too much.',
      Sad: 'A soft, soothing breath practice to bring warmth, steady comfort, and care to your body.',
      Okay: 'A refreshing breathing pause to cultivate balance and sustain your steady focus.',
    },
    grounding: {
      Anxious: 'Helps gently anchor your attention in your immediate surroundings to ease anxious feelings.',
      Stressed: 'Gently brings your awareness back to your body to unclench built-up physical stress.',
      Overwhelmed: 'Anchors you in the here-and-now when your thoughts are swirling or heavy.',
      Sad: 'A kind, grounded check-in to offer your body soft reassurance and presence.',
      Okay: 'A mindful grounding exercise to enjoy and anchor this calm, steady moment.',
    },
    journaling: {
      Anxious: 'Provides a safe, quiet outlet to unload swirling worries onto the page without judgment.',
      Stressed: 'A structured pause to untangle what feels tight and restore a sense of clarity.',
      Overwhelmed: 'Helps narrow your focus down to just one small, manageable thought at a time.',
      Sad: 'A compassionate space to put words to what you feel and offer yourself patience.',
      Okay: 'A brief reflective moment to note what is going well and capture clear thoughts.',
    },
    break: {
      Anxious: 'A screen and movement break to change your physical setting and ease restlessness.',
      Stressed: 'Step away from your display to stretch, hydrate, and release shoulder and neck tension.',
      Overwhelmed: 'A restful physical pause to step away from demands and give your mind breathing room.',
      Sad: 'A gentle movement break and change of scenery to lift heavy, stagnant energy.',
      Okay: 'A quick screen and posture break to keep your body feeling refreshed and energized.',
    },
  };

  return (
    reasonsByTypeAndMood[activity.type]?.[mood] ||
    `A supportive ${activity.duration_minutes}-minute practice tailored for moments when you feel ${mood.toLowerCase()}.`
  );
}

/**
 * Scores candidate activities based on:
 * Score = mood_fit * 3 + theme bonus (+5 if mood_fit >= 1) + feedback preference (capped to -2..+2) - recent completion penalty (1.5)
 * Mood fit strictly dominates feedback (fit 0 max 2, fit 3 min 7).
 * Deterministic tie-break by activity id.
 */
export function scoreCandidates(
  mood: Mood,
  feedbackMap?:
    | Map<string, Rating>
    | Record<string, Rating>
    | LatestActivityFeedback[]
    | null,
  recentSessions?:
    | Session[]
    | { activity_id: string; completed?: boolean | number; completed_at?: string | null; started_at?: string }[]
    | null,
  options?: RankOptions | Theme[]
): ScoredActivity[] {
  const allActivities = (options && !Array.isArray(options) && options.allActivities) || getAllActivities();
  const now = (options && !Array.isArray(options) && options.now) || new Date();
  const detectedThemes = extractDetectedThemes(options);

  // Score all activities
  const scored: ScoredActivity[] = allActivities.map((activity) => {
    let score = 0;

    // 1. Mood fit * 3
    const fit = activity.mood_fit?.[mood] ?? 0;
    score += fit * 3;
    const isMoodMatch = fit >= 1;

    // 2. Theme match bonus (+5), strictly applies ONLY if mood_fit >= 1
    let matchedTheme: Theme | undefined = undefined;
    if (detectedThemes.length > 0 && activity.target_themes && fit >= 1) {
      matchedTheme = detectedThemes.find((t) => activity.target_themes!.includes(t));
      if (matchedTheme) {
        score += 5;
      }
    }

    // 3. Feedback preference (capped to -2..+2, weighted by mood)
    const { preference, rating } = extractFeedbackPreference(feedbackMap, activity.id);
    score += preference;

    // 4. Small penalty if completed in last 24h (-1.5)
    const isRecentlyCompleted = isCompletedInLast24Hours(activity.id, recentSessions, now);
    if (isRecentlyCompleted) {
      score -= 1.5;
    }

    return {
      activity,
      score,
      isMoodMatch,
      matchedTheme,
      rating,
      isRecentlyCompleted,
    };
  });

  // Sort by score descending, with deterministic tie-break by activity id ascending
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.activity.id.localeCompare(b.activity.id);
  });

  return scored;
}

/**
 * Enforces diversity on top 3 recommendations:
 * - At most 2 activities of the same type in top 3.
 * - 'Okay' must never return only breathing/grounding (at least 1 journaling or break).
 */
export function selectDiverseTopThree(
  sorted: ScoredActivity[],
  mood: Mood
): ScoredActivity[] {
  const selected: ScoredActivity[] = [];
  const typeCounts: Record<ActivityType, number> = {
    breathing: 0,
    grounding: 0,
    journaling: 0,
    break: 0,
  };

  for (const item of sorted) {
    if (selected.length === 3) break;

    const actType = item.activity.type;

    // Diversity Rule 1: at most 2 activities of the same type in top 3
    if (typeCounts[actType] >= 2) {
      continue;
    }

    // Diversity Rule 2: 'Okay' must never return only breathing/grounding
    if (mood === 'Okay' && selected.length === 2) {
      const firstTwoAreBreathingOrGrounding = selected.every(
        (s) => s.activity.type === 'breathing' || s.activity.type === 'grounding'
      );
      if (
        firstTwoAreBreathingOrGrounding &&
        (actType === 'breathing' || actType === 'grounding')
      ) {
        continue;
      }
    }

    selected.push(item);
    typeCounts[actType]++;
  }

  // Fallback in case constraint filtering yielded fewer than 3
  if (selected.length < 3) {
    for (const item of sorted) {
      if (selected.length === 3) break;
      if (!selected.some((s) => s.activity.id === item.activity.id)) {
        selected.push(item);
      }
    }
  }

  return selected;
}

/**
 * Filters activities by constraints:
 * - maxMinutes
 * - excludeTypes
 * - includeTypes
 * - excludeActivityIds (for wants_swap)
 */
export function filterActivitiesByConstraints(
  activities: Activity[],
  constraints: {
    maxMinutes?: number | null;
    excludeTypes?: ActivityType[];
    includeTypes?: ActivityType[];
    excludeActivityIds?: string[];
  }
): Activity[] {
  return activities.filter((act) => {
    if (constraints.excludeActivityIds && constraints.excludeActivityIds.includes(act.id)) {
      return false;
    }
    if (typeof constraints.maxMinutes === 'number' && act.duration_minutes > constraints.maxMinutes) {
      return false;
    }
    if (constraints.excludeTypes && constraints.excludeTypes.includes(act.type)) {
      return false;
    }
    if (
      constraints.includeTypes &&
      constraints.includeTypes.length > 0 &&
      !constraints.includeTypes.includes(act.type)
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Ranks activities taking into account user chat constraints.
 * If fewer than 3 activities remain, relaxes the least important constraint and returns a relaxation note.
 */
export function rankActivitiesWithConstraints(
  mood: Mood,
  feedbackMap?:
    | Map<string, Rating>
    | Record<string, Rating>
    | LatestActivityFeedback[]
    | null,
  recentSessions?:
    | Session[]
    | { activity_id: string; completed?: boolean | number; completed_at?: string | null; started_at?: string }[]
    | null,
  options?: RankOptions
): ConstraintRankResult {
  const allActs = options?.allActivities || getAllActivities();
  let maxMinutes = options?.maxMinutes;
  let excludeTypes = options?.excludeTypes || [];
  let includeTypes = options?.includeTypes || [];
  let excludeActivityIds = options?.excludeActivityIds || [];
  let relaxationNote: string | undefined = undefined;

  // Step 1: Attempt with all constraints active
  let filtered = filterActivitiesByConstraints(allActs, {
    maxMinutes,
    excludeTypes,
    includeTypes,
    excludeActivityIds,
  });

  // Check how many have mood_fit >= 1
  let moodFitting = filtered.filter((a) => (a.mood_fit?.[mood] ?? 0) >= 1);

  // If fewer than 3, relax least important constraint 1: excludeActivityIds (from wants_swap)
  if (moodFitting.length < 3 && excludeActivityIds.length > 0) {
    excludeActivityIds = [];
    filtered = filterActivitiesByConstraints(allActs, {
      maxMinutes,
      excludeTypes,
      includeTypes,
      excludeActivityIds: [],
    });
    moodFitting = filtered.filter((a) => (a.mood_fit?.[mood] ?? 0) >= 1);
    relaxationNote = 'I kept some of your earlier options so you still have 3 choices.';
  }

  // If still fewer than 3, relax constraint 2: maxMinutes
  if (moodFitting.length < 3 && typeof maxMinutes === 'number') {
    maxMinutes = null;
    filtered = filterActivitiesByConstraints(allActs, {
      maxMinutes: null,
      excludeTypes,
      includeTypes,
      excludeActivityIds,
    });
    moodFitting = filtered.filter((a) => (a.mood_fit?.[mood] ?? 0) >= 1);
    relaxationNote = 'I included a few slightly longer practices so you have 3 suitable options.';
  }

  // If still fewer than 3, relax constraint 3: excludeTypes & includeTypes
  if (moodFitting.length < 3 && (excludeTypes.length > 0 || includeTypes.length > 0)) {
    excludeTypes = [];
    includeTypes = [];
    filtered = filterActivitiesByConstraints(allActs, {
      maxMinutes: null,
      excludeTypes: [],
      includeTypes: [],
      excludeActivityIds,
    });
    moodFitting = filtered.filter((a) => (a.mood_fit?.[mood] ?? 0) >= 1);
    relaxationNote = 'I included other activity types to ensure you have 3 recommendations.';
  }

  // If somehow still fewer than 3, fallback to all activities
  if (filtered.length < 3) {
    filtered = allActs;
    relaxationNote = 'I relaxed your filters so you have 3 recommendations to choose from.';
  }

  // Now rank the filtered activities
  const recommendations = rankActivities(mood, feedbackMap, recentSessions, {
    ...options,
    maxMinutes: undefined,
    excludeTypes: undefined,
    includeTypes: undefined,
    excludeActivityIds: undefined,
    allActivities: filtered,
  });

  return {
    recommendations,
    relaxationNote,
    appliedConstraints: {
      maxMinutes,
      excludeTypes,
      includeTypes,
      excludeActivityIds,
    },
  };
}

/**
 * Main rules-based recommendation function.
 * Pure function: no DB calls inside.
 * Returns exactly 3 recommendations with warm, non-clinical reasons and personalised_by: "rules".
 */
export function rankActivities(
  mood: Mood,
  feedbackMap?:
    | Map<string, Rating>
    | Record<string, Rating>
    | LatestActivityFeedback[]
    | null,
  recentSessions?:
    | Session[]
    | { activity_id: string; completed?: boolean | number; completed_at?: string | null; started_at?: string }[]
    | null,
  options?: RankOptions | Theme[]
): Recommendation[] {
  // If constraint options are present and not already filtered, route through rankActivitiesWithConstraints
  if (
    options &&
    !Array.isArray(options) &&
    (options.maxMinutes !== undefined ||
      options.excludeTypes !== undefined ||
      options.includeTypes !== undefined ||
      options.excludeActivityIds !== undefined)
  ) {
    return rankActivitiesWithConstraints(mood, feedbackMap, recentSessions, options).recommendations;
  }

  const limit = (options && !Array.isArray(options) && options.limit) || 3;
  const disableDiversityCap =
    (options && !Array.isArray(options) && options.disableDiversityCap) || false;
  const scored = scoreCandidates(mood, feedbackMap, recentSessions, options);

  if (disableDiversityCap) {
    const valid = scored.filter((s) => (s.activity.mood_fit?.[mood] ?? 0) >= 1).slice(0, limit);
    return valid.map((item) => ({
      activity: item.activity,
      reason: generateTemplatedReason(
        item.activity,
        mood,
        item.rating,
        item.isMoodMatch,
        item.matchedTheme
      ),
      personalised_by: 'rules',
    }));
  }

  const topItems = selectDiverseTopThree(scored, mood);

  return topItems.slice(0, limit).map((item) => ({
    activity: item.activity,
    reason: generateTemplatedReason(
      item.activity,
      mood,
      item.rating,
      item.isMoodMatch,
      item.matchedTheme
    ),
    personalised_by: 'rules',
  }));
}
