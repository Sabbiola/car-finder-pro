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

  useEffect(() => {
    if (!recentIds.length) return;
    setLoading(true);
    fetchListingsByIds(recentIds.slice(0, 6))
      .then(setListings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [recentIds.join(',')]);

  if (!recentIds.length || (!loading && !listings.length)) return null;

  return (
    <section className="border-t-2 border-foreground">
      <div className="container py-12 space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold uppercase tracking-wide">
            Visti di recente
          </h2>
          <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
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
