import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Share2, Check, ExternalLink } from "lucide-react";
import Header from "@/components/Header";
import { fetchListingsByIds } from "@/lib/api/fetchByIds";
import type { CarListing, ListingAnalysis } from "@/lib/api/listings";
import { priceRatingConfig } from "@/lib/rating-config";
import { getFastApiBaseUrlOrThrow, getRuntimeConfig } from "@/lib/runtimeConfig";
import { analyzeListing } from "@/services/api/listingAnalysis";

import { FALLBACK_IMAGE } from "@/lib/constants";

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

const Confronta = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const idsParam = searchParams.get("ids") || "";
  const ids = idsParam.split(",").filter(Boolean);
  const idsKey = ids.join(",");
  const [cars, setCars] = useState<CarListing[]>([]);
  const [analysesById, setAnalysesById] = useState<Partial<Record<string, ListingAnalysis>>>({});
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
      .then(setCars)
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    const runtime = getRuntimeConfig();
    if (runtime.backendMode !== "fastapi" || cars.length === 0) {return;}
    const apiBaseUrl = getFastApiBaseUrlOrThrow("Compare analysis");

    let cancelled = false;
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
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [cars]);

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

            {Object.keys(analysesById).length > 0 && (
              <div className="grid gap-4 lg:grid-cols-3">
                {cars.map((car) => {
                  const analysis = analysesById[car.id];
                  return (
                    <div key={car.id} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                      <div className="text-sm font-semibold">{car.title}</div>
                      <div className="flex flex-wrap gap-2">
                        {analysis?.deal_summary?.headline && (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            {analysis.deal_summary.headline}
                          </span>
                        )}
                        {analysis?.trust_summary?.risk_level && (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                            Risk {analysis.trust_summary.risk_level}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Perche si</div>
                        <div className="text-sm text-muted-foreground">
                          {analysis?.deal_summary?.top_reasons?.[0] || "nessun insight disponibile"}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Perche no</div>
                        <div className="text-sm text-muted-foreground">
                          {analysis?.trust_summary?.flags?.[0] || "nessuna criticita dominante"}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Target</div>
                          <div className="text-sm font-semibold">
                            {analysis?.negotiation_summary?.target_price
                              ? `EUR ${analysis.negotiation_summary.target_price.toLocaleString("it-IT")}`
                              : "n/d"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Costo 24 mesi</div>
                          <div className="text-sm font-semibold">
                            {analysis?.ownership_estimate?.total_cost_of_ownership
                              ? `EUR ${analysis.ownership_estimate.total_cost_of_ownership.toLocaleString("it-IT")}`
                              : "n/d"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
