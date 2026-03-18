import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  getClientId,
  readLocalAlerts,
  type LocalPriceAlert,
} from "@/lib/priceAlertsLocal";
import { getRuntimeConfig } from "@/lib/runtimeConfig";
import { listAlertsApi } from "@/services/api/alerts";

export function usePriceAlerts() {
  const { user } = useAuth();
  const runtime = getRuntimeConfig();
  const [alerts, setAlerts] = useState<LocalPriceAlert[]>([]);

  useEffect(() => {
    const load = async () => {
      const isFastApiMode = runtime.backendMode === "fastapi";
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
          setAlerts([]);
          return;
        }
      }

      if (user) {
        const { data } = await supabase
          .from("price_alerts")
          .select("listing_id, target_price, created_at")
          .eq("user_id", user.id)
          .eq("is_active", true);
        setAlerts(
          (data ?? []).map((row) => ({
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
