import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeOrderLinks } from '@/lib/shein-links';
import { Order, GoodItem } from '@/lib/types';
import { getRequestSession } from '@/lib/auth-security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || undefined;
    const userEmail = searchParams.get('userEmail') || undefined;
    const userPhone = searchParams.get('userPhone') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const requestedAdmin = searchParams.get('admin') === 'true';
    const session = await getRequestSession(req);

    // If admin view is requested, strictly enforce administrator privileges
    if (requestedAdmin) {
      if (!session || session.role !== 'admin') {
        return NextResponse.json(
          { error: 'Unauthorized: Administrator privileges required.' },
          {
            status: 401,
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          }
        );
      }

      const orders = await db.getOrders({ userId, userEmail, userPhone, status, search });
      return NextResponse.json(
        { success: true, data: orders },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }
      );
    }

    // Unauthenticated callers cannot enumerate customer orders
    if (!session) {
      return NextResponse.json(
        { success: true, data: [] },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }
      );
    }

    // Authenticated admin can query with any custom filter
    if (session.role === 'admin') {
      const orders = await db.getOrders({ userId, userEmail, userPhone, status, search });
      return NextResponse.json(
        { success: true, data: orders },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }
      );
    }

    // Authenticated customer: strictly bind query to their own authenticated identity
    const orders = await db.getOrders({
      userId: session.userId,
      userEmail: session.email,
      status,
      search,
    });

    return NextResponse.json(
      { success: true, data: orders },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      userId,
      userName,
      userEmail,
      userPhone,
      shippingAddress,
      customerNotes,
      notes,
      rawInput,
      extractedLink,
      cartShareCode,
      cartGroupId,
      cartCoverImage,
      items,
      dynamicFeePercent,
    } = body;

    if (!rawInput || !extractedLink || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Order must include extracted link and at least one good.' },
        { status: 400 }
      );
    }

    if (!userName || !userName.trim() || !userPhone || !userPhone.trim() || !shippingAddress || !shippingAddress.trim()) {
      return NextResponse.json(
        { error: 'Customer Name, Phone number, and Shipping Address are mandatory.' },
        { status: 400 }
      );
    }

    const settings = await db.getSettings();
    // Unified system-wide Service & Delivery Fee % from settings
    const feePercent = typeof settings.dynamicFeePercent === 'number' ? settings.dynamicFeePercent : 0;

    // Calculate totals accurately
    const itemsSubtotal = items.reduce((sum: number, it: GoodItem) => {
      const q = Math.max(1, it.quantity || 1);
      const p = it.originalPrice || 0;
      it.subtotal = q * p;
      return sum + it.subtotal;
    }, 0);

    const dynamicFeeAmount = Math.round(itemsSubtotal * (feePercent / 100));
    const shippingFee = settings.flatShippingFee || 0;
    const totalCash = itemsSubtotal + dynamicFeeAmount + shippingFee;

    const orderId = body.id || `SH-${Math.floor(10000 + Math.random() * 90000)}`;

    if (body.id) {
      const existing = await db.getOrderById(body.id);
      if (
        existing &&
        (existing.isPriceLocked ||
          existing.status !== 'PENDING_APPROVAL' ||
          existing.reviewedAt)
      ) {
        console.warn(`[POST /api/orders] Protected approved/locked order ${body.id} from recreation.`);
        return NextResponse.json({ success: true, data: existing }, { status: 200 });
      }
    }

    const session = await getRequestSession(req);
    const resolvedUserId = session?.userId || userId || 'guest-user';
    const resolvedEmail = session?.email || userEmail || 'customer@example.com';
    const resolvedName = userName.trim() || session?.name || 'عميل شي إن';

    const newOrder: Order = normalizeOrderLinks({
      id: orderId,
      userId: resolvedUserId,
      userName: resolvedName,
      userEmail: resolvedEmail,
      userPhone: userPhone.trim(),
      shippingAddress: shippingAddress.trim(),
      customerNotes: (customerNotes || notes || '').trim() || undefined,
      rawInput,
      extractedLink,
      cartShareCode,
      cartGroupId,
      cartCoverImage,
      items,
      itemsCount: items.length,
      itemsSubtotal,
      dynamicFeePercent: feePercent,
      dynamicFeeAmount,
      shippingFee,
      totalCash,
      currency: 'EGP',
      status: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const created = await db.createOrder(newOrder);

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create order' }, { status: 500 });
  }
}
