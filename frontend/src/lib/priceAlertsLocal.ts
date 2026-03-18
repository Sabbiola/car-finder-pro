const LS_KEY = "car-finder-price-alerts";
const CLIENT_ID_KEY = "car-finder-client-id";

export const PRICE_ALERT_LISTING_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface LocalPriceAlert {
  listingId: string;
  title: string;
  currentPrice: number;
  targetPrice: number;
  createdAt: string;
}

export function readLocalAlerts(): LocalPriceAlert[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is LocalPriceAlert => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const candidate = item as Record<string, unknown>;
      return (
        typeof candidate.listingId === "string" &&
        typeof candidate.title === "string" &&
        typeof candidate.currentPrice === "number" &&
        typeof candidate.targetPrice === "number" &&
        typeof candidate.createdAt === "string"
      );
    });
  } catch {
    return [];
  }
}

export function saveLocalAlerts(alerts: LocalPriceAlert[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(alerts));
}

export function getClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) {
    return existing;
  }
  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(CLIENT_ID_KEY, generated);
  return generated;
}
