import { useEffect, useMemo, useState } from "react";
import { Settings, Plus, Trash2, Save, Pencil, X, Clock, Megaphone, AlertTriangle, Car, MessageSquare, CheckCircle2, Receipt, User, ClipboardList } from "lucide-react";
import { store, type FormData as WOFormData, type ProcesoTipo, PROCESO_LABELS } from "@/lib/workOrderStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


type Service = {
  id: string;
  category: string;
  name: string;
  price: number;
  delivery_minutes: number;
};

type JobFormData = Partial<WOFormData>;

type Job = {
  id: string;
  plate: string;
  customer: string | null;
  service_type: string;
  service_name: string | null;
  status: string;
  estimated_minutes: number;
  progress: number;
  delay_message: string | null;
  bay: string | null;
  called_at?: string | null;
  form_data?: JobFormData | null;
};


const CATEGORIES = ["compresor","evaporador","condensador","ventilador","trompo","instalacion","otro"];

export default function Services({ onGoInvoice }: { onGoInvoice?: () => void } = {}) {
  const [items, setItems] = useState<Service[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, Partial<Service>>>({});
  const [creating, setCreating] = useState<Partial<Service>>({
    category: "compresor", name: "", price: 0, delivery_minutes: 30,
  });

  // Modales para placas
  const [delayJob, setDelayJob] = useState<Job | null>(null);
  const [delayMsg, setDelayMsg] = useState("");
  const [delayMins, setDelayMins] = useState(15);
  const [callJob, setCallJob] = useState<Job | null>(null);
  const [callBay, setCallBay] = useState("Bahía 1");

  // Configurar trabajo (productos + valor + notas) por job
  const [workJob, setWorkJob] = useState<Job | null>(null);
  const [workData, setWorkData] = useState<JobFormData>({});

  // Asignar un producto del catálogo a placas activas
  const [assignService, setAssignService] = useState<Service | null>(null);
  const [assignSel, setAssignSel] = useState<Record<string, boolean>>({});

  // Crear nueva placa / servicio
  const [newPlate, setNewPlate] = useState({ kind: "vehiculo" as "vehiculo" | "cliente", plate: "", customer: "", service_type: "revision", service_name: "Revisión técnica", estimated_minutes: 30 });


  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: j }] = await Promise.all([
      supabase.from("service_prices").select("*").order("category").order("name"),
      supabase.from("active_jobs").select("*").neq("status", "finalizado").order("created_at"),
    ]);
    setItems((s as Service[]) ?? []);
    setJobs((j as Job[]) ?? []);
    setLoading(false);
  };

  // Para cada servicio del catálogo, lista de placas/clientes que lo tienen seleccionado
  const usageByService = useMemo(() => {
    const map: Record<string, { plate: string; customer: string | null }[]> = {};
    for (const j of jobs) {
      const fd = (j.form_data ?? {}) as JobFormData;
      const ids = [fd.compresorId, fd.evaporadorId, fd.condensadorId, fd.ventiladorId, fd.trompoId, fd.instalacionId].filter(Boolean) as string[];
      for (const id of ids) {
        (map[id] ||= []).push({ plate: j.plate, customer: j.customer });
      }
    }
    return map;
  }, [jobs]);


  useEffect(() => {
    load();
    const ch = supabase
      .channel("services_jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "active_jobs" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // === Servicios ===
  const startEdit = (s: Service) => setEditing((e) => ({ ...e, [s.id]: { ...s } }));
  const cancelEdit = (id: string) => setEditing((e) => { const c = { ...e }; delete c[id]; return c; });
  const saveEdit = async (id: string) => {
    const patch = editing[id]; if (!patch) return;
    const { error } = await supabase.from("service_prices").update({
      name: patch.name, category: patch.category, price: Number(patch.price),
      delivery_minutes: Number(patch.delivery_minutes),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Servicio actualizado"); cancelEdit(id); load();
  };
  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este servicio?")) return;
    const { error } = await supabase.from("service_prices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado"); load();
  };
  const create = async () => {
    if (!creating.name || !creating.category) return toast.error("Nombre y categoría son obligatorios");
    const { error } = await supabase.from("service_prices").insert({
      name: creating.name, category: creating.category,
      price: Number(creating.price ?? 0), delivery_minutes: Number(creating.delivery_minutes ?? 30),
    });
    if (error) return toast.error(error.message);
    toast.success("Servicio creado");
    setCreating({ category: "compresor", name: "", price: 0, delivery_minutes: 30 });
    load();
  };

  // === Placas ===
  const updateJob = async (id: string, patch: Partial<Job>) => {
    const { error } = await supabase.from("active_jobs").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const finishJob = async (id: string) => updateJob(id, { status: "finalizado" });
  const addPlate = async () => {
    const isVeh = newPlate.kind === "vehiculo";
    if (isVeh && !newPlate.plate.trim()) return toast.error("Placa requerida");
    if (!isVeh && !newPlate.customer.trim()) return toast.error("Nombre del cliente/empresa requerido");
    const ref = isVeh
      ? newPlate.plate.toUpperCase()
      : `SVR-${Date.now().toString().slice(-5)}`;
    const { error } = await supabase.from("active_jobs").insert({
      plate: ref,
      customer: newPlate.customer || null,
      service_type: newPlate.service_type,
      service_name: newPlate.service_name,
      estimated_minutes: Number(newPlate.estimated_minutes),
      progress: 10,
    });
    if (error) return toast.error(error.message);
    toast.success(isVeh ? "Placa agregada al tablero" : "Cliente agregado al tablero");
    setNewPlate({ kind: newPlate.kind, plate: "", customer: "", service_type: "revision", service_name: "Revisión técnica", estimated_minutes: 30 });
    load();
  };

  const inferProceso = (st: string): ProcesoTipo =>
    st === "instalacion" ? "instalacion"
    : st === "garantia" ? "garantia"
    : st === "escaneo_fugas" ? "escaneo_fugas"
    : st === "mantenimiento" ? "mantenimiento"
    : "revision";

  // Enviar este servicio al módulo de Factura (usa form_data si existe)
  const goInvoice = (j: Job) => {
    const fd = (j.form_data ?? {}) as JobFormData;
    store.setForm({
      plate: j.plate,
      customer: j.customer ?? "",
      proceso: fd.proceso ?? inferProceso(j.service_type),
      procesoValor: fd.procesoValor ?? 0,
      compresorId: fd.compresorId,
      evaporadorId: fd.evaporadorId,
      condensadorId: fd.condensadorId,
      ventiladorId: fd.ventiladorId,
      trompoId: fd.trompoId,
      instalacionId: fd.instalacionId,
      manoObra: fd.manoObra ?? false,
      notes: fd.notes ?? (j.service_name ?? ""),
    });
    toast.success(`Datos de ${j.plate} cargados en Factura`);
    onGoInvoice?.();
  };

  // Abrir modal de configurar trabajo
  const openWork = (j: Job) => {
    const fd = (j.form_data ?? {}) as JobFormData;
    setWorkJob(j);
    setWorkData({
      proceso: fd.proceso ?? inferProceso(j.service_type),
      procesoValor: fd.procesoValor ?? 0,
      compresorId: fd.compresorId,
      evaporadorId: fd.evaporadorId,
      condensadorId: fd.condensadorId,
      ventiladorId: fd.ventiladorId,
      trompoId: fd.trompoId,
      instalacionId: fd.instalacionId,
      manoObra: fd.manoObra ?? false,
      notes: fd.notes ?? "",
    });
  };
  const saveWork = async () => {
    if (!workJob) return;
    const { error } = await supabase
      .from("active_jobs")
      .update({ form_data: workData as any } as any)
      .eq("id", workJob.id);
    if (error) return toast.error(error.message);
    toast.success("Trabajo guardado en el servicio");
    setWorkJob(null);
    load();
  };

  // Mapa categoría -> campo en form_data
  const CAT_TO_KEY: Record<string, keyof JobFormData> = {
    compresor: "compresorId",
    evaporador: "evaporadorId",
    condensador: "condensadorId",
    ventilador: "ventiladorId",
    trompo: "trompoId",
    instalacion: "instalacionId",
  };

  const openAssign = (s: Service) => {
    const key = CAT_TO_KEY[s.category];
    setAssignService(s);
    const sel: Record<string, boolean> = {};
    if (key) {
      for (const j of jobs) {
        const fd = (j.form_data ?? {}) as JobFormData;
        sel[j.id] = (fd as any)[key] === s.id;
      }
    }
    setAssignSel(sel);
  };

  const saveAssign = async () => {
    if (!assignService) return;
    const key = CAT_TO_KEY[assignService.category];
    if (!key) { toast.error("Esta categoría no se asigna directamente a placas"); return; }
    let changed = 0;
    for (const j of jobs) {
      const fd = { ...((j.form_data ?? {}) as JobFormData) };
      const wants = !!assignSel[j.id];
      const hasIt = (fd as any)[key] === assignService.id;
      if (wants && !hasIt) (fd as any)[key] = assignService.id;
      else if (!wants && hasIt) delete (fd as any)[key];
      else continue;
      const { error } = await supabase.from("active_jobs").update({ form_data: fd as any } as any).eq("id", j.id);
      if (error) { toast.error(error.message); return; }
      changed++;
    }
    if (!changed) { setAssignService(null); return; }
    toast.success("Producto asignado a las placas seleccionadas");
    setAssignService(null);
    load();
  };


  const openDelay = (j: Job) => {
    setDelayJob(j);
    setDelayMsg(j.delay_message ?? "");
    setDelayMins(j.estimated_minutes);
  };
  const saveDelay = async () => {
    if (!delayJob) return;
    if (!delayMsg.trim()) return toast.error("Escribe el mensaje para el cliente");
    await updateJob(delayJob.id, { delay_message: delayMsg.trim(), estimated_minutes: Number(delayMins) });
    toast.success("Mensaje enviado al cliente");
    setDelayJob(null);
  };
  const openCall = (j: Job) => { setCallJob(j); setCallBay(j.bay ?? "Bahía 1"); };
  const doCall = async () => {
    if (!callJob) return;
    await updateJob(callJob.id, { status: "llamado", bay: callBay, called_at: new Date().toISOString() });
    toast.success(`${callJob.plate} llamado a ${callBay} 🔔`);
    setCallJob(null);
  };

  return (
    <div className="grid gap-6">
      {/* ====== Placas activas ====== */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-3 flex items-center gap-2">
          <Car className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Placas activas en el tablero</h2>
          <span className="ml-auto text-xs text-muted-foreground">{jobs.length} en proceso</span>
        </div>

        {/* Form rápido */}
        <div className="border-b p-4 space-y-3 bg-muted/20">
          <div className="inline-flex rounded-md border bg-background p-1 text-xs">
            <button
              onClick={() => setNewPlate({ ...newPlate, kind: "vehiculo" })}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded ${newPlate.kind === "vehiculo" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"}`}
            >
              <Car className="h-3.5 w-3.5" /> Vehículo (placa)
            </button>
            <button
              onClick={() => setNewPlate({ ...newPlate, kind: "cliente" })}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded ${newPlate.kind === "cliente" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"}`}
            >
              <User className="h-3.5 w-3.5" /> Cliente / empresa (sin vehículo)
            </button>
          </div>
          <div className="grid sm:grid-cols-5 gap-2">
            {newPlate.kind === "vehiculo" ? (
              <input placeholder="Placa" value={newPlate.plate}
                onChange={(e) => setNewPlate({ ...newPlate, plate: e.target.value.toUpperCase() })}
                className="srv-input" />
            ) : (
              <input placeholder="Empresa / Persona" value={newPlate.customer}
                onChange={(e) => setNewPlate({ ...newPlate, customer: e.target.value })}
                className="srv-input" />
            )}
            <input placeholder={newPlate.kind === "vehiculo" ? "Cliente" : "Contacto (opcional)"} value={newPlate.kind === "vehiculo" ? newPlate.customer : ""}
              onChange={(e) => setNewPlate({ ...newPlate, customer: e.target.value })}
              className="srv-input"
              disabled={newPlate.kind === "cliente"} />
            <select value={newPlate.service_type}
              onChange={(e) => setNewPlate({ ...newPlate, service_type: e.target.value })}
              className="srv-input">
              <option value="revision">Revisión</option>
              <option value="instalacion">Instalación</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="garantia">Garantía</option>
              <option value="escaneo_fugas">Escaneo de fugas</option>
              <option value="producto">Solo producto</option>
            </select>
            <input type="number" placeholder="Minutos" value={newPlate.estimated_minutes}
              onChange={(e) => setNewPlate({ ...newPlate, estimated_minutes: Number(e.target.value) })}
              className="srv-input" />
            <button onClick={addPlate} className="rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
              <Plus className="inline h-4 w-4" /> Agregar
            </button>
          </div>
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
                    {j.status === "llamado" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">
                        <Megaphone className="h-3 w-3" /> Llamado · {j.bay}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="range" min={0} max={100} value={j.progress}
                      onChange={(e) => updateJob(j.id, { progress: Number(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-10 text-right">{j.progress}%</span>
                  </div>
                  {j.delay_message && (
                    <p className="mt-1 text-xs text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                      <AlertTriangle className="inline h-3 w-3 mr-1" /> {j.delay_message}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  <button onClick={() => openWork(j)} className="inline-flex items-center gap-1 rounded-md border-2 border-primary/40 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
                    <ClipboardList className="h-3.5 w-3.5" /> Trabajo
                    {j.form_data && Object.keys(j.form_data).length > 0 && (
                      <span className="ml-1 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    )}
                  </button>
                  <button onClick={() => openDelay(j)} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-amber-500/10 hover:border-amber-500/40 hover:text-amber-700">
                    <MessageSquare className="h-3.5 w-3.5" /> Demora / mensaje
                  </button>
                  <button onClick={() => openCall(j)} className="inline-flex items-center gap-1 rounded-md bg-destructive text-destructive-foreground px-2.5 py-1.5 text-xs font-semibold hover:bg-destructive/90">
                    <Megaphone className="h-3.5 w-3.5" /> Llamar cliente
                  </button>
                  <button onClick={() => goInvoice(j)} className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-2.5 py-1.5 text-xs font-semibold hover:bg-primary/90">
                    <Receipt className="h-3.5 w-3.5" /> Facturar
                  </button>
                  <button onClick={() => finishJob(j.id)} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Finalizar
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* ====== Modal demora ====== */}
      {delayJob && (
        <Modal onClose={() => setDelayJob(null)} title={`Mensaje de demora · ${delayJob.plate}`}>
          <p className="text-sm text-muted-foreground mb-3">
            Explícale al cliente por qué su servicio se va a demorar más. El mensaje aparecerá en la pantalla pública junto a su placa.
          </p>
          <label className="block mb-3">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Nuevo tiempo estimado (min)</span>
            <input type="number" value={delayMins} onChange={(e) => setDelayMins(Number(e.target.value))} className="srv-input mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Mensaje para el cliente</span>
            <textarea value={delayMsg} onChange={(e) => setDelayMsg(e.target.value)} rows={4} className="srv-input mt-1"
              placeholder="Ej: Se identificó una fuga adicional en el evaporador, se requieren 20 min más para sellar." />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setDelayJob(null)} className="rounded-md border px-3 py-1.5 text-sm">Cancelar</button>
            <button onClick={saveDelay} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold hover:bg-primary/90">
              Publicar mensaje
            </button>
          </div>
        </Modal>
      )}

      {/* ====== Modal llamar ====== */}
      {callJob && (
        <Modal onClose={() => setCallJob(null)} title={`Llamar a ${callJob.plate}`}>
          <p className="text-sm text-muted-foreground mb-3">
            Selecciona la ubicación. Se activará una alarma con sonido tipo EPS en la pantalla del cliente.
          </p>

          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Bahías</p>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((n) => {
                const label = `Bahía ${n}`;
                const active = callBay === label;
                return (
                  <button
                    key={label}
                    onClick={() => setCallBay(label)}
                    className={`rounded-lg border-2 px-2 py-3 text-sm font-bold transition ${
                      active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Cajas</p>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((n) => {
                const label = `Caja ${n}`;
                const active = callBay === label;
                return (
                  <button
                    key={label}
                    onClick={() => setCallBay(label)}
                    className={`rounded-lg border-2 px-2 py-3 text-sm font-bold transition ${
                      active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground mb-3">
            Llamar a: <span className="font-bold text-foreground">{callBay}</span>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setCallJob(null)} className="rounded-md border px-3 py-1.5 text-sm">Cancelar</button>
            <button onClick={doCall} className="rounded-md bg-destructive text-destructive-foreground px-3 py-1.5 text-sm font-semibold hover:bg-destructive/90">
              🔔 Llamar ahora
            </button>
          </div>
        </Modal>
      )}

      {/* ====== Modal Configurar Trabajo (form de trabajo ligado al servicio) ====== */}
      {workJob && (
        <Modal onClose={() => setWorkJob(null)} title={`Trabajo realizado · ${workJob.plate}${workJob.customer ? " · " + workJob.customer : ""}`}>
          <p className="text-sm text-muted-foreground mb-3">
            Selecciona los productos instalados y el proceso. Esto se llevará a la factura cuando presiones <b>Facturar</b>.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Proceso</span>
              <select className="srv-input mt-1" value={workData.proceso ?? ""} onChange={(e) => setWorkData({ ...workData, proceso: (e.target.value || undefined) as ProcesoTipo | undefined })}>
                <option value="">—</option>
                {(Object.keys(PROCESO_LABELS) as ProcesoTipo[]).map((k) => <option key={k} value={k}>{PROCESO_LABELS[k]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Valor del proceso (COP)</span>
              <input type="number" className="srv-input mt-1" value={workData.procesoValor ?? 0} onChange={(e) => setWorkData({ ...workData, procesoValor: Number(e.target.value) })} />
            </label>
          </div>

          <div className="space-y-2 max-h-[40vh] overflow-auto pr-1">
            {([
              ["compresorId", "compresor", "Compresor"],
              ["evaporadorId", "evaporador", "Evaporador"],
              ["condensadorId", "condensador", "Condensador"],
              ["ventiladorId", "ventilador", "Ventilador"],
              ["trompoId", "trompo", "Trompo"],
              ["instalacionId", "instalacion", "Instalación eléctrica"],
            ] as const).map(([key, cat, label]) => {
              const opts = items.filter((i) => i.category === cat);
              return (
                <label key={key} className="block">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span>
                  <select
                    className="srv-input mt-1"
                    value={(workData as any)[key] ?? ""}
                    onChange={(e) => setWorkData({ ...workData, [key]: e.target.value || undefined } as JobFormData)}
                  >
                    <option value="">— No incluir —</option>
                    {opts.map((o) => (
                      <option key={o.id} value={o.id}>{o.name} — ${Number(o.price).toLocaleString("es-CO")}</option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!workData.manoObra} onChange={(e) => setWorkData({ ...workData, manoObra: e.target.checked })} />
            Incluir mano de obra
          </label>

          <label className="block mt-3">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Notas</span>
            <textarea className="srv-input mt-1" rows={2} value={workData.notes ?? ""} onChange={(e) => setWorkData({ ...workData, notes: e.target.value })} />
          </label>

          <div className="mt-4 flex justify-between gap-2">
            <button
              onClick={async () => { await saveWork(); if (workJob) goInvoice({ ...workJob, form_data: workData }); }}
              className="rounded-md border-2 border-primary text-primary px-3 py-1.5 text-sm font-semibold hover:bg-primary/10"
            >
              Guardar e ir a Factura
            </button>
            <div className="flex gap-2">
              <button onClick={() => setWorkJob(null)} className="rounded-md border px-3 py-1.5 text-sm">Cancelar</button>
              <button onClick={saveWork} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold hover:bg-primary/90">Guardar</button>
            </div>
          </div>
        </Modal>
      )}



      {/* ====== Modal asignar producto del catálogo a placas activas ====== */}
      {assignService && (
        <Modal onClose={() => setAssignService(null)} title={`Asignar a placa · ${assignService.name}`}>
          <p className="text-sm text-muted-foreground mb-3">
            Marca las placas activas a las que se les instaló o utilizó este {assignService.category}. Se guardará en el trabajo y aparecerá en la factura.
          </p>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No hay placas activas en el tablero.</p>
          ) : (
            <div className="space-y-1.5 max-h-[50vh] overflow-auto">
              {jobs.map((j) => (
                <label key={j.id} className="flex items-center gap-3 rounded-md border p-2 cursor-pointer hover:bg-accent">
                  <input type="checkbox" checked={!!assignSel[j.id]} onChange={(e) => setAssignSel({ ...assignSel, [j.id]: e.target.checked })} />
                  <span className="rounded border-2 border-foreground bg-yellow-300 px-2 py-0.5 font-mono text-xs font-black text-black">{j.plate}</span>
                  <span className="text-sm flex-1 truncate">
                    {j.service_name ?? j.service_type}
                    {j.customer && <span className="text-muted-foreground"> · {j.customer}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setAssignService(null)} className="rounded-md border px-3 py-1.5 text-sm">Cancelar</button>
            <button onClick={saveAssign} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold hover:bg-primary/90">Guardar asignación</button>
          </div>
        </Modal>
      )}


      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="border-b px-5 py-3 flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Catálogo de servicios</h2>
          <span className="ml-auto text-xs text-muted-foreground">{items.length} ítems</span>
        </div>
        {loading ? <p className="p-5 text-sm text-muted-foreground">Cargando…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Categoría</th>
                  <th className="px-4 py-2 text-left">Nombre</th>
                  <th className="px-4 py-2 text-right">Precio</th>
                  <th className="px-4 py-2 text-right">Tiempo</th>
                  <th className="px-4 py-2 text-left">Usado en</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((s) => {
                  const ed = editing[s.id];
                  const usage = usageByService[s.id] ?? [];
                  if (ed) {
                    return (
                      <tr key={s.id} className="bg-primary/5">
                        <td className="px-4 py-2"><select value={ed.category} onChange={(e) => setEditing({ ...editing, [s.id]: { ...ed, category: e.target.value } })} className="srv-input">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></td>
                        <td className="px-4 py-2"><input value={ed.name ?? ""} onChange={(e) => setEditing({ ...editing, [s.id]: { ...ed, name: e.target.value } })} className="srv-input" /></td>
                        <td className="px-4 py-2"><input type="number" value={ed.price ?? 0} onChange={(e) => setEditing({ ...editing, [s.id]: { ...ed, price: Number(e.target.value) } })} className="srv-input text-right" /></td>
                        <td className="px-4 py-2"><input type="number" value={ed.delivery_minutes ?? 30} onChange={(e) => setEditing({ ...editing, [s.id]: { ...ed, delivery_minutes: Number(e.target.value) } })} className="srv-input text-right" /></td>
                        <td className="px-4 py-2" />
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => saveEdit(s.id)} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Save className="h-4 w-4" /></button>
                            <button onClick={() => cancelEdit(s.id)} className="p-1.5 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-2 text-xs uppercase text-muted-foreground">{s.category}</td>
                      <td className="px-4 py-2 font-medium">{s.name}</td>
                      <td className="px-4 py-2 text-right font-mono">${Number(s.price).toLocaleString("es-CO")}</td>
                      <td className="px-4 py-2 text-right"><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {s.delivery_minutes} min</span></td>
                      <td className="px-4 py-2">
                        {usage.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {usage.map((u, i) => (
                              <span key={i} className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold">
                                <span className="font-mono">{u.plate}</span>
                                {u.customer && <span className="text-muted-foreground">· {u.customer}</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          {CAT_TO_KEY[s.category] && (
                            <button onClick={() => openAssign(s)} title="Asignar a placa activa" className="inline-flex items-center gap-1 rounded-md border-2 border-primary/40 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10">
                              <ClipboardList className="h-3.5 w-3.5" /> Trabajo
                            </button>
                          )}
                          <button onClick={() => startEdit(s)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => remove(s.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">Aún no hay servicios.</td></tr>}

              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .srv-input { width:100%; border:1px solid var(--border); border-radius:0.5rem; padding:0.45rem 0.65rem; font-size:0.875rem; background:var(--background); color:var(--foreground); }
        .srv-input:focus { outline:none; border-color:var(--primary); }
      `}</style>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-5 py-3 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
