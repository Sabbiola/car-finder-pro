import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Bell, Bookmark, Calendar, Heart, LogOut, Search, Trash2, User } from "lucide-react";

import Header from "@/components/Header";
import CarCard from "@/components/CarCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SearchFiltersState } from "@/components/SearchFilters";
import { useAuth } from "@/contexts/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { supabase } from "@/integrations/supabase/client";
import { fetchListingsByIds } from "@/lib/api/fetchByIds";
import type { CarListing } from "@/lib/api/listings";
import { getRuntimeConfig } from "@/lib/runtimeConfig";
import { toCardListing } from "@/lib/toCardListing";
import { deactivateAlertApi, listAlertsApi } from "@/services/api/alerts";

const CLIENT_ID_KEY = "car-finder-client-id";

function getClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) {return existing;}
  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(CLIENT_ID_KEY, generated);
  return generated;
}

interface AlertRow {
  id: string;
  listing_id: string;
  target_price: number;
  is_active: boolean;
  notified_at: string | null;
  created_at: string;
  notification_status?: string;
  car_listings: {
    title: string;
    price: number;
    image_url: string | null;
  } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function normalizeCarListingSummary(value: unknown): AlertRow["car_listings"] {
  const maybeRecord: unknown = Array.isArray(value) ? value[0] : value;
  if (!isRecord(maybeRecord)) {
    return null;
  }
  const title = typeof maybeRecord.title === "string" ? maybeRecord.title : "";
  const price = typeof maybeRecord.price === "number" ? maybeRecord.price : 0;
  const imageUrl = typeof maybeRecord.image_url === "string" ? maybeRecord.image_url : null;
  return { title, price, image_url: imageUrl };
}

function parseAlertRow(value: unknown): AlertRow | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.id !== "string" ||
    typeof value.listing_id !== "string" ||
    typeof value.target_price !== "number" ||
    typeof value.is_active !== "boolean" ||
    typeof value.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    listing_id: value.listing_id,
    target_price: value.target_price,
    is_active: value.is_active,
    notified_at: typeof value.notified_at === "string" ? value.notified_at : null,
    created_at: value.created_at,
    notification_status:
      typeof value.notification_status === "string" ? value.notification_status : undefined,
    car_listings: normalizeCarListingSummary(value.car_listings),
  };
}

function filtersLabel(filters: SearchFiltersState): string {
  const parts: string[] = [];
  if (filters.brand) {parts.push(filters.brand);}
  if (filters.model) {parts.push(filters.model);}
  if (filters.yearMin || filters.yearMax) {
    parts.push(`${filters.yearMin || ""}-${filters.yearMax || ""}`);
  }
  if (filters.priceMax) {
    parts.push(`max EUR ${Number(filters.priceMax).toLocaleString("it-IT")}`);
  }
  if (filters.fuel) {parts.push(filters.fuel);}
  return parts.length ? parts.join(" | ") : "Tutti i filtri";
}

