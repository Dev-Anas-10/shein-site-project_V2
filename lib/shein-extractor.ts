import { ExtractedCartResult, GoodItem, SheinCartProduct } from './types';
import { toUsableSheinUrl } from './shein-links';

// Regex to extract SHEIN URL from any conversational context or share message
export const SHEIN_URL_REGEX = /(?:https?:\/\/|sheinlink:\/\/)(?:[a-zA-Z0-9-]+\.)*(?:shein\.com|onelink\.shein\.com)[^\s<>"')]+/i;

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

export function extractSheinUrl(text: string): string | null {
  if (!text) return null;
  const match = text.match(SHEIN_URL_REGEX);
  if (match && match[0]) {
    let clean = match[0].trim();
    clean = clean.replace(/[.,;!?]+$/, '');
    return clean;
  }
  return null;
}

export interface SheinPageMetadata {
  title: string;
  description: string;
  image: string;
  shc?: string;
  groupId?: string;
  redirectUrl?: string;
  deeplink?: string;
  retailPrice?: number;
  salePrice?: number;
  currency?: string;
}

/**
 * Safely parses any number or price string/object from SHEIN JSON responses
 */
export function extractPriceValue(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'object') {
    if (val.amount !== undefined) return extractPriceValue(val.amount);
    if (val.value !== undefined) return extractPriceValue(val.value);
    if (val.price !== undefined) return extractPriceValue(val.price);
    if (val.usdAmount !== undefined) return extractPriceValue(val.usdAmount);
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Normalizes original and discounted sale prices, prevents inverted prices,
 * and calculates genuine discount percentage automatically.
 */
export function resolveItemPricing(
  rawRetailInput: any,
  rawSaleInput: any,
  sarToEgpRate: number = 15.0,
  profitMarginPercent: number = 10.0
): {
  sourceSalePrice: number;
  sourceRetailPrice: number;
  salePriceEgp: number;
  retailPriceEgp: number;
  discountPercent: number;
} {
  let retail = extractPriceValue(rawRetailInput);
  let sale = extractPriceValue(rawSaleInput);

  // If one is missing or 0, fall back to the other
  if (sale <= 0 && retail > 0) sale = retail;
  if (retail <= 0 && sale > 0) retail = sale;

  // Safeguard: Ensure retail (before discount) is not lower than sale (after discount)
  // If inverted in the data source, swap them so the higher is retail and the lower is sale
  if (retail > 0 && sale > 0 && retail < sale) {
    const tmp = retail;
    retail = sale;
    sale = tmp;
  }

  // Calculate discount percentage from genuine source prices
  let discountPercent = 0;
  if (retail > sale && retail > 0 && sale > 0) {
    discountPercent = Math.round(((retail - sale) / retail) * 100);
    // Boundary check
    if (discountPercent < 0) discountPercent = 0;
    if (discountPercent > 99) discountPercent = 99;
  }

  // Convert to EGP with the configured formula: (SAR * rate) + profit margin %
  const multiplier = sarToEgpRate * (1 + profitMarginPercent / 100);
  const salePriceEgp = Math.round(sale * multiplier);
  const retailPriceEgp = discountPercent > 0 ? Math.round(retail * multiplier) : salePriceEgp;

  return {
    sourceSalePrice: sale,
    sourceRetailPrice: retail,
    salePriceEgp,
    retailPriceEgp,
    discountPercent,
  };
}

// Fallback high-res, verified fashion product images (100% reliable, no 404s, CORS-friendly)
export const RELIABLE_FASHION_IMAGES = [
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=600&auto=format&fit=crop&q=80',
];

/**
 * Generate synthetic armorUuid cookie accepted by SHEIN BFF API
 */
export function mintArmorCookie(): string {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  let hex = '';
  while (hex.length < 50) hex += Math.floor(Math.random() * 16).toString(16);
  return `armorUuid=${stamp}${hex}`;
}

export function parseVariantAttr(attr?: string): { color: string; size: string } {
  if (!attr) return { color: 'حسب الاختيار', size: 'حسب الاختيار' };
  const parts = String(attr).split('/').map((s) => s.trim());
  if (parts.length >= 2) {
    return { color: parts[0] || 'حسب الاختيار', size: parts[1] || 'حسب الاختيار' };
  }
  return { color: parts[0] || 'حسب الاختيار', size: 'حسب الاختيار' };
}

export function formatImageUrl(url?: string): string {
  if (!url) return RELIABLE_FASHION_IMAGES[0];
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://m.shein.com${url}`;
  return url;
}

export interface ResolvedTarget {
  groupId: string;
  shc: string;
  localCountry: string;
  landingUrl: string;
}

/**
 * Resolves short onelink or deeplink to target parameters (groupId, shc, localCountry, landingUrl)
 */
export async function resolveSheinLink(inputUrl: string): Promise<ResolvedTarget> {
  let gid = '';
  let shc = '';
  let country = 'SA';

  // If input already has group_id query parameter
  try {
    const urlObj = new URL(inputUrl);
    if (urlObj.searchParams.get('group_id')) {
      gid = urlObj.searchParams.get('group_id') || '';
      shc = urlObj.searchParams.get('shc') || '';
      country = urlObj.searchParams.get('local_country') || 'SA';
    } else if (urlObj.searchParams.get('shc')) {
      shc = urlObj.searchParams.get('shc') || '';
    }
  } catch (e) {
    // ignore URL parse errors
  }

  // If already resolved from query params
  if (gid) {
    const landing = `https://m.shein.com/ar/cart/share/landing?group_id=${gid}&shc=${shc}&local_country=${country}&cart_share=1`;
    return { groupId: gid, shc, localCountry: country, landingUrl: landing };
  }

  // Fetch short onelink
  const firstRes = await fetch(inputUrl, {
    headers: {
      'User-Agent': MOBILE_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!firstRes.ok) {
    throw new Error(`SHEIN short link returned status ${firstRes.status}`);
  }

  const firstHtml = await firstRes.text();

  // Parse all input tags to extract deeplink or appjump url regardless of attribute ordering
  const inputTags = firstHtml.match(/<input\b[^>]*>/gi) || [];
  let appjump: string | null = null;

  for (const tag of inputTags) {
    // 1. Deeplink: <input id="deeplink" value="sheinlink://applink/share_receiver?data=...">
    if (/\bid=["']deeplink["']/i.test(tag)) {
      const vm = tag.match(/\bvalue=["']([^"']+)["']/i);
      if (vm && vm[1]) {
        const rawDl = vm[1].replace(/&amp;/g, '&');
        const dataMatch = rawDl.match(/data=([^&]+)/);
        if (dataMatch && dataMatch[1]) {
          try {
            const decoded = JSON.parse(decodeURIComponent(dataMatch[1]));
            if (decoded.group_id) gid = String(decoded.group_id);
            if (decoded.shc) shc = decoded.shc;
            if (decoded.local_country) country = decoded.local_country;
          } catch (err) {
            // ignore parse error
          }
        }
      }
    }

    // 2. Appjump: <input id="url" value="...">
    if (/\bid=["']url["']/i.test(tag) && !appjump) {
      const vm = tag.match(/\bvalue=["']([^"']+)["']/i);
      if (vm && vm[1]) {
        appjump = vm[1].replace(/&amp;/g, '&');
      }
    }
  }

  // If gid not in deeplink, fetch appjump URL
  if (!gid && appjump) {
    try {
      const jumpRes = await fetch(appjump, {
        headers: { 'User-Agent': MOBILE_UA, Accept: 'text/html,*/*' },
      });
      if (jumpRes.ok) {
        const jumpHtml = await jumpRes.text();
        const shareInfoMatch = jumpHtml.match(/var\s+shareInfo\s*=\s*(\{[\s\S]*?\})\s*;/);
        if (shareInfoMatch && shareInfoMatch[1]) {
          const info = JSON.parse(shareInfoMatch[1]);
          gid = String(info.id || info.shareId || '');
          if (info.localcountry) country = String(info.localcountry);
        }
      }
    } catch (err) {
      console.warn('Failed to resolve appjump URL:', err);
    }
  }

  if (!gid) {
    throw new Error('تعذر العثور على معرّف السلة (group_id) من هذا الرابط. قد يكون الرابط منتهياً.');
  }

  const landing = `https://m.shein.com/ar/cart/share/landing?group_id=${gid}&shc=${shc}&local_country=${country}&cart_share=1`;
  return { groupId: gid, shc, localCountry: country, landingUrl: landing };
}

/**
 * Fetches cart products from SHEIN BFF API
 */
export async function fetchSheinBffCart(
  target: ResolvedTarget,
  preferredCurrency: string = 'SAR'
): Promise<{ title: string; rawProducts: any[] }> {
  const cookie = mintArmorCookie();
  const endpoints = [
    `https://m.shein.com/ar/bff-api/order/cart/share/landing?_ver=1.1.8&_lang=ar`,
    `https://m.shein.com/bff-api/order/cart/share/landing?_ver=1.1.8&_lang=ar`,
  ];

  let lastError: any = null;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'User-Agent': MOBILE_UA,
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          origin: 'https://m.shein.com',
          referer: target.landingUrl,
          appcurrency: preferredCurrency,
          cookie: cookie,
        },
        body: JSON.stringify({
          groupId: String(target.groupId),
          localCountry: target.localCountry || 'SA',
          userLocalSizeCountry: '',
        }),
      });

      if (!res.ok) continue;

      const data = await res.json();
      if (data.code === '0' && data.info) {
        const info = data.info;
        const products = [
          ...(info.normalProducts || []),
          ...(info.outStock || []).map((x: any) => ({ ...x, soldOutStatus: 1 })),
        ];
        return {
          title: info.title || 'العناصر التي شاركها صديقك',
          rawProducts: products,
        };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('فشل جلب تفاصيل السلة من خوادم شي إن.');
}

/**
 * Scrapes metadata from a single product page or fallback page
 */
export async function scrapeSheinLinkMetadata(url: string): Promise<SheinPageMetadata> {
  const result: SheinPageMetadata = {
    title: 'SHEIN Shopping Cart Items',
    description: 'Shared items from SHEIN cart (Ready for checkout)',
    image: RELIABLE_FASHION_IMAGES[0],
  };

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': MOBILE_UA,
        'Accept-Language': 'ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (res.ok) {
      const html = await res.text();
      const titleMatch =
        html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        result.title = titleMatch[1].trim();
      }

      const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
      if (descMatch && descMatch[1]) {
        result.description = descMatch[1].trim();
      }

      const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1] && imgMatch[1].startsWith('http')) {
        result.image = imgMatch[1].trim();
      }

      // Extract JSON-LD product offers
      const jsonLdMatch = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonLdMatch) {
        for (const tag of jsonLdMatch) {
          try {
            const inner = tag.replace(/<\/?script[^>]*>/gi, '').trim();
            const parsed = JSON.parse(inner);
            const product = Array.isArray(parsed) ? parsed.find((x) => x && x['@type'] === 'Product') : (parsed && parsed['@type'] === 'Product' ? parsed : null);
            if (product && product.offers) {
              const offers = product.offers;
              const sale = parseFloat(offers.price || offers.lowPrice);
              const retail = parseFloat(offers.highPrice || offers.price);
              if (!isNaN(sale) && sale > 0) result.salePrice = sale;
              if (!isNaN(retail) && retail > 0) result.retailPrice = retail;
              if (offers.priceCurrency) result.currency = String(offers.priceCurrency);
            }
          } catch (e) {}
        }
      }

      // Fallback: check product:price meta tags
      if (!result.salePrice) {
        const metaPrice = html.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i);
        if (metaPrice && metaPrice[1]) {
          const val = parseFloat(metaPrice[1]);
          if (!isNaN(val) && val > 0) result.salePrice = val;
        }
        const metaRetail = html.match(/<meta[^>]+property=["']product:original_price:amount["'][^>]+content=["']([^"']+)["']/i);
        if (metaRetail && metaRetail[1]) {
          const val = parseFloat(metaRetail[1]);
          if (!isNaN(val) && val > 0) result.retailPrice = val;
        }
      }
    }
  } catch (err) {
    console.warn('Metadata scrape failed:', err);
  }

  return result;
}

