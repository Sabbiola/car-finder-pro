import { useEffect, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import CarCard from "@/components/CarCard";
import { useFavorites } from "@/hooks/useFavorites";
import { fetchListingsByIds } from "@/lib/api/fetchByIds";
import { toCardListing } from "@/lib/toCardListing";
import type { CarListing } from "@/lib/api/listings";

const Preferiti = () => {
  const { favorites } = useFavorites();
  const [listings, setListings] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!favorites.length) {
      setListings([]);
      return;
    }
    setLoading(true);
    setError(false);
    fetchListingsByIds(favorites)
      .then(setListings)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [favorites.join(",")]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-border pb-4 animate-brutal-in">
          <Heart className="h-5 w-5" />
          <h1 className="text-xl font-bold">Preferiti</h1>
          <span className="text-xs text-muted-foreground">({favorites.length})</span>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && !favorites.length && (
          <div className="text-center py-24 space-y-3">
            <Heart className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-semibold">Nessun preferito salvato</p>
            <p className="text-xs text-muted-foreground">
              Clicca il cuore su qualsiasi annuncio per salvarlo qui
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive text-center py-8">
            Errore nel caricamento dei preferiti
          </p>
        )}

        {!loading && listings.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children animate-brutal-up">
            {listings.map((l, i) => (
              <CarCard key={l.id} listing={toCardListing(l)} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Preferiti;
