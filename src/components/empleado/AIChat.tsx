import { useState } from "react";
import { Sparkles, Send, Image as ImageIcon, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { store, type Diagram } from "@/lib/workOrderStore";
import { toast } from "sonner";

type Msg =
  | { role: "employee"; text: string }
  | { role: "ai"; text: string }
  | { role: "ai"; diagrams: Diagram[] };

export default function AIChat({ onDone }: { onDone: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "ai",
      text: "Hola 👋 Soy tu asistente de diagramas. Por favor envíame una **descripción o foto** del diagrama de instalación que necesitas (ej: 'aire acondicionado split residencial con compresor 2HP') y generaré 12 variaciones para que elijas la mejor.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const send = async () => {
    if (!input.trim() || loading) return;
    const prompt = input.trim();
    setMessages((m) => [...m, { role: "employee", text: prompt }]);
    setInput("");
    setLoading(true);
    setMessages((m) => [
      ...m,
      { role: "ai", text: "Perfecto, generando 12 variaciones de diagrama… esto puede tomar 20-40 segundos." },
    ]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-diagrams", {
        body: { prompt, count: 12 },
      });
      if (error) throw error;
      const diagrams = (data?.diagrams ?? []) as Diagram[];
      if (!diagrams.length) throw new Error("No se generaron diagramas");
      setMessages((m) => [
        ...m,
        { role: "ai", text: `Listo. Aquí tienes ${diagrams.length} diagramas. Selecciona el que más te guste:` },
        { role: "ai", diagrams },
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
    toast.success("Diagrama guardado. Ahora completa el formulario.");
  };

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Asistente IA · Generador de diagramas</h2>
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-1">
                    {m.diagrams.map((d) => {
                      const isSel = selectedId === d.id;
                      return (
                        <button
                          key={d.id}
                          onClick={() => choose(d)}
                          className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                            isSel
                              ? "border-primary ring-2 ring-primary/40"
                              : "border-border hover:border-primary/60"
                          }`}
                        >
                          <img
                            src={d.url}
                            alt={d.style}
                            className="h-full w-full object-cover"
                          />
                          {isSel && (
                            <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                              <div className="rounded-full bg-primary text-primary-foreground p-2">
                                <Check className="h-5 w-5" />
                              </div>
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1 text-[10px] text-white opacity-0 group-hover:opacity-100 transition truncate">
                            #{d.id + 1} · {d.style.split(",")[0]}
                          </div>
                        </button>
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

      {selectedId !== null && (
        <div className="rounded-lg border bg-primary/5 p-4 flex items-center justify-between">
          <p className="text-sm">
            ✅ Diagrama #{selectedId + 1} seleccionado.
          </p>
          <button
            onClick={onDone}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Continuar al formulario →
          </button>
        </div>
      )}
    </div>
  );
}
