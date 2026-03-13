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

export interface OwnershipMetadataResponse {
  defaults: OwnershipProfile;
  insurance_bands: Array<"low" | "medium" | "high">;
  horizon_months_options: number[];
}

export async function analyzeListing(
  baseUrl: string,
  payload: AnalyzeListingPayload,
): Promise<ListingAnalysis> {
  const requestId = createRequestId("listing-analysis");
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/listings/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Listing analysis failed: HTTP ${response.status}`);
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
