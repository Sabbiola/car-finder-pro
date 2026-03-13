import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getRuntimeConfig } from "@/lib/runtimeConfig";
import {
  createAlertApi,
  deactivateAlertApi,
  listAlertsApi,
  type AlertResponse,
} from "@/services/api/alerts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LS_KEY = "car-finder-price-alerts";
const CLIENT_ID_KEY = "car-finder-client-id";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface LocalPriceAlert {
  listingId: string;
  title: string;
  currentPrice: number;
  targetPrice: number;
  createdAt: string;
}

function readLocalAlerts(): LocalPriceAlert[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalAlerts(alerts: LocalPriceAlert[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(alerts));
}

function getClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(CLIENT_ID_KEY, generated);
  return generated;
}

interface Props {
  listingId: string;
  currentPrice: number;
  title: string;
}

const PriceAlertButton = ({ listingId, currentPrice, title }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const runtime = getRuntimeConfig();

  const [isActive, setIsActive] = useState(false);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetInput, setTargetInput] = useState("");

  const isFastApiMode = runtime.backendMode === "fastapi" && !!runtime.apiBaseUrl;

  useEffect(() => {
    const loadState = async () => {
      if (isFastApiMode) {
        const owner = user ? { userId: user.id } : { clientId: getClientId() };
        try {
          const response = await listAlertsApi({
            userId: owner.userId,
            clientId: owner.clientId,
            activeOnly: true,
          });
          const found = response.alerts.find((entry) => entry.alert.listing_id === listingId);
          setIsActive(Boolean(found));
          setActiveAlertId(found?.alert.id || null);
          return;
        } catch (error) {
          console.error("[PriceAlertButton] Failed to load alerts from API:", error);
        }
      }

      if (user) {
        const { data } = await supabase
          .from("price_alerts")
          .select("id")
          .eq("user_id", user.id)
          .eq("listing_id", listingId)
          .eq("is_active", true)
          .maybeSingle();
        setIsActive(Boolean(data));
        setActiveAlertId((data as { id?: string } | null)?.id || null);
      } else {
        setIsActive(readLocalAlerts().some((item) => item.listingId === listingId));
        setActiveAlertId(null);
      }
    };
    void loadState();
  }, [isFastApiMode, listingId, user]);

  const handleToggle = useCallback(async () => {
    if (!isActive) {
      setTargetInput(String(Math.round(currentPrice * 0.9)));
      setDialogOpen(true);
      return;
    }

    if (isFastApiMode) {
      const owner = user ? { userId: user.id } : { clientId: getClientId() };
      try {
        let alertId = activeAlertId;
        if (!alertId) {
          const refresh = await listAlertsApi({
            userId: owner.userId,
            clientId: owner.clientId,
            activeOnly: true,
          });
          alertId = refresh.alerts.find((entry) => entry.alert.listing_id === listingId)?.alert.id || null;
        }
        if (!alertId) {
          setIsActive(false);
          setActiveAlertId(null);
          return;
        }
        await deactivateAlertApi(alertId, owner);
        setIsActive(false);
        setActiveAlertId(null);
        toast({
          title: "Alert rimosso",
          description: `Non riceverai piu notifiche per ${title}`,
        });
        return;
      } catch (error) {
        console.error("[PriceAlertButton] Failed to deactivate alert via API:", error);
        toast({
          title: "Errore",
          description: "Impossibile disattivare l'alert prezzo",
          variant: "destructive",
        });
        return;
      }
    }

    if (user) {
      await supabase
        .from("price_alerts")
        .delete()
        .eq("user_id", user.id)
        .eq("listing_id", listingId);
      setIsActive(false);
      setActiveAlertId(null);
      toast({
        title: "Alert rimosso",
        description: `Non riceverai piu notifiche per ${title}`,
      });
      return;
    }

    const updated = readLocalAlerts().filter((item) => item.listingId !== listingId);
    saveLocalAlerts(updated);
    setIsActive(false);
    setActiveAlertId(null);
    toast({
      title: "Alert rimosso",
      description: `Non riceverai piu notifiche per ${title}`,
    });
  }, [activeAlertId, currentPrice, isActive, isFastApiMode, listingId, title, toast, user]);

  const handleConfirm = useCallback(async () => {
    const targetPrice = parseInt(targetInput.replace(/\D/g, ""), 10);
    if (!targetPrice || targetPrice <= 0) {
      toast({ title: "Prezzo non valido", variant: "destructive" });
      return;
    }
    setDialogOpen(false);

    if (isFastApiMode) {
      if (!UUID_REGEX.test(listingId)) {
        toast({
          title: "Alert non disponibile",
          description: "Apri un annuncio persistito per attivare l'alert prezzo.",
          variant: "destructive",
        });
        return;
      }
      const owner = user ? { userId: user.id } : { clientId: getClientId() };
      try {
        const response: AlertResponse = await createAlertApi({
          listingId,
          targetPrice,
          userId: owner.userId,
          clientId: owner.clientId,
        });
        setIsActive(true);
        setActiveAlertId(response.alert.id);
        toast({
          title: "Alert attivato",
          description: `Ti avviseremo quando il prezzo scende sotto EUR ${targetPrice.toLocaleString("it-IT")}`,
        });
        return;
      } catch (error) {
        console.error("[PriceAlertButton] Failed to create alert via API:", error);
        toast({
          title: "Errore",
          description: "Impossibile creare l'alert prezzo",
          variant: "destructive",
        });
        return;
      }
    }

    if (user) {
      const { error, data } = await supabase
        .from("price_alerts")
        .insert({
          user_id: user.id,
          listing_id: listingId,
          target_price: targetPrice,
          is_active: true,
        })
        .select("id")
        .single();
      if (error) {
        toast({
          title: "Errore",
          description: "Impossibile creare l'alert prezzo",
          variant: "destructive",
        });
        return;
      }
      setIsActive(true);
      setActiveAlertId((data as { id?: string } | null)?.id || null);
      toast({
        title: "Alert attivato",
        description: `Ti avviseremo quando il prezzo scende sotto EUR ${targetPrice.toLocaleString("it-IT")}`,
      });
      return;
    }

    const current = readLocalAlerts();
    const nextAlert: LocalPriceAlert = {
      listingId,
      title,
      currentPrice,
      targetPrice,
      createdAt: new Date().toISOString(),
    };
    saveLocalAlerts([...current, nextAlert]);
    setIsActive(true);
    setActiveAlertId(null);
    toast({
      title: "Alert attivato",
      description: `Ti avviseremo quando il prezzo scende sotto EUR ${targetPrice.toLocaleString("it-IT")}`,
    });
  }, [currentPrice, isFastApiMode, listingId, targetInput, title, toast, user]);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => void handleToggle()}
        className={`rounded-xl h-12 w-12 flex-shrink-0 transition-colors ${isActive ? "border-violet-500 text-violet-600 bg-violet-50 dark:bg-violet-900/20" : ""}`}
        aria-label={isActive ? "Rimuovi alert prezzo" : "Imposta alert prezzo"}
        title={isActive ? "Alert attivo - clicca per rimuovere" : "Imposta alert prezzo"}
      >
        {isActive ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Imposta alert prezzo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground line-clamp-1">{title}</p>
            <p className="text-sm">
              Prezzo attuale:{" "}
              <span className="font-semibold">EUR {currentPrice.toLocaleString("it-IT")}</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="alert-target-price">Prezzo obiettivo (EUR)</Label>
              <Input
                id="alert-target-price"
                type="number"
                min={1}
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleConfirm()}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button className="rounded-xl" onClick={() => void handleConfirm()}>
              Attiva alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PriceAlertButton;

