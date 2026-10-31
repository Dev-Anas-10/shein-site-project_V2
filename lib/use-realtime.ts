'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Order } from './types';
import { RealtimePayload } from './realtime-events';

export interface UseRealtimeOptions {
  orderId?: string;
  channel?: 'admin' | 'customer' | 'orders';
  onOrderChange?: (order: Order, eventType?: string) => void;
  onOrderDelete?: (orderId: string) => void;
  onShipmentChange?: (shipmentId?: string) => void;
  onRefresh?: () => void | Promise<void>;
  pollIntervalMs?: number;
  enabled?: boolean;
}

export function useRealtimeSubscription({
  orderId,
  channel = 'customer',
  onOrderChange,
  onOrderDelete,
  onShipmentChange,
  onRefresh,
  pollIntervalMs = orderId ? 4000 : channel === 'admin' ? 6000 : 5000,
  enabled = true,
}: UseRealtimeOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const fallbackPollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSseActiveRef = useRef<boolean>(false);

  // Keep callback refs fresh without resetting effect
  const onOrderChangeRef = useRef(onOrderChange);
  const onOrderDeleteRef = useRef(onOrderDelete);
  const onShipmentChangeRef = useRef(onShipmentChange);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onOrderChangeRef.current = onOrderChange;
    onOrderDeleteRef.current = onOrderDelete;
    onShipmentChangeRef.current = onShipmentChange;
    onRefreshRef.current = onRefresh;
  });

  const triggerRefresh = useCallback(() => {
    if (onRefreshRef.current) {
      try {
        onRefreshRef.current();
      } catch (err) {
        console.warn('[Realtime] Refresh error:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // 1. Establish Server-Sent Events (SSE) connection
    let sseUrl = `/api/realtime?channel=${encodeURIComponent(channel)}`;
    if (orderId) {
      sseUrl += `&orderId=${encodeURIComponent(orderId)}`;
    }

    let es: EventSource | null = null;

    try {
      es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.addEventListener('connected', () => {
        isSseActiveRef.current = true;
      });

      es.addEventListener('message', (e) => {
        try {
          const payload: RealtimePayload = JSON.parse(e.data);

          if (payload.type.startsWith('ORDER_') && payload.order) {
            if (onOrderChangeRef.current) {
              onOrderChangeRef.current(payload.order, payload.type);
            }
          }

          if (payload.type === 'ORDER_DELETED' && payload.orderId) {
            if (onOrderDeleteRef.current) {
              onOrderDeleteRef.current(payload.orderId);
            }
          }

          if (payload.type.startsWith('SHIPMENT_')) {
            if (onShipmentChangeRef.current) {
              onShipmentChangeRef.current(payload.shipmentId);
            }
          }

          // Trigger general refresh callback if registered
          triggerRefresh();
        } catch {
          // Ignore parse errors on heartbeat pings
        }
      });

      es.onerror = () => {
        // SSE connection dropped or serverless timeout reached
        isSseActiveRef.current = false;
        // EventSource will automatically retry connecting
      };
    } catch {
      isSseActiveRef.current = false;
    }

    // 2. High-Efficiency Adaptive Polling Backup (guarantees updates even if SSE is blocked or sleeps)
    const effectivePollInterval = pollIntervalMs;
    fallbackPollTimerRef.current = setInterval(() => {
      // Run poll if SSE is inactive or as a background sanity sync
      triggerRefresh();
    }, effectivePollInterval);

    // 3. Instant sync on Tab/Window Focus (e.g. customer returning from banking app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerRefresh();
      }
    };

    const handleWindowFocus = () => {
      triggerRefresh();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      if (es) {
        es.close();
      }
      if (fallbackPollTimerRef.current) {
        clearInterval(fallbackPollTimerRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [orderId, channel, pollIntervalMs, enabled, triggerRefresh]);
}
