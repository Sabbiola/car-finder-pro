import { getRuntimeConfig } from "@/lib/runtimeConfig";

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
}

export async function fetchFilterMetadata(): Promise<FilterMetadataResponse | null> {
  const config = getRuntimeConfig();
  if (config.backendMode !== "fastapi" || !config.apiBaseUrl) {
    return null;
  }

  const response = await fetch(`${config.apiBaseUrl}/api/filters/metadata`);
  if (!response.ok) {
    throw new Error(`Metadata fetch failed: ${response.status}`);
  }

  return (await response.json()) as FilterMetadataResponse;
}
