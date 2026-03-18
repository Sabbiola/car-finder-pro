import { getFastApiBaseUrlOrThrow, getRuntimeConfig } from "@/lib/runtimeConfig";
import { createRequestId } from "@/lib/requestId";

export interface FilterMetadataResponse {
  fuel_types?: string[];
  body_styles?: string[];
  conditions?: string[];
  markets?: string[];
  brands?: string[];
  models_by_brand?: Record<string, string[]>;
  trims_by_brand_model?: Record<string, Record<string, string[]>>;
  providers?: Array<{
    id: string;
    name: string;
    enabled: boolean;
    configured?: boolean;
    market?: string;
    provider_type?: "official_api" | "partner_api" | "html_scraper" | "browser_scraper";
    supports_filters?: string[];
  }>;
  search_contract?: {
    version: string;
    canonical_filters: string[];
    backend_post_filters: string[];
    provider_filter_union: string[];
    provider_filter_intersection: string[];
    provider_filter_semantics: "strict_all_active_non_post_filters";
  };
}

function assertCanonicalSearchContract(payload: FilterMetadataResponse): void {
  const contract = payload.search_contract;
  if (!contract) {
    throw new Error("Metadata payload missing search_contract.");
  }
  if (!Array.isArray(contract.provider_filter_union)) {
    throw new Error("Metadata payload missing provider_filter_union.");
  }
  if (!Array.isArray(contract.provider_filter_intersection)) {
    throw new Error("Metadata payload missing provider_filter_intersection.");
  }
  if (contract.provider_filter_semantics !== "strict_all_active_non_post_filters") {
    throw new Error("Metadata payload has unsupported provider_filter_semantics.");
  }
}

export async function fetchFilterMetadata(): Promise<FilterMetadataResponse | null> {
  const config = getRuntimeConfig();
  if (config.backendMode !== "fastapi") {
    return null;
  }
  const baseUrl = getFastApiBaseUrlOrThrow("Filter metadata");

  const requestId = createRequestId("filters-metadata");
  const response = await fetch(`${baseUrl}/api/filters/metadata`, {
    headers: { "x-request-id": requestId },
  });
  if (!response.ok) {
    throw new Error(`Metadata fetch failed: ${response.status}`);
  }

  const payload = (await response.json()) as FilterMetadataResponse;
  assertCanonicalSearchContract(payload);
  return payload;
}
