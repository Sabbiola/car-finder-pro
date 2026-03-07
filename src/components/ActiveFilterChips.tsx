import { X } from 'lucide-react';
import type { SearchFiltersState } from './SearchFilters';

interface Props {
  filters: SearchFiltersState;
  onChange: (filters: SearchFiltersState) => void;
}

const defaultValues: Record<string, unknown> = {
  brand: '', model: '', trim: '', yearMin: '', yearMax: '',
  priceMin: '', priceMax: '', kmMin: '', kmMax: '',
  fuel: '', transmission: '', isNew: null,
  color: '', doors: '', bodyType: '', location: '',
  sellerType: 'all', emissionClass: '',
};

const labels: Record<string, string> = {
  brand: 'Marca', model: 'Modello', trim: 'Allestimento',
  yearMin: 'Anno min', yearMax: 'Anno max',
  priceMin: 'Prezzo min', priceMax: 'Prezzo max',
  kmMin: 'Km min', kmMax: 'Km max',
  fuel: 'Alimentazione', transmission: 'Cambio',
  color: 'Colore', doors: 'Porte', bodyType: 'Carrozzeria',
  location: 'Località', emissionClass: 'Euro',
};

const ActiveFilterChips = ({ filters, onChange }: Props) => {
  const chips: { key: keyof SearchFiltersState; label: string; value: string }[] = [];

  for (const [key, val] of Object.entries(filters)) {
    if (key === 'sources' || key === 'isNew' || key === 'sellerType') continue;
    if (val === defaultValues[key] || val === '' || val === null || val === undefined) continue;
    const label = labels[key] || key;
    chips.push({ key: key as keyof SearchFiltersState, label, value: String(val) });
  }

  if (filters.isNew === true) chips.push({ key: 'isNew', label: 'Condizione', value: 'Nuovo' });
  if (filters.isNew === false) chips.push({ key: 'isNew', label: 'Condizione', value: 'Usato' });
  if (filters.sellerType !== 'all') {
    chips.push({ key: 'sellerType', label: 'Venditore', value: filters.sellerType === 'dealer' ? 'Concessionarie' : 'Privati' });
  }

  if (chips.length === 0) return null;

  const remove = (key: keyof SearchFiltersState) => {
    onChange({ ...filters, [key]: defaultValues[key as string] ?? '' });
  };

  const clearAll = () => {
    const reset = { ...filters };
    for (const chip of chips) {
      (reset as Record<string, unknown>)[chip.key] = defaultValues[chip.key as string] ?? '';
    }
    onChange(reset);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map(({ key, label, value }) => (
        <button
          key={key}
          onClick={() => remove(key)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-700/50 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
        >
          <span className="text-violet-400 dark:text-violet-500">{label}:</span> {value}
          <X className="h-3 w-3 ml-0.5 opacity-60" />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          onClick={clearAll}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-1"
        >
          Cancella tutto
        </button>
      )}
    </div>
  );
};

export default ActiveFilterChips;
