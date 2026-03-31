import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  __setRuntimeHostnameOverrideForTests,
  acknowledgeRuntimeOverridesForSession,
  clearRuntimeOverrides,
  getFastApiBaseUrlOrThrow,
  getRuntimeConfig,
  getRuntimeConfigDiagnostics,
  setRuntimeApiBaseUrl,
  setRuntimeBackendMode,
} from "@/lib/runtimeConfig";

describe("runtimeConfig", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    __setRuntimeHostnameOverrideForTests(null);
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    __setRuntimeHostnameOverrideForTests(null);
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

  it("exposes resolution diagnostics with source per field", () => {
    vi.stubEnv("VITE_BACKEND_MODE", "supabase");
    vi.stubEnv("VITE_API_BASE_URL", "https://env-api.example.com/");

    setRuntimeBackendMode("fastapi");
    setRuntimeApiBaseUrl("https://local-api.example.com//");

    const diagnostics = getRuntimeConfigDiagnostics();
    expect(diagnostics.resolved.backendMode).toBe("fastapi");
    expect(diagnostics.resolved.apiBaseUrl).toBe("https://local-api.example.com");
    expect(diagnostics.sources.backendMode).toBe("localStorage");
    expect(diagnostics.sources.apiBaseUrl).toBe("localStorage");
    expect(diagnostics.localStorageKeysPresent.backendMode).toBe(true);
    expect(diagnostics.localStorageKeysPresent.apiBaseUrl).toBe(true);
    expect(diagnostics.browserOverrideFields).toEqual(["backendMode", "apiBaseUrl"]);
    expect(diagnostics.overrideRiskLevel).toBe("local");
    expect(diagnostics.requiresProtectedHostAck).toBe(false);
    expect(diagnostics.hasBrowserOverrides).toBe(true);
  });

  it("can clear runtime browser overrides explicitly", () => {
    vi.stubEnv("VITE_BACKEND_MODE", "supabase");
    vi.stubEnv("VITE_API_BASE_URL", "https://env-api.example.com/");

    setRuntimeBackendMode("fastapi");
    setRuntimeApiBaseUrl("https://local-api.example.com");
    expect(getRuntimeConfigDiagnostics().hasBrowserOverrides).toBe(true);

    clearRuntimeOverrides();
    const diagnostics = getRuntimeConfigDiagnostics();
    expect(diagnostics.hasBrowserOverrides).toBe(false);
    expect(diagnostics.resolved.backendMode).toBe("supabase");
    expect(diagnostics.resolved.apiBaseUrl).toBe("https://env-api.example.com");
  });

  it("marks browser overrides on non-local hosts as protected risk until acknowledged", () => {
    __setRuntimeHostnameOverrideForTests("staging.carfinderpro.app");

    setRuntimeBackendMode("supabase");
    setRuntimeApiBaseUrl("https://api-staging.carfinderpro.app");

    const diagnostics = getRuntimeConfigDiagnostics();
    expect(diagnostics.hostname).toBe("staging.carfinderpro.app");
    expect(diagnostics.overrideRiskLevel).toBe("protected");
    expect(diagnostics.requiresProtectedHostAck).toBe(true);
    expect(diagnostics.hasBrowserOverrides).toBe(true);
  });

  it("can acknowledge protected-host overrides for the current browser session", () => {
    __setRuntimeHostnameOverrideForTests("staging.carfinderpro.app");
    setRuntimeBackendMode("fastapi");

    expect(getRuntimeConfigDiagnostics().requiresProtectedHostAck).toBe(true);
    acknowledgeRuntimeOverridesForSession();
    expect(getRuntimeConfigDiagnostics().requiresProtectedHostAck).toBe(false);
  });
});
