// Generates multiple refrigeration/AC diagram variations via Lovable AI
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, count = 10, model = "google/gemini-2.5-flash-image" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const styles = [
      "blueprint technical schematic, blue background white lines",
      "isometric 3d clean diagram, white background",
      "minimalist line art diagram, monochrome",
      "industrial engineering schematic with labels",
      "colorful infographic style diagram",
      "hand-drawn sketch diagram on paper",
      "exploded view component diagram",
      "flowchart-style schematic with arrows",
      "vintage technical manual illustration",
      "modern flat design vector diagram",
      "wireframe CAD-style diagram",
      "annotated cutaway diagram",
    ];

    const tasks = Array.from({ length: count }).map(async (_, i) => {
      const style = styles[i % styles.length];
      const fullPrompt = `Technical refrigeration / air conditioning installation diagram. ${prompt}. Style: ${style}. Show compressor, evaporator, condenser, fan, pressostat and electrical switches connected. Clear, professional.`;
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: fullPrompt }],
            modalities: ["image", "text"],
          }),
        });
        if (!res.ok) {
          console.error(`Image ${i} failed:`, res.status, await res.text());
          return null;
        }
        const data = await res.json();
        const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        return url ? { id: i, style, url } : null;
      } catch (e) {
        console.error(`Image ${i} error:`, e);
        return null;
      }
    });

    const results = (await Promise.all(tasks)).filter(Boolean);

    return new Response(JSON.stringify({ diagrams: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-diagrams error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
