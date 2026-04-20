import { ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface AdCardProps {
  slot: string;
}

const PLACEHOLDER_SLOTS = ["SLOT_RESULTS_CARD"];

const cards = [
  {
    eyebrow: "Assicurazione",
    title: "RC Auto al miglior prezzo",
    description: "Confronta le polizze delle migliori compagnie italiane e risparmia fino al 40%.",
    cta: "Calcola preventivo",
    gradient: "from-teal-500 to-emerald-500",
    href: "#",
  },
  {
    eyebrow: "Finanziamento",
    title: "Finanzia la tua prossima auto",
    description: "Tasso fisso dal 4,9% con risposta in 24 ore. Nessuna spesa di istruttoria.",
    cta: "Scopri le rate",
    gradient: "from-violet-500 to-indigo-500",
    href: "#",
  },
  {
    eyebrow: "Garanzia",
    title: "Estendi la garanzia fino a 4 anni",
    description: "Proteggi il tuo acquisto con una garanzia meccanica completa.",
    cta: "Maggiori info",
    gradient: "from-amber-500 to-orange-500",
    href: "#",
  },
];

let cardIndex = 0;

export default function AdCard({ slot }: AdCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [adIdx] = useState(() => cardIndex++ % cards.length);
  const isReal = !PLACEHOLDER_SLOTS.includes(slot);

  useEffect(() => {
    if (!isReal) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (_) {}
  }, [isReal]);

  if (dismissed) return null;

  if (isReal) {
    return (
      <div className="relative rounded-2xl border border-border/50 bg-card overflow-hidden flex flex-col items-center justify-center min-h-[200px]">
        <span className="absolute top-2 right-2 text-[10px] text-muted-foreground/50 font-medium select-none">
          Sponsorizzato
        </span>
        <ins
          className="adsbygoogle"
          style={{ display: "block", width: "100%", minHeight: "200px" }}
          data-ad-client="ca-pub-8896866503047853"
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  const ad = cards[adIdx];

  return (
    <div className="relative rounded-2xl border border-border/50 bg-card overflow-hidden flex flex-col">
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
        <span className="text-[10px] text-muted-foreground/50 font-medium select-none">Sponsorizzato</span>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          aria-label="Chiudi annuncio"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className={`h-20 bg-gradient-to-br ${ad.gradient} flex items-center justify-center`}>
        <span className="text-white font-black text-5xl opacity-[0.08] select-none tracking-tight">
          {ad.eyebrow.slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{ad.eyebrow}</span>
          <h3 className="text-sm font-bold leading-tight mt-0.5">{ad.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ad.description}</p>
        </div>
        <a
          href={ad.href}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-xl bg-gradient-to-r ${ad.gradient} text-white shadow-sm hover:opacity-90 transition-opacity`}
        >
          {ad.cta} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
