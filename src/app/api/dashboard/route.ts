export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getDashboardData } from '@/lib/db';

export async function GET() {
  try {
    const dashboardData = getDashboardData();
    return NextResponse.json(dashboardData);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
