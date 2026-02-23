const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ParsedListing {
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
}

function detectFuel(text: string): string | null {
  if (/diesel/i.test(text)) return 'Diesel';
  if (/benzina/i.test(text)) return 'Benzina';
  if (/elettrica/i.test(text)) return 'Elettrica';
  if (/ibrida|hybrid|mhev|phev/i.test(text)) return 'Ibrida';
  if (/gpl/i.test(text)) return 'GPL';
  if (/metano/i.test(text)) return 'Metano';
  return null;
}

function detectTransmission(text: string): string | null {
  if (/automatico|automatic|sequenziale|dsg|dct|tiptronic/i.test(text)) return 'Automatico';
  if (/manuale|manual/i.test(text)) return 'Manuale';
  return null;
}

function detectBodyType(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes('gran coupé') || t.includes('gran coupe')) return 'Gran Coupé';
  if (t.includes('coupé') || t.includes('coupe')) return 'Coupé';
  if (t.includes('cabrio') || t.includes('convertible') || t.includes('cabriolet')) return 'Cabrio';
  if (t.includes('touring') || t.includes('wagon') || t.includes('station')) return 'Station Wagon';
  if (t.includes('berlina') || t.includes('sedan')) return 'Berlina';
  if (t.includes('suv') || t.includes('crossover')) return 'SUV';
  return null;
}

// P3: Extract trim from AutoScout24 title (portion after brand+model+engine code)
function extractTrimFromTitle(title: string, brand: string, model: string): string | null {
  const brandEsc = brand.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const modelEsc = model.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const stripPattern = new RegExp(
    `^${brandEsc}\\s+(?:${modelEsc}\\s+)?(?:[A-Z]?\\d{2,3}[a-z]{0,3}\\s+|\\d\\.\\d\\s+\\w+\\s+)?`,
    'i'
  );
  const remainder = title.replace(stripPattern, '').trim();

  const trimKeywords = /\b(Sport\s*Line|M\s*Sport|xDrive|S\s*Line|AMG|Avantgarde|Elegance|Executive|Urban|Night|Plus|Premium|Business|Style|Active|Competition|GT|GTS|Luxury|Pack|Edition|Sport\s*Plus|e-Power)\b/i;
  const trimMatch = remainder.match(trimKeywords);
  if (trimMatch) {
    const idx = remainder.toLowerCase().indexOf(trimMatch[1].toLowerCase());
    const extracted = remainder.slice(idx).trim().replace(/\s+/g, ' ');
    if (extracted.length >= 3 && extracted.length <= 60) return extracted;
  }
  return null;
}

// ==========================================
// SUBITO.IT PARSER - Based on actual markdown structure
// ==========================================
function parseSubitoListings(markdown: string, brand: string, model: string, trim: string | null): ParsedListing[] {
  const listings: ParsedListing[] = [];
  const modelRegex = new RegExp(model.replace(/\s+/g, '\\s*'), 'i');

  const blocks: string[] = [];
  const lines = markdown.split('\n');
  let currentBlock = '';

  for (const line of lines) {
    if (/^!\[.*\]\(https:\/\/images\.sbito\.it/.test(line)) {
      if (currentBlock.length > 50) blocks.push(currentBlock);
      currentBlock = line;
    } else {
      currentBlock += '\n' + line;
    }
  }
  if (currentBlock.length > 50) blocks.push(currentBlock);

  for (const block of blocks) {
    const titleMatch = block.match(/^###\s*(.+)/m);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim().replace(/\s+/g, ' ').replace(/\.\.\.$/, '').trim();

    if (!modelRegex.test(title)) continue;

    const imgMatch = block.match(/!\[.*?\]\((https:\/\/images\.sbito\.it[^\s)]+)\)/);
    const imageUrl = imgMatch ? imgMatch[1] : null;

    const urlMatch = block.match(/\[.*?\]\((https:\/\/www\.subito\.it\/auto\/[^\s)]+)\)/);
    const sourceUrl = urlMatch ? urlMatch[1] : null;

    const priceMatch = block.match(/([\d.]+)\s*€/);
    if (!priceMatch) continue;
    const price = parseInt(priceMatch[1].replace(/\./g, ''));
    if (!price || price < 1000) continue;

    const locMatch = block.match(/\n([A-ZÀ-Ú][a-zà-ú]+(?:\s[A-ZÀ-Ú]?[a-zà-ú]+)*)\s*\(([A-Z]{2})\)/);
    const location = locMatch ? `${locMatch[1]}, ${locMatch[2]}` : null;

    const specsLine = block.match(/(?:Nuovo|Usato)?\d{2}\/\d{4}\d+\s*Km.*/);

    let year = 0;
    let km = 0;
    let isNew = false;

    if (specsLine) {
      const specs = specsLine[0];
      isNew = /^Nuovo/i.test(specs);
      const dateMatch = specs.match(/(\d{2})\/(\d{4})/);
      if (dateMatch) year = parseInt(dateMatch[2]);
      const kmMatch = specs.match(/\d{2}\/\d{4}\s*([\d.]+)\s*Km/i);
      if (kmMatch) km = parseInt(kmMatch[1].replace(/\./g, ''));
    } else {
      const dateMatch = block.match(/(\d{2})\/(\d{4})/);
      if (dateMatch) year = parseInt(dateMatch[2]);
      const kmFallback = block.match(/\b(\d{1,3}(?:\.\d{3})*)\s*[Kk][Mm]\b/);
      if (kmFallback) km = parseInt(kmFallback[1].replace(/\./g, ''));
      isNew = /\bNuovo\b/i.test(block) || /\bKm\s*0\b/i.test(block);
    }

    const fuel = detectFuel(block);
    const transmission = detectTransmission(block);
    const bodyType = detectBodyType(title);

    if (listings.some(l => l.title === title && l.price === price)) continue;

    listings.push({
      title, brand, model, trim: trim || null,
      year: year || new Date().getFullYear(), price, km,
      fuel, transmission, power: null, color: null,
      doors: bodyType === 'Coupé' || bodyType === 'Cabrio' ? 2 : 4,
      body_type: bodyType, source: 'subito', source_url: sourceUrl,
      image_url: imageUrl, location, is_new: isNew,
    });
  }

  console.log(`Subito parser: ${blocks.length} blocks, ${listings.length} matched "${model}"`);
  return listings;
}

