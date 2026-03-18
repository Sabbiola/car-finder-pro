import { useContext } from "react";

import { CompareContext } from "@/hooks/compareContext";

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) {
    throw new Error("useCompare must be used inside CompareProvider");
  }
  return ctx;
}
