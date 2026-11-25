export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAiTelemetry } from '@/lib/ai/gemini';

export async function GET() {
  const isDemoMode = process.env.DEMO_MODE === 'true';
  const apiKey = process.env.GEMINI_API_KEY;

  const mode = !isDemoMode && Boolean(apiKey && apiKey.trim().length > 0) ? 'ai' : 'rules';
  const telemetry = getAiTelemetry();

  return NextResponse.json({
    mode,
    last_ai_call: telemetry.last_ai_call,
    note_sent: telemetry.note_sent,
  });
}
