import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ArrowUpDown, Loader2, LayoutGrid, Map, Link2, Check } from "lucide-react";
import { Helmet } from "react-helmet-async";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Header from "@/components/Header";
import ApiConfigBanner from "@/components/ApiConfigBanner";
import SearchFilters, { SearchFiltersState } from "@/components/SearchFilters";
import CarCardSkeleton from "@/components/CarCardSkeleton";
import ActiveFilterChips from "@/components/ActiveFilterChips";
import ListingsMap from "@/components/ListingsMap";
import ListingResultCard from "@/features/results/components/ListingResultCard";
import { useSearchParams } from "react-router-dom";
import {
  FASTAPI_CORE_SOURCES,
  fetchListings,
  scrapeListings,
  streamListings,
  type CarListing,
} from "@/lib/api/listings";
import { useToast } from "@/hooks/use-toast";
import { sourceLabels, sourceColors } from "@/lib/mock-data";
import { VALID_SORT_OPTIONS, type SortOption, PAGE_SIZE, CACHE_TTL_HOURS } from "@/lib/constants";
import { getRuntimeConfig } from "@/lib/runtimeConfig";

const sortLabels: Record<SortOption, string> = {
  "price-asc": "Prezzo crescente",
  "price-desc": "Prezzo decrescente",
  "km-asc": "Km crescenti",
  "year-desc": "Anno recenti",
  "value-asc": "Miglior valore",
  "best-deal": "Migliori affari",
};

function parseSortParam(raw: string | null): SortOption {
  if (raw && (VALID_SORT_OPTIONS as readonly string[]).includes(raw)) {
    return raw as SortOption;
  }
  return "price-asc";
}

function parseFiltersFromParams(params: URLSearchParams): SearchFiltersState {
  const sourcesRaw = params.get("sources");
  const sources = sourcesRaw
    ? sourcesRaw.split(",").filter((s) => s.length > 0)
    : ["autoscout24", "subito", "ebay", "automobile", "brumbrum"];

  return {
    brand: params.get("brand") || "",
    model: params.get("model") || "",
    trim: params.get("trim") || "",
    yearMin: params.get("yearMin") || "",
    yearMax: params.get("yearMax") || "",
    priceMin: params.get("priceMin") || "",
    priceMax: params.get("priceMax") || "",
    kmMin: params.get("kmMin") || "",
    kmMax: params.get("kmMax") || "",
    fuel: params.get("fuel") || "",
    transmission: params.get("transmission") || "",
    isNew: params.get("isNew") === "true" ? true : params.get("isNew") === "false" ? false : null,
    sources,
    color: params.get("color") || "",
    doors: params.get("doors") || "",
    bodyType: params.get("bodyType") || "",
    location: params.get("location") || "",
    sellerType: (params.get("sellerType") as "all" | "private" | "dealer") || "all",
    emissionClass: params.get("emissionClass") || "",
  };
}

