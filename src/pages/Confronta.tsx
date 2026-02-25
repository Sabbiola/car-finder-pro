import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Share2, Check } from 'lucide-react';
import Header from '@/components/Header';
import { fetchListingsByIds } from '@/lib/api/fetchByIds';
import type { CarListing } from '@/lib/api/listings';
import { priceRatingConfig } from '@/lib/rating-config';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600&q=80';

type RowDef = {
  label: string;
  get: (car: CarListing) => string | number;
  bestMode?: 'min' | 'max';
  numericGet?: (car: CarListing) => number | null;
};

const rows: RowDef[] = [
  { label: 'Prezzo', get: c => `€${c.price.toLocaleString('it-IT')}`, bestMode: 'min', numericGet: c => c.price },
  { label: 'Anno', get: c => c.year, bestMode: 'max', numericGet: c => c.year },
  { label: 'Chilometri', get: c => `${c.km.toLocaleString('it-IT')} km`, bestMode: 'min', numericGet: c => c.km },
  { label: 'Carburante', get: c => c.fuel || '—' },
  { label: 'Cambio', get: c => c.transmission || '—' },
  { label: 'Potenza', get: c => c.power || '—' },
  { label: 'Carrozzeria', get: c => c.body_type || '—' },
  { label: 'Emissioni', get: c => c.emission_class || '—' },
  { label: 'Colore', get: c => c.color || '—' },
  { label: 'Porte', get: c => c.doors ?? '—' },
  { label: 'Rating prezzo', get: c => priceRatingConfig[c.price_rating || 'normal']?.label || '—' },
];

function findBestIndex(values: (number | null)[], mode: 'min' | 'max'): number | null {
  const nums = values.map((v, i) => ({ v, i })).filter(x => x.v !== null) as { v: number; i: number }[];
  if (nums.length < 2) return null;
  const best = mode === 'min'
    ? nums.reduce((a, b) => a.v < b.v ? a : b)
    : nums.reduce((a, b) => a.v > b.v ? a : b);
  return best.i;
}

const Confronta = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean);
  const [cars, setCars] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleShareComparison = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!ids.length) { setLoading(false); return; }
    fetchListingsByIds(ids)
      .then(setCars)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ids.join(',')]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-6 space-y-6">

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-accent transition-colors animate-brutal-in"
        >
          <ArrowLeft className="h-3 w-3" /> Indietro
        </button>

        <div className="flex items-center justify-between animate-brutal-up">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold uppercase tracking-wide">Confronto auto</h1>
            <span className="text-muted-foreground text-sm uppercase tracking-[0.1em]">
              ({cars.length} selezionate)
            </span>
          </div>
          {ids.length >= 2 && (
            <button
              onClick={handleShareComparison}
              className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-accent transition-colors border border-border px-3 py-1.5"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Share2 className="h-3 w-3" />}
              {copied ? 'Copiato!' : 'Copia link'}
            </button>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && cars.length > 0 && (
          <div className="overflow-x-auto animate-brutal-up" style={{ animationDelay: '100ms' }}>
            <table className="w-full border-collapse border-2 border-foreground">
              <thead>
                <tr>
                  <th className="border-2 border-foreground p-3 bg-muted text-left text-[9px] uppercase tracking-[0.2em] w-28">
                    SPEC
                  </th>
                  {cars.map(car => (
                    <th key={car.id} className="border-2 border-foreground p-3 text-left min-w-[200px] align-top">
                      <img
                        src={car.image_url || FALLBACK_IMAGE}
                        alt={car.title}
                        className="w-full h-28 object-cover border-2 border-border mb-2"
                        onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                      />
                      <div className="text-[10px] font-bold uppercase tracking-[0.1em] leading-tight">
                        {car.title}
                      </div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-[0.1em] mt-0.5">
                        {car.source}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const bestIdx = row.bestMode && row.numericGet
                    ? findBestIndex(cars.map(row.numericGet!), row.bestMode)
                    : null;

                  return (
                    <tr key={row.label} className={ri % 2 === 0 ? 'bg-card' : 'bg-background'}>
                      <td className="border-2 border-foreground p-3 text-[9px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
                        {row.label}
                      </td>
                      {cars.map((car, ci) => {
                        const isBest = bestIdx === ci;
                        return (
                          <td
                            key={car.id}
                            className={`border-2 border-foreground p-3 text-sm font-bold ${isBest ? 'bg-accent/10 text-accent' : ''}`}
                          >
                            {String(row.get(car))}
                            {isBest && (
                              <span className="ml-1.5 text-[8px] uppercase tracking-[0.1em] bg-accent text-accent-foreground px-1 py-0.5">
                                TOP
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !cars.length && (
          <div className="text-center py-24 text-muted-foreground space-y-2">
            <p className="text-sm font-bold uppercase tracking-wide">Nessuna auto da confrontare</p>
            <p className="text-xs uppercase tracking-[0.1em]">
              Seleziona 2-3 auto dalla pagina risultati e clicca "Confronta"
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default Confronta;
