import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { fetchListingDetailContext } from "@/services/api/listingDetail";

describe("fetchListingDetailContext", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps listing detail payload to frontend context", async () => {
    const mockedFetch = vi.mocked(fetch);
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        listing: {
          id: "listing-1",
          provider: "autoscout24",
          title: "BMW 320d",
          price_amount: 25000,
          year: 2021,
          make: "BMW",
          model: "320d",
          mileage_value: 42000,
          fuel_type: "Diesel",
          transmission: "Automatico",
          url: "https://example.com/a",
          images: ["https://images.example.com/a.jpg"],
        },
        similar_listings: [],
        price_samples: [],
        price_history: [{ price: 25500, recorded_at: "2026-01-10T00:00:00Z" }],
        resolved_by: "id",
      }),
    } as Response);

    const context = await fetchListingDetailContext("https://api.example.com", {
      listingId: "listing-1",
      includeAnalysis: false,
    });

    expect(context.listing.id).toBe("listing-1");
    expect(context.listing.price).toBe(25000);
    expect(context.priceHistory).toEqual([{ price: 25500, recorded_at: "2026-01-10T00:00:00Z" }]);
    expect(context.resolvedBy).toBe("id");
  });
});
