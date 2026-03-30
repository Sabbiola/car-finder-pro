export type BackendMode = "supabase" | "fastapi";
export type RuntimeValueSource = "localStorage" | "env" | "fallback";

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
  hasBrowserOverrides: boolean;
}

const STORAGE_KEYS = {
  backendMode: "carfinder.backendMode",
  apiBaseUrl: "carfinder.apiBaseUrl",
} as const;

export const RUNTIME_CONFIG_CHANGED_EVENT = "carfinder.runtimeConfigChanged";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
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
      hasBrowserOverrides: false,
    };
  }

  const storedModeRaw = localStorage.getItem(STORAGE_KEYS.backendMode);
  const storedMode =
    storedModeRaw === "fastapi" || storedModeRaw === "supabase" ? storedModeRaw : null;
  const storedApiBaseUrl = normalizeUrl(localStorage.getItem(STORAGE_KEYS.apiBaseUrl));

  const hasStoredMode = storedMode !== null;
  const hasStoredApiBaseUrl = storedApiBaseUrl !== null;

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
    hasBrowserOverrides: hasStoredMode || hasStoredApiBaseUrl,
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
  localStorage.setItem(STORAGE_KEYS.backendMode, mode);
  dispatchRuntimeConfigChanged();
}

export function setRuntimeApiBaseUrl(url: string): void {
  if (!isBrowser()) {return;}
  const normalized = normalizeUrl(url);
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
  dispatchRuntimeConfigChanged();
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
