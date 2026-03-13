import type { SearchFiltersState } from "@/components/SearchFilters";
import { createRequestId } from "@/lib/requestId";
import { getRuntimeConfig } from "@/lib/runtimeConfig";
import { mapFastApiListing, type CarListing } from "@/lib/api/listings";

interface FavoriteRecord {
  listing_id: string;
}

interface FavoriteListResponse {
  favorites: FavoriteRecord[];
}

interface SavedSearchRecord {
  id: string;
  name: string;
  filters: SearchFiltersState;
  created_at: string;
}

interface SavedSearchListResponse {
  saved_searches: SavedSearchRecord[];
}

interface ListingsBatchResponse {
  listings: unknown[];
}

function apiBaseUrlOrThrow(): string {
  const config = getRuntimeConfig();
  if (config.backendMode !== "fastapi" || !config.apiBaseUrl) {
    throw new Error("Backend API unavailable in current runtime mode");
  }
  return config.apiBaseUrl.replace(/\/+$/, "");
}

async function callApi<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = apiBaseUrlOrThrow();
  const requestId = createRequestId("user-data");
  const hasBody = typeof init?.body !== "undefined";
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "x-request-id": requestId,
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`API call failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function listUserFavorites(userId: string): Promise<string[]> {
  const payload = await callApi<FavoriteListResponse>(`/api/user/favorites?user_id=${encodeURIComponent(userId)}`);
  return (payload.favorites || []).map((item) => item.listing_id).filter(Boolean);
}

export async function addUserFavorite(userId: string, listingId: string): Promise<string[]> {
  const payload = await callApi<FavoriteListResponse>("/api/user/favorites", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, listing_id: listingId }),
  });
  return (payload.favorites || []).map((item) => item.listing_id).filter(Boolean);
}

export async function removeUserFavorite(userId: string, listingId: string): Promise<string[]> {
  const payload = await callApi<FavoriteListResponse>(`/api/user/favorites/${encodeURIComponent(listingId)}`, {
    method: "DELETE",
    body: JSON.stringify({ user_id: userId }),
  });
  return (payload.favorites || []).map((item) => item.listing_id).filter(Boolean);
}

export async function listUserSavedSearches(userId: string): Promise<SavedSearchRecord[]> {
  const payload = await callApi<SavedSearchListResponse>(
    `/api/user/saved-searches?user_id=${encodeURIComponent(userId)}`,
  );
  return payload.saved_searches || [];
}

export async function createUserSavedSearch(
  userId: string,
  name: string,
  filters: SearchFiltersState,
): Promise<SavedSearchRecord> {
  return callApi<SavedSearchRecord>("/api/user/saved-searches", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, name, filters }),
  });
}

export async function deleteUserSavedSearch(userId: string, searchId: string): Promise<boolean> {
  const payload = await callApi<{ deleted: boolean }>(
    `/api/user/saved-searches/${encodeURIComponent(searchId)}`,
    {
      method: "DELETE",
      body: JSON.stringify({ user_id: userId }),
    },
  );
  return Boolean(payload.deleted);
}

export async function fetchListingsBatch(ids: string[]): Promise<CarListing[]> {
  if (!ids.length) return [];
  const payload = await callApi<ListingsBatchResponse>("/api/listings/batch", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
  return (payload.listings || []).map((item) =>
    mapFastApiListing(item as Parameters<typeof mapFastApiListing>[0]),
  );
}
