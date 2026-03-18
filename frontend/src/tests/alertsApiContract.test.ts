import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/runtimeConfig", () => ({
  getRuntimeConfig: () => ({
    backendMode: "fastapi",
    apiBaseUrl: "https://api.example.com",
  }),
}));

import { createAlertApi, deactivateAlertApi, listAlertsApi } from "@/services/api/alerts";

describe("alerts API contract", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses GET /api/alerts with canonical query parameters", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ alerts: [] }),
    } as unknown as Response);

    await listAlertsApi({ userId: "user-1", activeOnly: true });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/alerts?");
    expect(url).toContain("user_id=user-1");
    expect(url).toContain("active_only=true");
  });

  it("uses POST /api/alerts with snake_case payload", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ alert: { id: "alert-1" }, notification_status: "active" }),
    } as unknown as Response);

    await createAlertApi({
      listingId: "listing-1",
      targetPrice: 12345,
      userId: "user-1",
    });

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/alerts");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({
        listing_id: "listing-1",
        target_price: 12345,
        user_id: "user-1",
      }),
    );
  });

  it("uses POST /api/alerts/{alert_id}/deactivate", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ alert: { id: "alert-1" }, notification_status: "inactive" }),
    } as unknown as Response);

    await deactivateAlertApi("alert-1", { clientId: "client-1" });

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/alerts/alert-1/deactivate");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({
        client_id: "client-1",
      }),
    );
  });
});
