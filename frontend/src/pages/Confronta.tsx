import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Share2,
  Check,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  TrendingDown,
  TrendingUp,
  Minus,
  Trophy,
  Wrench,
  MessageSquare,
} from "lucide-react";
import Header from "@/components/Header";
import { fetchListingsByIds } from "@/lib/api/fetchByIds";
import type {
  CarListing,
  ListingAnalysis,
  RiskLevel,
  AnalysisConfidence,
} from "@/lib/api/listings";
import { priceRatingConfig } from "@/lib/rating-config";
import { getFastApiBaseUrlOrThrow, getRuntimeConfig } from "@/lib/runtimeConfig";
import { analyzeListing } from "@/services/api/listingAnalysis";
import { FALLBACK_IMAGE } from "@/lib/constants";
import { useCompare } from "@/hooks/useCompare";
import type { CardListing } from "@/lib/toCardListing";

// ---------------------------------------------------------------------------
// CardListing → CarListing adapter (used when API batch returns nothing)
// ---------------------------------------------------------------------------

function cardListingToCarListing(c: CardListing): CarListing {
  return {
    id: c.id,
    title: c.title,
    brand: c.brand,
    model: c.model,
    trim: null,
    year: c.year,
    price: c.price,
    km: c.km,
    fuel: c.fuel || null,
    transmission: c.transmission || null,
    power: c.power || null,
    color: c.color || null,
    doors: c.doors || null,
    body_type: c.bodyType || null,
    source: c.source,
    source_url: c.url !== "#" ? c.url : null,
    image_url: c.imageUrl,
    image_urls: c.imageUrls,
    location: c.location || null,
    is_new: c.isNew,
    is_best_deal: c.isBestDeal ?? false,
    price_rating: c.priceRating ?? "normal",
    scraped_at: new Date().toISOString(),
    emission_class: c.emissionClass ?? null,
    condition: c.condition ?? null,
    seller_type: c.sellerType ?? null,
    deal_summary: c.dealSummary ?? null,
    trust_summary: c.trustSummary ?? null,
    negotiation_summary: c.negotiationSummary ?? null,
  };
}

// ---------------------------------------------------------------------------
// Spec table definition
// ---------------------------------------------------------------------------

type RowDef = {
  label: string;
  get: (car: CarListing) => string | number;
  bestMode?: "min" | "max";
  numericGet?: (car: CarListing) => number | null;
};

const rows: RowDef[] = [
  {
    label: "Prezzo",
    get: (c) => `€${c.price.toLocaleString("it-IT")}`,
    bestMode: "min",
    numericGet: (c) => c.price,
  },
  { label: "Anno", get: (c) => c.year, bestMode: "max", numericGet: (c) => c.year },
  {
    label: "Chilometri",
    get: (c) => `${c.km.toLocaleString("it-IT")} km`,
    bestMode: "min",
    numericGet: (c) => c.km,
  },
  { label: "Carburante", get: (c) => c.fuel || "—" },
  { label: "Cambio", get: (c) => c.transmission || "—" },
  { label: "Potenza", get: (c) => c.power || "—" },
  { label: "Carrozzeria", get: (c) => c.body_type || "—" },
  { label: "Emissioni", get: (c) => c.emission_class || "—" },
  { label: "Colore", get: (c) => c.color || "—" },
  { label: "Porte", get: (c) => c.doors ?? "—" },
  {
    label: "Rating prezzo",
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    get: (c) => priceRatingConfig[c.price_rating || "normal"]?.label || "—",
  },
  { label: "Posizione", get: (c) => c.location || "—" },
];

function findBestIndex(values: (number | null)[], mode: "min" | "max"): number | null {
  const nums = values.map((v, i) => ({ v, i })).filter((x) => x.v !== null) as {
    v: number;
    i: number;
  }[];
  if (nums.length < 2) {return null;}
  const best =
    mode === "min"
      ? nums.reduce((a, b) => (a.v < b.v ? a : b))
      : nums.reduce((a, b) => (a.v > b.v ? a : b));
  return best.i;
}

