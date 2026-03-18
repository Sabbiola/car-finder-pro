import { useState, useEffect } from "react";
import type { SearchFiltersState } from "@/components/SearchFilters";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/useAuth";
import { getRuntimeConfig } from "@/lib/runtimeConfig";
import {
  createUserSavedSearch,
  deleteUserSavedSearch,
  listUserSavedSearches,
} from "@/services/api/userData";

export interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFiltersState;
  createdAt: string;
}

const LS_KEY = "savedSearches";

function readFromStorage(): SavedSearch[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function useSavedSearches() {
  const { user } = useAuth();
  const runtimeConfig = getRuntimeConfig();
  const useBackendApi = runtimeConfig.backendMode === "fastapi";
  const [searches, setSearches] = useState<SavedSearch[]>(readFromStorage);

  // Load from Supabase when logged in
  useEffect(() => {
    if (!user) {
      setSearches(readFromStorage());
      return;
    }
    if (useBackendApi) {
      listUserSavedSearches(user.id)
        .then((data) =>
          setSearches(
            data.map((r) => ({
              id: r.id,
              name: r.name,
              filters: r.filters as SearchFiltersState,
              createdAt: r.created_at,
            })),
          ),
        )
        .catch((error) => {
          console.error("[useSavedSearches] Failed to load saved searches via backend API:", error);
          setSearches([]);
        });
      return;
    }
    supabase
      .from("user_saved_searches")
      .select("id, name, filters, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          setSearches(
            data.map((r) => ({
              id: r.id,
              name: r.name,
              filters: r.filters as SearchFiltersState,
              createdAt: r.created_at,
            })),
          );
        }
      });
  }, [user, useBackendApi]);

  const save = async (name: string, filters: SearchFiltersState) => {
    if (user) {
      if (useBackendApi) {
        const data = await createUserSavedSearch(user.id, name, filters);
        const entry: SavedSearch = {
          id: data.id,
          name: data.name,
          filters: data.filters as SearchFiltersState,
          createdAt: data.created_at,
        };
        setSearches((prev) => [entry, ...prev].slice(0, 20));
        return;
      }
      const { data } = await supabase
        .from("user_saved_searches")
        .insert({ user_id: user.id, name, filters })
        .select("id, name, filters, created_at")
        .single();
      if (data) {
        const entry: SavedSearch = {
          id: data.id,
          name: data.name,
          filters: data.filters as SearchFiltersState,
          createdAt: data.created_at,
        };
        setSearches((prev) => [entry, ...prev].slice(0, 20));
      }
    } else {
      const entry: SavedSearch = {
        id: Date.now().toString(),
        name,
        filters,
        createdAt: new Date().toISOString(),
      };
      const next = [entry, ...searches].slice(0, 10);
      setSearches(next);
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    }
  };

  const remove = async (id: string) => {
    if (user) {
      if (useBackendApi) {
        await deleteUserSavedSearch(user.id, id);
        setSearches((prev) => prev.filter((s) => s.id !== id));
        return;
      }
      await supabase.from("user_saved_searches").delete().eq("id", id).eq("user_id", user.id);
      setSearches((prev) => prev.filter((s) => s.id !== id));
    } else {
      const next = searches.filter((s) => s.id !== id);
      setSearches(next);
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    }
  };

  return { searches, save, remove };
}
