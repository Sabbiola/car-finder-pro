import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

const MAX_COMPARE = 3;

interface CompareContextValue {
  compareIds: string[];
  addToCompare: (id: string) => void;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  isInCompare: (id: string) => boolean;
  canAdd: boolean;
}

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const addToCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id) || prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }, []);

  const removeFromCompare = useCallback((id: string) => {
    setCompareIds(prev => prev.filter(x => x !== id));
  }, []);

  const clearCompare = useCallback(() => setCompareIds([]), []);

  const isInCompare = useCallback((id: string) => compareIds.includes(id), [compareIds]);

  return (
    <CompareContext.Provider value={{
      compareIds, addToCompare, removeFromCompare, clearCompare, isInCompare,
      canAdd: compareIds.length < MAX_COMPARE,
    }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompare must be used inside CompareProvider');
  return ctx;
}