// ==========================================
// AUTOSCOUT24 PARSER
// Image-based block splitting: each listing has exactly one image from
// prod.pictures.autoscout24.net — far more reliable than brand-bold-title split
// ==========================================
function parseAutoScoutListings(markdown: string, brand: string, model: string, trim: string | null): ParsedListing[] {
  const listings: ParsedListing[] = [];
  const seenUuids = new Set<string>();
  const brandLow = brand.toLowerCase();

  // Strategy 1: split on CDN image lines — allow any alt text (AS24 now uses non-empty alt)
  const parts = markdown.split(/(?=!\[[^\]]*\]\(https:\/\/prod\.pictures\.autoscout24\.net\/listing-images\/)/);

  for (const block of parts) {
    const imgMatch = block.match(/^!\[[^\]]*\]\((https:\/\/prod\.pictures\.autoscout24\.net\/listing-images\/([a-f0-9\-]{36})[^\s)]*)\)/);
    if (!imgMatch) continue;

    const rawImageUrl = imgMatch[1];
    const imageUuid = imgMatch[2];
    if (seenUuids.has(imageUuid)) continue;

    // Must mention the brand somewhere in the block (exclude nav/header noise)
    if (!block.toLowerCase().includes(brandLow.slice(0, 3))) continue;

    // Image — upgrade to 800x600
    const imageUrl = rawImageUrl.replace(/\/\d+x\d+(\.\w+)$/, '/800x600$1');

    // Price — try multiple formats
    const priceMatch = block.match(/€\s*([\d.]+)/) || block.match(/([\d.]+)\s*€/);
    if (!priceMatch) continue;
    let priceStr = priceMatch[1];
    const priceParts = priceStr.split('.');
    if (priceParts.length > 1) {
      const last = priceParts[priceParts.length - 1];
      if (last.length > 3) {
        priceParts[priceParts.length - 1] = last.substring(0, 3);
        priceStr = priceParts.join('.');
      }
    }
    const price = parseInt(priceStr.replace(/\./g, ''));
    if (!price || price < 1000 || price > 900000) continue;

    seenUuids.add(imageUuid);

    // Title — multiple strategies, decreasing reliability
    let title = '';
    // 1. Link text containing brand: [BMW 320d...](autoscout24.it/annunci/...)
    const linkTitleMatch = block.match(/\[([^\]]{5,100}?)\]\(https:\/\/www\.autoscout24\.it\/annunci\//);
    if (linkTitleMatch && linkTitleMatch[1].toLowerCase().includes(brandLow.slice(0, 3))) {
      title = linkTitleMatch[1].replace(/\*\*/g, '').trim();
    }
    // 2. Bold text containing brand: **BMW 320d...**
    if (!title) {
      const boldMatch = block.match(/\*\*([^*]{5,100})\*\*/);
      if (boldMatch && boldMatch[1].toLowerCase().includes(brandLow.slice(0, 3))) {
        title = boldMatch[1].trim();
      }
    }
    // 3. Any non-empty line containing brand (strip markdown)
    if (!title) {
      for (const line of block.split('\n')) {
        const clean = line.replace(/[*#\[\]]/g, '').replace(/\([^)]+\)/g, '').trim();
        if (clean.toLowerCase().includes(brandLow.slice(0, 3)) && clean.length >= 5 && clean.length <= 120) {
          title = clean;
          break;
        }
      }
    }
    if (!title) title = `${brand} ${model}`;

    // Source URL
    let sourceUrl: string | null = null;
    const urlMatch = block.match(/(https:\/\/www\.autoscout24\.it\/annunci\/[^\s)>"]+)/);
    if (urlMatch) {
      sourceUrl = urlMatch[1].replace(/[)>"]$/, '');
    } else {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      sourceUrl = `https://www.autoscout24.it/annunci/${slug}-${imageUuid}`;
    }

    // Year
    let year = 0;
    const dateMatch = block.match(/\b(\d{1,2})\/(\d{4})\b/);
    if (dateMatch) year = parseInt(dateMatch[2]);
    if (!year) { const yf = block.match(/\b(20[0-2]\d)\b/); if (yf) year = parseInt(yf[1]); }

    // KM — look for numeric followed by km
    let km = 0;
    const kmMatch = block.match(/([\d.]+)\s*km\b/i);
    if (kmMatch) km = parseInt(kmMatch[1].replace(/\./g, ''));

    // Power
    let power: string | null = null;
    const pwrMatch = block.match(/(\d+)\s*kW\s*\((\d+)\s*CV\)/);
    if (pwrMatch) power = `${pwrMatch[2]} CV`;

    // Location
    let location: string | null = null;
    const locMatch = block.match(/IT-\d+\s+(.+?)(?:\s*$|\n)/m);
    if (locMatch) {
      let loc = locMatch[1].trim();
      loc = loc.replace(/\s*-\s*[A-Z],[A-Z]$/, '').trim();
      location = loc;
    }

    const fuel = detectFuel(block);
    const transmission = detectTransmission(block);
    const bodyType = detectBodyType(title);
    const extractedTrim = trim || extractTrimFromTitle(title, brand, model);

    listings.push({
      title, brand, model, trim: extractedTrim,
      year: year || new Date().getFullYear(), price, km,
      fuel, transmission, power, color: null,
      doors: bodyType === 'Coupé' || bodyType === 'Cabrio' ? 2 : null,
      body_type: bodyType, source: 'autoscout24', source_url: sourceUrl,
      image_url: imageUrl, location, is_new: km < 100,
    });
  }

  // Strategy 2: brand-bold-title split (if no CDN images found)
  if (listings.length === 0) {
    console.log('AutoScout S2: no images, trying brand-title fallback');
    const brandEscaped = brand.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const brandPattern = new RegExp(`\\n(?=\\*\\*${brandEscaped}[\\s\\-])`, 'i');
    const fallbackBlocks = markdown.split(brandPattern);
    for (const block of fallbackBlocks) {
      if (block.length < 30) continue;
      const titleMatch = block.match(/^\*\*(.+?)\*\*/);
      if (!titleMatch) continue;
      const title = titleMatch[1].trim();
      if (!title.toLowerCase().includes(brandLow.slice(0, 3))) continue;
      const priceMatch = block.match(/€\s*([\d.]+)/);
      if (!priceMatch) continue;
      const price = parseInt(priceMatch[1].replace(/\./g, ''));
      if (!price || price < 1000) continue;
      const imgM = block.match(/!\[[^\]]*\]\((https:\/\/prod\.pictures\.autoscout24\.net\/listing-images\/([a-f0-9\-]{36})[^\s)]*)\)/);
      const imageUrl = imgM ? imgM[1].replace(/\/\d+x\d+(\.\w+)$/, '/800x600$1') : null;
      const imageUuid = imgM ? imgM[2] : null;
      if (imageUuid && seenUuids.has(imageUuid)) continue;
      if (imageUuid) seenUuids.add(imageUuid);
      let sourceUrl: string | null = null;
      const urlM = block.match(/(https:\/\/www\.autoscout24\.it\/annunci\/[^\s)>"]+)/);
      if (urlM) sourceUrl = urlM[1];
      else if (imageUuid) {
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        sourceUrl = `https://www.autoscout24.it/annunci/${slug}-${imageUuid}`;
      }
      let year = 0;
      const dM = block.match(/\b(\d{1,2})\/(\d{4})\b/);
      if (dM) year = parseInt(dM[2]);
      let km = 0;
      const kM = block.match(/([\d.]+)\s*km\b/i);
      if (kM) km = parseInt(kM[1].replace(/\./g, ''));
      const bodyType = detectBodyType(title);
      listings.push({
        title, brand, model, trim: trim || extractTrimFromTitle(title, brand, model),
        year: year || new Date().getFullYear(), price, km,
        fuel: detectFuel(block), transmission: detectTransmission(block), power: null, color: null,
        doors: null, body_type: bodyType, source: 'autoscout24', source_url: sourceUrl,
        image_url: imageUrl, location: null, is_new: km < 100,
      });
    }
  }

  // Strategy 3: split on listing URLs — last resort when images/bold titles missing
  if (listings.length === 0) {
    console.log('AutoScout S3: trying URL-anchor split');
    const seenUrls = new Set<string>();
    const urlRegex = /https:\/\/www\.autoscout24\.it\/annunci\/[a-z0-9][a-z0-9\-]{5,120}/g;
    const urlMatches = [...markdown.matchAll(urlRegex)];
    for (const match of urlMatches) {
      const sourceUrl = match[0];
      if (seenUrls.has(sourceUrl)) continue;
      seenUrls.add(sourceUrl);
      // Context: 300 chars around the URL
      const start = Math.max(0, match.index! - 200);
      const end = Math.min(markdown.length, match.index! + 400);
      const ctx = markdown.slice(start, end);
      if (!ctx.toLowerCase().includes(brandLow.slice(0, 3))) continue;
      const priceMatch = ctx.match(/€\s*([\d.]+)/);
      if (!priceMatch) continue;
      const price = parseInt(priceMatch[1].replace(/\./g, ''));
      if (!price || price < 1000 || price > 900000) continue;
      const imgM = ctx.match(/!\[[^\]]*\]\((https:\/\/prod\.pictures\.autoscout24\.net\/listing-images\/([a-f0-9\-]{36})[^\s)]*)\)/);
      const imageUrl = imgM ? imgM[1].replace(/\/\d+x\d+(\.\w+)$/, '/800x600$1') : null;
      // Title from link text or bold
      let title = '';
      const linkT = ctx.match(/\[([^\]]{5,100}?)\]\(https:\/\/www\.autoscout24\.it\/annunci\//);
      if (linkT && linkT[1].toLowerCase().includes(brandLow.slice(0, 3))) title = linkT[1].replace(/\*\*/g, '').trim();
      if (!title) title = `${brand} ${model}`;
      let year = 0;
      const dM = ctx.match(/\b(\d{1,2})\/(\d{4})\b/);
      if (dM) year = parseInt(dM[2]);
      let km = 0;
      const kM = ctx.match(/([\d.]+)\s*km\b/i);
      if (kM) km = parseInt(kM[1].replace(/\./g, ''));
      listings.push({
        title, brand, model, trim: trim || extractTrimFromTitle(title, brand, model),
        year: year || new Date().getFullYear(), price, km,
        fuel: detectFuel(ctx), transmission: detectTransmission(ctx), power: null, color: null,
        doors: null, body_type: detectBodyType(title), source: 'autoscout24', source_url: sourceUrl,
        image_url: imageUrl, location: null, is_new: km < 100,
      });
    }
  }

  console.log(`AutoScout parser: ${listings.length} listings found (md length: ${markdown.length})`);
  return listings;
}

// ==========================================
// AUTOMOBILE.IT PARSER
// ==========================================
function parseAutomobileListings(markdown: string, brand: string, model: string, trim: string | null): ParsedListing[] {
  const listings: ParsedListing[] = [];
  const modelRegex = new RegExp(model.replace(/\s+/g, '\\s*'), 'i');

  // Try two splitting strategies: linked-image pattern first, then listing URL anchors
  let sections = markdown.split(/(?=\[!\[)/).filter(s => s.length > 40);

  // Fallback: split on automobile.it/annunci URL anchors
  if (sections.length <= 2) {
    const seenUrls = new Set<string>();
    const urlRegex = /https?:\/\/(?:www\.)?automobile\.it\/annunci\/[^\s)>"]{10,}/g;
    for (const match of markdown.matchAll(urlRegex)) {
      const url = match[0].replace(/[)>"]+$/, '');
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      const start = Math.max(0, match.index! - 100);
      const end = Math.min(markdown.length, match.index! + 500);
      const ctx = markdown.slice(start, end);
      if (!modelRegex.test(ctx)) continue;
      const priceMatch = ctx.match(/€\s*([\d.]+)/);
      if (!priceMatch) continue;
      const price = parseInt(priceMatch[1].replace(/\./g, ''));
      if (!price || price < 1000) continue;
      let year = 0;
      const yM = ctx.match(/(?:Gennaio|Febbraio|Marzo|Aprile|Maggio|Giugno|Luglio|Agosto|Settembre|Ottobre|Novembre|Dicembre)\s+(\d{4})/i);
      if (yM) year = parseInt(yM[1]);
      if (!year) { const yf = ctx.match(/\b(20[0-2]\d)\b/); if (yf) year = parseInt(yf[1]); }
      let km = 0;
      const kM = ctx.match(/\b(\d{1,3}(?:\.\d{3})*)\s*km\b/i);
      if (kM) km = parseInt(kM[1].replace(/\./g, ''));
      const imgM = ctx.match(/!\[.*?\]\((https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp)[^\s)]*)\)/);
      const titleM = ctx.match(/(?:\*\*|###?\s*)([^\n*]+)/i);
      const title = titleM ? titleM[1].trim() : `${brand} ${model}`;
      listings.push({
        title, brand, model, trim: trim || null,
        year: year || new Date().getFullYear(), price, km,
        fuel: detectFuel(ctx), transmission: detectTransmission(ctx), power: null, color: null, doors: null,
        body_type: detectBodyType(title), source: 'automobile', source_url: url,
        image_url: imgM ? imgM[1] : null, location: null, is_new: false,
      });
    }
    console.log(`Automobile.it URL-anchor fallback: ${listings.length} listings`);
    return listings;
  }

  for (const section of sections) {
    if (!modelRegex.test(section)) continue;

    const imgMatch = section.match(/!\[.*?\]\((https:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp)[^\s)]*)\)/);
    const imageUrl = imgMatch ? imgMatch[1] : null;

    // Extract listing page URL from [![img](img_url)](page_url) pattern
    const srcUrlMatch = section.match(/\[!\[[^\]]*\]\([^)]*\)\]\((https?:\/\/[^\s)]*automobile\.it[^\s)]+)\)/);
    const sourceUrl = srcUrlMatch ? srcUrlMatch[1].replace(/[)>"]+$/, '') : null;

    const priceMatch = section.match(/€\s*([\d.]+)/);
    if (!priceMatch) continue;
    const price = parseInt(priceMatch[1].replace(/\./g, ''));
    if (!price || price < 1000) continue;

    let year = 0;
    const yearMatch = section.match(/(?:Gennaio|Febbraio|Marzo|Aprile|Maggio|Giugno|Luglio|Agosto|Settembre|Ottobre|Novembre|Dicembre)\s+(\d{4})/i);
    if (yearMatch) year = parseInt(yearMatch[1]);
    if (!year) { const ym = section.match(/\b(20[0-2]\d)\b/); if (ym) year = parseInt(ym[1]); }

    let km = 0;
    const kmMatch = section.match(/\b(\d{1,3}(?:\.\d{3})*)\s*km\b/i);
    if (kmMatch) km = parseInt(kmMatch[1].replace(/\./g, ''));

    const fuel = detectFuel(section);
    const transmission = detectTransmission(section);

    const titleLine = section.match(/(?:\*\*|###?\s*)([^\n*]+)/i);
    const title = titleLine ? titleLine[1].trim() : `${brand} ${model}`;
    const bodyType = detectBodyType(title);

    if (listings.some(l => l.price === price && l.km === km)) continue;

    listings.push({
      title, brand, model, trim: trim || null,
      year: year || new Date().getFullYear(), price, km,
      fuel, transmission, power: null, color: null, doors: null,
      body_type: bodyType, source: 'automobile', source_url: sourceUrl,
      image_url: imageUrl, location: null, is_new: false,
    });
  }
  return listings;
}

// ==========================================
// BRUMBRUM PARSER
// URL: https://www.brumbrum.it/usato/?q=brand+model
// Defensive parser - structure verified via Firecrawl markdown output
// ==========================================
function parseBrumBrumListings(markdown: string, brand: string, model: string, trim: string | null): ParsedListing[] {
  const listings: ParsedListing[] = [];
  const modelRegex = new RegExp(model.replace(/\s+/g, '\\s*'), 'i');
  const lines = markdown.split('\n');
  const seenUrls = new Set<string>();

  const sections: { title: string; url: string; context: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // BrumBrum listing links: /auto/ or /usato/ paths
    const linkMatch = line.match(/\[([^\]]+)\]\((https:\/\/www\.brumbrum\.it\/(?:auto|usato|catalogo)\/[^\s)]+)\)/);
    if (!linkMatch) continue;

    const title = linkMatch[1].trim();
    const url = linkMatch[2];
    if (seenUrls.has(url)) continue;

    // Context window: 2 lines before + 10 lines after for specs
    const contextLines = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 12));
    const context = contextLines.join('\n');

    if (!modelRegex.test(title) && !modelRegex.test(context)) continue;

    seenUrls.add(url);
    sections.push({ title, url, context });
  }

  for (const { title, url, context } of sections) {
    const priceMatch = context.match(/€\s*([\d.]+)/) || context.match(/([\d.]+)\s*€/);
    if (!priceMatch) continue;
    const price = parseInt(priceMatch[1].replace(/\./g, ''));
    if (!price || price < 1000) continue;

    let year = 0;
    const yearMatch = context.match(/\b(20\d{2})\b/);
    if (yearMatch) year = parseInt(yearMatch[1]);

    let km = 0;
    const kmMatch = context.match(/\b([\d.]+)\s*(?:km|chilometri)\b/i);
    if (kmMatch) km = parseInt(kmMatch[1].replace(/\./g, ''));

    const imgMatch = context.match(/!\[[^\]]*\]\((https:\/\/[^\s)]*brumbrum[^\s)]*)\)/i);
    const imageUrl = imgMatch ? imgMatch[1] : null;

    const fuel = detectFuel(context);
    const transmission = detectTransmission(context);
    const bodyType = detectBodyType(title);

    listings.push({
      title, brand, model, trim: trim || null,
      year: year || new Date().getFullYear(), price, km,
      fuel, transmission, power: null, color: null, doors: null,
      body_type: bodyType, source: 'brumbrum', source_url: url,
      image_url: imageUrl, location: null, is_new: km < 100,
    });
  }

  console.log(`BrumBrum parser: ${listings.length} listings found`);
  return listings;
}

