import { useState } from "react";
import { Check, Copy, ChevronRight, HelpCircle, ClipboardList, MessageSquare } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { NegotiationSummary } from "@/lib/api/listings";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  summary?: NegotiationSummary | null;
}

const NegotiationDrawer = ({ open, onOpenChange, title, summary }: Props) => {
  const [copied, setCopied] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const handleCopy = () => {
    if (!summary?.message_template) return;
    void navigator.clipboard.writeText(summary.message_template).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const toggleCheck = (item: string) =>
    setChecked((prev) => ({ ...prev, [item]: !prev[item] }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle>Copilot Trattativa</SheetTitle>
          <SheetDescription className="line-clamp-1">{title}</SheetDescription>
        </SheetHeader>

        {!summary ? (
          <div className="mt-6 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            Analisi negoziazione non disponibile per questo annuncio.
          </div>
        ) : (
          <div className="mt-4 space-y-6">

            {/* Price range visual */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Range di trattativa
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <PriceBox label="Offerta iniziale" value={summary.opening_offer} accent="text-violet-500" />
                <PriceBox label="Target" value={summary.target_price} accent="text-emerald-500" highlight />
                <PriceBox label="Limite massimo" value={summary.walk_away_price} accent="text-red-500" />
              </div>
              {typeof summary.negotiation_headroom_pct === "number" && (
                <div className="text-center">
                  <span className="inline-block bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full">
                    Margine di trattativa: {summary.negotiation_headroom_pct.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {/* Arguments */}
            {summary.arguments?.length ? (
              <Section icon={<ChevronRight className="h-4 w-4" />} title="Argomenti da usare">
                {summary.arguments.map((arg, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-foreground leading-relaxed">{arg}</span>
                  </div>
                ))}
              </Section>
            ) : null}

            {/* Questions */}
            {summary.questions_for_seller?.length ? (
              <Section icon={<HelpCircle className="h-4 w-4" />} title="Domande da fare al venditore">
                {summary.questions_for_seller.map((q, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl border border-border/60 p-3 text-sm text-muted-foreground">
                    <span className="text-violet-400 font-bold text-xs mt-0.5 shrink-0">Q{i + 1}</span>
                    <span>{q}</span>
                  </div>
                ))}
              </Section>
            ) : null}

            {/* Checklist */}
            {summary.inspection_checklist?.length ? (
              <Section icon={<ClipboardList className="h-4 w-4" />} title="Checklist ispezione">
                {summary.inspection_checklist.map((item) => (
                  <button
                    key={item}
                    onClick={() => toggleCheck(item)}
                    className="w-full flex items-center gap-3 rounded-xl border border-border/60 p-3 text-sm text-left transition-colors hover:bg-muted/40"
                  >
                    <div className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      checked[item]
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-muted-foreground/40"
                    }`}>
                      {checked[item] && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <span className={checked[item] ? "line-through text-muted-foreground" : "text-foreground"}>
                      {item}
                    </span>
                  </button>
                ))}
              </Section>
            ) : null}

            {/* Message template */}
            {summary.message_template && (
              <Section icon={<MessageSquare className="h-4 w-4" />} title="Messaggio pronto">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                    {summary.message_template}
                  </p>
                  <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5">
                    {copied
                      ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copiato!</>
                      : <><Copy className="h-3.5 w-3.5" /> Copia messaggio</>}
                  </Button>
                </div>
              </Section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

function PriceBox({ label, value, accent, highlight }: {
  label: string;
  value?: number | null;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-2.5 ${highlight ? "border-2 border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "border border-border/60 bg-muted/20"}`}>
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <div className={`text-sm font-bold ${accent}`}>
        {typeof value === "number" ? `EUR ${value.toLocaleString("it-IT")}` : "—"}
      </div>
    </div>
  );
}

function Section({ icon, title, children }: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default NegotiationDrawer;