/**
 * Main extraction function: Resolves SHEIN cart, calls BFF API, maps to JSON & GoodItem[]
 */
export async function extractSheinGoods(
  rawInput: string,
  dynamicFeePercent: number = 0,
  estimatedSubtotal?: number,
  estimatedItemsCount?: number,
  sarToEgpRate: number = 15.0,
  profitMarginPercent: number = 10.0
): Promise<ExtractedCartResult> {
  const extractedLink = extractSheinUrl(rawInput);
  if (!extractedLink) {
    throw new Error('يرجى لصق رابط صالح من شي إن (مثل رابط مشاركة السلة onelink.shein.com).');
  }

  try {
    // 1. Resolve short onelink to target cart
    const target = await resolveSheinLink(extractedLink);

    // 2. Fetch real products from SHEIN BFF API
    const { title, rawProducts } = await fetchSheinBffCart(target, 'SAR');

    if (!rawProducts || rawProducts.length === 0) {
      throw new Error('السلة المشاركة فارغة أو انتهت صلاحيتها في شي إن.');
    }

    // 3. Normalize products to user-specified JSON format with genuine prices & discount %
    const sheinProducts: SheinCartProduct[] = rawProducts.map((p: any) => {
      const retailRaw = p.retailPrice ?? p.retail_price ?? p.originPrice ?? p.origin_price ?? p.originalPrice ?? p.original_price;
      const saleRaw = p.salePrice ?? p.sale_price ?? p.currentPrice ?? p.current_price ?? p.price ?? p.unit_price;

      const pricing = resolveItemPricing(retailRaw, saleRaw, sarToEgpRate, profitMarginPercent);

      return {
        goods_id: String(p.goods_id || ''),
        goods_sn: String(p.goods_sn || ''),
        name: String(p.goods_name || ''),
        image: formatImageUrl(p.goods_img),
        original_price: pricing.sourceRetailPrice > 0 ? pricing.sourceRetailPrice.toFixed(2) : '',
        sale_price: pricing.sourceSalePrice > 0 ? pricing.sourceSalePrice.toFixed(2) : '',
        discount_percent: pricing.discountPercent > 0 ? pricing.discountPercent : undefined,
        currency: 'SAR',
        selected_variant: String(p.goodsAttr || ''),
        sku_code: String(p.sku_code || ''),
        sold_out: Boolean(p.soldOutStatus),
      };
    });

    // 4. Map to GoodItem[] in EGP using Dynamic Formula with verified original and discounted unit prices
    const items: GoodItem[] = rawProducts.map((p: any, idx: number) => {
      const sp = sheinProducts[idx];
      const { color, size } = parseVariantAttr(sp.selected_variant);

      const retailRaw = p.retailPrice ?? p.retail_price ?? p.originPrice ?? p.origin_price ?? p.originalPrice ?? p.original_price;
      const saleRaw = p.salePrice ?? p.sale_price ?? p.currentPrice ?? p.current_price ?? p.price ?? p.unit_price;

      const pricing = resolveItemPricing(retailRaw, saleRaw, sarToEgpRate, profitMarginPercent);

      const usableProductUrl = toUsableSheinUrl(`https://m.shein.com/ar/product-p-${sp.goods_id}.html`, {
        goodsId: sp.goods_id,
        shc: target.shc,
        groupId: target.groupId,
      });

      return {
        id: sp.goods_id || `item-${idx + 1}`,
        goodsId: sp.goods_id,
        name: sp.name,
        image: sp.image,
        originalUrl: usableProductUrl,
        url: usableProductUrl,
        sku: sp.sku_code || sp.goods_sn,
        color,
        size,
        originalPrice: pricing.salePriceEgp, // The current selling price in EGP (customer pays this)
        originalPriceBeforeDiscount: pricing.discountPercent > 0 ? pricing.retailPriceEgp : undefined,
        discountPercent: pricing.discountPercent > 0 ? pricing.discountPercent : undefined,
        currency: 'EGP',
        quantity: 1,
        subtotal: pricing.salePriceEgp,
        status: sp.sold_out ? 'out_of_stock' : 'available',
        sourcePrice: sp.sale_price,
        sourceCurrency: sp.currency,
        sourceOriginalPrice: sp.original_price,
      };
    });

    const itemsSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const dynamicFeeAmount = dynamicFeePercent > 0 ? Math.round(itemsSubtotal * (dynamicFeePercent / 100)) : 0;
    const totalCash = itemsSubtotal + dynamicFeeAmount;

    // Calculate total discount savings across all cart items
    const totalSavingsAmount = items.reduce((sum, item) => {
      if (item.originalPriceBeforeDiscount && item.originalPriceBeforeDiscount > item.originalPrice) {
        return sum + (item.originalPriceBeforeDiscount - item.originalPrice) * item.quantity;
      }
      return sum;
    }, 0);

    return {
      rawInput,
      extractedLink: target.landingUrl,
      title: title || 'العناصر التي شاركها صديقك',
      description: `تم استخراج ${items.length} منتج بنجاح من سلة شي إن.`,
      coverImage: items[0]?.image || RELIABLE_FASHION_IMAGES[0],
      shareCode: target.shc,
      groupId: target.groupId,
      landingUrl: target.landingUrl,
      items,
      sheinProducts,
      itemsSubtotal,
      dynamicFeePercent,
      dynamicFeeAmount,
      totalCash,
      currency: 'EGP',
      sourceCurrency: 'SAR',
      totalSavingsAmount: totalSavingsAmount > 0 ? totalSavingsAmount : undefined,
    };
  } catch (bffError: any) {
    console.warn('SHEIN BFF extraction failed, checking fallback metadata:', bffError.message);

    // Fallback: If not a cart link (e.g. single product link) or BFF blocked
    const meta = await scrapeSheinLinkMetadata(extractedLink);
    const count =
      typeof estimatedItemsCount === 'number' && !isNaN(estimatedItemsCount) && estimatedItemsCount > 0
        ? Math.round(estimatedItemsCount)
        : 1;

    const pricing = (meta.salePrice && meta.salePrice > 0)
      ? resolveItemPricing(meta.retailPrice, meta.salePrice, sarToEgpRate, profitMarginPercent)
      : null;

    const subtotal = pricing
      ? pricing.salePriceEgp
      : typeof estimatedSubtotal === 'number' && !isNaN(estimatedSubtotal) && estimatedSubtotal > 0
      ? Math.round(estimatedSubtotal)
      : 500;

    const usableLink = toUsableSheinUrl(extractedLink, { shc: meta.shc, groupId: meta.groupId });
    const fallbackItems: GoodItem[] = [
      {
        id: `shein-${Date.now()}`,
        name: meta.title || 'منتج شي إن المستخرج',
        image: meta.image || RELIABLE_FASHION_IMAGES[0],
        originalUrl: usableLink,
        url: usableLink,
        sku: meta.shc ? `SHC: ${meta.shc}` : 'SHEIN-ITEM',
        color: 'حسب الاختيار في شي إن',
        size: count > 1 ? `${count} قطع` : 'حسب الاختيار في شي إن',
        originalPrice: subtotal,
        originalPriceBeforeDiscount: pricing && pricing.discountPercent > 0 ? pricing.retailPriceEgp : undefined,
        discountPercent: pricing && pricing.discountPercent > 0 ? pricing.discountPercent : undefined,
        currency: 'EGP',
        quantity: 1,
        subtotal: subtotal,
        status: 'available',
        sourcePrice: meta.salePrice ? String(meta.salePrice) : undefined,
        sourceCurrency: meta.currency || 'SAR',
        sourceOriginalPrice: meta.retailPrice ? String(meta.retailPrice) : undefined,
      },
    ];

    const itemsSubtotal = fallbackItems.reduce((sum, it) => sum + it.subtotal, 0);
    const dynamicFeeAmount = Math.round(itemsSubtotal * (dynamicFeePercent / 100));
    const totalCash = itemsSubtotal + dynamicFeeAmount;

    return {
      rawInput,
      extractedLink: usableLink,
      title: meta.title || 'منتج شي إن المستخرج',
      description: meta.description || 'تم استخراج بيانات المنتج من رابط شي إن.',
      coverImage: meta.image || RELIABLE_FASHION_IMAGES[0],
      shareCode: meta.shc,
      groupId: meta.groupId,
      items: fallbackItems,
      itemsSubtotal,
      dynamicFeePercent,
      dynamicFeeAmount,
      totalCash,
      currency: 'EGP',
      landingUrl: usableLink,
    };
  }
}
