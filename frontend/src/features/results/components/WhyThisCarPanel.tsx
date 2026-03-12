import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { DealSummary, TrustSummary } from "@/lib/api/listings";

interface Props {
  dealSummary?: DealSummary | null;
  trustSummary?: TrustSummary | null;
}

const WhyThisCarPanel = ({ dealSummary, trustSummary }: Props) => {
  if (!dealSummary && !trustSummary) {
    return (
      <Alert>
        <AlertTitle>Analisi non disponibile</AlertTitle>
        <AlertDescription>
          Questa sorgente non ha ancora un&apos;analisi decisionale completa.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {dealSummary?.headline && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {dealSummary.headline}
            </Badge>
            {dealSummary.confidence && (
              <Badge variant="outline">Confidence: {dealSummary.confidence}</Badge>
            )}
          </div>
          {dealSummary.summary && (
            <p className="text-sm text-muted-foreground leading-relaxed">{dealSummary.summary}</p>
          )}
        </div>
      )}

      {dealSummary?.top_reasons?.length ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Top reasons</h4>
          <div className="flex flex-wrap gap-2">
            {dealSummary.top_reasons.map((reason) => (
              <span
                key={reason}
                className="rounded-full bg-muted px-3 py-1 text-xs text-foreground"
              >
                {reason}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Benchmark</div>
          <div className="text-lg font-semibold">
            {dealSummary?.benchmark_price ? `EUR ${dealSummary.benchmark_price.toLocaleString("it-IT")}` : "n/d"}
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Risk</div>
          <div className="text-lg font-semibold capitalize">
            {trustSummary?.risk_level || "n/d"}
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Days on market</div>
          <div className="text-lg font-semibold">{dealSummary?.days_on_market ?? "n/d"}</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Price changes</div>
          <div className="text-lg font-semibold">{dealSummary?.price_change_count ?? 0}</div>
        </div>
      </div>
    </div>
  );
};

export default WhyThisCarPanel;
