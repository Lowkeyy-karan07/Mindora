import { z } from 'zod';
import {
  Activity,
  ActivityType,
  ChatMessage,
  Mood,
  ParsedConstraints,
  PlanNextItem,
  PlanNowItem,
  Recommendation,
  Theme,
} from '@/types';
import { parseConstraints } from './intent';
import { scoreCandidates } from '../recommender/rules';
import { buildPools, buildRulesPlan, PoolConstraints } from '../recommender/plan';
import { checkSafety } from '../safety';
import { executeGeminiJsonCall, resolveModelName } from '../ai/gemini';

export const CHAT_SYSTEM_PROMPT = `You are a supportive wellbeing coach, not a therapist.
You only discuss the suggested activities and how to adjust them to fit the user's request and situation.
Never diagnose, never give medical advice.
If the user wants to talk about something unrelated or heavy, reply briefly and kindly and point back to the activities or to a trusted person.
Reply max 60 words, warm, specific, no clichés.
You must output valid JSON only in this exact schema:
{"reply":"","constraints":{"max_minutes":null,"exclude_types":[],"wants_swap":false}}`;

export const aiChatResponseSchema = z.object({
  reply: z.string().min(1).max(500),
  constraints: z.object({
    max_minutes: z.number().nullable().optional(),
    exclude_types: z.array(z.string()).optional().default([]),
    wants_swap: z.boolean().optional().default(false),
  }),
});

export function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '');
  }
  return cleaned.trim();
}

/**
 * Builds a calm, warm template reply for rules mode or fallback.
 */
export function buildTemplateReply(
  constraints: ParsedConstraints,
  mood: Mood,
  _theme: Theme | undefined,
  _currentActivities: Activity[],
  recommendations: Recommendation[],
  relaxationNote?: string
): string {
  const firstRec = recommendations[0];
  const firstAct = firstRec?.activity;
  let reply = '';

  if (constraints.wants_why) {
    if (firstRec) {
      const cleanReason = firstRec.reason.replace(/\.$/, '').toLowerCase();
      reply = `I suggested ${firstAct.title} first because ${cleanReason}. Your next activities support steady follow-through while feeling ${mood.toLowerCase()}.`;
    } else {
      reply = `These practices were selected to match your ${mood.toLowerCase()} mood and provide gentle, practical relief.`;
    }
  } else if (constraints.wants_steps) {
    if (firstAct && firstAct.steps && firstAct.steps.length > 0) {
      const stepText = firstAct.steps.map((s, i) => `${i + 1}. ${s}`).join(' ');
      reply = `Here are the steps for ${firstAct.title}: ${stepText}`;
    } else {
      reply = `To practice, select an activity card above and click "Start now" for guided step-by-step instructions.`;
    }
  } else if (constraints.wants_swap) {
    if (firstAct) {
      reply = `I've refreshed your options (Right now and Next). Take a look at ${firstAct.title}—it's a fresh choice suited for your moment.`;
    } else {
      reply = `I've updated your Right now and Next suggestions with fresh options tailored for your mood.`;
    }
  } else if (typeof constraints.max_minutes === 'number') {
    reply = `I've narrowed your Right now and Next choices to quick practices taking ${constraints.max_minutes} minutes or less.`;
  } else if (constraints.exclude_types.length > 0) {
    const excludedStr = constraints.exclude_types.join(' and ');
    reply = `I've removed ${excludedStr} exercises and updated your Right now and Next list with other ways to unwind.`;
  } else if (constraints.include_types.length > 0) {
    const includedStr = constraints.include_types.join(' and ');
    reply = `I've focused your Right now and Next recommendations on ${includedStr} activities.`;
  } else {
    reply = `I've adjusted your Right now and Next suggestions to better fit how you're feeling right now.`;
  }

  if (relaxationNote) {
    reply += ` Note: ${relaxationNote}`;
  }

  return reply;
}

export interface ChatRefinementParams {
  message: string;
  mood: Mood;
  note?: string | null;
  themes: Theme[];
  currentActivities: Activity[];
  history?: ChatMessage[];
  feedbackMap?: any;
  recentSessions?: any;
  timeoutMs?: number;
}

export interface ChatRefinementResult {
  reply: string;
  now?: PlanNowItem;
  next?: PlanNextItem[];
  constraints_relaxed?: boolean;
  recommendations: Recommendation[];
  personalised_by: 'ai' | 'rules';
  relaxation_note?: string;
  safety?: boolean;
}

function buildUpdatedNowAndNext(
  mood: Mood,
  themes: Theme[],
  note: string | null | undefined,
  feedbackMap: any,
  recentSessions: any,
  poolConstraints: PoolConstraints,
  bySource: 'ai' | 'rules'
): {
  now: PlanNowItem;
  next: PlanNextItem[];
  recommendations: Recommendation[];
  constraints_relaxed: boolean;
  relaxationNote?: string;
} {
  const scored = scoreCandidates(mood, feedbackMap, recentSessions, {
    detectedThemes: themes,
    note,
  });

  const pools = buildPools(mood, themes, scored, feedbackMap, poolConstraints);
  const rulesPlan = buildRulesPlan(mood, themes, note, pools);

  const now: PlanNowItem = {
    ...rulesPlan.now,
    by: bySource,
    personalised_by: bySource,
  };
  const next: PlanNextItem[] = rulesPlan.next.map((item) => ({
    ...item,
    by: bySource,
    personalised_by: bySource,
  }));

  const recommendations: Recommendation[] = [
    {
      activity: now.activity,
      reason: now.reason,
      personalised_by: bySource,
    },
    ...next.map((item) => ({
      activity: item.activity,
      reason: item.reason,
      personalised_by: bySource,
    })),
  ];

  const relaxationNote = pools.constraints_relaxed
    ? 'I loosened one filter slightly so your Right now and Next options stay balanced.'
    : undefined;

  return {
    now,
    next,
    recommendations,
    constraints_relaxed: pools.constraints_relaxed,
    relaxationNote,
  };
}

