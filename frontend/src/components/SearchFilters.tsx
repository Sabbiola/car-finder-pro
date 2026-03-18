import { useEffect, useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Bookmark,
  RotateCcw,
} from "lucide-react";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  carBrands,
  fuelTypes,
  transmissionTypes,
  sourceLabels,
  carColors,
  doorOptions,
  bodyTypes,
  brandModels,
  modelTrims,
} from "@/lib/mock-data";
import { useFilterMetadata } from "@/features/search/hooks/useFilterMetadata";
import { useNavigate } from "react-router-dom";
import AutocompleteInput from "./AutocompleteInput";
import SaveSearchDialog from "./SaveSearchDialog";

export interface SearchFiltersState {
  brand: string;
  model: string;
  trim: string;
  yearMin: string;
  yearMax: string;
  priceMin: string;
  priceMax: string;
  kmMin: string;
  kmMax: string;
  fuel: string;
  transmission: string;
  isNew: boolean | null;
  sources: string[];
  color: string;
  doors: string;
  bodyType: string;
  location: string;
  sellerType: "all" | "private" | "dealer";
  emissionClass: string;
}

const defaultFilters: SearchFiltersState = {
  brand: "",
  model: "",
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
  sources: ["autoscout24", "subito", "ebay", "automobile", "brumbrum"],
  color: "",
  doors: "",
  bodyType: "",
  location: "",
  sellerType: "all",
  emissionClass: "",
};

interface Props {
  onSearch?: (filters: SearchFiltersState) => void;
  compact?: boolean;
  initialFilters?: SearchFiltersState;
}

function pruneUnsupportedFilters(
  current: SearchFiltersState,
  supportedFilterKeys: Set<string> | null,
): SearchFiltersState {
  if (!supportedFilterKeys) {return current;}
  const next = { ...current };
  const maybeReset = (filterKey: string, reset: () => void) => {
    if (!supportedFilterKeys.has(filterKey)) {reset();}
  };

  maybeReset("trim", () => {
    next.trim = "";
  });
  maybeReset("location", () => {
    next.location = "";
  });
  maybeReset("year_min", () => {
    next.yearMin = "";
  });
  maybeReset("year_max", () => {
    next.yearMax = "";
  });
  maybeReset("price_min", () => {
    next.priceMin = "";
  });
  maybeReset("price_max", () => {
    next.priceMax = "";
  });
  maybeReset("mileage_min", () => {
    next.kmMin = "";
  });
  maybeReset("mileage_max", () => {
    next.kmMax = "";
  });
  maybeReset("fuel_types", () => {
    next.fuel = "";
  });
  maybeReset("body_styles", () => {
    next.bodyType = "";
  });
  maybeReset("transmission", () => {
    next.transmission = "";
  });
  maybeReset("is_new", () => {
    next.isNew = null;
  });
  maybeReset("color", () => {
    next.color = "";
  });
  maybeReset("doors", () => {
    next.doors = "";
  });
  maybeReset("emission_class", () => {
    next.emissionClass = "";
  });
  maybeReset("seller_type", () => {
    next.sellerType = "all";
  });

  return next;
}

