import { useCallback, useEffect, useState } from "react";
import type { CarListing } from "@/lib/api/listings";
import { getFastApiBaseUrlOrThrow, getRuntimeConfig } from "@/lib/runtimeConfig";
import { toCardListing } from "@/lib/toCardListing";
import { fetchListingDetailContext } from "@/services/api/listingDetail";
import { supabase } from "@/integrations/supabase/client";

export interface ExtendedListing extends CarListing {
  description?: string | null;
  emission_class?: string | null;
  version?: string | null;
  seats?: number | null;
  condition?: string | null;
  detail_scraped?: boolean;
  image_urls?: string[] | null;
  extra_data?: Record<string, unknown> | null;
}

export function snapshotToExtendedListing(
  snapshot: Record<string, unknown> | null | undefined,
  fallbackId: string,
): ExtendedListing {
  const getString = (key: string): string | null => {
    const value = snapshot?.[key];
    return typeof value === "string" ? value : null;
  };
  const getNumber = (key: string): number | null => {
    const value = snapshot?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  const getBoolean = (key: string): boolean | null => {
    const value = snapshot?.[key];
    return typeof value === "boolean" ? value : null;
  };

  const imageUrl = getString("imageUrl");
  const rawImageUrls = snapshot?.["imageUrls"];
  const allImageUrls: string[] = Array.isArray(rawImageUrls)
    ? (rawImageUrls as unknown[]).filter((v): v is string => typeof v === "string" && v.length > 0)
    : imageUrl
      ? [imageUrl]
      : [];
  return {
    id: fallbackId,
    title: getString("title") || "Annuncio",
    brand: getString("brand") || "",
    model: getString("model") || "",
    trim: null,
    year: getNumber("year") || new Date().getFullYear(),
    price: getNumber("price") || 0,
    km: getNumber("km") || 0,
    fuel: getString("fuel"),
    transmission: getString("transmission"),
    power: getString("power"),
    color: getString("color"),
    doors: getNumber("doors"),
    body_type: getString("bodyType"),
    source: getString("source") || "autoscout24",
    source_url: getString("url"),
    image_url: allImageUrls[0] ?? imageUrl,
    location: getString("location"),
    is_new: false,
    is_best_deal: getBoolean("isBestDeal") || false,
    price_rating: getString("priceRating"),
    scraped_at: new Date().toISOString(),
    description: null,
    emission_class: getString("emissionClass"),
    version: null,
    seats: null,
    condition: getString("condition"),
    detail_scraped: false,
    image_urls: allImageUrls.length > 0 ? allImageUrls : null,
    extra_data: null,
    seller_type: getString("sellerType"),
  };
}

export interface ListingDetailState {
  car: ExtendedListing | null;
  similar: CarListing[];
  allPrices: CarListing[];
  priceHistory: Array<{ price: number; recorded_at: string }>;
  loading: boolean;
  detailLoading: boolean;
  fetchError: string | null;
  resolvedUrl: string | null;
}

export function useListingDetail(
  id: string | undefined,
  sourceUrlFromState: string | null,
  listingSnapshot: unknown,
  onLoaded: (carId: string) => void,
): ListingDetailState {
  const [car, setCar] = useState<ExtendedListing | null>(null);
  const [similar, setSimilar] = useState<CarListing[]>([]);
  const [allPrices, setAllPrices] = useState<CarListing[]>([]);
  const [priceHistory, setPriceHistory] = useState<Array<{ price: number; recorded_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  const stableOnLoaded = useCallback(onLoaded, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id) { return; }

    let cancelled = false;

    const fetchCar = async () => {
      setLoading(true);
      setDetailLoading(true);
      setFetchError(null);
      setResolvedUrl(sourceUrlFromState);

      try {
        const runtime = getRuntimeConfig();
        if (runtime.backendMode === "fastapi") {
          const detail = await fetchListingDetailContext(getFastApiBaseUrlOrThrow("Listing detail"), {
            listingId: id,
            sourceUrl: sourceUrlFromState,
            includeAnalysis: false,
          });
          if (cancelled) { return; }

          const detailListing: ExtendedListing = {
            ...detail.listing,
            description: detail.listing.description || null,
            emission_class: detail.listing.emission_class || null,
            version: detail.listing.version || null,
            seats: detail.listing.seats || null,
            condition: detail.listing.condition || null,
            detail_scraped: true,
            image_urls: detail.listing.image_urls ?? null,
            extra_data: detail.listing.extra_data ?? null,
          };

          setCar(detailListing);
          stableOnLoaded(detailListing.id);
          setSimilar(detail.similarListings);
          setAllPrices(detail.priceSamples);
          setPriceHistory(detail.priceHistory);
          setResolvedUrl(detail.listing.source_url || sourceUrlFromState);
          return;
        }

        const { data } = await supabase.from("car_listings").select("*").eq("id", id).single();
        if (cancelled) { return; }
        if (!data) {
          setFetchError("Auto non trovata o errore nel caricamento.");
          return;
        }

        const carData = data as ExtendedListing;
        setCar(carData);
        stableOnLoaded(carData.id);

        const [similarRes, pricesRes, historyRes] = await Promise.all([
          supabase.from("car_listings").select("*").eq("brand", data.brand).eq("model", data.model).neq("id", data.id).limit(6),
          supabase.from("car_listings").select("*").eq("brand", data.brand).eq("model", data.model).order("price", { ascending: true }).limit(20),
          supabase.from("price_history").select("price, recorded_at").eq("listing_id", data.id).order("recorded_at", { ascending: true }).limit(30),
        ]);

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (cancelled) { return; }
        setSimilar((similarRes.data as CarListing[] | null) ?? []);
        setAllPrices((pricesRes.data as CarListing[] | null) ?? []);
        setPriceHistory(historyRes.data ?? []);

        let listingUrl = carData.source_url && carData.source_url !== "#" ? carData.source_url : null;
        if (!listingUrl && carData.source === "autoscout24" && carData.image_url) {
          const idMatch = carData.image_url.match(/listing-images\/([a-f0-9-]{36})/);
          if (idMatch) {
            const slug = carData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            listingUrl = `https://www.autoscout24.it/annunci/${slug}-${idMatch[1]}`;
          }
        }
        if (listingUrl) { setResolvedUrl(listingUrl); }
      } catch (error) {
        if (cancelled) { return; }
        console.error("[CarDetail] Unexpected fetch error:", error);
        if (listingSnapshot) {
          const fallback = snapshotToExtendedListing(listingSnapshot as Record<string, unknown>, id);
          setCar(fallback);
          stableOnLoaded(fallback.id);
          setSimilar([]);
          setAllPrices([]);
          setPriceHistory([]);
          setResolvedUrl(fallback.source_url || sourceUrlFromState);
          setFetchError(null);
        } else {
          setFetchError(
            error instanceof Error ? error.message : "Errore imprevisto nel caricamento dell'auto.",
          );
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
          setLoading(false);
        }
      }
    };

    void fetchCar();
    return () => {
      cancelled = true;
    };
  }, [id, listingSnapshot, sourceUrlFromState, stableOnLoaded]);

  return { car, similar, allPrices, priceHistory, loading, detailLoading, fetchError, resolvedUrl };
}

