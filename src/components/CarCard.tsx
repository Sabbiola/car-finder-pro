import { ExternalLink, Award, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CarListing, sourceLabels, sourceColors } from "@/lib/mock-data";
import { useNavigate } from "react-router-dom";
import FavoriteButton from "@/components/FavoriteButton";
import CompareButton from "@/components/CompareButton";
import { priceRatingConfig } from "@/lib/rating-config";

interface Props {
  listing: CarListing;
  index?: number;
  showCompare?: boolean;
}

const CarCard = ({ listing, showCompare }: Props) => {
  const navigate = useNavigate();
  const rating = priceRatingConfig[listing.priceRating || "normal"];
  const isBest = listing.priceRating === "best";

  return (
    <div
      className="cursor-pointer group rounded-2xl border border-border bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden"
      onClick={() => navigate(`/auto/${listing.id}`)}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={listing.imageUrl}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600&q=80";
          }}
        />
        {/* Source badge(s) */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[70%]">
          {(listing.allSources || [listing.source]).map((src) => (
            <span
              key={src}
              className={`${sourceColors[src] || "bg-gray-500"} text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full shadow-sm`}
            >
              {sourceLabels[src] || src}
            </span>
          ))}
        </div>
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {isBest && (
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <Award className="h-3 w-3" />
              TOP
            </div>
          )}
          <FavoriteButton id={listing.id} />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className="text-sm font-semibold leading-tight line-clamp-2 text-foreground">
          {listing.title}
        </h3>

        <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
          €{listing.price.toLocaleString("it-IT")}
        </div>

        {/* Spec pills */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            {listing.year}
          </span>
          <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            {listing.km > 0 ? `${(listing.km / 1000).toFixed(0)}k km` : "Nuovo"}
          </span>
          {listing.fuel && (
            <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              {listing.fuel}
            </span>
          )}
          {listing.transmission && (
            <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              {listing.transmission === "Automatico" ? "Auto" : "Man"}
            </span>
          )}
        </div>

        {listing.location && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 -mt-1">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{listing.location}</span>
          </p>
        )}

        {/* Bottom row */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold rounded-full px-2.5 py-0.5 border-0 ${rating.className}`}
            >
              {rating.label}
            </Badge>
            {showCompare && <CompareButton id={listing.id} />}
          </div>
          <button
            className="text-muted-foreground hover:text-accent transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              window.open(listing.url, "_blank");
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CarCard;
