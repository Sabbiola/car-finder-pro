import { supabase } from '@/integrations/supabase/client';
import type { CarListing } from '@/lib/api/listings';

/**
 * Recupera i listing da Supabase per un array di IDs.
 * Mantiene l'ordine dell'array originale (importante per "visti di recente").
 */
export async function fetchListingsByIds(ids: string[]): Promise<CarListing[]> {
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('car_listings')
    .select('*')
    .in('id', ids);

  if (error) throw error;

  const map = new Map((data as CarListing[]).map(l => [l.id, l]));
  return ids.map(id => map.get(id)).filter(Boolean) as CarListing[];
}
