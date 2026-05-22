import { useEffect, useMemo, useState } from "react";
import { Users, Receipt, Car, Pencil, Save, X, Trash2, Search, RefreshCw, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type InvoiceRow = {
  id: string;
  invoice_no: string;
  customer: string | null;
  legal_name: string | null;
  doc_id: string | null;
  plate: string | null;
  proceso: string | null;
  total: number;
  created_at: string;
};

type Job = {
  id: string;
  plate: string;
  customer: string | null;
  service_type: string;
  service_name: string | null;
  status: string;
  estimated_minutes: number;
  progress: number;
  created_at: string;
};

const fmt = (n: number) => "$" + Number(n || 0).toLocaleString("es-CO");

export default function CustomerDashboard() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Record<string, Partial<Job>>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: inv }, { data: js }] = await Promise.all([
      supabase.from("invoices").select("id,invoice_no,customer,legal_name,doc_id,plate,proceso,total,created_at").order("created_at", { ascending: false }),
      supabase.from("active_jobs").select("*").order("created_at", { ascending: false }),
    ]);
    setInvoices((inv as InvoiceRow[]) ?? []);
    setJobs((js as Job[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Agregar clientes desde facturas
  const clients = useMemo(() => {
    const map = new Map<string, { key: string; name: string; doc: string; plates: Set<string>; invoices: number; total: number; last: string }>();
    invoices.forEach((r) => {
      const name = r.legal_name || r.customer || "Consumidor final";
      const key = (r.doc_id || name).toLowerCase();
      if (!map.has(key)) map.set(key, { key, name, doc: r.doc_id || "—", plates: new Set(), invoices: 0, total: 0, last: r.created_at });
      const c = map.get(key)!;
      if (r.plate) c.plates.add(r.plate);
      c.invoices += 1;
      c.total += Number(r.total || 0);
      if (r.created_at > c.last) c.last = r.created_at;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [invoices]);

  const filtered = useMemo(() => {
    if (!q.trim()) return clients;
    const s = q.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(s) || c.doc.toLowerCase().includes(s) || Array.from(c.plates).some((p) => p.toLowerCase().includes(s)));
  }, [clients, q]);

  const finalized = jobs.filter((j) => j.status === "finalizado");
  const active = jobs.filter((j) => j.status !== "finalizado");

  const totalIngresos = invoices.reduce((s, r) => s + Number(r.total || 0), 0);

  const startEdit = (j: Job) => setEditing((e) => ({ ...e, [j.id]: { ...j } }));
  const cancelEdit = (id: string) => setEditing((e) => { const c = { ...e }; delete c[id]; return c; });
  const saveEdit = async (id: string) => {
    const p = editing[id]; if (!p) return;
    const { error } = await supabase.from("active_jobs").update({
      plate: p.plate,
      customer: p.customer ?? null,
      service_type: p.service_type,
      service_name: p.service_name ?? null,
      estimated_minutes: Number(p.estimated_minutes ?? 30),
      status: p.status,
      progress: Number(p.progress ?? 100),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Servicio actualizado"); cancelEdit(id); load();
  };
  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este servicio del histórico?")) return;
    const { error } = await supabase.from("active_jobs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado"); load();
  };
  const reopen = async (id: string) => {
    await supabase.from("active_jobs").update({ status: "en_proceso", progress: 50 }).eq("id", id);
    toast.success("Servicio reabierto");
    load();
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid sm:grid-cols-4 gap-3">
        <Kpi icon={<Users className="h-5 w-5" />} label="Clientes" value={clients.length.toString()} />
        <Kpi icon={<Receipt className="h-5 w-5" />} label="Facturas" value={invoices.length.toString()} />
        <Kpi icon={<Car className="h-5 w-5" />} label="Servicios activos" value={active.length.toString()} />
        <Kpi icon={<CheckCircle2 className="h-5 w-5" />} label="Ingresos totales" value={fmt(totalIngresos)} />
      </div>

      {/* Clientes */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Clientes</h2>
          <span className="text-xs text-muted-foreground">{filtered.length}</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, NIT, placa…"
                className="pl-7 pr-2 py-1.5 text-sm border rounded-md bg-background w-64" />
            </div>
            <button onClick={load} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent">
              <RefreshCw className="h-3.5 w-3.5" /> Refrescar
            </button>
          </div>
        </div>
        {loading ? <p className="p-5 text-sm text-muted-foreground">Cargando…</p> : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Aún no hay clientes facturados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Placas</th>
                  <th className="px-3 py-2 text-right">Facturas</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-left">Última visita</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((c) => (
                  <tr key={c.key} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-semibold">{c.name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{c.doc}</td>
                    <td className="px-3 py-2 font-mono text-xs">{Array.from(c.plates).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-right">{c.invoices}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(c.total)}</td>
                    <td className="px-3 py-2 text-xs">{new Date(c.last).toLocaleDateString("es-CO")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Servicios — editar (incluye finalizados) */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-3 flex items-center gap-2">
          <Pencil className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Editar servicios realizados</h2>
          <span className="text-xs text-muted-foreground">{finalized.length} finalizados · {active.length} activos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Placa</th>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Servicio</th>
                <th className="px-3 py-2 text-right">Min</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((j) => {
                const ed = editing[j.id];
                if (ed) {
                  return (
                    <tr key={j.id} className="bg-primary/5">
                      <td className="px-3 py-2"><input className="srv-in" value={ed.plate ?? ""} onChange={(e) => setEditing({ ...editing, [j.id]: { ...ed, plate: e.target.value.toUpperCase() } })} /></td>
                      <td className="px-3 py-2"><input className="srv-in" value={ed.customer ?? ""} onChange={(e) => setEditing({ ...editing, [j.id]: { ...ed, customer: e.target.value } })} /></td>
                      <td className="px-3 py-2">
                        <select className="srv-in" value={ed.service_type} onChange={(e) => setEditing({ ...editing, [j.id]: { ...ed, service_type: e.target.value } })}>
                          <option value="revision">Revisión</option>
                          <option value="instalacion">Instalación</option>
                          <option value="mantenimiento">Mantenimiento</option>
                          <option value="garantia">Garantía</option>
                          <option value="escaneo_fugas">Escaneo de fugas</option>
                          <option value="producto">Producto</option>
                        </select>
                      </td>
                      <td className="px-3 py-2"><input className="srv-in" value={ed.service_name ?? ""} onChange={(e) => setEditing({ ...editing, [j.id]: { ...ed, service_name: e.target.value } })} /></td>
                      <td className="px-3 py-2"><input type="number" className="srv-in text-right" value={ed.estimated_minutes ?? 0} onChange={(e) => setEditing({ ...editing, [j.id]: { ...ed, estimated_minutes: Number(e.target.value) } })} /></td>
                      <td className="px-3 py-2">
                        <select className="srv-in" value={ed.status} onChange={(e) => setEditing({ ...editing, [j.id]: { ...ed, status: e.target.value } })}>
                          <option value="en_proceso">En proceso</option>
                          <option value="llamado">Llamado</option>
                          <option value="finalizado">Finalizado</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-xs">{new Date(j.created_at).toLocaleDateString("es-CO")}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => saveEdit(j.id)} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Save className="h-4 w-4" /></button>
                          <button onClick={() => cancelEdit(j.id)} className="p-1.5 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                const isFin = j.status === "finalizado";
                return (
                  <tr key={j.id} className={isFin ? "opacity-80" : ""}>
                    <td className="px-3 py-2 font-mono font-bold">{j.plate}</td>
                    <td className="px-3 py-2">{j.customer || "—"}</td>
                    <td className="px-3 py-2 text-xs uppercase text-muted-foreground">{j.service_type}</td>
                    <td className="px-3 py-2">{j.service_name || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{j.estimated_minutes}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        j.status === "finalizado" ? "bg-emerald-500/15 text-emerald-700" :
                        j.status === "llamado" ? "bg-destructive/15 text-destructive" : "bg-blue-500/15 text-blue-700"
                      }`}>{j.status}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">{new Date(j.created_at).toLocaleDateString("es-CO")}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {isFin && (
                          <button onClick={() => reopen(j.id)} className="p-1.5 rounded hover:bg-blue-500/10 text-blue-700" title="Reabrir"><RefreshCw className="h-4 w-4" /></button>
                        )}
                        <button onClick={() => startEdit(j)} className="p-1.5 rounded hover:bg-muted" title="Editar"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(j.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {jobs.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">Aún no hay servicios registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .srv-in { width:100%; border:1px solid var(--border); border-radius:0.5rem; padding:0.35rem 0.55rem; font-size:0.8rem; background:var(--background); color:var(--foreground); }
        .srv-in:focus { outline:none; border-color:var(--primary); }
      `}</style>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div>
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}
