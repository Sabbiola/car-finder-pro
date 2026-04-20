import { useMemo, useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, CheckCircle2, Fuel, Wrench, TrendingDown, Car } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CarListing, ListingAnalysis, OwnershipEstimate } from "@/lib/api/listings";

import NegotiationDrawer from "./NegotiationDrawer";
import WhyThisCarPanel from "./WhyThisCarPanel";

interface Props {
  listing: CarListing;
  analysis?: ListingAnalysis | null;
}

const ListingInsightsPanel = ({ listing, analysis }: Props) => {
  const [negotiationOpen, setNegotiationOpen] = useState(false);
  const merged = useMemo(
    () => ({
      deal_summary: analysis?.deal_summary ?? listing.deal_summary ?? null,
      trust_summary: analysis?.trust_summary ?? listing.trust_summary ?? null,
      negotiation_summary: analysis?.negotiation_summary ?? listing.negotiation_summary ?? null,
      ownership_estimate: analysis?.ownership_estimate ?? null,
    }),
    [analysis, listing],
  );

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Analisi decisionale</h3>
            <p className="text-xs text-muted-foreground">Deal, rischio e margine di trattativa</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setNegotiationOpen(true)}>
            Quanto offrire
          </Button>
        </div>

        <Tabs defaultValue="why" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="why">Deal</TabsTrigger>
            <TabsTrigger value="trust">Affidabilità</TabsTrigger>
            <TabsTrigger value="ownership">Costi</TabsTrigger>
          </TabsList>
          <TabsContent value="why">
            <WhyThisCarPanel dealSummary={merged.deal_summary} trustSummary={merged.trust_summary} />
          </TabsContent>
          <TabsContent value="trust">
            <TrustTab
              flags={merged.trust_summary?.flags ?? []}
              summary={merged.trust_summary?.summary ?? null}
              score={merged.trust_summary?.trust_score ?? null}
              riskLevel={merged.trust_summary?.risk_level ?? null}
              dataCompleteness={merged.trust_summary?.data_completeness_score ?? null}
            />
          </TabsContent>
          <TabsContent value="ownership">
            <OwnershipTab ownership={merged.ownership_estimate} />
          </TabsContent>
        </Tabs>
      </div>

      <NegotiationDrawer
        open={negotiationOpen}
        onOpenChange={setNegotiationOpen}
        title={listing.title}
        summary={merged.negotiation_summary}
      />
    </>
  );
};