export interface AutomobileExtras {
  metallic?: string;
  interior_color?: string;
  interior_design?: string;
  fuel_urban?: string;
  fuel_extra?: string;
  fuel_mixed?: string;
  co2?: string;
  roadworthy?: string;
}

export function parseDetailPayload(extraData: Record<string, unknown> | null | undefined): {
  specs: Array<{ label: string; value: string }>;
  equipment: string[];
  automobileExtras: AutomobileExtras;
} {
  const rawPayload = extraData?.raw_payload;
  if (!rawPayload || typeof rawPayload !== "object") {
    return { specs: [], equipment: [], automobileExtras: {} };
  }
  const payload = rawPayload as Record<string, unknown>;

  const autoscout = payload.autoscout;
  if (autoscout && typeof autoscout === "object") {
    const autoscoutRecord = autoscout as Record<string, unknown>;
    const specsObj = autoscoutRecord.specs;
    const equipmentObj = autoscoutRecord.equipment;
    const specs: Array<{ label: string; value: string }> = [];
    if (specsObj && typeof specsObj === "object") {
      for (const [label, value] of Object.entries(specsObj as Record<string, unknown>)) {
        if (typeof value === "string" && value.trim().length > 0) {
          specs.push({ label, value: value.trim() });
        }
      }
    }
    const equipment = Array.isArray(equipmentObj)
      ? equipmentObj.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    return { specs: specs.slice(0, 20), equipment: equipment.slice(0, 30), automobileExtras: {} };
  }

  const equipmentDirect = payload.equipment;
  const equipment = Array.isArray(equipmentDirect)
    ? equipmentDirect.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  const getString = (key: string) => {
    const val = payload[key];
    return typeof val === "string" && val.trim() ? val.trim() : undefined;
  };

  const automobileExtras: AutomobileExtras = {
    metallic: getString("metallic"),
    interior_color: getString("interior_color"),
    interior_design: getString("interior_design"),
    fuel_urban: getString("fuel_urban"),
    fuel_extra: getString("fuel_extra"),
    fuel_mixed: getString("fuel_mixed"),
    co2: getString("co2"),
    roadworthy: getString("roadworthy"),
  };

  return { specs: [], equipment: equipment.slice(0, 40), automobileExtras };
}

export function buildGalleryImages(car: ExtendedListing): string[] {
  const { FALLBACK_IMAGE } = { FALLBACK_IMAGE: "/placeholder.jpg" };

  const normalize = (raw: string) => {
    let value = raw.startsWith("//") ? `https:${raw}` : raw;
    if (value.includes("images.sbito.it") && value.includes("rule=")) {
      value = value.replace(/rule=[^&]+/, "rule=fullscreen-1x-auto");
    }
    if (value.includes("autoscout24.net/listing-images/")) {
      value = value.replace(/\/\d+x\d+(\.\w+)$/, "/800x600$1");
    }
    return value;
  };

  const rawMainImage = typeof car.image_url === "string" ? car.image_url : "";
  const normalizedMainImage = normalize(rawMainImage);
  const main = normalizedMainImage.length > 0 ? normalizedMainImage : FALLBACK_IMAGE;
  const extras = (car.image_urls ?? [])
    .map(normalize)
    .filter((url): url is string => Boolean(url && url !== main));
  return [main, ...extras];
}

export { toCardListing };
