import { describe, it, expect } from 'vitest';
import { toCardListing } from '../lib/toCardListing';
import type { CarListing } from '../lib/api/listings';

const baseListing: CarListing = {
  id: 'test-uuid-1',
  title: 'BMW Serie 3 320d',
  brand: 'BMW',
  model: 'Serie 3',
  trim: '320d',
  year: 2021,
  price: 28500,
  km: 45000,
  fuel: 'Diesel',
  transmission: 'Automatico',
  power: '190 CV',
  color: 'Nero',
  doors: 4,
  body_type: 'Berlina',
  source: 'autoscout24',
  source_url: 'https://www.autoscout24.it/annunci/test',
  image_url: 'https://prod.pictures.autoscout24.net/listing-images/abc-def/800x600.jpg',
  location: 'Milano, MI',
  is_new: false,
  is_best_deal: true,
  price_rating: 'best',
  scraped_at: '2026-02-24T00:00:00Z',
};

describe('toCardListing', () => {
  it('maps all basic fields correctly', () => {
    const result = toCardListing(baseListing);
    expect(result.id).toBe('test-uuid-1');
    expect(result.title).toBe('BMW Serie 3 320d');
    expect(result.brand).toBe('BMW');
    expect(result.model).toBe('Serie 3');
    expect(result.year).toBe(2021);
    expect(result.price).toBe(28500);
    expect(result.km).toBe(45000);
    expect(result.fuel).toBe('Diesel');
    expect(result.transmission).toBe('Automatico');
    expect(result.power).toBe('190 CV');
    expect(result.source).toBe('autoscout24');
    expect(result.location).toBe('Milano, MI');
    expect(result.isNew).toBe(false);
    expect(result.isBestDeal).toBe(true);
    expect(result.priceRating).toBe('best');
    expect(result.doors).toBe(4);
    expect(result.bodyType).toBe('Berlina');
    expect(result.color).toBe('Nero');
  });

  it('sets url from source_url', () => {
    const result = toCardListing(baseListing);
    expect(result.url).toBe('https://www.autoscout24.it/annunci/test');
  });

  it('falls back to "#" when source_url is null', () => {
    const result = toCardListing({ ...baseListing, source_url: null });
    expect(result.url).toBe('#');
  });

  it('upgrades AutoScout24 image to 800x600', () => {
    const result = toCardListing(baseListing);
    expect(result.imageUrl).toContain('800x600');
  });

  it('uses fallback image when image_url is null', () => {
    const result = toCardListing({ ...baseListing, image_url: null });
    expect(result.imageUrl).toContain('unsplash.com');
  });

  it('normalizes protocol-relative Subito URL', () => {
    const result = toCardListing({
      ...baseListing,
      source: 'subito',
      image_url: '//images.sbito.it/foto?rule=gallery-2x',
    });
    expect(result.imageUrl).toMatch(/^https:\/\//);
    expect(result.imageUrl).toContain('rule=fullscreen-1x-auto');
  });

  it('defaults null fuel/transmission/power to empty string', () => {
    const result = toCardListing({ ...baseListing, fuel: null, transmission: null, power: null });
    expect(result.fuel).toBe('');
    expect(result.transmission).toBe('');
    expect(result.power).toBe('');
  });

  it('defaults null doors to 4', () => {
    const result = toCardListing({ ...baseListing, doors: null });
    expect(result.doors).toBe(4);
  });

  it('defaults null price_rating to "normal"', () => {
    const result = toCardListing({ ...baseListing, price_rating: null });
    expect(result.priceRating).toBe('normal');
  });

  it('defaults null location to empty string', () => {
    const result = toCardListing({ ...baseListing, location: null });
    expect(result.location).toBe('');
  });
});
