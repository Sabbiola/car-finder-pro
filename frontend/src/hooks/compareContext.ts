import { createContext } from "react";
import type { CardListing } from "@/lib/toCardListing";

export interface CompareContextValue {
  compareIds: string[];
  compareListings: Record<string, CardListing>;
  addToCompare: (id: string, listing?: CardListing) => void;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  isInCompare: (id: string) => boolean;
  canAdd: boolean;
}

export const CompareContext = createContext<CompareContextValue | null>(null);
