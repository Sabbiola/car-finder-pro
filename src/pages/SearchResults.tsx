import { useState, useMemo, useEffect } from 'react';
import { ArrowUpDown, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Header from '@/components/Header';
import SearchFilters, { SearchFiltersState } from '@/components/SearchFilters';
import CarCard from '@/components/CarCard';
import { useSearchParams } from 'react-router-dom';
import { scrapeListings, fetchListings, type CarListing } from '@/lib/api/listings';
import { toCardListing } from '@/lib/toCardListing';
import { useToast } from '@/hooks/use-toast';

type SortOption = 'price-asc' | 'price-desc' | 'km-asc' | 'year-desc';

const sortLabels: Record<SortOption, string> = {
  'price-asc': 'Prezzo ↑',
  'price-desc': 'Prezzo ↓',
  'km-asc': 'Km ↑',
  'year-desc': 'Anno ↓',
};

function parseFiltersFromParams(params: URLSearchParams): SearchFiltersState {
  return {
    brand: params.get('brand') || '',
    model: params.get('model') || '',
    trim: params.get('trim') || '',
    yearMin: params.get('yearMin') || '',
    yearMax: params.get('yearMax') || '',
    priceMin: params.get('priceMin') || '',
    priceMax: params.get('priceMax') || '',
    kmMax: params.get('kmMax') || '',
    fuel: params.get('fuel') || '',
    transmission: params.get('transmission') || '',
    isNew: params.get('isNew') === 'true',
    sources: params.get('sources') ? params.get('sources')!.split(',') : ['autoscout24', 'subito', 'automobile', 'brumbrum'],
    color: params.get('color') || '',
    doors: params.get('doors') || '',
    bodyType: params.get('bodyType') || '',
  };
}

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sort, setSort] = useState<SortOption>((searchParams.get('sort') as SortOption) || 'price-asc');
  const initialFilters = useMemo(() => parseFiltersFromParams(searchParams), []);
  const [filters, setFilters] = useState<SearchFiltersState>(initialFilters);
  const [listings, setListings] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [scraped, setScraped] = useState(false);
  const { toast } = useToast();

  const CACHE_TTL_HOURS = 6;

  const doSearch = async (forceRefresh = false) => {
    if (!filters.brand) return;
    setLoading(true);
    try {
      if (!forceRefresh) {
        const existing = await fetchListings(filters);
        if (existing.length > 0) {
          // Check cache freshness: use the oldest scraped_at in the result set
          const newestTs = Math.max(...existing.map(l => new Date(l.scraped_at).getTime()));
          const ageHours = (Date.now() - newestTs) / 3600000;
          if (ageHours < CACHE_TTL_HOURS) {
            setListings(existing);
            setScraped(true);
            setLoading(false);
            return;
          }
          // Cache stale: show existing results while re-scraping in background
          setListings(existing);
          setScraped(true);
        }
      }
      toast({ title: 'Ricerca in corso...', description: 'Scraping annunci reali dai portali' });
      const result = await scrapeListings(filters);
      if (result?.success) {
        const fresh = await fetchListings(filters);
        setListings(fresh);
        setScraped(true);
        toast({ title: `${fresh.length} annunci trovati` });
      } else {
        toast({ title: 'Errore', description: result?.error || 'Scraping fallito', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Error fetching listings:', err);
      toast({ title: 'Errore', description: 'Impossibile caricare gli annunci', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { doSearch(); }, [filters]);

  const handleSearch = (newFilters: SearchFiltersState) => {
    setScraped(false);
    setListings([]);
    setFilters(newFilters);
  };

  const results = useMemo(() => {
    const list = [...listings];
    switch (sort) {
      case 'price-asc': list.sort((a, b) => a.price - b.price); break;
      case 'price-desc': list.sort((a, b) => b.price - a.price); break;
      case 'km-asc': list.sort((a, b) => a.km - b.km); break;
      case 'year-desc': list.sort((a, b) => b.year - a.year); break;
    }
    return list;
  }, [sort, listings]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-6 space-y-6">
        <div className="animate-brutal-in">
          <SearchFilters compact onSearch={handleSearch} initialFilters={filters} />
        </div>

        <div className="flex items-center justify-between border-b-2 border-foreground pb-3 animate-brutal-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-3">
            {loading && !scraped ? (
              <span className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Ricerca in corso...
              </span>
            ) : (
              <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                <span className="font-bold text-foreground">{results.length}</span> risultati
              </p>
            )}
            {loading && scraped && results.length > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Aggiornamento...
              </span>
            )}
            {!loading && scraped && (
              <button onClick={() => doSearch(true)} className="text-[10px] uppercase tracking-[0.1em] text-accent hover:underline">
                ↻ Aggiorna
              </button>
            )}
          </div>

          <Select value={sort} onValueChange={v => {
            const s = v as SortOption;
            setSort(s);
            setSearchParams(prev => { prev.set('sort', s); return prev; }, { replace: true });
          }}>
            <SelectTrigger className="w-40 bg-card text-xs uppercase tracking-[0.05em] rounded-none border-2">
              <ArrowUpDown className="h-3 w-3 mr-1 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none border-2">
              {Object.entries(sortLabels).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs uppercase">{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
          {results.map((listing, i) => (
            <CarCard key={listing.id} listing={toCardListing(listing)} index={i} showCompare />
          ))}
        </div>

        {!loading && scraped && results.length === 0 && (
          <div className="text-center py-16 text-muted-foreground space-y-2">
            <p className="text-sm font-bold uppercase tracking-wide">Nessun risultato</p>
            <p className="text-xs uppercase tracking-[0.1em]">Modifica i filtri di ricerca o cambia brand/modello</p>
            <button onClick={() => doSearch(true)} className="text-[10px] uppercase tracking-[0.1em] text-accent hover:underline mt-2 block mx-auto">
              ↻ Riprova
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
