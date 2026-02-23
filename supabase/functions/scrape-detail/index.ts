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
  // For subito.it, upgrade to full size
  if (sourceUrl.includes('subito.it') && url.includes('rule=')) {
    return url.replace(/rule=[^&]+/, 'rule=gallery-2x');
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

function parseDetails(markdown: string, sourceUrl: string) {
  const details: {
    description: string | null;
    emission_class: string | null;
    version: string | null;
    seats: number | null;
    condition: string | null;
    doors: number | null;
  } = {
    description: null,
    emission_class: null,
    version: null,
    seats: null,
    condition: null,
    doors: null,
  };

  const fullText = markdown.toLowerCase();

  // ─── Emission class ───
  const emissionPatterns = [
    /classe\s*(?:di\s*)?emissione[:\s]*euro\s*(\d)/i,
    /classe\s*(?:di\s*)?emissione[:\s]*(\d)/i,
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
  const seatsPatterns = [
    /numero\s*(?:di\s*)?posti[:\s]*(\d)/i,
    /posti\s*(?:a\s*sedere)?[:\s]*(\d)/i,
    /(\d)\s*posti\s*(?:a\s*sedere)?/i,
  ];
  for (const pat of seatsPatterns) {
    const m = markdown.match(pat);
    if (m) { details.seats = parseInt(m[1]); break; }
  }

  // ─── Doors ───
  const doorsPatterns = [
    /numero\s*(?:di\s*)?porte[:\s]*(\d)/i,
    /porte[:\s]*(\d)/i,
    /(\d)\s*[\/\-]\s*\d?\s*porte/i,
  ];
  for (const pat of doorsPatterns) {
    const m = markdown.match(pat);
    if (m) { details.doors = parseInt(m[1]); break; }
  }

  // ─── Condition ───
  const condPatterns = [
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
  // Only match if preceded by a label and followed by a line break or pipe
  const versionPatterns = [
    /(?:versione|allestimento|variante)\s*[:\|]\s*([^\n\|]{3,60})/i,
    /\|\s*(?:versione|allestimento|variante)\s*\|\s*([^\|]{3,60})\s*\|/i,
  ];
  for (const pat of versionPatterns) {
    const m = markdown.match(pat);
    if (m) {
      let ver = m[1].trim()
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[*_]+/g, '')
        .trim();
      // Reject if it looks like a sentence (description text, not a version name)
      if (ver.length > 2 && ver.length < 80 && !ver.includes('.') && !/\b(che|con|per|del|dal|quindi|ottimo|buono)\b/i.test(ver)) {
        details.version = ver;
        break;
      }
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
