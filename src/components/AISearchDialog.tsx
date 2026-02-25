import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import type { SearchFiltersState } from './SearchFilters';

interface Props {
  open: boolean;
  onClose: () => void;
}

const EXAMPLES = [
  'SUV diesel automatico sotto 25.000€ con meno di 80.000 km',
  'Tesla o auto elettrica, immatricolata dopo il 2020',
  'Fiat 500 o Panda ibrida, zona Milano, massimo 15.000€',
  'Berlina tedesca con cambio automatico, tra 20k e 35k euro',
];

const AISearchDialog = ({ open, onClose }: Props) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-search', {
        body: { query },
      });
      if (error || !data?.success) {
        toast({
          title: 'Errore AI',
          description: data?.error || 'Impossibile elaborare la ricerca',
          variant: 'destructive',
        });
        return;
      }
      const filters: Partial<SearchFiltersState> = data.filters;
      const params = new URLSearchParams();
      if (filters.brand) params.set('brand', String(filters.brand));
      if (filters.model) params.set('model', String(filters.model));
      if (filters.yearMin) params.set('yearMin', String(filters.yearMin));
      if (filters.yearMax) params.set('yearMax', String(filters.yearMax));
      if (filters.priceMin) params.set('priceMin', String(filters.priceMin));
      if (filters.priceMax) params.set('priceMax', String(filters.priceMax));
      if ((filters as any).kmMax) params.set('kmMax', String((filters as any).kmMax));
      if (filters.fuel) params.set('fuel', String(filters.fuel));
      if (filters.transmission) params.set('transmission', String(filters.transmission));
      if (filters.bodyType) params.set('bodyType', String(filters.bodyType));
      if (filters.location) params.set('location', String(filters.location));
      params.set('sources', 'autoscout24,subito,automobile,brumbrum');
      onClose();
      navigate(`/risultati?${params.toString()}`);
    } catch (err) {
      toast({ title: 'Errore', description: 'Servizio AI non disponibile', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Cerca con AI
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Descrivi in italiano l'auto che cerchi — l'AI estrae automaticamente i filtri.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="Es: SUV diesel automatico sotto 25.000€ con meno di 80k km..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="min-h-[100px] resize-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSearch();
            }}
          />

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Esempi</p>
            <div className="flex flex-col gap-1.5">
              {EXAMPLES.map(ex => (
                <button
                  key={ex}
                  onClick={() => setQuery(ex)}
                  className="text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-3 py-1.5 rounded-lg transition-colors"
                >
                  "{ex}"
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {loading ? 'Elaborazione...' : 'Cerca (Ctrl+Enter)'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AISearchDialog;
