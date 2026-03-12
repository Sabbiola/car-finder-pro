import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { NegotiationSummary } from "@/lib/api/listings";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  summary?: NegotiationSummary | null;
}

const NegotiationDrawer = ({ open, onOpenChange, title, summary }: Props) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Negotiation Copilot</SheetTitle>
          <SheetDescription>{title}</SheetDescription>
        </SheetHeader>

        {!summary ? (
          <p className="mt-6 text-sm text-muted-foreground">Analisi negoziazione non disponibile.</p>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Target" value={summary.target_price} />
              <Metric label="Offerta iniziale" value={summary.opening_offer} />
              <Metric label="Limite" value={summary.walk_away_price} />
            </div>

            <Section title="Argomenti">
              {summary.arguments?.length ? summary.arguments : ["nessun argomento strutturato disponibile"]}
            </Section>

            <Section title="Domande da fare">
              {summary.questions_for_seller?.length ? summary.questions_for_seller : ["nessuna domanda disponibile"]}
            </Section>

            <Section title="Checklist visita">
              {summary.inspection_checklist?.length ? summary.inspection_checklist : ["nessuna checklist disponibile"]}
            </Section>

            {summary.message_template && (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <div className="text-sm font-semibold mb-2">Messaggio pronto</div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {summary.message_template}
                </p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

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

function Section({ title, children }: { title: string; children: string[] }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">{title}</div>
      <div className="space-y-2">
        {children.map((item) => (
          <div key={item} className="rounded-xl border border-border/60 p-3 text-sm text-muted-foreground">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default NegotiationDrawer;
