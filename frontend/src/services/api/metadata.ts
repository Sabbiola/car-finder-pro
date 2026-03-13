import { getRuntimeConfig } from "@/lib/runtimeConfig";
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
    provider_filter_intersection?: string[];
    provider_filter_semantics?: string;
  };
}

export async function fetchFilterMetadata(): Promise<FilterMetadataResponse | null> {
  const config = getRuntimeConfig();
  if (config.backendMode !== "fastapi" || !config.apiBaseUrl) {
    return null;
  }

  const requestId = createRequestId("filters-metadata");
  const response = await fetch(`${config.apiBaseUrl}/api/filters/metadata`, {
    headers: { "x-request-id": requestId },
  });
  if (!response.ok) {
    throw new Error(`Metadata fetch failed: ${response.status}`);
  }

  return (await response.json()) as FilterMetadataResponse;
}
