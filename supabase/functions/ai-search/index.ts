const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Filters {
  brand?: string; model?: string;
  yearMin?: number; yearMax?: number;
  priceMin?: number; priceMax?: number;
  kmMax?: number;
  fuel?: string; transmission?: string;
  bodyType?: string; location?: string;
}

// ─── Regex-based parser (no API key required) ────────────────────────
function parseWithRegex(query: string): Filters {
  const q = query.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip accents for matching
  const filters: Filters = {};

  // PRICE MAX: "sotto 25.000€", "massimo 30k", "max €20.000", "fino a 15.000"
  const priceMaxM = q.match(/(?:sotto|massimo|max|fino\s*a|entro|meno\s*di)\s*€?\s*([\d.,]+)\s*(?:k|mila)?(?:\s*€)?/);
  if (priceMaxM) {
    let v = parseFloat(priceMaxM[1].replace(/[.,]/g, ''));
    if (/k|mila/.test(priceMaxM[0]) || v < 500) v *= 1000;
    filters.priceMax = Math.round(v);
  }

  // PRICE RANGE: "tra 20k e 35k", "tra 20.000 e 35.000 euro"
  const priceRangeM = q.match(/tra\s*([\d.,]+)\s*(?:k|mila)?(?:\s*e\s*|\s*[-–]\s*)([\d.,]+)\s*(?:k|mila|€|euro)?/);
  if (priceRangeM && !filters.priceMax) {
    let min = parseFloat(priceRangeM[1].replace(/[.,]/g, ''));
    let max = parseFloat(priceRangeM[2].replace(/[.,]/g, ''));
    if (/k|mila/.test(priceRangeM[0]) || max < 500) { min *= 1000; max *= 1000; }
    filters.priceMin = Math.round(min);
    filters.priceMax = Math.round(max);
  }

  // KM MAX: "meno di 80.000 km", "max 100k km", "sotto 50.000 chilometri"
  const kmM = q.match(/(?:meno\s*di|max|massimo|sotto|entro)\s*([\d.,]+)\s*(?:k\s*)?(?:km|chilometri)/);
  if (kmM) {
    let v = parseFloat(kmM[1].replace(/[.,]/g, ''));
    if (/\bk\b/.test(kmM[0]) || v < 1000) v *= 1000;
    filters.kmMax = Math.round(v);
  }

  // YEAR: "dopo il 2019", "dal 2020", "immatricolata nel 2021"
  const yearAfterM = q.match(/(?:dopo\s*il|dal?|immatricolata?\s*(?:dal?|dopo\s*il|nel)?|anno\s*(?:dal?|dopo))\s*(20\d{2})/);
  if (yearAfterM) filters.yearMin = parseInt(yearAfterM[1]);
  const yearBeforeM = q.match(/(?:prima\s*del|fino\s*al?|entro\s*il|al\s*massimo)\s*(20\d{2})/);
  if (yearBeforeM) filters.yearMax = parseInt(yearBeforeM[1]);
  const yearRangeM = q.match(/(?:tra\s*il|dal)\s*(20\d{2})\s*(?:al|e)\s*(20\d{2})/);
  if (yearRangeM) { filters.yearMin = parseInt(yearRangeM[1]); filters.yearMax = parseInt(yearRangeM[2]); }

  // FUEL
  if (/\bdiesel\b/.test(q)) filters.fuel = 'Diesel';
  else if (/\bbenzina\b/.test(q)) filters.fuel = 'Benzina';
  else if (/\belettric[ao]?\b|\bev\b|\belectri/.test(q)) filters.fuel = 'Elettrica';
  else if (/\bibrida?\b|\bhybrid\b|\bphev\b|\bmhev\b/.test(q)) filters.fuel = 'Ibrida';
  else if (/\bgpl\b/.test(q)) filters.fuel = 'GPL';
  else if (/\bmetano\b/.test(q)) filters.fuel = 'Metano';

  // TRANSMISSION
  if (/\bautomatic[ao]\b|\bdsg\b|\btiptronic\b/.test(q)) filters.transmission = 'Automatico';
  else if (/\bmanuale\b/.test(q)) filters.transmission = 'Manuale';

  // BODY TYPE
  if (/\bsuv\b|\bcrossover\b|\bfuoristrada\b|\b4x4\b/.test(q)) filters.bodyType = 'SUV';
  else if (/\bstation\s*wagon\b|\b\bsw\b|\bavant\b|\btouring\b|\bbreak\b/.test(q)) filters.bodyType = 'Station Wagon';
  else if (/\bberlina\b|\bsedan\b|\bhatchback\b/.test(q)) filters.bodyType = 'Berlina';
  else if (/\bcabrio\b|\bcabriolet\b|\bdecapottabile\b|\bspider\b/.test(q)) filters.bodyType = 'Cabrio';
  else if (/\bmonovolume\b|\bminivan\b|\bmpv\b/.test(q)) filters.bodyType = 'Monovolume';
  else if (/\bcoupe\b|\bcoup/.test(q)) filters.bodyType = 'Coupé';

  // BRAND (order matters: longer names first to avoid partial match)
  const brandMap: [string, string][] = [
    ['alfa romeo', 'Alfa Romeo'], ['land rover', 'Land Rover'],
    ['mercedes-benz', 'Mercedes-Benz'], ['mercedes', 'Mercedes-Benz'],
    ['volkswagen', 'Volkswagen'], ['vw', 'Volkswagen'],
    ['bmw', 'BMW'], ['audi', 'Audi'], ['fiat', 'Fiat'],
    ['toyota', 'Toyota'], ['ford', 'Ford'], ['renault', 'Renault'],
    ['peugeot', 'Peugeot'], ['opel', 'Opel'], ['volvo', 'Volvo'],
    ['tesla', 'Tesla'], ['kia', 'Kia'], ['hyundai', 'Hyundai'],
    ['seat', 'Seat'], ['skoda', 'Skoda'], ['skoda', 'Škoda'],
    ['jeep', 'Jeep'], ['honda', 'Honda'], ['mazda', 'Mazda'],
    ['nissan', 'Nissan'], ['suzuki', 'Suzuki'], ['porsche', 'Porsche'],
    ['mini', 'Mini'], ['dacia', 'Dacia'], ['citroen', 'Citroën'],
    ['jaguar', 'Jaguar'],
  ];
  for (const [key, value] of brandMap) {
    if (q.includes(key)) { filters.brand = value; break; }
  }

  // LOCATION: "zona Milano", "a Roma", "vicino a Torino"
  const locM = q.match(/(?:zona|a\s|in\s|vicino\s*a|nei\s*pressi\s*di)\s*([a-zàèéìòù][a-zàèéìòù\s]{1,20}?)(?:\s*,|\s+con|\s+diesel|\s+benzina|\s+suv|\s*$)/);
  if (locM) {
    const loc = locM[1].trim();
    const stopWords = ['un', 'una', 'con', 'di', 'del', 'dei', 'euro', 'km', 'anni'];
    if (!stopWords.includes(loc)) {
      filters.location = loc.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  return filters;
}

// ─── Gemini enhancement (optional, if GEMINI_API_KEY is set) ─────────
async function enhanceWithGemini(apiKey: string, query: string, base: Filters): Promise<Filters> {
  const prompt = `Sei un assistente per la ricerca di auto usate in Italia.
Analizza questa query e restituisci i filtri come JSON. Campi disponibili (tutti opzionali):
brand, model, yearMin, yearMax, priceMin, priceMax, kmMax,
fuel ("Benzina"|"Diesel"|"Elettrica"|"Ibrida"|"GPL"|"Metano"),
transmission ("Manuale"|"Automatico"),
bodyType ("Berlina"|"SUV"|"Station Wagon"|"Coupé"|"Monovolume"|"Cabrio"),
location (città italiana).
Rispondi SOLO con JSON valido.
Query: ${query}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 256 },
        }),
      }
    );
    if (!res.ok) return base;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(text);
    // Merge: Gemini fills only what regex missed
    return { ...parsed, ...Object.fromEntries(Object.entries(base).filter(([, v]) => v !== undefined)) };
  } catch {
    return base;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query vuota' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: always parse with regex (no API key needed)
    let filters: Filters = parseWithRegex(query);
    console.log('Regex filters:', JSON.stringify(filters));

    // Step 2: optionally enhance with Gemini
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (geminiKey) {
      filters = await enhanceWithGemini(geminiKey, query, filters);
      console.log('Gemini-enhanced filters:', JSON.stringify(filters));
    }

    return new Response(
      JSON.stringify({ success: true, filters }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('AI search error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Errore AI' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
