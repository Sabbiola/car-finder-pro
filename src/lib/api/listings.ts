import { supabase } from '@/integrations/supabase/client';
import type { SearchFiltersState } from '@/components/SearchFilters';

export interface CarListing {
  id: string;
  title: string;
  brand: string;
  model: string;
  trim: string | null;
  year: number;
  price: number;
  km: number;
  fuel: string | null;
  transmission: string | null;
  power: string | null;
  color: string | null;
  doors: number | null;
  body_type: string | null;
  source: string;
  source_url: string | null;
  image_url: string | null;
  location: string | null;
  is_new: boolean;
  is_best_deal: boolean;
  price_rating: string | null;
  scraped_at: string;
  description?: string | null;
  emission_class?: string | null;
  version?: string | null;
  seats?: number | null;
  condition?: string | null;
  detail_scraped?: boolean;
  image_urls?: string[] | null;
  extra_data?: Record<string, unknown> | null;
}

export async function scrapeListings(filters: SearchFiltersState) {
  const { data, error } = await supabase.functions.invoke('scrape-listings', {
    body: { filters },
  });

  if (error) throw error;
  return data;
}

export async function fetchListings(filters: SearchFiltersState): Promise<CarListing[]> {
  let query = supabase.from('car_listings').select('*');

  if (filters.brand) query = query.eq('brand', filters.brand);
  if (filters.model) query = query.ilike('model', filters.model);
  if (filters.trim) query = query.ilike('trim', `%${filters.trim}%`);
  if (filters.fuel) query = query.eq('fuel', filters.fuel);
  if (filters.transmission) query = query.eq('transmission', filters.transmission);
  if (filters.isNew !== null && filters.isNew !== undefined) query = query.eq('is_new', filters.isNew);
  if (filters.location) query = query.ilike('location', `%${filters.location}%`);
  if (filters.priceMin) query = query.gte('price', Number(filters.priceMin));
  if (filters.priceMax) query = query.lte('price', Number(filters.priceMax));
  if (filters.kmMin) query = query.gte('km', Number(filters.kmMin));
  if (filters.kmMax) query = query.lte('km', Number(filters.kmMax));
  if (filters.yearMin && Number(filters.yearMin) > 0) query = query.gte('year', Number(filters.yearMin));
  if (filters.yearMax) query = query.lte('year', Number(filters.yearMax));
  if (filters.color) query = query.eq('color', filters.color);
  if (filters.doors) query = query.eq('doors', Number(filters.doors));
  if (filters.bodyType) query = query.eq('body_type', filters.bodyType);
  // Source filter: sellerType takes precedence; if both are set, intersect them
  const sellerTypeSources =
    filters.sellerType === 'dealer' ? ['brumbrum', 'automobile'] :
    filters.sellerType === 'private' ? ['subito'] :
    null;

  if (sellerTypeSources) {
    const intersection = filters.sources?.length
      ? filters.sources.filter(s => sellerTypeSources.includes(s))
      : [];
    query = query.in('source', intersection.length ? intersection : sellerTypeSources);
  } else if (filters.sources?.length) {
    query = query.in('source', filters.sources);
  }

  const { data, error } = await query.order('price', { ascending: true });
  if (error) throw error;
  return (data as CarListing[]) || [];
}
