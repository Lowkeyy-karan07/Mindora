export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { saveJournalEntry } from '@/lib/db';

const journalSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  prompt: z.string().min(1, 'prompt is required'),
  text: z.string().min(1, 'text is required'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = journalSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid journal entry data', issues: result.error.issues },
        { status: 400 }
      );
    }

    // Do NOT log journal text for privacy
    const { sessionId, prompt, text } = result.data;
    const journalEntry = saveJournalEntry({ sessionId, prompt, text });

    return NextResponse.json({ journalEntry });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
