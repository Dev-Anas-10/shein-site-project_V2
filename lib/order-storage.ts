import { Order } from './types';

const CLIENT_ORDERS_KEY = 'shein_concierge_client_orders';

export function getClientOrders(filterUserId?: string, filterEmail?: string): Order[] {
  if (typeof window === 'undefined') return [];
  // For privacy, if no user is specified, return nothing!
  if (!filterUserId && !filterEmail) return [];

  try {
    const raw = localStorage.getItem(CLIENT_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const lowerEmail = filterEmail?.toLowerCase().trim();
    return parsed.filter((o: Order) => {
      if (filterUserId && o.userId === filterUserId) return true;
      if (lowerEmail && o.userEmail && o.userEmail.toLowerCase().trim() === lowerEmail) return true;
      return false;
    });
  } catch (err) {
    console.warn('Error reading client orders:', err);
    return [];
  }
}

export function saveClientOrder(order: Order): void {
  if (typeof window === 'undefined' || !order || !order.id) return;
  try {
    const raw = localStorage.getItem(CLIENT_ORDERS_KEY);
    const current: Order[] = raw ? JSON.parse(raw) : [];
    const existingIdx = Array.isArray(current) ? current.findIndex((o) => o.id === order.id) : -1;
    let updated: Order[];
    if (existingIdx >= 0) {
      updated = [...current];
      updated[existingIdx] = order;
    } else {
      updated = [order, ...(Array.isArray(current) ? current : [])];
    }
    localStorage.setItem(CLIENT_ORDERS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Error saving client order:', err);
  }
}

export function removeClientOrder(orderId: string): void {
  if (typeof window === 'undefined' || !orderId) return;
  try {
    const raw = localStorage.getItem(CLIENT_ORDERS_KEY);
    if (!raw) return;
    const current: Order[] = JSON.parse(raw);
    if (!Array.isArray(current)) return;
    const filtered = current.filter((o) => o.id !== orderId);
    localStorage.setItem(CLIENT_ORDERS_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Error removing client order:', err);
  }
}

/**
 * Synchronize client storage with the server database (Single Source of Truth).
 * Replaces cached orders for this user with the server's authoritative state,
 * eliminating stale or deleted phantom orders while preserving offline cache.
 */
export function syncClientOrdersWithServer(
  filterUserId: string | undefined,
  filterEmail: string | undefined,
  serverOrders: Order[]
): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(CLIENT_ORDERS_KEY);
    const current: Order[] = raw ? JSON.parse(raw) : [];
    const validCurrent = Array.isArray(current) ? current : [];

    const lowerEmail = filterEmail?.toLowerCase().trim();
    // Keep orders belonging to other users (multi-account protection)
    const otherUsersOrders = validCurrent.filter((o: Order) => {
      if (filterUserId && o.userId === filterUserId) return false;
      if (lowerEmail && o.userEmail && o.userEmail.toLowerCase().trim() === lowerEmail) return false;
      return true;
    });

    // Combine other users' orders with the new authoritative server orders for this user
    const updated = [...serverOrders, ...otherUsersOrders];
    localStorage.setItem(CLIENT_ORDERS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Error syncing client orders with server:', err);
  }
}

/**
 * Merge and deduplicate orders with strict Server Database Authority (Single Source of Truth).
 * If serverOrders are present, the server is the absolute authority for prices and statuses.
 */
export function mergeAndDeduplicateOrders(serverOrders: Order[], clientOrders: Order[]): Order[] {
  const map = new Map<string, Order>();

  // 1. Server orders take absolute precedence as Single Source of Truth
  for (const o of serverOrders) {
    if (o && o.id) {
      map.set(o.id, o);
    }
  }

  // 2. Only consider client orders if they are brand-new local submissions that haven't hit the server yet (< 5 mins old)
  // This strictly prevents stale, deleted, or resurrected phantom orders!
  for (const o of clientOrders) {
    if (o && o.id && !map.has(o.id)) {
      const ageMs = Date.now() - new Date(o.createdAt || 0).getTime();
      if (ageMs < 5 * 60 * 1000) {
        map.set(o.id, o);
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
