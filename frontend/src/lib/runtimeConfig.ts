export type BackendMode = "supabase" | "fastapi";

export interface RuntimeConfig {
  backendMode: BackendMode;
  apiBaseUrl: string | null;
}

const STORAGE_KEYS = {
  backendMode: "carfinder.backendMode",
  apiBaseUrl: "carfinder.apiBaseUrl",
} as const;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) {return null;}
  const trimmed = raw.trim();
  if (!trimmed) {return null;}
  return trimmed.replace(/\/+$/, "");
}

function resolveEnvBackendMode(): BackendMode {
  const raw = import.meta.env.VITE_BACKEND_MODE as string | undefined;
  if (raw === "fastapi" || raw === "supabase") {
    return raw;
  }
  // FastAPI-first default when env is missing or invalid.
  return "fastapi";
}

export function getRuntimeConfig(): RuntimeConfig {
  const envMode = resolveEnvBackendMode();
  const envApiBaseUrl = normalizeUrl(import.meta.env.VITE_API_BASE_URL as string | undefined);

  if (!isBrowser()) {
    return { backendMode: envMode, apiBaseUrl: envApiBaseUrl };
  }

  const storedModeRaw = localStorage.getItem(STORAGE_KEYS.backendMode);
  const storedMode =
    storedModeRaw === "fastapi" || storedModeRaw === "supabase" ? storedModeRaw : null;
  const storedApiBaseUrl = normalizeUrl(localStorage.getItem(STORAGE_KEYS.apiBaseUrl));

  const backendMode: BackendMode = storedMode ?? envMode;

  return {
    backendMode,
    apiBaseUrl: storedApiBaseUrl ?? envApiBaseUrl,
  };
}

export function setRuntimeBackendMode(mode: BackendMode): void {
  if (!isBrowser()) {return;}
  localStorage.setItem(STORAGE_KEYS.backendMode, mode);
}

export function setRuntimeApiBaseUrl(url: string): void {
  if (!isBrowser()) {return;}
  const normalized = normalizeUrl(url);
  if (normalized) {
    localStorage.setItem(STORAGE_KEYS.apiBaseUrl, normalized);
  } else {
    localStorage.removeItem(STORAGE_KEYS.apiBaseUrl);
  }
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
