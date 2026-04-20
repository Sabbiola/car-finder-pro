import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  snapshotToExtendedListing,
  parseDetailPayload,
  buildGalleryImages,
  useListingDetail,
} from "@/features/detail/hooks/useListingDetail";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/runtimeConfig", () => ({
  getRuntimeConfig: () => ({ backendMode: "fastapi", apiBaseUrl: "http://api.test" }),
  getFastApiBaseUrlOrThrow: () => "http://api.test",
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
    status: ok ? 200 : 404,
  } as unknown as Response;
}

function makeDetailPayload(overrides: Record<string, unknown> = {}) {
  return {
    listing: {
      id: "lst-1",
      provider: "autoscout24",
      title: "BMW 320d",
      price_amount: 24900,
      year: 2021,
      make: "BMW",
      model: "320d",
      mileage_value: 42000,
      fuel_type: "Diesel",
      transmission: "Automatico",
      url: "https://autoscout24.it/annunci/bmw-320d-lst-1",
      images: ["https://img.autoscout24.net/listing-images/lst-1/800x600.jpg"],
      ...overrides,
    },
    similar_listings: [],
    price_samples: [],
    price_history: [],
    resolved_by: "id",
  };
}

// ---------------------------------------------------------------------------
// snapshotToExtendedListing
// ---------------------------------------------------------------------------