function mergeUniqueListings(left: CarListing[], right: CarListing[]): CarListing[] {
  const map = new Map<string, CarListing>();
  for (const listing of [...left, ...right]) {
    const key = listing.source_url || `${listing.source}|${listing.title}|${listing.price}|${listing.year}`;
    if (!map.has(key)) map.set(key, listing);
  }
  return [...map.values()];
}

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sort, setSort] = useState<SortOption>(() => parseSortParam(searchParams.get("sort")));
  const [filters, setFilters] = useState<SearchFiltersState>(() => parseFiltersFromParams(searchParams));
  const [listings, setListings] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [scraped, setScraped] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [copied, setCopied] = useState(false);
  const [streamProviderStatus, setStreamProviderStatus] = useState<Record<string, string>>({});
  const [streamProviderCount, setStreamProviderCount] = useState<Record<string, number>>({});
  const [streamErrors, setStreamErrors] = useState<string[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);
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
      const useFastApiStream = runtime.backendMode === "fastapi" && !!runtime.apiBaseUrl;

      if (useFastApiStream) {
        const selectedSources = currentFilters.sources?.length
          ? currentFilters.sources
          : ["autoscout24", "subito", "ebay", "automobile", "brumbrum"];
        const coreSources = selectedSources.filter((s) => FASTAPI_CORE_SOURCES.includes(s as (typeof FASTAPI_CORE_SOURCES)[number]));
        const legacySources = selectedSources.filter((s) => !coreSources.includes(s));

        let streamedResults: CarListing[] = [];
        const streamErrorsLocal: string[] = [];

        if (coreSources.length) {
          await streamListings(
            { ...currentFilters, sources: coreSources },
            (event) => {
              if (isStaleRequest()) return;
              if (event.event === "progress") {
                setStreamProviderStatus((prev) => ({ ...prev, [event.provider]: event.status }));
                if (typeof event.fetched_count === "number") {
                  setStreamProviderCount((prev) => ({ ...prev, [event.provider]: event.fetched_count || 0 }));
                }
              } else if (event.event === "result") {
                streamedResults = mergeUniqueListings(streamedResults, [event.listing]);
                setListings(streamedResults);
              } else if (event.event === "error") {
                streamErrorsLocal.push(event.message);
                setStreamErrors((prev) => [...prev, event.message]);
              }
            },
            streamController.signal,
          );
        }

        let legacyResults: CarListing[] = [];
        if (legacySources.length) {
          const legacyFilters = { ...currentFilters, sources: legacySources };
          await scrapeListings(legacyFilters);
          if (isStaleRequest()) return;
          legacyResults = await fetchListings(legacyFilters);
        }
        if (isStaleRequest()) return;

        const finalResults = mergeUniqueListings(streamedResults, legacyResults);
        setListings(finalResults);
        setScraped(true);
        toast({
          title: `${finalResults.length} annunci trovati`,
          description: streamErrorsLocal.length
            ? `Ricerca completata con ${streamErrorsLocal.length} errore/i parziale/i`
            : "Streaming completato",
        });
        return;
      }

      if (!forceRefresh) {
        const existing = await fetchListings(currentFilters);
        if (isStaleRequest()) return;
        if (existing.length > 0) {
          const newestTs = Math.max(...existing.map((l) => new Date(l.scraped_at).getTime()));
          const ageHours = (Date.now() - newestTs) / 3_600_000;
          if (ageHours < CACHE_TTL_HOURS) {
            setListings(existing);
            setScraped(true);
            setLoading(false);
            return;
          }
          // Cache stale: show existing while re-scraping in background
          setListings(existing);
          setScraped(true);
        }
      }
      toast({ title: "Ricerca in corso...", description: "Scraping annunci reali dai portali" });
      const result = await scrapeListings(currentFilters);
      if (isStaleRequest()) return;
      if (result?.success) {
        const fresh = await fetchListings(currentFilters);
        if (isStaleRequest()) return;
        setListings(fresh);
        setScraped(true);
        toast({ title: `${fresh.length} annunci trovati` });
      } else {
        toast({
          title: "Errore",
          description: result?.error || "Scraping fallito",
          variant: "destructive",
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      console.error("[SearchResults] Error fetching listings:", err);
      toast({
        title: "Errore",
        description: "Impossibile caricare gli annunci",
        variant: "destructive",
      });
    } finally {
      if (activeRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    doSearch(filters);
  }, [doSearch, filters]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  const handleSearch = (newFilters: SearchFiltersState) => {
    setScraped(false);
    setListings([]);
    setFilters(newFilters);
  };

  const results = useMemo(() => {
    const list = [...listings];
    const currentYear = new Date().getFullYear();
    switch (sort) {
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "km-asc":
        list.sort((a, b) => a.km - b.km);
        break;
      case "year-desc":
        list.sort((a, b) => b.year - a.year);
        break;
      case "value-asc":
        list.sort((a, b) => {
          const scoreA = a.price / (currentYear - a.year + 1);
          const scoreB = b.price / (currentYear - b.year + 1);
          return scoreA - scoreB;
        });
        break;
      case "best-deal":
        list.sort((a, b) => {
          const order: Record<string, number> = { best: 0, good: 1, normal: 2 };
          const ra = order[a.price_rating || "normal"] ?? 2;
          const rb = order[b.price_rating || "normal"] ?? 2;
          return ra !== rb ? ra - rb : a.price - b.price;
        });
        break;
    }
    return list;
  }, [sort, listings]);

  const visibleResults = useMemo(() => results.slice(0, visibleCount), [results, visibleCount]);
  const hasMore = visibleCount < results.length;

  const stats = useMemo(() => {
    if (!results.length) return null;
    const prices = results.map((r) => r.price);
    const kms = results.map((r) => r.km).filter((k) => k > 0);
    const fuelCounts = results.reduce(
      (acc, r) => {
        if (r.fuel) acc[r.fuel] = (acc[r.fuel] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const topFuel = Object.entries(fuelCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      minPrice: Math.min(...prices),
      avgPrice: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
      maxPrice: Math.max(...prices),
      avgKm: kms.length ? Math.round(kms.reduce((s, k) => s + k, 0) / kms.length) : null,
      topFuel: topFuel ? `${topFuel[0]} ${Math.round((topFuel[1] / results.length) * 100)}%` : null,
    };
  }, [results]);

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) setVisibleCount((c) => c + PAGE_SIZE);
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  // Reset visible count when results change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [listings, sort]);

  const { brand, model } = filters;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>
          {brand && model ? `${brand} ${model}` : brand || "Risultati ricerca"} - AutoDeal Finder
        </title>
        <meta
          name="description"
          content={`Confronta ${listings.length} offerte${brand ? ` ${brand}` : ""}${model ? ` ${model}` : ""} da AutoScout24, Subito.it e altri.`}
        />
      </Helmet>
      <Header />
      <div className="container py-6 space-y-6">
        <ApiConfigBanner />

        <div className="animate-brutal-in">
          <SearchFilters compact onSearch={handleSearch} initialFilters={filters} />
        </div>

        <ActiveFilterChips filters={filters} onChange={handleSearch} />

        {(Object.keys(streamProviderStatus).length > 0 || streamErrors.length > 0) && (
          <div className="rounded-xl border border-border/70 bg-card p-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {Object.entries(streamProviderStatus).map(([provider, status]) => (
                <span key={provider} className="text-[11px] px-2 py-1 rounded-full bg-muted text-foreground">
                  {provider}: {status}
                  {typeof streamProviderCount[provider] === "number"
                    ? ` (${streamProviderCount[provider]})`
                    : ""}
                </span>
              ))}
            </div>
            {streamErrors.length > 0 && (
              <p className="text-xs text-destructive">
                Errori provider: {streamErrors.join(" | ")}
              </p>
            )}
          </div>
        )}

        <div
          className="flex items-center justify-between border-b border-border pb-3 animate-brutal-up"
          style={{ animationDelay: "100ms" }}
        >
          <div className="flex items-center gap-3">
            {loading && !scraped ? (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Ricerca in corso...
              </span>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{results.length}</span> risultati
                </p>
                {scraped && results.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {Object.keys(sourceLabels).map((src) => {
                      const count = listings.filter((l) => l.source === src).length;
                      return (
                        <span
                          key={src}
                          className={`text-[9px] font-semibold px-2 py-0.5 rounded-full text-white ${count > 0 ? sourceColors[src] : "bg-muted text-muted-foreground"}`}
                          style={count === 0 ? { opacity: 0.4 } : undefined}
                          title={`${sourceLabels[src]}: ${count} annunci`}
                        >
                          {sourceLabels[src]
                            .replace("AutoScout24", "AS24")
                            .replace("Automobile.it", "Auto.it")
                            .replace("Subito.it", "Subito")
                            .replace("eBay Motors", "eBay")
                            .replace("Brumbrum", "BB")}
                          : {count}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {loading && scraped && results.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Aggiornamento...
              </span>
            )}
            {!loading && scraped && (
              <button
                onClick={() => doSearch(filters, true)}
                className="text-xs text-muted-foreground hover:text-accent hover:underline transition-colors"
              >
                Aggiorna
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle - segmented control */}
            <div className="flex items-center gap-0.5 bg-muted p-0.5 rounded-lg">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                aria-label="Vista griglia"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "map" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                aria-label="Vista mappa"
              >
                <Map className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Copy link */}
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Copia link ricerca"
              aria-label="Copia link"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
            </button>

            <Select
              value={sort}
              onValueChange={(v) => {
                const s = parseSortParam(v);
                setSort(s);
                setSearchParams(
                  (prev) => {
                    prev.set("sort", s);
                    return prev;
                  },
                  { replace: true },
                );
              }}
            >
              <SelectTrigger className="w-40 bg-card text-xs rounded-lg border">
                <ArrowUpDown className="h-3 w-3 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border shadow-lg">
                {Object.entries(sortLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {stats && scraped && (
          <div className="flex flex-wrap gap-2 animate-brutal-in">
            {[
              { label: "Min", value: `EUR ${stats.minPrice.toLocaleString("it-IT")}` },
              { label: "Media", value: `EUR ${stats.avgPrice.toLocaleString("it-IT")}` },
              { label: "Max", value: `EUR ${stats.maxPrice.toLocaleString("it-IT")}` },
              ...(stats.avgKm
                ? [{ label: "Km medi", value: stats.avgKm.toLocaleString("it-IT") }]
                : []),
              ...(stats.topFuel ? [{ label: "Carburante", value: stats.topFuel }] : []),
            ].map(({ label, value }) => (
              <span
                key={label}
                className="text-xs bg-muted px-3 py-1.5 rounded-full text-muted-foreground"
              >
                {label} <strong className="text-foreground">{value}</strong>
              </span>
            ))}
          </div>
        )}

        {viewMode === "map" ? (
          <ListingsMap listings={results} />
        ) : loading && !scraped ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CarCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
            {visibleResults.map((listing, i) => (
              <ListingResultCard key={listing.id} listing={listing} index={i} />
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel - grid mode only */}
        {viewMode === "grid" && (
          <>
            <div ref={sentinelRef} className="h-4" />
            {hasMore && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && scraped && results.length > 0 && !hasMore && (
              <p className="text-center text-xs text-muted-foreground py-4">
                Tutti i {results.length} risultati caricati
              </p>
            )}
          </>
        )}

        {!loading && scraped && results.length === 0 && (
          <div className="text-center py-16 text-muted-foreground space-y-2">
            <p className="text-sm font-semibold text-foreground">Nessun risultato</p>
            <p className="text-xs">Modifica i filtri di ricerca o cambia brand/modello</p>
            <button
              onClick={() => doSearch(filters, true)}
              className="text-xs text-violet-600 hover:underline mt-2 block mx-auto"
            >
              Riprova
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
