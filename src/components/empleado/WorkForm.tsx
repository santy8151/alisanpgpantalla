import { useEffect, useState } from "react";
import { ClipboardList, Receipt, Wrench, Car, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { store, type FormData, type ProcesoTipo, PROCESO_LABELS } from "@/lib/workOrderStore";
import { productImageFor } from "@/lib/productImages";
import { toast } from "sonner";

type Price = { id: string; category: string; name: string; price: number; image_url?: string | null };

type ActiveJob = {
  id: string;
  plate: string;
  customer: string | null;
  service_type: string;
  service_name: string | null;
  estimated_minutes: number;
  progress: number;
  form_data?: Partial<FormData> | null;
};

const groups: { key: keyof FormData; cat: string; label: string }[] = [
  { key: "compresorId", cat: "compresor", label: "Compresor" },
  { key: "evaporadorId", cat: "evaporador", label: "Evaporador" },
  { key: "condensadorId", cat: "condensador", label: "Condensador" },
  { key: "ventiladorId", cat: "ventilador", label: "Ventilador eléctrico" },
  { key: "trompoId", cat: "trompo", label: "Trompo presostático" },
  { key: "instalacionId", cat: "instalacion", label: "Instalación eléctrica con switche" },
];

export default function WorkForm({ onDone }: { onDone: () => void }) {
  const [prices, setPrices] = useState<Price[]>([]);
  const [form, setForm] = useState<FormData>(() => store.getForm() ?? {
    plate: "",
    customer: "",
    manoObra: true,
    notes: "",
  });
  const diagram = store.getDiagram();

  useEffect(() => {
    supabase
      .from("service_prices")
      .select("*")
      .order("category")
      .then(({ data }) => setPrices((data as Price[]) ?? []));
  }, []);

  const update = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.plate || !form.customer) {
      toast.error("Placa y cliente son obligatorios");
      return;
    }
    store.setForm(form);
    toast.success("Formulario guardado. Generando factura…");
    onDone();
  };

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-3 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Formulario de trabajo</h2>
        </div>
        <div className="p-5 space-y-5">
          {diagram && (
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <p className="text-sm font-bold uppercase tracking-wide text-primary">
                  Diagrama seleccionado
                </p>
              </div>
              <div className="overflow-hidden rounded-lg border bg-background">
                <img
                  src={diagram.url}
                  alt="Diagrama seleccionado"
                  className="w-full max-h-[360px] object-contain bg-muted/20"
                />
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Placa del vehículo *">
              <input
                value={form.plate}
                onChange={(e) => update("plate", e.target.value.toUpperCase())}
                placeholder="ABC-123"
                className="input"
              />
            </Field>
            <Field label="Nombre del cliente *">
              <input
                value={form.customer}
                onChange={(e) => update("customer", e.target.value)}
                placeholder="Juan Pérez"
                className="input"
              />
            </Field>
          </div>

          {/* Proceso / tipo de trabajo */}
          <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-bold uppercase tracking-wide text-amber-700">
                Proceso a realizar
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Tipo de proceso *">
                <select
                  value={form.proceso ?? ""}
                  onChange={(e) => update("proceso", (e.target.value || undefined) as ProcesoTipo | undefined)}
                  className="input"
                >
                  <option value="">— Seleccionar —</option>
                  {(Object.keys(PROCESO_LABELS) as ProcesoTipo[]).map((k) => (
                    <option key={k} value={k}>{PROCESO_LABELS[k]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Valor del proceso (COP)">
                <input
                  type="number"
                  value={form.procesoValor ?? ""}
                  onChange={(e) => update("procesoValor", e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="0"
                  className="input"
                />
              </Field>
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Productos y servicios Alisan PG
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((g) => {
                const opts = prices.filter((p) => p.category === g.cat);
                const selectedId = form[g.key] as string | undefined;
                const selected = opts.find((o) => o.id === selectedId);
                const imgSrc = selected?.image_url || productImageFor(g.cat);
                return (
                  <div
                    key={g.key}
                    className={`rounded-xl border-2 overflow-hidden transition ${
                      selectedId ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="aspect-[4/3] bg-muted/30 overflow-hidden">
                      <img
                        src={imgSrc}
                        alt={g.label}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-3 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide">{g.label}</p>
                      <select
                        value={selectedId ?? ""}
                        onChange={(e) => update(g.key, e.target.value as never)}
                        className="input"
                      >
                        <option value="">— No incluir —</option>
                        {opts.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} — ${Number(o.price).toLocaleString("es-CO")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.manoObra}
              onChange={(e) => update("manoObra", e.target.checked)}
              className="h-4 w-4"
            />
            Incluir mano de obra de instalación completa
          </label>

          <Field label="Notas adicionales">
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              className="input"
              placeholder="Observaciones del técnico…"
            />
          </Field>

          <button
            onClick={submit}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Receipt className="h-4 w-4" /> Generar factura
          </button>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          background: var(--background);
          color: var(--foreground);
        }
        .input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 20%, transparent); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
