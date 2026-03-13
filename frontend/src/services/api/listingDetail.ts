import {
  mapFastApiListing,
  type CarListing,
  type ListingAnalysis,
} from "@/lib/api/listings";
import { createRequestId } from "@/lib/requestId";

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
  seller_name?: string | null;
  seller_external_id?: string | null;
  seller_url?: string | null;
  seller_phone_hash?: string | null;
  listing_hash?: string | null;
  deal_summary?: CarListing["deal_summary"];
  trust_summary?: CarListing["trust_summary"];
  negotiation_summary?: CarListing["negotiation_summary"];
}

interface ListingPriceHistoryPoint {
  price: number;
  recorded_at: string;
}

interface FastApiListingDetailResponse {
  listing: FastApiVehicleListing;
  analysis?: ListingAnalysis | null;
  similar_listings?: FastApiVehicleListing[];
  price_samples?: FastApiVehicleListing[];
  price_history?: ListingPriceHistoryPoint[];
  resolved_by?: "id" | "source_url" | string;
}

export interface ListingDetailContext {
  listing: CarListing;
  analysis: ListingAnalysis | null;
  similarListings: CarListing[];
  priceSamples: CarListing[];
  priceHistory: Array<{ price: number; recorded_at: string }>;
  resolvedBy: string;
}

export async function fetchListingDetailContext(
  baseUrl: string,
  params: {
    listingId: string;
    sourceUrl?: string | null;
    includeAnalysis?: boolean;
  },
): Promise<ListingDetailContext> {
  const endpoint = new URL(`${baseUrl.replace(/\/+$/, "")}/api/listings/${encodeURIComponent(params.listingId)}`);
  endpoint.searchParams.set("include_context", "true");
  endpoint.searchParams.set("include_analysis", params.includeAnalysis ? "true" : "false");
  if (params.sourceUrl) {
    endpoint.searchParams.set("source_url", params.sourceUrl);
  }

  const requestId = createRequestId("listing-detail");
  const response = await fetch(endpoint.toString(), {
    headers: { "x-request-id": requestId },
  });
  if (!response.ok) {
    throw new Error(`Listing detail failed: HTTP ${response.status}`);
  }
  const payload = (await response.json()) as FastApiListingDetailResponse;

  return {
    listing: mapFastApiListing(payload.listing),
    analysis: payload.analysis || null,
    similarListings: (payload.similar_listings || []).map(mapFastApiListing),
    priceSamples: (payload.price_samples || []).map(mapFastApiListing),
    priceHistory: (payload.price_history || []).map((row) => ({
      price: row.price,
      recorded_at: row.recorded_at,
    })),
    resolvedBy: payload.resolved_by || "id",
  };
}
