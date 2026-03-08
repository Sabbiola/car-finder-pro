import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Share2, Check, ExternalLink } from "lucide-react";
import Header from "@/components/Header";
import { fetchListingsByIds } from "@/lib/api/fetchByIds";
import type { CarListing } from "@/lib/api/listings";
import { priceRatingConfig } from "@/lib/rating-config";

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
    get: (c) => priceRatingConfig[c.price_rating || "normal"]?.label || "—",
  },
  { label: "Posizione", get: (c) => c.location || "—" },
];

function findBestIndex(values: (number | null)[], mode: "min" | "max"): number | null {
  const nums = values.map((v, i) => ({ v, i })).filter((x) => x.v !== null) as {
    v: number;
    i: number;
  }[];
  if (nums.length < 2) return null;
  const best =
    mode === "min"
      ? nums.reduce((a, b) => (a.v < b.v ? a : b))
      : nums.reduce((a, b) => (a.v > b.v ? a : b));
  return best.i;
}

const Confronta = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ids = (searchParams.get("ids") || "").split(",").filter(Boolean);
  const [cars, setCars] = useState<CarListing[]>([]);
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
  }, [ids.join(",")]);

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
                      ? findBestIndex(cars.map(row.numericGet!), row.bestMode)
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
