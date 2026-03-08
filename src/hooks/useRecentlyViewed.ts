import { useState, useCallback } from "react";
import { MAX_RECENTLY_VIEWED } from "@/lib/constants";

const STORAGE_KEY = "car-finder-recent";

function readFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function useRecentlyViewed() {
  const [recentIds, setRecentIds] = useState<string[]>(readFromStorage);

  const addRecent = useCallback((id: string) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENTLY_VIEWED);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.warn("[useRecentlyViewed] Failed to persist to localStorage:", err);
      }
      return next;
    });
  }, []);

  return { recentIds, addRecent };
}
