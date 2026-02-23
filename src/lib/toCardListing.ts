import type { CarListing } from '@/lib/api/listings';

export type CardListing = {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  km: number;
  fuel: string;
  transmission: string;
  power: string;
  source: 'autoscout24' | 'subito' | 'automobile' | 'brumbrum';
  imageUrl: string;
  location: string;
  isNew: boolean;
  url: string;
  isBestDeal?: boolean;
  priceRating?: 'best' | 'good' | 'normal';
  color: string;
  doors: number;
  bodyType: string;
};

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600&q=80';

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u = url.startsWith('//') ? 'https:' + url : url;
  // New Subito.it CDN uses fullscreen-1x-auto; gallery-2x only worked on old static.sbito.it
  if (u.includes('images.sbito.it') && u.includes('rule=')) {
    u = u.replace(/rule=[^&]+/, 'rule=fullscreen-1x-auto');
  }
  // AutoScout24: upgrade thumbnail (250x188) to 800x600
  if (u.includes('autoscout24.net/listing-images/')) {
    u = u.replace(/\/\d+x\d+(\.\w+)$/, '/800x600$1');
  }
  return u;
}

export function toCardListing(l: CarListing): CardListing {
  return {
    id: l.id,
    title: l.title,
    brand: l.brand,
    model: l.model,
    year: l.year,
    price: l.price,
    km: l.km,
    fuel: l.fuel || '',
    transmission: l.transmission || '',
    power: l.power || '',
    source: l.source as CardListing['source'],
    imageUrl: normalizeUrl(l.image_url) || FALLBACK_IMAGE,
    location: l.location || '',
    isNew: l.is_new,
    url: l.source_url || '#',
    isBestDeal: l.is_best_deal,
    priceRating: (l.price_rating || 'normal') as 'best' | 'good' | 'normal',
    color: l.color || '',
    doors: l.doors || 4,
    bodyType: l.body_type || '',
  };
}
