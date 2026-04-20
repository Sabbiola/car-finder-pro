import type {
  CarListing,
  ListingAnalysis,
  OwnershipProfile,
} from "@/lib/api/listings";
import { createRequestId } from "@/lib/requestId";

export interface AnalyzeListingPayload {
  listing_id?: string;
  listing?: Partial<CarListing>;
  include?: Array<"deal" | "trust" | "negotiation" | "ownership">;
  ownership_profile?: OwnershipProfile;
}

interface VehicleListingPayload {
  id?: string | null;
  provider: string;
  url?: string | null;
  title: string;
  description?: string | null;
  price_amount: number;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  mileage_value?: number | null;
  fuel_type?: string | null;
  transmission?: string | null;
  body_style?: string | null;
  condition?: string | null;
  is_new?: boolean | null;
  color?: string | null;
  doors?: number | null;
  emission_class?: string | null;
  seller_type?: string | null;
  city?: string | null;
  images?: string[] | null;
  seller_name?: string | null;
  seller_external_id?: string | null;
  seller_url?: string | null;
  seller_phone_hash?: string | null;
  listing_hash?: string | null;
  deal_score?: number | null;
  reason_codes?: string[];
  deal_summary?: CarListing["deal_summary"];
  trust_summary?: CarListing["trust_summary"];
  negotiation_summary?: CarListing["negotiation_summary"];
}

function toVehicleListingPayload(listing: Partial<CarListing>): VehicleListingPayload {
  const normalizedImages = Array.from(
    new Set(
      [listing.image_url, ...(listing.image_urls ?? [])].filter(
        (value): value is string => Boolean(value && value.trim().length > 0),
      ),
    ),
  );

  const [city] = (listing.location || "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return {
    id: listing.id ?? null,
    provider: listing.source || "autoscout24",
    url: listing.source_url ?? null,
    title: listing.title || "Annuncio",
    description: listing.description ?? null,
    price_amount: typeof listing.price === "number" ? listing.price : 0,
    year: listing.year ?? null,
    make: listing.brand ?? null,
    model: listing.model ?? null,
    trim: listing.trim ?? null,
    mileage_value: typeof listing.km === "number" ? listing.km : null,
    fuel_type: listing.fuel ?? null,
    transmission: listing.transmission ?? null,
    body_style: listing.body_type ?? null,
    condition: listing.condition ?? null,
    is_new: listing.is_new ?? null,
    color: listing.color ?? null,
    doors: listing.doors ?? null,
    emission_class: listing.emission_class ?? null,
    seller_type: listing.seller_type ?? null,
    city: city ?? null,
    images: normalizedImages,
    seller_name: listing.seller_name ?? null,
    seller_external_id: listing.seller_external_id ?? null,
    seller_url: listing.seller_url ?? null,
    seller_phone_hash: listing.seller_phone_hash ?? null,
    listing_hash: listing.listing_hash ?? null,
    deal_score: listing.deal_score ?? null,
    reason_codes: listing.reason_codes ?? [],
    deal_summary: listing.deal_summary ?? null,
    trust_summary: listing.trust_summary ?? null,
    negotiation_summary: listing.negotiation_summary ?? null,
  };
}

export interface OwnershipMetadataResponse {
  defaults: OwnershipProfile;
  insurance_bands: Array<"low" | "medium" | "high">;
  horizon_months_options: number[];
}

export async function analyzeListing(
  baseUrl: string,
  payload: AnalyzeListingPayload,
): Promise<ListingAnalysis> {
  const normalizedPayload = payload.listing
    ? {
        ...payload,
        listing: toVehicleListingPayload(payload.listing),
      }
    : payload;
  const requestId = createRequestId("listing-analysis");
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/listings/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify(normalizedPayload),
  });
  if (!response.ok) {
    let errDetail = "";
    try {
      const errBody = await response.json() as { detail?: unknown };
      if (Array.isArray(errBody?.detail)) {
        errDetail = (errBody.detail as Array<{ loc?: string[]; msg?: string }>)
          .map((e) => `${(e.loc ?? []).join(".")}: ${e.msg ?? ""}`)
          .join("; ");
      } else if (typeof errBody?.detail === "string") {
        errDetail = errBody.detail;
      }
    } catch { /* ignore */ }
    throw new Error(`Listing analysis failed: HTTP ${response.status}${errDetail ? ` — ${errDetail}` : ""}`);
  }
  return (await response.json()) as ListingAnalysis;
}

export async function fetchOwnershipMetadata(baseUrl: string): Promise<OwnershipMetadataResponse> {
  const requestId = createRequestId("ownership-metadata");
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/metadata/ownership`, {
    headers: { "x-request-id": requestId },
  });
  if (!response.ok) {
    throw new Error(`Ownership metadata failed: HTTP ${response.status}`);
  }
  return (await response.json()) as OwnershipMetadataResponse;
}
