// Simple shared state across employee tabs (chat result + form + invoice)
export type Diagram = { id: number; style: string; url: string };

const KEYS = {
  diagram: "wo_selected_diagram",
  form: "wo_form_data",
  plate: "wo_plate",
};

export type FormData = {
  plate: string;
  customer: string;
  compresorId?: string;
  evaporadorId?: string;
  condensadorId?: string;
  ventiladorId?: string;
  trompoId?: string;
  instalacionId?: string;
  manoObra: boolean;
  notes: string;
};

export const store = {
  setDiagram(d: Diagram) {
    if (typeof window !== "undefined") localStorage.setItem(KEYS.diagram, JSON.stringify(d));
  },
  getDiagram(): Diagram | null {
    if (typeof window === "undefined") return null;
    const v = localStorage.getItem(KEYS.diagram);
    return v ? JSON.parse(v) : null;
  },
  setForm(f: FormData) {
    if (typeof window !== "undefined") localStorage.setItem(KEYS.form, JSON.stringify(f));
  },
  getForm(): FormData | null {
    if (typeof window === "undefined") return null;
    const v = localStorage.getItem(KEYS.form);
    return v ? JSON.parse(v) : null;
  },
  clear() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(KEYS.diagram);
      localStorage.removeItem(KEYS.form);
    }
  },
};
