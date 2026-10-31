import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PaymentDetails } from '@/lib/types';
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
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const session = await getRequestSession(req);
    if (session && session.role !== 'admin') {
      const isOwner =
        session.userId === order.userId ||
        session.email.toLowerCase() === (order.userEmail || '').toLowerCase();
      if (!isOwner) {
        return NextResponse.json(
          { error: 'Forbidden: You cannot submit payment for orders that do not belong to you.' },
          { status: 403 }
        );
      }
    }

    // Check pricing validity window (1 hour)
    const now = Date.now();
    const expiryTime = order.pricingExpiresAt
      ? new Date(order.pricingExpiresAt).getTime()
      : order.reviewedAt
      ? new Date(order.reviewedAt).getTime() + 60 * 60 * 1000
      : new Date(order.updatedAt || order.createdAt).getTime() + 60 * 60 * 1000;

    if (order.status === 'CANCELLED' || (order.status === 'APPROVED_PENDING_PAYMENT' && now > expiryTime)) {
      if (order.status !== 'CANCELLED') {
        await db.updateOrder(id, {
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
          cancelledBy: 'system',
          cancellationReason: 'انتهت مهلة صلاحية السعر المعتمد (ساعة واحدة) دون إتمام الدفع',
        });
      }
      return NextResponse.json(
        {
          error:
            'نعتذر، انتهت مهلة سداد هذا الطلب (ساعة واحدة من وقت الاعتماد) أو تم إلغاؤه. لا يمكن قبول السداد بالأسعار القديمة. يرجى إنشاء طلب جديد.',
        },
        { status: 400 }
      );
    }

    if (order.status !== 'APPROVED_PENDING_PAYMENT') {
      return NextResponse.json(
        { error: `Payment cannot be submitted while order status is ${order.status}` },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { method, senderIdentifier, transactionReference, receiptImage } = body;

    if (!method || !['instapay', 'vodafone_cash'].includes(method)) {
      return NextResponse.json(
        { error: 'Valid payment method (instapay or vodafone_cash) is required.' },
        { status: 400 }
      );
    }

    if (!senderIdentifier || typeof senderIdentifier !== 'string') {
      return NextResponse.json(
        { error: 'Please provide your sender phone number or InstaPay address.' },
        { status: 400 }
      );
    }

    const payment: PaymentDetails = {
      method,
      senderIdentifier: senderIdentifier.trim(),
      transactionReference: transactionReference?.trim() || undefined,
      receiptImage: receiptImage || undefined,
      submittedAt: new Date().toISOString(),
    };

    const updated = await db.updateOrder(id, {
      payment,
      status: 'PAYMENT_UNDER_REVIEW',
    });

    return NextResponse.json({
      success: true,
      message: 'Payment proof submitted successfully and is now under review.',
      data: updated,
    });
  } catch (err: any) {
    console.error('Submit payment error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to submit payment details' },
      { status: 500 }
    );
  }
}