export default function Profile() {
  const { user, signOut, loading } = useAuth();
  const runtime = getRuntimeConfig();
  const navigate = useNavigate();
  const { favorites } = useFavorites();
  const { searches, remove: removeSearch } = useSavedSearches();
  const isFastApiMode = runtime.backendMode === "fastapi";

  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [favListings, setFavListings] = useState<CarListing[]>([]);
  const [favLoading, setFavLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

  useEffect(() => {
    if (activeTab !== "alerts" || !user) {return;}
    setAlertsLoading(true);
    const load = async () => {
      try {
        if (isFastApiMode) {
          const response = await listAlertsApi({ userId: user.id });
          setAlerts(
            response.alerts.map((entry) => ({
              id: entry.alert.id,
              listing_id: entry.alert.listing_id,
              target_price: entry.alert.target_price,
              is_active: entry.alert.is_active,
              notified_at: entry.alert.notified_at ?? null,
              created_at: entry.alert.created_at,
              notification_status: entry.notification_status,
              car_listings: entry.alert.listing
                ? {
                    title: entry.alert.listing.title ?? "",
                    price: entry.alert.listing.price ?? 0,
                    image_url: entry.alert.listing.image_url ?? null,
                  }
                : null,
            })),
          );
          return;
        }

        const { data } = await supabase
          .from("price_alerts")
          .select(
            "id, listing_id, target_price, is_active, notified_at, created_at, car_listings(title, price, image_url)",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        const rawRows: unknown[] = Array.isArray(data) ? (data as unknown[]) : [];
        const rows = rawRows
          .map((entry) => parseAlertRow(entry))
          .filter((entry): entry is AlertRow => entry !== null);
        setAlerts(rows);
      } catch (error) {
        console.error("[Profile] Failed to load alerts:", error);
        setAlerts([]);
      } finally {
        setAlertsLoading(false);
      }
    };
    void load();
  }, [activeTab, isFastApiMode, user]);

  useEffect(() => {
    if (activeTab !== "favorites" || !user) {return;}
    if (!favorites.length) {
      setFavListings([]);
      return;
    }
    setFavLoading(true);
    void fetchListingsByIds(favorites)
      .then((data) => {
        setFavListings(data);
      })
      .catch((error) => {
        console.error("[Profile] Failed to load favorite listings:", error);
        setFavListings([]);
      })
      .finally(() => setFavLoading(false));
  }, [activeTab, favorites, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-20 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!user) {return <Navigate to="/" replace />;}

  const initials = user.email ? user.email.slice(0, 2).toUpperCase() : "U";
  const joinedDate = new Date(user.created_at).toLocaleDateString("it-IT", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const deleteAlert = async (id: string) => {
    if (isFastApiMode) {
      await deactivateAlertApi(id, { userId: user.id, clientId: getClientId() });
    } else {
      await supabase.from("price_alerts").delete().eq("id", id);
    }
    setAlerts((prev) => prev.filter((item) => item.id !== id));
  };

  const runSearch = (filters: SearchFiltersState) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (key === "isNew") {
        if (value === true) {params.set("isNew", "true");}
        else if (value === false) {params.set("isNew", "false");}
        return;
      }
      if (Array.isArray(value)) {
        if (value.length) {params.set(key, value.join(","));}
        return;
      }
      if (value !== "" && value !== null && value !== undefined) {
        params.set(key, String(value));
      }
    });
    navigate(`/risultati?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8 max-w-4xl">
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
                  <p className="text-2xl font-bold text-foreground">{alerts.length || "-"}</p>
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

          <TabsContent value="alerts">
            <div className="space-y-3">
              {alertsLoading && (
                <p className="text-sm text-muted-foreground py-8 text-center">Caricamento alert...</p>
              )}
              {!alertsLoading && alerts.length === 0 && (
                <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
                  <Bell className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Nessun alert attivo.</p>
                </div>
              )}
              {alerts.map((alert) => (
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
                    <p className="text-sm font-medium truncate">{alert.car_listings?.title || "Auto"}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>
                        Attuale:{" "}
                        <strong className="text-foreground">
                          EUR {(alert.car_listings?.price || 0).toLocaleString("it-IT")}
                        </strong>
                      </span>
                      <span>
                        Target:{" "}
                        <strong className="text-violet-600">
                          EUR {alert.target_price.toLocaleString("it-IT")}
                        </strong>
                      </span>
                    </div>
                    <div className="mt-1.5">
                      {alert.notification_status === "failed" ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Fallito
                        </Badge>
                      ) : alert.notification_status === "retrying" ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Retry in corso
                        </Badge>
                      ) : alert.notified_at ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Notificato
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0">Attivo</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => void deleteAlert(alert.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="searches">
            <div className="space-y-3">
              {!searches.length && (
                <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
                  <Bookmark className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Nessuna ricerca salvata.</p>
                </div>
              )}
              {searches.map((search) => (
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
                      {new Date(search.createdAt).toLocaleDateString("it-IT")}
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
                      onClick={() => {
                        void removeSearch(search.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="favorites">
            {!favorites.length && (
              <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
                <Heart className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nessun preferito salvato.</p>
              </div>
            )}
            {favLoading && (
              <p className="text-sm text-muted-foreground py-8 text-center">Caricamento preferiti...</p>
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
