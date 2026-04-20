import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { SearchFiltersState } from "@/components/SearchFilters";
import {
  buildListingIdentityKey,
  fetchListings,
  reconcileListingsByResultKeys,
  scrapeListings,
  streamListings,
  type CarListing,
} from "@/lib/api/listings";
import { CACHE_TTL_HOURS } from "@/lib/constants";
import { sourceLabels } from "@/lib/mock-data";
import { partitionSourcesForFastApi } from "@/lib/providerSupport";
import { getRuntimeConfig } from "@/lib/runtimeConfig";
import { useToast } from "@/hooks/use-toast";

const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const SEARCH_CACHE_PREFIX = "carfinder.searchResults.v1:";

interface CachedSearchPayload {
  storedAt: number;
  listings: CarListing[];
}

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function buildSearchCacheKey(filters: SearchFiltersState): string {
  const normalizedSources = [...filters.sources].sort();
  return `${SEARCH_CACHE_PREFIX}${JSON.stringify({ ...filters, sources: normalizedSources })}`;
}

function readCachedSearch(filters: SearchFiltersState): CarListing[] | null {
  if (!canUseBrowserStorage()) {return null;}
  try {
    const raw = sessionStorage.getItem(buildSearchCacheKey(filters));
    if (!raw) {return null;}
    const parsed = JSON.parse(raw) as CachedSearchPayload;
    if (!parsed.storedAt || !Array.isArray(parsed.listings)) {return null;}
    if (Date.now() - parsed.storedAt > SEARCH_CACHE_TTL_MS) {
      sessionStorage.removeItem(buildSearchCacheKey(filters));
      return null;
    }
    return parsed.listings;
  } catch {
    return null;
  }
}

function writeCachedSearch(filters: SearchFiltersState, listings: CarListing[]): void {
  if (!canUseBrowserStorage()) {return;}
  try {
    const payload: CachedSearchPayload = {
      storedAt: Date.now(),
      listings,
    };
    sessionStorage.setItem(buildSearchCacheKey(filters), JSON.stringify(payload));
  } catch {
    // Ignore browser storage failures (quota/private mode).
  }
}

function mergeUniqueListings(left: CarListing[], right: CarListing[]): CarListing[] {
  const byKey: Record<string, CarListing> = {};
  for (const listing of [...left, ...right]) {
    const key = buildListingIdentityKey(listing);
    if (!Object.prototype.hasOwnProperty.call(byKey, key)) {
      byKey[key] = listing;
    }
  }
  return Object.values(byKey);
}

function formatSourceList(sourceIds: string[]): string {
  return sourceIds.map((sourceId) => sourceLabels[sourceId] ?? sourceId).join(", ");
}

interface UseSearchResultsOrchestrationArgs {
  filters: SearchFiltersState;
  setFilters: Dispatch<SetStateAction<SearchFiltersState>>;
  isFastApiMode: boolean;
}

interface UseSearchResultsOrchestrationResult {
  listings: CarListing[];
  loading: boolean;
  scraped: boolean;
  streamProviderStatus: Record<string, string>;
  streamProviderCount: Record<string, number>;
  streamErrors: string[];
  modeUnsupportedVisibleSources: string[];
  handleSearch: (newFilters: SearchFiltersState) => void;
  refreshSearch: () => void;
}

