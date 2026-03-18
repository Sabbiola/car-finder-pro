import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtimeConfigMock = vi.fn();
const invokeMock = vi.fn();
type RuntimeConfigStub = { backendMode: "fastapi" | "supabase"; apiBaseUrl: string | null };

vi.mock("@/lib/runtimeConfig", () => ({
  getRuntimeConfig: () => runtimeConfigMock() as RuntimeConfigStub,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args) as unknown,
    },
  },
}));

import { scrapeListings } from "@/lib/api/listings";
import type { SearchFiltersState } from "@/components/SearchFilters";

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
    sources: ["autoscout24"],
    color: "",
    doors: "",
    bodyType: "",
    location: "",
    sellerType: "all",
    emissionClass: "",
    ...overrides,
  };
}

describe("scrapeListings fastapi mode", () => {
  beforeEach(() => {
    runtimeConfigMock.mockReturnValue({
      backendMode: "fastapi",
      apiBaseUrl: "https://api.example.com",
    });
    invokeMock.mockReset();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ listings: [] }) })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not fallback to legacy invoke when unknown sources are selected", async () => {
    const response = await scrapeListings(makeFilters({ sources: ["autoscout24", "legacy-source"] }));

    expect(response.success).toBe(true);
    expect(response.source).toBe("fastapi");
    expect(response.provider_errors).toContain(
      "Ignored non-migrated sources in fastapi mode: legacy-source",
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("fails when no migrated fastapi providers are selected", async () => {
    await expect(scrapeListings(makeFilters({ sources: ["legacy-only"] }))).rejects.toThrow(
      "No FastAPI providers selected",
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("fails closed when fastapi mode is selected without API base URL", async () => {
    runtimeConfigMock.mockReturnValue({
      backendMode: "fastapi",
      apiBaseUrl: null,
    });

    await expect(scrapeListings(makeFilters({ sources: ["autoscout24"] }))).rejects.toThrow(
      "Search requires VITE_API_BASE_URL when backendMode=fastapi.",
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
