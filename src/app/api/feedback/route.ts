export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { RATINGS } from '@/types';
import { saveFeedback } from '@/lib/db';

const feedbackSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  rating: z.enum(RATINGS),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = feedbackSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid feedback data', issues: result.error.issues },
        { status: 400 }
      );
    }

    const { sessionId, rating } = result.data;
    const feedback = saveFeedback({ sessionId, rating });

    return NextResponse.json({ feedback });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
