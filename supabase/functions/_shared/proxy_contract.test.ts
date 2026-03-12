import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { toLegacyProxyResponse } from "./proxy_contract.ts";

Deno.test("toLegacyProxyResponse uses total_results when present", () => {
  const result = toLegacyProxyResponse({ total_results: 42, listings: [1, 2] });
  assertEquals(result.success, true);
  assertEquals(result.count, 42);
  assertEquals(result.source, "fastapi");
});

Deno.test("toLegacyProxyResponse falls back to listings length", () => {
  const result = toLegacyProxyResponse({ listings: [{}, {}, {}] });
  assertEquals(result.count, 3);
});

Deno.test("toLegacyProxyResponse keeps provider errors", () => {
  const result = toLegacyProxyResponse({ total_results: 1, provider_errors: ["subito timeout"] });
  assertEquals(result.provider_errors, ["subito timeout"]);
});
