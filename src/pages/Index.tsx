import SearchFilters, { type SearchFiltersState } from '@/components/SearchFilters';
import Header from '@/components/Header';
import RecentlyViewedSection from '@/components/RecentlyViewedSection';
import { useSavedSearches } from '@/hooks/useSavedSearches';
import { useNavigate } from 'react-router-dom';
import { Bookmark, X } from 'lucide-react';

function buildParams(filters: SearchFiltersState): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (Array.isArray(v)) params.set(k, v.join(','));
    else if (v !== '' && v !== false) params.set(k, String(v));
  });
  return params.toString();
}

const features = [
  { title: 'Ricerca istantanea', desc: 'Confronta annunci da tutti i portali in un click', gradient: 'from-violet-500 to-indigo-500' },
  { title: 'Migliori offerte',   desc: 'Algoritmo che individua i prezzi più competitivi', gradient: 'from-pink-500 to-rose-500' },
  { title: 'Andamento prezzi',   desc: 'Grafici per capire se è il momento giusto',        gradient: 'from-amber-500 to-orange-500' },
  { title: 'Fonti verificate',   desc: 'AutoScout24, Subito.it, Automobile.it',            gradient: 'from-teal-500 to-green-500' },
];

const Index = () => {
  const navigate = useNavigate();
  const { searches, remove } = useSavedSearches();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative container py-20 md:py-32 space-y-10 overflow-hidden">
        {/* Gradient blobs */}
        <div className="pointer-events-none absolute -top-20 -left-20 w-[500px] h-[500px] bg-violet-300/25 rounded-full blur-3xl -z-10 dark:bg-violet-800/20" />
        <div className="pointer-events-none absolute bottom-0 right-0 w-96 h-96 bg-pink-300/25 rounded-full blur-3xl -z-10 dark:bg-pink-800/20" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 w-64 h-64 bg-indigo-200/20 rounded-full blur-3xl -z-10 dark:bg-indigo-800/15" />

        <div className="space-y-6 max-w-3xl animate-brutal-up">
          <div className="inline-flex items-center gap-2 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-xs font-semibold px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
            Aggregatore real-time
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-[0.95] tracking-tight">
            Trova l'auto
            <br />al prezzo
            <br />
            <span className="bg-gradient-to-r from-violet-600 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              migliore.
            </span>
          </h1>

          <p className="text-base text-muted-foreground max-w-md leading-relaxed animate-brutal-in" style={{ animationDelay: '200ms' }}>
            Aggregatore real-time di annunci auto da tutti i portali italiani.
            Confronta, analizza, risparmia.
          </p>
        </div>

        <div className="max-w-4xl animate-brutal-up" style={{ animationDelay: '300ms' }}>
          <SearchFilters />
        </div>
      </section>

      {/* Feature cards */}
      <section className="border-t border-border/60">
        <div className="container py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
            {features.map((f, i) => (
              <div key={f.title} className="p-6 rounded-2xl border border-border/60 bg-card hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-4 shadow-sm`}>
                  <span className="text-white text-sm font-bold">0{i + 1}</span>
                </div>
                <h3 className="text-sm font-bold mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {searches.length > 0 && (
        <section className="border-t border-border/60">
          <div className="container py-10">
            <div className="flex items-center gap-2 mb-4">
              <Bookmark className="h-4 w-4 text-violet-500" />
              <h2 className="text-sm font-bold uppercase tracking-[0.1em]">Ricerche salvate</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {searches.map(s => (
                <div key={s.id} className="flex items-center gap-1 bg-muted rounded-xl px-3 py-2">
                  <button
                    onClick={() => navigate(`/risultati?${buildParams(s.filters)}`)}
                    className="text-sm font-medium hover:text-violet-600 transition-colors"
                  >
                    {s.name}
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Rimuovi"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <RecentlyViewedSection />

      <footer className="border-t border-border/60 py-6">
        <div className="container text-xs text-muted-foreground">
          © 2026 AutoDeal Finder
        </div>
      </footer>
    </div>
  );
};

export default Index;
