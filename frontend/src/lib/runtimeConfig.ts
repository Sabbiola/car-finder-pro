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
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

export function getRuntimeConfig(): RuntimeConfig {
  const envMode = import.meta.env.VITE_BACKEND_MODE === "fastapi" ? "fastapi" : "supabase";
  const envApiBaseUrl = normalizeUrl(import.meta.env.VITE_API_BASE_URL);

  if (!isBrowser()) {
    return { backendMode: envMode, apiBaseUrl: envApiBaseUrl };
  }

  const storedMode = localStorage.getItem(STORAGE_KEYS.backendMode);
  const storedApiBaseUrl = normalizeUrl(localStorage.getItem(STORAGE_KEYS.apiBaseUrl));

  const backendMode: BackendMode =
    storedMode === "fastapi" || storedMode === "supabase" ? storedMode : envMode;

  return {
    backendMode,
    apiBaseUrl: storedApiBaseUrl ?? envApiBaseUrl,
  };
}

export function setRuntimeBackendMode(mode: BackendMode): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEYS.backendMode, mode);
}

export function setRuntimeApiBaseUrl(url: string): void {
  if (!isBrowser()) return;
  const normalized = normalizeUrl(url);
  if (normalized) {
    localStorage.setItem(STORAGE_KEYS.apiBaseUrl, normalized);
  } else {
    localStorage.removeItem(STORAGE_KEYS.apiBaseUrl);
  }
}

