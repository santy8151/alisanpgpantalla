import { useEffect, useMemo, useState } from "react";
import { Receipt, Download, CreditCard, CheckCircle2, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { store, type FormData } from "@/lib/workOrderStore";
import { toast } from "sonner";

type Price = { id: string; category: string; name: string; price: number };

const fmt = (n: number) => "$" + n.toLocaleString("es-CO");

export default function Invoice() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [form, setForm] = useState<FormData | null>(null);
  const [paid, setPaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<"card" | "pse" | "nequi">("card");
  const diagram = store.getDiagram();
  const invoiceNo = useMemo(() => "FAC-" + Date.now().toString().slice(-6), []);

  useEffect(() => {
    setForm(store.getForm());
    supabase.from("service_prices").select("*").then(({ data }) => setPrices(data ?? []));
  }, []);

  const items = useMemo(() => {
    if (!form) return [] as Price[];
    const ids = [
      form.compresorId,
      form.evaporadorId,
      form.condensadorId,
      form.ventiladorId,
      form.trompoId,
      form.instalacionId,
    ].filter(Boolean) as string[];
    const arr = prices.filter((p) => ids.includes(p.id));
    if (form.manoObra) {
      const mo = prices.find((p) => p.category === "mano_obra");
      if (mo) arr.push(mo);
    }
    return arr;
  }, [form, prices]);

  const subtotal = items.reduce((s, i) => s + Number(i.price), 0);
  const iva = subtotal * 0.19;
  const total = subtotal + iva;

  const pay = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setPaid(true);
      toast.success("Pago aprobado ✓");
    }, 1800);
  };

  const exportExcel = () => {
    if (!form) return;
    const wb = XLSX.utils.book_new();
    const header = [
      ["FACTURA", invoiceNo],
      ["Fecha", new Date().toLocaleString("es-CO")],
      ["Cliente", form.customer],
      ["Placa", form.plate],
      [""],
      ["Item", "Categoría", "Precio (COP)"],
    ];
    const rows = items.map((i) => [i.name, i.category, Number(i.price)]);
    const totals = [
      [""],
      ["Subtotal", "", subtotal],
      ["IVA 19%", "", iva],
      ["TOTAL", "", total],
      [""],
      ["Notas", form.notes],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...header, ...rows, ...totals]);
    ws["!cols"] = [{ wch: 40 }, { wch: 18 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, "Factura");
    XLSX.writeFile(wb, `${invoiceNo}.xlsx`);
    toast.success("Factura exportada en Excel");
  };

  if (!form) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No hay datos del formulario. Completa el formulario primero.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      {/* Invoice */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Factura {invoiceNo}</h2>
          </div>
          {paid && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> PAGADA
            </span>
          )}
        </div>

        <div className="p-5 space-y-4 text-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Emisor</p>
              <p className="font-semibold">TECNI-RTM SAS</p>
              <p className="text-muted-foreground text-xs">NIT 900.123.456-7 · Cra 50 #20-30</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-muted-foreground">Cliente</p>
              <p className="font-semibold">{form.customer}</p>
              <p className="text-muted-foreground text-xs">Placa: {form.plate}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Concepto</th>
                  <th className="px-3 py-2 text-left">Categoría</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="px-3 py-2">{i.name}</td>
                    <td className="px-3 py-2 text-muted-foreground capitalize">{i.category}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(Number(i.price))}</td>
                  </tr>
                ))}
                {!items.length && (
                  <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Sin ítems</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
            <Row label="Subtotal" value={fmt(subtotal)} />
            <Row label="IVA 19%" value={fmt(iva)} />
            <div className="border-t pt-2">
              <Row label="TOTAL" value={fmt(total)} bold />
            </div>
          </div>

          {diagram && (
            <div className="border-t pt-4">
              <p className="text-xs uppercase text-muted-foreground mb-2">Diagrama anexo</p>
              <img src={diagram.url} alt="" className="h-32 rounded border object-cover" />
            </div>
          )}

          <button
            onClick={exportExcel}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Descargar factura en Excel
          </button>
        </div>
      </div>

      {/* Payment gateway */}
      <div className="rounded-lg border bg-card h-fit">
        <div className="border-b px-5 py-3 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Pasarela de pagos</h2>
        </div>
        <div className="p-5 space-y-4">
          {paid ? (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-2 font-semibold">Pago exitoso</p>
              <p className="text-xs text-muted-foreground">
                Ref: TXN-{Date.now().toString().slice(-8)}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(["card", "pse", "nequi"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`rounded-md border px-2 py-2 text-xs font-semibold uppercase transition ${
                      method === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    {m === "card" ? "Tarjeta" : m === "pse" ? "PSE" : "Nequi"}
                  </button>
                ))}
              </div>

              {method === "card" && (
                <div className="space-y-2">
                  <input className="input" placeholder="Número de tarjeta" defaultValue="4111 1111 1111 1111" />
                  <div className="grid grid-cols-2 gap-2">
                    <input className="input" placeholder="MM/AA" defaultValue="12/28" />
                    <input className="input" placeholder="CVV" defaultValue="123" />
                  </div>
                </div>
              )}
              {method === "pse" && (
                <select className="input">
                  <option>Bancolombia</option>
                  <option>Davivienda</option>
                  <option>Banco de Bogotá</option>
                </select>
              )}
              {method === "nequi" && (
                <input className="input" placeholder="Número Nequi" defaultValue="3001234567" />
              )}

              <div className="rounded-lg bg-muted/50 p-3 text-sm flex justify-between">
                <span>A pagar</span>
                <span className="font-mono font-bold">{fmt(total)}</span>
              </div>

              <button
                onClick={pay}
                disabled={paying || total === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {paying ? "Procesando…" : `Pagar ${fmt(total)}`}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 0.5rem 0.7rem;
          font-size: 0.85rem;
          background: var(--background);
        }
        .input:focus { outline: none; border-color: var(--primary); }
      `}</style>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
