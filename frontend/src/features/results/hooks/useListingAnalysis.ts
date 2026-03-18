import { useQuery } from "@tanstack/react-query";

import type {
  CarListing,
  ListingAnalysis,
  OwnershipProfile,
} from "@/lib/api/listings";
import { getFastApiBaseUrlOrThrow, getRuntimeConfig } from "@/lib/runtimeConfig";
import { analyzeListing, fetchOwnershipMetadata } from "@/services/api/listingAnalysis";

interface UseListingAnalysisParams {
  listingId?: string | null;
  listing?: CarListing | null;
  include?: Array<"deal" | "trust" | "negotiation" | "ownership">;
  ownershipProfile?: OwnershipProfile;
  enabled?: boolean;
}

export function useListingAnalysis({
  listingId,
  listing,
  include = ["deal", "trust", "negotiation", "ownership"],
  ownershipProfile,
  enabled = true,
}: UseListingAnalysisParams) {
  const runtime = getRuntimeConfig();
  const canFetch = runtime.backendMode === "fastapi" && enabled;

  return useQuery<ListingAnalysis | null>({
    queryKey: ["listing-analysis", listingId || listing?.id || listing?.source_url || "inline", include, ownershipProfile],
    enabled: canFetch && Boolean(listingId || listing),
    queryFn: async () => {
      return analyzeListing(getFastApiBaseUrlOrThrow("Listing analysis"), {
        listing_id: listingId || undefined,
        listing: listingId ? undefined : listing || undefined,
        include,
        ownership_profile: ownershipProfile,
      });
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useOwnershipMetadata(enabled = true) {
  const runtime = getRuntimeConfig();
  const canFetch = runtime.backendMode === "fastapi" && enabled;
  return useQuery({
    queryKey: ["ownership-metadata"],
    enabled: canFetch,
    queryFn: async () => {
      return fetchOwnershipMetadata(getFastApiBaseUrlOrThrow("Ownership metadata"));
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}
