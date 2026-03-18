import { describe, expect, it } from "vitest";

import type { SearchFiltersState } from "@/components/SearchFilters";
import { buildFastApiRequest } from "@/lib/api/listings";

function makeFilters(overrides: Partial<SearchFiltersState> = {}): SearchFiltersState {
  return {
    brand: "BMW",
    model: "320d",
    trim: "",
    yearMin: "",
    yearMax: "",
    priceMin: "",
    priceMax: "",
    kmMin: "",
    kmMax: "",
    fuel: "",
    transmission: "",
    isNew: null,
    sources: ["autoscout24", "subito"],
    color: "",
    doors: "",
    bodyType: "",
    location: "",
    sellerType: "all",
    emissionClass: "",
    ...overrides,
  };
}

describe("buildFastApiRequest", () => {
  it("serializes extended filters in SearchRequest v1", () => {
    const payload = buildFastApiRequest(
      makeFilters({
        isNew: false,
        color: "Nero",
        doors: "4",
        emissionClass: "Euro 6",
        sellerType: "dealer",
      }),
    );

    expect(payload.is_new).toBe(false);
    expect(payload.color).toBe("Nero");
    expect(payload.doors).toBe(4);
    expect(payload.emission_class).toBe("Euro 6");
    expect(payload.seller_type).toBe("dealer");
    expect(payload.private_only).toBe(false);
  });

  it("keeps additive compatibility via private_only when seller_type=private", () => {
    const payload = buildFastApiRequest(
      makeFilters({
        sellerType: "private",
      }),
    );

    expect(payload.seller_type).toBe("private");
    expect(payload.private_only).toBe(true);
  });
});
