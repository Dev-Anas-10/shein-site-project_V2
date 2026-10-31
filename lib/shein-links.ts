import { Order, GoodItem } from './types';

/**
 * Known mapping of common onelink identifiers to verified SHEIN cart group_ids.
 * Allows instant, 0-latency resolution of past database records and standard links.
 */
const KNOWN_ONELINK_GROUP_MAP: Record<string, { groupId: string; shc: string; country: string }> = {
  '665tyuik24os': { groupId: '912962920', shc: '2_RNBpxEsz4Q1', country: 'SA' },
  '6655t9m70yzp': { groupId: '912765305', shc: '2_RN4yiuNnwha', country: 'SA' },
  '662zlco9zrsd': { groupId: '912245215', shc: '2_RNmYr2Mxf4g', country: 'SA' },
};

/**
 * In-memory cache for dynamically resolved onelink URLs
 */
const RESOLVED_LINKS_CACHE = new Map<string, string>();

export interface SheinLinkContext {
  goodsId?: string | number | null;
  sku?: string | null;
  shc?: string | null;
  groupId?: string | number | null;
  cartLandingUrl?: string | null;
  country?: string | null;
}

/**
 * Checks if a URL is already a direct, desktop-friendly m.shein.com or shein.com web URL.
 */
export function isUsableSheinWebUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.includes('onelink.shein.com') || trimmed.startsWith('sheinlink://')) {
    return false;
  }
  return /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:shein\.com|m\.shein\.com)\//i.test(trimmed);
}

/**
 * Converts any SHEIN link (including AppsFlyer onelink.shein.com or sheinlink:// deeplinks)
 * into a fully functional, browser-friendly m.shein.com URL that works reliably on both Desktop and Mobile.
 */
