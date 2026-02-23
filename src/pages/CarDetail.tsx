import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, ExternalLink, Loader2, ChevronLeft, ChevronRight, Award, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import CarCard from '@/components/CarCard';
import FavoriteButton from '@/components/FavoriteButton';
import { sourceLabels, sourceColors } from '@/lib/mock-data';
import { supabase } from '@/integrations/supabase/client';
import type { CarListing } from '@/lib/api/listings';
import { toCardListing } from '@/lib/toCardListing';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

interface ExtendedListing extends CarListing {
  description?: string | null;
  emission_class?: string | null;
  version?: string | null;
  seats?: number | null;
  condition?: string | null;
  detail_scraped?: boolean;
  image_urls?: string[] | null;
}

const ratingLabels: Record<string, string> = {
  best: 'AFFARE',
  good: 'BUON PREZZO',
  normal: 'NELLA MEDIA',
};

const CarDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addRecent } = useRecentlyViewed();
  const [car, setCar] = useState<ExtendedListing | null>(null);
  const [similar, setSimilar] = useState<CarListing[]>([]);
  const [allPrices, setAllPrices] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);

  const galleryImages = useMemo(() => {
    if (!car) return [];
    const main = car.image_url || 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600&q=80';
    const extras = car.image_urls?.filter(u => u && u !== main) || [];
    return [main, ...extras];
  }, [car]);

  const prevImage = useCallback(() => {
    setImgIndex(i => (i - 1 + galleryImages.length) % galleryImages.length);
  }, [galleryImages.length]);

  const nextImage = useCallback(() => {
    setImgIndex(i => (i + 1) % galleryImages.length);
  }, [galleryImages.length]);

  // Keyboard nav for carousel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prevImage, nextImage]);

  // Fetch car + trigger detail scrape
  useEffect(() => {
    const fetchCar = async () => {
      setLoading(true);
      setImgIndex(0);
      const { data } = await supabase
        .from('car_listings')
        .select('*')
        .eq('id', id!)
        .single();

      if (data) {
        const carData = data as ExtendedListing;
        setCar(carData);
        addRecent(carData.id);

        const [similarRes, pricesRes] = await Promise.all([
          supabase
            .from('car_listings')
            .select('*')
            .eq('brand', data.brand)
            .eq('model', data.model)
            .neq('id', data.id)
            .limit(6),
          supabase
            .from('car_listings')
            .select('*')
            .eq('brand', data.brand)
            .eq('model', data.model)
            .order('price', { ascending: true })
            .limit(20),
        ]);
        setSimilar((similarRes.data as CarListing[]) || []);
        setAllPrices((pricesRes.data as CarListing[]) || []);

        // Trigger detail scrape if not already done
        if (!carData.detail_scraped && carData.source_url && carData.source_url !== '#') {
          setDetailLoading(true);
          try {
            const { data: scrapeResult } = await supabase.functions.invoke('scrape-detail', {
              body: { listingId: carData.id, sourceUrl: carData.source_url },
            });
            if (scrapeResult?.success && !scrapeResult?.cached) {
              const { data: updated } = await supabase
                .from('car_listings')
                .select('*')
                .eq('id', id!)
                .single();
              if (updated) setCar(updated as ExtendedListing);
            }
          } catch (err) {
            console.error('Detail scrape error:', err);
          } finally {
            setDetailLoading(false);
          }
        }
      }
      setLoading(false);
    };
    if (id) fetchCar();
  }, [id]);

  const chartData = useMemo(() => {
    if (!allPrices.length || !car) return [];
    return allPrices.map(p => ({
      name: p.title.length > 20 ? p.title.slice(0, 20) + '…' : p.title,
      price: p.price,
      isCurrent: p.id === car.id,
      rating: p.price_rating || 'normal',
    }));
  }, [allPrices, car]);

  const avgPrice = useMemo(() => {
    if (!allPrices.length) return 0;
    return Math.round(allPrices.reduce((s, p) => s + p.price, 0) / allPrices.length);
  }, [allPrices]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 text-center">
          <p className="text-sm uppercase tracking-[0.15em] text-muted-foreground">Auto non trovata</p>
        </div>
      </div>
    );
  }

  const listing = toCardListing(car);
  const priceRating = listing.priceRating || 'normal';

  const specs = [
    { label: 'Anno', value: listing.year },
    { label: 'Chilometri', value: `${listing.km.toLocaleString('it-IT')} km` },
    { label: 'Alimentazione', value: listing.fuel || '—' },
    { label: 'Cambio', value: listing.transmission || '—' },
    { label: 'Potenza', value: listing.power || '—' },
    { label: 'Carrozzeria', value: listing.bodyType || '—' },
    ...(car.emission_class ? [{ label: 'Emissioni', value: car.emission_class }] : []),
    ...(car.condition ? [{ label: 'Condizione', value: car.condition }] : []),
    ...(car.version ? [{ label: 'Versione', value: car.version }] : []),
    ...(car.seats ? [{ label: 'Posti', value: car.seats }] : []),
    ...(car.doors ? [{ label: 'Porte', value: car.doors }] : []),
    ...(car.color ? [{ label: 'Colore', value: car.color }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container py-6 space-y-8">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-accent transition-colors animate-brutal-in"
        >
          <ArrowLeft className="h-3 w-3" /> Indietro
        </button>

        {/* Main grid */}
        <div className="grid lg:grid-cols-2 gap-0 border-2 border-foreground animate-brutal-up">
          {/* Image carousel */}
          <div className="relative aspect-[4/3] lg:aspect-auto overflow-hidden border-b-2 lg:border-b-0 lg:border-r-2 border-foreground scan-hover">
            <img
              src={galleryImages[imgIndex]}
              alt={`${listing.title} - foto ${imgIndex + 1}`}
              className="w-full h-full object-cover transition-opacity duration-200"
              loading="lazy"
            />
            {/* Nav arrows */}
            {galleryImages.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/90 border-2 border-foreground p-1.5 hover:bg-foreground hover:text-background transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/90 border-2 border-foreground p-1.5 hover:bg-foreground hover:text-background transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                {/* Counter */}
                <div className="absolute bottom-3 right-3 bg-background/90 border-2 border-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]">
                  {imgIndex + 1} / {galleryImages.length}
                </div>
              </>
            )}
            <div className={`absolute top-0 left-0 ${sourceColors[listing.source]} text-white text-[9px] font-bold uppercase tracking-[0.15em] px-3 py-1.5`}>
              {sourceLabels[listing.source]}
            </div>
            {priceRating === 'best' && (
              <div className="absolute top-0 right-0 bg-accent text-accent-foreground text-[9px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 flex items-center gap-1">
                <Award className="h-3 w-3" /> TOP DEAL
              </div>
            )}
          </div>

          {/* Details panel */}
          <div className="p-6 lg:p-8 space-y-6">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight glitch-hover flex-1" data-text={listing.title}>
                  {listing.title}
                </h1>
                <FavoriteButton id={listing.id} className="flex-shrink-0 mt-1" />
              </div>
              {listing.location && (
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mt-2">
                  {listing.location}
                </p>
              )}
            </div>

            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold tracking-tighter">
                €{listing.price.toLocaleString('it-IT')}
              </span>
              <Badge variant="outline" className={`rounded-none text-[9px] font-bold uppercase tracking-[0.1em] mb-1 ${
                priceRating === 'best' ? 'bg-accent text-accent-foreground border-accent' :
                priceRating === 'good' ? 'bg-foreground text-background border-foreground' :
                'bg-muted text-muted-foreground border-border'
              }`}>
                {ratingLabels[priceRating]}
              </Badge>
            </div>

            {/* Specs grid */}
            <div className="grid grid-cols-2 gap-0 border-2 border-foreground">
              {specs.map((s, i) => (
                <div key={s.label} className={`p-3 ${i % 2 === 0 ? 'border-r-2 border-foreground' : ''} ${i < specs.length - (specs.length % 2 === 0 ? 2 : 1) ? 'border-b-2 border-foreground' : ''}`}>
                  <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{s.label}</div>
                  <div className="text-sm font-bold mt-0.5">{s.value}</div>
                </div>
              ))}
            </div>

            {detailLoading && (
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground border-2 border-border p-3">
                <Loader2 className="h-3 w-3 animate-spin" />
                Caricamento dettagli dall'annuncio originale...
              </div>
            )}

            <Button
              className="w-full gap-2 font-bold uppercase tracking-[0.1em] text-xs rounded-none border-2 border-foreground h-12"
              onClick={() => window.open(listing.url, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Vai all'annuncio originale
            </Button>
          </div>
        </div>

        {/* Thumbnail strip */}
        {galleryImages.length > 1 && (
          <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin animate-brutal-up" style={{ animationDelay: '50ms' }}>
            {galleryImages.map((url, i) => (
              <button
                key={i}
                onClick={() => setImgIndex(i)}
                className={`flex-shrink-0 w-16 h-12 border-2 overflow-hidden transition-all ${
                  i === imgIndex ? 'border-accent scale-105' : 'border-border opacity-60 hover:opacity-100'
                }`}
              >
                <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {/* Description */}
        {car.description && (
          <div className="border-2 border-foreground animate-brutal-up" style={{ animationDelay: '100ms' }}>
            <div className="border-b-2 border-foreground px-4 py-2 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              <h2 className="text-xs font-bold uppercase tracking-[0.15em]">Descrizione</h2>
            </div>
            <div className="p-4 lg:p-6">
              <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
                {car.description}
              </p>
            </div>
          </div>
        )}

        {/* Price comparison chart */}
        {chartData.length > 1 && (
          <div className="space-y-4 animate-brutal-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-lg font-bold uppercase tracking-wide">Confronto prezzi</h2>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-1">
                  {listing.brand} {listing.model} — Media: €{avgPrice.toLocaleString('it-IT')}
                </p>
              </div>
              <div className="flex gap-3 text-[9px] uppercase tracking-[0.1em]">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-accent inline-block" /> Affare</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-foreground inline-block" /> Buon prezzo</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-muted-foreground inline-block" /> Media</span>
              </div>
            </div>
            <div className="border-2 border-foreground p-4 bg-card">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'JetBrains Mono' }} angle={-45} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [`€${value.toLocaleString('it-IT')}`, 'Prezzo']} contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, border: '2px solid currentColor', borderRadius: 0 }} />
                  <ReferenceLine y={avgPrice} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: 'Media', position: 'right', fontSize: 9, fontFamily: 'JetBrains Mono' }} />
                  <Bar dataKey="price" radius={0}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.isCurrent ? 'hsl(var(--accent))' : entry.rating === 'best' ? 'hsl(var(--accent))' : entry.rating === 'good' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'} stroke={entry.isCurrent ? 'hsl(var(--foreground))' : 'none'} strokeWidth={entry.isCurrent ? 2 : 0} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Similar listings */}
        {similar.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold uppercase tracking-wide">
              Annunci simili
              <span className="text-muted-foreground font-normal text-xs ml-2">({similar.length})</span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              {similar.map((l, i) => <CarCard key={l.id} listing={toCardListing(l)} index={i} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CarDetail;
