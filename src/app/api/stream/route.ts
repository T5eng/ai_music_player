import { NextRequest } from "next/server";
import { getSessionQueueIds, getTrack } from "@/lib/db";
import { subscribeGeneration } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return new Response("sessionId required", { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const unsubs: (() => void)[] = [];

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      const pollQueue = () => {
        const ids = getSessionQueueIds(sessionId);
        const generating = ids.generatingTrackId
          ? getTrack(ids.generatingTrackId)
          : null;
        const next = ids.nextTrackId ? getTrack(ids.nextTrackId) : null;

        send({
          type: "queue",
          generating,
          next,
        });
      };

      pollQueue();
      const interval = setInterval(pollQueue, 2000);

      const ids = getSessionQueueIds(sessionId);
      if (ids.generatingTrackId) {
        const unsub = subscribeGeneration(ids.generatingTrackId, (event) => {
          send({ type: "generation", ...event });
        });
        unsubs.push(unsub);
      }

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        unsubs.forEach((fn) => fn());
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
