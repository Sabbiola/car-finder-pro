const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AI-powered natural language search
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

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI non configurata (manca ANTHROPIC_API_KEY)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `Sei un assistente per la ricerca di auto usate in Italia.
L'utente descrive in linguaggio naturale l'auto che cerca.
Devi estrarre i filtri di ricerca e restituirli in formato JSON.

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
- bodyType: "Berlina"|"SUV"|"Station Wagon"|"Coupé"|"Monovolume"|"Cabrio"|"Citycar"|"Crossover"
- location: string (es. "Milano")

Rispondi SOLO con JSON valido, nessun testo aggiuntivo. Esempio:
{"brand":"BMW","model":"Serie 3","priceMax":25000,"fuel":"Diesel","yearMin":2019}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: 'user', content: query }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';

    let filters: Record<string, unknown> = {};
    try {
      // Extract JSON even if there's extra text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) filters = JSON.parse(jsonMatch[0]);
    } catch {
      filters = {};
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
