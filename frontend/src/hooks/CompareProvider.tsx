import { useCallback, useState, type ReactNode } from "react";

import { MAX_COMPARE_ITEMS } from "@/lib/constants";
import { CompareContext } from "@/hooks/compareContext";

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const addToCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id) || prev.length >= MAX_COMPARE_ITEMS) {
        return prev;
      }
      return [...prev, id];
    });
  }, []);

  const removeFromCompare = useCallback((id: string) => {
    setCompareIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const clearCompare = useCallback(() => setCompareIds([]), []);

  const isInCompare = useCallback((id: string) => compareIds.includes(id), [compareIds]);

  return (
    <CompareContext.Provider
      value={{
        compareIds,
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
