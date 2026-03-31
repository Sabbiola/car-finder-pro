export type BackendMode = "supabase" | "fastapi";
export type RuntimeValueSource = "localStorage" | "env" | "fallback";
export type RuntimeOverrideRiskLevel = "none" | "local" | "protected";

export interface RuntimeConfig {
  backendMode: BackendMode;
  apiBaseUrl: string | null;
}

export interface RuntimeConfigDiagnostics {
  resolved: RuntimeConfig;
  sources: {
    backendMode: RuntimeValueSource;
    apiBaseUrl: RuntimeValueSource;
  };
  localStorageKeysPresent: {
    backendMode: boolean;
    apiBaseUrl: boolean;
  };
  hostname: string | null;
  browserOverrideFields: Array<"backendMode" | "apiBaseUrl">;
  overrideRiskLevel: RuntimeOverrideRiskLevel;
  requiresProtectedHostAck: boolean;
  hasBrowserOverrides: boolean;
}

const STORAGE_KEYS = {
  backendMode: "carfinder.backendMode",
  apiBaseUrl: "carfinder.apiBaseUrl",
} as const;
const SESSION_KEYS = {
  protectedHostOverrideAck: "carfinder.runtimeOverrideProtectedHostAck",
} as const;
let runtimeHostnameOverrideForTests: string | null = null;

export const RUNTIME_CONFIG_CHANGED_EVENT = "carfinder.runtimeConfigChanged";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function getRuntimeHostname(): string | null {
  if (runtimeHostnameOverrideForTests !== null) {
    return runtimeHostnameOverrideForTests;
  }
  if (!isBrowser()) {
    return null;
  }
  return window.location.hostname;
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {return false;}
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "[::1]"
  ) {
    return true;
  }
  if (/^127\./.test(normalized)) {return true;}
  if (/^10\./.test(normalized)) {return true;}
  if (/^192\.168\./.test(normalized)) {return true;}
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) {return true;}
  return false;
}

function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) {return null;}
  const trimmed = raw.trim();
  if (!trimmed) {return null;}
  return trimmed.replace(/\/+$/, "");
}

function resolveEnvBackendMode(): { value: BackendMode; source: Extract<RuntimeValueSource, "env" | "fallback"> } {
  const raw = import.meta.env.VITE_BACKEND_MODE as string | undefined;
  if (raw === "fastapi" || raw === "supabase") {
    return { value: raw, source: "env" };
  }
  // FastAPI-first default when env is missing or invalid.
  return { value: "fastapi", source: "fallback" };
}

function dispatchRuntimeConfigChanged(): void {
  if (!isBrowser()) {return;}
  window.dispatchEvent(new Event(RUNTIME_CONFIG_CHANGED_EVENT));
}

function hasProtectedHostOverrideAck(): boolean {
  if (!isBrowser() || typeof sessionStorage === "undefined") {return false;}
  return sessionStorage.getItem(SESSION_KEYS.protectedHostOverrideAck) === "1";
}

function clearProtectedHostOverrideAck(): void {
  if (!isBrowser() || typeof sessionStorage === "undefined") {return;}
  sessionStorage.removeItem(SESSION_KEYS.protectedHostOverrideAck);
}

