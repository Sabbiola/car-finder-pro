import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { DealSummary, TrustSummary } from "@/lib/api/listings";

interface Props {
  dealSummary?: DealSummary | null;
  trustSummary?: TrustSummary | null;
}

const riskConfig: Record<string, { label: string; desc: string; bg: string; text: string }> = {
  low:    { label: "Basso",  desc: "Pochi segnali di rischio",                           bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" },
  medium: { label: "Medio",  desc: "Qualche elemento da verificare",                     bg: "bg-amber-100 dark:bg-amber-900/30",    text: "text-amber-700 dark:text-amber-400" },
  high:   { label: "Alto",   desc: "Procedi con cautela",                                bg: "bg-red-100 dark:bg-red-900/30",        text: "text-red-700 dark:text-red-400" },
};

const WhyThisCarPanel = ({ dealSummary, trustSummary }: Props) => {
  if (!dealSummary && !trustSummary) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
        Analisi non disponibile per questa sorgente.
      </div>
    );
  }

  const delta = dealSummary?.price_delta_pct;
  const hasDelta = typeof delta === "number";
  const isBelow = hasDelta && delta < -0.5;
  const isAbove = hasDelta && delta > 0.5;
  const risk = trustSummary?.risk_level?.toLowerCase();
  const riskCfg = risk ? riskConfig[risk] : null;
  const comparables = dealSummary?.comparable_count ?? 0;
  const priceChanges = dealSummary?.price_change_count ?? 0;
  const daysOnMarket = dealSummary?.days_on_market;

  const daysDesc =
    daysOnMarket == null ? "Dato non disponibile" :
    daysOnMarket > 60 ? "Da molto tempo — potrebbe trattare" :
    daysOnMarket > 20 ? "Sul mercato da alcune settimane" :
    "Annuncio recente";

  const changesDesc =
    priceChanges === 0 ? "Il prezzo non è mai cambiato" :
    priceChanges === 1 ? "Il venditore ha già abbassato il prezzo una volta" :
    `Il venditore ha abbassato il prezzo ${priceChanges} volte — più flessibile`;

  const comparablesDesc =
    comparables === 0 ? "Nessuna auto simile trovata — stima poco affidabile" :
    comparables < 3  ? "Poche auto simili — stima approssimativa" :
    `Basato su ${comparables} auto simili — stima affidabile`;

  return (
    <div className="space-y-3 pt-2">

      {/* Price delta hero */}
      {hasDelta && (
        <div className={`rounded-xl p-4 flex items-center gap-3 ${
          isBelow ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
          : isAbove ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          : "bg-muted/40 border border-border/60"
        }`}>
          <div className={`rounded-full p-2 shrink-0 ${
            isBelow ? "bg-emerald-100 dark:bg-emerald-800"
            : isAbove ? "bg-red-100 dark:bg-red-800"
            : "bg-muted"
          }`}>
            {isBelow
              ? <TrendingDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              : isAbove
              ? <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400" />
              : <Minus className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div>
            <div className={`text-base font-bold leading-tight ${
              isBelow ? "text-emerald-600 dark:text-emerald-400"
              : isAbove ? "text-red-600 dark:text-red-400"
              : "text-foreground"
            }`}>
              {isBelow
                ? `Costi ${Math.abs(delta).toFixed(1)}% meno della media`
                : isAbove
                ? `Costi ${delta.toFixed(1)}% più della media`
                : "Prezzo in linea con il mercato"}
            </div>
            {dealSummary?.benchmark_price && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Prezzo medio di mercato: EUR {dealSummary.benchmark_price.toLocaleString("it-IT")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top reasons */}
      {dealSummary?.top_reasons?.length ? (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Perché questo annuncio</h4>
          <div className="flex flex-wrap gap-1.5">
            {dealSummary.top_reasons.map((reason) => (
              <span key={reason} className="rounded-full bg-muted px-3 py-1 text-xs text-foreground">
                {reason}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Metrics grid with descriptions */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Prezzo di mercato"
          value={dealSummary?.benchmark_price
            ? `EUR ${dealSummary.benchmark_price.toLocaleString("it-IT")}`
            : "—"}
          desc="Quanto vale mediamente un'auto simile"
        />
        <MetricCard
          label="Rischio annuncio"
          value={riskCfg
            ? <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${riskCfg.bg} ${riskCfg.text}`}>{riskCfg.label}</span>
            : "—"}
          desc={riskCfg?.desc ?? "Valutazione affidabilità"}
        />
        <MetricCard
          label="Giorni online"
          value={daysOnMarket != null ? `${daysOnMarket} gg` : "—"}
          desc={daysDesc}
        />
        <MetricCard
          label="Variazioni prezzo"
          value={String(priceChanges)}
          desc={changesDesc}
        />
      </div>

      <MetricCard
        label="Auto comparabili analizzate"
        value={String(comparables)}
        desc={comparablesDesc}
        wide
      />
    </div>
  );
};

function MetricCard({ label, value, desc, wide }: {
  label: string;
  value: React.ReactNode;
  desc: string;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 ${wide ? "col-span-2" : ""}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground/70 mt-0.5 leading-snug">{desc}</div>
    </div>
  );
}

export default WhyThisCarPanel;