/**
 * Handles chat refinement:
 * - Re-runs buildPools with updated constraints and updates ONLY now and next.
 * - Never regenerates or mutates situation or later.
 * - Gemini request sends NO action steps and NO identifying info.
 * - Enforces 5s timeout and falls back cleanly with personalised_by: "rules".
 * - NEVER logs messages or notes.
 */
export async function handleChatRefinement(
  params: ChatRefinementParams
): Promise<ChatRefinementResult> {
  const {
    message,
    mood,
    note,
    themes,
    currentActivities,
    history = [],
    feedbackMap,
    recentSessions,
    timeoutMs = 5000,
  } = params;

  // 1. Safety check
  if (checkSafety(message).triggered) {
    return {
      reply: '',
      recommendations: [],
      personalised_by: 'rules',
      safety: true,
    };
  }

  // 2. Parse constraints with pure rules
  const ruleConstraints = parseConstraints(message);

  // 3. Fallback / Template execution helper
  const runRulesFallback = (): ChatRefinementResult => {
    const currentIds = currentActivities.map((a) => a.id);
    const updated = buildUpdatedNowAndNext(
      mood,
      themes,
      note,
      feedbackMap,
      recentSessions,
      {
        maxMinutes: ruleConstraints.max_minutes,
        excludeTypes: ruleConstraints.exclude_types,
        includeTypes: ruleConstraints.include_types,
        excludeActivityIds: ruleConstraints.wants_swap ? currentIds : [],
      },
      'rules'
    );

    const reply = buildTemplateReply(
      ruleConstraints,
      mood,
      themes[0],
      currentActivities,
      updated.recommendations,
      updated.relaxationNote
    );

    return {
      reply,
      now: updated.now,
      next: updated.next,
      constraints_relaxed: updated.constraints_relaxed,
      recommendations: updated.recommendations,
      personalised_by: 'rules',
      relaxation_note: updated.relaxationNote,
    };
  };

  const isDemoMode = process.env.DEMO_MODE === 'true';
  const apiKey = process.env.GEMINI_API_KEY;

  if (isDemoMode || !apiKey || apiKey.trim() === '') {
    return runRulesFallback();
  }

  // 4. Construct AI payload: NO action_steps, NO situation, NO user_id
  const payload = {
    mood,
    note: note ? note.trim().slice(0, 300) : null,
    themes,
    current_activities: currentActivities.slice(0, 3).map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      duration: a.duration_minutes,
    })),
    history: history.slice(-6).map((h) => ({
      role: h.role,
      content: h.content,
    })),
    user_message: message.trim().slice(0, 300),
  };

  const modelName = resolveModelName(process.env.GEMINI_MODEL);

  try {
    const callResult = await executeGeminiJsonCall({
      contents: JSON.stringify(payload),
      systemInstruction: CHAT_SYSTEM_PROMPT,
      model: modelName,
      timeoutMs,
      temperature: 0.6,
      maxOutputTokens: 1024,
    });

    if (!callResult.success) {
      return runRulesFallback();
    }

    const validation = aiChatResponseSchema.safeParse(callResult.data);
    if (!validation.success) {
      return runRulesFallback();
    }

    const { reply: aiReply, constraints: aiConstraints } = validation.data;
    if (checkSafety(aiReply).triggered) {
      return runRulesFallback();
    }

    // Merge AI constraints with rule constraints
    let mergedMaxMinutes: number | null = null;
    if (
      typeof ruleConstraints.max_minutes === 'number' &&
      typeof aiConstraints.max_minutes === 'number'
    ) {
      mergedMaxMinutes = Math.min(ruleConstraints.max_minutes, aiConstraints.max_minutes);
    } else if (typeof ruleConstraints.max_minutes === 'number') {
      mergedMaxMinutes = ruleConstraints.max_minutes;
    } else if (typeof aiConstraints.max_minutes === 'number') {
      mergedMaxMinutes = aiConstraints.max_minutes;
    }

    const validTypes = new Set<ActivityType>(['breathing', 'grounding', 'journaling', 'break']);
    const mergedExcludeTypes: ActivityType[] = Array.from(
      new Set([
        ...ruleConstraints.exclude_types,
        ...(aiConstraints.exclude_types || []).filter((t): t is ActivityType =>
          validTypes.has(t as ActivityType)
        ),
      ])
    );

    const mergedWantsSwap = ruleConstraints.wants_swap || Boolean(aiConstraints.wants_swap);
    const currentIds = currentActivities.map((a) => a.id);

    const updated = buildUpdatedNowAndNext(
      mood,
      themes,
      note,
      feedbackMap,
      recentSessions,
      {
        maxMinutes: mergedMaxMinutes,
        excludeTypes: mergedExcludeTypes,
        includeTypes: ruleConstraints.include_types,
        excludeActivityIds: mergedWantsSwap ? currentIds : [],
      },
      'ai'
    );

    let finalReply = aiReply.trim();
    if (updated.relaxationNote) {
      finalReply += ` Note: ${updated.relaxationNote}`;
    }

    return {
      reply: finalReply,
      now: updated.now,
      next: updated.next,
      constraints_relaxed: updated.constraints_relaxed,
      recommendations: updated.recommendations,
      personalised_by: 'ai',
      relaxation_note: updated.relaxationNote,
    };
  } catch {
    return runRulesFallback();
  }
}
