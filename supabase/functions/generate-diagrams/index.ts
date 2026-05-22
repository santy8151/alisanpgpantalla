// Generates refrigeration/AC diagram(s) via Lovable AI. Supports reference images.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      prompt,
      count = 1,
      model = "google/gemini-2.5-flash-image",
      images = [] as string[], // data URLs (base64)
    } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const styles = [
      "blueprint technical schematic, blue background white lines",
      "isometric 3d clean diagram, white background",
      "minimalist line art diagram, monochrome",
      "industrial engineering schematic with labels",
      "exploded view 3d render, light gray background",
      "hand-drawn pencil sketch on white paper",
      "cad-style 2d top view with dimensions",
      "colorful infographic with arrows and callouts",
      "dark mode schematic, black background neon lines",
      "cutaway cross-section illustration, realistic shading",
      "flat vector diagram with labeled components",
      "photo-realistic 3d render of the installation",
    ];

    const tasks = Array.from({ length: count }).map(async (_, i) => {
      const style = styles[i % styles.length];
      const fullPrompt = `Technical refrigeration / air conditioning installation diagram. ${prompt}. Style: ${style}. Show compressor, evaporator, condenser, fan, pressostat and electrical switches connected. Clear, professional.${images.length ? " Use the attached images as visual reference for the layout, components or vehicle." : ""}`;

      const content: any[] = [{ type: "text", text: fullPrompt }];
      for (const url of images) {
        if (typeof url === "string" && url.startsWith("data:")) {
          content.push({ type: "image_url", image_url: { url } });
        }
      }

      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: images.length ? content : fullPrompt }],
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
