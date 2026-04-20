import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Helmet } from "react-helmet-async";

import Header from "@/components/Header";
import ApiConfigBanner from "@/components/ApiConfigBanner";
import SearchFilters, { type SearchFiltersState } from "@/components/SearchFilters";
import CarCardSkeleton from "@/components/CarCardSkeleton";
import ActiveFilterChips from "@/components/ActiveFilterChips";
import SaveSearchDialog from "@/components/SaveSearchDialog";
import ListingResultCard from "@/features/results/components/ListingResultCard";
import AdCard from "@/components/AdCard";
import {
  SearchModeProviderNotice,
  SearchStreamDiagnostics,
} from "@/features/results/components/SearchProviderDiagnostics";
import SearchResultsToolbar from "@/features/results/components/SearchResultsToolbar";
import SearchStatsChips from "@/features/results/components/SearchStatsChips";
import { useSearchResultsOrchestration } from "@/features/results/hooks/useSearchResultsOrchestration";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { useSearchParams } from "react-router-dom";
import { PAGE_SIZE, VALID_SORT_OPTIONS, type SortOption } from "@/lib/constants";
import { DEFAULT_SOURCE_SELECTION } from "@/lib/providerSupport";
import { getRuntimeConfig } from "@/lib/runtimeConfig";

const ListingsMap = lazy(() => import("@/components/ListingsMap"));

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
  const sellerTypeParam = params.get("sellerType");
  const sellerType: SearchFiltersState["sellerType"] =
    sellerTypeParam === "all" || sellerTypeParam === "private" || sellerTypeParam === "dealer"
      ? sellerTypeParam
      : "all";
  const sourcesRaw = params.get("sources");
  const sources = sourcesRaw
    ? sourcesRaw.split(",").filter((s) => s.length > 0)
    : [...DEFAULT_SOURCE_SELECTION];

  return {
    brand: params.get("brand") ?? "",
    model: params.get("model") ?? "",
    trim: params.get("trim") ?? "",
    yearMin: params.get("yearMin") ?? "",
    yearMax: params.get("yearMax") ?? "",
    priceMin: params.get("priceMin") ?? "",
    priceMax: params.get("priceMax") ?? "",
    kmMin: params.get("kmMin") ?? "",
    kmMax: params.get("kmMax") ?? "",
    fuel: params.get("fuel") ?? "",
    transmission: params.get("transmission") ?? "",
    isNew: params.get("isNew") === "true" ? true : params.get("isNew") === "false" ? false : null,
    sources,
    color: params.get("color") ?? "",
    doors: params.get("doors") ?? "",
    bodyType: params.get("bodyType") ?? "",
    location: params.get("location") ?? "",
    sellerType,
    emissionClass: params.get("emissionClass") ?? "",
    powerMin: params.get("powerMin") ?? "",
    powerMax: params.get("powerMax") ?? "",
    maxKmPerYear: params.get("maxKmPerYear") ?? "",
  };
}

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sort, setSort] = useState<SortOption>(() => parseSortParam(searchParams.get("sort")));
  const [filters, setFilters] = useState<SearchFiltersState>(() => parseFiltersFromParams(searchParams));
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isFastApiMode = getRuntimeConfig().backendMode === "fastapi";
  const { save: saveSearch } = useSavedSearches();

  const {
    listings,
    loading,
    scraped,
    streamProviderStatus,
    streamProviderCount,
    streamErrors,
    modeUnsupportedVisibleSources,
    handleSearch,
    refreshSearch,
  } = useSearchResultsOrchestration({
    filters,
    setFilters,
    isFastApiMode,
  });

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
          const ra = order[a.price_rating ?? "normal"] ?? 2;
          const rb = order[b.price_rating ?? "normal"] ?? 2;
          return ra !== rb ? ra - rb : a.price - b.price;
        });
        break;
    }
    return list;
  }, [sort, listings]);

  const visibleResults = useMemo(() => results.slice(0, visibleCount), [results, visibleCount]);
  const hasMore = visibleCount < results.length;

  const stats = useMemo(() => {
    if (!results.length) {return null;}
    const prices = results.map((r) => r.price);
    const kms = results.map((r) => r.km).filter((k) => k > 0);
    const fuelCounts = results.reduce(
      (acc, r) => {
        if (r.fuel) {acc[r.fuel] = (acc[r.fuel] ?? 0) + 1;}
        return acc;
      },
      {} as Record<string, number>,
    );
    const fuelEntries = Object.entries(fuelCounts).sort((a, b) => b[1] - a[1]);
    const topFuel = fuelEntries.length > 0 ? fuelEntries[0] : null;
    return {
      minPrice: Math.min(...prices),
      avgPrice: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
      maxPrice: Math.max(...prices),
      avgKm: kms.length ? Math.round(kms.reduce((s, k) => s + k, 0) / kms.length) : null,
      topFuel: topFuel ? `${topFuel[0]} ${Math.round((topFuel[1] / results.length) * 100)}%` : null,
    };
  }, [results]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) {return;}
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {setVisibleCount((c) => c + PAGE_SIZE);}
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [listings, sort]);

  const { brand, model } = filters;
  const defaultSearchName = [brand, model].filter(Boolean).join(" ") || "Ricerca salvata";

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>
          {brand && model ? `${brand} ${model}` : brand || "Risultati ricerca"} - CarFinder Pro
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

        <SearchModeProviderNotice
          isFastApiMode={isFastApiMode}
          modeUnsupportedVisibleSources={modeUnsupportedVisibleSources}
        />

        <ActiveFilterChips filters={filters} onChange={handleSearch} />

        <SearchStreamDiagnostics
          streamProviderStatus={streamProviderStatus}
          streamProviderCount={streamProviderCount}
          streamErrors={streamErrors}
        />

        <SearchResultsToolbar
          loading={loading}
          scraped={scraped}
          resultsCount={results.length}
          listings={listings}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sort={sort}
          sortLabels={sortLabels}
          onSortChange={(nextSort) => {
            const parsedSort = parseSortParam(nextSort);
            setSort(parsedSort);
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev);
                next.set("sort", parsedSort);
                return next;
              },
              { replace: true },
            );
          }}
          onRefresh={refreshSearch}
          onSaveSearch={() => setSaveDialogOpen(true)}
        />

        <SaveSearchDialog
          open={saveDialogOpen}
          defaultName={defaultSearchName}
          onSave={(name, alertEnabled) => {
            void saveSearch(name, filters, alertEnabled);
          }}
          onClose={() => setSaveDialogOpen(false)}
        />

        <SearchStatsChips stats={stats} scraped={scraped} />

        {viewMode === "map" ? (
          <Suspense
            fallback={
              <div className="rounded-xl border border-border/70 bg-card p-6 text-center text-sm text-muted-foreground">
                Caricamento mappa...
              </div>
            }
          >
            <ListingsMap listings={results} />
          </Suspense>
        ) : loading && !scraped ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CarCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
            {visibleResults.map((listing, i) => (
              <Fragment key={listing.id}>
                <ListingResultCard listing={listing} index={i} />
                {(i + 1) % 6 === 0 && (
                  <AdCard slot="SLOT_RESULTS_CARD" />
                )}
              </Fragment>
            ))}
          </div>
        )}

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
              onClick={refreshSearch}
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
