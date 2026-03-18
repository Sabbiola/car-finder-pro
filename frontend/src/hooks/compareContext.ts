import { createContext } from "react";

export interface CompareContextValue {
  compareIds: string[];
  addToCompare: (id: string) => void;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  isInCompare: (id: string) => boolean;
  canAdd: boolean;
}

export const CompareContext = createContext<CompareContextValue | null>(null);
