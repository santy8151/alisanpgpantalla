import { useRef, useState } from "react";
import { Sparkles, Send, Image as ImageIcon, Check, Loader2, ArrowRight, Paperclip, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { store, type Diagram } from "@/lib/workOrderStore";
import { toast } from "sonner";

type Msg =
  | { role: "employee"; text: string; images?: string[] }
  | { role: "ai"; text: string }
  | { role: "ai"; diagrams: Diagram[] };

const MODELS = [
  { id: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image (rápido)" },
  { id: "google/gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash Image (pro)" },
  { id: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image (máxima calidad)" },
];

export default function AIChat({ onDone }: { onDone: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "ai",
      text: "Hola 👋 Soy tu asistente de diagramas. Puedes adjuntar fotos de referencia (vehículo, instalación previa, croquis) con el clip 📎 y describir el diagrama que necesitas.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [model, setModel] = useState(MODELS[0].id);
  const [attached, setAttached] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const arr = await Promise.all(
      Array.from(files).slice(0, 4).map(
        (f) =>
          new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = rej;
            r.readAsDataURL(f);
          })
      )
    );
    setAttached((prev) => [...prev, ...arr].slice(0, 4));
  };

  const send = async () => {
    if ((!input.trim() && !attached.length) || loading) return;
    const prompt = input.trim() || "Genera un diagrama basado en las imágenes adjuntas";
    const imgs = attached;
    setMessages((m) => [...m, { role: "employee", text: prompt, images: imgs }]);
    setInput("");
    setAttached([]);
    setLoading(true);
    setMessages((m) => [...m, { role: "ai", text: `Generando 12 diagramas…` }]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-diagrams", {
        body: { prompt, count: 12, model, images: imgs },
      });
      if (error) throw error;
      const diagrams = (data?.diagrams ?? []) as Diagram[];
      if (!diagrams.length) throw new Error("No se generaron diagramas");
      setMessages((m) => [
        ...m,
        { role: "ai", text: `Listo. Aquí tienes ${diagrams.length} opciones — elige la que mejor te sirva:` },
        { role: "ai", diagrams },
      ]);
    } catch (e) {
      console.error(e);
      toast.error("Error generando el diagrama.");
      setMessages((m) => [...m, { role: "ai", text: "❌ Hubo un error generando el diagrama." }]);
    } finally {
      setLoading(false);
    }
  };

  const choose = (d: Diagram) => {
    setSelectedId(d.id);
    store.setDiagram(d);
    toast.success("Diagrama guardado.");
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
            <div key={i} className={`flex ${m.role === "employee" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "employee" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {"text" in m && <p className="whitespace-pre-wrap">{m.text}</p>}
                {"images" in m && m.images && m.images.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {m.images.map((src, idx) => (
                      <img key={idx} src={src} alt="" className="h-20 w-full rounded border object-cover" />
                    ))}
                  </div>
                )}
                {"diagrams" in m && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-1 w-full max-w-3xl">
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
                            <img src={d.url} alt={d.style} className="h-full w-full object-cover" />
                            {isSel && (
                              <div className="absolute inset-0 bg-primary/30 flex items-center justify-center pointer-events-none">
                                <div className="rounded-full bg-primary text-primary-foreground p-2">
                                  <Check className="h-5 w-5" />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="p-1.5 bg-background border-t">
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

        {attached.length > 0 && (
          <div className="border-t px-3 py-2 flex flex-wrap gap-2 bg-muted/30">
            {attached.map((src, i) => (
              <div key={i} className="relative group">
                <img src={src} alt="" className="h-14 w-14 rounded border object-cover" />
                <button
                  onClick={() => setAttached((a) => a.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t p-3 flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            title="Adjuntar imágenes"
            className="rounded-md p-1.5 hover:bg-muted text-muted-foreground"
          >
            <Paperclip className="h-4 w-4" />
          </button>
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
            disabled={loading || (!input.trim() && !attached.length)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
