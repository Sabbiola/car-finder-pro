import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import type { SearchFiltersState } from "./SearchFilters";

interface Props {
  open: boolean;
  onClose: () => void;
}

const EXAMPLES = [
  "SUV diesel automatico sotto 25.000€ con meno di 80.000 km",
  "Tesla o auto elettrica, immatricolata dopo il 2020",
  "Fiat 500 o Panda ibrida, zona Milano, massimo 15.000€",
  "Berlina tedesca con cambio automatico, tra 20k e 35k euro",
];

// Validate the AI function response to prevent processing malicious/unexpected data
const AIFiltersSchema = z
  .object({
    brand: z.string().optional(),
    model: z.string().optional(),
    trim: z.string().optional(),
    yearMin: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v != null ? String(v) : undefined)),
    yearMax: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v != null ? String(v) : undefined)),
    priceMin: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v != null ? String(v) : undefined)),
    priceMax: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v != null ? String(v) : undefined)),
    kmMax: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v != null ? String(v) : undefined)),
    fuel: z.string().optional(),
    transmission: z.string().optional(),
    bodyType: z.string().optional(),
    location: z.string().optional(),
  })
  .strip(); // strip unknown keys for safety

const AISearchDialog = ({ open, onClose }: Props) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-search", {
        body: { query },
      });
      if (error || !data?.success) {
        toast({
          title: "Errore AI",
          description: data?.error || "Impossibile elaborare la ricerca",
          variant: "destructive",
        });
        return;
      }

      // Validate and sanitize AI output before using it
      const parsed = AIFiltersSchema.safeParse(data.filters ?? {});
      if (!parsed.success) {
        console.error("[AISearchDialog] Invalid AI response schema:", parsed.error);
        toast({ title: "Errore", description: "Risposta AI non valida", variant: "destructive" });
        return;
      }
      const filters = parsed.data as Partial<SearchFiltersState>;

      const params = new URLSearchParams();
      if (filters.brand) params.set("brand", filters.brand);
      if (filters.model) params.set("model", filters.model);
      if (filters.yearMin) params.set("yearMin", filters.yearMin);
      if (filters.yearMax) params.set("yearMax", filters.yearMax);
      if (filters.priceMin) params.set("priceMin", filters.priceMin);
      if (filters.priceMax) params.set("priceMax", filters.priceMax);
      if ((filters as Record<string, unknown>).kmMax)
        params.set("kmMax", String((filters as Record<string, unknown>).kmMax));
      if (filters.fuel) params.set("fuel", filters.fuel);
      if (filters.transmission) params.set("transmission", filters.transmission);
      if (filters.bodyType) params.set("bodyType", filters.bodyType);
      if (filters.location) params.set("location", filters.location);
      params.set("sources", "autoscout24,subito,automobile,brumbrum");
      onClose();
      navigate(`/risultati?${params.toString()}`);
    } catch (err) {
      console.error("[AISearchDialog] Unexpected error:", err);
      toast({
        title: "Errore",
        description: "Servizio AI non disponibile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Cerca con AI
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Descrivi in italiano l'auto che cerchi — l'AI estrae automaticamente i filtri.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="Es: SUV diesel automatico sotto 25.000€ con meno di 80k km..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[100px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSearch();
            }}
          />

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Esempi</p>
            <div className="flex flex-col gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setQuery(ex)}
                  className="text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-3 py-1.5 rounded-lg transition-colors"
                >
                  "{ex}"
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            className="w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {loading ? "Elaborazione..." : "Cerca (Ctrl+Enter)"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AISearchDialog;
