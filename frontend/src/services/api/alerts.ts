import { getRuntimeConfig } from "@/lib/runtimeConfig";
import { createRequestId } from "@/lib/requestId";

export interface AlertListingSummary {
  title?: string | null;
  price?: number | null;
  image_url?: string | null;
  source_url?: string | null;
}

export interface AlertRecord {
  id: string;
  listing_id: string;
  target_price: number;
  is_active: boolean;
  notified_at?: string | null;
  created_at: string;
  user_id?: string | null;
  client_id?: string | null;
  listing?: AlertListingSummary | null;
}

export interface AlertResponse {
  alert: AlertRecord;
  notification_status: "active" | "inactive" | "notified";
}

export interface AlertListResponse {
  alerts: AlertResponse[];
}

function resolveApiBaseUrl(): string {
  const runtime = getRuntimeConfig();
  if (runtime.backendMode !== "fastapi" || !runtime.apiBaseUrl) {
    throw new Error("FastAPI mode is required for alerts API.");
  }
  return runtime.apiBaseUrl.replace(/\/+$/, "");
}

export async function listAlertsApi(params: {
  userId?: string;
  clientId?: string;
  activeOnly?: boolean;
}): Promise<AlertListResponse> {
  const baseUrl = resolveApiBaseUrl();
  const query = new URLSearchParams();
  if (params.userId) query.set("user_id", params.userId);
  if (params.clientId) query.set("client_id", params.clientId);
  if (params.activeOnly) query.set("active_only", "true");

  const requestId = createRequestId("alerts-list");
  const response = await fetch(`${baseUrl}/api/alerts?${query.toString()}`, {
    headers: { "x-request-id": requestId },
  });
  if (!response.ok) {
    throw new Error(`List alerts failed: HTTP ${response.status}`);
  }
  return (await response.json()) as AlertListResponse;
}

export async function createAlertApi(payload: {
  listingId: string;
  targetPrice: number;
  userId?: string;
  clientId?: string;
}): Promise<AlertResponse> {
  const baseUrl = resolveApiBaseUrl();
  const requestId = createRequestId("alerts-create");
  const response = await fetch(`${baseUrl}/api/alerts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify({
      listing_id: payload.listingId,
      target_price: payload.targetPrice,
      user_id: payload.userId,
      client_id: payload.clientId,
    }),
  });
  if (!response.ok) {
    throw new Error(`Create alert failed: HTTP ${response.status}`);
  }
  return (await response.json()) as AlertResponse;
}

export async function deactivateAlertApi(
  alertId: string,
  owner: { userId?: string; clientId?: string },
): Promise<AlertResponse> {
  const baseUrl = resolveApiBaseUrl();
  const requestId = createRequestId("alerts-deactivate");
  const response = await fetch(`${baseUrl}/api/alerts/${alertId}/deactivate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
    },
    body: JSON.stringify({
      user_id: owner.userId,
      client_id: owner.clientId,
    }),
  });
  if (!response.ok) {
    throw new Error(`Deactivate alert failed: HTTP ${response.status}`);
  }
  return (await response.json()) as AlertResponse;
}
