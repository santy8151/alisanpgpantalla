import { useEffect, useState } from "react";
import { ClipboardList, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { store, type FormData } from "@/lib/workOrderStore";
import { toast } from "sonner";

type Price = { id: string; category: string; name: string; price: number };

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
      .then(({ data }) => setPrices(data ?? []));
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
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <img src={diagram.url} alt="" className="h-16 w-16 rounded object-cover" />
              <div className="text-xs">
                <p className="font-semibold">Diagrama seleccionado</p>
                <p className="text-muted-foreground">{diagram.style}</p>
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

          <div className="grid sm:grid-cols-2 gap-4">
            {groups.map((g) => {
              const opts = prices.filter((p) => p.category === g.cat);
              return (
                <Field key={g.key} label={g.label}>
                  <select
                    value={(form[g.key] as string) ?? ""}
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
                </Field>
              );
            })}
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
