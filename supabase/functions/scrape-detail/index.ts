const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { listingId, sourceUrl } = await req.json();

    if (!listingId || !sourceUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'listingId and sourceUrl are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if already scraped
    const { data: existing } = await supabase
      .from('car_listings')
      .select('detail_scraped, description, image_urls')
      .eq('id', listingId)
      .single();

    if (existing?.detail_scraped && existing?.description && existing?.image_urls?.length > 1) {
      return new Response(
        JSON.stringify({ success: true, cached: true, image_urls: existing.image_urls || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping detail from:', sourceUrl);

    // Use onlyMainContent: false + html format to get all gallery images
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: sourceUrl,
        formats: ['markdown', 'html'],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('Firecrawl error:', data);
      return new Response(
        JSON.stringify({ success: false, error: 'Scraping failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = data.data?.markdown || '';
    const html = data.data?.html || '';
    console.log('Got markdown:', markdown.length, 'html:', html.length);

    const details = parseDetails(markdown, sourceUrl);
    const imageUrls = extractImages(html, markdown, sourceUrl);
    console.log('Parsed details:', JSON.stringify(details));
    console.log('Found images:', imageUrls.length);

    // Update the listing
    const updateData: Record<string, unknown> = { detail_scraped: true };
    if (details.description) updateData.description = details.description;
    if (details.emission_class) updateData.emission_class = details.emission_class;
    if (details.version) updateData.version = details.version;
    if (details.seats) updateData.seats = details.seats;
    if (details.condition) updateData.condition = details.condition;
    if (details.doors) updateData.doors = details.doors;
    if (details.color) updateData.color = details.color;
    if (details.transmission) updateData.transmission = details.transmission;
    if (details.power) updateData.power = details.power;
    if (imageUrls.length > 0) updateData.image_urls = imageUrls;

    await supabase
      .from('car_listings')
      .update(updateData)
      .eq('id', listingId);

    return new Response(
      JSON.stringify({ success: true, details, image_urls: imageUrls }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ─── Image extraction from HTML + markdown ──────────────────────────

function extractImages(html: string, markdown: string, sourceUrl: string): string[] {
  const urls = new Set<string>();

  // 1. Extract from HTML img src and srcset (most reliable for galleries)
  const imgSrcRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = imgSrcRegex.exec(html)) !== null) {
    const url = match[1].trim();
    if (isCarImage(url, sourceUrl)) urls.add(cleanImageUrl(url, sourceUrl));
  }

  // 2. Extract from srcset attributes
  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcset = match[1];
    // srcset contains "url1 1x, url2 2x" or "url1 300w, url2 600w"
    const parts = srcset.split(',');
    for (const part of parts) {
      const url = part.trim().split(/\s+/)[0];
      if (url && isCarImage(url, sourceUrl)) urls.add(cleanImageUrl(url, sourceUrl));
    }
  }

  // 3. Extract from data-src (lazy loaded images)
  const dataSrcRegex = /data-src=["']([^"']+)["']/gi;
  while ((match = dataSrcRegex.exec(html)) !== null) {
    const url = match[1].trim();
    if (isCarImage(url, sourceUrl)) urls.add(cleanImageUrl(url, sourceUrl));
  }

  // 4. Extract from markdown images as fallback
  const mdImgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  while ((match = mdImgRegex.exec(markdown)) !== null) {
    const url = match[1].trim();
    if (isCarImage(url, sourceUrl)) urls.add(cleanImageUrl(url, sourceUrl));
  }

  // 5. Look for JSON-LD image arrays in HTML
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonData = JSON.parse(match[1]);
      const images = jsonData.image || jsonData.images || jsonData.photo;
      if (Array.isArray(images)) {
        for (const img of images) {
          const url = typeof img === 'string' ? img : img?.url || img?.contentUrl;
          if (url && isCarImage(url, sourceUrl)) urls.add(cleanImageUrl(url, sourceUrl));
        }
      } else if (typeof images === 'string') {
        if (isCarImage(images, sourceUrl)) urls.add(cleanImageUrl(images, sourceUrl));
      }
    } catch { /* ignore invalid JSON-LD */ }
  }

  // Deduplicate by base URL (ignoring size/quality params)
  const seen = new Map<string, string>();
  for (const url of urls) {
    const base = getBaseUrl(url);
    // Keep the largest/best quality version
    if (!seen.has(base) || url.length > (seen.get(base)?.length || 0)) {
      seen.set(base, url);
    }
  }

  return Array.from(seen.values()).slice(0, 30);
}

function getBaseUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove common size/quality params
    u.searchParams.delete('w');
    u.searchParams.delete('h');
    u.searchParams.delete('width');
    u.searchParams.delete('height');
    u.searchParams.delete('rule');
    u.searchParams.delete('quality');
    u.searchParams.delete('q');
    u.searchParams.delete('size');
    return u.pathname;
  } catch {
    return url.split('?')[0];
  }
}

function cleanImageUrl(url: string, sourceUrl: string): string {
  // Normalize protocol-relative URLs to https
  if (url.startsWith('//')) url = 'https:' + url;

  // For subito.it, upgrade to full size
  // New CDN (images.sbito.it) uses fullscreen-1x-auto; old CDN (static.sbito.it) uses gallery-2x
  if (sourceUrl.includes('subito.it') && url.includes('rule=')) {
    const rule = url.includes('images.sbito.it') ? 'fullscreen-1x-auto' : 'gallery-2x';
    return url.replace(/rule=[^&]+/, `rule=${rule}`);
  }
  // For autoscout24, get full size
  if (sourceUrl.includes('autoscout24') && url.includes('/images/')) {
    return url.replace(/\/\d+x\d+\//, '/');
  }
  return url;
}

function isCarImage(url: string, sourceUrl: string): boolean {
  if (!url || url.length < 10) return false;
  const lower = url.toLowerCase();

  // Must be http/https or protocol-relative
  if (!lower.startsWith('http') && !lower.startsWith('//')) return false;

  // Must be an image
  const isImgExt = /\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(lower);
  const isImgCdn = lower.includes('/images/') || lower.includes('/img/') || lower.includes('/photo') || lower.includes('image');
  if (!isImgExt && !isImgCdn) return false;

  // Exclude non-car images
  if (lower.includes('logo') || lower.includes('icon') || lower.includes('favicon')) return false;
  if (lower.includes('avatar') || lower.includes('badge') || lower.includes('sprite')) return false;
  if (lower.includes('banner') || lower.includes('promo') || lower.includes('/ads/')) return false;
  if (lower.includes('placeholder') || lower.includes('default-') || lower.includes('no-image')) return false;
  if (lower.includes('social-share') || lower.includes('og-image') || lower.includes('branding')) return false;
  if (lower.includes('.svg') || lower.includes('.gif')) return false;
  // Skip tiny tracker pixels
  if (/[_\-]1x1[_\-.]/.test(lower)) return false;

  // Site-specific: only accept images from the listing's CDN
  if (sourceUrl.includes('subito.it')) {
    return lower.includes('sbito.it') || lower.includes('subito.it');
  }
  if (sourceUrl.includes('autoscout24')) {
    return lower.includes('autoscout') || lower.includes('as24');
  }
  if (sourceUrl.includes('automobile.it')) {
    return lower.includes('automobile.it') || lower.includes('imgix');
  }

  return true;
}

// ─── Detail parsing ─────────────────────────────────────────────────

function parseDetails(markdown: string, _sourceUrl: string) {
  const details: {
    description: string | null;
    emission_class: string | null;
    version: string | null;
    seats: number | null;
    condition: string | null;
    doors: number | null;
    color: string | null;
    transmission: string | null;
    power: string | null;
  } = {
    description: null,
    emission_class: null,
    version: null,
    seats: null,
    condition: null,
    doors: null,
    color: null,
    transmission: null,
    power: null,
  };

  const fullText = markdown.toLowerCase();

  // ─── Emission class ───
  // AutoScout24 uses "Classe emissioni" (plural), Subito uses "Classe emissione" (singular)
  // Table format: | Classe emissioni | Euro 6 |   Key-value: Classe emissioni: Euro 6
  const emissionPatterns = [
    /\|\s*classe\s*emission[ei]\s*\|\s*euro\s*(\d)/i,          // table format (AutoScout24)
    /classe\s*(?:di\s*)?emission[ei][:\s]*euro\s*(\d)/i,       // key-value, both singular/plural
    /classe\s*(?:di\s*)?emission[ei][:\s]*(\d)/i,
    /emissioni[:\s]*euro\s*(\d)/i,
    /normativa\s*(?:anti)?inquinamento[:\s]*euro\s*(\d)/i,
    /standard\s*emissioni?[:\s]*euro\s*(\d)/i,
    /\|\s*euro\s*(\d)\s*\|/i,
    /euro\s*(\d)\s*(?:d|b|c)?(?:\s|,|\.|$|\|)/i,
  ];
  for (const pat of emissionPatterns) {
    const m = markdown.match(pat);
    if (m) { details.emission_class = `Euro ${m[1]}`; break; }
  }

  // ─── Seats ───
  // AutoScout24 table: | Posti | 5 |   Subito key-value: Posti: 5
  const seatsPatterns = [
    /\|\s*posti\s*\|\s*(\d+)/i,                            // table format (AutoScout24)
    /numero\s*(?:di\s*)?posti[:\s]*(\d)/i,
    /posti\s*(?:a\s*sedere)?[:\s]*(\d)/i,
    /(\d)\s*posti\s*(?:a\s*sedere)?/i,
  ];
  for (const pat of seatsPatterns) {
    const m = markdown.match(pat);
    if (m) { details.seats = parseInt(m[1]); break; }
  }

  // ─── Doors ───
  // AutoScout24 table: | Porte | 5 |   Subito: Porte: 5
  const doorsPatterns = [
    /\|\s*porte\s*\|\s*(\d+)/i,                            // table format (AutoScout24)
    /numero\s*(?:di\s*)?porte[:\s]*(\d)/i,
    /porte[:\s]*(\d)/i,
    /(\d)\s*[\/\-]\s*\d?\s*porte/i,
  ];
  for (const pat of doorsPatterns) {
    const m = markdown.match(pat);
    if (m) { details.doors = parseInt(m[1]); break; }
  }

  // ─── Condition ───
  // AutoScout24: | Condizioni | Usato |   Subito: Condizione: Usato
  const condPatterns = [
    /\|\s*condizion[ei]\s*\|\s*(nuovo|usato)/i,             // table format (AutoScout24)
    /condizion[ei][:\s]*(nuovo|usato|km\s*0|km\s*zero|semi[- ]?nuovo)/i,
    /tipo\s*(?:di\s*)?veicolo[:\s]*(nuovo|usato|km\s*0)/i,
    /stato[:\s]*(nuovo|usato)/i,
  ];
  for (const pat of condPatterns) {
    const m = markdown.match(pat);
    if (m) {
      details.condition = m[1].toLowerCase().includes('usato') ? 'Usato' : 'Nuovo';
      break;
    }
  }
  if (!details.condition) {
    if (fullText.includes('km 0') || fullText.includes('km zero')) details.condition = 'Nuovo';
    else if (fullText.includes('veicolo usato') || fullText.includes('auto usata')) details.condition = 'Usato';
  }

  // ─── Version / trim (strict: only from structured data, NOT descriptions) ───
  const versionPatterns = [
    /\|\s*(?:versione|allestimento|variante)\s*\|\s*([^\|]{3,60})\s*\|/i,  // table (AutoScout24)
    /(?:versione|allestimento|variante)\s*[:\|]\s*([^\n\|]{3,60})/i,
  ];
  for (const pat of versionPatterns) {
    const m = markdown.match(pat);
    if (m) {
      let ver = m[1].trim()
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[*_]+/g, '')
        .trim();
      if (ver.length > 2 && ver.length < 80 && !ver.includes('.') && !/\b(che|con|per|del|dal|quindi|ottimo|buono)\b/i.test(ver)) {
        details.version = ver;
        break;
      }
    }
  }

  // ─── Color ───
  // AutoScout24: | Colore | Rosso |  or  | Colore esterno | Rosso |
  // Subito: Colore: Rosso
  const colorPatterns = [
    /\|\s*colore\s*(?:esterno)?\s*\|\s*([^|\n]{2,30})\s*\|/i,   // table format (AutoScout24)
    /colore\s*esterno[:\s]+([^\n|,]{2,30})/i,
    /colore(?!\s*interno)[:\s]+([^\n|,\|]{2,30})/i,
  ];
  for (const pat of colorPatterns) {
    const m = markdown.match(pat);
    if (m) {
      const color = m[1].trim().replace(/[*_\[\]()]+/g, '').trim();
      if (color.length >= 2 && color.length <= 40 && !color.toLowerCase().includes('interno')) {
        details.color = color;
        break;
      }
    }
  }

  // ─── Transmission (fills in if search scrape missed it) ───
  // AutoScout24: "Tipo di cambio  Automatico"   Subito: "Cambio: Manuale"
  const transPatterns = [
    /\|\s*(?:tipo\s*(?:di\s*)?)?cambio\s*\|\s*(automatico|manuale|sequenziale)/i,  // table
    /(?:tipo\s*(?:di\s*)?)?cambio[:\s]+(automatico|manuale|sequenziale)/i,
    /trasmissione[:\s]+(automatica|manuale|sequenziale)/i,
  ];
  for (const pat of transPatterns) {
    const m = markdown.match(pat);
    if (m) {
      const v = m[1].toLowerCase();
      details.transmission = v.startsWith('auto') || v === 'sequenziale' ? 'Automatico' : 'Manuale';
      break;
    }
  }

  // ─── Power (fills in if search scrape missed it) ───
  // AutoScout24: "Potenza  190 kW (258 CV)"   Subito: "Potenza: 258 CV"
  const powerPatterns = [
    /\|\s*potenza\s*\|\s*\d+\s*kW\s*\((\d+)\s*CV\)/i,               // table: | Potenza | 190 kW (258 CV) |
    /potenza[:\s]+\d+\s*kW\s*\((\d+)\s*CV\)/i,                       // "Potenza 190 kW (258 CV)"
    /potenza[:\s]+(\d+)\s*CV/i,                                        // "Potenza: 258 CV"
    /(\d+)\s*kW\s*\((\d+)\s*CV\)/,                                    // standalone "190 kW (258 CV)"
  ];
  for (const pat of powerPatterns) {
    const m = markdown.match(pat);
    if (m) {
      const cv = m[2] || m[1]; // last pattern has 2 groups
      details.power = `${cv} CV`;
      break;
    }
  }

  // ─── Description ───
  details.description = extractDescription(markdown, fullText);

  return details;
}

function extractDescription(markdown: string, fullText: string): string | null {
  let descText = '';

  const descHeadings = [
    'descrizione del veicolo',
    'descrizione venditore',
    'descrizione',
    'dettagli annuncio',
  ];

  for (const heading of descHeadings) {
    const idx = fullText.indexOf(heading);
    if (idx > -1) {
      const afterDesc = markdown.slice(idx + heading.length).trim().replace(/^[:\s#]+/, '');
      const endMatch = afterDesc.search(/\n#{1,3}\s|contatta|invia un messaggio|inserisci|pubblica|caratteristiche\s*(tecniche|principali)|scheda\s*tecnica|dati\s*tecnici|equipaggiamento/i);
      descText = endMatch > 0 ? afterDesc.slice(0, endMatch).trim() : afterDesc.slice(0, 2000).trim();
      if (descText.length > 40) break;
      descText = '';
    }
  }

  if (!descText) {
    const paragraphs = markdown.split(/\n\n+/);
    const longest = paragraphs
      .filter(p => p.length > 60 && !p.startsWith('#') && !p.startsWith('|') && !p.startsWith('![') && !p.startsWith('---'))
      .sort((a, b) => b.length - a.length)[0];
    if (longest) descText = longest.trim().slice(0, 2000);
  }

  if (descText) {
    descText = descText
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_#]+/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (descText.length > 30) return descText;
  }
  return null;
}
