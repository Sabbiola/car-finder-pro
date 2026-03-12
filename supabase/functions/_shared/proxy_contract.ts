export interface FastApiSearchProxyResponse {
  total_results?: number;
  listings?: unknown[];
  provider_errors?: string[];
}

export interface LegacyProxyResponse {
  success: boolean;
  count: number;
  source: "fastapi";
  provider_errors: string[];
}

export function toLegacyProxyResponse(payload: FastApiSearchProxyResponse): LegacyProxyResponse {
  return {
    success: true,
    count: payload?.total_results ?? payload?.listings?.length ?? 0,
    source: "fastapi",
    provider_errors: payload?.provider_errors ?? [],
  };
}

