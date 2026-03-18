import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useListingAnalysis } from "@/features/results/hooks/useListingAnalysis";
import type { ListingAnalysis } from "@/lib/api/listings";
import { analyzeListing } from "@/services/api/listingAnalysis";

vi.mock("@/lib/runtimeConfig", () => ({
  getRuntimeConfig: () => ({
    backendMode: "fastapi",
    apiBaseUrl: "http://localhost:8000",
  }),
  getFastApiBaseUrlOrThrow: () => "http://localhost:8000",
}));

vi.mock("@/services/api/listingAnalysis", () => ({
  analyzeListing: vi.fn(),
  fetchOwnershipMetadata: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useListingAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads decision analysis in FastAPI mode", async () => {
    const payload: ListingAnalysis = {
      listing_id: "listing-1",
      deal_summary: {
        headline: "Affare interessante",
        top_reasons: ["9% sotto benchmark"],
      },
      trust_summary: {
        trust_score: 71,
        risk_level: "medium",
        flags: ["poche foto"],
      },
    };

    vi.mocked(analyzeListing).mockResolvedValueOnce(payload);

    const { result } = renderHook(
      () =>
        useListingAnalysis({
          listingId: "listing-1",
          include: ["deal", "trust"],
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(analyzeListing).toHaveBeenCalledOnce();
    expect(result.current.data?.deal_summary?.headline).toBe("Affare interessante");
    expect(result.current.data?.trust_summary?.risk_level).toBe("medium");
  });
});
