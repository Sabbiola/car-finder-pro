export const DEFAULT_SOURCE_SELECTION = [
  "autoscout24",
  "subito",
  "ebay",
  "automobile",
  "brumbrum",
] as const;

export const FASTAPI_CORE_SOURCES = [...DEFAULT_SOURCE_SELECTION] as const;

const FASTAPI_CORE_SOURCE_SET = new Set<string>(FASTAPI_CORE_SOURCES);

export interface FastApiSourcePartition {
  requestedSources: string[];
  supportedSources: string[];
  unsupportedSources: string[];
}

export function isFastApiSourceSupported(sourceId: string): boolean {
  return FASTAPI_CORE_SOURCE_SET.has(sourceId);
}

export function partitionSourcesForFastApi(
  selectedSources: string[],
  options?: { fallbackToDefault?: boolean },
): FastApiSourcePartition {
  const fallbackToDefault = options?.fallbackToDefault !== false;
  const requestedSources =
    selectedSources.length > 0
      ? selectedSources
      : fallbackToDefault
        ? [...DEFAULT_SOURCE_SELECTION]
        : [];

  const supportedSources = requestedSources.filter((sourceId) =>
    isFastApiSourceSupported(sourceId),
  );
  const unsupportedSources = requestedSources.filter(
    (sourceId) => !isFastApiSourceSupported(sourceId),
  );

  return {
    requestedSources,
    supportedSources,
    unsupportedSources,
  };
}
