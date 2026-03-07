import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { User, Bell, Bookmark, Heart, LogOut, Trash2, Search, Calendar, Euro } from 'lucide-react';
import Header from '@/components/Header';
import CarCard from '@/components/CarCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useSavedSearches } from '@/hooks/useSavedSearches';
import { supabase } from '@/integrations/supabase/client';
import type { CarListing } from '@/lib/api/listings';
import { toCardListing } from '@/lib/toCardListing';
import type { SearchFiltersState } from '@/components/SearchFilters';

// Cast to any to bypass missing table types (price_alerts, user_favorites etc.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface AlertRow {
  id: string;
  listing_id: string;
  target_price: number;
  is_active: boolean;
  notified_at: string | null;
  created_at: string;
  car_listings: {
    title: string;
    price: number;
    image_url: string | null;
  } | null;
}

function filtersLabel(filters: SearchFiltersState): string {
  const parts: string[] = [];
  if (filters.brand) parts.push(filters.brand);
  if (filters.model) parts.push(filters.model);
  if (filters.yearMin || filters.yearMax) parts.push(`${filters.yearMin || ''}–${filters.yearMax || ''}`);
  if (filters.priceMax) parts.push(`max €${Number(filters.priceMax).toLocaleString('it-IT')}`);
  if (filters.fuel) parts.push(filters.fuel);
  return parts.length ? parts.join(' · ') : 'Tutti i filtri';
}

export default function Profile() {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { favorites } = useFavorites();
  const { searches, remove: removeSearch } = useSavedSearches();

  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [favListings, setFavListings] = useState<CarListing[]>([]);
  const [favLoading, setFavLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  // Load alerts when tab is active — must be before any early return
  useEffect(() => {
    if (activeTab !== 'alerts' || !user) return;
    setAlertsLoading(true);
    sb
      .from('price_alerts')
      .select('id, listing_id, target_price, is_active, notified_at, created_at, car_listings(title, price, image_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }: { data: AlertRow[] | null }) => {
        setAlerts(data || []);
        setAlertsLoading(false);
      });
  }, [activeTab, user]);

  // Load favorite listings when tab is active — must be before any early return
  useEffect(() => {
    if (activeTab !== 'favorites' || !user) return;
    if (favorites.length === 0) { setFavListings([]); return; }
    setFavLoading(true);
    sb
      .from('car_listings')
      .select('*')
      .in('id', favorites)
      .then(({ data }: { data: CarListing[] | null }) => {
        setFavListings(data || []);
        setFavLoading(false);
      });
  }, [activeTab, favorites, user]);

  // Auth guard — after all hooks
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-20 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Caricamento…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;

  const initials = user.email ? user.email.slice(0, 2).toUpperCase() : 'U';
  const joinedDate = new Date(user.created_at).toLocaleDateString('it-IT', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const deleteAlert = async (id: string) => {
    await sb.from('price_alerts').delete().eq('id', id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  function buildSearchParams(filters: SearchFiltersState): string {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (k === 'isNew') {
        if (v === true) params.set('isNew', 'true');
        else if (v === false) params.set('isNew', 'false');
      } else if (Array.isArray(v)) {
        if ((v as string[]).length) params.set(k, (v as string[]).join(','));
      } else if (v !== '' && v !== null && v !== undefined) {
        params.set(k, String(v));
      }
    });
    return params.toString();
  }

  const runSearch = (filters: SearchFiltersState) => {
    navigate(`/risultati?${buildSearchParams(filters)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8 max-w-4xl">

        {/* Page title */}
        <div className="flex items-center gap-3 border-b border-border pb-4 mb-8 animate-brutal-in">
          <User className="h-5 w-5" />
          <h1 className="text-xl font-bold">Il mio profilo</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 rounded-xl mb-8 h-auto p-1">
            <TabsTrigger value="info" className="rounded-lg py-2 text-xs sm:text-sm gap-1.5">
              <User className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="rounded-lg py-2 text-xs sm:text-sm gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Alert</span>
            </TabsTrigger>
            <TabsTrigger value="searches" className="rounded-lg py-2 text-xs sm:text-sm gap-1.5">
              <Bookmark className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ricerche</span>
            </TabsTrigger>
            <TabsTrigger value="favorites" className="rounded-lg py-2 text-xs sm:text-sm gap-1.5">
              <Heart className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Preferiti</span>
              {favorites.length > 0 && (
                <span className="bg-violet-500 text-white text-[9px] font-bold min-w-[16px] h-[16px] flex items-center justify-center px-0.5 rounded-full">
                  {favorites.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── INFO TAB ── */}
          <TabsContent value="info">
            <div className="rounded-2xl border border-border/60 bg-card p-8 space-y-6 max-w-md">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <span className="text-white text-xl font-bold">{initials}</span>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3 w-3" />
                    Iscritto il {joinedDate}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">{favorites.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Preferiti</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{searches.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ricerche</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{alerts.length || '–'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Alert</p>
                </div>
              </div>

              <Separator />

              <Button
                variant="outline"
                className="w-full rounded-xl gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
                Esci dall'account
              </Button>
            </div>
          </TabsContent>

          {/* ── ALERTS TAB ── */}
          <TabsContent value="alerts">
            <div className="space-y-3">
              {alertsLoading && (
                <p className="text-sm text-muted-foreground py-8 text-center">Caricamento alert…</p>
              )}
              {!alertsLoading && alerts.length === 0 && (
                <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
                  <Bell className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Nessun alert attivo.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apri un annuncio e clicca sull&apos;icona campanella per impostare un alert prezzo.
                  </p>
                </div>
              )}
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4"
                >
                  {alert.car_listings?.image_url && (
                    <img
                      src={alert.car_listings.image_url}
                      alt={alert.car_listings.title}
                      className="w-16 h-12 object-cover rounded-xl flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {alert.car_listings?.title || 'Auto'}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Euro className="h-3 w-3" />
                        Attuale: <strong className="text-foreground">€{(alert.car_listings?.price || 0).toLocaleString('it-IT')}</strong>
                      </span>
                      <span>
                        Target: <strong className="text-violet-600">€{alert.target_price.toLocaleString('it-IT')}</strong>
                      </span>
                    </div>
                    <div className="mt-1.5">
                      {alert.notified_at ? (
                        <Badge variant="secondary" className="text-[10px]">Notificato</Badge>
                      ) : (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">
                          Attivo
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteAlert(alert.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── SAVED SEARCHES TAB ── */}
          <TabsContent value="searches">
            <div className="space-y-3">
              {searches.length === 0 && (
                <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
                  <Bookmark className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Nessuna ricerca salvata.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Usa il filtro di ricerca e clicca &quot;Salva ricerca&quot; per salvarla qui.
                  </p>
                </div>
              )}
              {searches.map(search => (
                <div
                  key={search.id}
                  className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{search.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {filtersLabel(search.filters)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(search.createdAt).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl h-8 gap-1.5 text-xs"
                      onClick={() => runSearch(search.filters)}
                    >
                      <Search className="h-3 w-3" />
                      Cerca
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSearch(search.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── FAVORITES TAB ── */}
          <TabsContent value="favorites">
            {favorites.length === 0 && (
              <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
                <Heart className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nessun preferito salvato.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Clicca sul cuore di un annuncio per aggiungerlo.
                </p>
              </div>
            )}
            {favLoading && (
              <p className="text-sm text-muted-foreground py-8 text-center">Caricamento preferiti…</p>
            )}
            {!favLoading && favListings.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {favListings.map((listing, index) => (
                  <CarCard key={listing.id} listing={toCardListing(listing)} index={index} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
