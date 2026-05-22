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
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [loadedJobId, setLoadedJobId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(() => store.getForm() ?? {
    plate: "",
    customer: "",
    manoObra: true,
    notes: "",
  });
  const diagram = store.getDiagram();

  const loadJobs = async () => {
    const { data } = await supabase
      .from("active_jobs")
      .select("*")
      .neq("status", "finalizado")
      .order("created_at");
    setJobs((data as ActiveJob[]) ?? []);
  };

  useEffect(() => {
    supabase
      .from("service_prices")
      .select("*")
      .order("category")
      .then(({ data }) => setPrices((data as Price[]) ?? []));
    loadJobs();
    const ch = supabase
      .channel("workform_jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "active_jobs" }, () => loadJobs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const loadFromJob = (j: ActiveJob) => {
    const fd = (j.form_data ?? {}) as Partial<FormData>;
    setLoadedJobId(j.id);
    setForm({
      plate: j.plate,
      customer: j.customer ?? "",
      proceso: fd.proceso,
      procesoValor: fd.procesoValor,
      compresorId: fd.compresorId,
      evaporadorId: fd.evaporadorId,
      condensadorId: fd.condensadorId,
      ventiladorId: fd.ventiladorId,
      trompoId: fd.trompoId,
      instalacionId: fd.instalacionId,
      manoObra: fd.manoObra ?? true,
      notes: fd.notes ?? (j.service_name ?? ""),
    });
    toast.success(`${j.plate} cargado · completa el servicio realizado`);
  };


  const update = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.plate || !form.customer) {
      toast.error("Placa y cliente son obligatorios");
      return;
    }
    store.setForm(form);

    // Persistir el trabajo realizado en la placa activa (si vino del tablero)
    if (loadedJobId) {
      await supabase
        .from("active_jobs")
        .update({ form_data: form as any } as any)
        .eq("id", loadedJobId);
    }

    // Crear entrada en catálogo de servicios como consecuencia del trabajo
    const selectedProducts = groups
      .map((g) => prices.find((p) => p.id === (form[g.key] as string | undefined)))
      .filter(Boolean) as Price[];
    const productNames = selectedProducts.map((p) => p.name).join(" + ");
    const procesoLabel = form.proceso ? PROCESO_LABELS[form.proceso] : "Servicio";
    const catalogName = `${form.plate} · ${form.customer} — ${procesoLabel}${productNames ? ` (${productNames})` : ""}`;
    const totalProductos = selectedProducts.reduce((s, p) => s + Number(p.price || 0), 0);
    const totalPrice = Number(form.procesoValor ?? 0) + totalProductos;
    const category = selectedProducts[0]?.category ?? (form.proceso ?? "otro");

    const { error: catErr } = await supabase.from("service_prices").insert({
      name: catalogName,
      category,
      price: totalPrice,
      delivery_minutes: 30,
    });
    if (catErr) toast.error(`Catálogo: ${catErr.message}`);
    else toast.success("Servicio registrado en catálogo · Generando factura…");

    onDone();
  };


  return (
    <div className="grid gap-4">
      {/* ====== Placas activas en el tablero (duplicado) ====== */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-3 flex items-center gap-2">
          <Car className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Placas activas en el tablero</h2>
          <span className="ml-auto text-xs text-muted-foreground">{jobs.length} en proceso</span>
        </div>
        {jobs.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Sin placas activas</p>
        ) : (
          <div className="divide-y">
            {jobs.map((j) => (
              <div key={j.id} className="p-4 grid sm:grid-cols-[auto_1fr_auto] items-center gap-4">
                <div className="rounded-md border-2 border-foreground bg-yellow-300 px-3 py-1.5 font-mono text-base font-black text-black">
                  {j.plate}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{j.service_name ?? j.service_type}</span>
                    {j.customer && <span className="text-muted-foreground">· {j.customer}</span>}
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {j.estimated_minutes} min
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(99, j.progress)}%` }} />
                  </div>
                </div>
                <button
                  onClick={() => loadFromJob(j)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90"
                >
                  <ClipboardList className="h-3.5 w-3.5" /> Cargar en formulario
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
