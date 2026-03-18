import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CarListing,
  ListingAnalysis,
  OwnershipEstimate,
} from "@/lib/api/listings";

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
            <h3 className="text-base font-semibold">Why this car?</h3>
            <p className="text-xs text-muted-foreground">
              Deal, rischio e margine di trattativa in un solo posto
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setNegotiationOpen(true)}>
            Quanto offrire
          </Button>
        </div>

        <Tabs defaultValue="why" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="why">Why</TabsTrigger>
            <TabsTrigger value="trust">Trust</TabsTrigger>
            <TabsTrigger value="ownership">Ownership</TabsTrigger>
          </TabsList>
          <TabsContent value="why">
            <WhyThisCarPanel
              dealSummary={merged.deal_summary}
              trustSummary={merged.trust_summary}
            />
          </TabsContent>
          <TabsContent value="trust">
            <TrustTab
              flags={merged.trust_summary?.flags ?? []}
              summary={merged.trust_summary?.summary ?? null}
              score={merged.trust_summary?.trust_score ?? null}
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
  flags,
  summary,
  score,
}: {
  flags: string[];
  summary: string | null;
  score: number | null;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Trust score</div>
        <div className="text-lg font-semibold">{typeof score === "number" ? score.toFixed(0) : "n/d"}</div>
        {summary && <p className="mt-2 text-sm text-muted-foreground">{summary}</p>}
      </div>
      <div className="space-y-2">
        {(flags.length ? flags : ["nessun flag disponibile"]).map((flag) => (
          <div key={flag} className="rounded-xl border border-border/60 p-3 text-sm text-muted-foreground">
            {flag}
          </div>
        ))}
      </div>
    </div>
  );
}

function OwnershipTab({ ownership }: { ownership?: OwnershipEstimate | null }) {
  if (!ownership) {
    return <p className="text-sm text-muted-foreground">Ownership intelligence non disponibile.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Costo totale" value={ownership.total_cost_of_ownership} />
        <Metric label="Costo mensile" value={ownership.monthly_cost} />
        <Metric label="Deprezzamento" value={ownership.depreciation_cost} />
        <Metric label="Energia / carburante" value={ownership.fuel_or_energy_cost} />
      </div>
      {ownership.summary && <p className="text-sm text-muted-foreground">{ownership.summary}</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">
        {typeof value === "number" ? `EUR ${value.toLocaleString("it-IT")}` : "n/d"}
      </div>
    </div>
  );
}

export default ListingInsightsPanel;
