export type SearchStreamEventType = "progress" | "result" | "complete" | "error";

export interface SearchProgressEvent {
  event: "progress";
  provider: string;
  status: "started" | "completed" | "failed";
  fetched_count?: number;
  message?: string | null;
  timestamp: string;
}

export interface SearchErrorEvent {
  event: "error";
  provider?: string | null;
  code: string;
  message: string;
  retryable?: boolean;
  timestamp: string;
}

export interface SearchCompleteEvent {
  event: "complete";
  total_results: number;
  provider_summary: Record<string, number>;
  duration_ms: number;
  final_result_keys?: string[];
  timestamp: string;
}

export interface SearchResultEvent<TListing = unknown> {
  event: "result";
  listing: TListing;
  timestamp: string;
}

export type SearchStreamEvent<TListing = unknown> =
  | SearchProgressEvent
  | SearchErrorEvent
  | SearchCompleteEvent
  | SearchResultEvent<TListing>;
