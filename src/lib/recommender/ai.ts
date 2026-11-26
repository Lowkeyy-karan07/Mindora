import {
  Mood,
  Theme,
  WellbeingPlan,
} from '@/types';
import { checkSafety } from '../safety';
import {
  executeGeminiJsonCall,
  extractJson,
  stripCodeFences,
  resolveModelName,
  recordAiTelemetry,
} from '../ai/gemini';
import {
  PoolsResult,
  ValidatedPlanOutcome,
  buildRulesPlan,
  validatePlan,
} from './plan';

export { stripCodeFences, extractJson };

export interface FeedbackSummaryItem {
  rating: 'liked' | 'neutral' | 'disliked';
  times_done: number;
}

export interface AiPlanParams {
  mood: Mood;
  note?: string | null;
  detectedThemes?: Theme[];
  pools: PoolsResult;
  feedbackSummary?: Record<string, FeedbackSummaryItem>;
  timeoutMs?: number;
  diagnosticHook?: (info: string) => void;
}

export const PLAN_SYSTEM_PROMPT = `You are Mindora's supportive wellbeing coach, not a therapist.
Evaluate the user's RAW NOTE first — it is your primary signal for ANY unpredictable situation (3am insomnia before an exam, broken phone before a trip, family argument, sick pet, job interview in an hour, money worry, loneliness, bad day, or empty note). Read the ENTIRE note including time of day, urgency, constraints, and what the person is actually facing. Treat "detected_themes" ONLY as weak keyword hints that are frequently incomplete or wrong (for example, "3am, can't sleep, exam tomorrow" is a late-night sleep problem first, NOT time for a focus sprint).

Rules & Persona:
- Supportive everyday wellbeing coach ONLY. Practical everyday coping ONLY.
- NEVER diagnose, give medical, clinical, legal, or financial advice, nor suggest supplements, medication, diets, or guaranteed cures.
- Avoid clichés, toxic positivity, or telling the user how they "should" feel.
- Do NOT blame other people or encourage confrontation or revenge. When the user writes about people (e.g., an argument with family, uncooperative teammate, or demanding manager), suggest calm, specific communication and gentle perspective.
- If the note is ambiguous, vague, or you are unsure what it means (e.g., a single word like "tired"), briefly say you aren't sure what is behind it and give one small, safe mood-based step without inventing unmentioned topics.
- If the note is empty, keep everything gentle, grounded, and mood-based.

Choosing the Ordered Plan:
1. "understanding": Open-ended interpretation of the note:
   - "main_concern": 1 sentence summarizing what actually weighs on them.
   - "urgency": "low" | "medium" | "high" (how urgent or heavy the moment is; NOT a clinical assessment).
   - "time_context": e.g. "late night (3am), exam tomorrow", "1 hour before interview", "tonight", or "" if unspecified.
   - "constraints": array of active situational constraints (e.g. ["needs rest now", "short on time", "no working phone"]).
   - "what_not_to_suggest": array of concrete things that would be unhelpful or counterproductive right now (e.g. at 3am before an exam: ["studying", "caffeine", "screens", "new tasks", "focus sprint"]; 1 hour before an interview: ["starting new projects", "long journaling"]; after an argument: ["immediate confrontation", "angry texting"]).
   - "need": "calm" | "focus" | "comfort" | "connection" | "energy" | "reflect" | "rest" | "clarity".
   - If "urgency" is "high", pick the shortest, gentlest option in "now_pool", and ensure one action step gently mentions reaching out to someone trusted when appropriate.
2. "now": Pick ONE quick activity_id from "now_pool" to calm or lift the user first. The first suggestion MUST respect current constraints (rest at night, safety, time left) and NEVER contradict "what_not_to_suggest". Prefer "liked" and avoid "disliked" in feedback_summary.
   - "instruction" (max 25 words): a concrete 60-second micro-action tied directly to the user's note/mood/constraints (NEVER copy the generic activity steps).
   - "reason" (max 25 words): refer directly to the user's situation and why quick relief helps right now.
3. "next": Pick EXACTLY TWO distinct activity_ids from "next_pool" (no duplicates with "now" or each other, max 2 of one type across now+next). Never choose any activity contradicting "what_not_to_suggest" (and at late night / when unable to sleep, NEVER choose "work", "study", or "focus_sprint" activities).
   - Pick activities from "next_pool" that fit the real situation and constraints (e.g. sleep/parking worries at 3am; practical planning/drafting during the day; calming separation of facts from feelings after a fight).
   - "reason" (max 25 words each): refer to the user's concrete note and situation.
4. "why_this_order" (max 25 words): explain why starting with the quick "now" activity sets the user up for "next" given their constraints.
5. "situation":
   - "summary" (max 25 words): 1 sentence restating what the user is facing using concrete details from their note.
   - "what_is_in_your_control" (max 30 words): what the user can realistically do, prepare, pause, say, or decide right now.
   - "action_steps": EXACTLY 3 concrete everyday steps tailored to the user's specific situation and constraints:
     * "step" (max 6 words, imperative title)
     * "detail" (max 40 words, concrete and low-effort)
     * "time": "now" | "today" | "this_week" (at least one must be "now").
     * NEVER contradict "what_not_to_suggest", NEVER repeat chosen "now" or "next" activity titles, and do NOT give generic wellness tips (like "drink water", "stretch", or "take deep breaths") when the note is specific.
6. "next_step" (max 30 words): one small, low-effort concrete action for today/tonight tied to the note and constraints.
7. "relevant_themes": OPTIONAL informational tags only (can be [] if none apply cleanly; do NOT force the note into a closed category).

Output valid JSON ONLY (no markdown fences or commentary), matching this exact schema:
{"understanding":{"main_concern":"","urgency":"low|medium|high","time_context":"","constraints":[],"what_not_to_suggest":[],"need":"calm|focus|comfort|connection|energy|reflect|rest|clarity"},"relevant_themes":[],"acknowledgement":"","situation":{"summary":"","what_is_in_your_control":"","action_steps":[{"step":"","detail":"","time":"now|today|this_week"}]},"now":{"activity_id":"","reason":"","instruction":""},"next":[{"activity_id":"","reason":""},{"activity_id":"","reason":""}],"why_this_order":"","next_step":""}`;

