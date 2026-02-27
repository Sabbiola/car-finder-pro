import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, ExternalLink, Loader2, ChevronLeft, ChevronRight, Award, FileText, MapPin, Share2, Check } from 'lucide-react';
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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LineChart, Line } from 'recharts';
import LoanCalculator from '@/components/LoanCalculator';
import PriceAlertButton from '@/components/PriceAlertButton';
import { priceRatingConfig as ratingConfig } from '@/lib/rating-config';
import { FALLBACK_IMAGE } from '@/lib/constants';

interface ExtendedListing extends CarListing {
  description?: string | null;
  emission_class?: string | null;
  version?: string | null;
  seats?: number | null;
  condition?: string | null;
  detail_scraped?: boolean;
  image_urls?: string[] | null;
  extra_data?: Record<string, unknown> | null;
}

const CarDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { addRecent } = useRecentlyViewed();
  const canGoBack = location.key !== 'default';
  const [car, setCar] = useState<ExtendedListing | null>(null);
  const [similar, setSimilar] = useState<CarListing[]>([]);
  const [allPrices, setAllPrices] = useState<CarListing[]>([]);
  const [priceHistory, setPriceHistory] = useState<{ price: number; recorded_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available (e.g. HTTP context)
    }
  };

  const galleryImages = useMemo(() => {
    if (!car) return [];
    const normalize = (u: string) => {
      let url = u.startsWith('//') ? 'https:' + u : u;
      if (url.includes('images.sbito.it') && url.includes('rule=')) {
        url = url.replace(/rule=[^&]+/, 'rule=fullscreen-1x-auto');
      }
      if (url.includes('autoscout24.net/listing-images/')) {
        url = url.replace(/\/\d+x\d+(\.\w+)$/, '/800x600$1');
      }
      return url;
    };
    const main = normalize(car.image_url || '') || FALLBACK_IMAGE;

    // For AutoScout24 each listing has a unique UUID in the image path.
    // Use it to discard images that belong to other listings (e.g. scraped
    // from "similar cars" thumbnails on the same detail page).
    const as24UuidMatch = main.match(/listing-images\/([a-f0-9-]{36})/);
    const listingUuid = as24UuidMatch?.[1] ?? null;

    const extras = (car.image_urls ?? [])
      .map(normalize)
      .filter(u => {
        if (!u || u === main) return false;
        if (listingUuid && u.includes('autoscout24.net/listing-images/')) {
          // Only keep images whose UUID matches the main image's listing UUID
          return u.includes(listingUuid);
        }
        return true;
      });

    return [main, ...extras];
  }, [car]);

  const prevImage = useCallback(() => {
    setImgIndex(i => (i - 1 + galleryImages.length) % galleryImages.length);
  }, [galleryImages.length]);

  const nextImage = useCallback(() => {
    setImgIndex(i => (i + 1) % galleryImages.length);
  }, [galleryImages.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prevImage, nextImage]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const fetchCar = async () => {
      setLoading(true);
      setFetchError(null);
      setImgIndex(0);

      try {
        const { data, error } = await supabase
          .from('car_listings')
          .select('*')
          .eq('id', id)
          .single();

        if (cancelled) return;

        if (error || !data) {
          setFetchError('Auto non trovata o errore nel caricamento.');
          return;
        }

        const carData = data as ExtendedListing;
        setCar(carData);
        addRecent(carData.id);

        const [similarRes, pricesRes, historyRes] = await Promise.all([
          supabase.from('car_listings').select('*').eq('brand', data.brand).eq('model', data.model).neq('id', data.id).limit(6),
          supabase.from('car_listings').select('*').eq('brand', data.brand).eq('model', data.model).order('price', { ascending: true }).limit(20),
          supabase.from('price_history').select('price, recorded_at').eq('listing_id', data.id).order('recorded_at', { ascending: true }).limit(30),
        ]);

        if (cancelled) return;

        setSimilar((similarRes.data as CarListing[]) || []);
        setAllPrices((pricesRes.data as CarListing[]) || []);
        setPriceHistory(historyRes.data || []);

        // Determine source URL — fallback: construct from AutoScout24 image UUID
        let scrapeUrl = carData.source_url && carData.source_url !== '#' ? carData.source_url : null;
        if (!scrapeUrl && carData.source === 'autoscout24' && carData.image_url) {
          const idMatch = carData.image_url.match(/listing-images\/([a-f0-9-]{36})/);
          if (idMatch) {
            const slug = carData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            scrapeUrl = `https://www.autoscout24.it/annunci/${slug}-${idMatch[1]}`;
            // Fire-and-forget: persist resolved URL for future visits
            supabase
              .from('car_listings')
              .update({ source_url: scrapeUrl })
              .eq('id', carData.id)
              .then(({ error: updateErr }) => {
                if (updateErr) console.warn('[CarDetail] Failed to persist source_url:', updateErr.message);
              });
          }
        }
        if (scrapeUrl && !cancelled) setResolvedUrl(scrapeUrl);

        if (!carData.detail_scraped && scrapeUrl) {
          if (cancelled) return;
          setDetailLoading(true);
          try {
            const { data: scrapeResult } = await supabase.functions.invoke('scrape-detail', {
              body: { listingId: carData.id, sourceUrl: scrapeUrl },
            });
            if (cancelled) return;
            if (scrapeResult?.success && !scrapeResult?.cached) {
              const { data: updated, error: refreshErr } = await supabase
                .from('car_listings')
                .select('*')
                .eq('id', id)
                .single();
              if (!cancelled) {
                if (refreshErr) {
                  console.warn('[CarDetail] Failed to refresh after scrape:', refreshErr.message);
                } else if (updated) {
                  setCar(updated as ExtendedListing);
                }
              }
            }
          } catch (err) {
            if (!cancelled) console.error('[CarDetail] Detail scrape error:', err);
          } finally {
            if (!cancelled) setDetailLoading(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[CarDetail] Unexpected fetch error:', err);
          setFetchError('Errore imprevisto nel caricamento dell\'auto.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCar();

    // Cleanup: prevent stale state updates if the user navigates away
    return () => {
      cancelled = true;
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (fetchError || !car) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 text-center space-y-4">
          <p className="text-sm text-muted-foreground">{fetchError || 'Auto non trovata'}</p>
          <Button variant="outline" onClick={() => navigate(-1)}>← Torna indietro</Button>
        </div>
      </div>
    );
  }

  const listing = toCardListing(car);
  const priceRating = listing.priceRating || 'normal';
  const ratingStyle = ratingConfig[priceRating];

  const specs = [
    { label: 'Anno',          value: listing.year },
    { label: 'Chilometri',    value: `${listing.km.toLocaleString('it-IT')} km` },
    { label: 'Alimentazione', value: listing.fuel || '—' },
    { label: 'Cambio',        value: listing.transmission || '—' },
    { label: 'Potenza',       value: listing.power || '—' },
    { label: 'Carrozzeria',   value: listing.bodyType || '—' },
    ...(car.emission_class ? [{ label: 'Emissioni',  value: car.emission_class }] : []),
    ...(car.condition      ? [{ label: 'Condizione', value: car.condition }]      : []),
    ...(car.version        ? [{ label: 'Versione',   value: car.version }]        : []),
    ...(car.seats          ? [{ label: 'Posti',      value: car.seats }]          : []),
    ...(car.doors          ? [{ label: 'Porte',      value: car.doors }]          : []),
    ...(car.color          ? [{ label: 'Colore',     value: car.color }]          : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container py-6 space-y-8">

        {/* Back */}
        <button
          onClick={() => canGoBack ? navigate(-1) : navigate('/')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors animate-brutal-in"
        >
          <ArrowLeft className="h-4 w-4" /> Indietro
        </button>

        {/* Main card */}
        <div className="rounded-2xl border border-border/60 shadow-sm overflow-hidden animate-brutal-up">
          <div className="grid lg:grid-cols-2">

            {/* Image carousel */}
            <div className="relative aspect-[4/3] lg:aspect-auto overflow-hidden">
              <img
                src={galleryImages[imgIndex]}
                alt={`${listing.title} - foto ${imgIndex + 1}`}
                className="w-full h-full object-cover transition-opacity duration-200"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={e => {
                  (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                }}
              />
              {/* Nav arrows */}
              {galleryImages.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    aria-label="Immagine precedente"
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-black/70 rounded-full p-2 shadow-md hover:scale-110 transition-transform"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={nextImage}
                    aria-label="Immagine successiva"
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-black/70 rounded-full p-2 shadow-md hover:scale-110 transition-transform"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-3 right-3 bg-black/50 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
                    {imgIndex + 1} / {galleryImages.length}
                  </div>
                </>
              )}
              {/* Source badge */}
              <div className={`absolute top-3 left-3 ${sourceColors[listing.source]} text-white text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-sm`}>
                {sourceLabels[listing.source]}
              </div>
              {priceRating === 'best' && (
                <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                  <Award className="h-3 w-3" /> TOP DEAL
                </div>
              )}
            </div>

            {/* Details panel */}
            <div className="p-6 lg:p-8 space-y-6 bg-card">

              <div className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-2xl md:text-3xl font-extrabold leading-tight flex-1">
                    {listing.title}
                  </h1>
                  <FavoriteButton id={listing.id} className="flex-shrink-0 mt-1" />
                  <Button variant="outline" size="icon" onClick={handleShare}
                    className="rounded-xl h-9 w-9 flex-shrink-0 mt-1"
                    aria-label="Condividi link annuncio">
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
                  </Button>
                </div>
                {listing.location && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {listing.location}
                  </p>
                )}
              </div>

              {/* Price + rating */}
              <div className="flex items-end gap-3">
                <span className="text-4xl font-extrabold bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
                  €{listing.price.toLocaleString('it-IT')}
                </span>
                <Badge variant="outline" className={`rounded-full text-[10px] font-semibold mb-1 border-0 ${ratingStyle.className}`}>
                  {ratingStyle.label}
                </Badge>
              </div>

              {/* Specs grid */}
              <div className="grid grid-cols-2 gap-2">
                {specs.map(s => (
                  <div key={s.label} className="bg-muted/60 rounded-xl px-3 py-2.5">
                    <div className="text-[10px] font-medium text-muted-foreground mb-0.5">{s.label}</div>
                    <div className="text-sm font-bold">{s.value}</div>
                  </div>
                ))}
              </div>

              {detailLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 rounded-xl px-3 py-2.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Caricamento dettagli dall'annuncio...
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2 font-semibold rounded-xl h-12 bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 border-0 text-white shadow-md hover:shadow-violet-200 transition-all disabled:opacity-40"
                  onClick={() => {
                    const url = listing.url !== '#' ? listing.url : resolvedUrl;
                    if (url) window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                  disabled={listing.url === '#' && !resolvedUrl}
                >
                  <ExternalLink className="h-4 w-4" /> Vai all'annuncio
                </Button>
                <PriceAlertButton listingId={listing.id} currentPrice={listing.price} title={listing.title} />
              </div>
            </div>
          </div>
        </div>

        {/* Thumbnail strip */}
        {galleryImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin animate-brutal-up" style={{ animationDelay: '50ms' }}>
            {galleryImages.map((url, i) => (
              <button
                key={i}
                onClick={() => setImgIndex(i)}
                aria-label={`Foto ${i + 1}`}
                className={`flex-shrink-0 w-16 h-12 rounded-xl overflow-hidden transition-all ${
                  i === imgIndex
                    ? 'ring-2 ring-violet-500 scale-105 shadow-md'
                    : 'opacity-60 hover:opacity-100 border border-border'
                }`}
              >
                <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
        )}

        {/* Description */}
        {car.description && (
          <div className="rounded-2xl border border-border/60 overflow-hidden animate-brutal-up" style={{ animationDelay: '100ms' }}>
            <div className="border-b border-border/60 px-5 py-3 flex items-center gap-2 bg-muted/40">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Descrizione</h2>
            </div>
            <div className="p-5">
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {car.description}
              </p>
            </div>
          </div>
        )}

        {/* Extra data sections (Dati tecnici, Colore e interni, Equipaggiamento) */}
        {(() => {
          const ex = car.extra_data as Record<string, unknown> | null | undefined;
          if (!ex || typeof ex !== 'object') return null;

          const techFields = [
            { label: 'Trazione',     value: ex.drive_type as string },
            { label: 'Cilindrata',   value: ex.displacement as string },
            { label: 'Marce',        value: ex.gears != null ? String(ex.gears) : undefined },
            { label: 'Cilindri',     value: ex.cylinders != null ? String(ex.cylinders) : undefined },
            { label: 'Peso a vuoto', value: ex.weight as string },
            { label: 'Consumo',      value: ex.fuel_consumption as string },
          ].filter(f => f.value);

          const interiorFields = [
            { label: 'Tipo vernice',    value: ex.paint_type as string },
            { label: 'Colore interni',  value: ex.interior_color as string },
            { label: 'Materiale',       value: ex.interior_material as string },
          ].filter(f => f.value);

          const equipment = Array.isArray(ex.equipment) ? (ex.equipment as string[]) : [];

          return (
            <>
              {techFields.length > 0 && (
                <div className="rounded-2xl border border-border/60 overflow-hidden animate-brutal-up" style={{ animationDelay: '120ms' }}>
                  <div className="border-b border-border/60 px-5 py-3 bg-muted/40">
                    <h2 className="text-sm font-semibold">Dati tecnici</h2>
                  </div>
                  <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {techFields.map(f => (
                      <div key={f.label} className="bg-muted/60 rounded-xl px-3 py-2.5">
                        <div className="text-[10px] font-medium text-muted-foreground mb-0.5">{f.label}</div>
                        <div className="text-sm font-bold">{f.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {interiorFields.length > 0 && (
                <div className="rounded-2xl border border-border/60 overflow-hidden animate-brutal-up" style={{ animationDelay: '140ms' }}>
                  <div className="border-b border-border/60 px-5 py-3 bg-muted/40">
                    <h2 className="text-sm font-semibold">Colore e interni</h2>
                  </div>
                  <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {interiorFields.map(f => (
                      <div key={f.label} className="bg-muted/60 rounded-xl px-3 py-2.5">
                        <div className="text-[10px] font-medium text-muted-foreground mb-0.5">{f.label}</div>
                        <div className="text-sm font-bold">{f.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {equipment.length > 0 && (
                <div className="rounded-2xl border border-border/60 overflow-hidden animate-brutal-up" style={{ animationDelay: '160ms' }}>
                  <div className="border-b border-border/60 px-5 py-3 bg-muted/40">
                    <h2 className="text-sm font-semibold">Equipaggiamento <span className="text-muted-foreground font-normal">({equipment.length})</span></h2>
                  </div>
                  <div className="p-5 flex flex-wrap gap-1.5">
                    {equipment.map((item, i) => (
                      <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-700/50">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* Loan Calculator */}
        <div className="animate-brutal-up" style={{ animationDelay: '180ms' }}>
          <LoanCalculator price={car.price} />
        </div>

        {/* Price history chart */}
        {priceHistory.length >= 2 && (
          <div className="space-y-4 animate-brutal-up" style={{ animationDelay: '195ms' }}>
            <div>
              <h2 className="text-lg font-bold">Storico prezzi</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Andamento del prezzo nel tempo</p>
            </div>
            <div className="rounded-2xl border border-border/60 p-4 bg-card shadow-sm">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={priceHistory} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="recorded_at"
                    tickFormatter={v => new Date(v).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                    tick={{ fontSize: 10, fontFamily: 'Inter' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fontFamily: 'Inter' }}
                    tickFormatter={v => `€${(v / 1000).toFixed(0)}k`}
                    domain={['auto', 'auto']}
                    width={52}
                  />
                  <Tooltip
                    formatter={(value: number) => [`€${value.toLocaleString('it-IT')}`, 'Prezzo']}
                    labelFormatter={v => new Date(v).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                    contentStyle={{ fontFamily: 'Inter', fontSize: 12, border: '1px solid hsl(var(--border))', borderRadius: 12 }}
                  />
                  <Line type="monotone" dataKey="price" stroke="hsl(262 83% 60%)" strokeWidth={2} dot={{ r: 3, fill: 'hsl(262 83% 60%)' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Price comparison chart */}
        {chartData.length > 1 && (
          <div className="space-y-4 animate-brutal-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-lg font-bold">Confronto prezzi</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {listing.brand} {listing.model} — Media: €{avgPrice.toLocaleString('it-IT')}
                </p>
              </div>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block" /> Affare</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-500 rounded-full inline-block" /> Buon prezzo</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-muted-foreground rounded-full inline-block" /> Media</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 p-4 bg-card shadow-sm">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'Inter' }} angle={-45} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'Inter' }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [`€${value.toLocaleString('it-IT')}`, 'Prezzo']}
                    contentStyle={{ fontFamily: 'Inter', fontSize: 12, border: '1px solid hsl(var(--border))', borderRadius: 12 }}
                  />
                  <ReferenceLine y={avgPrice} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: 'Media', position: 'right', fontSize: 10, fontFamily: 'Inter' }} />
                  <Bar dataKey="price" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.isCurrent
                            ? 'hsl(262 83% 60%)'
                            : entry.rating === 'best'
                              ? 'hsl(142 76% 40%)'
                              : entry.rating === 'good'
                                ? 'hsl(217 91% 55%)'
                                : 'hsl(var(--muted-foreground))'
                        }
                        opacity={entry.isCurrent ? 1 : 0.75}
                      />
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
            <h2 className="text-lg font-bold">
              Annunci simili
              <span className="text-muted-foreground font-normal text-sm ml-2">({similar.length})</span>
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