// ==========================================
// SCRAPE HELPER
// ==========================================
async function scrapeUrl(apiKey: string, url: string, waitFor = 6000): Promise<string> {
  console.log('Scraping:', url);
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        waitFor,
        onlyMainContent: false,
        location: { country: 'IT', languages: ['it'] },
      }),
    });
    if (!res.ok) { console.error('Scrape failed:', res.status, url); return ''; }
    const data = await res.json();
    return data?.data?.markdown || data?.markdown || '';
  } catch (err) {
    console.error('Scrape error:', url, err);
    return '';
  }
}

// ==========================================
// MODEL NAME MAPPING FOR AUTOSCOUT24
// EXPANDED: 5 → 25+ brands
// ==========================================
function getAutoScoutModelSlug(brand: string, model: string): string | null {
  const slugMap: Record<string, Record<string, string>> = {
    'bmw': {
      'serie 1': 'serie-1', 'serie 2': 'serie-2',
      'serie 3': 'serie-3', 'serie 4': 'serie-4',
      'serie 5': 'serie-5', 'serie 6': 'serie-6',
      'serie 7': 'serie-7', 'serie 8': 'serie-8',
      'x1': 'x1', 'x2': 'x2', 'x3': 'x3', 'x4': 'x4',
      'x5': 'x5', 'x6': 'x6', 'x7': 'x7', 'z4': 'z4', 'ix': 'ix',
    },
    'audi': {
      'a1': 'a1', 'a3': 'a3', 'a4': 'a4', 'a5': 'a5', 'a6': 'a6',
      'a7': 'a7', 'a8': 'a8', 'q2': 'q2', 'q3': 'q3', 'q5': 'q5',
      'q7': 'q7', 'q8': 'q8', 'tt': 'tt', 'e-tron': 'e-tron',
    },
    'mercedes-benz': {
      'classe a': 'classe-a', 'classe b': 'classe-b', 'classe c': 'classe-c',
      'classe e': 'classe-e', 'classe s': 'classe-s', 'cla': 'cla',
      'cls': 'cls', 'gla': 'gla', 'glb': 'glb', 'glc': 'glc', 'gle': 'gle',
      'eqa': 'eqa',
    },
    'volkswagen': {
      'golf': 'golf', 'polo': 'polo', 'tiguan': 'tiguan',
      't-roc': 't-roc', 't-cross': 't-cross', 'passat': 'passat',
      'id.3': 'id.3', 'id.4': 'id.4',
    },
    'fiat': {
      '500': '500', 'panda': 'panda', 'tipo': 'tipo', '500x': '500x', '600': '600',
    },
    'toyota': {
      'yaris': 'yaris', 'yaris cross': 'yaris-cross', 'corolla': 'corolla',
      'c-hr': 'c-hr', 'rav4': 'rav4', 'aygo x': 'aygo-x', 'camry': 'camry',
    },
    'ford': {
      'fiesta': 'fiesta', 'focus': 'focus', 'puma': 'puma',
      'kuga': 'kuga', 'mustang mach-e': 'mustang-mach-e', 'explorer': 'explorer',
    },
    'renault': {
      'clio': 'clio', 'captur': 'captur', 'megane': 'megane',
      'mégane': 'megane', 'arkana': 'arkana', 'austral': 'austral', 'zoe': 'zoe',
    },
    'peugeot': {
      '208': '208', '308': '308', '2008': '2008', '3008': '3008',
      '5008': '5008', 'e-208': 'e-208', 'e-2008': 'e-2008',
    },
    'hyundai': {
      'i10': 'i10', 'i20': 'i20', 'i30': 'i30',
      'tucson': 'tucson', 'kona': 'kona', 'ioniq 5': 'ioniq-5', 'ioniq 6': 'ioniq-6',
    },
    'kia': {
      'picanto': 'picanto', 'rio': 'rio', 'ceed': 'ceed',
      'sportage': 'sportage', 'niro': 'niro', 'ev6': 'ev6', 'sorento': 'sorento',
    },
    'opel': {
      'corsa': 'corsa', 'astra': 'astra', 'mokka': 'mokka',
      'crossland': 'crossland', 'grandland': 'grandland',
    },
    'alfa romeo': {
      'giulia': 'giulia', 'stelvio': 'stelvio', 'tonale': 'tonale', 'junior': 'junior',
    },
    'volvo': {
      'xc40': 'xc40', 'xc60': 'xc60', 'xc90': 'xc90', 'c40': 'c40', 'ex30': 'ex30',
    },
    'citroën': {
      'c3': 'c3', 'c4': 'c4', 'c5 aircross': 'c5-aircross', 'berlingo': 'berlingo',
    },
    'dacia': {
      'sandero': 'sandero', 'duster': 'duster', 'jogger': 'jogger', 'spring': 'spring',
    },
    'mazda': {
      'mazda2': 'mazda2', 'mazda3': 'mazda3', 'mazda6': 'mazda6',
      'cx-30': 'cx-30', 'cx-5': 'cx-5', 'mx-5': 'mx-5',
    },
    'nissan': {
      'micra': 'micra', 'juke': 'juke', 'qashqai': 'qashqai',
      'x-trail': 'x-trail', 'leaf': 'leaf', 'ariya': 'ariya',
    },
    'seat': {
      'ibiza': 'ibiza', 'leon': 'leon', 'arona': 'arona',
      'ateca': 'ateca', 'tarraco': 'tarraco',
    },
    'skoda': {
      'fabia': 'fabia', 'octavia': 'octavia', 'kamiq': 'kamiq',
      'karoq': 'karoq', 'kodiaq': 'kodiaq', 'enyaq': 'enyaq-iv',
    },
    'mini': {
      'cooper': 'cooper', 'countryman': 'countryman', 'clubman': 'clubman', 'paceman': 'paceman',
    },
    'porsche': {
      'cayenne': 'cayenne', 'macan': 'macan', 'taycan': 'taycan',
      '911': '911', 'panamera': 'panamera', '718': '718-boxster',
    },
    'tesla': {
      'model 3': 'model-3', 'model y': 'model-y',
      'model s': 'model-s', 'model x': 'model-x',
    },
    'jeep': {
      'renegade': 'renegade', 'compass': 'compass',
      'avenger': 'avenger', 'wrangler': 'wrangler', 'grand cherokee': 'grand-cherokee',
    },
    'land rover': {
      'evoque': 'range-rover-evoque', 'velar': 'range-rover-velar',
      'sport': 'range-rover-sport', 'defender': 'defender', 'discovery': 'discovery',
    },
    'honda': {
      'civic': 'civic', 'cr-v': 'cr-v', 'hr-v': 'hr-v', 'jazz': 'jazz', 'e': 'e',
    },
    'suzuki': {
      'swift': 'swift', 'vitara': 'vitara', 'jimny': 'jimny', 's-cross': 's-cross',
    },
  };

  const brandKey = brand.toLowerCase();
  const modelKey = model.toLowerCase();
  return slugMap[brandKey]?.[modelKey] || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filters } = await req.json();
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const brand = filters?.brand || '';
    const model = filters?.model || '';
    const trim = filters?.trim || null;

    const yearMin = filters?.yearMin ? parseInt(filters.yearMin) : null;
    const yearMax = filters?.yearMax ? parseInt(filters.yearMax) : null;
    const priceMin = filters?.priceMin ? parseInt(filters.priceMin) : null;
    const priceMax = filters?.priceMax ? parseInt(filters.priceMax) : null;
    const kmMin = filters?.kmMin ? parseInt(filters.kmMin) : null;
    const kmMax = filters?.kmMax ? parseInt(filters.kmMax) : null;
    const fuelFilter = filters?.fuel || null;
    const transmissionFilter = filters?.transmission || null;
    const sources: string[] = filters?.sources?.length ? filters.sources : ['autoscout24', 'subito', 'automobile', 'brumbrum'];

    if (!brand) {
      return new Response(JSON.stringify({ success: false, error: 'Brand is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const allListings: ParsedListing[] = [];
    const query = encodeURIComponent(`${brand.toLowerCase()} ${model.toLowerCase()}`);

    const scrapeJobs: { url: string; parser: (md: string) => ParsedListing[]; waitFor?: number }[] = [];

    // --- Subito.it ---
    if (sources.includes('subito')) {
      for (let page = 1; page <= 4; page++) {
        const url = page === 1
          ? `https://www.subito.it/annunci-italia/vendita/auto/?q=${query}`
          : `https://www.subito.it/annunci-italia/vendita/auto/?q=${query}&o=${page}`;
        scrapeJobs.push({ url, parser: (md) => parseSubitoListings(md, brand, model, trim) });
      }
    }

    // --- AutoScout24 ---
    const fuelCodeMap: Record<string, string> = {
      'Benzina': 'B', 'Diesel': 'D', 'Elettrica': 'E',
      'Ibrida': 'H', 'GPL': 'L', 'Metano': 'M',
    };
    const gearCodeMap: Record<string, string> = { 'Automatico': 'A', 'Manuale': 'M' };
    const asParams = new URLSearchParams();
    if (yearMin) asParams.set('fregfrom', String(yearMin));
    if (yearMax) asParams.set('fregto', String(yearMax));
    if (priceMin) asParams.set('pricefrom', String(priceMin));
    if (priceMax) asParams.set('priceto', String(priceMax));
    if (kmMin) asParams.set('kmfrom', String(kmMin));
    if (kmMax) asParams.set('kmto', String(kmMax));
    if (fuelFilter && fuelCodeMap[fuelFilter]) asParams.set('fuelc', fuelCodeMap[fuelFilter]);
    if (transmissionFilter && gearCodeMap[transmissionFilter]) asParams.set('gear', gearCodeMap[transmissionFilter]);
    const asParamStr = asParams.toString();

    const asSlug = getAutoScoutModelSlug(brand, model);
    // Normalize brand slug: remove accents/diacritics (handles Škoda, Citroën, etc.)
    const brandSlug = brand.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');

    // Use model-specific slug if available, otherwise fall back to brand + query param
    const asBaseUrl = asSlug
      ? `https://www.autoscout24.it/lst/${brandSlug}/${asSlug}`
      : `https://www.autoscout24.it/lst/${brandSlug}?q=${encodeURIComponent(model)}`;

    if (sources.includes('autoscout24')) {
      for (let page = 1; page <= 3; page++) {
        let url: string;
        if (asSlug) {
          const pageParam = page > 1 ? `page=${page}` : '';
          const combined = [asParamStr, pageParam].filter(Boolean).join('&');
          url = combined ? `${asBaseUrl}?${combined}` : asBaseUrl;
        } else {
          const pageParam = page > 1 ? `page=${page}` : '';
          const combined = [asParamStr, pageParam].filter(Boolean).join('&');
          url = combined ? `${asBaseUrl}&${combined}` : asBaseUrl;
        }
        scrapeJobs.push({ url, parser: (md) => parseAutoScoutListings(md, brand, model, trim), waitFor: 12000 });
      }
    }

    // --- Automobile.it ---
    if (sources.includes('automobile')) {
      for (let page = 1; page <= 2; page++) {
        const pageParam = page > 1 ? `&p=${page}` : '';
        const url = `https://www.automobile.it/annunci?q=${query}${pageParam}`;
        scrapeJobs.push({ url, parser: (md) => parseAutomobileListings(md, brand, model, trim) });
      }
    }

    // --- BrumBrum ---
    if (sources.includes('brumbrum')) {
      for (let page = 1; page <= 2; page++) {
        const pageParam = page > 1 ? `&p=${page}` : '';
        const url = `https://www.brumbrum.it/usato/?q=${query}${pageParam}`;
        scrapeJobs.push({ url, parser: (md) => parseBrumBrumListings(md, brand, model, trim) });
      }
    }

    console.log(`Starting ${scrapeJobs.length} scrape jobs in batches...`);

    // Stagger requests to avoid Firecrawl rate limiting (max ~5 concurrent)
    const results = await Promise.allSettled(
      scrapeJobs.map(async (job, i) => {
        if (i >= 5) await new Promise(r => setTimeout(r, (i - 4) * 800));
        const md = await scrapeUrl(apiKey, job.url, job.waitFor);
        if (!md) return [];
        const parsed = job.parser(md);
        console.log(`Parsed ${parsed.length} from ${job.url}`);
        return parsed;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') allListings.push(...result.value);
    }

    // Deduplication: prefer source_url as unique key; fall back to title+price for null-URL parsers
    const seenUrls = new Set<string>();
    const seenTitlePrice = new Set<string>();
    const unique = allListings.filter(l => {
      if (l.source_url) {
        if (seenUrls.has(l.source_url)) return false;
        seenUrls.add(l.source_url);
        return true;
      }
      const key = `${l.title.toLowerCase().substring(0, 40)}|${l.price}`;
      if (seenTitlePrice.has(key)) return false;
      seenTitlePrice.add(key);
      return true;
    });

    // Calculate price ratings
    if (unique.length >= 3) {
      const prices = unique.map(l => l.price).sort((a, b) => a - b);
      const median = prices[Math.floor(prices.length / 2)];
      const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
      const threshold = Math.min(median, avg);

      for (const listing of unique) {
        const ratio = listing.price / threshold;
        if (ratio <= 0.82) {
          (listing as any).price_rating = 'best';
          (listing as any).is_best_deal = true;
        } else if (ratio <= 0.95) {
          (listing as any).price_rating = 'good';
          (listing as any).is_best_deal = false;
        } else {
          (listing as any).price_rating = 'normal';
          (listing as any).is_best_deal = false;
        }
      }
    }

    console.log(`Total unique: ${unique.length} listings from ${allListings.length} raw`);

    if (unique.length > 0) {
      const sample = unique[0];
      console.log(`Sample: "${sample.title}" price=${sample.price} km=${sample.km} year=${sample.year} url=${sample.source_url}`);
    }

    // Save to DB — UPSERT strategy
    // Listings WITH source_url: upsert (preserves row on re-scrape, updates price/km/scraped_at)
    // Listings WITHOUT source_url: delete-per-source then insert (no unique key to upsert on)
    if (unique.length > 0) {
      const withRatings = unique.map(l => ({
        ...l,
        price_rating: (l as any).price_rating || 'normal',
        is_best_deal: (l as any).is_best_deal || false,
        scraped_at: new Date().toISOString(),
      }));

      const upsertable = withRatings.filter(l => l.source_url != null);
      const insertOnly = withRatings.filter(l => l.source_url == null);

      // UPSERT listings that have a source_url (Subito, AutoScout24, BrumBrum)
      for (let i = 0; i < upsertable.length; i += 50) {
        const batch = upsertable.slice(i, i + 50);
        const { error } = await supabase
          .from('car_listings')
          .upsert(batch, { onConflict: 'source_url', ignoreDuplicates: false });
        if (error) console.error('DB upsert error:', JSON.stringify(error));
      }

      // For listings without source_url (Automobile.it): delete-per-source then insert
      const sourcesWithoutUrl = [...new Set(insertOnly.map(l => l.source))];
      for (const src of sourcesWithoutUrl) {
        await supabase
          .from('car_listings')
          .delete()
          .eq('brand', brand)
          .eq('model', model)
          .eq('source', src);
      }
      for (let i = 0; i < insertOnly.length; i += 50) {
        const batch = insertOnly.slice(i, i + 50);
        const { error } = await supabase.from('car_listings').insert(batch);
        if (error) console.error('DB insert error:', JSON.stringify(error));
      }

      console.log(`Saved: ${upsertable.length} upserted, ${insertOnly.length} inserted`);
    }

    return new Response(
      JSON.stringify({ success: true, count: unique.length }),
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