// ---------------------------------------------------------------------------
// Helper sub-components
// ---------------------------------------------------------------------------

function RiskBadge({ level }: { level?: RiskLevel }) {
  if (!level) {return null;}
  const cfg = {
    low: {
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      label: "Rischio basso",
      cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    },
    medium: {
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      label: "Rischio medio",
      cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    },
    high: {
      icon: <ShieldX className="h-3.5 w-3.5" />,
      label: "Rischio alto",
      cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    },
  }[level];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function ConfidenceDot({ confidence }: { confidence?: AnalysisConfidence }) {
  if (!confidence) {return null;}
  const colors: Record<AnalysisConfidence, string> = {
    high: "bg-emerald-400",
    medium: "bg-amber-400",
    low: "bg-orange-400",
    insufficient: "bg-red-400",
  };
  return (
    <span title={`Confidenza: ${confidence}`} className={`inline-block h-2 w-2 rounded-full ${colors[confidence]}`} />
  );
}

function PriceDeltaChip({ pct }: { pct?: number | null }) {
  if (pct == null) {return null;}
  const pos = pct > 0;
  const cls = pos
    ? "text-red-600 bg-red-50 dark:bg-red-900/20"
    : "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20";
  const Icon = pos ? TrendingUp : pct === 0 ? Minus : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      <Icon className="h-3 w-3" />
      {pos ? "+" : ""}{pct.toFixed(1)}% vs mercato
    </span>
  );
}

function ScoreBar({ score, label }: { score?: number | null; label: string }) {
  if (score == null) {return null;}
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">{Math.round(pct)}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CostLine({ label, value }: { label: string; value?: number }) {
  if (value == null) {return null;}
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">€{value.toLocaleString("it-IT")}</span>
    </div>
  );
}

