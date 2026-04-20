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
  alertEnabled: boolean;
}

const LS_KEY = "savedSearches";

function readFromStorage(): SavedSearch[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is Record<string, unknown> => {
        if (!item || typeof item !== "object") {return false;}
        const c = item as Record<string, unknown>;
        return (
          typeof c.id === "string" &&
          typeof c.name === "string" &&
          typeof c.createdAt === "string" &&
          !!c.filters &&
          typeof c.filters === "object"
        );
      })
      .map((c) => ({
        id: c.id as string,
        name: c.name as string,
        filters: c.filters as SavedSearch["filters"],
        createdAt: c.createdAt as string,
        alertEnabled: Boolean(c.alertEnabled),
      }));
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
      void listUserSavedSearches(user.id)
        .then((data) =>
          setSearches(
            data.map((r) => ({
              id: r.id,
              name: r.name,
              filters: r.filters,
              createdAt: r.created_at,
              alertEnabled: r.alert_enabled ?? false,
            })),
          ),
        )
        .catch((error) => {
          console.error("[useSavedSearches] Failed to load saved searches via backend API:", error);
          setSearches([]);
        });
      return;
    }
    void supabase
      .from("user_saved_searches")
      .select("id, name, filters, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) {
          setSearches(
            data.map((r) => {
              const rawFilters = (r.filters ?? {}) as Record<string, unknown>;
              const alertEnabled = Boolean(rawFilters.__alert_enabled);
              const { __alert_enabled: _dropped, ...cleanFilters } = rawFilters;
              return {
                id: r.id,
                name: r.name,
                filters: cleanFilters as SearchFiltersState,
                createdAt: r.created_at,
                alertEnabled,
              };
            }),
          );
        }
      });
  }, [user, useBackendApi]);

  const save = async (name: string, filters: SearchFiltersState, alertEnabled = false) => {
    if (user) {
      if (useBackendApi) {
        const data = await createUserSavedSearch(user.id, name, filters, alertEnabled);
        const entry: SavedSearch = {
          id: data.id,
          name: data.name,
          filters: data.filters,
          createdAt: data.created_at,
          alertEnabled: data.alert_enabled ?? alertEnabled,
        };
        setSearches((prev) => [entry, ...prev].slice(0, 20));
        return;
      }
      const mergedFilters = { ...filters, __alert_enabled: alertEnabled };
      const { data } = await supabase
        .from("user_saved_searches")
        .insert({ user_id: user.id, name, filters: mergedFilters })
        .select("id, name, filters, created_at")
        .single();
      if (data) {
        const entry: SavedSearch = {
          id: data.id,
          name: data.name,
          filters: filters,
          createdAt: data.created_at,
          alertEnabled,
        };
        setSearches((prev) => [entry, ...prev].slice(0, 20));
      }
    } else {
      const entry: SavedSearch = {
        id: Date.now().toString(),
        name,
        filters,
        createdAt: new Date().toISOString(),
        alertEnabled,
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
