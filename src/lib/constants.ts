/** Fallback image used when a car listing has no photo */
export const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600&q=80';

/** Valid sort options for search results */
export const VALID_SORT_OPTIONS = [
  'price-asc',
  'price-desc',
  'km-asc',
  'year-desc',
  'value-asc',
  'best-deal',
] as const;

export type SortOption = (typeof VALID_SORT_OPTIONS)[number];

/** Default page size for search results pagination */
export const PAGE_SIZE = 12;

/** Cache TTL in hours before a re-scrape is triggered */
export const CACHE_TTL_HOURS = 6;

/** Maximum recently viewed items stored in localStorage */
export const MAX_RECENTLY_VIEWED = 10;

/** Maximum cars in the compare basket */
export const MAX_COMPARE_ITEMS = 3;

/** Supabase function invoke timeout (ms) */
export const FUNCTION_TIMEOUT_MS = 30_000;
