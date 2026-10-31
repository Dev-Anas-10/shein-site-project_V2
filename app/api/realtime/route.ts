import { NextRequest } from 'next/server';
import { realtimeBus, RealtimePayload } from '@/lib/realtime-events';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');
  const channel = searchParams.get('channel') || 'customer';

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connected event
      try {
        controller.enqueue(
          encoder.encode(
            `event: connected\ndata: ${JSON.stringify({ status: 'connected', channel, orderId })}\n\n`
          )
        );
      } catch {
        // Stream aborted early
        return;
      }

      // 2. Event listener
      const onEvent = (payload: RealtimePayload) => {
        try {
          if (orderId && payload.orderId && payload.orderId !== orderId) {
            return;
          }
          controller.enqueue(
            encoder.encode(`event: message\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          // Stream closed
          if (cleanup) cleanup();
        }
      };

      if (orderId) {
        realtimeBus.on(`order:${orderId}`, onEvent);
      }
      realtimeBus.on('event', onEvent);

      // 3. Keep-alive heartbeat ping every 15 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
          if (cleanup) cleanup();
        }
      }, 15000);

      cleanup = () => {
        clearInterval(pingInterval);
        if (orderId) {
          realtimeBus.off(`order:${orderId}`, onEvent);
        }
        realtimeBus.off('event', onEvent);
      };
    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  req.signal.addEventListener('abort', () => {
    if (cleanup) cleanup();
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
