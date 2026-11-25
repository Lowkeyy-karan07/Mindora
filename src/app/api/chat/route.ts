import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkSafety } from '@/lib/safety';
import { getCheckinById, getLatestFeedbackPerActivity, getRecentSessions } from '@/lib/db';
import { detectThemes } from '@/lib/recommender/themes';
import { getAllActivities } from '@/lib/catalog';
import { rankActivities } from '@/lib/recommender/rules';
import { handleChatRefinement } from '@/lib/chat/ai';
import { Activity } from '@/types';

export const runtime = 'nodejs';

const chatRequestSchema = z.object({
  checkinId: z.string().min(1, 'checkinId is required'),
  message: z
    .string()
    .min(1, 'message is required')
    .max(300, 'message cannot exceed 300 characters'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(1000),
        personalised_by: z.enum(['ai', 'rules']).optional(),
      })
    )
    .max(6)
    .optional()
    .default([]),
  current_activity_ids: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parseResult = chatRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { checkinId, message, history, current_activity_ids } = parseResult.data;

    // 1. Safety check FIRST: If crisis detected, return safety: true, make NO Gemini call, store nothing
    const safetyCheck = checkSafety(message);
    if (safetyCheck.triggered) {
      return NextResponse.json({
        safety: true,
        reply: '',
        recommendations: [],
        personalised_by: 'rules',
      });
    }

    // 2. Load check-in's mood, note and detected themes (never accept from client)
    const checkin = getCheckinById(checkinId);
    if (!checkin) {
      return NextResponse.json({ error: 'Check-in not found' }, { status: 404 });
    }

    const { mood, note } = checkin;
    const detectedThemes = detectThemes(note || '');

    // 3. Load user context
    const feedback = getLatestFeedbackPerActivity(checkin.user_id, mood);
    const sessions = getRecentSessions(checkin.user_id, 20);

    // 4. Resolve current 3 activities
    const allActivities = getAllActivities();
    let currentActivities: Activity[] = [];

    if (current_activity_ids && Array.isArray(current_activity_ids) && current_activity_ids.length > 0) {
      currentActivities = current_activity_ids
        .map((id) => allActivities.find((a) => a.id === id))
        .filter((a): a is Activity => a !== undefined)
        .slice(0, 3);
    }

    if (currentActivities.length === 0) {
      const defaultRecs = rankActivities(mood, feedback, sessions, {
        detectedThemes,
        note,
      });
      currentActivities = defaultRecs.map((r) => r.activity);
    }

    // 5. Handle chat refinement
    const result = await handleChatRefinement({
      message,
      mood,
      note,
      themes: detectedThemes,
      currentActivities,
      history,
      feedbackMap: feedback,
      recentSessions: sessions,
    });

    if (result.safety) {
      return NextResponse.json({
        safety: true,
        reply: '',
        recommendations: [],
        personalised_by: 'rules',
      });
    }

    return NextResponse.json({
      reply: result.reply,
      now: result.now,
      next: result.next,
      constraints_relaxed: result.constraints_relaxed,
      recommendations: result.recommendations,
      personalised_by: result.personalised_by,
      relaxation_note: result.relaxation_note,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error processing chat adjustment' },
      { status: 500 }
    );
  }
}
