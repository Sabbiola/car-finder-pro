import { useRef, useState } from "react";
import type { SearchStreamEvent } from "@/features/search/types";
import { getRuntimeConfig } from "@/lib/runtimeConfig";
import { streamSearch } from "@/services/api/searchStream";

export interface UseSearchStreamState<TListing = unknown> {
  isStreaming: boolean;
  events: SearchStreamEvent<TListing>[];
  results: TListing[];
  error: string | null;
}

export function useSearchStream<TPayload = unknown, TListing = unknown>() {
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<UseSearchStreamState<TListing>>({
    isStreaming: false,
    events: [],
    results: [],
    error: null,
  });

  const start = async (payload: TPayload): Promise<void> => {
    const config = getRuntimeConfig();
    if (config.backendMode !== "fastapi" || !config.apiBaseUrl) {
      setState((prev) => ({
        ...prev,
        error: "FastAPI backend mode is disabled or API base URL is missing.",
      }));
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ isStreaming: true, events: [], results: [], error: null });

    try {
      await streamSearch<TPayload, TListing>({
        baseUrl: config.apiBaseUrl,
        payload,
        signal: controller.signal,
        onEvent: (event) => {
          setState((prev) => {
            const nextEvents = [...prev.events, event];
            const nextResults =
              event.event === "result" ? [...prev.results, event.listing] : prev.results;
            return {
              ...prev,
              events: nextEvents,
              results: nextResults,
              isStreaming: event.event === "complete" ? false : prev.isStreaming,
            };
          });
        },
      });
      setState((prev) => ({ ...prev, isStreaming: false }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search stream failed";
      setState((prev) => ({ ...prev, isStreaming: false, error: message }));
    }
  };

  const stop = (): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((prev) => ({ ...prev, isStreaming: false }));
  };

  return {
    ...state,
    start,
    stop,
  };
}
