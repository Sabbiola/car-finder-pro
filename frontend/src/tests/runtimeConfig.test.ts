import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  getFastApiBaseUrlOrThrow,
  getRuntimeConfig,
  setRuntimeApiBaseUrl,
  setRuntimeBackendMode,
} from "@/lib/runtimeConfig";

describe("runtimeConfig", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("persists backend mode and API base URL with normalization", () => {
    setRuntimeBackendMode("fastapi");
    setRuntimeApiBaseUrl("http://localhost:8000///");

    const config = getRuntimeConfig();
    expect(config.backendMode).toBe("fastapi");
    expect(config.apiBaseUrl).toBe("http://localhost:8000");
  });

  it("removes API base URL when empty value is stored", () => {
    setRuntimeApiBaseUrl("http://localhost:8000");
    setRuntimeApiBaseUrl("   ");
    expect(localStorage.getItem("carfinder.apiBaseUrl")).toBeNull();
  });

  it("returns the normalized FastAPI URL when runtime is correctly configured", () => {
    setRuntimeBackendMode("fastapi");
    setRuntimeApiBaseUrl("http://localhost:8000/");

    expect(getFastApiBaseUrlOrThrow("runtime test")).toBe("http://localhost:8000");
  });

  it("throws when fastapi mode is selected without API base URL", () => {
    setRuntimeBackendMode("fastapi");
    setRuntimeApiBaseUrl("");

    expect(() => getFastApiBaseUrlOrThrow("runtime test")).toThrow(
      "runtime test requires VITE_API_BASE_URL when backendMode=fastapi.",
    );
  });

  it("resolves backendMode precedence as localStorage > env > fallback", () => {
    vi.stubEnv("VITE_BACKEND_MODE", "supabase");
    expect(getRuntimeConfig().backendMode).toBe("supabase");

    setRuntimeBackendMode("fastapi");
    expect(getRuntimeConfig().backendMode).toBe("fastapi");
  });

  it("resolves apiBaseUrl precedence as localStorage > env", () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://env-api.example.com/");
    expect(getRuntimeConfig().apiBaseUrl).toBe("https://env-api.example.com");

    setRuntimeApiBaseUrl("https://local-api.example.com//");
    expect(getRuntimeConfig().apiBaseUrl).toBe("https://local-api.example.com");
  });

  it("defaults to fastapi when VITE_BACKEND_MODE is missing", () => {
    expect(getRuntimeConfig().backendMode).toBe("fastapi");
  });
});
