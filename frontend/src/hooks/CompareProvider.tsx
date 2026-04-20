import { useCallback, useEffect, useState, type ReactNode } from "react";

import { MAX_COMPARE_ITEMS } from "@/lib/constants";
import { CompareContext } from "@/hooks/compareContext";
import type { CardListing } from "@/lib/toCardListing";

const STORAGE_KEY = "compare_ids";
const SNAPSHOTS_KEY = "compare_snapshots";

function loadFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]).slice(0, MAX_COMPARE_ITEMS) : [];
  } catch {
    return [];
  }
}

function loadSnapshotsFromStorage(): Record<string, CardListing> {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, CardListing>;
  } catch {
    return {};
  }
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compareIds, setCompareIds] = useState<string[]>(loadFromStorage);
  const [compareListings, setCompareListings] = useState<Record<string, CardListing>>(
    loadSnapshotsFromStorage,
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compareIds));
  }, [compareIds]);

  useEffect(() => {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(compareListings));
  }, [compareListings]);

  const addToCompare = useCallback((id: string, listing?: CardListing) => {
    setCompareIds((prev) => {
      if (prev.includes(id) || prev.length >= MAX_COMPARE_ITEMS) return prev;
      return [...prev, id];
    });
    if (listing) {
      setCompareListings((prev) => ({ ...prev, [id]: listing }));
    }
  }, []);

  const removeFromCompare = useCallback((id: string) => {
    setCompareIds((prev) => prev.filter((x) => x !== id));
    setCompareListings((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const clearCompare = useCallback(() => {
    setCompareIds([]);
    setCompareListings({});
  }, []);

  const isInCompare = useCallback((id: string) => compareIds.includes(id), [compareIds]);

  return (
    <CompareContext.Provider
      value={{
        compareIds,
        compareListings,
        addToCompare,
        removeFromCompare,
        clearCompare,
        isInCompare,
        canAdd: compareIds.length < MAX_COMPARE_ITEMS,
      }}
    >
      {children}
    </CompareContext.Provider>
  );
}
