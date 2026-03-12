import { toLegacyProxyResponse } from "../_shared/proxy_contract.ts";

export type ProxyMode = "primary_with_fallback" | "fastapi_only" | "legacy_only";

export interface ProxyRuntime {
  fastApiSearchUrl: string | null;
  proxyMode: ProxyMode;
  forceLegacyOnly: boolean;
  attemptFastApi: boolean;
  fallbackAllowed: boolean;
}

export function resolveProxyRuntime(
  request: Request,
  envGet: (key: string) => string | undefined = (key) => Deno.env.get(key),
): ProxyRuntime {
  const fastApiSearchUrl = envGet("FASTAPI_SEARCH_URL")?.trim() || null;
  const rawMode = envGet("FASTAPI_PROXY_MODE")?.trim() || "primary_with_fallback";
  const forceLegacyOnly = request.headers.get("x-cf-legacy-only") === "1";
  const proxyMode = normalizeProxyMode(rawMode);

  const attemptFastApi = Boolean(fastApiSearchUrl) && !forceLegacyOnly && proxyMode !== "legacy_only";
  const fallbackAllowed = proxyMode === "primary_with_fallback";

  return {
    fastApiSearchUrl,
    proxyMode,
    forceLegacyOnly,
    attemptFastApi,
    fallbackAllowed,
  };
}

function normalizeProxyMode(mode: string): ProxyMode {
  if (mode === "fastapi_only" || mode === "legacy_only") return mode;
  return "primary_with_fallback";
}

export function buildFastApiPayload(filters: Record<string, unknown>): Record<string, unknown> {
  const asString = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
  };
  const asInt = (value: unknown): number | undefined => {
    if (typeof value !== "string" && typeof value !== "number") return undefined;
    const parsed = parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const brand = asString(filters.brand);
  const model = asString(filters.model);
  const fuel = asString(filters.fuel);
  const bodyType = asString(filters.bodyType);
  const query = [brand, model].filter(Boolean).join(" ").trim();

  return {
    query: query || undefined,
    brand,
    model,
    trim: asString(filters.trim),
    location: asString(filters.location),
    year_min: asInt(filters.yearMin),
    year_max: asInt(filters.yearMax),
    price_min: asInt(filters.priceMin),
    price_max: asInt(filters.priceMax),
    mileage_max: asInt(filters.kmMax),
    fuel_types: fuel ? [fuel] : undefined,
    body_styles: bodyType ? [bodyType] : undefined,
    private_only: filters.sellerType === "private",
    mode: "fast",
    sources: Array.isArray(filters.sources) && filters.sources.length > 0 ? filters.sources : undefined,
  };
}

export type FastApiProxyResult =
  | { kind: "success"; response: Response; source: "fastapi" }
  | { kind: "fallback"; error: string; source: "fallback_triggered" }
  | { kind: "error"; response: Response; source: "fastapi_error" }
  | { kind: "skipped"; source: "legacy" };

interface ExecuteFastApiProxyOptions {
  runtime: ProxyRuntime;
  filters: Record<string, unknown>;
  corsHeaders: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export async function executeFastApiProxy(
  options: ExecuteFastApiProxyOptions,
): Promise<FastApiProxyResult> {
  const { runtime, filters, corsHeaders, fetchImpl = fetch } = options;
  if (!runtime.attemptFastApi || !runtime.fastApiSearchUrl) {
    return { kind: "skipped", source: "legacy" };
  }

  const payload = buildFastApiPayload(filters);

  try {
    const fastApiResponse = await fetchImpl(runtime.fastApiSearchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!fastApiResponse.ok) {
      const responseBody = (await fastApiResponse.text()).slice(0, 180);
      throw new Error(`FastAPI error ${fastApiResponse.status}: ${responseBody}`);
    }

    const fastApiData = await fastApiResponse.json();
    const body = {
      ...toLegacyProxyResponse(fastApiData),
      source: "fastapi",
    };
    return {
      kind: "success",
      source: "fastapi",
      response: new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "FastAPI proxy failed";
    if (runtime.proxyMode === "fastapi_only") {
      return {
        kind: "error",
        source: "fastapi_error",
        response: new Response(
          JSON.stringify({
            success: false,
            error: message,
            source: "fastapi_error",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        ),
      };
    }
    return {
      kind: "fallback",
      source: "fallback_triggered",
      error: message,
    };
  }
}
