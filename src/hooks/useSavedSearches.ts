import { useState } from 'react';
import type { SearchFiltersState } from '@/components/SearchFilters';

export interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFiltersState;
  createdAt: string;
}

const KEY = 'savedSearches';

export function useSavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  });

  const save = (name: string, filters: SearchFiltersState) => {
    const entry: SavedSearch = { id: Date.now().toString(), name, filters, createdAt: new Date().toISOString() };
    const next = [entry, ...searches].slice(0, 10);
    setSearches(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const remove = (id: string) => {
    const next = searches.filter(s => s.id !== id);
    setSearches(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  return { searches, save, remove };
}
