import { ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface AdBannerProps {
  slot: string;
  className?: string;
}

const PLACEHOLDER_SLOTS = ["SLOT_HOMEPAGE_BANNER", "SLOT_DETAIL_BANNER", "SLOT_RESULTS_CARD"];

const variants = [
  {
    eyebrow: "RC Auto",
    title: "Risparmia fino al 40% sulla tua assicurazione",
    description: "Confronta decine di compagnie e trova la polizza più conveniente in 2 minuti.",
    cta: "Confronta ora",
    gradient: "from-teal-500 to-emerald-500",
    href: "#",
  },
  {
    eyebrow: "Finanziamento",
    title: "Tasso fisso dal 4,9% · Risposta in 24h",
    description: "Finanziamo la tua prossima auto con rate flessibili e nessuna spesa di istruttoria.",
    cta: "Scopri le rate",
    gradient: "from-violet-500 to-indigo-500",
    href: "#",
  },
];

export default function AdBanner({ slot, className = "" }: AdBannerProps) {
  const [dismissed, setDismissed] = useState(false);
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
      <div className={`relative ${className}`}>
        <span className="block text-[10px] text-muted-foreground/50 font-medium text-right pr-1 mb-0.5 select-none">
          Sponsorizzato
        </span>
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client="ca-pub-8896866503047853"
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  const ad = slot === "SLOT_HOMEPAGE_BANNER" ? variants[1] : variants[0];

  return (
    <div className={`relative rounded-2xl border border-border/50 bg-card overflow-hidden ${className}`}>
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
      <div className="flex items-center gap-4 px-5 py-4 pr-24">
        <div className={`hidden sm:flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${ad.gradient} shrink-0 shadow-sm`}>
          <span className="text-white text-[10px] font-bold uppercase tracking-wide opacity-90">
            {ad.eyebrow.slice(0, 2)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{ad.eyebrow}</span>
          <p className="text-sm font-bold leading-tight">{ad.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed hidden md:block">{ad.description}</p>
        </div>
        <a
          href={ad.href}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className={`hidden sm:flex items-center gap-1.5 shrink-0 text-xs font-semibold px-3 py-2 rounded-xl bg-gradient-to-r ${ad.gradient} text-white shadow-sm hover:opacity-90 transition-opacity`}
        >
          {ad.cta} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
