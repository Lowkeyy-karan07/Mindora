export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { MOODS } from '@/types';
import { checkSafety } from '@/lib/safety';
import { createCheckin } from '@/lib/db';
import { recommend } from '@/lib/recommender';

const checkinSchema = z.object({
  mood: z.enum(MOODS),
  note: z.string().max(300).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = checkinSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid check-in data', issues: result.error.issues },
        { status: 400 }
      );
    }

    const { mood, note } = result.data;

    // Run checkSafety FIRST before storing or processing anything
    if (note) {
      const safetyCheck = checkSafety(note);
      if (safetyCheck.triggered) {
        // Return immediately without storing check-in, note, or invoking recommender
        return NextResponse.json({ safety: true });
      }
    }

    // Safety clear: store checkin and generate ordered plan
    const checkin = createCheckin({ mood, note });
    const recResult = await recommend(mood, note);
    const plan = recResult.plan;
    const isAiPlan = Boolean(
      plan &&
        (plan.now.by === 'ai' ||
          plan.next.some((n) => n.by === 'ai') ||
          plan.situation_by === 'ai' ||
          plan.acknowledgement_by === 'ai')
    );

    return NextResponse.json({
      checkinId: checkin.id,
      plan,
      constraints_relaxed: recResult.constraints_relaxed ?? false,
      mode: isAiPlan ? 'ai' : 'rules',
      recommendations: recResult.recommendations,
      acknowledgement: recResult.acknowledgement,
      next_step: recResult.next_step,
      need: recResult.need,
      understanding: recResult.understanding,
      situation: recResult.situation,
      situation_by: recResult.situation_by,
      relevant_themes: recResult.relevant_themes,
      has_note: recResult.has_note ?? Boolean(note && note.trim().length > 0),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