export function toUsableSheinUrl(
  url?: string | null,
  context?: SheinLinkContext
): string {
  if (!url && !context?.goodsId && !context?.cartLandingUrl) {
    return '';
  }

  const raw = (url || '').trim();

  // 1. If it's an item with a direct numeric goods_id, construct direct product page
  const numericId = context?.goodsId ? String(context.goodsId).replace(/\D/g, '') : '';
  if (numericId && numericId.length >= 6) {
    return `https://m.shein.com/ar/product-p-${numericId}.html`;
  }

  // 2. If it's already a valid m.shein.com or shein.com web page (not onelink)
  if (isUsableSheinWebUrl(raw)) {
    return raw;
  }

  // Check cache for this exact onelink
  if (raw && RESOLVED_LINKS_CACHE.has(raw)) {
    return RESOLVED_LINKS_CACHE.get(raw)!;
  }

  // 3. Handle sheinlink:// deeplinks
  if (raw.startsWith('sheinlink://')) {
    try {
      const match = raw.match(/data=([^&]+)/);
      if (match && match[1]) {
        const decoded = JSON.parse(decodeURIComponent(match[1]));
        const gid = decoded.group_id || context?.groupId;
        const shc = decoded.shc || context?.shc;
        const country = decoded.local_country || context?.country || 'SA';
        if (gid) {
          const res = `https://m.shein.com/ar/cart/share/landing?group_id=${gid}&shc=${shc || ''}&local_country=${country}&cart_share=1`;
          RESOLVED_LINKS_CACHE.set(raw, res);
          return res;
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  // 4. Handle onelink.shein.com URLs
  if (raw.includes('onelink.shein.com')) {
    // Check known mapping by onelink code
    for (const [code, info] of Object.entries(KNOWN_ONELINK_GROUP_MAP)) {
      if (raw.includes(code)) {
        const res = `https://m.shein.com/ar/cart/share/landing?group_id=${info.groupId}&shc=${info.shc}&local_country=${info.country}&cart_share=1`;
        RESOLVED_LINKS_CACHE.set(raw, res);
        return res;
      }
    }

    // Try parsing search parameters
    try {
      const urlObj = new URL(raw);
      const shc = urlObj.searchParams.get('shc') || context?.shc;
      const gid = urlObj.searchParams.get('group_id') || urlObj.searchParams.get('groupId') || context?.groupId;
      const country = urlObj.searchParams.get('local_country') || urlObj.searchParams.get('localcountry') || context?.country || 'SA';

      if (gid) {
        const res = `https://m.shein.com/ar/cart/share/landing?group_id=${gid}&shc=${shc || ''}&local_country=${country}&cart_share=1`;
        RESOLVED_LINKS_CACHE.set(raw, res);
        return res;
      }

      if (shc) {
        const res = `https://m.shein.com/ar/cart/share/landing?shc=${shc}&local_country=${country}&cart_share=1`;
        RESOLVED_LINKS_CACHE.set(raw, res);
        return res;
      }
    } catch {
      // ignore url error
    }
  }

  // 5. Fallback to cartLandingUrl context if available
  if (context?.cartLandingUrl && isUsableSheinWebUrl(context.cartLandingUrl)) {
    return context.cartLandingUrl;
  }

  // 6. If context has groupId & shc
  if (context?.groupId) {
    return `https://m.shein.com/ar/cart/share/landing?group_id=${context.groupId}&shc=${context.shc || ''}&local_country=${context.country || 'SA'}&cart_share=1`;
  }

  if (context?.shc) {
    return `https://m.shein.com/ar/cart/share/landing?shc=${context.shc}&local_country=${context.country || 'SA'}&cart_share=1`;
  }

  // 7. If raw was http, return as-is; otherwise return empty
  return raw.startsWith('http') ? raw : '';
}

/**
 * Normalizes all links in an Order (extractedLink and each item's originalUrl)
 * to ensure that only usable m.shein.com URLs are exposed to the Admin and Client UI.
 * Leaves order.rawInput intact for auditing purposes.
 */
export function normalizeOrderLinks(order: Order): Order {
  if (!order) return order;

  // 1. Normalize cart link
  const normalizedCartLink = toUsableSheinUrl(order.extractedLink, {
    shc: order.cartShareCode,
    groupId: order.cartGroupId,
    cartLandingUrl: order.extractedLink,
  });

  // 2. Normalize items links
  const normalizedItems: GoodItem[] = (order.items || []).map((it) => {
    const itemUrl = toUsableSheinUrl(it.originalUrl, {
      goodsId: it.id,
      sku: it.sku,
      shc: order.cartShareCode,
      groupId: order.cartGroupId,
      cartLandingUrl: normalizedCartLink || order.extractedLink,
    });

    return {
      ...it,
      originalUrl: itemUrl || it.originalUrl,
    };
  });

  return {
    ...order,
    extractedLink: normalizedCartLink || order.extractedLink,
    items: normalizedItems,
  };
}

/**
 * Resolves a onelink asynchronously if it was not known, caching the result.
 */
export async function resolveOnelinkAsync(onelinkUrl: string): Promise<string> {
  const cached = toUsableSheinUrl(onelinkUrl);
  if (isUsableSheinWebUrl(cached)) {
    return cached;
  }

  try {
    const res = await fetch(onelinkUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) return toUsableSheinUrl(onelinkUrl);

    const html = await res.text();
    const inputTags = html.match(/<input\b[^>]*>/gi) || [];
    let gid = '';
    let shc = '';
    let country = 'SA';

    for (const tag of inputTags) {
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
            } catch {}
          }
        }
      }
    }

    if (!gid) {
      const u = new URL(onelinkUrl);
      shc = u.searchParams.get('shc') || '';
    }

    if (gid) {
      const landing = `https://m.shein.com/ar/cart/share/landing?group_id=${gid}&shc=${shc}&local_country=${country}&cart_share=1`;
      RESOLVED_LINKS_CACHE.set(onelinkUrl, landing);
      return landing;
    }
  } catch (e) {
    // ignore fetch error
  }

  return toUsableSheinUrl(onelinkUrl);
}