function TrustTab({
  flags, summary, score, riskLevel, dataCompleteness,
}: {
  flags: string[];
  summary: string | null;
  score: number | null;
  riskLevel: string | null;
  dataCompleteness: number | null;
}) {
  const scoreNum = typeof score === "number" ? Math.min(100, Math.max(0, score)) : null;
  const riskLower = riskLevel?.toLowerCase();
  const riskConfig = {
    low:    { Icon: ShieldCheck, color: "text-emerald-500", bar: "bg-emerald-500", label: "Basso" },
    medium: { Icon: ShieldAlert, color: "text-amber-500",   bar: "bg-amber-500",   label: "Medio" },
    high:   { Icon: ShieldX,     color: "text-red-500",     bar: "bg-red-500",     label: "Alto" },
  };
  const risk = riskLower && riskConfig[riskLower as keyof typeof riskConfig]
    ? riskConfig[riskLower as keyof typeof riskConfig]
    : null;

  const scoreColor = scoreNum == null ? "bg-muted"
    : scoreNum >= 70 ? "bg-emerald-500"
    : scoreNum >= 40 ? "bg-amber-500"
    : "bg-red-500";

  return (
    <div className="space-y-4 pt-2">
      {/* Trust score */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Trust Score
          </div>
          {risk && (
            <div className={`flex items-center gap-1 text-xs font-semibold ${risk.color}`}>
              <risk.Icon className="h-3.5 w-3.5" />
              Rischio {risk.label}
            </div>
          )}
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-extrabold">
            {scoreNum != null ? scoreNum.toFixed(0) : "—"}
          </span>
          {scoreNum != null && <span className="text-sm text-muted-foreground mb-1">/100</span>}
        </div>
        {scoreNum != null && (
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${scoreColor}`}
              style={{ width: `${scoreNum}%` }}
            />
          </div>
        )}
        {summary && <p className="text-xs text-muted-foreground leading-relaxed">{summary}</p>}
      </div>

      {/* Data completeness */}
      {dataCompleteness != null && (
        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="uppercase tracking-wider font-medium">Completezza dati</span>
            <span className="font-semibold text-foreground">{(dataCompleteness * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${dataCompleteness * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Flags */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Segnalazioni</h4>
        {flags.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Nessuna segnalazione rilevata
          </div>
        ) : (
          flags.map((flag) => (
            <div key={flag} className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {flag}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function OwnershipTab({ ownership }: { ownership?: OwnershipEstimate | null }) {
  if (!ownership) {
    return (
      <div className="pt-2 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
        Stima costi non disponibile. I dati di ownership vengono calcolati in base al profilo di utilizzo.
      </div>
    );
  }

  const costs = [
    { label: "Deprezzamento", value: ownership.depreciation_cost, icon: TrendingDown, color: "bg-violet-500" },
    { label: "Carburante / Energia", value: ownership.fuel_or_energy_cost, icon: Fuel, color: "bg-amber-500" },
    { label: "Manutenzione", value: ownership.maintenance_cost, icon: Wrench, color: "bg-blue-500" },
    { label: "Assicurazione", value: ownership.insurance_cost, icon: Car, color: "bg-teal-500" },
  ].filter((c) => typeof c.value === "number");

  const total = costs.reduce((s, c) => s + (c.value ?? 0), 0) || 1;

  // Derive ownership period in months from total and monthly cost
  const periodMonths =
    ownership.monthly_cost && ownership.total_cost_of_ownership
      ? Math.round(ownership.total_cost_of_ownership / ownership.monthly_cost)
      : null;
  const periodLabel = periodMonths
    ? periodMonths % 12 === 0
      ? `${periodMonths / 12} ${periodMonths / 12 === 1 ? "anno" : "anni"}`
      : `${periodMonths} mesi`
    : null;

  const scenarios = [
    { label: "Ottimistico", value: ownership.scenario_best, color: "text-emerald-500" },
    { label: "Base",        value: ownership.scenario_base, color: "text-foreground" },
    { label: "Pessimistico",value: ownership.scenario_worst,color: "text-red-500" },
  ].filter((s) => typeof s.value === "number");

  return (
    <div className="space-y-4 pt-2">
      {/* Monthly cost hero */}
      {ownership.monthly_cost != null && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-4">
          <div className="text-xs uppercase tracking-wider text-violet-500 font-medium mb-1">Costo mensile stimato</div>
          <div className="text-3xl font-extrabold text-violet-600 dark:text-violet-400">
            EUR {ownership.monthly_cost.toLocaleString("it-IT")}
            <span className="text-base font-normal text-muted-foreground">/mese</span>
          </div>
          {ownership.total_cost_of_ownership != null && (
            <div className="text-xs text-muted-foreground mt-1">
              Totale per {periodLabel ?? "il periodo"}: EUR {ownership.total_cost_of_ownership.toLocaleString("it-IT")}
            </div>
          )}
        </div>
      )}

      {/* Cost breakdown bars */}
      {costs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ripartizione costi{periodLabel ? ` (${periodLabel})` : ""}
          </h4>
          {costs.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="h-3 w-3" />{label}
                </span>
                <span className="font-semibold text-foreground">EUR {value!.toLocaleString("it-IT")}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${color}`}
                  style={{ width: `${((value ?? 0) / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scenarios */}
      {scenarios.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scenari</h4>
          <div className="grid grid-cols-3 gap-2">
            {scenarios.map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-center">
                <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
                <div className={`text-sm font-bold ${color}`}>
                  EUR {value!.toLocaleString("it-IT")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ownership.summary && (
        <p className="text-xs text-muted-foreground leading-relaxed">{ownership.summary}</p>
      )}
    </div>
  );
}

export default ListingInsightsPanel;
