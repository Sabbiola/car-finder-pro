import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft,
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Share2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

import FavoriteButton from "@/components/FavoriteButton";
import Header from "@/components/Header";
import LoanCalculator from "@/components/LoanCalculator";
import PriceAlertButton from "@/components/PriceAlertButton";
import CarCard from "@/components/CarCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useListingAnalysis } from "@/features/results/hooks/useListingAnalysis";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { supabase } from "@/integrations/supabase/client";
import { FALLBACK_IMAGE } from "@/lib/constants";
import type { CarListing } from "@/lib/api/listings";
import { sourceColors, sourceLabels } from "@/lib/mock-data";
import { priceRatingConfig as ratingConfig } from "@/lib/rating-config";
import { getFastApiBaseUrlOrThrow, getRuntimeConfig } from "@/lib/runtimeConfig";
import { toCardListing } from "@/lib/toCardListing";
import { fetchListingDetailContext } from "@/services/api/listingDetail";

const ListingInsightsPanel = lazy(() => import("@/features/results/components/ListingInsightsPanel"));

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

function snapshotToExtendedListing(
  snapshot: Record<string, unknown> | null | undefined,
  fallbackId: string,
): ExtendedListing {
  const getString = (key: string): string | null => {
    const value = snapshot?.[key];
    return typeof value === "string" ? value : null;
  };
  const getNumber = (key: string): number | null => {
    const value = snapshot?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  const getBoolean = (key: string): boolean | null => {
    const value = snapshot?.[key];
    return typeof value === "boolean" ? value : null;
  };

  const imageUrl = getString("imageUrl");
  return {
    id: fallbackId,
    title: getString("title") || "Annuncio",
    brand: getString("brand") || "",
    model: getString("model") || "",
    trim: null,
    year: getNumber("year") || new Date().getFullYear(),
    price: getNumber("price") || 0,
    km: getNumber("km") || 0,
    fuel: getString("fuel"),
    transmission: getString("transmission"),
    power: null,
    color: null,
    doors: null,
    body_type: getString("bodyType"),
    source: getString("source") || "autoscout24",
    source_url: getString("url"),
    image_url: imageUrl,
    location: getString("location"),
    is_new: false,
    is_best_deal: getBoolean("isBestDeal") || false,
    price_rating: getString("priceRating"),
    scraped_at: new Date().toISOString(),
    description: null,
    emission_class: null,
    version: null,
    seats: null,
    condition: null,
    detail_scraped: false,
    image_urls: imageUrl ? [imageUrl] : null,
    extra_data: null,
  };
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CarDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { addRecent } = useRecentlyViewed();

  const canGoBack = location.key !== "default";
  const listingRef = (location.state as { listingRef?: { sourceUrl?: string | null } } | null)
    ?.listingRef;
  const listingSnapshot = (location.state as { listingSnapshot?: unknown } | null)?.listingSnapshot;
  const sourceUrlFromQuery = searchParams.get("source_url");
  const sourceUrlFromState = listingRef?.sourceUrl || sourceUrlFromQuery || null;

  const [car, setCar] = useState<ExtendedListing | null>(null);
  const [similar, setSimilar] = useState<CarListing[]>([]);
  const [allPrices, setAllPrices] = useState<CarListing[]>([]);
  const [priceHistory, setPriceHistory] = useState<Array<{ price: number; recorded_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const analysisListingId = useMemo(
    () => (car?.id && UUID_REGEX.test(car.id) ? car.id : undefined),
    [car?.id],
  );
  const analysisQuery = useListingAnalysis({
    listingId: analysisListingId,
    listing: car,
    include: ["deal", "trust", "negotiation", "ownership"],
    enabled: !!car,
  });

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can fail on non-secure contexts.
    }
  };

  const galleryImages = useMemo(() => {
    if (!car) return [];
    const normalize = (raw: string) => {
      let value = raw.startsWith("//") ? `https:${raw}` : raw;
      if (value.includes("images.sbito.it") && value.includes("rule=")) {
        value = value.replace(/rule=[^&]+/, "rule=fullscreen-1x-auto");
      }
      if (value.includes("autoscout24.net/listing-images/")) {
        value = value.replace(/\/\d+x\d+(\.\w+)$/, "/800x600$1");
      }
      return value;
    };
    const main = normalize(car.image_url || "") || FALLBACK_IMAGE;
    const extras = (car.image_urls || []).map(normalize).filter((url) => url && url !== main);
    return [main, ...extras];
  }, [car]);

  const prevImage = useCallback(() => {
    setImgIndex((index) => (index - 1 + galleryImages.length) % galleryImages.length);
  }, [galleryImages.length]);

  const nextImage = useCallback(() => {
    setImgIndex((index) => (index + 1) % galleryImages.length);
  }, [galleryImages.length]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") prevImage();
      if (event.key === "ArrowRight") nextImage();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [nextImage, prevImage]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const fetchCar = async () => {
      setLoading(true);
      setDetailLoading(true);
      setFetchError(null);
      setImgIndex(0);
      setResolvedUrl(sourceUrlFromState);

      try {
        const runtime = getRuntimeConfig();
        if (runtime.backendMode === "fastapi") {
          const detail = await fetchListingDetailContext(getFastApiBaseUrlOrThrow("Listing detail"), {
            listingId: id,
            sourceUrl: sourceUrlFromState,
            includeAnalysis: false,
          });
          if (cancelled) return;

          const detailListing: ExtendedListing = {
            ...detail.listing,
            description: detail.listing.description || null,
            emission_class: detail.listing.emission_class || null,
            version: detail.listing.version || null,
            seats: detail.listing.seats || null,
            condition: detail.listing.condition || null,
            detail_scraped: true,
            image_urls: detail.listing.image_urls || null,
            extra_data: detail.listing.extra_data || null,
          };

          setCar(detailListing);
          addRecent(detailListing.id);
          setSimilar(detail.similarListings);
          setAllPrices(detail.priceSamples);
          setPriceHistory(detail.priceHistory);
          setResolvedUrl(detail.listing.source_url || sourceUrlFromState);
          return;
        }

        const { data, error } = await supabase.from("car_listings").select("*").eq("id", id).single();
        if (cancelled) return;
        if (error || !data) {
          setFetchError("Auto non trovata o errore nel caricamento.");
          return;
        }

        const carData = data as ExtendedListing;
        setCar(carData);
        addRecent(carData.id);

        const [similarRes, pricesRes, historyRes] = await Promise.all([
          supabase
            .from("car_listings")
            .select("*")
            .eq("brand", data.brand)
            .eq("model", data.model)
            .neq("id", data.id)
            .limit(6),
          supabase
            .from("car_listings")
            .select("*")
            .eq("brand", data.brand)
            .eq("model", data.model)
            .order("price", { ascending: true })
            .limit(20),
          supabase
            .from("price_history")
            .select("price, recorded_at")
            .eq("listing_id", data.id)
            .order("recorded_at", { ascending: true })
            .limit(30),
        ]);

        if (cancelled) return;
        setSimilar((similarRes.data as CarListing[]) || []);
        setAllPrices((pricesRes.data as CarListing[]) || []);
        setPriceHistory(historyRes.data || []);

        let listingUrl = carData.source_url && carData.source_url !== "#" ? carData.source_url : null;
        if (!listingUrl && carData.source === "autoscout24" && carData.image_url) {
          const idMatch = carData.image_url.match(/listing-images\/([a-f0-9-]{36})/);
          if (idMatch) {
            const slug = carData.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
            listingUrl = `https://www.autoscout24.it/annunci/${slug}-${idMatch[1]}`;
          }
        }
        if (listingUrl) setResolvedUrl(listingUrl);
      } catch (error) {
        if (cancelled) return;
        console.error("[CarDetail] Unexpected fetch error:", error);
        if (listingSnapshot) {
          const fallback = snapshotToExtendedListing(listingSnapshot as Record<string, unknown>, id);
          setCar(fallback);
          addRecent(fallback.id);
          setSimilar([]);
          setAllPrices([]);
          setPriceHistory([]);
          setResolvedUrl(fallback.source_url || sourceUrlFromState);
          setFetchError(null);
        } else {
          setFetchError(
            error instanceof Error ? error.message : "Errore imprevisto nel caricamento dell'auto.",
          );
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
          setLoading(false);
        }
      }
    };

    void fetchCar();
    return () => {
      cancelled = true;
    };
  }, [addRecent, id, listingSnapshot, sourceUrlFromState]);

  const chartData = useMemo(() => {
    if (!allPrices.length || !car) return [];
    return allPrices.map((item) => ({
      name: item.title.length > 20 ? `${item.title.slice(0, 20)}...` : item.title,
      price: item.price,
      isCurrent: item.id === car.id,
      rating: item.price_rating || "normal",
    }));
  }, [allPrices, car]);

  const avgPrice = useMemo(() => {
    if (!allPrices.length) return 0;
    return Math.round(allPrices.reduce((acc, item) => acc + item.price, 0) / allPrices.length);
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
          <p className="text-sm text-muted-foreground">{fetchError || "Auto non trovata"}</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Torna indietro
          </Button>
        </div>
      </div>
    );
  }

  const listing = toCardListing(car);
  const priceRating = listing.priceRating || "normal";
  const ratingStyle = ratingConfig[priceRating];
  const specs = [
    { label: "Anno", value: listing.year },
    { label: "Chilometri", value: `${listing.km.toLocaleString("it-IT")} km` },
    { label: "Alimentazione", value: listing.fuel || "N/A" },
    { label: "Cambio", value: listing.transmission || "N/A" },
    { label: "Potenza", value: listing.power || "N/A" },
    { label: "Carrozzeria", value: listing.bodyType || "N/A" },
    ...(car.emission_class ? [{ label: "Emissioni", value: car.emission_class }] : []),
    ...(car.condition ? [{ label: "Condizione", value: car.condition }] : []),
    ...(car.version ? [{ label: "Versione", value: car.version }] : []),
    ...(car.seats ? [{ label: "Posti", value: car.seats }] : []),
    ...(car.doors ? [{ label: "Porte", value: car.doors }] : []),
    ...(car.color ? [{ label: "Colore", value: car.color }] : []),
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: listing.title,
    brand: { "@type": "Brand", name: listing.brand },
    model: listing.model,
    vehicleModelDate: String(listing.year),
    mileageFromOdometer: { "@type": "QuantitativeValue", value: listing.km, unitCode: "KMT" },
    fuelType: listing.fuel || undefined,
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      url: window.location.href,
    },
    image: galleryImages[0],
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{`${listing.title} - EUR ${listing.price.toLocaleString("it-IT")} | AutoDeal Finder`}</title>
        <meta
          name="description"
          content={`${listing.title} a EUR ${listing.price.toLocaleString("it-IT")} - ${listing.year}, ${listing.km.toLocaleString("it-IT")} km, ${listing.fuel || ""} ${listing.transmission || ""}. ${listing.location || ""}`}
        />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Header />
      <div className="container py-6 space-y-8">
        <button
          onClick={() => (canGoBack ? navigate(-1) : navigate("/"))}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors animate-brutal-in"
        >
          <ArrowLeft className="h-4 w-4" /> Indietro
        </button>

        <div className="rounded-2xl border border-border/60 shadow-sm overflow-hidden animate-brutal-up">
          <div className="grid lg:grid-cols-2">
            <div className="relative aspect-[4/3] lg:aspect-auto overflow-hidden">
              <img
                src={galleryImages[imgIndex]}
                alt={`${listing.title} - foto ${imgIndex + 1}`}
                className="w-full h-full object-cover transition-opacity duration-200 cursor-pointer"
                loading="lazy"
                referrerPolicy="no-referrer"
                onClick={() => setLightboxOpen(true)}
                onError={(event) => {
                  (event.target as HTMLImageElement).src = FALLBACK_IMAGE;
                }}
              />
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
                </>
              )}
              <div className="absolute bottom-3 right-3 bg-black/50 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
                {imgIndex + 1} / {galleryImages.length}
              </div>
              <div
                className={`absolute top-3 left-3 ${sourceColors[listing.source]} text-white text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-sm`}
              >
                {sourceLabels[listing.source]}
              </div>
              {priceRating === "best" && (
                <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                  <Award className="h-3 w-3" /> TOP DEAL
                </div>
              )}
            </div>

            <Lightbox
              open={lightboxOpen}
              close={() => setLightboxOpen(false)}
              index={imgIndex}
              slides={galleryImages.map((src) => ({ src }))}
            />

            <div className="p-6 lg:p-8 space-y-6 bg-card">
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-2xl md:text-3xl font-extrabold leading-tight flex-1">
                    {listing.title}
                  </h1>
                  <FavoriteButton id={listing.id} className="flex-shrink-0 mt-1" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShare}
                    className="rounded-xl h-9 w-9 flex-shrink-0 mt-1"
                    aria-label="Condividi link annuncio"
                  >
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

              <div className="flex items-end gap-3">
                <span className="text-4xl font-extrabold bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
                  EUR {listing.price.toLocaleString("it-IT")}
                </span>
                <Badge
                  variant="outline"
                  className={`rounded-full text-[10px] font-semibold mb-1 border-0 ${ratingStyle.className}`}
                >
                  {ratingStyle.label}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {specs.map((item) => (
                  <div key={item.label} className="bg-muted/60 rounded-xl px-3 py-2.5">
                    <div className="text-[10px] font-medium text-muted-foreground mb-0.5">
                      {item.label}
                    </div>
                    <div className="text-sm font-bold">{item.value}</div>
                  </div>
                ))}
              </div>

              {detailLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 rounded-xl px-3 py-2.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Caricamento dettagli...
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2 font-semibold rounded-xl h-12 bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 border-0 text-white shadow-md hover:shadow-violet-200 transition-all disabled:opacity-40"
                  onClick={() => {
                    const url = listing.url !== "#" ? listing.url : resolvedUrl;
                    if (url) window.open(url, "_blank", "noopener,noreferrer");
                  }}
                  disabled={listing.url === "#" && !resolvedUrl}
                >
                  <ExternalLink className="h-4 w-4" /> Vai all'annuncio
                </Button>
                <PriceAlertButton listingId={listing.id} currentPrice={listing.price} title={listing.title} />
              </div>
            </div>
          </div>
        </div>

        {galleryImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin animate-brutal-up" style={{ animationDelay: "50ms" }}>
            {galleryImages.map((url, index) => (
              <button
                key={index}
                onClick={() => setImgIndex(index)}
                aria-label={`Foto ${index + 1}`}
                className={`flex-shrink-0 w-16 h-12 rounded-xl overflow-hidden transition-all ${
                  index === imgIndex
                    ? "ring-2 ring-violet-500 scale-105 shadow-md"
                    : "opacity-60 hover:opacity-100 border border-border"
                }`}
              >
                <img src={url} alt={`Thumb ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {(analysisQuery.data || analysisQuery.isLoading) && (
          <div className="animate-brutal-up" style={{ animationDelay: "90ms" }}>
            {analysisQuery.isLoading ? (
              <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
                Caricamento analisi decisionale...
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
                    Caricamento insights...
                  </div>
                }
              >
                <ListingInsightsPanel listing={car} analysis={analysisQuery.data} />
              </Suspense>
            )}
          </div>
        )}

        {car.description && (
          <div className="rounded-2xl border border-border/60 overflow-hidden animate-brutal-up" style={{ animationDelay: "100ms" }}>
            <div className="border-b border-border/60 px-5 py-3 flex items-center gap-2 bg-muted/40">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Descrizione</h2>
            </div>
            <div className="p-5">
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{car.description}</p>
            </div>
          </div>
        )}

        <div className="animate-brutal-up" style={{ animationDelay: "180ms" }}>
          <LoanCalculator price={car.price} />
        </div>

        {priceHistory.length >= 2 && (
          <div className="space-y-4 animate-brutal-up" style={{ animationDelay: "195ms" }}>
            <div>
              <h2 className="text-lg font-bold">Storico prezzi</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Andamento del prezzo nel tempo</p>
            </div>
            <div className="rounded-2xl border border-border/60 p-4 bg-card shadow-sm">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={priceHistory} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="recorded_at"
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
                    }
                    tick={{ fontSize: 10, fontFamily: "Inter" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fontFamily: "Inter" }}
                    tickFormatter={(value) => `EUR ${(value / 1000).toFixed(0)}k`}
                    domain={["auto", "auto"]}
                    width={52}
                  />
                  <Tooltip
                    formatter={(value: number) => [`EUR ${value.toLocaleString("it-IT")}`, "Prezzo"]}
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })
                    }
                  />
                  <Line type="monotone" dataKey="price" stroke="hsl(262 83% 60%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {chartData.length > 1 && (
          <div className="space-y-4 animate-brutal-up" style={{ animationDelay: "200ms" }}>
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-lg font-bold">Confronto prezzi</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {listing.brand} {listing.model} - Media: EUR {avgPrice.toLocaleString("it-IT")}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 p-4 bg-card shadow-sm">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fontFamily: "Inter" }}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 10, fontFamily: "Inter" }} tickFormatter={(v) => `EUR ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [`EUR ${value.toLocaleString("it-IT")}`, "Prezzo"]} />
                  <ReferenceLine
                    y={avgPrice}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    label={{ value: "Media", position: "right", fontSize: 10, fontFamily: "Inter" }}
                  />
                  <Bar dataKey="price" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.isCurrent
                            ? "hsl(262 83% 60%)"
                            : entry.rating === "best"
                              ? "hsl(142 76% 40%)"
                              : entry.rating === "good"
                                ? "hsl(217 91% 55%)"
                                : "hsl(var(--muted-foreground))"
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

        {similar.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">
              Annunci simili
              <span className="text-muted-foreground font-normal text-sm ml-2">({similar.length})</span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              {similar.map((item, index) => (
                <CarCard key={item.id} listing={toCardListing(item)} index={index} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CarDetail;
