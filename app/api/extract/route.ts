import { NextRequest, NextResponse } from 'next/server';
import { extractSheinGoods, extractSheinUrl } from '@/lib/shein-extractor';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawInput = body.text || body.url;

    if (!rawInput || typeof rawInput !== 'string') {
      return NextResponse.json(
        { error: 'Please provide the SHEIN cart link or share message.' },
        { status: 400 }
      );
    }

    const cleanLink = extractSheinUrl(rawInput);
    if (!cleanLink) {
      return NextResponse.json(
        {
          error:
            'Could not find a valid SHEIN link in your text. Make sure it contains a link like https://onelink.shein.com/... or https://shein.com/...',
        },
        { status: 400 }
      );
    }

    // Dynamic Pricing: Admin controlled SAR rate & Profit Margin %
    const settings = await db.getSettings();
    // Unified system-wide Service & Delivery Fee % from settings
    const dynamicFeePercent = typeof settings.dynamicFeePercent === 'number'
      ? settings.dynamicFeePercent
      : 0;

    const sarToEgpRate = typeof body.sarToEgpRate === 'number'
      ? body.sarToEgpRate
      : (settings.sarToEgpRate || 15.0);

    const profitMarginPercent = typeof body.profitMarginPercent === 'number'
      ? body.profitMarginPercent
      : (settings.profitMarginPercent ?? 10.0);

    const estimatedSubtotal = typeof body.estimatedSubtotal === 'number'
      ? body.estimatedSubtotal
      : (typeof body.estimatedSubtotal === 'string' && !isNaN(Number(body.estimatedSubtotal)))
      ? Number(body.estimatedSubtotal)
      : undefined;

    const estimatedItemsCount = typeof body.estimatedItemsCount === 'number'
      ? body.estimatedItemsCount
      : (typeof body.estimatedItemsCount === 'string' && !isNaN(Number(body.estimatedItemsCount)))
      ? Number(body.estimatedItemsCount)
      : undefined;

    const extracted = await extractSheinGoods(
      rawInput,
      dynamicFeePercent,
      estimatedSubtotal,
      estimatedItemsCount,
      sarToEgpRate,
      profitMarginPercent
    );

    return NextResponse.json({
      success: true,
      products: extracted.sheinProducts || [],
      data: extracted,
    });
  } catch (err: any) {
    console.error('Extract API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to extract goods from SHEIN link' },
      { status: 500 }
    );
  }
}
