const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AI-powered natural language search via Gemini
// Converts user query like "SUV diesel sotto 20k, meno di 100k km" into structured filters
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

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI non configurata (manca GEMINI_API_KEY)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `Sei un assistente per la ricerca di auto usate in Italia.
L'utente descrive in linguaggio naturale l'auto che cerca.
Estrai i filtri di ricerca e restituiscili SOLO come JSON valido, nessun testo aggiuntivo.

Campi disponibili (tutti opzionali):
- brand: string (es. "BMW", "Fiat", "Volkswagen")
- model: string (es. "Serie 3", "500", "Golf")
- yearMin: number (es. 2018)
- yearMax: number (es. 2024)
- priceMin: number in euro (es. 5000)
- priceMax: number in euro (es. 20000)
- kmMax: number (es. 100000)
- fuel: "Benzina"|"Diesel"|"Elettrica"|"Ibrida"|"GPL"|"Metano"
- transmission: "Manuale"|"Automatico"
- bodyType: "Berlina"|"SUV"|"Station Wagon"|"Coupé"|"Monovolume"|"Cabrio"
- location: string (es. "Milano")

Esempio output: {"brand":"BMW","model":"Serie 3","priceMax":25000,"fuel":"Diesel","yearMin":2019}

Query utente: ${query}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0,
            maxOutputTokens: 256,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let filters: Record<string, unknown> = {};
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) filters = JSON.parse(jsonMatch[0]);
    } catch {
      filters = {};
    }

    console.log('AI search filters:', JSON.stringify(filters));

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
