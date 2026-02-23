import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFavorites } from '../hooks/useFavorites';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useFavorites', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('starts with empty favorites', () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.favorites).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('adds a favorite via toggle', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => { result.current.toggle('car-1'); });
    expect(result.current.favorites).toContain('car-1');
    expect(result.current.count).toBe(1);
  });

  it('removes a favorite when toggled twice', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => { result.current.toggle('car-1'); });
    act(() => { result.current.toggle('car-1'); });
    expect(result.current.favorites).not.toContain('car-1');
    expect(result.current.count).toBe(0);
  });

  it('isFavorite returns true for added item', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => { result.current.toggle('car-1'); });
    expect(result.current.isFavorite('car-1')).toBe(true);
  });

  it('isFavorite returns false for non-added item', () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.isFavorite('car-999')).toBe(false);
  });

  it('persists favorites to localStorage', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => { result.current.toggle('car-1'); });
    const stored = JSON.parse(localStorageMock.getItem('car-finder-favorites') || '[]');
    expect(stored).toContain('car-1');
  });

  it('can track multiple favorites', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => { result.current.toggle('car-1'); });
    act(() => { result.current.toggle('car-2'); });
    act(() => { result.current.toggle('car-3'); });
    expect(result.current.count).toBe(3);
    expect(result.current.favorites).toHaveLength(3);
  });
});
