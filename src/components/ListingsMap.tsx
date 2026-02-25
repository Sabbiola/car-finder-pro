import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { CarListing } from '@/lib/api/listings';

// ---------------------------------------------------------------------------
// Geocoding cache — persisted to localStorage so repeated searches are instant
// ---------------------------------------------------------------------------
const CACHE_KEY = 'geo_cache_v1';

function loadCache(): Map<string, [number, number] | null> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    return new Map(JSON.parse(raw) as [string, [number, number] | null][]);
  } catch {
    return new Map();
  }
}

function saveCache(cache: Map<string, [number, number] | null>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify([...cache.entries()]));
  } catch { /* quota exceeded — ignore */ }
}

const geocodeCache = loadCache();

async function geocode(location: string): Promise<[number, number] | null> {
  const key = location.toLowerCase().trim();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(key + ', Italia')}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'car-finder-pro/1.0' } });
    const data = await res.json();
    const coords: [number, number] | null =
      data.length > 0 ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
    geocodeCache.set(key, coords);
    saveCache(geocodeCache);
    return coords;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Price marker DivIcon — avoids the Vite + Leaflet image asset bug
// ---------------------------------------------------------------------------
function priceIcon(price: number, isBestDeal: boolean, isActive: boolean) {
  const bg = isActive ? '#1e1b4b' : isBestDeal ? '#10b981' : '#7c3aed';
  const html = `<div style="
    background:${bg};color:white;padding:3px 8px;border-radius:12px;
    font-size:11px;font-weight:700;white-space:nowrap;
    box-shadow:0 2px 6px rgba(0,0,0,0.3);
    border:2px solid white;
    transform:${isActive ? 'scale(1.15)' : 'scale(1)'};
    transition:transform 0.15s;
  ">€${(price / 1000).toFixed(0)}k</div>`;
  return L.divIcon({ className: '', html, iconSize: [60, 26], iconAnchor: [30, 13] });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface GeoListing {
  listing: CarListing;
  coords: [number, number];
}

interface Props {
  listings: CarListing[];
}

const ListingsMap = ({ listings }: Props) => {
  const navigate = useNavigate();
  const [geoListings, setGeoListings] = useState<GeoListing[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const toGeocode = listings.filter(l => l.location);
    if (!toGeocode.length) return;

    setGeoListings([]);
    setProgress({ done: 0, total: toGeocode.length });

    // Process in batches of 5 in parallel
    const BATCH = 5;
    let done = 0;
    const results: GeoListing[] = [];

    const run = async () => {
      for (let i = 0; i < toGeocode.length; i += BATCH) {
        if (!isMounted.current) return;
        const batch = toGeocode.slice(i, i + BATCH);
        const coordResults = await Promise.all(batch.map(l => geocode(l.location!)));
        batch.forEach((listing, j) => {
          if (coordResults[j]) results.push({ listing, coords: coordResults[j]! });
        });
        done += batch.length;
        if (isMounted.current) {
          setProgress({ done, total: toGeocode.length });
          setGeoListings([...results]);
        }
      }
      if (isMounted.current) setProgress(null);
    };

    run();
  }, [listings]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border/60 shadow-sm" style={{ height: 'calc(100vh - 280px)', minHeight: 400 }}>
      {/* Loading overlay */}
      {progress && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-background/90 backdrop-blur-sm border border-border/60 rounded-full px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
          <Loader2 className="h-3 w-3 animate-spin" />
          Geocodificazione {progress.done}/{progress.total}…
        </div>
      )}

      <MapContainer
        center={[42.5, 12.5]}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geoListings.map(({ listing, coords }) => (
          <Marker
            key={listing.id}
            position={coords}
            icon={priceIcon(listing.price, listing.is_best_deal, activeId === listing.id)}
            eventHandlers={{ click: () => setActiveId(listing.id) }}
          >
            <Popup
              onClose={() => setActiveId(null)}
              className="listing-popup"
              maxWidth={220}
            >
              <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 200 }}>
                {listing.image_url && (
                  <img
                    src={listing.image_url}
                    alt={listing.title}
                    style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
                  />
                )}
                <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, lineHeight: 1.3 }}>{listing.title}</p>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#7c3aed', marginBottom: 4 }}>
                  €{listing.price.toLocaleString('it-IT')}
                </p>
                <p style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                  {listing.km.toLocaleString('it-IT')} km · {listing.year} · {listing.location}
                </p>
                <button
                  onClick={() => navigate(`/auto/${listing.id}`)}
                  style={{
                    background: '#7c3aed', color: 'white', border: 'none',
                    borderRadius: 8, padding: '5px 12px', fontSize: 11,
                    fontWeight: 600, cursor: 'pointer', width: '100%',
                  }}
                >
                  Vedi annuncio →
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* No results with location */}
      {!progress && geoListings.length === 0 && listings.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-center p-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide">Nessuna posizione disponibile</p>
            <p className="text-xs text-muted-foreground mt-1">Gli annunci trovati non hanno una città associata</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListingsMap;
