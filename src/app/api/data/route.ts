export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { deleteAllUserData } from '@/lib/db';

export async function DELETE() {
  try {
    deleteAllUserData();
    return NextResponse.json({
      success: true,
      message: 'All user data deleted successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