function resolveRuntimeConfigDiagnostics(): RuntimeConfigDiagnostics {
  const envMode = resolveEnvBackendMode();
  const envApiBaseUrl = normalizeUrl(import.meta.env.VITE_API_BASE_URL as string | undefined);
  const envApiSource: RuntimeValueSource = envApiBaseUrl ? "env" : "fallback";

  if (!isBrowser()) {
    return {
      resolved: {
        backendMode: envMode.value,
        apiBaseUrl: envApiBaseUrl,
      },
      sources: {
        backendMode: envMode.source,
        apiBaseUrl: envApiSource,
      },
      localStorageKeysPresent: {
        backendMode: false,
        apiBaseUrl: false,
      },
      hostname: null,
      browserOverrideFields: [],
      overrideRiskLevel: "none",
      requiresProtectedHostAck: false,
      hasBrowserOverrides: false,
    };
  }

  const hostname = getRuntimeHostname();
  const isProtectedHost = hostname ? !isLocalHostname(hostname) : false;
  const storedModeRaw = localStorage.getItem(STORAGE_KEYS.backendMode);
  const storedMode =
    storedModeRaw === "fastapi" || storedModeRaw === "supabase" ? storedModeRaw : null;
  const storedApiBaseUrl = normalizeUrl(localStorage.getItem(STORAGE_KEYS.apiBaseUrl));

  const hasStoredMode = storedMode !== null;
  const hasStoredApiBaseUrl = storedApiBaseUrl !== null;
  const browserOverrideFields: Array<"backendMode" | "apiBaseUrl"> = [];
  if (hasStoredMode) {browserOverrideFields.push("backendMode");}
  if (hasStoredApiBaseUrl) {browserOverrideFields.push("apiBaseUrl");}
  const hasBrowserOverrides = browserOverrideFields.length > 0;
  const overrideRiskLevel: RuntimeOverrideRiskLevel =
    !hasBrowserOverrides ? "none" : isProtectedHost ? "protected" : "local";
  const requiresProtectedHostAck =
    overrideRiskLevel === "protected" && !hasProtectedHostOverrideAck();

  return {
    resolved: {
      backendMode: storedMode ?? envMode.value,
      apiBaseUrl: storedApiBaseUrl ?? envApiBaseUrl,
    },
    sources: {
      backendMode: hasStoredMode ? "localStorage" : envMode.source,
      apiBaseUrl: hasStoredApiBaseUrl ? "localStorage" : envApiSource,
    },
    localStorageKeysPresent: {
      backendMode: hasStoredMode,
      apiBaseUrl: hasStoredApiBaseUrl,
    },
    hostname,
    browserOverrideFields,
    overrideRiskLevel,
    requiresProtectedHostAck,
    hasBrowserOverrides,
  };
}

export function getRuntimeConfig(): RuntimeConfig {
  return resolveRuntimeConfigDiagnostics().resolved;
}

export function getRuntimeConfigDiagnostics(): RuntimeConfigDiagnostics {
  return resolveRuntimeConfigDiagnostics();
}

export function setRuntimeBackendMode(mode: BackendMode): void {
  if (!isBrowser()) {return;}
  clearProtectedHostOverrideAck();
  localStorage.setItem(STORAGE_KEYS.backendMode, mode);
  dispatchRuntimeConfigChanged();
}

export function setRuntimeApiBaseUrl(url: string): void {
  if (!isBrowser()) {return;}
  const normalized = normalizeUrl(url);
  clearProtectedHostOverrideAck();
  if (normalized) {
    localStorage.setItem(STORAGE_KEYS.apiBaseUrl, normalized);
  } else {
    localStorage.removeItem(STORAGE_KEYS.apiBaseUrl);
  }
  dispatchRuntimeConfigChanged();
}

export function clearRuntimeOverrides(): void {
  if (!isBrowser()) {return;}
  localStorage.removeItem(STORAGE_KEYS.backendMode);
  localStorage.removeItem(STORAGE_KEYS.apiBaseUrl);
  clearProtectedHostOverrideAck();
  dispatchRuntimeConfigChanged();
}

export function acknowledgeRuntimeOverridesForSession(): void {
  if (!isBrowser() || typeof sessionStorage === "undefined") {return;}
  sessionStorage.setItem(SESSION_KEYS.protectedHostOverrideAck, "1");
  dispatchRuntimeConfigChanged();
}

export function __setRuntimeHostnameOverrideForTests(hostname: string | null): void {
  runtimeHostnameOverrideForTests = hostname;
}

export function getFastApiBaseUrlOrThrow(context: string): string {
  const runtime = getRuntimeConfig();
  if (runtime.backendMode !== "fastapi") {
    throw new Error(`${context} requires backendMode=fastapi.`);
  }
  if (!runtime.apiBaseUrl) {
    throw new Error(`${context} requires VITE_API_BASE_URL when backendMode=fastapi.`);
  }
  return runtime.apiBaseUrl;
}
