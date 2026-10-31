import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { GoodItem, OrderStatus } from '@/lib/types';
import { getRequestSession, requireAdminSession } from '@/lib/auth-security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RouteContext {
  params: Promise<{ id: string }>;
}

function maskString(str?: string, visibleChars = 3): string {
  if (!str) return '';
  if (str.length <= visibleChars) return '***';
  return str.slice(0, visibleChars) + '****' + str.slice(-2);
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const order = await db.getOrderById(id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const session = await getRequestSession(req);

    // If caller is an administrator, return the full order
    if (session?.role === 'admin') {
      return NextResponse.json(
        { success: true, data: order },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }
      );
    }

    // If caller is the authenticated owner of the order, return the full order
    const isOwner =
      session &&
      (session.userId === order.userId ||
        session.email.toLowerCase() === (order.userEmail || '').toLowerCase());

    if (isOwner) {
      return NextResponse.json(
        { success: true, data: order },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }
      );
    }

    // If an authenticated user attempts to access another user's order: Forbidden
    if (session && !isOwner) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this order.' },
        {
          status: 403,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    // For unauthenticated visitors with the order link, mask customer PII to prevent scraping
    const maskedOrder = {
      ...order,
      userPhone: maskString(order.userPhone, 4),
      userEmail: maskString(order.userEmail, 3),
      shippingAddress: maskString(order.shippingAddress, 6),
    };

    return NextResponse.json(
      { success: true, data: maskedOrder },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await getRequestSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to modify order.' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const existing = await db.getOrderById(id);

    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const body = await req.json();

    // Check if the request contains administrator-only operations
    const isAdminFieldRequested =
      body.status !== undefined ||
      body.paymentStatus !== undefined ||
      body.items !== undefined ||
      body.shipmentId !== undefined ||
      body.shipmentCode !== undefined ||
      body.dynamicFeePercent !== undefined ||
      body.shippingFee !== undefined ||
      body.pricingExpiresAt !== undefined ||
      body.adminComment !== undefined ||
      body.rejectionReason !== undefined ||
      body.tracking !== undefined ||
      body.adminPaymentNote !== undefined;

    if (isAdminFieldRequested && session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can update order status, pricing, and fulfillment.' },
        { status: 403 }
      );
    }

    const isOwner =
      session.userId === existing.userId ||
      session.email.toLowerCase() === (existing.userEmail || '').toLowerCase();

    if (!isOwner && session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: You cannot modify orders that do not belong to you.' },
        { status: 403 }
      );
    }

    const updates: any = {};

    // Status updates (approve, reject, processing, etc.) - Admin only
    if (body.status && session.role === 'admin') {
      updates.status = body.status as OrderStatus;
      if (body.status === 'APPROVED_PENDING_PAYMENT') {
        const settings = await db.getSettings();
        updates.reviewedBy = body.reviewedBy || session.name || 'Admin';
        updates.reviewedAt = new Date().toISOString();
        updates.pricingExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        updates.isPriceLocked = true;
        updates.exchangeRateUsed = settings.sarToEgpRate ?? 15.0;
        updates.profitMarginPercentUsed = settings.profitMarginPercent ?? 10.0;
      }
      if (body.status === 'CANCELLED') {
        updates.cancelledAt = new Date().toISOString();
        updates.cancelledBy = body.cancelledBy || 'admin';
        updates.cancellationReason = body.cancellationReason || 'تم إلغاء الطلب من قبل الإدارة';
      }
    }

    // General order comment by admin
    if (body.adminComment !== undefined && session.role === 'admin') {
      updates.adminComment = body.adminComment;
    }

    if (body.rejectionReason !== undefined && session.role === 'admin') {
      updates.rejectionReason = body.rejectionReason;
    }

    // Shipment batch assignment - Admin only
    if (body.shipmentId !== undefined && session.role === 'admin') {
      updates.shipmentId = body.shipmentId ? String(body.shipmentId) : null;
      updates.shipmentCode = body.shipmentCode ? String(body.shipmentCode) : null;
    }

    // Dynamic fee adjustments - Admin only
    if (typeof body.dynamicFeePercent === 'number' && session.role === 'admin') {
      updates.dynamicFeePercent = body.dynamicFeePercent;
    }

    if (typeof body.shippingFee === 'number' && session.role === 'admin') {
      updates.shippingFee = body.shippingFee;
    }

    if (body.pricingExpiresAt && session.role === 'admin') {
      updates.pricingExpiresAt = body.pricingExpiresAt;
    }

    // Goods items review - Admin only
    if (Array.isArray(body.items) && session.role === 'admin') {
      const validatedItems: GoodItem[] = body.items.map((it: any) => {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const price = Number(it.originalPrice) || 0;
        const retail =
          typeof it.originalPriceBeforeDiscount === 'number'
            ? it.originalPriceBeforeDiscount
            : it.originalPriceBeforeDiscount
            ? Number(it.originalPriceBeforeDiscount)
            : undefined;
        let discountPercent = typeof it.discountPercent === 'number' ? it.discountPercent : undefined;
        if (retail && retail > price) {
          discountPercent = Math.round(((retail - price) / retail) * 100);
        } else if (retail && retail <= price) {
          discountPercent = undefined;
        }

        return {
          ...it,
          status: it.status || 'available',
          quantity: qty,
          originalPrice: price,
          originalPriceBeforeDiscount: retail,
          discountPercent,
          subtotal: qty * price,
          adminComment: it.adminComment || undefined,
        };
      });
      updates.items = validatedItems;
    }

    // Tracking updates from admin
    if (body.tracking && session.role === 'admin') {
      updates.tracking = {
        ...(existing.tracking || {}),
        ...body.tracking,
      };
    }

    // Payment status update from admin
    if (body.paymentStatus && existing.payment && session.role === 'admin') {
      if (body.paymentStatus === 'VERIFIED') {
        updates.status = 'PAID';
        updates.reviewedBy = session.name || 'Admin';
        updates.payment = {
          ...existing.payment,
          adminNote: body.adminPaymentNote || 'تم تأكيد استلام التحويل واعتماد الدفع بنجاح',
        };
        updates.tracking = {
          ...(existing.tracking || {}),
          currentStep: 1,
          history: [
            ...(existing.tracking?.history || []),
            {
              status: 'PAID',
              title: 'تم تأكيد الدفع بنجاح',
              description: 'تم التحقق من التحويل من قبل المشرف وبدء معالجة الطلب.',
              timestamp: new Date().toISOString(),
            },
          ],
        };
      } else if (body.paymentStatus === 'REJECTED') {
        updates.status = 'APPROVED_PENDING_PAYMENT'; // reset so user can submit again
        updates.reviewedBy = session.name || 'Admin';
        updates.payment = {
          ...existing.payment,
          adminNote:
            body.adminPaymentNote ||
            'بيانات التحويل غير مطابقة أو لم تصل. يرجى التأكد وإعادة الإرسال.',
        };
      }
    }

    // Allowed customer fields for non-admin owner
    if (body.customerNotes !== undefined) {
      updates.customerNotes = typeof body.customerNotes === 'string' ? body.customerNotes.trim() : '';
    }
    if (body.shippingAddress !== undefined && typeof body.shippingAddress === 'string' && body.shippingAddress.trim()) {
      updates.shippingAddress = body.shippingAddress.trim();
    }
    if (body.userPhone !== undefined && typeof body.userPhone === 'string' && body.userPhone.trim()) {
      updates.userPhone = body.userPhone.trim();
    }

    const updated = await db.updateOrder(id, updates);

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    console.error('Update order error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update order' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdminSession(req);
    if (!auth.authorized) {
      return auth.response;
    }

    const { id } = await context.params;
    const ok = await db.deleteOrder(id);
    if (!ok) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Order deleted' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete order' }, { status: 500 });
  }
}
