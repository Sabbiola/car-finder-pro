import type { SearchFiltersState } from "@/components/SearchFilters";
import type { SearchStreamEvent } from "@/features/search/types";
import { supabase } from "@/integrations/supabase/client";
import { getRuntimeConfig, type RuntimeConfig } from "@/lib/runtimeConfig";
import { streamSearch } from "@/services/api/searchStream";

export interface CarListing {
  id: string;
  title: string;
  brand: string;
  model: string;
  trim: string | null;
  year: number;
  price: number;
  km: number;
  fuel: string | null;
  transmission: string | null;
  power: string | null;
  color: string | null;
  doors: number | null;
  body_type: string | null;
  source: string;
  source_url: string | null;
  image_url: string | null;
  location: string | null;
  is_new: boolean;
  is_best_deal: boolean;
  price_rating: string | null;
  scraped_at: string;
  description?: string | null;
  emission_class?: string | null;
  version?: string | null;
  seats?: number | null;
  condition?: string | null;
  detail_scraped?: boolean;
  image_urls?: string[] | null;
  extra_data?: Record<string, unknown> | null;
}

interface FastApiVehicleListing {
  id?: string | null;
  provider: string;
  market?: string | null;
  url?: string | null;
  title: string;
  description?: string | null;
  price_amount: number;
  price_currency?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  mileage_value?: number | null;
  fuel_type?: string | null;
  transmission?: string | null;
  body_style?: string | null;
  seller_type?: string | null;
  city?: string | null;
  region?: string | null;
  images?: string[] | null;
  raw_payload?: Record<string, unknown> | null;
  deal_score?: number | null;
  reason_codes?: string[] | null;
  scraped_at?: string | null;
}

interface FastApiSearchResponse {
  total_results: number;
  listings: FastApiVehicleListing[];
  providers_used?: string[];
  provider_errors?: string[];
}

export interface FastApiSearchRequest {
  query?: string;
  brand?: string;
  model?: string;
  trim?: string;
  location?: string;
  year_min?: number;
  year_max?: number;
  price_min?: number;
  price_max?: number;
  mileage_max?: number;
  body_styles?: string[];
  fuel_types?: string[];
  condition?: string;
  private_only?: boolean;
  mode?: "fast" | "full";
  sources?: string[];
}

export const FASTAPI_CORE_SOURCES = ["autoscout24", "subito", "ebay"] as const;
const LEGACY_ONLY_SOURCES = ["automobile", "brumbrum"];

const mergedCacheByQuery = new Map<string, CarListing[]>();

function getCacheKey(filters: SearchFiltersState): string {
  const normalizedSources = [...(filters.sources || [])].sort();
  return JSON.stringify({ ...filters, sources: normalizedSources });
}

function shouldUseFastApi(config: RuntimeConfig): boolean {
  return config.backendMode === "fastapi" && !!config.apiBaseUrl;
}

