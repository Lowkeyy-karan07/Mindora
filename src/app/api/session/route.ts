export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession, getDb } from '@/lib/db';
import { getActivityById } from '@/lib/catalog';

const sessionSchema = z.object({
  checkinId: z.string().optional().nullable(),
  activityId: z.string().min(1, 'activityId is required'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = sessionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid session data', issues: result.error.issues },
        { status: 400 }
      );
    }

    const { checkinId, activityId } = result.data;
    const session = createSession({ checkinId, activityId });

    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const db = getDb();
    const sessionRow = db
      .prepare(`SELECT * FROM sessions WHERE id = ?`)
      .get(id) as
      | {
          id: string;
          user_id: string;
          checkin_id: string | null;
          activity_id: string;
          started_at: string;
          completed_at: string | null;
          completed: number;
        }
      | undefined;

    if (!sessionRow) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const activity = getActivityById(sessionRow.activity_id);

    return NextResponse.json({
      session: {
        id: sessionRow.id,
        user_id: sessionRow.user_id,
        checkin_id: sessionRow.checkin_id,
        activity_id: sessionRow.activity_id,
        started_at: sessionRow.started_at,
        completed_at: sessionRow.completed_at,
        completed: Boolean(sessionRow.completed),
      },
      activity,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
