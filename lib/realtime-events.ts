import { EventEmitter } from 'events';
import { Order, Shipment, SystemSettings } from './types';

export type RealtimeEventType =
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_DELETED'
  | 'SHIPMENT_CREATED'
  | 'SHIPMENT_UPDATED'
  | 'SHIPMENT_DELETED'
  | 'SETTINGS_UPDATED';

export interface RealtimePayload {
  type: RealtimeEventType;
  orderId?: string;
  order?: Order;
  shipmentId?: string;
  shipment?: Shipment;
  settings?: SystemSettings;
  timestamp: string;
}

// In-process event bus singleton across the Node.js server
declare global {
  // eslint-disable-next-line no-var
  var __antigravityRealtimeBus: EventEmitter | undefined;
}

if (!global.__antigravityRealtimeBus) {
  global.__antigravityRealtimeBus = new EventEmitter();
  global.__antigravityRealtimeBus.setMaxListeners(200);
}

export const realtimeBus: EventEmitter = global.__antigravityRealtimeBus;

export function broadcastRealtimeEvent(
  type: RealtimeEventType,
  data?: Partial<RealtimePayload>
) {
  const payload: RealtimePayload = {
    type,
    timestamp: new Date().toISOString(),
    ...data,
  };

  try {
    realtimeBus.emit('event', payload);
    if (payload.orderId) {
      realtimeBus.emit(`order:${payload.orderId}`, payload);
    }
  } catch (err) {
    console.warn('[Realtime] Broadcast note:', err);
  }
}
