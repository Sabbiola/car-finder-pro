import { describe, expect, it } from "vitest";

import {
  DEFAULT_SOURCE_SELECTION,
  isFastApiSourceSupported,
  partitionSourcesForFastApi,
  sanitizeSourcesForFastApi,
} from "@/lib/providerSupport";

describe("providerSupport", () => {
  it("classifies supported and unsupported sources in fastapi mode", () => {
    const partition = partitionSourcesForFastApi(["autoscout24", "legacy-source"], {
      fallbackToDefault: false,
    });

    expect(partition.requestedSources).toEqual(["autoscout24", "legacy-source"]);
    expect(partition.supportedSources).toEqual(["autoscout24"]);
    expect(partition.unsupportedSources).toEqual(["legacy-source"]);
  });

  it("uses default source selection when fallback is enabled and selection is empty", () => {
    const partition = partitionSourcesForFastApi([]);

    expect(partition.requestedSources).toEqual([...DEFAULT_SOURCE_SELECTION]);
    expect(partition.supportedSources).toEqual([...DEFAULT_SOURCE_SELECTION]);
    expect(partition.unsupportedSources).toEqual([]);
  });

  it("keeps empty selection when fallback is disabled", () => {
    const partition = partitionSourcesForFastApi([], { fallbackToDefault: false });

    expect(partition.requestedSources).toEqual([]);
    expect(partition.supportedSources).toEqual([]);
    expect(partition.unsupportedSources).toEqual([]);
  });

  it("checks source support explicitly", () => {
    expect(isFastApiSourceSupported("autoscout24")).toBe(true);
    expect(isFastApiSourceSupported("legacy-source")).toBe(false);
  });

  it("sanitizes unsupported sources preserving only fastapi-supported ids", () => {
    const sanitized = sanitizeSourcesForFastApi(["legacy-source", "autoscout24", "legacy-source"]);

    expect(sanitized.sanitizedSources).toEqual(["autoscout24"]);
    expect(sanitized.removedSources).toEqual(["legacy-source"]);
  });
});
