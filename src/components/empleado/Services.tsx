import { useEffect, useState } from "react";
import { Settings, Plus, Trash2, Save, Pencil, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Service = {
  id: string;
  category: string;
  name: string;
  price: number;
  delivery_minutes: number;
};

const CATEGORIES = [
  "compresor",
  "evaporador",
  "condensador",
  "ventilador",
  "trompo",
  "instalacion",
  "otro",
];

export default function Services() {
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, Partial<Service>>>({});
  const [creating, setCreating] = useState<Partial<Service>>({
    category: "compresor",
    name: "",
    price: 0,
    delivery_minutes: 30,
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("service_prices")
      .select("*")
      .order("category")
      .order("name");
    setItems((data as Service[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (s: Service) =>
    setEditing((e) => ({ ...e, [s.id]: { ...s } }));
  const cancelEdit = (id: string) =>
    setEditing((e) => {
      const c = { ...e };
      delete c[id];
      return c;
    });

  const saveEdit = async (id: string) => {
    const patch = editing[id];
    if (!patch) return;
    const { error } = await supabase
      .from("service_prices")
      .update({
        name: patch.name,
        category: patch.category,
        price: Number(patch.price),
        delivery_minutes: Number(patch.delivery_minutes),
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Servicio actualizado");
    cancelEdit(id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este servicio?")) return;
    const { error } = await supabase.from("service_prices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    load();
  };

  const create = async () => {
    if (!creating.name || !creating.category) {
      toast.error("Nombre y categoría son obligatorios");
      return;
    }
    const { error } = await supabase.from("service_prices").insert({
      name: creating.name,
      category: creating.category,
      price: Number(creating.price ?? 0),
      delivery_minutes: Number(creating.delivery_minutes ?? 30),
    });
    if (error) return toast.error(error.message);
    toast.success("Servicio creado");
    setCreating({ category: "compresor", name: "", price: 0, delivery_minutes: 30 });
    load();
  };

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Agregar nuevo servicio</h2>
        </div>
        <div className="p-5 grid sm:grid-cols-5 gap-3">
          <select
            value={creating.category}
            onChange={(e) => setCreating({ ...creating, category: e.target.value })}
            className="srv-input"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            placeholder="Nombre del servicio"
            value={creating.name ?? ""}
            onChange={(e) => setCreating({ ...creating, name: e.target.value })}
            className="srv-input sm:col-span-2"
          />
          <input
            type="number"
            placeholder="Precio"
            value={creating.price ?? 0}
            onChange={(e) => setCreating({ ...creating, price: Number(e.target.value) })}
            className="srv-input"
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min."
              value={creating.delivery_minutes ?? 30}
              onChange={(e) => setCreating({ ...creating, delivery_minutes: Number(e.target.value) })}
              className="srv-input"
            />
            <button
              onClick={create}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="border-b px-5 py-3 flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Catálogo de servicios</h2>
          <span className="ml-auto text-xs text-muted-foreground">{items.length} ítems</span>
        </div>

        {loading ? (
          <p className="p-5 text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Categoría</th>
                  <th className="px-4 py-2 text-left">Nombre</th>
                  <th className="px-4 py-2 text-right">Precio</th>
                  <th className="px-4 py-2 text-right">Tiempo entrega</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((s) => {
                  const ed = editing[s.id];
                  if (ed) {
                    return (
                      <tr key={s.id} className="bg-primary/5">
                        <td className="px-4 py-2">
                          <select
                            value={ed.category}
                            onChange={(e) => setEditing({ ...editing, [s.id]: { ...ed, category: e.target.value } })}
                            className="srv-input"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            value={ed.name ?? ""}
                            onChange={(e) => setEditing({ ...editing, [s.id]: { ...ed, name: e.target.value } })}
                            className="srv-input"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={ed.price ?? 0}
                            onChange={(e) => setEditing({ ...editing, [s.id]: { ...ed, price: Number(e.target.value) } })}
                            className="srv-input text-right"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={ed.delivery_minutes ?? 30}
                            onChange={(e) => setEditing({ ...editing, [s.id]: { ...ed, delivery_minutes: Number(e.target.value) } })}
                            className="srv-input text-right"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => saveEdit(s.id)} className="p-1.5 rounded hover:bg-primary/10 text-primary">
                              <Save className="h-4 w-4" />
                            </button>
                            <button onClick={() => cancelEdit(s.id)} className="p-1.5 rounded hover:bg-muted">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-2 text-xs uppercase text-muted-foreground">{s.category}</td>
                      <td className="px-4 py-2 font-medium">{s.name}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        ${Number(s.price).toLocaleString("es-CO")}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> {s.delivery_minutes} min
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => startEdit(s)} className="p-1.5 rounded hover:bg-muted">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => remove(s.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Aún no hay servicios. Agrega uno arriba.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .srv-input {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 0.45rem 0.65rem;
          font-size: 0.875rem;
          background: var(--background);
          color: var(--foreground);
        }
        .srv-input:focus { outline: none; border-color: var(--primary); }
      `}</style>
    </div>
  );
}
