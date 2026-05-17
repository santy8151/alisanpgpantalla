// Genera un Excel con formato compatible con importación a Siigo
// (taller automotriz / aire acondicionado)
import * as XLSX from "xlsx";

export type SiigoItem = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  iva: number; // %
};

export type SiigoInvoice = {
  invoice_no: string;
  fecha: string; // YYYY-MM-DD
  tipo_documento: "FV" | "FE"; // Factura Venta / Electrónica
  cliente_id: string; // NIT/CC
  cliente_nombre: string;
  cliente_email?: string;
  persona_tipo: "natural" | "juridica";
  placa?: string;
  proceso?: string;
  items: SiigoItem[];
  notas?: string;
};

export function buildSiigoWorkbook(inv: SiigoInvoice) {
  const wb = XLSX.utils.book_new();

  // Encabezado tipo Siigo
  const encabezado = [
    ["EMPRESA EMISORA", "ALISAN PG S.A.S - Taller de Aire Acondicionado Automotriz"],
    ["NIT EMISOR", "900.123.456-7"],
    ["DIRECCIÓN", "Cra 45 #34-12, Bogotá D.C."],
    ["TELÉFONO", "(601) 555-1234"],
    [""],
    ["DOCUMENTO", inv.tipo_documento === "FE" ? "FACTURA ELECTRÓNICA DE VENTA" : "FACTURA DE VENTA"],
    ["PREFIJO", "FVAC"],
    ["NÚMERO", inv.invoice_no],
    ["FECHA", inv.fecha],
    ["FORMA DE PAGO", "Contado"],
    ["MONEDA", "COP"],
    [""],
    ["TIPO IDENTIFICACIÓN CLIENTE", inv.persona_tipo === "juridica" ? "NIT" : "CC"],
    ["IDENTIFICACIÓN CLIENTE", inv.cliente_id],
    ["NOMBRE / RAZÓN SOCIAL", inv.cliente_nombre],
    ["EMAIL", inv.cliente_email ?? ""],
    ["PLACA VEHÍCULO", inv.placa ?? ""],
    ["PROCESO / SERVICIO", inv.proceso ?? ""],
    [""],
    ["DETALLE DE PRODUCTOS Y SERVICIOS"],
    ["CÓDIGO", "DESCRIPCIÓN", "CANTIDAD", "VR UNITARIO", "% IVA", "VR IVA", "SUBTOTAL", "TOTAL"],
  ];

  let subtotal = 0;
  let ivaTotal = 0;
  const rows = inv.items.map((it) => {
    const sub = it.cantidad * it.valor_unitario;
    const ivaVal = sub * (it.iva / 100);
    subtotal += sub;
    ivaTotal += ivaVal;
    return [it.codigo, it.descripcion, it.cantidad, it.valor_unitario, it.iva, ivaVal, sub, sub + ivaVal];
  });

  const totales = [
    [""],
    ["", "", "", "", "", "SUBTOTAL", subtotal],
    ["", "", "", "", "", "IVA 19%", ivaTotal],
    ["", "", "", "", "", "TOTAL A PAGAR", subtotal + ivaTotal],
    [""],
    ["NOTAS:", inv.notas ?? ""],
    [""],
    ["Firma elaboró", "________________________"],
    ["Firma recibido", "________________________"],
  ];

  const ws = XLSX.utils.aoa_to_sheet([...encabezado, ...rows, ...totales]);
  ws["!cols"] = [
    { wch: 14 }, { wch: 42 }, { wch: 10 }, { wch: 14 }, { wch: 8 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Factura Siigo");
  return wb;
}

export function downloadSiigoInvoice(inv: SiigoInvoice) {
  const wb = buildSiigoWorkbook(inv);
  XLSX.writeFile(wb, `${inv.invoice_no}-siigo.xlsx`);
}

export const SAMPLE_AC_INVOICE: SiigoInvoice = {
  invoice_no: "FVAC-001234",
  fecha: new Date().toISOString().slice(0, 10),
  tipo_documento: "FE",
  cliente_id: "1.020.789.456",
  cliente_nombre: "Carlos Andrés Ramírez",
  cliente_email: "carlos.ramirez@correo.com",
  persona_tipo: "natural",
  placa: "ABC-123",
  proceso: "Instalación + recarga de gas R134a en sistema de A/C automotriz",
  items: [
    { codigo: "COMP-001", descripcion: "Compresor A/C Denso para Chevrolet Aveo", cantidad: 1, valor_unitario: 850000, iva: 19 },
    { codigo: "EVAP-014", descripcion: "Evaporador caja A/C Universal", cantidad: 1, valor_unitario: 320000, iva: 19 },
    { codigo: "FILT-DESH", descripcion: "Filtro deshidratador / receiver dryer", cantidad: 1, valor_unitario: 65000, iva: 19 },
    { codigo: "GAS-R134", descripcion: "Recarga gas refrigerante R134a (lb)", cantidad: 2, valor_unitario: 28000, iva: 19 },
    { codigo: "ACE-PAG", descripcion: "Aceite PAG 46 lubricante compresor", cantidad: 1, valor_unitario: 35000, iva: 19 },
    { codigo: "MO-INST", descripcion: "Mano de obra instalación y vacío de sistema", cantidad: 1, valor_unitario: 220000, iva: 19 },
    { codigo: "ESC-FUG", descripcion: "Escaneo de fugas con detector ultrasónico", cantidad: 1, valor_unitario: 80000, iva: 19 },
  ],
  notas: "Garantía de 6 meses sobre compresor y mano de obra. Sistema entregado con presión 35 PSI baja / 220 PSI alta.",
};
