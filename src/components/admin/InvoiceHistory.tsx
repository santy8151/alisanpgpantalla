import { useEffect, useState } from "react";
import { FileSpreadsheet, Download, FlaskConical, Receipt, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadSiigoInvoice, SAMPLE_AC_INVOICE, type SiigoInvoice, type SiigoItem } from "@/lib/siigoExport";
import * as XLSX from "xlsx";

type InvoiceRow = {
  id: string;
  invoice_no: string;
  customer: string | null;
  legal_name: string | null;
  doc_id: string | null;
  person_type: string | null;
  invoice_mode: string | null;
  email: string | null;
  plate: string | null;
  proceso: string | null;
  proceso_valor: number;
  items: any[];
  subtotal: number;
  iva: number;
  total: number;
  notes: string | null;
  created_at: string;
};

const fmt = (n: number) => "$" + Number(n).toLocaleString("es-CO");

export default function InvoiceHistory() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as InvoiceRow[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toSiigo = (r: InvoiceRow): SiigoInvoice => {
    const items: SiigoItem[] = (r.items ?? []).map((i: any, idx: number) => ({
      codigo: i.code ?? `ITM-${String(idx + 1).padStart(3, "0")}`,
      descripcion: i.name ?? i.descripcion ?? "Ítem",
      cantidad: Number(i.qty ?? 1),
      valor_unitario: Number(i.price ?? 0),
      iva: 19,
    }));
    if (r.proceso && r.proceso_valor > 0) {
      items.unshift({ codigo: "PROC-" + r.proceso.toUpperCase().slice(0, 6), descripcion: r.proceso, cantidad: 1, valor_unitario: Number(r.proceso_valor), iva: 19 });
    }
    return {
      invoice_no: r.invoice_no,
      fecha: r.created_at.slice(0, 10),
      tipo_documento: r.invoice_mode === "electronica" ? "FE" : "FV",
      cliente_id: r.doc_id ?? "",
      cliente_nombre: r.legal_name || r.customer || "Consumidor final",
      cliente_email: r.email ?? "",
      persona_tipo: (r.person_type as any) ?? "natural",
      placa: r.plate ?? "",
      proceso: r.proceso ?? "",
      items,
      notas: r.notes ?? "",
    };
  };

  const exportAllSiigo = () => {
    if (!rows.length) return toast.error("No hay facturas");
    const wb = XLSX.utils.book_new();
    const header = ["Número","Fecha","Tipo","Cliente","Identificación","Email","Placa","Proceso","Subtotal","IVA","Total"];
    const data = rows.map((r) => [
      r.invoice_no, r.created_at.slice(0, 10),
      r.invoice_mode === "electronica" ? "FE" : "FV",
      r.legal_name || r.customer || "", r.doc_id || "", r.email || "",
      r.plate || "", r.proceso || "",
      Number(r.subtotal), Number(r.iva), Number(r.total),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws["!cols"] = header.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, "Facturas Siigo");
    XLSX.writeFile(wb, `facturas-siigo-${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success("Listado exportado");
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta factura del histórico?")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminada"); load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-3 flex flex-wrap items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Histórico de facturas</h2>
          <span className="text-xs text-muted-foreground">{rows.length} facturas</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={load} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent">
              <RefreshCw className="h-3.5 w-3.5"/> Refrescar
            </button>
            <button
              onClick={() => downloadSiigoInvoice(SAMPLE_AC_INVOICE)}
              className="inline-flex items-center gap-1 rounded-md border-2 border-dashed border-primary/50 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/5"
            >
              <FlaskConical className="h-3.5 w-3.5"/> Simulación factura A/C (Siigo)
            </button>
            <button
              onClick={exportAllSiigo}
              className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90"
            >
              <FileSpreadsheet className="h-3.5 w-3.5"/> Exportar todas a Siigo
            </button>
          </div>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Cargando…</p>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Aún no hay facturas registradas. Genera una desde el panel de empleados o usa el botón <strong>Simulación</strong> arriba para descargar una factura modelo de A/C en formato Siigo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">N°</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Placa</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{r.invoice_no}</td>
                    <td className="px-3 py-2 text-xs">{new Date(r.created_at).toLocaleDateString("es-CO")}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.invoice_mode==="electronica"?"bg-primary/15 text-primary":"bg-muted"}`}>{r.invoice_mode === "electronica" ? "FE" : "FV"}</span></td>
                    <td className="px-3 py-2">{r.legal_name || r.customer}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.doc_id}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.plate}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(r.total)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => downloadSiigoInvoice(toSiigo(r))} className="p-1.5 rounded hover:bg-primary/10 text-primary" title="Descargar formato Siigo"><Download className="h-4 w-4"/></button>
                        <button onClick={() => remove(r.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4"/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