describe("snapshotToExtendedListing", () => {
  it("maps known scalar fields", () => {
    const snap = {
      title: "VW Golf",
      brand: "VW",
      model: "Golf",
      year: 2019,
      price: 18000,
      km: 60000,
      fuel: "Benzina",
      source: "subito",
    };
    const result = snapshotToExtendedListing(snap, "fallback-id");
    expect(result.id).toBe("fallback-id");
    expect(result.title).toBe("VW Golf");
    expect(result.brand).toBe("VW");
    expect(result.year).toBe(2019);
    expect(result.price).toBe(18000);
    expect(result.km).toBe(60000);
    expect(result.fuel).toBe("Benzina");
    expect(result.source).toBe("subito");
  });

  it("uses fallback title when title is missing", () => {
    const result = snapshotToExtendedListing({}, "x");
    expect(result.title).toBe("Annuncio");
  });

  it("builds image_urls list from imageUrls array", () => {
    const snap = {
      title: "Fiat 500",
      imageUrl: "https://img.example.com/main.jpg",
      imageUrls: ["https://img.example.com/main.jpg", "https://img.example.com/2.jpg"],
    };
    const result = snapshotToExtendedListing(snap, "id");
    expect(result.image_urls).toHaveLength(2);
    expect(result.image_url).toBe("https://img.example.com/main.jpg");
  });

  it("falls back to imageUrl when imageUrls is absent", () => {
    const snap = { title: "Lancia", imageUrl: "https://img.example.com/x.jpg" };
    const result = snapshotToExtendedListing(snap, "id");
    expect(result.image_url).toBe("https://img.example.com/x.jpg");
    expect(result.image_urls).toHaveLength(1);
  });

  it("handles null snapshot gracefully", () => {
    const result = snapshotToExtendedListing(null, "id");
    expect(result.title).toBe("Annuncio");
    expect(result.price).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseDetailPayload
// ---------------------------------------------------------------------------

describe("parseDetailPayload", () => {
  it("returns empty arrays when extra_data is null", () => {
    const result = parseDetailPayload(null);
    expect(result.specs).toEqual([]);
    expect(result.equipment).toEqual([]);
  });

  it("parses autoscout raw_payload with specs and equipment", () => {
    const payload = {
      raw_payload: {
        autoscout: {
          specs: { Cambio: "Automatico", Carburante: "Diesel" },
          equipment: ["ABS", "ESP", "Cruise Control"],
        },
      },
    };
    const result = parseDetailPayload(payload);
    expect(result.specs).toContainEqual({ label: "Cambio", value: "Automatico" });
    expect(result.specs).toContainEqual({ label: "Carburante", value: "Diesel" });
    expect(result.equipment).toContain("ABS");
    expect(result.equipment).toContain("ESP");
  });

  it("parses automobile raw_payload with top-level equipment array", () => {
    const payload = {
      raw_payload: {
        equipment: ["Navigatore", "Sensori Parcheggio", "Telecamera"],
      },
    };
    const result = parseDetailPayload(payload);
    expect(result.specs).toEqual([]);
    expect(result.equipment).toContain("Navigatore");
    expect(result.equipment).toContain("Telecamera");
  });

  it("caps specs at 20 and equipment at 30 for autoscout", () => {
    const specs: Record<string, string> = {};
    for (let i = 0; i < 30; i++) specs[`Label${i}`] = `Value${i}`;
    const equipment = Array.from({ length: 50 }, (_, i) => `Item${i}`);
    const payload = { raw_payload: { autoscout: { specs, equipment } } };
    const result = parseDetailPayload(payload);
    expect(result.specs.length).toBeLessThanOrEqual(20);
    expect(result.equipment.length).toBeLessThanOrEqual(30);
  });

  it("ignores empty string spec values", () => {
    const payload = {
      raw_payload: {
        autoscout: { specs: { Cambio: "Automatico", Empty: "" } },
      },
    };
    const result = parseDetailPayload(payload);
    expect(result.specs.map((s) => s.label)).not.toContain("Empty");
  });
});

// ---------------------------------------------------------------------------
// buildGalleryImages
// ---------------------------------------------------------------------------

describe("buildGalleryImages", () => {
  const base = {
    id: "x",
    title: "T",
    brand: "",
    model: "",
    trim: null,
    year: 2020,
    price: 0,
    km: 0,
    fuel: null,
    transmission: null,
    power: null,
    color: null,
    doors: null,
    body_type: null,
    source: "autoscout24",
    source_url: null,
    location: null,
    is_new: false,
    is_best_deal: false,
    price_rating: null,
    scraped_at: new Date().toISOString(),
    description: null,
    emission_class: null,
    version: null,
    seats: null,
    condition: null,
    detail_scraped: false,
    extra_data: null,
    image_urls: null,
  };

  it("returns fallback when image_url is empty and no extras", () => {
    const result = buildGalleryImages({ ...base, image_url: null });
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("placeholder");
  });

  it("normalizes protocol-relative URLs", () => {
    const result = buildGalleryImages({ ...base, image_url: "//img.example.com/photo.jpg" });
    expect(result[0]).toBe("https://img.example.com/photo.jpg");
  });

  it("rewrites sbito rule parameter", () => {
    const url = "https://images.sbito.it/abc.jpg?rule=small-4x3&ts=123";
    const result = buildGalleryImages({ ...base, image_url: url });
    expect(result[0]).toContain("rule=fullscreen-1x-auto");
    expect(result[0]).not.toContain("rule=small-4x3");
  });

  it("rewrites autoscout24 thumbnail size to 800x600", () => {
    const url = "https://cdn.autoscout24.net/listing-images/lst-1/200x150.jpg";
    const result = buildGalleryImages({ ...base, image_url: url });
    expect(result[0]).toContain("/800x600.jpg");
    expect(result[0]).not.toContain("/200x150.jpg");
  });

  it("deduplicates: main image not repeated in extras", () => {
    const main = "https://img.example.com/main.jpg";
    const result = buildGalleryImages({
      ...base,
      image_url: main,
      image_urls: [main, "https://img.example.com/extra.jpg"],
    });
    expect(result.filter((u) => u === main)).toHaveLength(1);
    expect(result).toContain("https://img.example.com/extra.jpg");
  });

  it("includes all extra images after main", () => {
    const result = buildGalleryImages({
      ...base,
      image_url: "https://img.example.com/1.jpg",
      image_urls: [
        "https://img.example.com/1.jpg",
        "https://img.example.com/2.jpg",
        "https://img.example.com/3.jpg",
      ],
    });
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("https://img.example.com/1.jpg");
    expect(result[1]).toBe("https://img.example.com/2.jpg");
    expect(result[2]).toBe("https://img.example.com/3.jpg");
  });
});

// ---------------------------------------------------------------------------
// useListingDetail hook — FastAPI path
// ---------------------------------------------------------------------------

describe("useListingDetail (fastapi mode)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and sets car on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeFetchResponse(makeDetailPayload()));

    const onLoaded = vi.fn();
    const { result } = renderHook(() =>
      useListingDetail("lst-1", null, null, onLoaded),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.car).not.toBeNull();
    expect(result.current.car?.title).toBe("BMW 320d");
    expect(result.current.car?.price).toBe(24900);
    expect(result.current.fetchError).toBeNull();
    expect(onLoaded).toHaveBeenCalledWith("lst-1");
  });

  it("sets price history when returned by API", async () => {
    const payload = makeDetailPayload();
    payload.price_history = [
      { price: 25000, recorded_at: "2026-01-01T00:00:00Z" },
      { price: 24900, recorded_at: "2026-02-01T00:00:00Z" },
    ];
    vi.mocked(fetch).mockResolvedValueOnce(makeFetchResponse(payload));

    const { result } = renderHook(() =>
      useListingDetail("lst-1", null, null, vi.fn()),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.priceHistory).toHaveLength(2);
    expect(result.current.priceHistory[0].price).toBe(25000);
  });

  it("sets similar listings from API", async () => {
    const payload = makeDetailPayload();
    payload.similar_listings = [
      {
        id: "lst-2",
        provider: "autoscout24",
        title: "BMW 318d",
        price_amount: 22000,
        year: 2020,
        make: "BMW",
        model: "318d",
        mileage_value: 60000,
      },
    ];
    vi.mocked(fetch).mockResolvedValueOnce(makeFetchResponse(payload));

    const { result } = renderHook(() =>
      useListingDetail("lst-1", null, null, vi.fn()),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.similar).toHaveLength(1);
    expect(result.current.similar[0].title).toBe("BMW 318d");
  });

  it("resolves source URL from listing when API returns it", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeFetchResponse(makeDetailPayload()));

    const { result } = renderHook(() =>
      useListingDetail("lst-1", null, null, vi.fn()),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.resolvedUrl).toBe(
      "https://autoscout24.it/annunci/bmw-320d-lst-1",
    );
  });

  it("falls back to listingSnapshot on fetch error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));

    const snapshot = {
      title: "Snapshot Car",
      brand: "Fiat",
      model: "Panda",
      year: 2018,
      price: 8000,
      km: 80000,
      source: "subito",
    };
    const onLoaded = vi.fn();
    const { result } = renderHook(() =>
      useListingDetail("snap-id", null, snapshot, onLoaded),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.car?.title).toBe("Snapshot Car");
    expect(result.current.fetchError).toBeNull();
    expect(onLoaded).toHaveBeenCalled();
  });

  it("sets fetchError when no snapshot available and fetch fails", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));

    const { result } = renderHook(() =>
      useListingDetail("err-id", null, null, vi.fn()),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.car).toBeNull();
    expect(result.current.fetchError).toBeTruthy();
  });

  it("starts with loading=true", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() =>
      useListingDetail("lst-1", null, null, vi.fn()),
    );
    expect(result.current.loading).toBe(true);
  });

  it("returns null car when id is undefined", () => {
    const { result } = renderHook(() =>
      useListingDetail(undefined, null, null, vi.fn()),
    );
    expect(result.current.car).toBeNull();
    expect(result.current.fetchError).toBeNull();
  });
});
