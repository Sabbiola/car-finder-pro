import type {
  CarListing,
  ListingAnalysis,
  OwnershipProfile,
} from "@/lib/api/listings";

export interface AnalyzeListingPayload {
  listing_id?: string;
  listing?: Partial<CarListing>;
  include?: Array<"deal" | "trust" | "negotiation" | "ownership">;
  ownership_profile?: OwnershipProfile;
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
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/listings/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Listing analysis failed: HTTP ${response.status}`);
  }
  return (await response.json()) as ListingAnalysis;
}

export async function fetchOwnershipMetadata(baseUrl: string): Promise<OwnershipMetadataResponse> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/metadata/ownership`);
  if (!response.ok) {
    throw new Error(`Ownership metadata failed: HTTP ${response.status}`);
  }
  return (await response.json()) as OwnershipMetadataResponse;
}
