import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { CompareProvider } from "../hooks/CompareProvider";
import { useCompare } from "../hooks/useCompare";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(CompareProvider, null, children);

describe("useCompare", () => {
  it("starts with empty compareIds", () => {
    const { result } = renderHook(() => useCompare(), { wrapper });
    expect(result.current.compareIds).toEqual([]);
    expect(result.current.canAdd).toBe(true);
  });

  it("adds a car", () => {
    const { result } = renderHook(() => useCompare(), { wrapper });
    act(() => {
      result.current.addToCompare("car-1");
    });
    expect(result.current.compareIds).toContain("car-1");
    expect(result.current.isInCompare("car-1")).toBe(true);
  });

  it("removes a car", () => {
    const { result } = renderHook(() => useCompare(), { wrapper });
    act(() => {
      result.current.addToCompare("car-1");
    });
    act(() => {
      result.current.removeFromCompare("car-1");
    });
    expect(result.current.compareIds).not.toContain("car-1");
  });

  it("clears all cars", () => {
    const { result } = renderHook(() => useCompare(), { wrapper });
    act(() => {
      result.current.addToCompare("car-1");
    });
    act(() => {
      result.current.addToCompare("car-2");
    });
    act(() => {
      result.current.clearCompare();
    });
    expect(result.current.compareIds).toHaveLength(0);
  });

  it("does not add duplicates", () => {
    const { result } = renderHook(() => useCompare(), { wrapper });
    act(() => {
      result.current.addToCompare("car-1");
    });
    act(() => {
      result.current.addToCompare("car-1");
    });
    expect(result.current.compareIds).toHaveLength(1);
  });

  it("enforces max 3 cars", () => {
    const { result } = renderHook(() => useCompare(), { wrapper });
    act(() => {
      result.current.addToCompare("car-1");
    });
    act(() => {
      result.current.addToCompare("car-2");
    });
    act(() => {
      result.current.addToCompare("car-3");
    });
    act(() => {
      result.current.addToCompare("car-4");
    });
    expect(result.current.compareIds).toHaveLength(3);
    expect(result.current.canAdd).toBe(false);
  });

  it("canAdd is false when at max", () => {
    const { result } = renderHook(() => useCompare(), { wrapper });
    act(() => {
      result.current.addToCompare("car-1");
    });
    act(() => {
      result.current.addToCompare("car-2");
    });
    act(() => {
      result.current.addToCompare("car-3");
    });
    expect(result.current.canAdd).toBe(false);
  });

  it("throws error when used outside provider", () => {
    expect(() => {
      renderHook(() => useCompare());
    }).toThrow("useCompare must be used inside CompareProvider");
  });
});
