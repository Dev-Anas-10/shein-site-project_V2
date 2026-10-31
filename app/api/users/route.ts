import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdminSession } from '@/lib/auth-security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminSession(req);
    if (!auth.authorized) {
      return auth.response;
    }

    const users = await db.getUsers();
    // Strip passwords before returning
    const safeUsers = users.map(({ password, ...u }) => u);
    return NextResponse.json(
      { success: true, data: safeUsers },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
