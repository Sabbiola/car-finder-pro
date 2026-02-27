import { useEffect, useState } from 'react';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { fetchListingsByIds } from '@/lib/api/fetchByIds';
import { toCardListing } from '@/lib/toCardListing';
import CarCard from '@/components/CarCard';
import type { CarListing } from '@/lib/api/listings';

const RecentlyViewedSection = () => {
  const { recentIds } = useRecentlyViewed();
  const [listings, setListings] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!recentIds.length) return;

    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchListingsByIds(recentIds.slice(0, 6))
      .then(data => {
        if (!cancelled) setListings(data);
      })
      .catch(err => {
        if (!cancelled) {
          console.error('[RecentlyViewedSection] Failed to load:', err);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [recentIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!recentIds.length || (!loading && !listings.length && !error)) return null;

  if (error) {
    return (
      <section className="border-t-2 border-foreground">
        <div className="container py-8">
          <p className="text-xs text-muted-foreground uppercase tracking-[0.1em]">
            Impossibile caricare la cronologia. Aggiorna la pagina per riprovare.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t border-border/60">
      <div className="container py-12 space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">
            Visti di recente
          </h2>
          <span className="text-xs text-muted-foreground">
            {listings.length} auto
          </span>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:overflow-visible">
          {listings.map((l, i) => (
            <div key={l.id} className="flex-shrink-0 w-64 sm:w-auto">
              <CarCard listing={toCardListing(l)} index={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RecentlyViewedSection;