function parseMaybeNumber(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeSources(filters: SearchFiltersState): string[] {
  return filters.sources?.length
    ? filters.sources
    : ["autoscout24", "subito", "ebay", "automobile", "brumbrum"];
}

function splitSources(filters: SearchFiltersState): { coreSources: string[]; legacySources: string[] } {
  const selected = normalizeSources(filters);
  const core = selected.filter((s) => FASTAPI_CORE_SOURCES.includes(s as (typeof FASTAPI_CORE_SOURCES)[number]));
  const legacy = selected.filter((s) => LEGACY_ONLY_SOURCES.includes(s));
  return { coreSources: core, legacySources: legacy };
}

export function buildFastApiRequest(filters: SearchFiltersState): FastApiSearchRequest {
  const query = [filters.brand, filters.model, filters.trim].filter(Boolean).join(" ").trim();
  return {
    query: query || undefined,
    brand: filters.brand || undefined,
    model: filters.model || undefined,
    trim: filters.trim || undefined,
    location: filters.location || undefined,
    year_min: parseMaybeNumber(filters.yearMin),
    year_max: parseMaybeNumber(filters.yearMax),
    price_min: parseMaybeNumber(filters.priceMin),
    price_max: parseMaybeNumber(filters.priceMax),
    mileage_max: parseMaybeNumber(filters.kmMax),
    body_styles: filters.bodyType ? [filters.bodyType] : undefined,
    fuel_types: filters.fuel ? [filters.fuel] : undefined,
    private_only: filters.sellerType === "private",
    mode: "fast",
    sources: normalizeSources(filters),
  };
}

export function mapFastApiListing(item: FastApiVehicleListing): CarListing {
  const fallbackId = `${item.provider}-${item.title}-${item.price_amount}`
    .toLowerCase()
    .replace(/\s+/g, "-")
    .slice(0, 120);
  const location = [item.city, item.region].filter(Boolean).join(", ");
  const score = item.deal_score ?? null;
  const priceRating = score === null ? null : score >= 80 ? "best" : score >= 60 ? "good" : "normal";

  return {
    id: item.id || fallbackId,
    title: item.title,
    brand: item.make || "",
    model: item.model || "",
    trim: item.trim || null,
    year: item.year || new Date().getFullYear(),
    price: item.price_amount,
    km: item.mileage_value || 0,
    fuel: item.fuel_type || null,
    transmission: item.transmission || null,
    power: null,
    color: null,
    doors: null,
    body_type: item.body_style || null,
    source: item.provider,
    source_url: item.url || null,
    image_url: item.images?.[0] || null,
    location: location || null,
    is_new: false,
    is_best_deal: score !== null ? score >= 75 : false,
    price_rating: priceRating,
    scraped_at: item.scraped_at || new Date().toISOString(),
    description: item.description || null,
    emission_class: null,
    version: null,
    seats: null,
    condition: item.seller_type || null,
    detail_scraped: false,
    image_urls: item.images || null,
    extra_data: {
      market: item.market || null,
      currency: item.price_currency || "EUR",
      reason_codes: item.reason_codes || [],
      raw_payload: item.raw_payload || null,
      deal_score: item.deal_score ?? null,
    },
  };
}

async function runFastApiSearch(filters: SearchFiltersState, apiBaseUrl: string): Promise<CarListing[]> {
  const response = await fetch(`${apiBaseUrl}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildFastApiRequest(filters)),
  });
  if (!response.ok) {
    throw new Error(`FastAPI search failed with status ${response.status}`);
  }
  const payload = (await response.json()) as FastApiSearchResponse;
  return (payload.listings || []).map(mapFastApiListing);
}

async function streamFastApiSearch(
  filters: SearchFiltersState,
  apiBaseUrl: string,
  onEvent: (event: SearchStreamEvent<CarListing>) => void,
  signal?: AbortSignal,
): Promise<void> {
  await streamSearch<FastApiSearchRequest, FastApiVehicleListing>({
    baseUrl: apiBaseUrl,
    payload: buildFastApiRequest(filters),
    signal,
    onEvent: (event) => {
      if (event.event === "result") {
        onEvent({ ...event, listing: mapFastApiListing(event.listing) });
      } else {
        onEvent(event as SearchStreamEvent<CarListing>);
      }
    },
  });
}

function mergeListings(...chunks: CarListing[][]): CarListing[] {
  const map = new Map<string, CarListing>();
  for (const chunk of chunks) {
    for (const listing of chunk) {
      const key = listing.source_url || `${listing.source}|${listing.title}|${listing.price}|${listing.year}`;
      if (!map.has(key)) map.set(key, listing);
    }
  }
  return [...map.values()];
}

async function scrapeLegacy(filters: SearchFiltersState) {
  const { data, error } = await supabase.functions.invoke("scrape-listings", {
    body: { filters },
  });
  if (error) throw error;
  return data;
}

async function fetchLegacyListings(filters: SearchFiltersState): Promise<CarListing[]> {
  let query = supabase.from("car_listings").select("*");

  if (filters.brand) query = query.eq("brand", filters.brand);
  if (filters.model) query = query.ilike("model", `%${filters.model}%`);
  if (filters.trim) query = query.ilike("trim", `%${filters.trim}%`);
  if (filters.fuel) query = query.eq("fuel", filters.fuel);
  if (filters.transmission) query = query.eq("transmission", filters.transmission);
  if (filters.isNew !== null && filters.isNew !== undefined) query = query.eq("is_new", filters.isNew);
  if (filters.location) query = query.ilike("location", `%${filters.location}%`);
  if (filters.priceMin) query = query.gte("price", Number(filters.priceMin));
  if (filters.priceMax) query = query.lte("price", Number(filters.priceMax));
  if (filters.kmMin) query = query.gte("km", Number(filters.kmMin));
  if (filters.kmMax) query = query.lte("km", Number(filters.kmMax));
  if (filters.yearMin && Number(filters.yearMin) > 0) query = query.gte("year", Number(filters.yearMin));
  if (filters.yearMax) query = query.lte("year", Number(filters.yearMax));
  if (filters.color) query = query.eq("color", filters.color);
  if (filters.doors) query = query.eq("doors", Number(filters.doors));
  if (filters.bodyType) query = query.eq("body_type", filters.bodyType);
  if (filters.emissionClass) query = query.eq("emission_class", filters.emissionClass);

  if (filters.sources?.length) {
    query = query.in("source", filters.sources);
  }

  const { data, error } = await query.order("price", { ascending: true }).limit(500);
  if (error) throw error;
  return (data as CarListing[]) || [];
}

function applyInMemoryFilters(listings: CarListing[], filters: SearchFiltersState): CarListing[] {
  return listings.filter((listing) => {
    if (filters.brand && listing.brand !== filters.brand) return false;
    if (filters.model && !listing.model.toLowerCase().includes(filters.model.toLowerCase())) return false;
    if (filters.trim && !(listing.trim || "").toLowerCase().includes(filters.trim.toLowerCase())) return false;
    if (filters.fuel && listing.fuel !== filters.fuel) return false;
    if (filters.transmission && listing.transmission !== filters.transmission) return false;
    if (filters.location && !(listing.location || "").toLowerCase().includes(filters.location.toLowerCase()))
      return false;
    if (filters.priceMin && listing.price < Number(filters.priceMin)) return false;
    if (filters.priceMax && listing.price > Number(filters.priceMax)) return false;
    if (filters.kmMin && listing.km < Number(filters.kmMin)) return false;
    if (filters.kmMax && listing.km > Number(filters.kmMax)) return false;
    if (filters.yearMin && listing.year < Number(filters.yearMin)) return false;
    if (filters.yearMax && listing.year > Number(filters.yearMax)) return false;
    if (filters.bodyType && listing.body_type !== filters.bodyType) return false;
    if (filters.sources?.length && !filters.sources.includes(listing.source)) return false;
    return true;
  });
}

function withSources(filters: SearchFiltersState, sources: string[]): SearchFiltersState {
  return { ...filters, sources };
}

export async function scrapeListings(filters: SearchFiltersState) {
  const cacheKey = getCacheKey(filters);
  const runtimeConfig = getRuntimeConfig();
  if (!shouldUseFastApi(runtimeConfig) || !runtimeConfig.apiBaseUrl) {
    return scrapeLegacy(filters);
  }

  const { coreSources, legacySources } = splitSources(filters);
  const chunks: CarListing[][] = [];
  const providerErrors: string[] = [];

  if (coreSources.length) {
    try {
      chunks.push(await runFastApiSearch(withSources(filters, coreSources), runtimeConfig.apiBaseUrl));
    } catch (error) {
      providerErrors.push(error instanceof Error ? error.message : "FastAPI search failed");
    }
  }

  if (legacySources.length || !coreSources.length) {
    try {
      await scrapeLegacy(withSources(filters, legacySources.length ? legacySources : normalizeSources(filters)));
      const legacyResults = await fetchLegacyListings(
        withSources(filters, legacySources.length ? legacySources : normalizeSources(filters)),
      );
      chunks.push(legacyResults);
    } catch (error) {
      providerErrors.push(error instanceof Error ? error.message : "Legacy search failed");
    }
  }

  const mergedCache = mergeListings(...chunks);
  mergedCacheByQuery.set(cacheKey, mergedCache);
  if (providerErrors.length && mergedCache.length === 0) {
    throw new Error(providerErrors.join(" | "));
  }

  return {
    success: true,
    count: mergedCache.length,
    source: coreSources.length && legacySources.length ? "hybrid" : coreSources.length ? "fastapi" : "legacy",
    provider_errors: providerErrors,
  };
}

export async function streamListings(
  filters: SearchFiltersState,
  onEvent: (event: SearchStreamEvent<CarListing>) => void,
  signal?: AbortSignal,
): Promise<void> {
  const runtimeConfig = getRuntimeConfig();
  if (!shouldUseFastApi(runtimeConfig) || !runtimeConfig.apiBaseUrl) {
    throw new Error("Streaming is available only in FastAPI mode");
  }
  const { coreSources } = splitSources(filters);
  if (!coreSources.length) {
    throw new Error("No FastAPI-migrated providers selected for streaming");
  }
  await streamFastApiSearch(withSources(filters, coreSources), runtimeConfig.apiBaseUrl, onEvent, signal);
}

export async function fetchListings(filters: SearchFiltersState): Promise<CarListing[]> {
  const runtimeConfig = getRuntimeConfig();
  if (shouldUseFastApi(runtimeConfig) && runtimeConfig.apiBaseUrl) {
    const cacheKey = getCacheKey(filters);
    let cached = mergedCacheByQuery.get(cacheKey);
    if (!cached?.length) {
      await scrapeListings(filters);
      cached = mergedCacheByQuery.get(cacheKey) || [];
    }
    return applyInMemoryFilters(cached, filters)
      .sort((a, b) => a.price - b.price)
      .slice(0, 500);
  }
  return fetchLegacyListings(filters);
}
