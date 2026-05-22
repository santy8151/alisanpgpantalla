import { useEffect, useRef, useState } from "react";
import { Settings, Plus, Trash2, Save, Pencil, X, Clock, Package, Image as ImageIcon, Upload, LayoutGrid, List, FileSpreadsheet, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { productImageFor } from "@/lib/productImages";

type Service = {
  id: string;
  category: string;
  name: string;
  price: number;
  delivery_minutes: number;
  image_url?: string | null;
};

const CATEGORIES = [
  "compresor","evaporador","condensador","ventilador","trompo",
  "instalacion","mantenimiento","garantia","escaneo_fugas",
  "producto","servicio","otro",
];

export default function CatalogManager() {
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, Partial<Service>>>({});
  const [creating, setCreating] = useState<Partial<Service>>({ category: "producto", name: "", price: 0, delivery_minutes: 30, image_url: "" });
  const [filter, setFilter] = useState<string>("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [uploading, setUploading] = useState<string | null>(null);
  const fileCreateRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("service_prices").select("*").order("category").order("name");
    setItems((data as Service[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const { error } = await supabase.storage.from("service-images").upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); return null; }
    const { data } = supabase.storage.from("service-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCreateFile = async (f: File) => {
    setUploading("new");
    const url = await uploadImage(f);
    setUploading(null);
    if (url) setCreating((c) => ({ ...c, image_url: url }));
  };

  const handleEditFile = async (id: string, f: File) => {
    setUploading(id);
    const url = await uploadImage(f);
    setUploading(null);
    if (url) setEditing((e) => ({ ...e, [id]: { ...(e[id] ?? {}), image_url: url } }));
  };

  const startEdit = (s: Service) => setEditing((e) => ({ ...e, [s.id]: { ...s } }));
  const cancelEdit = (id: string) => setEditing((e) => { const c = { ...e }; delete c[id]; return c; });
  const saveEdit = async (id: string) => {
    const patch = editing[id]; if (!patch) return;
    const { error } = await supabase.from("service_prices").update({
      name: patch.name, category: patch.category, price: Number(patch.price),
      delivery_minutes: Number(patch.delivery_minutes ?? 30),
      image_url: patch.image_url ?? null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Actualizado"); cancelEdit(id); load();
  };
  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este ítem?")) return;
    const { error } = await supabase.from("service_prices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado"); load();
  };
  const create = async () => {
    if (!creating.name || !creating.category) return toast.error("Nombre y categoría obligatorios");
    const { error } = await supabase.from("service_prices").insert({
      name: creating.name,
      category: creating.category,
      price: Number(creating.price ?? 0),
      delivery_minutes: Number(creating.delivery_minutes ?? 30),
      image_url: creating.image_url || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Creado");
    setCreating({ category: "producto", name: "", price: 0, delivery_minutes: 30, image_url: "" });
    load();
  };

  // --- Importación CSV estilo Siigo ---
  const csvRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  const parseCSV = (text: string): Record<string, string>[] => {
    // separa por líneas y detecta delimitador (, ; o tab)
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
    if (!lines.length) return [];
    const first = lines[0];
    const delim = first.includes(";") ? ";" : first.includes("\t") ? "\t" : ",";
    const splitLine = (line: string) => {
      const out: string[] = [];
      let cur = ""; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === delim && !inQ) { out.push(cur); cur = ""; continue; }
        cur += ch;
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };
    const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
    return lines.slice(1).map((l) => {
      const cells = splitLine(l);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
      return row;
    });
  };

  const pick = (row: Record<string, string>, keys: string[]) => {
    for (const k of keys) {
      const found = Object.keys(row).find((h) => h === k || h.includes(k));
      if (found && row[found]) return row[found];
    }
    return "";
  };

  const handleCsvImport = async (file: File) => {
    setImporting(true); setImportReport(null);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) { toast.error("CSV vacío o sin encabezados"); setImporting(false); return; }

      const { data: existing } = await supabase.from("service_prices").select("id,name,image_url");
      const byName = new Map((existing ?? []).map((r: any) => [String(r.name).trim().toLowerCase(), r]));

      let created = 0, updated = 0, skipped = 0;
      for (const r of rows) {
        const name = pick(r, ["nombre", "name", "producto", "descripcion", "descripción", "item"]);
        const priceStr = pick(r, ["precio", "valor", "price", "precio de venta", "precio unitario"]);
        const category = (pick(r, ["categoria", "categoría", "tipo", "grupo"]) || "producto").toLowerCase();
        const minStr = pick(r, ["minutos", "tiempo", "delivery", "min"]);
        if (!name) { skipped++; continue; }
        const price = Number(String(priceStr).replace(/[^\d.-]/g, "")) || 0;
        const delivery_minutes = Number(minStr) || 30;
        const finalCat = CATEGORIES.includes(category) ? category : "producto";
        const match = byName.get(name.trim().toLowerCase());
        if (match) {
          const { error } = await supabase.from("service_prices")
            .update({ price, category: finalCat, delivery_minutes }).eq("id", (match as any).id);
          if (error) skipped++; else updated++;
        } else {
          const { error } = await supabase.from("service_prices")
            .insert({ name: name.trim(), category: finalCat, price, delivery_minutes });
          if (error) skipped++; else created++;
        }
      }
      setImportReport({ created, updated, skipped });
      toast.success(`Importación: ${created} nuevos · ${updated} actualizados · ${skipped} omitidos`);
      load();
    } catch (e: any) {
      toast.error("Error leyendo CSV: " + (e?.message ?? e));
    } finally {
      setImporting(false);
      if (csvRef.current) csvRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const csv = "nombre,categoria,precio,minutos\nCompresor Copeland 1HP,compresor,850000,60\nMantenimiento básico AC,mantenimiento,120000,45\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "plantilla-catalogo.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = filter ? items.filter((i) => i.category === filter) : items;
  const imgFor = (s: Pick<Service,"category"|"image_url">) => s.image_url || productImageFor(s.category);

  return (
    <div className="grid gap-6">
      {/* Form crear */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Agregar producto o servicio</h2>
        </div>
        <div className="p-5 grid sm:grid-cols-7 gap-3 items-end">
          <div className="sm:col-span-1">
            <div className="relative h-24 w-full rounded-lg border-2 border-dashed bg-muted/30 overflow-hidden flex items-center justify-center">
              {creating.image_url ? (
                <img src={creating.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
              <button
                type="button"
                onClick={() => fileCreateRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 text-white opacity-0 hover:opacity-100 transition text-xs font-semibold"
              >
                <Upload className="h-4 w-4 mr-1" /> {uploading === "new" ? "Subiendo…" : "Subir"}
              </button>
              <input ref={fileCreateRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleCreateFile(e.target.files[0])} />
            </div>
          </div>
          <select value={creating.category} onChange={(e) => setCreating({ ...creating, category: e.target.value })} className="cm-input">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="Nombre" value={creating.name ?? ""} onChange={(e) => setCreating({ ...creating, name: e.target.value })} className="cm-input sm:col-span-2" />
          <input type="number" placeholder="Precio" value={creating.price ?? 0} onChange={(e) => setCreating({ ...creating, price: Number(e.target.value) })} className="cm-input" />
          <input type="number" placeholder="Min." value={creating.delivery_minutes ?? 30} onChange={(e) => setCreating({ ...creating, delivery_minutes: Number(e.target.value) })} className="cm-input" />
          <button onClick={create} className="rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 px-3 py-2">
            <Plus className="inline h-4 w-4 mr-1" /> Agregar
          </button>
        </div>
      </div>

      {/* Importar CSV estilo Siigo */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-3 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          <h2 className="font-semibold">Importar catálogo desde Siigo (CSV)</h2>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground">
            Sube el archivo CSV exportado desde Siigo (o cualquier CSV con columnas <b>nombre</b>, <b>precio</b>, opcional <b>categoria</b> y <b>minutos</b>).
            Los productos existentes se <b>actualizan por nombre</b> manteniendo sus imágenes; los nuevos se crean. Las imágenes se siguen
            subiendo/editando manualmente desde las tarjetas.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => csvRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 text-white text-sm font-semibold px-4 py-2 hover:bg-emerald-700 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" /> {importing ? "Importando…" : "Subir archivo CSV"}
            </button>
            <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleCsvImport(e.target.files[0])} />
            <button onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-md border text-sm px-3 py-2 hover:bg-accent">
              <Download className="h-4 w-4" /> Descargar plantilla
            </button>
            {importReport && (
              <span className="text-xs text-muted-foreground">
                ✓ <b className="text-emerald-600">{importReport.created}</b> nuevos · <b className="text-primary">{importReport.updated}</b> actualizados · <b>{importReport.skipped}</b> omitidos
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Listado */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="border-b px-5 py-3 flex items-center gap-3 flex-wrap">
          <Settings className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Catálogo</h2>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-md border overflow-hidden">
              <button onClick={() => setView("cards")} className={`px-2 py-1 text-xs flex items-center gap-1 ${view==="cards"?"bg-primary text-primary-foreground":""}`}><LayoutGrid className="h-3 w-3"/>Tarjetas</button>
              <button onClick={() => setView("table")} className={`px-2 py-1 text-xs flex items-center gap-1 ${view==="table"?"bg-primary text-primary-foreground":""}`}><List className="h-3 w-3"/>Tabla</button>
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="cm-input !w-auto text-xs">
              <option value="">Todas las categorías</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-xs text-muted-foreground">{filtered.length} ítems</span>
          </div>
        </div>

        {loading ? <p className="p-5 text-sm text-muted-foreground">Cargando…</p> : view === "cards" ? (
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((s) => {
              const ed = editing[s.id];
              if (ed) {
                return (
                  <div key={s.id} className="rounded-xl border-2 border-primary bg-card overflow-hidden flex flex-col">
                    <div className="relative aspect-square bg-muted">
                      <img src={ed.image_url || imgFor(s)} alt="" className="h-full w-full object-cover" />
                      <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs font-semibold cursor-pointer">
                        <Upload className="h-4 w-4 mr-1" /> {uploading===s.id?"Subiendo…":"Cambiar"}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleEditFile(s.id, e.target.files[0])} />
                      </label>
                    </div>
                    <div className="p-3 space-y-1.5">
                      <select value={ed.category} onChange={(e) => setEditing({ ...editing, [s.id]: { ...ed, category: e.target.value } })} className="cm-input text-xs">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                      <input value={ed.name ?? ""} onChange={(e) => setEditing({ ...editing, [s.id]: { ...ed, name: e.target.value } })} className="cm-input text-xs" />
                      <div className="flex gap-1">
                        <input type="number" value={ed.price ?? 0} onChange={(e) => setEditing({ ...editing, [s.id]: { ...ed, price: Number(e.target.value) } })} className="cm-input text-xs" placeholder="Precio" />
                        <input type="number" value={ed.delivery_minutes ?? 30} onChange={(e) => setEditing({ ...editing, [s.id]: { ...ed, delivery_minutes: Number(e.target.value) } })} className="cm-input text-xs w-16" placeholder="Min" />
                      </div>
                      <div className="flex gap-1 pt-1">
                        <button onClick={() => saveEdit(s.id)} className="flex-1 rounded bg-primary text-primary-foreground text-xs font-semibold py-1.5"><Save className="inline h-3 w-3 mr-1"/>Guardar</button>
                        <button onClick={() => cancelEdit(s.id)} className="rounded bg-muted text-xs py-1.5 px-2"><X className="h-3 w-3"/></button>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={s.id} className="group rounded-xl border bg-card overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition">
                  <div className="relative aspect-square bg-muted overflow-hidden">
                    <img src={imgFor(s)} alt={s.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <span className="absolute top-2 left-2 rounded-full bg-background/90 backdrop-blur px-2 py-0.5 text-[10px] font-bold uppercase">{s.category}</span>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => startEdit(s)} className="p-1.5 rounded-full bg-background/90 hover:bg-primary hover:text-primary-foreground"><Pencil className="h-3.5 w-3.5"/></button>
                      <button onClick={() => remove(s.id)} className="p-1.5 rounded-full bg-background/90 hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="h-3.5 w-3.5"/></button>
                    </div>
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <p className="font-semibold text-sm leading-tight line-clamp-2 mb-1">{s.name}</p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="font-mono font-bold text-primary">${Number(s.price).toLocaleString("es-CO")}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="h-3 w-3"/>{s.delivery_minutes}m</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <p className="col-span-full text-center py-8 text-sm text-muted-foreground">No hay ítems en esta categoría.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Imagen</th>
                  <th className="px-4 py-2 text-left">Categoría</th>
                  <th className="px-4 py-2 text-left">Nombre</th>
                  <th className="px-4 py-2 text-right">Precio</th>
                  <th className="px-4 py-2 text-right">Tiempo</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2"><img src={imgFor(s)} alt="" className="h-10 w-10 rounded object-cover"/></td>
                    <td className="px-4 py-2 text-xs uppercase text-muted-foreground"><span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{s.category}</span></td>
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-right font-mono">${Number(s.price).toLocaleString("es-CO")}</td>
                    <td className="px-4 py-2 text-right"><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{s.delivery_minutes} min</span></td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => startEdit(s)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(s.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No hay ítems.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .cm-input { width:100%; border:1px solid var(--border); border-radius:0.5rem; padding:0.45rem 0.65rem; font-size:0.875rem; background:var(--background); color:var(--foreground); }
        .cm-input:focus { outline:none; border-color:var(--primary); }
      `}</style>
    </div>
  );
}
