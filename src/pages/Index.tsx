import SearchFilters from '@/components/SearchFilters';
import Header from '@/components/Header';
import RecentlyViewedSection from '@/components/RecentlyViewedSection';

const features = [
  { title: 'Ricerca istantanea', desc: 'Confronta annunci da tutti i portali in un click' },
  { title: 'Migliori offerte', desc: 'Algoritmo che individua i prezzi più competitivi' },
  { title: 'Andamento prezzi', desc: 'Grafici per capire se è il momento giusto' },
  { title: 'Fonti verificate', desc: 'AutoScout24, Subito.it, Automobile.it' },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="container py-20 md:py-32 space-y-12">
        <div className="space-y-4 max-w-3xl animate-brutal-up">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[0.95] glitch-hover" data-text="Trova l'auto al prezzo migliore.">
            Trova l'auto
            <br />
            al prezzo
            <br />
            <span className="text-accent">migliore.</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-md uppercase tracking-[0.1em] leading-relaxed animate-brutal-in" style={{ animationDelay: '200ms' }}>
            Aggregatore real-time di annunci auto da tutti i portali italiani.
            Confronta, analizza, risparmia.
          </p>
        </div>

        <div className="max-w-4xl animate-brutal-up" style={{ animationDelay: '300ms' }}>
          <SearchFilters />
        </div>
      </section>

      <section className="border-t-2 border-foreground">
        <div className="container py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0 stagger-children">
            {features.map((f, i) => (
              <div key={f.title} className={`p-6 brutal-hover ${i < 3 ? 'border-r-0 sm:border-r-2 border-b-2 sm:border-b-0 border-foreground' : ''} ${i === 1 ? 'lg:border-r-2' : ''}`}>
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">0{i + 1}</span>
                <h3 className="text-sm font-bold uppercase tracking-wide mt-2">{f.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RecentlyViewedSection />

      <footer className="border-t-2 border-foreground py-6">
        <div className="container text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          © 2026 AutoDeal Finder
        </div>
      </footer>
    </div>
  );
};

export default Index;
