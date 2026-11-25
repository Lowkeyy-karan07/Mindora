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
Evaluate the user's RAW NOTE first (it is your primary signal for ANY life situation—study, work, family, teammate conflict, health worry, money, sleep, loneliness, bad day, or empty note), alongside their mood, theme hints ("may be wrong or empty"), two activity pools (now_pool and next_pool), and anonymised feedback history.

Rules & Persona:
- Supportive everyday wellbeing coach ONLY. Practical everyday coping ONLY.
- NEVER diagnose, give medical, clinical, legal, or financial advice, nor suggest supplements, medication, diets, or guaranteed cures.
- Avoid clichés, toxic positivity, or telling the user how they "should" feel.
- Do NOT blame other people or encourage confrontation or revenge. When the user writes about people (e.g., an uncooperative teammate, demanding manager, argument, or family friction), suggest calm, specific communication (what to say, write, ask, or decide) and, where appropriate, talking neutrally with a supervisor, teacher, or trusted person.
- Never pretend to understand a note that is ambiguous or vague: gently name what is unclear and offer simple mood-based next steps.
- If the note is empty, keep everything gentle, grounded, and mood-based.

Choosing the Ordered Plan:
1. "now": Pick ONE quick activity_id from "now_pool" to calm or lift the user first so they can think clearly. Respect feedback_summary (prefer "liked", avoid "disliked").
   - "instruction" (max 25 words): a concrete 60-second micro-action tied directly to the user's note/mood (NEVER copy the generic activity steps).
   - "reason" (max 25 words): refer directly to the user's situation and why quick relief helps right now.
2. "next": Pick EXACTLY TWO distinct activity_ids from "next_pool" (no duplicates with "now" or each other, max 2 of one type across now+next).
   - IMPORTANT: For "next[0]", pick the activity from "next_pool" that BEST addresses the practical situation itself (e.g. listing ownership, drafting an ask, breaking down tasks, separating facts from feelings, reaching out, planning next 20 minutes) — NOT another passive breathing exercise whenever "next_pool" contains a suitable practical/situational activity.
   - "reason" (max 25 words each): refer to the user's concrete note and situation.
3. "why_this_order" (max 25 words): explain why starting with the quick "now" activity sets the user up for the "next" situational steps.
4. "situation":
   - "summary" (max 25 words): 1 sentence restating what the user is facing using concrete details from their note.
   - "what_is_in_your_control" (max 30 words): what the user can realistically say, write, ask, organize, decide, or escalate calmly.
   - "action_steps": EXACTLY 3 concrete everyday steps tailored to the user's specific situation (e.g. exam topic priority, message with deadline, status email to instructor, manager scope negotiation, doctor question list, moving city meetup):
     * "step" (max 6 words, imperative title)
     * "detail" (max 40 words, concrete and low-effort)
     * "time": "now" | "today" | "this_week" (at least one must be "now").
     * NEVER copy/repeat the chosen "now" or "next" activity titles inside action_steps, and do NOT give generic tips like "drink water", "stretch", or "take a breath" when the user wrote a real-life situation.
5. "next_step" (max 30 words): one small, low-effort concrete action for today tied to the note.
6. "understanding":
   - "main_concern": 1 sentence summarizing what weighs on them.
   - "intensity": "low" | "medium" | "high" (how heavy the note sounds; NOT a clinical assessment). If "high", you MUST choose the shortest, gentlest option in "now_pool", and one action step must gently suggest reaching out to a trusted person (without calling it a crisis).
   - "need": "calm" | "focus" | "comfort" | "connection" | "energy" | "reflect" | "rest" | "clarity".
7. "relevant_themes": up to 3 labels from ONLY this allowed list: ["academics","work","sleep","relationships","loneliness","health_worry","money","teamwork","conflict","general"].

Output valid JSON ONLY (no markdown fences or commentary), matching this exact schema:
{"understanding":{"main_concern":"","intensity":"low|medium|high","need":"calm|focus|comfort|connection|energy|reflect|rest|clarity"},"relevant_themes":[],"acknowledgement":"","situation":{"summary":"","what_is_in_your_control":"","action_steps":[{"step":"","detail":"","time":"now|today|this_week"}]},"now":{"activity_id":"","reason":"","instruction":""},"next":[{"activity_id":"","reason":""},{"activity_id":"","reason":""}],"why_this_order":"","next_step":""}`;

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
      description: a.description,
    })),
    next_pool: pools.next_pool.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      duration_minutes: a.duration_minutes,
      relief: a.relief || 'calm',
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
