import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestSession } from '@/lib/auth-security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const order = await db.getOrderById(id);

    if (!order) {
      return NextResponse.json({ error: 'الطلب غير موجود (Order not found)' }, { status: 404 });
    }

    const session = await getRequestSession(req);
    if (session && session.role !== 'admin') {
      const isOwner =
        session.userId === order.userId ||
        session.email.toLowerCase() === (order.userEmail || '').toLowerCase();
      if (!isOwner) {
        return NextResponse.json(
          { error: 'Forbidden: You cannot cancel orders that do not belong to you.' },
          { status: 403 }
        );
      }
    }

    // Orders already paid or completed cannot be cancelled unilaterally
    if (['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status)) {
      return NextResponse.json(
        { error: 'لا يمكن إلغاء الطلب بعد سداده مباشرة. يرجى التواصل مع الدعم وخدمة العملاء.' },
        { status: 400 }
      );
    }

    // Orders under review with payment proof submitted
    if (order.status === 'PAYMENT_UNDER_REVIEW') {
      return NextResponse.json(
        { error: 'تم إرسال إيصال الدفع وهو قيد المطابقة. يرجى التواصل مع المشرف لإلغاء الدفع واسترداد المبلغ.' },
        { status: 400 }
      );
    }

    if (order.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'هذا الطلب ملغي بالفعل.' },
        { status: 400 }
      );
    }

    let reason = 'تم إلغاء الطلب بناءً على رغبة العميل قبل إتمام الدفع';
    try {
      const body = await req.json();
      if (body && typeof body.reason === 'string' && body.reason.trim()) {
        reason = body.reason.trim();
      }
    } catch {
      // Empty body is okay
    }

    const updated = await db.updateOrder(id, {
      status: 'CANCELLED',
      cancelledAt: new Date().toISOString(),
      cancelledBy: 'customer',
      cancellationReason: reason,
    });

    return NextResponse.json({
      success: true,
      message: 'تم إلغاء الطلب بنجاح.',
      data: updated,
    });
  } catch (err: any) {
    console.error('Cancel order error:', err);
    return NextResponse.json(
      { error: err.message || 'فشل إلغاء الطلب. يرجى المحاولة مرة أخرى.' },
      { status: 500 }
    );
  }
}
