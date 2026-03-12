import type { SearchStreamEvent } from "@/features/search/types";

export interface StreamSearchParams<TPayload = unknown, TListing = unknown> {
  baseUrl: string;
  payload: TPayload;
  signal?: AbortSignal;
  onEvent: (event: SearchStreamEvent<TListing>) => void;
}

interface PartialSseEvent {
  event: string;
  data: string;
}

function parseSseChunk(buffer: string): { events: PartialSseEvent[]; rest: string } {
  const normalized = buffer.replace(/\r/g, "");
  const blocks = normalized.split("\n\n");
  const completeBlocks = blocks.slice(0, -1);
  const rest = blocks[blocks.length - 1] ?? "";
  const events: PartialSseEvent[] = [];

  for (const block of completeBlocks) {
    const lines = block.split("\n");
    let eventName = "";
    let data = "";
    for (const line of lines) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) data = line.slice(5).trim();
    }
    if (eventName && data) events.push({ event: eventName, data });
  }

  return { events, rest };
}

export async function streamSearch<TPayload = unknown, TListing = unknown>({
  baseUrl,
  payload,
  signal,
  onEvent,
}: StreamSearchParams<TPayload, TListing>): Promise<void> {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/search/stream`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Search stream failed: HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Search stream failed: empty response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const { events, rest } = parseSseChunk(pending);
    pending = rest;

    for (const raw of events) {
      try {
        const parsed = JSON.parse(raw.data) as SearchStreamEvent<TListing>;
        onEvent(parsed);
      } catch {
        // ignore malformed SSE line payloads in client parser
      }
    }
  }

  if (pending.trim()) {
    const { events } = parseSseChunk(`${pending}\n\n`);
    for (const raw of events) {
      try {
        const parsed = JSON.parse(raw.data) as SearchStreamEvent<TListing>;
        onEvent(parsed);
      } catch {
        // ignore malformed trailing SSE payloads
      }
    }
  }
}
