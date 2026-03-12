import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { assertMatch } from "https://deno.land/std@0.224.0/assert/assert_match.ts";
import {
  executeFastApiProxy,
  resolveProxyRuntime,
  type ProxyRuntime,
} from "./proxy_runtime.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
};

function envOf(values: Record<string, string>): (key: string) => string | undefined {
  return (key) => values[key];
}

Deno.test("resolveProxyRuntime honors legacy_only mode", () => {
  const request = new Request("https://edge.example.com");
  const runtime = resolveProxyRuntime(
    request,
    envOf({
      FASTAPI_SEARCH_URL: "https://api.example.com/api/search",
      FASTAPI_PROXY_MODE: "legacy_only",
    }),
  );
  assertEquals(runtime.proxyMode, "legacy_only");
  assertEquals(runtime.attemptFastApi, false);
  assertEquals(runtime.fallbackAllowed, false);
});

Deno.test("resolveProxyRuntime honors x-cf-legacy-only header", () => {
  const request = new Request("https://edge.example.com", {
    headers: { "x-cf-legacy-only": "1" },
  });
  const runtime = resolveProxyRuntime(
    request,
    envOf({
      FASTAPI_SEARCH_URL: "https://api.example.com/api/search",
      FASTAPI_PROXY_MODE: "primary_with_fallback",
    }),
  );
  assertEquals(runtime.forceLegacyOnly, true);
  assertEquals(runtime.attemptFastApi, false);
});

Deno.test("executeFastApiProxy returns fastapi response on success", async () => {
  const runtime: ProxyRuntime = {
    fastApiSearchUrl: "https://api.example.com/api/search",
    proxyMode: "primary_with_fallback",
    forceLegacyOnly: false,
    attemptFastApi: true,
    fallbackAllowed: true,
  };
  const result = await executeFastApiProxy({
    runtime,
    filters: { brand: "BMW", model: "320d" },
    corsHeaders: CORS_HEADERS,
    fetchImpl: () =>
      Promise.resolve(
        new Response(JSON.stringify({ total_results: 2, provider_errors: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
  });

  assertEquals(result.kind, "success");
  if (result.kind !== "success") return;
  assertEquals(result.source, "fastapi");
  const payload = await result.response.json();
  assertEquals(payload.success, true);
  assertEquals(payload.count, 2);
  assertEquals(payload.source, "fastapi");
});

Deno.test("executeFastApiProxy triggers fallback on backend down in primary_with_fallback", async () => {
  const runtime: ProxyRuntime = {
    fastApiSearchUrl: "https://api.example.com/api/search",
    proxyMode: "primary_with_fallback",
    forceLegacyOnly: false,
    attemptFastApi: true,
    fallbackAllowed: true,
  };
  const result = await executeFastApiProxy({
    runtime,
    filters: { brand: "BMW" },
    corsHeaders: CORS_HEADERS,
    fetchImpl: () => Promise.reject(new Error("backend down")),
  });

  assertEquals(result.kind, "fallback");
  if (result.kind !== "fallback") return;
  assertEquals(result.source, "fallback_triggered");
  assertMatch(result.error, /backend down/i);
});

Deno.test("executeFastApiProxy returns 502 in fastapi_only mode", async () => {
  const runtime: ProxyRuntime = {
    fastApiSearchUrl: "https://api.example.com/api/search",
    proxyMode: "fastapi_only",
    forceLegacyOnly: false,
    attemptFastApi: true,
    fallbackAllowed: false,
  };
  const result = await executeFastApiProxy({
    runtime,
    filters: { brand: "BMW" },
    corsHeaders: CORS_HEADERS,
    fetchImpl: () =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "provider core failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      ),
  });

  assertEquals(result.kind, "error");
  if (result.kind !== "error") return;
  assertEquals(result.source, "fastapi_error");
  assertEquals(result.response.status, 502);
  const payload = await result.response.json();
  assertEquals(payload.success, false);
  assertEquals(payload.source, "fastapi_error");
});

Deno.test("executeFastApiProxy skips fastapi in legacy_only mode", async () => {
  const runtime: ProxyRuntime = {
    fastApiSearchUrl: "https://api.example.com/api/search",
    proxyMode: "legacy_only",
    forceLegacyOnly: false,
    attemptFastApi: false,
    fallbackAllowed: false,
  };
  const result = await executeFastApiProxy({
    runtime,
    filters: { brand: "BMW" },
    corsHeaders: CORS_HEADERS,
  });
  assertEquals(result.kind, "skipped");
  if (result.kind !== "skipped") return;
  assertEquals(result.source, "legacy");
});