const SearchFilters = ({ onSearch, compact = false, initialFilters }: Props) => {
  const [filters, setFilters] = useState<SearchFiltersState>(initialFilters ?? defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(!compact);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const { data: metadata } = useFilterMetadata();

  const navigate = useNavigate();
  const { save } = useSavedSearches();

  const availableFuelTypes = metadata?.fuel_types?.length ? metadata.fuel_types : fuelTypes;
  const availableBodyTypes = metadata?.body_styles?.length ? metadata.body_styles : bodyTypes;
  const availableBrands = metadata?.brands?.length ? metadata.brands : carBrands;
  const availableModelsByBrand =
    metadata?.models_by_brand && Object.keys(metadata.models_by_brand).length
      ? metadata.models_by_brand
      : brandModels;
  const availableTrimsByBrandModel =
    metadata?.trims_by_brand_model && Object.keys(metadata.trims_by_brand_model).length
      ? metadata.trims_by_brand_model
      : modelTrims;
  const availableSources = useMemo(() => {
    const fallbackOrder = Object.keys(sourceLabels);
    const metadataSources = metadata?.providers?.map((provider) => provider.id) ?? [];
    const ordered = [...new Set([...fallbackOrder, ...metadataSources])];
    return ordered.map((id) => {
      const metadataProvider = metadata?.providers?.find((provider) => provider.id === id);
      const metadataLabel = metadataProvider?.name;
      const sourceLabel = sourceLabels[id] as string | undefined;
      return {
        id,
        label: sourceLabel ?? metadataLabel ?? id,
        configured: metadataProvider?.configured ?? true,
      };
    });
  }, [metadata]);

  const selectedProviderCapabilitySet = useMemo(() => {
    const contract = metadata?.search_contract;
    if (!contract) {return null;}
    const selectedSourceIds = new Set(filters.sources);
    const selectedProviders = (metadata.providers ?? []).filter((provider) =>
      selectedSourceIds.has(provider.id) && provider.enabled !== false && provider.configured !== false,
    );
    if (selectedProviders.length === 0) {
      return new Set<string>(contract.backend_post_filters);
    }
    const firstProvider = selectedProviders[0];
    const intersection = new Set<string>(firstProvider.supports_filters ?? []);
    for (const provider of selectedProviders.slice(1)) {
      const current = new Set(provider.supports_filters ?? []);
      for (const key of [...intersection]) {
        if (!current.has(key)) {
          intersection.delete(key);
        }
      }
    }
    const supported = new Set<string>(intersection);
    for (const filterKey of contract.backend_post_filters) {
      supported.add(filterKey);
    }
    return supported;
  }, [metadata, filters.sources]);

  const unsupportedSelectedFilters = useMemo(() => {
    if (!selectedProviderCapabilitySet) {return [];}
    const knownProviderIds = new Set((metadata?.providers ?? []).map((provider) => provider.id));
    const hasUnknownSelectedSources = filters.sources.some((source) => !knownProviderIds.has(source));
    if (hasUnknownSelectedSources) {return [];}
    const activeFilters: Array<{ key: string; label: string; active: boolean }> = [
      { key: "trim", label: "allestimento", active: Boolean(filters.trim) },
      { key: "location", label: "citta/regione", active: Boolean(filters.location) },
      { key: "year_min", label: "anno min", active: Boolean(filters.yearMin) },
      { key: "year_max", label: "anno max", active: Boolean(filters.yearMax) },
      { key: "price_min", label: "prezzo min", active: Boolean(filters.priceMin) },
      { key: "price_max", label: "prezzo max", active: Boolean(filters.priceMax) },
      { key: "mileage_min", label: "km min", active: Boolean(filters.kmMin) },
      { key: "mileage_max", label: "km max", active: Boolean(filters.kmMax) },
      { key: "fuel_types", label: "alimentazione", active: Boolean(filters.fuel) },
      { key: "body_styles", label: "carrozzeria", active: Boolean(filters.bodyType) },
      { key: "transmission", label: "cambio", active: Boolean(filters.transmission) },
      { key: "is_new", label: "condizione", active: filters.isNew !== null },
      { key: "color", label: "colore", active: Boolean(filters.color) },
      { key: "doors", label: "porte", active: Boolean(filters.doors) },
      { key: "emission_class", label: "classe euro", active: Boolean(filters.emissionClass) },
      { key: "seller_type", label: "venditore", active: filters.sellerType !== "all" },
    ];
    return activeFilters
      .filter((item) => item.active && !selectedProviderCapabilitySet.has(item.key))
      .map((item) => item.label);
  }, [filters, metadata, selectedProviderCapabilitySet]);

  useEffect(() => {
    const disabledProviderIds = new Set(
      (metadata?.providers ?? [])
        .filter((provider) => provider.configured === false)
        .map((provider) => provider.id),
    );
    if (disabledProviderIds.size === 0) {return;}

    setFilters((current) => {
      const nextSources = current.sources.filter((source) => !disabledProviderIds.has(source));
      if (nextSources.length === current.sources.length || nextSources.length === 0) {
        return current;
      }
      return { ...current, sources: nextSources };
    });
  }, [metadata]);

  const update = (
    key: keyof SearchFiltersState,
    value: SearchFiltersState[keyof SearchFiltersState],
  ) => setFilters((f) => ({ ...f, [key]: value }));

  const toggleSource = (src: string) => {
    setFilters((f) => ({
      ...f,
      sources: f.sources.includes(src) ? f.sources.filter((s) => s !== src) : [...f.sources, src],
    }));
  };

  const handleReset = () => {
    setFilters((f) => ({
      ...defaultFilters,
      brand: f.brand,
      model: f.model,
      trim: f.trim,
      sources: f.sources,
    }));
  };

  const handleSaveConfirm = (name: string) => {
    void save(name, filters);
  };

  const normalizeFilters = (current: SearchFiltersState): SearchFiltersState => {
    const next = { ...current };
    if (next.priceMin && next.priceMax && parseInt(next.priceMin) > parseInt(next.priceMax)) {
      next.priceMax = "";
    }
    if (next.yearMin && next.yearMax && parseInt(next.yearMin) > parseInt(next.yearMax)) {
      next.yearMax = "";
    }
    if (next.kmMin && next.kmMax && parseInt(next.kmMin) > parseInt(next.kmMax)) {
      next.kmMax = "";
    }
    return next;
  };

  const handleSearch = () => {
    const nextFilters = pruneUnsupportedFilters(normalizeFilters(filters), selectedProviderCapabilitySet);
    setFilters(nextFilters);

    if (onSearch) {
      onSearch(nextFilters);
    } else {
      const params = new URLSearchParams();
      Object.entries(nextFilters).forEach(([k, v]) => {
        if (Array.isArray(v)) {params.set(k, v.join(","));}
        else if (v !== "" && v !== false && v !== null) {params.set(k, String(v));}
      });
      if (nextFilters.isNew === false) {params.set("isNew", "false");}
      navigate(`/risultati?${params.toString()}`);
    }
  };

  const hasAdvancedFilters = !!(
    filters.yearMin ||
    filters.yearMax ||
    filters.priceMin ||
    filters.priceMax ||
    filters.kmMin ||
    filters.kmMax ||
    filters.fuel ||
    filters.transmission ||
    filters.color ||
    filters.doors ||
    filters.bodyType ||
    filters.location ||
    filters.isNew !== null ||
    filters.sellerType !== "all" ||
    filters.emissionClass
  );

  const isFilterSupported = (key: string) => selectedProviderCapabilitySet?.has(key) ?? true;

  const defaultSaveName =
    filters.brand && filters.model
      ? `${filters.brand} ${filters.model}`
      : filters.brand || "Ricerca";
  const modelsForSelectedBrand = (availableModelsByBrand[filters.brand] as string[] | undefined) ?? [];
  const trimsByModel = availableTrimsByBrandModel[filters.brand] as
    | Record<string, string[]>
    | undefined;
  const trimsForSelectedModel = trimsByModel?.[filters.model] ?? [];

  return (
    <div className="w-full space-y-4">
      {/* Save search dialog */}
      <SaveSearchDialog
        open={saveDialogOpen}
        defaultName={defaultSaveName}
        onSave={handleSaveConfirm}
        onClose={() => setSaveDialogOpen(false)}
      />

      {/* Main search row */}
      <div className="flex flex-col lg:flex-row gap-3">
        <Select
          value={filters.brand}
          onValueChange={(v) =>
            setFilters((f) => ({
              ...f,
              brand: v,
              model: "",
              trim: "",
            }))
          }
        >
          <SelectTrigger className="w-full lg:w-48 bg-card">
            <SelectValue placeholder="Marca" />
          </SelectTrigger>
          <SelectContent>
            {availableBrands.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filters.brand ? (
          <Select
            value={filters.model}
            onValueChange={(v) => {
              update("model", v);
              update("trim", "");
            }}
          >
            <SelectTrigger className="w-full lg:w-48 bg-card">
              <SelectValue placeholder="Modello" />
            </SelectTrigger>
            <SelectContent>
              {modelsForSelectedBrand.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <AutocompleteInput
            value={filters.model}
            onChange={(v) => update("model", v)}
            selectedBrand={filters.brand}
            onSelectBrand={(v) => {
              update("brand", v);
              update("model", "");
            }}
            onSelectModel={(v) => update("model", v)}
            brands={availableBrands}
            modelsByBrand={availableModelsByBrand}
            placeholder="Cerca marca o modello"
            className="lg:min-w-[220px] lg:flex-1"
          />
        )}

        {filters.brand && (
          <Select
            value={filters.trim}
            onValueChange={(v) => update("trim", v)}
            disabled={!filters.model}
          >
            <SelectTrigger className="w-full lg:w-52 bg-card">
              <SelectValue
                placeholder={filters.model ? "Allestimento" : "Scegli prima il modello"}
              />
            </SelectTrigger>
            <SelectContent>
              {trimsForSelectedModel.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex w-full lg:w-auto gap-3">
          <Button
            onClick={handleSearch}
            size="lg"
            className="gap-2 font-semibold flex-1 lg:flex-none"
          >
            <Search className="h-4 w-4" />
            Cerca offerte
          </Button>
          {(filters.brand || filters.model) && (
            <Button
              variant="outline"
              onClick={() => setSaveDialogOpen(true)}
              size="lg"
              className="gap-2 shrink-0"
            >
              <Bookmark className="h-4 w-4" />
              Salva
            </Button>
          )}
        </div>
      </div>

      {/* Condition toggle + advanced toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Three-state isNew toggle */}
        <div className="flex rounded-lg border border-border/60 overflow-hidden text-xs font-medium">
          {(
            [
              { value: null, label: "Tutti" },
              { value: false, label: "Usato" },
              { value: true, label: "Nuovo" },
            ] as { value: boolean | null; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={label}
              type="button"
              disabled={!isFilterSupported("is_new")}
              onClick={() => update("isNew", value)}
              className={`px-3 py-2 transition-colors ${
                filters.isNew === value
                  ? "bg-violet-600 text-white"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Seller type toggle */}
        <div className="flex rounded-lg border border-border/60 overflow-hidden text-xs font-medium">
          {(
            [
              { value: "all", label: "Tutti" },
              { value: "private", label: "Privati" },
              { value: "dealer", label: "Concessionarie" },
            ] as { value: "all" | "private" | "dealer"; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              disabled={!isFilterSupported("seller_type")}
              onClick={() => update("sellerType", value)}
              className={`px-3 py-2 transition-colors ${
                filters.sellerType === value
                  ? "bg-violet-600 text-white"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {compact && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="ml-auto gap-1 text-muted-foreground"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtri avanzati
            {hasAdvancedFilters && (
              <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-violet-500" />
            )}
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        )}
      </div>

      {/* Advanced filters */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {unsupportedSelectedFilters.length > 0 && (
              <p className="mb-2 text-xs text-amber-700">
                Alcuni filtri non sono supportati dalle fonti selezionate:{" "}
                {unsupportedSelectedFilters.join(", ")}.
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 rounded-xl bg-card border border-border">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Anno min</Label>
                <Input
                  type="number"
                  placeholder="2018"
                  value={filters.yearMin}
                  disabled={!isFilterSupported("year_min")}
                  min={1900}
                  max={new Date().getFullYear() + 1}
                  onChange={(e) => update("yearMin", e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Anno max</Label>
                <Input
                  type="number"
                  placeholder="2024"
                  value={filters.yearMax}
                  disabled={!isFilterSupported("year_max")}
                  min={1900}
                  max={new Date().getFullYear() + 1}
                  onChange={(e) => update("yearMax", e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Prezzo min EUR</Label>
                <Input
                  type="number"
                  placeholder="5.000"
                  value={filters.priceMin}
                  disabled={!isFilterSupported("price_min")}
                  min={0}
                  onChange={(e) => update("priceMin", e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Prezzo max EUR</Label>
                <Input
                  type="number"
                  placeholder="50.000"
                  value={filters.priceMax}
                  disabled={!isFilterSupported("price_max")}
                  min={0}
                  onChange={(e) => update("priceMax", e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Km min</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={filters.kmMin}
                  disabled={!isFilterSupported("mileage_min")}
                  min={0}
                  onChange={(e) => update("kmMin", e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Km max</Label>
                <Input
                  type="number"
                  placeholder="100.000"
                  value={filters.kmMax}
                  disabled={!isFilterSupported("mileage_max")}
                  min={0}
                  onChange={(e) => update("kmMax", e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Alimentazione</Label>
                <Select
                  value={filters.fuel || "_all"}
                  disabled={!isFilterSupported("fuel_types")}
                  onValueChange={(v) => update("fuel", v === "_all" ? "" : v)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Tutte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Tutte</SelectItem>
                    {availableFuelTypes.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cambio</Label>
                <Select
                  value={filters.transmission || "_all"}
                  disabled={!isFilterSupported("transmission")}
                  onValueChange={(v) => update("transmission", v === "_all" ? "" : v)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Tutti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Tutti</SelectItem>
                    {transmissionTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Colore</Label>
                <Select
                  value={filters.color || "_all"}
                  disabled={!isFilterSupported("color")}
                  onValueChange={(v) => update("color", v === "_all" ? "" : v)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Tutti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Tutti</SelectItem>
                    {carColors.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">N Porte</Label>
                <Select
                  value={filters.doors || "_all"}
                  disabled={!isFilterSupported("doors")}
                  onValueChange={(v) => update("doors", v === "_all" ? "" : v)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Tutte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Tutte</SelectItem>
                    {doorOptions.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} porte
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Carrozzeria</Label>
                <Select
                  value={filters.bodyType || "_all"}
                  disabled={!isFilterSupported("body_styles")}
                  onValueChange={(v) => update("bodyType", v === "_all" ? "" : v)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Tutte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Tutte</SelectItem>
                    {availableBodyTypes.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Classe Euro</Label>
                <Select
                  value={filters.emissionClass || "_all"}
                  disabled={!isFilterSupported("emission_class")}
                  onValueChange={(v) => update("emissionClass", v === "_all" ? "" : v)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Tutte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Tutte</SelectItem>
                    {["Euro 4", "Euro 5", "Euro 6"].map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Citta / Regione</Label>
                <Input
                  placeholder="Es. Milano, Lombardia"
                  value={filters.location}
                  disabled={!isFilterSupported("location")}
                  onChange={(e) => update("location", e.target.value)}
                  className="bg-background"
                />
              </div>

              {/* Sources */}
              <div className="col-span-2 sm:col-span-3 lg:col-span-6 space-y-2">
                <Label className="text-xs text-muted-foreground">Fonti</Label>
                <div className="flex flex-wrap gap-4">
                  {availableSources.map(({ id, label, configured }) => (
                    <label key={id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filters.sources.includes(id)}
                        disabled={configured === false}
                        onCheckedChange={() => {
                          if (configured === false) {return;}
                          toggleSource(id);
                        }}
                      />
                      <span
                        className={`text-sm ${configured === false ? "text-muted-foreground line-through" : ""}`}
                      >
                        {configured === false ? `${label} (setup richiesto)` : label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Bottom actions */}
              <div className="col-span-2 sm:col-span-3 lg:col-span-6 flex items-center justify-between pt-1">
                {hasAdvancedFilters ? (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset filtri
                  </button>
                ) : (
                  <span />
                )}
                <Button onClick={handleSearch} className="gap-2 font-semibold">
                  <Search className="h-4 w-4" />
                  {compact ? "Applica filtri" : "Cerca offerte"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchFilters;