function hasMinimalAiPlanShape(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;
  return Boolean(obj.now || obj.next || obj.situation || obj.understanding || obj.acknowledgement);
}

/**
 * Calls Google Gemini server-side once to evaluate the note and decide an ordered wellbeing plan.
 * Strictly validates output with validatePlan(), replacing only invalid parts with ranker/template choices.
 * Never logs notes, prompts, or responses (logs only failure categories).
 * Never calls Gemini if checkSafety triggered or in DEMO_MODE / missing key.
 */
export async function getAiPlan(
  params: AiPlanParams
): Promise<ValidatedPlanOutcome | null> {
  const {
    mood,
    note,
    detectedThemes = [],
    pools,
    feedbackSummary = {},
    timeoutMs = 8000,
  } = params;

  const hasNote = Boolean(note && note.trim().length > 0);

  // 1. Guard against demo mode or missing key
  const isDemoMode = process.env.DEMO_MODE === 'true';
  const apiKey = process.env.GEMINI_API_KEY;
  if (isDemoMode || !apiKey || apiKey.trim() === '') {
    return null;
  }

  // 2. Safety check: NEVER call Gemini if safety check triggered
  if (note && checkSafety(note).triggered) {
    return null;
  }

  // 3. Build privacy-preserving payload in strict input order:
  //    raw note -> mood -> detected themes (labelled hints) -> two pools -> anonymised feedback summary
  const payload = {
    raw_note: hasNote ? note!.trim().slice(0, 300) : 'empty (no note provided by user)',
    mood,
    detected_themes: {
      note: 'hints, may be wrong or empty',
      themes: detectedThemes,
    },
    now_pool: pools.now_pool.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      duration_minutes: a.duration_minutes,
      relief: a.relief || 'calm',
      tags: a.tags || [],
      description: a.description,
    })),
    next_pool: pools.next_pool.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      duration_minutes: a.duration_minutes,
      relief: a.relief || 'calm',
      tags: a.tags || [],
      description: a.description,
    })),
    feedback_summary: feedbackSummary,
  };

  const modelName = resolveModelName(process.env.GEMINI_MODEL);
  const rulesPlan = buildRulesPlan(mood, detectedThemes, note, pools);

  try {
    let validatedOutcome: ValidatedPlanOutcome | null = null;

    // 4. Timeout 8s, up to 1 retry on invalid JSON or unusable schema
    for (let attempt = 1; attempt <= 2; attempt++) {
      const callResult = await executeGeminiJsonCall({
        contents: JSON.stringify(payload),
        systemInstruction: PLAN_SYSTEM_PROMPT,
        model: modelName,
        timeoutMs,
        temperature: 0.6,
        maxOutputTokens: 2048,
      });

      if (!callResult.success) {
        if (params.diagnosticHook && callResult.errorSummary) {
          params.diagnosticHook(`[${callResult.category}] ${callResult.errorSummary}`);
        }
        if (
          callResult.category === 'timeout' ||
          callResult.category === 'quota' ||
          callResult.category === 'invalid key' ||
          callResult.category === 'truncated' ||
          callResult.category === 'request error'
        ) {
          console.warn('[AI Evaluation Error]', callResult.category);
          recordAiTelemetry(callResult.category, hasNote);
          return null;
        }
        // bad JSON or empty response on attempt 1: retry once
        if (attempt === 2) {
          console.warn('[AI Evaluation Error]', callResult.category);
          recordAiTelemetry(callResult.category, hasNote);
        }
        continue;
      }

      if (!hasMinimalAiPlanShape(callResult.data)) {
        if (attempt === 2) {
          console.warn('[AI Evaluation Error]', 'bad JSON');
          recordAiTelemetry('bad JSON', hasNote);
        }
        continue;
      }

      const candidateOutcome = validatePlan(callResult.data, {
        mood,
        note,
        detectedThemes,
        pools,
        rulesPlan,
      });

      if (candidateOutcome.any_ai_used) {
        validatedOutcome = candidateOutcome;
        break;
      } else if (attempt === 2) {
        console.warn('[AI Evaluation Error]', 'bad JSON');
        recordAiTelemetry('bad JSON', hasNote);
      }
    }

    if (!validatedOutcome) {
      return null;
    }

    recordAiTelemetry('ok', hasNote);
    return validatedOutcome;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    if (lower.includes('timeout')) {
      console.warn('[AI Evaluation Error]', 'timeout');
      recordAiTelemetry('timeout', hasNote);
    } else if (lower.includes('quota') || lower.includes('429')) {
      console.warn('[AI Evaluation Error]', 'quota');
      recordAiTelemetry('quota', hasNote);
    } else {
      console.warn('[AI Evaluation Error]', 'bad JSON');
      recordAiTelemetry('bad JSON', hasNote);
    }
    return null;
  }
}

export { validatePlan };
export type { ValidatedPlanOutcome };
