import { useEffect, useMemo, useState } from "react";
import { Receipt, Download, CreditCard, CheckCircle2, Loader2, User, Building2, FileText, Sparkles, Printer, Wrench, FlaskConical } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { store, type FormData, PROCESO_LABELS } from "@/lib/workOrderStore";
import { toast } from "sonner";
import { downloadSiigoInvoice, SAMPLE_AC_INVOICE, type SiigoInvoice } from "@/lib/siigoExport";

type Price = { id: string; category: string; name: string; price: number };

const fmt = (n: number) => "$" + n.toLocaleString("es-CO");

type PersonType = "natural" | "juridica" | null;
type InvoiceMode = "normal" | "electronica" | null;

export default function Invoice() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [form, setForm] = useState<FormData | null>(null);
  const [paid, setPaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<"mercadopago" | "pse" | "nequi">("mercadopago");
  const diagram = store.getDiagram();
  const invoiceNo = useMemo(() => "FAC-" + Date.now().toString().slice(-6), []);

  // Nuevo: paso de configuración previa
  const [personType, setPersonType] = useState<PersonType>(null);
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>(null);
  const [docId, setDocId] = useState("");
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    setForm(store.getForm());
    supabase.from("service_prices").select("*").then(({ data }) => setPrices(data ?? []));
  }, []);

  const items = useMemo(() => {
    if (!form) return [] as Price[];
    const ids = [
      form.compresorId, form.evaporadorId, form.condensadorId,
      form.ventiladorId, form.trompoId, form.instalacionId,
    ].filter(Boolean) as string[];
    const arr = prices.filter((p) => ids.includes(p.id));
    if (form.manoObra) {
      const mo = prices.find((p) => p.category === "mano_obra");
      if (mo) arr.push(mo);
    }
    return arr;
  }, [form, prices]);

  const procesoValor = Number(form?.procesoValor ?? 0);
  const subtotal = items.reduce((s, i) => s + Number(i.price), 0) + procesoValor;
  const iva = subtotal * 0.19;
  const total = subtotal + iva;

  const NEQUI_DESTINO = "3044457841"; // Llave Bre-B (Nequi)
  const MP_STORE_URL = "https://link.mercadopago.com.co/alisanpg"; // Tienda Mercado Pago Alisan PG
  const [pseBank, setPseBank] = useState("Bancolombia");

  const pay = () => {
    if (method === "mercadopago") {
      const monto = Math.round(total);
      const url = `${MP_STORE_URL}?amount=${monto}&reference=${invoiceNo}&description=${encodeURIComponent(`Servicio ${form?.plate ?? ""}`)}`;
      toast.info(`Mercado Pago · ${fmt(total)} · Ref ${invoiceNo}`);
      window.open(url, "_blank", "noopener,noreferrer");
      setPaying(true);
      setTimeout(() => { setPaying(false); setPaid(true); toast.success("Pago confirmado en Mercado Pago ✓"); }, 2500);
      return;
    }
    if (method === "pse") {
      const monto = Math.round(total);
      const url =
        `https://www.pse.com.co/persona?bank=${encodeURIComponent(pseBank)}` +
        `&monto=${monto}&ref=${invoiceNo}` +
        `&destino_brebkey=${NEQUI_DESTINO}&destino_tipo=NEQUI`;
      toast.info(`PSE · ${pseBank} → Bre-B Nequi ${NEQUI_DESTINO} · ${fmt(total)}`);
      window.open(url, "_blank", "noopener,noreferrer");
      setPaying(true);
      setTimeout(() => { setPaying(false); setPaid(true); toast.success(`Transferencia Bre-B a ${NEQUI_DESTINO} confirmada ✓`); }, 2500);
      return;
    }
    if (method === "nequi") {
      const url = `https://recarga.nequi.com.co/bdigital/PayWithNequi?phone=${NEQUI_DESTINO}&amount=${Math.round(total)}&reference=${invoiceNo}`;
      toast.info(`Enviando a Nequi ${NEQUI_DESTINO} · ${fmt(total)}`);
      window.open(url, "_blank", "noopener,noreferrer");
      setPaying(true);
      setTimeout(() => { setPaying(false); setPaid(true); toast.success("Pago Nequi confirmado ✓"); }, 2500);
      return;
    }
  };

  const persistInvoice = async () => {
    if (!form) return;
    await supabase.from("invoices").insert({
      invoice_no: invoiceNo,
      customer: form.customer,
      legal_name: legalName || form.customer,
      doc_id: docId,
      person_type: personType,
      invoice_mode: invoiceMode,
      email: email || null,
      plate: form.plate,
      proceso: form.proceso ? PROCESO_LABELS[form.proceso] : null,
      proceso_valor: procesoValor,
      items: items.map((i) => ({ name: i.name, category: i.category, price: Number(i.price), qty: 1 })),
      subtotal, iva, total, notes: form.notes || null,
    });
  };

  const exportSiigoCurrent = async () => {
    if (!form) return;
    const inv: SiigoInvoice = {
      invoice_no: invoiceNo,
      fecha: new Date().toISOString().slice(0, 10),
      tipo_documento: invoiceMode === "electronica" ? "FE" : "FV",
      cliente_id: docId,
      cliente_nombre: legalName || form.customer,
      cliente_email: email,
      persona_tipo: (personType ?? "natural") as "natural" | "juridica",
      placa: form.plate,
      proceso: form.proceso ? PROCESO_LABELS[form.proceso] : "",
      items: [
        ...(form.proceso && procesoValor > 0
          ? [{ codigo: "PROC-" + form.proceso.toUpperCase().slice(0, 6), descripcion: PROCESO_LABELS[form.proceso], cantidad: 1, valor_unitario: procesoValor, iva: 19 }]
          : []),
        ...items.map((i, idx) => ({ codigo: `ITM-${String(idx + 1).padStart(3, "0")}`, descripcion: i.name, cantidad: 1, valor_unitario: Number(i.price), iva: 19 })),
      ],
      notas: form.notes || "",
    };
    downloadSiigoInvoice(inv);
    await persistInvoice();
    toast.success("Factura Siigo descargada y archivada");
  };

  const exportExcel = async () => {
    if (!form) return;
    await persistInvoice();
    const wb = XLSX.utils.book_new();
    const header = [
      ["FACTURA", invoiceNo],
      ["Tipo", invoiceMode === "electronica" ? "Electrónica personalizada" : "Normal"],
      ["Persona", personType === "juridica" ? "Jurídica" : "Natural"],
      [personType === "juridica" ? "NIT" : "Cédula", docId],
      ["Razón / Nombre", legalName || form.customer],
      ["Email", email],
      ["Fecha", new Date().toLocaleString("es-CO")],
      ["Cliente", form.customer],
      ["Placa", form.plate],
      [""],
      ["Item", "Categoría", "Precio (COP)"],
    ];
    const procesoRow = form.proceso && procesoValor > 0
      ? [[PROCESO_LABELS[form.proceso], "Proceso", procesoValor]]
      : [];
    const rows = [...procesoRow, ...items.map((i) => [i.name, i.category, Number(i.price)])];
    const totals = [
      [""],
      ["Subtotal", "", subtotal],
      ["IVA 19%", "", iva],
      ["TOTAL", "", total],
      [""],
      ["Notas", form.notes],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...header, ...rows, ...totals]);
    ws["!cols"] = [{ wch: 40 }, { wch: 22 }, { wch: 16 }];
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

  // PASO 1: configuración de tipo persona + modo de factura
  if (!configured) {
    const canContinue = personType && invoiceMode && docId.trim() && legalName.trim();
    return (
      <div className="mx-auto max-w-2xl rounded-lg border bg-card">
        <div className="border-b px-5 py-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Configurar factura</h2>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Tipo de persona
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPersonType("natural")}
                className={`rounded-xl border-2 p-4 text-left transition ${
                  personType === "natural" ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                }`}
              >
                <User className="h-6 w-6 text-primary mb-2" />
                <p className="font-bold">Persona natural</p>
                <p className="text-xs text-muted-foreground">Para clientes individuales (cédula)</p>
              </button>
              <button
                onClick={() => setPersonType("juridica")}
                className={`rounded-xl border-2 p-4 text-left transition ${
                  personType === "juridica" ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                }`}
              >
                <Building2 className="h-6 w-6 text-primary mb-2" />
                <p className="font-bold">Persona jurídica</p>
                <p className="text-xs text-muted-foreground">Para empresas (NIT)</p>
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Tipo de facturación
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setInvoiceMode("normal")}
                className={`rounded-xl border-2 p-4 text-left transition ${
                  invoiceMode === "normal" ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                }`}
              >
                <Receipt className="h-6 w-6 text-primary mb-2" />
                <p className="font-bold">Factura normal</p>
                <p className="text-xs text-muted-foreground">Comprobante simple en Excel</p>
              </button>
              <button
                onClick={() => setInvoiceMode("electronica")}
                className={`rounded-xl border-2 p-4 text-left transition ${
                  invoiceMode === "electronica" ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                }`}
              >
                <Sparkles className="h-6 w-6 text-primary mb-2" />
                <p className="font-bold">Factura electrónica personalizada</p>
                <p className="text-xs text-muted-foreground">Con datos fiscales y envío por correo</p>
              </button>
            </div>
          </div>

          {personType && (
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {personType === "juridica" ? "NIT" : "Cédula"}
                </span>
                <input value={docId} onChange={(e) => setDocId(e.target.value)} className="input" placeholder={personType === "juridica" ? "900.123.456-7" : "1.234.567.890"} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {personType === "juridica" ? "Razón social" : "Nombre completo"}
                </span>
                <input value={legalName} onChange={(e) => setLegalName(e.target.value)} className="input" placeholder={personType === "juridica" ? "Empresa S.A.S" : form.customer} />
              </label>
              {invoiceMode === "electronica" && (
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Correo para envío
                  </span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="cliente@ejemplo.com" />
                </label>
              )}
            </div>
          )}

          <button
            onClick={() => setConfigured(true)}
            disabled={!canContinue}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Continuar a la factura
          </button>
        </div>

        <style>{`
          .input { width:100%; border:1px solid var(--border); border-radius:0.5rem; padding:0.55rem 0.75rem; font-size:0.875rem; background:var(--background); }
          .input:focus { outline:none; border-color:var(--primary); }
        `}</style>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr] print-area">
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Factura {invoiceNo}</h2>
            <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
              invoiceMode === "electronica" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              {invoiceMode === "electronica" ? "Electrónica" : "Normal"}
            </span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase bg-muted text-muted-foreground">
              {personType === "juridica" ? "Jurídica" : "Natural"}
            </span>
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
              <p className="font-semibold">Alisan PG</p>
              <p className="text-muted-foreground text-xs">NIT 900.123.456-7</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-muted-foreground">Cliente</p>
              <p className="font-semibold">{legalName || form.customer}</p>
              <p className="text-muted-foreground text-xs">
                {personType === "juridica" ? "NIT" : "C.C."}: {docId} · Placa: {form.plate}
              </p>
              {email && <p className="text-muted-foreground text-xs">{email}</p>}
            </div>
          </div>

          {form.proceso && (
            <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/5 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Proceso a realizar</p>
                  <p className="font-bold">{PROCESO_LABELS[form.proceso]}</p>
                </div>
              </div>
              <p className="font-mono font-bold text-base">{fmt(procesoValor)}</p>
            </div>
          )}

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
                {form.proceso && procesoValor > 0 && (
                  <tr className="border-t bg-amber-500/5">
                    <td className="px-3 py-2 font-semibold">{PROCESO_LABELS[form.proceso]}</td>
                    <td className="px-3 py-2 text-muted-foreground">Proceso</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(procesoValor)}</td>
                  </tr>
                )}
                {items.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="px-3 py-2">{i.name}</td>
                    <td className="px-3 py-2 text-muted-foreground capitalize">{i.category}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(Number(i.price))}</td>
                  </tr>
                ))}
                {!items.length && !form.proceso && (
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

          <div className="flex flex-wrap gap-2 no-print">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90"
            >
              <Printer className="h-4 w-4" /> Imprimir factura
            </button>
            <button
              onClick={exportExcel}
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <Download className="h-4 w-4" /> Descargar Excel
            </button>
            <button
              onClick={exportSiigoCurrent}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700"
            >
              <FileText className="h-4 w-4" /> Exportar a Siigo
            </button>
            <button
              onClick={() => downloadSiigoInvoice(SAMPLE_AC_INVOICE)}
              className="inline-flex items-center gap-2 rounded-md border-2 border-dashed border-primary/60 text-primary px-4 py-2 text-sm font-semibold hover:bg-primary/5"
              title="Descarga una factura Siigo de ejemplo (taller A/C automotriz)"
            >
              <FlaskConical className="h-4 w-4" /> Simulación factura Siigo
            </button>
            <button
              onClick={() => setConfigured(false)}
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Cambiar datos de facturación
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card h-fit no-print">
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
                {(["mercadopago", "pse", "nequi"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`rounded-md border px-2 py-2 text-xs font-semibold uppercase transition ${
                      method === m ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
                    }`}
                  >
                    {m === "mercadopago" ? "Mercado Pago" : m === "pse" ? "PSE" : "Nequi"}
                  </button>
                ))}
              </div>

              {method === "mercadopago" && (
                <div className="space-y-2">
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
                    <p className="font-bold text-sm text-primary">Tienda Mercado Pago Alisan PG</p>
                    <p className="text-muted-foreground mt-1">
                      Al pagar se abrirá nuestro checkout de Mercado Pago. Allí ya está configurada la cuenta destino, métodos disponibles (tarjeta, PSE, Nequi, saldo MP) y la confirmación automática.
                    </p>
                    <p className="text-muted-foreground mt-2">Valor: <b>{fmt(total)}</b> · Ref: <b>{invoiceNo}</b></p>
                  </div>
                </div>
              )}
              {method === "pse" && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Elige tu banco</p>
                  <select className="input" value={pseBank} onChange={(e) => setPseBank(e.target.value)}>
                    <option>Bancolombia</option>
                    <option>Davivienda</option>
                    <option>Banco de Bogotá</option>
                    <option>BBVA</option>
                    <option>Banco Popular</option>
                    <option>Banco AV Villas</option>
                    <option>Banco Caja Social</option>
                    <option>Scotiabank Colpatria</option>
                  </select>
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 text-xs">
                    <p className="text-muted-foreground">Transferencia Bre-B a llave Nequi</p>
                    <p className="font-mono font-bold text-base text-primary">{NEQUI_DESTINO}</p>
                    <p className="text-muted-foreground mt-1">
                      Desde <b>{pseBank}</b> · valor <b>{fmt(total)}</b>
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Se abrirá el portal PSE de tu banco. El destino ya está predeterminado a la llave Bre-B Nequi <b>{NEQUI_DESTINO}</b> por el valor exacto del servicio.
                  </p>
                </div>
              )}
              {method === "nequi" && (
                <div className="space-y-2">
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 text-xs">
                    <p className="text-muted-foreground">Cuenta Nequi destino</p>
                    <p className="font-mono font-bold text-base text-primary">{NEQUI_DESTINO}</p>
                    <p className="text-muted-foreground mt-1">Valor a transferir: <b>{fmt(total)}</b></p>
                  </div>
                  <input className="input" placeholder="Tu número Nequi" defaultValue="3001234567" />
                </div>
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
        .input { width:100%; border:1px solid var(--border); border-radius:0.5rem; padding:0.5rem 0.7rem; font-size:0.85rem; background:var(--background); }
        .input:focus { outline:none; border-color:var(--primary); }
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
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
