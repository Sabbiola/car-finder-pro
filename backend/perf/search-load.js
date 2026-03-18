import http from "k6/http";
import { check } from "k6";
import { Rate } from "k6/metrics";

const streamCompletionRate = new Rate("stream_completion_rate");

const BASE_URL = __ENV.FASTAPI_BASE_URL || "http://localhost:8000";

export const options = {
  thresholds: {
    http_req_duration: ["p(95)<5000"],
    checks: ["rate>0.98"],
    http_req_failed: ["rate<0.02"],
    stream_completion_rate: ["rate>=0.98"],
  },
  scenarios: {
    search_sync: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "30s", target: 5 },
        { duration: "60s", target: 15 },
        { duration: "30s", target: 0 },
      ],
      exec: "syncSearch",
    },
    search_stream: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "30s", target: 3 },
        { duration: "60s", target: 8 },
        { duration: "30s", target: 0 },
      ],
      exec: "streamSearch",
    },
  },
};

const PAYLOAD = JSON.stringify({
  brand: "BMW",
  model: "320d",
  year_min: 2018,
  year_max: 2023,
  price_max: 35000,
  sources: ["autoscout24", "subito", "ebay"],
});

const PARAMS = {
  headers: {
    "Content-Type": "application/json",
  },
};

export function syncSearch() {
  const response = http.post(`${BASE_URL}/api/search`, PAYLOAD, PARAMS);
  check(response, {
    "sync status ok": (r) => r.status === 200,
    "sync has payload": (r) => {
      try {
        const body = r.json();
        return typeof body.total_results === "number";
      } catch (_e) {
        return false;
      }
    },
  });
}

export function streamSearch() {
  const response = http.post(`${BASE_URL}/api/search/stream`, PAYLOAD, PARAMS);
  const hasCompleteEvent = response.body.includes("event: complete");
  streamCompletionRate.add(hasCompleteEvent);
  check(response, {
    "stream status ok": (r) => r.status === 200,
    "stream completion present": () => hasCompleteEvent,
  });
}
