import { afterEach, describe, expect, it, vi } from "vitest";

import { analyzeListing } from "@/services/api/listingAnalysis";

describe("listingAnalysis payload mapping", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps UI listing payload to backend VehicleListing contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await analyzeListing("http://localhost:8000", {
      include: ["deal", "trust", "ownership", "negotiation"],
      listing: {
        id: "autoscout24-bmw-320d",
        title: "BMW 320d Touring",
        source: "autoscout24",
        source_url: "https://www.autoscout24.it/annunci/test",
        brand: "BMW",
        model: "320d",
        trim: "Touring",
        price: 15900,
        year: 2019,
        km: 98000,
        fuel: "Diesel",
        transmission: "Automatico",
        body_type: "Station Wagon",
        image_url: "https://cdn.example.com/primary.jpg",
        image_urls: ["https://cdn.example.com/extra.jpg"],
      },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(options.body));

    expect(body.listing.provider).toBe("autoscout24");
    expect(body.listing.price_amount).toBe(15900);
    expect(body.listing.make).toBe("BMW");
    expect(body.listing.model).toBe("320d");
    expect(body.listing.mileage_value).toBe(98000);
    expect(body.listing.url).toBe("https://www.autoscout24.it/annunci/test");
    expect(body.listing.images).toEqual([
      "https://cdn.example.com/primary.jpg",
      "https://cdn.example.com/extra.jpg",
    ]);
  });
});
