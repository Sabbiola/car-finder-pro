const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

const DEFAULT_ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";
const DEFAULT_ALLOWED_METHODS = "GET,POST,OPTIONS";

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS")?.trim();
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  return getAllowedOrigins().includes(origin);
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": Deno.env.get("ALLOWED_HEADERS") || DEFAULT_ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": Deno.env.get("ALLOWED_METHODS") || DEFAULT_ALLOWED_METHODS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
