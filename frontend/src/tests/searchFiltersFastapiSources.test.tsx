import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SearchFilters, { type SearchFiltersState } from "@/components/SearchFilters";

type MetadataProvider = {
  id: string;
  name: string;
  configured: boolean;
  enabled: boolean;
};

let filterMetadataValue: { data: { providers: MetadataProvider[] } } = {
  data: {
    providers: [],
  },
};

vi.mock("@/lib/runtimeConfig", () => ({
  getRuntimeConfig: () => ({
    backendMode: "fastapi",
    apiBaseUrl: "https://api.carfinderpro.app",
  }),
}));

vi.mock("@/features/search/hooks/useFilterMetadata", () => ({
  useFilterMetadata: () => filterMetadataValue,
}));

vi.mock("@/hooks/useSavedSearches", () => ({
  useSavedSearches: () => ({
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

function makeFilters(overrides: Partial<SearchFiltersState> = {}): SearchFiltersState {
  return {
    brand: "BMW",
    model: "320d",
    trim: "",
    yearMin: "",
    yearMax: "",
    priceMin: "",
    priceMax: "",
    kmMin: "",
    kmMax: "",
    fuel: "",
    transmission: "",
    isNew: null,
    sources: ["autoscout24", "legacy-source", "subito"],
    color: "",
    doors: "",
    bodyType: "",
    location: "",
    sellerType: "all",
    emissionClass: "",
    ...overrides,
  };
}

describe("SearchFilters fastapi source handling", () => {
  beforeEach(() => {
    filterMetadataValue = {
      data: {
        providers: [
          { id: "autoscout24", name: "AutoScout24", configured: true, enabled: true },
          { id: "subito", name: "Subito", configured: false, enabled: false },
          { id: "legacy-source", name: "Legacy Source", configured: true, enabled: true },
        ],
      },
    };
  });

  it("shows explicit source states and submits only supported providers in fastapi mode", async () => {
    const onSearch = vi.fn();

    render(
      <MemoryRouter>
        <SearchFilters onSearch={onSearch} initialFilters={makeFilters()} />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("disponibile").length).toBeGreaterThan(0);
    expect(screen.getByText("setup richiesto")).toBeInTheDocument();
    expect(screen.getByText("non disponibile in fastapi mode")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Fonti deselezionate automaticamente in fastapi mode/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Cerca offerte" })[0]);

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledOnce();
    });

    const submittedFilters = onSearch.mock.calls[0][0] as SearchFiltersState;
    expect(submittedFilters.sources).toEqual(["autoscout24"]);
    expect(submittedFilters.sources).not.toContain("legacy-source");
    expect(submittedFilters.sources).not.toContain("subito");
  });
});
