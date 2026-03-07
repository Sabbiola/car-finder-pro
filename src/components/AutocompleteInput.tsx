import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { carBrands, brandModels } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

interface Suggestion {
  type: 'brand' | 'model';
  brand: string;
  model?: string;
  label: string;
}

function getSuggestions(query: string, selectedBrand: string): Suggestion[] {
  if (!query && !selectedBrand) return [];
  const q = query.toLowerCase().trim();

  const results: Suggestion[] = [];

  if (!selectedBrand || q) {
    // Suggest brands
    carBrands.forEach(brand => {
      if (brand.toLowerCase().includes(q)) {
        results.push({ type: 'brand', brand, label: brand });
      }
    });
  }

  // Suggest models
  const brandsToSearch = selectedBrand ? [selectedBrand] : carBrands;
  brandsToSearch.forEach(brand => {
    const models = brandModels[brand] || [];
    models.forEach(model => {
      const full = `${brand} ${model}`.toLowerCase();
      if (q && (model.toLowerCase().includes(q) || full.includes(q))) {
        results.push({ type: 'model', brand, model, label: `${brand} ${model}` });
      }
    });
  });

  return results.slice(0, 8);
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  selectedBrand: string;
  onSelectBrand: (brand: string) => void;
  onSelectModel: (model: string) => void;
  placeholder?: string;
  className?: string;
}

const AutocompleteInput = ({
  value, onChange, selectedBrand, onSelectBrand, onSelectModel, placeholder, className,
}: Props) => {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSuggestions(getSuggestions(value, selectedBrand));
    setHighlightIndex(-1);
  }, [value, selectedBrand]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = useCallback((s: Suggestion) => {
    if (s.type === 'brand') {
      onSelectBrand(s.brand);
      onChange('');
    } else if (s.model) {
      onSelectBrand(s.brand);
      onSelectModel(s.model);
      onChange(s.model);
    }
    setFocused(false);
  }, [onSelectBrand, onSelectModel, onChange]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      select(suggestions[highlightIndex]);
    } else if (e.key === 'Escape') {
      setFocused(false);
    }
  };

  const showDropdown = focused && suggestions.length > 0;

  return (
    <div ref={wrapperRef} className={cn('relative w-full min-w-0', className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="pl-9 bg-card text-foreground"
        />
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <button
                key={s.label + i}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors',
                  i === highlightIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                )}
                onMouseEnter={() => setHighlightIndex(i)}
                onMouseDown={e => { e.preventDefault(); select(s); }}
              >
                <span className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                  s.type === 'brand' ? 'bg-primary/10 text-primary' : 'bg-accent text-accent-foreground'
                )}>
                  {s.type === 'brand' ? 'Marca' : 'Modello'}
                </span>
                <span className="font-medium">{s.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AutocompleteInput;
