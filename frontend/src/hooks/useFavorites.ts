import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const LS_KEY = "car-finder-favorites";

function readFromStorage(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>(readFromStorage);

  // Load from Supabase when logged in, localStorage otherwise
  useEffect(() => {
    if (!user) {
      setFavorites(readFromStorage());
      return;
    }
    supabase
      .from("user_favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setFavorites(data.map((r: { listing_id: string }) => r.listing_id));
      });
  }, [user]);

  // Listen for localStorage changes when anonymous
  useEffect(() => {
    if (user) return;
    const handler = (e: StorageEvent) => {
      if (e.key === LS_KEY) setFavorites(readFromStorage());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [user]);

  const toggle = useCallback(
    async (id: string) => {
      if (user) {
        const isFav = favorites.includes(id);
        if (isFav) {
          await supabase
            .from("user_favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("listing_id", id);
          setFavorites((prev) => prev.filter((x) => x !== id));
        } else {
          await supabase.from("user_favorites").insert({ user_id: user.id, listing_id: id });
          setFavorites((prev) => [...prev, id]);
        }
      } else {
        setFavorites((prev) => {
          const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
          localStorage.setItem(LS_KEY, JSON.stringify(next));
          return next;
        });
      }
    },
    [user, favorites],
  );

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  return { favorites, toggle, isFavorite, count: favorites.length };
}
