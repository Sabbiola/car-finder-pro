import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, isOriginAllowed } from "../_shared/cors.ts";
import TurndownService from "npm:turndown@7.1.2";

const _td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
function htmlToMarkdown(html: string): string {
  // Resolve lazy-loaded images: swap data-src → src so Turndown picks up real CDN URLs
  const processed = html.replace(
    /<img([^>]*?)\bdata-src=["']([^"']+)["']([^>]*?)>/gi,
    (_m, before, dataSrc, after) => {
      const attrs = (before + after).replace(/\bsrc=["'][^"']*["']/gi, "");
      return `<img${attrs} src="${dataSrc}">`;
    },
  );
  try {
    return _td.turndown(processed);
  } catch {
    return processed.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  }
}

// ─── Gemini enrichment (fills fields still null after regex) ────────
async function enrichWithGemini(
  apiKey: string,
  markdown: string,
  existing: {
    emission_class: string | null;
    color: string | null;
    transmission: string | null;
    power: string | null;
    doors: number | null;
    seats: number | null;
  },
): Promise<{
  fuel?: string | null;
  emission_class?: string | null;
  color?: string | null;
  transmission?: string | null;
  power?: string | null;
  doors?: number | null;
  seats?: number | null;
}> {
  const needed: string[] = ["fuel"]; // fuel is never extracted by parseDetails
  if (!existing.emission_class) needed.push("emission_class");
  if (!existing.color) needed.push("color");
  if (!existing.transmission) needed.push("transmission");
  if (!existing.power) needed.push("power");
  if (!existing.doors) needed.push("doors");
  if (!existing.seats) needed.push("seats");

  const fieldDefs: Record<string, string> = {
    fuel: '"Benzina", "Diesel", "Ibrida", "Elettrica", "GPL", "Metano" o null',
    emission_class: '"Euro 6d", "Euro 6", "Euro 5", ecc. o null',
    color: 'colore esterno in italiano (es. "Bianco", "Nero") o null',
    transmission: '"Automatico", "Manuale" o null',
    power: 'potenza come "150 CV" o null',
    doors: "intero (2, 3, 4, 5) o null",
    seats: "intero (2, 4, 5, 7) o null",
  };
  const fieldList = needed.map((f) => `- ${f}: ${fieldDefs[f]}`).join("\n");
  const prompt = `Sei un esperto di auto. Dal testo di questo annuncio estrai SOLO i seguenti campi come JSON:\n${fieldList}\nRispondi SOLO con JSON valido, null per i campi non trovati.\n\nTesto:\n${markdown.slice(0, 3000)}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0,
            maxOutputTokens: 200,
          },
        }),
      },
    );
    if (!res.ok) {
      console.warn("Gemini error:", res.status);
      return {};
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(text);
    console.log("Gemini enrichment result:", JSON.stringify(parsed));
    return parsed;
  } catch (err) {
    console.warn("Gemini enrichment failed:", err);
    return {};
  }
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    if (!isOriginAllowed(req)) {
      return new Response(JSON.stringify({ success: false, error: "Origin not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(null, { headers: corsHeaders });
  }

  if (!isOriginAllowed(req)) {
    return new Response(JSON.stringify({ success: false, error: "Origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { listingId, sourceUrl } = await req.json();

    if (!listingId || !sourceUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "listingId and sourceUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("SCRAPINGBEE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: "ScrapingBee not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if already scraped
    const { data: existing } = await supabase
      .from("car_listings")
      .select("detail_scraped, description, image_urls")
      .eq("id", listingId)
      .single();

    if (existing?.detail_scraped && existing?.description && existing?.image_urls?.length > 1) {
      return new Response(
        JSON.stringify({ success: true, cached: true, image_urls: existing.image_urls || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Scraping detail from:", sourceUrl);

    // ScrapingBee: render_js=true for full JS rendering, block_resources=false so
    // gallery images actually load (CSS needed for IntersectionObserver lazy loading)
    const params = new URLSearchParams({
      api_key: apiKey,
      url: sourceUrl,
      render_js: "true",
      block_resources: "false",
      wait: "4000",
      country_code: "it",
    });

    const response = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("ScrapingBee error:", response.status, errText.slice(0, 200));
      return new Response(JSON.stringify({ success: false, error: "Scraping failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = await response.text();
    const markdown = htmlToMarkdown(html);
    console.log("Got html:", html.length, "md:", markdown.length);

    const details = parseDetails(markdown, sourceUrl);
    const imageUrls = extractImages(html, markdown, sourceUrl);
    console.log("Parsed details:", JSON.stringify(details));
    console.log("Found images:", imageUrls.length);

    // Gemini enrichment for fields still null after regex
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const enriched = geminiKey ? await enrichWithGemini(geminiKey, markdown, details) : {};

    // Update the listing
    const updateData: Record<string, unknown> = { detail_scraped: true };
    if (details.description) updateData.description = details.description;
    const emissionClass = details.emission_class || enriched.emission_class;
    if (emissionClass) updateData.emission_class = emissionClass;
    if (details.version) updateData.version = details.version;
    const seats = details.seats || enriched.seats;
    if (seats) updateData.seats = seats;
    if (details.condition) updateData.condition = details.condition;
    const doors = details.doors || enriched.doors;
    if (doors) updateData.doors = doors;
    const color = details.color || enriched.color;
    if (color) updateData.color = color;
    const transmission = details.transmission || enriched.transmission;
    if (transmission) updateData.transmission = transmission;
    const power = details.power || enriched.power;
    if (power) updateData.power = power;
    if (enriched.fuel) updateData.fuel = enriched.fuel;
    if (imageUrls.length > 0) updateData.image_urls = imageUrls;

    // Extra structured data (JSONB)
    const extraData: Record<string, unknown> = {};
    if (details.drive_type) extraData.drive_type = details.drive_type;
    if (details.displacement) extraData.displacement = details.displacement;
    if (details.gears) extraData.gears = details.gears;
    if (details.cylinders) extraData.cylinders = details.cylinders;
    if (details.weight) extraData.weight = details.weight;
    if (details.fuel_consumption) extraData.fuel_consumption = details.fuel_consumption;
    if (details.paint_type) extraData.paint_type = details.paint_type;
    if (details.interior_color) extraData.interior_color = details.interior_color;
    if (details.interior_material) extraData.interior_material = details.interior_material;
    if (details.equipment.length > 0) extraData.equipment = details.equipment;
    if (Object.keys(extraData).length > 0) updateData.extra_data = extraData;

    await supabase.from("car_listings").update(updateData).eq("id", listingId);

    return new Response(JSON.stringify({ success: true, details, image_urls: imageUrls }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ─── Image extraction from HTML + markdown ──────────────────────────

function extractImages(html: string, markdown: string, sourceUrl: string): string[] {
  let match;

  // ── Step 1: Try JSON-LD first ────────────────────────────────────────
  // JSON-LD structured data only contains images for the current listing,
  // not for "similar cars" shown on the page — so it's the cleanest source.
  const jsonLdImages = new Set<string>();
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonData = JSON.parse(match[1]);
      const images = jsonData.image || jsonData.images || jsonData.photo;
      if (Array.isArray(images)) {
        for (const img of images) {
          const url = typeof img === "string" ? img : img?.url || img?.contentUrl;
          if (url && isCarImage(url, sourceUrl)) jsonLdImages.add(cleanImageUrl(url, sourceUrl));
        }
      } else if (typeof images === "string") {
        if (isCarImage(images, sourceUrl)) jsonLdImages.add(cleanImageUrl(images, sourceUrl));
      }
    } catch {
      /* ignore invalid JSON-LD */
    }
  }

  // If JSON-LD gave us at least 2 images, trust it exclusively.
  // This prevents picking up thumbnails of "similar listings" from the HTML.
  if (jsonLdImages.size >= 2) {
    const deduped = deduplicateByBase(jsonLdImages);
    console.log(`Using ${deduped.length} JSON-LD images (skipping HTML scrape)`);
    return deduped.slice(0, 30);
  }

  // ── Step 2: Fallback — scrape HTML (all img/srcset/data-src) ─────────
  const urls = new Set<string>();

  // Add any JSON-LD images we did find (even if < 2)
  for (const u of jsonLdImages) urls.add(u);

  // HTML img src
  const imgSrcRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  while ((match = imgSrcRegex.exec(html)) !== null) {
    const url = match[1].trim();
    if (isCarImage(url, sourceUrl)) urls.add(cleanImageUrl(url, sourceUrl));
  }

  // srcset attributes
  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcset = match[1];
    for (const part of srcset.split(",")) {
      const url = part.trim().split(/\s+/)[0];
      if (url && isCarImage(url, sourceUrl)) urls.add(cleanImageUrl(url, sourceUrl));
    }
  }

  // data-src (lazy loaded)
  const dataSrcRegex = /data-src=["']([^"']+)["']/gi;
  while ((match = dataSrcRegex.exec(html)) !== null) {
    const url = match[1].trim();
    if (isCarImage(url, sourceUrl)) urls.add(cleanImageUrl(url, sourceUrl));
  }

  // Markdown images as last resort
  const mdImgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  while ((match = mdImgRegex.exec(markdown)) !== null) {
    const url = match[1].trim();
    if (isCarImage(url, sourceUrl)) urls.add(cleanImageUrl(url, sourceUrl));
  }

  // Cap at 15 (HTML scrape is noisier — a real listing rarely has more,
  // and limiting reduces the chance of capturing "similar cars" thumbnails)
  return deduplicateByBase(urls).slice(0, 15);
}

function deduplicateByBase(urls: Set<string>): string[] {
  const seen = new Map<string, string>();
  for (const url of urls) {
    const base = getBaseUrl(url);
    if (!seen.has(base) || url.length > (seen.get(base)?.length || 0)) {
      seen.set(base, url);
    }
  }
  return Array.from(seen.values());
}

function getBaseUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove common size/quality params
    u.searchParams.delete("w");
    u.searchParams.delete("h");
    u.searchParams.delete("width");
    u.searchParams.delete("height");
    u.searchParams.delete("rule");
    u.searchParams.delete("quality");
    u.searchParams.delete("q");
    u.searchParams.delete("size");
    return u.pathname;
  } catch {
    return url.split("?")[0];
  }
}

function cleanImageUrl(url: string, sourceUrl: string): string {
  // Normalize protocol-relative URLs to https
  if (url.startsWith("//")) url = "https:" + url;

  // For subito.it, upgrade to full size
  // New CDN (images.sbito.it) uses fullscreen-1x-auto; old CDN (static.sbito.it) uses gallery-2x
  if (sourceUrl.includes("subito.it") && url.includes("rule=")) {
    const rule = url.includes("images.sbito.it") ? "fullscreen-1x-auto" : "gallery-2x";
    return url.replace(/rule=[^&]+/, `rule=${rule}`);
  }
  // For autoscout24, upgrade to 800x600
  // CDN: prod.pictures.autoscout24.net/listing-images/{uuid}.jpg/250x188.webp
  if (url.includes("autoscout24.net/listing-images/")) {
    return url.replace(/\/\d+x\d+(\.\w+)$/, "/800x600$1");
  }
  return url;
}

function isCarImage(url: string, sourceUrl: string): boolean {
  if (!url || url.length < 10) return false;
  const lower = url.toLowerCase();

  // Must be http/https or protocol-relative
  if (!lower.startsWith("http") && !lower.startsWith("//")) return false;

  // Must be an image
  const isImgExt = /\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(lower);
  const isImgCdn =
    lower.includes("/images/") ||
    lower.includes("/img/") ||
    lower.includes("/photo") ||
    lower.includes("image");
  if (!isImgExt && !isImgCdn) return false;

  // Exclude non-car images
  if (lower.includes("logo") || lower.includes("icon") || lower.includes("favicon")) return false;
  if (lower.includes("avatar") || lower.includes("badge") || lower.includes("sprite")) return false;
  if (lower.includes("banner") || lower.includes("promo") || lower.includes("/ads/")) return false;
  if (lower.includes("placeholder") || lower.includes("default-") || lower.includes("no-image"))
    return false;
  if (lower.includes("social-share") || lower.includes("og-image") || lower.includes("branding"))
    return false;
  if (lower.includes(".svg") || lower.includes(".gif")) return false;
  // Skip tiny tracker pixels
  if (/[_\-]1x1[_\-.]/.test(lower)) return false;

  // Site-specific: only accept images from the listing's CDN
  if (sourceUrl.includes("subito.it")) {
    return lower.includes("sbito.it") || lower.includes("subito.it");
  }
  if (sourceUrl.includes("autoscout24")) {
    return lower.includes("autoscout") || lower.includes("as24");
  }
  if (sourceUrl.includes("automobile.it")) {
    return lower.includes("automobile.it") || lower.includes("imgix");
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
    drive_type: string | null;
    displacement: string | null;
    gears: number | null;
    cylinders: number | null;
    weight: string | null;
    fuel_consumption: string | null;
    paint_type: string | null;
    interior_color: string | null;
    interior_material: string | null;
    equipment: string[];
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
    drive_type: null,
    displacement: null,
    gears: null,
    cylinders: null,
    weight: null,
    fuel_consumption: null,
    paint_type: null,
    interior_color: null,
    interior_material: null,
    equipment: [],
  };

  const fullText = markdown.toLowerCase();

  // ─── Emission class ───
  // AutoScout24 uses "Classe emissioni" (plural), Subito uses "Classe emissione" (singular)
  // Table format: | Classe emissioni | Euro 6 |   Key-value: Classe emissioni: Euro 6
  const emissionPatterns = [
    /\|\s*classe\s*emission[ei]\s*\|\s*euro\s*(\d)/i, // table format (AutoScout24)
    /classe\s*(?:di\s*)?emission[ei][:\s]*euro\s*(\d)/i, // key-value, both singular/plural
    /classe\s*(?:di\s*)?emission[ei][:\s]*(\d)/i,
    /emissioni[:\s]*euro\s*(\d)/i,
    /normativa\s*(?:anti)?inquinamento[:\s]*euro\s*(\d)/i,
    /standard\s*emissioni?[:\s]*euro\s*(\d)/i,
    /\|\s*euro\s*(\d)\s*\|/i,
    /euro\s*(\d)\s*(?:d|b|c)?(?:\s|,|\.|$|\|)/i,
  ];
  for (const pat of emissionPatterns) {
    const m = markdown.match(pat);
    if (m) {
      details.emission_class = `Euro ${m[1]}`;
      break;
    }
  }

  // ─── Seats ───
  // AutoScout24 table: | Posti | 5 |   Subito key-value: Posti: 5
  const seatsPatterns = [
    /\|\s*posti\s*\|\s*(\d+)/i, // table format (AutoScout24)
    /numero\s*(?:di\s*)?posti[:\s]*(\d)/i,
    /posti\s*(?:a\s*sedere)?[:\s]*(\d)/i,
    /(\d)\s*posti\s*(?:a\s*sedere)?/i,
  ];
  for (const pat of seatsPatterns) {
    const m = markdown.match(pat);
    if (m) {
      details.seats = parseInt(m[1]);
      break;
    }
  }

  // ─── Doors ───
  // AutoScout24 table: | Porte | 5 |   Subito: Porte: 5
  const doorsPatterns = [
    /\|\s*porte\s*\|\s*(\d+)/i, // table format (AutoScout24)
    /numero\s*(?:di\s*)?porte[:\s]*(\d)/i,
    /porte[:\s]*(\d)/i,
    /(\d)\s*[\/\-]\s*\d?\s*porte/i,
  ];
  for (const pat of doorsPatterns) {
    const m = markdown.match(pat);
    if (m) {
      details.doors = parseInt(m[1]);
      break;
    }
  }

  // ─── Condition ───
  // AutoScout24: | Condizioni | Usato |   Subito: Condizione: Usato
  const condPatterns = [
    /\|\s*condizion[ei]\s*\|\s*(nuovo|usato)/i, // table format (AutoScout24)
    /condizion[ei][:\s]*(nuovo|usato|km\s*0|km\s*zero|semi[- ]?nuovo)/i,
    /tipo\s*(?:di\s*)?veicolo[:\s]*(nuovo|usato|km\s*0)/i,
    /stato[:\s]*(nuovo|usato)/i,
  ];
  for (const pat of condPatterns) {
    const m = markdown.match(pat);
    if (m) {
      details.condition = m[1].toLowerCase().includes("usato") ? "Usato" : "Nuovo";
      break;
    }
  }
  if (!details.condition) {
    if (fullText.includes("km 0") || fullText.includes("km zero")) details.condition = "Nuovo";
    else if (fullText.includes("veicolo usato") || fullText.includes("auto usata"))
      details.condition = "Usato";
  }

  // ─── Version / trim (strict: only from structured data, NOT descriptions) ───
  const versionPatterns = [
    /\|\s*(?:versione|allestimento|variante)\s*\|\s*([^\|]{3,60})\s*\|/i, // table (AutoScout24)
    /(?:versione|allestimento|variante)\s*[:\|]\s*([^\n\|]{3,60})/i,
  ];
  for (const pat of versionPatterns) {
    const m = markdown.match(pat);
    if (m) {
      let ver = m[1]
        .trim()
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[*_]+/g, "")
        .trim();
      if (
        ver.length > 2 &&
        ver.length < 80 &&
        !ver.includes(".") &&
        !/\b(che|con|per|del|dal|quindi|ottimo|buono)\b/i.test(ver)
      ) {
        details.version = ver;
        break;
      }
    }
  }

  // ─── Color ───
  // AutoScout24: | Colore | Rosso |  or  | Colore esterno | Rosso |
  // Subito: Colore: Rosso
  const colorPatterns = [
    /\|\s*colore\s*(?:esterno)?\s*\|\s*([^|\n]{2,30})\s*\|/i, // table format (AutoScout24)
    /colore\s*esterno[:\s]+([^\n|,]{2,30})/i,
    /colore(?!\s*interno)[:\s]+([^\n|,\|]{2,30})/i,
  ];
  for (const pat of colorPatterns) {
    const m = markdown.match(pat);
    if (m) {
      const color = m[1]
        .trim()
        .replace(/[*_\[\]()]+/g, "")
        .trim();
      if (color.length >= 2 && color.length <= 40 && !color.toLowerCase().includes("interno")) {
        details.color = color;
        break;
      }
    }
  }

  // ─── Transmission (fills in if search scrape missed it) ───
  // AutoScout24: "Tipo di cambio  Automatico"   Subito: "Cambio: Manuale"
  const transPatterns = [
    /\|\s*(?:tipo\s*(?:di\s*)?)?cambio\s*\|\s*(automatico|manuale|sequenziale)/i, // table
    /(?:tipo\s*(?:di\s*)?)?cambio[:\s]+(automatico|manuale|sequenziale)/i,
    /trasmissione[:\s]+(automatica|manuale|sequenziale)/i,
  ];
  for (const pat of transPatterns) {
    const m = markdown.match(pat);
    if (m) {
      const v = m[1].toLowerCase();
      details.transmission = v.startsWith("auto") || v === "sequenziale" ? "Automatico" : "Manuale";
      break;
    }
  }

  // ─── Power (fills in if search scrape missed it) ───
  // AutoScout24: "Potenza  190 kW (258 CV)"   Subito: "Potenza: 258 CV"
  const powerPatterns = [
    /\|\s*potenza\s*\|\s*\d+\s*kW\s*\((\d+)\s*CV\)/i, // table: | Potenza | 190 kW (258 CV) |
    /potenza[:\s]+\d+\s*kW\s*\((\d+)\s*CV\)/i, // "Potenza 190 kW (258 CV)"
    /potenza[:\s]+(\d+)\s*CV/i, // "Potenza: 258 CV"
    /(\d+)\s*kW\s*\((\d+)\s*CV\)/, // standalone "190 kW (258 CV)"
  ];
  for (const pat of powerPatterns) {
    const m = markdown.match(pat);
    if (m) {
      const cv = m[2] || m[1]; // last pattern has 2 groups
      details.power = `${cv} CV`;
      break;
    }
  }

  // ─── Drive type (Trazione) ───
  const drivePatterns = [
    /\|\s*trazione\s*\|\s*([^|\n]{2,30})\s*\|/i,
    /trazione[:\s]+([^\n|,]{2,30})/i,
  ];
  for (const pat of drivePatterns) {
    const m = markdown.match(pat);
    if (m) {
      const v = m[1]
        .trim()
        .replace(/[*_\[\]()]+/g, "")
        .trim();
      if (v.length >= 2) {
        details.drive_type = v;
        break;
      }
    }
  }

  // ─── Displacement (Cilindrata) ───
  const displacementPatterns = [
    /\|\s*cilindrata\s*\|\s*([^|\n]{2,30})\s*\|/i,
    /cilindrata[:\s]+([^\n|,]{2,30})/i,
  ];
  for (const pat of displacementPatterns) {
    const m = markdown.match(pat);
    if (m) {
      const v = m[1]
        .trim()
        .replace(/[*_\[\]()]+/g, "")
        .trim();
      if (v.length >= 2) {
        details.displacement = v;
        break;
      }
    }
  }

  // ─── Gears (Marce) ───
  const gearsPatterns = [
    /\|\s*marce\s*\|\s*(\d+)/i,
    /marce[:\s]+(\d+)/i,
    /numero\s*(?:di\s*)?marce[:\s]*(\d+)/i,
  ];
  for (const pat of gearsPatterns) {
    const m = markdown.match(pat);
    if (m) {
      details.gears = parseInt(m[1]);
      break;
    }
  }

  // ─── Cylinders (Cilindri) ───
  const cylinderPatterns = [
    /\|\s*cilindri\s*\|\s*(\d+)/i,
    /cilindri[:\s]+(\d+)/i,
    /numero\s*(?:di\s*)?cilindri[:\s]*(\d+)/i,
  ];
  for (const pat of cylinderPatterns) {
    const m = markdown.match(pat);
    if (m) {
      details.cylinders = parseInt(m[1]);
      break;
    }
  }

  // ─── Weight (Peso a vuoto) ───
  const weightPatterns = [
    /\|\s*peso\s*(?:a\s*vuoto)?\s*\|\s*([^|\n]{2,30})\s*\|/i,
    /peso\s*(?:a\s*vuoto)?[:\s]+([^\n|,]{2,30})/i,
  ];
  for (const pat of weightPatterns) {
    const m = markdown.match(pat);
    if (m) {
      const v = m[1]
        .trim()
        .replace(/[*_\[\]()]+/g, "")
        .trim();
      if (v.length >= 2) {
        details.weight = v;
        break;
      }
    }
  }

  // ─── Fuel consumption (Consumo di carburante) ───
  const consumptionPatterns = [
    /\|\s*consumo\s*(?:di\s*carburante|combinato)?\s*\|\s*([^|\n]{2,40})\s*\|/i,
    /consumo\s*(?:di\s*carburante|combinato)?[:\s]+([^\n|]{2,40})/i,
  ];
  for (const pat of consumptionPatterns) {
    const m = markdown.match(pat);
    if (m) {
      const v = m[1]
        .trim()
        .replace(/[*_\[\]()]+/g, "")
        .trim();
      if (v.length >= 2) {
        details.fuel_consumption = v;
        break;
      }
    }
  }

  // ─── Paint type (Tipo di vernice) ───
  const paintPatterns = [
    /\|\s*tipo\s*(?:di\s*)?vernice\s*\|\s*([^|\n]{2,30})\s*\|/i,
    /tipo\s*(?:di\s*)?vernice[:\s]+([^\n|,]{2,30})/i,
  ];
  for (const pat of paintPatterns) {
    const m = markdown.match(pat);
    if (m) {
      const v = m[1]
        .trim()
        .replace(/[*_\[\]()]+/g, "")
        .trim();
      if (v.length >= 2) {
        details.paint_type = v;
        break;
      }
    }
  }

  // ─── Interior color (Colore finiture interne) ───
  const intColorPatterns = [
    /\|\s*colore\s*(?:finiture\s*)?intern[eio]\s*\|\s*([^|\n]{2,30})\s*\|/i,
    /colore\s*(?:finiture\s*)?intern[eio][:\s]+([^\n|,]{2,30})/i,
  ];
  for (const pat of intColorPatterns) {
    const m = markdown.match(pat);
    if (m) {
      const v = m[1]
        .trim()
        .replace(/[*_\[\]()]+/g, "")
        .trim();
      if (v.length >= 2) {
        details.interior_color = v;
        break;
      }
    }
  }

  // ─── Interior material (Materiale interni) ───
  const materialPatterns = [
    /\|\s*materiale\s*(?:intern[io])?\s*\|\s*([^|\n]{2,40})\s*\|/i,
    /materiale\s*(?:intern[io])?[:\s]+([^\n|,]{2,40})/i,
  ];
  for (const pat of materialPatterns) {
    const m = markdown.match(pat);
    if (m) {
      const v = m[1]
        .trim()
        .replace(/[*_\[\]()]+/g, "")
        .trim();
      if (v.length >= 2) {
        details.interior_material = v;
        break;
      }
    }
  }

  // ─── Equipment (Equipaggiamento) ───
  details.equipment = extractEquipment(markdown, fullText);

  // ─── Description ───
  details.description = extractDescription(markdown, fullText);

  return details;
}

function extractEquipment(markdown: string, fullText: string): string[] {
  const items: string[] = [];

  // Find the equipment section by heading
  const headings = ["equipaggiamento", "dotazioni", "optional", "caratteristiche principali"];

  let sectionText = "";
  for (const heading of headings) {
    const idx = fullText.indexOf(heading);
    if (idx > -1) {
      const after = markdown
        .slice(idx + heading.length)
        .trim()
        .replace(/^[:\s#]+/, "");
      // End at the next major section heading or known boundary
      const endMatch = after.search(
        /\n#{1,3}\s|contatta|invia un messaggio|inserisci|pubblica|descrizione\s*del\s*veicolo|descrizione\s*venditore|confronto\s*prezzi|annunci\s*simili|dati\s*(?:di\s*base|tecnici)|ambiente|cronologia|colore\s*e\s*interni/i,
      );
      sectionText = endMatch > 0 ? after.slice(0, endMatch).trim() : after.slice(0, 5000).trim();
      if (sectionText.length > 20) break;
      sectionText = "";
    }
  }

  if (!sectionText) return items;

  // Extract items from different formats:
  // 1. Bullet points: "- Item" or "* Item" or "• Item"
  // 2. Lines with checkmarks: "✓ Item" or "✔ Item"
  // 3. Simple lines (one item per line in equipment sections)
  const lines = sectionText.split("\n");
  for (const line of lines) {
    let cleaned = line
      .replace(/^[\s\-*•✓✔✅►▸▹→]+/, "") // Remove bullet markers
      .replace(/[*_#]+/g, "") // Remove markdown formatting
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // Remove markdown links
      .trim();

    // Skip empty, too short, or header-like lines
    if (!cleaned || cleaned.length < 2 || cleaned.length > 80) continue;
    if (cleaned.startsWith("|") || cleaned.startsWith("---")) continue;
    // Skip sub-headings like "Comfort", "Sicurezza", "Intrattenimento/Media"
    if (/^(comfort|sicurezza|intrattenimento|media|extra|altro|esterno|interno)\s*$/i.test(cleaned))
      continue;
    // Skip if it looks like a section header (all caps or very short with colon)
    if (/^[A-Z\s]{2,20}$/.test(cleaned)) continue;

    items.push(cleaned);
  }

  return items;
}

function extractDescription(markdown: string, fullText: string): string | null {
  let descText = "";

  const descHeadings = [
    "descrizione del veicolo",
    "descrizione venditore",
    "descrizione",
    "dettagli annuncio",
  ];

  for (const heading of descHeadings) {
    const idx = fullText.indexOf(heading);
    if (idx > -1) {
      const afterDesc = markdown
        .slice(idx + heading.length)
        .trim()
        .replace(/^[:\s#]+/, "");
      const endMatch = afterDesc.search(
        /\n#{1,3}\s|contatta|invia un messaggio|inserisci|pubblica|caratteristiche\s*(tecniche|principali)|scheda\s*tecnica|dati\s*tecnici|equipaggiamento/i,
      );
      descText =
        endMatch > 0 ? afterDesc.slice(0, endMatch).trim() : afterDesc.slice(0, 2000).trim();
      if (descText.length > 40) break;
      descText = "";
    }
  }

  if (!descText) {
    const paragraphs = markdown.split(/\n\n+/);
    const longest = paragraphs
      .filter(
        (p) =>
          p.length > 60 &&
          !p.startsWith("#") &&
          !p.startsWith("|") &&
          !p.startsWith("![") &&
          !p.startsWith("---"),
      )
      .sort((a, b) => b.length - a.length)[0];
    if (longest) descText = longest.trim().slice(0, 2000);
  }

  if (descText) {
    descText = descText
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_#]+/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (descText.length > 30) return descText;
  }
  return null;
}
