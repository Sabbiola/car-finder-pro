import { ExternalLink, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CarListing, sourceLabels, sourceColors } from '@/lib/mock-data';
import { useNavigate } from 'react-router-dom';
import FavoriteButton from '@/components/FavoriteButton';
import CompareButton from '@/components/CompareButton';

interface Props {
  listing: CarListing;
  index?: number;
  showCompare?: boolean;
}

const priceRatingConfig = {
  best: { label: 'AFFARE', className: 'bg-accent text-accent-foreground' },
  good: { label: 'BUON PREZZO', className: 'bg-foreground text-background' },
  normal: { label: 'NELLA MEDIA', className: 'bg-muted text-muted-foreground' },
};

const CarCard = ({ listing, showCompare }: Props) => {
  const navigate = useNavigate();
  const rating = priceRatingConfig[listing.priceRating || 'normal'];
  const isBest = listing.priceRating === 'best';

  return (
    <div
      className="cursor-pointer group border-2 border-border bg-card hover:border-foreground transition-colors duration-150 brutal-hover"
      onClick={() => navigate(`/auto/${listing.id}`)}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden scan-hover">
        <img
          src={listing.imageUrl}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={e => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600&q=80';
          }}
        />
        {/* Source badge */}
        <div className={`absolute top-0 left-0 ${sourceColors[listing.source]} text-white text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-1`}>
          {sourceLabels[listing.source]}
        </div>
        <div className="absolute top-0 right-0 flex flex-col items-end">
          {isBest && (
            <div className="bg-accent text-accent-foreground text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-1 flex items-center gap-1">
              <Award className="h-3 w-3" />
              TOP
            </div>
          )}
          <FavoriteButton id={listing.id} />
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide leading-tight line-clamp-2 glitch-hover" data-text={listing.title}>
            {listing.title}
          </h3>
        </div>

        <div className="text-xl font-bold tracking-tight">
          €{listing.price.toLocaleString('it-IT')}
        </div>

        {/* Specs row */}
        <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          <span>{listing.year}</span>
          <span>·</span>
          <span>{listing.km > 0 ? `${(listing.km / 1000).toFixed(0)}k km` : 'Nuovo'}</span>
          {listing.fuel && <><span>·</span><span>{listing.fuel}</span></>}
          {listing.transmission && <><span>·</span><span>{listing.transmission === 'Automatico' ? 'Auto' : 'Man'}</span></>}
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between pt-2 border-t border-border gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-[0.1em] rounded-none px-1.5 py-0 border-0 ${rating.className}`}>
              {rating.label}
            </Badge>
            {showCompare && <CompareButton id={listing.id} />}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
              {sourceLabels[listing.source]}
            </span>
            <button
              className="text-muted-foreground hover:text-accent transition-colors"
              onClick={e => { e.stopPropagation(); window.open(listing.url, '_blank'); }}
            >
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CarCard;
