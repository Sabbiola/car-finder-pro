import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useSearchStream } from "@/features/search/hooks/useSearchStream";
import { streamSearch } from "@/services/api/searchStream";

vi.mock("@/lib/runtimeConfig", () => ({
  getRuntimeConfig: () => ({
    backendMode: "fastapi",
    apiBaseUrl: "http://localhost:8000",
  }),
}));

vi.mock("@/services/api/searchStream", () => ({
  streamSearch: vi.fn(),
}));

describe("useSearchStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("collects result events and closes stream on complete", async () => {
    vi.mocked(streamSearch).mockImplementation(async ({ onEvent }) => {
      onEvent({
        event: "progress",
        provider: "autoscout24",
        status: "started",
        timestamp: new Date().toISOString(),
      });
      onEvent({
        event: "result",
        listing: { id: "1" },
        timestamp: new Date().toISOString(),
      });
      onEvent({
        event: "complete",
        total_results: 1,
        provider_summary: { autoscout24: 1 },
        duration_ms: 100,
        timestamp: new Date().toISOString(),
      });
    });

    const { result } = renderHook(() => useSearchStream<{ brand: string }, { id: string }>());

    await act(async () => {
      await result.current.start({ brand: "BMW" });
    });

    expect(streamSearch).toHaveBeenCalledOnce();
    expect(result.current.results).toEqual([{ id: "1" }]);
    expect(result.current.error).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it("keeps streaming state coherent when provider error events arrive", async () => {
    vi.mocked(streamSearch).mockImplementation(async ({ onEvent }) => {
      onEvent({
        event: "progress",
        provider: "subito",
        status: "started",
        timestamp: new Date().toISOString(),
      });
      onEvent({
        event: "error",
        provider: "subito",
        code: "provider_failure",
        message: "subito timeout",
        retryable: false,
        timestamp: new Date().toISOString(),
      });
      onEvent({
        event: "complete",
        total_results: 0,
        provider_summary: {},
        duration_ms: 120,
        timestamp: new Date().toISOString(),
      });
    });

    const { result } = renderHook(() => useSearchStream<{ brand: string }, { id: string }>());
    await act(async () => {
      await result.current.start({ brand: "BMW" });
    });

    expect(result.current.events.some((event) => event.event === "error")).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it("sets error when stream request fails", async () => {
    vi.mocked(streamSearch).mockRejectedValueOnce(new Error("HTTP 500"));
    const { result } = renderHook(() => useSearchStream<{ brand: string }, { id: string }>());

    await act(async () => {
      await result.current.start({ brand: "BMW" });
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toContain("HTTP 500");
  });
});
