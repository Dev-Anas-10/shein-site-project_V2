import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdminSession } from '@/lib/auth-security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminSession(req);
    if (!auth.authorized) {
      return auth.response;
    }

    const body = await req.json();
    const { shipmentId, orderIds } = body;

    if (!shipmentId || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'shipmentId and an array of orderIds are required' }, { status: 400 });
    }

    const result = await db.assignOrdersToShipment(shipmentId, orderIds);
    if (!result) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to assign orders to shipment' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdminSession(req);
    if (!auth.authorized) {
      return auth.response;
    }

    const body = await req.json();
    const { shipmentId, orderIds } = body;

    if (!shipmentId || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'shipmentId and an array of orderIds are required' }, { status: 400 });
    }

    const result = await db.removeOrdersFromShipment(shipmentId, orderIds);
    if (!result) {
      return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to remove orders from shipment' }, { status: 500 });
  }
}