export function usePriceAlerts() {
  const { user } = useAuth();
  const runtime = getRuntimeConfig();
  const [alerts, setAlerts] = useState<LocalPriceAlert[]>([]);

  useEffect(() => {
    const load = async () => {
      const isFastApiMode = runtime.backendMode === "fastapi" && !!runtime.apiBaseUrl;
      if (isFastApiMode) {
        try {
          const owner = user ? { userId: user.id } : { clientId: getClientId() };
          const response = await listAlertsApi({
            userId: owner.userId,
            clientId: owner.clientId,
            activeOnly: true,
          });
          setAlerts(
            response.alerts.map((entry) => ({
              listingId: entry.alert.listing_id,
              title: entry.alert.listing?.title || "",
              currentPrice: entry.alert.listing?.price || 0,
              targetPrice: entry.alert.target_price,
              createdAt: entry.alert.created_at,
            })),
          );
          return;
        } catch (error) {
          console.error("[usePriceAlerts] API load failed:", error);
        }
      }

      if (user) {
        const { data } = await supabase
          .from("price_alerts")
          .select("listing_id, target_price, created_at")
          .eq("user_id", user.id)
          .eq("is_active", true);
        setAlerts(
          (data || []).map((row) => ({
            listingId: row.listing_id,
            title: "",
            currentPrice: 0,
            targetPrice: row.target_price,
            createdAt: row.created_at,
          })),
        );
        return;
      }

      setAlerts(readLocalAlerts());
    };

    void load();
  }, [runtime.apiBaseUrl, runtime.backendMode, user]);

  return { alerts, count: alerts.length };
}
