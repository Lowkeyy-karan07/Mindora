export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { completeSession } from '@/lib/db';

const completeSessionSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = completeSessionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid complete session request', issues: result.error.issues },
        { status: 400 }
      );
    }

    const { sessionId } = result.data;
    const session = completeSession(sessionId);

    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
