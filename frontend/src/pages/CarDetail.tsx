import { lazy, Suspense, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft,
  Award,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Share2,
} from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import Header from "@/components/Header";
import LoanCalculator from "@/components/LoanCalculator";
import PriceAlertButton from "@/components/PriceAlertButton";
import CarCard from "@/components/CarCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useListingAnalysis } from "@/features/results/hooks/useListingAnalysis";
import { ListingGallery } from "@/features/detail/components/ListingGallery";
import { PriceHistoryChart, PriceComparisonChart } from "@/features/detail/components/ListingPriceCharts";
import {
  useListingDetail,
  parseDetailPayload,
  buildGalleryImages,
} from "@/features/detail/hooks/useListingDetail";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { FALLBACK_IMAGE } from "@/lib/constants";
import { priceRatingConfig as ratingConfig } from "@/lib/rating-config";
import { toCardListing } from "@/lib/toCardListing";

const ListingInsightsPanel = lazy(() => import("@/features/results/components/ListingInsightsPanel"));

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

  const [copied, setCopied] = useState(false);

  const { car, similar, allPrices, priceHistory, loading, detailLoading, fetchError, resolvedUrl } =
    useListingDetail(id, sourceUrlFromState, listingSnapshot, (carId) => addRecent(carId));

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

  const galleryImages = useMemo(
    () => (car ? buildGalleryImages({ ...car, image_url: car.image_url ?? undefined }) : [FALLBACK_IMAGE]),
    [car],
  );

  const autoscoutPayload = useMemo(() => parseDetailPayload(car?.extra_data), [car?.extra_data]);

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
  const sellerLabel =
    car.seller_type === "dealer"
      ? car.seller_name || "Rivenditore"
      : car.seller_type === "private"
        ? "Privato"
        : null;

  const specs = [
    { label: "Anno", value: listing.year },
    { label: "Chilometri", value: `${listing.km.toLocaleString("it-IT")} km` },
    { label: "Alimentazione", value: listing.fuel || "N/A" },
    { label: "Cambio", value: listing.transmission || "N/A" },
    { label: "Potenza", value: listing.power || "N/A" },
    { label: "Carrozzeria", value: listing.bodyType || "N/A" },
    { label: "Colore", value: listing.color || "N/A" },
    { label: "Porte", value: car.doors ?? "N/A" },
    ...(car.seats ? [{ label: "Posti", value: car.seats }] : []),
    ...(car.emission_class ? [{ label: "Emissioni", value: car.emission_class }] : []),
    ...(car.condition
      ? [{ label: "Condizione", value: car.condition === "used" ? "Usato" : car.condition === "new" ? "Nuovo" : car.condition }]
      : []),
    ...(sellerLabel ? [{ label: "Venditore", value: sellerLabel }] : []),
    ...(car.version ? [{ label: "Versione", value: car.version }] : []),
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
        <title>{`${listing.title} - EUR ${listing.price.toLocaleString("it-IT")} | CarFinder Pro`}</title>
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
            <ListingGallery
              images={galleryImages}
              title={listing.title}
              source={listing.source}
              priceRating={priceRating}
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
                    if (url) { window.open(url, "_blank", "noopener,noreferrer"); }
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

        {(analysisQuery.isLoading || Boolean(analysisQuery.data) || analysisQuery.isError) && (
          <div className="animate-brutal-up" style={{ animationDelay: "90ms" }}>
            {analysisQuery.isLoading ? (
              <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
                Caricamento analisi decisionale...
              </div>
            ) : analysisQuery.isError ? (
              <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
                Analisi decisionale non disponibile:{" "}
                {analysisQuery.error instanceof Error ? analysisQuery.error.message : "errore runtime"}
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

        {(autoscoutPayload.specs.length > 0 || autoscoutPayload.equipment.length > 0) && (
          <div className="rounded-2xl border border-border/60 overflow-hidden animate-brutal-up" style={{ animationDelay: "120ms" }}>
            <div className="border-b border-border/60 px-5 py-3 flex items-center gap-2 bg-muted/40">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Accessori e dettagli</h2>
            </div>
            <div className="p-5 space-y-4">
              {autoscoutPayload.specs.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-2">
                  {autoscoutPayload.specs.map((item) => (
                    <div key={item.label} className="bg-muted/60 rounded-xl px-3 py-2.5">
                      <div className="text-[10px] font-medium text-muted-foreground mb-0.5">{item.label}</div>
                      <div className="text-sm font-bold">{item.value}</div>
                    </div>
                  ))}
                </div>
              )}
              {autoscoutPayload.equipment.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2">Equipaggiamento</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {autoscoutPayload.equipment.map((item) => (
                      <Badge key={item} variant="outline" className="rounded-full text-[11px]">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="animate-brutal-up" style={{ animationDelay: "180ms" }}>
          <LoanCalculator price={car.price} />
        </div>

        <PriceHistoryChart history={priceHistory} />

        <PriceComparisonChart
          prices={allPrices}
          currentId={car.id}
          brand={listing.brand}
          model={listing.model}
        />

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
