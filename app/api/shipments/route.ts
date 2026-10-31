import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Shipment, ShipmentStatus } from '@/lib/types';
import { getRequestSession, requireAdminSession } from '@/lib/auth-security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await getRequestSession(req);
    const isAdmin = session?.role === 'admin';

    const { searchParams } = new URL(req.url);
    const paymentStatusFilter = searchParams.get('paymentStatus'); // 'PAID' or null

    let shipments = await db.getShipments();

    // Ensure deduplication by ID
    const map = new Map<string, Shipment>();
    for (const s of shipments) {
      map.set(s.id, s);
    }
    shipments = Array.from(map.values());

    if (paymentStatusFilter === 'PAID') {
      shipments = shipments.filter(
        (s) => s.paymentStatus === 'PAID' || !s.paymentStatus // default to PAID if not specified
      );
    }

    // If caller is an admin, return full internal shipment details
    if (isAdmin) {
      return NextResponse.json(
        { success: true, data: shipments },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }
      );
    }

    // Public / non-admin callers (such as homepage batch indicator) get a sanitized representation
    // that omits sensitive order IDs and internal operator notes
    const sanitizedShipments = shipments.map((s) => ({
      id: s.id,
      code: s.code,
      status: s.status,
      maxItems: s.maxItems,
      maxOrders: s.maxOrders,
      // Provide array length equivalent for progress bar calculations without leaking actual order identifiers
      orderIds: new Array((s.orderIds || []).length).fill(''),
    }));

    return NextResponse.json(
      { success: true, data: sanitizedShipments },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch shipments' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminSession(req);
    if (!auth.authorized) {
      return auth.response;
    }

    const body = await req.json();

    if (!body.code || !body.code.trim()) {
      return NextResponse.json({ error: 'Shipment code or title is required' }, { status: 400 });
    }

    const id = body.id || `SHP-${Date.now().toString(36).toUpperCase()}`;

    const newShipment: Shipment = {
      id,
      code: body.code.trim(),
      status: (body.status as ShipmentStatus) || 'PREPARING',
      paymentStatus: body.paymentStatus === 'UNPAID' ? 'UNPAID' : 'PAID',
      maxItems: typeof body.maxItems === 'number' && body.maxItems > 0 ? body.maxItems : 50,
      maxOrders: typeof body.maxOrders === 'number' && body.maxOrders > 0 ? body.maxOrders : 15,
      carrier: body.carrier?.trim() || undefined,
      trackingNumber: body.trackingNumber?.trim() || undefined,
      trackingUrl: body.trackingUrl?.trim() || undefined,
      estimatedArrival: body.estimatedArrival?.trim() || undefined,
      notes: body.notes?.trim() || undefined,
      orderIds: Array.isArray(body.orderIds) ? body.orderIds : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await db.createShipment(newShipment);
    return NextResponse.json(
      { success: true, data: saved },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create shipment' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdminSession(req);
    if (!auth.authorized) {
      return auth.response;
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Shipment ID is required' }, { status: 400 });
    }

    const updated = await db.updateShipment(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, data: updated },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update shipment' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdminSession(req);
    if (!auth.authorized) {
      return auth.response;
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Shipment ID is required' }, { status: 400 });
    }

    const success = await db.deleteShipment(id);
    return NextResponse.json(
      { success },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete shipment' }, { status: 500 });
  }
}
