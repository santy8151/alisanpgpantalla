import { useState } from "react";
import { Sparkles, Send, Image as ImageIcon, Check, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { store, type Diagram } from "@/lib/workOrderStore";
import { toast } from "sonner";

type Msg =
  | { role: "employee"; text: string }
  | { role: "ai"; text: string }
  | { role: "ai"; diagrams: Diagram[] };

const MODELS = [
  { id: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image (rápido)" },
  { id: "google/gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash Image (rápido + calidad pro)" },
  { id: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image (máxima calidad)" },
];

export default function AIChat({ onDone }: { onDone: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "ai",
      text: "Hola 👋 Soy tu asistente de diagramas. Elige el modelo de IA arriba y descríbeme el diagrama de instalación que necesitas (ej: 'aire acondicionado split residencial con compresor 2HP'). Generaré una imagen para que la apruebes.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [model, setModel] = useState(MODELS[0].id);

  const send = async () => {
    if (!input.trim() || loading) return;
    const prompt = input.trim();
    setMessages((m) => [...m, { role: "employee", text: prompt }]);
    setInput("");
    setLoading(true);
    setMessages((m) => [
      ...m,
      { role: "ai", text: `Perfecto, generando el diagrama con ${MODELS.find(x => x.id === model)?.label}…` },
    ]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-diagrams", {
        body: { prompt, count: 1, model },
      });
      if (error) throw error;
      const diagrams = (data?.diagrams ?? []) as Diagram[];
      if (!diagrams.length) throw new Error("No se generó el diagrama");
      setMessages((m) => [
        ...m,
        { role: "ai", text: `Listo. Aquí está tu diagrama. Pulsa "Elegir esta imagen" para continuar al formulario:` },
        { role: "ai", diagrams: diagrams.slice(0, 1) },
      ]);
    } catch (e) {
      console.error(e);
      toast.error("Error generando diagramas. Intenta de nuevo.");
      setMessages((m) => [...m, { role: "ai", text: "❌ Hubo un error generando los diagramas. Intenta otra vez." }]);
    } finally {
      setLoading(false);
    }
  };

  const choose = (d: Diagram) => {
    setSelectedId(d.id);
    store.setDiagram(d);
    toast.success("Diagrama guardado. Llevándote al formulario…");
    setTimeout(() => onDone(), 600);
  };

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Asistente IA · Generador de diagramas</h2>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">Modelo:</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loading}
              className="rounded-md border bg-background px-2 py-1.5 text-xs"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "employee" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "employee"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {"text" in m && (
                  <p className="whitespace-pre-wrap">{m.text}</p>
                )}
                {"diagrams" in m && (
                  <div className="grid grid-cols-1 gap-3 mt-1 max-w-md">
                    {m.diagrams.map((d) => {
                      const isSel = selectedId === d.id;
                      return (
                        <div
                          key={d.id}
                          className={`relative overflow-hidden rounded-lg border-2 transition ${
                            isSel ? "border-primary ring-2 ring-primary/40" : "border-border"
                          }`}
                        >
                          <div className="aspect-square overflow-hidden bg-background">
                            <img
                              src={d.url}
                              alt={d.style}
                              className="h-full w-full object-cover"
                            />
                            {isSel && (
                              <div className="absolute inset-0 bg-primary/30 flex items-center justify-center pointer-events-none">
                                <div className="rounded-full bg-primary text-primary-foreground p-2">
                                  <Check className="h-5 w-5" />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="p-1.5 bg-background border-t">
                            <p className="text-[10px] text-muted-foreground truncate mb-1.5">
                              #{d.id + 1} · {d.style.split(",")[0]}
                            </p>
                            <button
                              onClick={() => choose(d)}
                              className="w-full inline-flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
                            >
                              {isSel ? <><Check className="h-3 w-3" /> Elegida</> : <>Elegir esta imagen <ArrowRight className="h-3 w-3" /></>}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-2.5 text-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Generando…
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-3 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Describe el diagrama que necesitas…"
            disabled={loading}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