function BulletList({ items, max = 3 }: { items?: string[]; max?: number }) {
  if (!items?.length) {return null;}
  return (
    <ul className="space-y-1">
      {items.slice(0, max).map((item, i) => (
        <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
          <span className="mt-0.5 shrink-0 text-violet-400">•</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Analysis card
// ---------------------------------------------------------------------------

function AnalysisCard({ car, analysis }: { car: CarListing; analysis?: ListingAnalysis }) {
  const deal = analysis?.deal_summary;
  const trust = analysis?.trust_summary;
  const nego = analysis?.negotiation_summary;
  const own = analysis?.ownership_estimate;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
      <div className="text-sm font-semibold leading-tight">{car.title}</div>

      {/* Deal score + price delta */}
      {(deal?.price_delta_pct != null || trust?.trust_score != null) && (
        <div className="space-y-2">
          <ScoreBar score={trust?.trust_score} label="Trust score" />
          <div className="flex flex-wrap gap-2 items-center">
            <PriceDeltaChip pct={deal?.price_delta_pct} />
            <RiskBadge level={trust?.risk_level} />
            <ConfidenceDot confidence={deal?.confidence} />
          </div>
          {deal?.benchmark_price != null && (
            <p className="text-xs text-muted-foreground">
              Prezzo di riferimento:{" "}
              <span className="font-semibold text-foreground">
                €{deal.benchmark_price.toLocaleString("it-IT")}
              </span>
              {deal.comparable_count != null && ` (${deal.comparable_count} comparabili)`}
            </p>
          )}
        </div>
      )}

      {/* Pro / reasons */}
      {deal?.top_reasons?.length ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Punti di forza
          </p>
          <BulletList items={deal.top_reasons} max={4} />
        </div>
      ) : null}

      {/* Trust flags */}
      {trust?.flags?.length ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Segnalazioni
          </p>
          <BulletList items={trust.flags} max={4} />
        </div>
      ) : null}

      {/* Negotiation */}
      {(nego?.target_price != null || nego?.arguments?.length) && (
        <div className="space-y-2 rounded-xl bg-muted/40 border border-border/60 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            Trattativa
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {nego.opening_offer != null && (
              <div>
                <p className="text-[10px] text-muted-foreground">Apertura</p>
                <p className="text-xs font-semibold">€{nego.opening_offer.toLocaleString("it-IT")}</p>
              </div>
            )}
            {nego.target_price != null && (
              <div>
                <p className="text-[10px] text-muted-foreground">Target</p>
                <p className="text-xs font-semibold text-violet-600">€{nego.target_price.toLocaleString("it-IT")}</p>
              </div>
            )}
            {nego.walk_away_price != null && (
              <div>
                <p className="text-[10px] text-muted-foreground">Limite</p>
                <p className="text-xs font-semibold">€{nego.walk_away_price.toLocaleString("it-IT")}</p>
              </div>
            )}
          </div>
          {nego.arguments?.length ? (
            <BulletList items={nego.arguments} max={3} />
          ) : null}
        </div>
      )}

      {/* Ownership */}
      {own?.total_cost_of_ownership != null && (
        <div className="space-y-2 rounded-xl bg-muted/40 border border-border/60 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Wrench className="h-3 w-3" />
            Costo di possesso (24 mesi)
          </div>
          <div className="space-y-1">
            <CostLine label="Deprezzamento" value={own.depreciation_cost} />
            <CostLine label="Carburante / energia" value={own.fuel_or_energy_cost} />
            <CostLine label="Manutenzione" value={own.maintenance_cost} />
            <CostLine label="Assicurazione" value={own.insurance_cost} />
            <div className="border-t border-border/60 pt-1 flex justify-between text-xs">
              <span className="font-semibold">Totale</span>
              <span className="font-bold text-foreground">
                €{own.total_cost_of_ownership.toLocaleString("it-IT")}
              </span>
            </div>
            {own.monthly_cost != null && (
              <p className="text-[11px] text-muted-foreground text-right">
                ~€{own.monthly_cost.toLocaleString("it-IT")}/mese
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verdict banner
// ---------------------------------------------------------------------------

function VerdictBanner({
  cars,
  analysesById,
}: {
  cars: CarListing[];
  analysesById: Partial<Record<string, ListingAnalysis>>;
}) {
  // Score = trust_score - abs(price_delta_pct) + (100 - ownership/price*100)
  const scored = cars.map((car) => {
    const a = analysesById[car.id];
    const trust = a?.trust_summary?.trust_score ?? 50;
    const delta = Math.abs(a?.deal_summary?.price_delta_pct ?? 0);
    return { car, score: trust - delta };
  });
  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];
  if (!winner || scored.length < 2) {return null;}

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 dark:border-violet-800/60 dark:bg-violet-900/20 p-4">
      <Trophy className="h-6 w-6 text-violet-500 shrink-0" />
      <div>
        <p className="text-sm font-bold text-violet-700 dark:text-violet-300">
          Miglior scelta: {winner.car.title}
        </p>
        <p className="text-xs text-violet-600/70 dark:text-violet-400 mt-0.5">
          Score combinato trust + prezzo: {Math.round(winner.score)}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const Confronta = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { compareListings } = useCompare();
  const idsParam = searchParams.get("ids") || "";
  const ids = idsParam.split(",").filter(Boolean);
  const idsKey = ids.join(",");
  const [cars, setCars] = useState<CarListing[]>([]);
  const [analysesById, setAnalysesById] = useState<Partial<Record<string, ListingAnalysis>>>({});
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleShareComparison = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!ids.length) {
      setLoading(false);
      return;
    }
    fetchListingsByIds(ids)
      .then((apiCars) => {
        if (apiCars.length > 0) {
          setCars(apiCars);
        } else {
          const fromContext = ids
            .map((id) => compareListings[id])
            .filter((c): c is CardListing => Boolean(c))
            .map(cardListingToCarListing);
          setCars(fromContext);
        }
      })
      .catch(() => {
        const fromContext = ids
          .map((id) => compareListings[id])
          .filter((c): c is CardListing => Boolean(c))
          .map(cardListingToCarListing);
        setCars(fromContext);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    const runtime = getRuntimeConfig();
    if (runtime.backendMode !== "fastapi" || cars.length === 0) {return;}
    const apiBaseUrl = getFastApiBaseUrlOrThrow("Compare analysis");

    let cancelled = false;
    setAnalysisLoading(true);
    Promise.all(
      cars.map(async (car) => ({
        id: car.id,
        analysis: await analyzeListing(apiBaseUrl, {
          listing_id: car.id,
          include: ["deal", "trust", "negotiation", "ownership"],
        }),
      })),
    )
      .then((entries) => {
        if (cancelled) {return;}
        setAnalysesById(
          entries.reduce<Partial<Record<string, ListingAnalysis>>>((acc, entry) => {
            acc[entry.id] = entry.analysis;
            return acc;
          }, {}),
        );
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) {setAnalysisLoading(false);} });

    return () => {
      cancelled = true;
    };
  }, [cars]);

  const hasAnalyses = Object.keys(analysesById).length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-6 space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors animate-brutal-in"
        >
          <ArrowLeft className="h-4 w-4" /> Indietro
        </button>

        <div className="flex items-center justify-between animate-brutal-up">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold">Confronto auto</h1>
            <span className="text-muted-foreground text-sm">({cars.length} selezionate)</span>
          </div>
          {ids.length >= 2 && (
            <button
              onClick={handleShareComparison}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-1.5 hover:bg-muted"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              {copied ? "Copiato!" : "Copia link"}
            </button>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && cars.length > 0 && (
          <div className="space-y-6">
            {/* Verdict banner */}
            {hasAnalyses && (
              <VerdictBanner cars={cars} analysesById={analysesById} />
            )}

            {/* Spec table */}
            <div
              className="overflow-x-auto rounded-2xl border border-border shadow-sm animate-brutal-up"
              style={{ animationDelay: "100ms" }}
            >
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="p-4 text-left text-xs font-medium text-muted-foreground w-32">
                      Spec
                    </th>
                    {cars.map((car) => (
                      <th
                        key={car.id}
                        className="p-4 text-left min-w-[220px] align-top border-l border-border"
                      >
                        <img
                          src={car.image_url || FALLBACK_IMAGE}
                          alt={car.title}
                          className="w-full h-28 object-cover rounded-xl mb-3"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                          }}
                        />
                        <div className="text-sm font-semibold leading-tight">{car.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                          {car.source}
                        </div>
                        {car.source_url && car.source_url !== "#" && (
                          <a
                            href={car.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1.5 inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
                          >
                            Vai all&apos;annuncio <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => {
                    const bestIdx =
                      row.bestMode && row.numericGet
                        ? findBestIndex(cars.map(row.numericGet), row.bestMode)
                        : null;

                    return (
                      <tr
                        key={row.label}
                        className={`border-b border-border last:border-b-0 transition-colors ${ri % 2 !== 0 ? "bg-muted/20" : ""}`}
                      >
                        <td className="p-4 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          {row.label}
                        </td>
                        {cars.map((car, ci) => {
                          const isBest = bestIdx === ci;
                          return (
                            <td
                              key={car.id}
                              className={`p-4 text-sm font-medium border-l border-border ${isBest ? "text-violet-600 dark:text-violet-400" : ""}`}
                            >
                              {String(row.get(car))}
                              {isBest && (
                                <span className="ml-2 text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 px-2 py-0.5 rounded-full font-semibold">
                                  Top
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Analysis panels */}
            {analysisLoading && !hasAnalyses && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisi AI in corso…
              </div>
            )}

            {hasAnalyses && (
              <div>
                <h2 className="text-sm font-semibold mb-3">Analisi AI</h2>
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: `repeat(${Math.min(cars.length, 3)}, minmax(0, 1fr))` }}
                >
                  {cars.map((car) => (
                    <AnalysisCard
                      key={car.id}
                      car={car}
                      analysis={analysesById[car.id]}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && !cars.length && (
          <div className="text-center py-24 text-muted-foreground space-y-2">
            <p className="text-sm font-semibold">Nessuna auto da confrontare</p>
            <p className="text-xs text-muted-foreground">
              Seleziona 2-3 auto dalla pagina risultati e clicca "Confronta"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Confronta;
