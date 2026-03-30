import { useState } from "react";
import { ArrowUpDown, Check, LayoutGrid, Link2, Loader2, Map } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CarListing } from "@/lib/api/listings";
import type { SortOption } from "@/lib/constants";
import { sourceColors, sourceLabels } from "@/lib/mock-data";

interface SearchResultsToolbarProps {
  loading: boolean;
  scraped: boolean;
  resultsCount: number;
  listings: CarListing[];
  viewMode: "grid" | "map";
  onViewModeChange: (viewMode: "grid" | "map") => void;
  sort: SortOption;
  sortLabels: Record<SortOption, string>;
  onSortChange: (sort: SortOption) => void;
  onRefresh: () => void;
}

const SearchResultsToolbar = ({
  loading,
  scraped,
  resultsCount,
  listings,
  viewMode,
  onViewModeChange,
  sort,
  sortLabels,
  onSortChange,
  onRefresh,
}: SearchResultsToolbarProps) => {
  const [copied, setCopied] = useState(false);

  return (
    <div
      className="flex items-center justify-between border-b border-border pb-3 animate-brutal-up"
      style={{ animationDelay: "100ms" }}
    >
      <div className="flex items-center gap-3">
        {loading && !scraped ? (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Ricerca in corso...
          </span>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{resultsCount}</span> risultati
            </p>
            {scraped && resultsCount > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {Object.keys(sourceLabels).map((src) => {
                  const count = listings.filter((l) => l.source === src).length;
                  return (
                    <span
                      key={src}
                      className={`text-[9px] font-semibold px-2 py-0.5 rounded-full text-white ${count > 0 ? sourceColors[src] : "bg-muted text-muted-foreground"}`}
                      style={count === 0 ? { opacity: 0.4 } : undefined}
                      title={`${sourceLabels[src]}: ${count} annunci`}
                    >
                      {sourceLabels[src]
                        .replace("AutoScout24", "AS24")
                        .replace("Automobile.it", "Auto.it")
                        .replace("Subito.it", "Subito")
                        .replace("eBay Motors", "eBay")
                        .replace("Brumbrum", "BB")}
                      : {count}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {loading && scraped && resultsCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Aggiornamento...
          </span>
        )}
        {!loading && scraped && (
          <button
            onClick={onRefresh}
            className="text-xs text-muted-foreground hover:text-accent hover:underline transition-colors"
          >
            Aggiorna
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 bg-muted p-0.5 rounded-lg">
          <button
            onClick={() => onViewModeChange("grid")}
            className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            aria-label="Vista griglia"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange("map")}
            className={`p-1.5 rounded-md transition-all ${viewMode === "map" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            aria-label="Vista mappa"
          >
            <Map className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          onClick={async () => {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Copia link ricerca"
          aria-label="Copia link"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
        </button>

        <Select
          value={sort}
          onValueChange={(v) => {
            onSortChange(v as SortOption);
          }}
        >
          <SelectTrigger className="w-40 bg-card text-xs rounded-lg border">
            <ArrowUpDown className="h-3 w-3 mr-1 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border shadow-lg">
            {Object.entries(sortLabels).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default SearchResultsToolbar;
