import { describe, expect, it } from "vitest";

import {
  buildListingIdentityKey,
  reconcileListingsByResultKeys,
  type CarListing,
} from "@/lib/api/listings";

function listing(partial: Partial<CarListing>): CarListing {
  return {
    id: partial.id || "id-1",
    title: partial.title || "BMW 320d",
    brand: partial.brand || "BMW",
    model: partial.model || "320d",
    trim: partial.trim || null,
    year: partial.year || 2020,
    price: partial.price || 25000,
    km: partial.km || 50000,
    fuel: partial.fuel || "Diesel",
    transmission: partial.transmission || "Automatico",
    power: null,
    color: null,
    doors: null,
    body_type: null,
    source: partial.source || "autoscout24",
    source_url: partial.source_url || null,
    image_url: null,
    location: null,
    is_new: false,
    is_best_deal: false,
    price_rating: null,
    scraped_at: partial.scraped_at || new Date().toISOString(),
  };
}

describe("stream reconciliation helpers", () => {
  it("builds identity key preferring source_url", () => {
    const urlListing = listing({ source_url: "https://example.com/a" });
    expect(buildListingIdentityKey(urlListing)).toBe("https://example.com/a");

    const fallbackListing = listing({ source_url: null, source: "subito", title: "BMW", year: 2019, price: 19900 });
    expect(buildListingIdentityKey(fallbackListing)).toBe("subito|BMW|19900|2019");
  });

  it("reconciles streamed listings using backend final keys", () => {
    const first = listing({ id: "a", source_url: "https://example.com/a" });
    const second = listing({ id: "b", source_url: "https://example.com/b" });
    const third = listing({ id: "c", source_url: "https://example.com/c" });

    const reconciled = reconcileListingsByResultKeys(
      [first, second, third],
      ["https://example.com/b", "https://example.com/a"],
    );

    expect(reconciled.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