export function useSearchResultsOrchestration({
  filters,
  setFilters,
  isFastApiMode,
}: UseSearchResultsOrchestrationArgs): UseSearchResultsOrchestrationResult {
  const [listings, setListings] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [scraped, setScraped] = useState(false);
  const [streamProviderStatus, setStreamProviderStatus] = useState<Record<string, string>>({});
  const [streamProviderCount, setStreamProviderCount] = useState<Record<string, number>>({});
  const [streamErrors, setStreamErrors] = useState<string[]>([]);
  const [modeExcludedSources, setModeExcludedSources] = useState<string[]>([]);

  const activeRequestRef = useRef(0);
  const streamAbortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  const doSearch = useCallback(async (currentFilters: SearchFiltersState, forceRefresh = false) => {
    if (!currentFilters.brand) {
      streamAbortRef.current?.abort();
      setLoading(false);
      return;
    }
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    streamAbortRef.current?.abort();
    const streamController = new AbortController();
    streamAbortRef.current = streamController;
    const isStaleRequest = () => activeRequestRef.current !== requestId;

    setLoading(true);
    setStreamProviderStatus({});
    setStreamProviderCount({});
    setStreamErrors([]);
    try {
      const runtime = getRuntimeConfig();
      const useFastApiStream = runtime.backendMode === "fastapi";

      if (useFastApiStream) {
        if (!forceRefresh) {
          const cached = readCachedSearch(currentFilters);
          if (cached && cached.length > 0) {
            setModeExcludedSources([]);
            setListings(cached);
            setScraped(true);
            return;
          }
        }

        const { supportedSources, unsupportedSources } = partitionSourcesForFastApi(
          currentFilters.sources,
        );
        setModeExcludedSources(unsupportedSources);

        let streamedResults: CarListing[] = [];
        const streamErrorsLocal: string[] = [];

        if (!supportedSources.length) {
          throw new Error("Nessun provider FastAPI selezionato.");
        }

        await streamListings(
            { ...currentFilters, sources: supportedSources },
            (event) => {
              if (isStaleRequest()) {return;}
              if (event.event === "progress") {
                setStreamProviderStatus((prev) => ({ ...prev, [event.provider]: event.status }));
                if (event.status === "started") {
                  setStreamProviderCount((prev) => ({
                    ...prev,
                    [event.provider]: prev[event.provider] ?? 0,
                  }));
                }
              } else if (event.event === "result") {
                streamedResults = mergeUniqueListings(streamedResults, [event.listing]);
                setListings(streamedResults);
                setStreamProviderCount((prev) => ({
                  ...prev,
                  [event.listing.source]: (prev[event.listing.source] ?? 0) + 1,
                }));
              } else if (event.event === "complete") {
                if (event.final_result_keys?.length) {
                  streamedResults = reconcileListingsByResultKeys(streamedResults, event.final_result_keys);
                  setListings(streamedResults);
                }
              } else {
                const formatted =
                  event.code === "provider_excluded_unsupported_filter"
                    ? `${event.provider}: escluso per filtri non supportati`
                    : event.code === "no_provider_eligible_for_filters"
                      ? "Nessun provider eleggibile per i filtri attivi"
                      : `${event.provider ? `${event.provider}: ` : ""}${event.message}`;
                streamErrorsLocal.push(formatted);
                setStreamErrors((prev) => [...prev, formatted]);
              }
            },
            streamController.signal,
          );
        if (isStaleRequest()) {return;}

        const finalResults = streamedResults;
        setListings(finalResults);
        setScraped(true);
        writeCachedSearch(currentFilters, finalResults);
        toast({
          title: `${finalResults.length} annunci trovati`,
          description: streamErrorsLocal.length
            ? `Ricerca completata con ${streamErrorsLocal.length} errore/i runtime provider`
            : unsupportedSources.length
              ? `Streaming completato. Fonti escluse in fastapi mode: ${formatSourceList(unsupportedSources)}`
              : "Streaming completato",
        });
        return;
      }
      setModeExcludedSources([]);

      if (!forceRefresh) {
        const existing = await fetchListings(currentFilters);
        if (isStaleRequest()) {return;}
        if (existing.length > 0) {
          const newestTs = Math.max(...existing.map((l) => new Date(l.scraped_at).getTime()));
          const ageHours = (Date.now() - newestTs) / 3_600_000;
          if (ageHours < CACHE_TTL_HOURS) {
            setListings(existing);
            setScraped(true);
            setLoading(false);
            return;
          }
          setListings(existing);
          setScraped(true);
        }
      }
      toast({ title: "Ricerca in corso...", description: "Scraping annunci reali dai portali" });
      const result = await scrapeListings(currentFilters);
      if (isStaleRequest()) {return;}
      if (result.success) {
        const fresh = await fetchListings(currentFilters);
        if (isStaleRequest()) {return;}
        setListings(fresh);
        setScraped(true);
        toast({ title: `${fresh.length} annunci trovati` });
      } else {
        toast({
          title: "Errore",
          description: result.error ?? "Scraping fallito",
          variant: "destructive",
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      console.error("[SearchResults] Error fetching listings:", err);
      const message = err instanceof Error ? err.message : "Impossibile caricare gli annunci";
      toast({
        title: "Errore",
        description: message,
        variant: "destructive",
      });
    } finally {
      if (activeRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    void doSearch(filters);
  }, [doSearch, filters]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  const modeUnsupportedSelectedSources = useMemo(() => {
    if (!isFastApiMode) {return [];}
    return partitionSourcesForFastApi(filters.sources, { fallbackToDefault: false }).unsupportedSources;
  }, [filters.sources, isFastApiMode]);
  const modeUnsupportedVisibleSources = useMemo(() => {
    if (modeUnsupportedSelectedSources.length > 0) {
      return modeUnsupportedSelectedSources;
    }
    return modeExcludedSources;
  }, [modeExcludedSources, modeUnsupportedSelectedSources]);

  const handleSearch = useCallback((newFilters: SearchFiltersState) => {
    let nextFilters = newFilters;
    if (isFastApiMode) {
      const { supportedSources, unsupportedSources } = partitionSourcesForFastApi(newFilters.sources, {
        fallbackToDefault: false,
      });
      setModeExcludedSources(unsupportedSources);
      if (unsupportedSources.length > 0) {
        if (!supportedSources.length) {
          toast({
            title: "Nessuna fonte supportata in fastapi mode",
            description: `Fonti non disponibili: ${formatSourceList(unsupportedSources)}.`,
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Alcune fonti non disponibili in fastapi mode",
          description: `Escluse dalla ricerca: ${formatSourceList(unsupportedSources)}.`,
        });
        nextFilters = {
          ...newFilters,
          sources: supportedSources,
        };
      }
    } else {
      setModeExcludedSources([]);
    }
    setScraped(false);
    setListings([]);
    setFilters(nextFilters);
  }, [isFastApiMode, setFilters, toast]);

  const refreshSearch = useCallback(() => {
    void doSearch(filters, true);
  }, [doSearch, filters]);

  return {
    listings,
    loading,
    scraped,
    streamProviderStatus,
    streamProviderCount,
    streamErrors,
    modeUnsupportedVisibleSources,
    handleSearch,
    refreshSearch,
  };
}
