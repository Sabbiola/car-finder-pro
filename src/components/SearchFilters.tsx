import { useState } from 'react';
import { Search, SlidersHorizontal, ChevronDown, ChevronUp, Bookmark, RotateCcw } from 'lucide-react';
import { useSavedSearches } from '@/hooks/useSavedSearches';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { carBrands, fuelTypes, transmissionTypes, sourceLabels, carColors, doorOptions, bodyTypes, brandModels, modelTrims } from '@/lib/mock-data';
import { useNavigate } from 'react-router-dom';
import AutocompleteInput from './AutocompleteInput';

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
}

const defaultFilters: SearchFiltersState = {
  brand: '', model: '', trim: '', yearMin: '', yearMax: '',
  priceMin: '', priceMax: '', kmMin: '', kmMax: '',
  fuel: '', transmission: '', isNew: null,
  sources: ['autoscout24', 'subito', 'automobile', 'brumbrum'],
  color: '', doors: '', bodyType: '', location: '',
};

interface Props {
  onSearch?: (filters: SearchFiltersState) => void;
  compact?: boolean;
  initialFilters?: SearchFiltersState;
}

const SearchFilters = ({ onSearch, compact = false, initialFilters }: Props) => {
  const [filters, setFilters] = useState<SearchFiltersState>(initialFilters ?? defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(!compact);
  const navigate = useNavigate();
  const { save } = useSavedSearches();

  const update = (key: keyof SearchFiltersState, value: any) =>
    setFilters(f => ({ ...f, [key]: value }));

  const toggleSource = (src: string) => {
    setFilters(f => ({
      ...f,
      sources: f.sources.includes(src)
        ? f.sources.filter(s => s !== src)
        : [...f.sources, src],
    }));
  };

  const handleReset = () => {
    setFilters(f => ({
      ...defaultFilters,
      brand: f.brand,
      model: f.model,
      trim: f.trim,
      sources: f.sources,
    }));
  };

  const handleSave = () => {
    const name = window.prompt('Nome per questa ricerca:', filters.brand && filters.model ? `${filters.brand} ${filters.model}` : filters.brand || 'Ricerca');
    if (name?.trim()) save(name.trim(), filters);
  };

  const handleSearch = () => {
    if (onSearch) {
      onSearch(filters);
    } else {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (Array.isArray(v)) params.set(k, v.join(','));
        else if (v !== '' && v !== false && v !== null) params.set(k, String(v));
      });
      if (filters.isNew === false) params.set('isNew', 'false');
      navigate(`/risultati?${params.toString()}`);
    }
  };

  const hasAdvancedFilters = !!(
    filters.yearMin || filters.yearMax ||
    filters.priceMin || filters.priceMax ||
    filters.kmMin || filters.kmMax ||
    filters.fuel || filters.transmission ||
    filters.color || filters.doors || filters.bodyType ||
    filters.location || filters.isNew !== null
  );

  return (
    <div className="w-full space-y-4">
      {/* Main search row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={filters.brand} onValueChange={v => update('brand', v)}>
          <SelectTrigger className="sm:w-48 bg-card">
            <SelectValue placeholder="Marca" />
          </SelectTrigger>
          <SelectContent>
            {carBrands.map(b => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.model}
          onValueChange={v => { update('model', v); update('trim', ''); }}
          disabled={!filters.brand}
        >
          <SelectTrigger className="sm:w-48 bg-card">
            <SelectValue placeholder={filters.brand ? 'Modello' : 'Scegli prima la marca'} />
          </SelectTrigger>
          <SelectContent>
            {(brandModels[filters.brand] || []).map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.trim}
          onValueChange={v => update('trim', v)}
          disabled={!filters.brand || !filters.model}
        >
          <SelectTrigger className="sm:w-52 bg-card">
            <SelectValue placeholder={filters.model ? 'Allestimento' : 'Scegli prima il modello'} />
          </SelectTrigger>
          <SelectContent>
            {(modelTrims[filters.brand]?.[filters.model] || []).map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <AutocompleteInput
          value={filters.model}
          onChange={v => update('model', v)}
          selectedBrand={filters.brand}
          onSelectBrand={v => { update('brand', v); update('model', ''); }}
          onSelectModel={v => update('model', v)}
          placeholder="Oppure cerca liberamente..."
        />

        <Button onClick={handleSearch} size="lg" className="gap-2 font-semibold">
          <Search className="h-4 w-4" />
          Cerca offerte
        </Button>
        {(filters.brand || filters.model) && (
          <Button variant="outline" onClick={handleSave} size="lg" className="gap-2 shrink-0">
            <Bookmark className="h-4 w-4" />
            Salva
          </Button>
        )}
      </div>

      {/* Condition toggle + advanced toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Three-state isNew toggle */}
        <div className="flex rounded-lg border border-border/60 overflow-hidden text-xs font-medium">
          {([
            { value: null, label: 'Tutti' },
            { value: false, label: 'Usato' },
            { value: true, label: 'Nuovo' },
          ] as { value: boolean | null; label: string }[]).map(({ value, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => update('isNew', value)}
              className={`px-3 py-2 transition-colors ${
                filters.isNew === value
                  ? 'bg-foreground text-background'
                  : 'hover:bg-muted text-muted-foreground'
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
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 rounded-xl bg-card border border-border">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Anno min</Label>
                <Input type="number" placeholder="2018" value={filters.yearMin}
                  onChange={e => update('yearMin', e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Anno max</Label>
                <Input type="number" placeholder="2024" value={filters.yearMax}
                  onChange={e => update('yearMax', e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Prezzo min €</Label>
                <Input type="number" placeholder="5.000" value={filters.priceMin}
                  onChange={e => update('priceMin', e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Prezzo max €</Label>
                <Input type="number" placeholder="50.000" value={filters.priceMax}
                  onChange={e => update('priceMax', e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Km min</Label>
                <Input type="number" placeholder="0" value={filters.kmMin}
                  onChange={e => update('kmMin', e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Km max</Label>
                <Input type="number" placeholder="100.000" value={filters.kmMax}
                  onChange={e => update('kmMax', e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Alimentazione</Label>
                <Select value={filters.fuel} onValueChange={v => update('fuel', v)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Tutte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tutte</SelectItem>
                    {fuelTypes.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cambio</Label>
                <Select value={filters.transmission} onValueChange={v => update('transmission', v)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Tutti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tutti</SelectItem>
                    {transmissionTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Colore</Label>
                <Select value={filters.color} onValueChange={v => update('color', v)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Tutti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tutti</SelectItem>
                    {carColors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">N° Porte</Label>
                <Select value={filters.doors} onValueChange={v => update('doors', v)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Tutte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tutte</SelectItem>
                    {doorOptions.map(d => <SelectItem key={d} value={String(d)}>{d} porte</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Carrozzeria</Label>
                <Select value={filters.bodyType} onValueChange={v => update('bodyType', v)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Tutte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Tutte</SelectItem>
                    {bodyTypes.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Città / Regione</Label>
                <Input placeholder="Es. Milano, Lombardia" value={filters.location}
                  onChange={e => update('location', e.target.value)} className="bg-background" />
              </div>

              {/* Sources */}
              <div className="col-span-2 sm:col-span-3 lg:col-span-6 space-y-2">
                <Label className="text-xs text-muted-foreground">Fonti</Label>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(sourceLabels).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={filters.sources.includes(key)}
                        onCheckedChange={() => toggleSource(key)}
                      />
                      <span className="text-sm">{label}</span>
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
                ) : <span />}
                <Button onClick={handleSearch} className="gap-2 font-semibold">
                  <Search className="h-4 w-4" />
                  {compact ? 'Applica filtri' : 'Cerca offerte'}
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
