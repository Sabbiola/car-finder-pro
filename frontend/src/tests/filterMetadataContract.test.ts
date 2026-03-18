import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/runtimeConfig", () => ({
  getRuntimeConfig: () => ({
    backendMode: "fastapi",
    apiBaseUrl: "https://api.example.com",
  }),
  getFastApiBaseUrlOrThrow: () => "https://api.example.com",
}));

import { fetchFilterMetadata } from "@/services/api/metadata";

describe("fetchFilterMetadata contract", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts canonical metadata payload with strict semantics", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        providers: [],
        search_contract: {
          version: "v1",
          canonical_filters: ["brand", "seller_type"],
          backend_post_filters: ["seller_type"],
          provider_filter_union: ["brand", "seller_type"],
          provider_filter_intersection: ["brand"],
          provider_filter_semantics: "strict_all_active_non_post_filters",
        },
      }),
    } as unknown as Response);

    const payload = await fetchFilterMetadata();
    expect(payload?.search_contract?.provider_filter_union).toEqual(["brand", "seller_type"]);
    expect(payload?.search_contract?.provider_filter_intersection).toEqual(["brand"]);
    expect(payload?.search_contract?.provider_filter_semantics).toBe(
      "strict_all_active_non_post_filters",
    );
  });

  it("fails fast when canonical search_contract fields are missing", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        providers: [],
        search_contract: {
          version: "v1",
          canonical_filters: ["brand"],
          backend_post_filters: [],
          provider_filter_union: ["brand"],
        },
      }),
    } as unknown as Response);

    await expect(fetchFilterMetadata()).rejects.toThrow(
      "Metadata payload missing provider_filter_intersection.",
    );
  });
});

