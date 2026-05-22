import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, LogOut, Shield, Package, FileSpreadsheet, Users, Settings } from "lucide-react";
import CatalogManager from "@/components/admin/CatalogManager";
import InvoiceHistory from "@/components/admin/InvoiceHistory";
import CustomerDashboard from "@/components/admin/CustomerDashboard";
import Services from "@/components/empleado/Services";

export const Route = createFileRoute("/admin")({
  component: AdminArea,
  head: () => ({ meta: [{ title: "Área administrativa | Alisan PG" }] }),
});

type Tab = "dashboard" | "catalog" | "services" | "invoices";

function AdminArea() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => {
    const a = sessionStorage.getItem("emp_auth");
    const r = sessionStorage.getItem("emp_role");
    if (!a || r !== "admin") navigate({ to: "/empleado" });
  }, [navigate]);

  const logout = () => {
    sessionStorage.removeItem("emp_auth");
    sessionStorage.removeItem("emp_role");
    navigate({ to: "/empleado" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold">Área administrativa</h1>
              <p className="text-xs text-muted-foreground">Catálogo y facturación</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="https://alisanpg.vercel.app/" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              Ir a la app de Alisan PG ↗
            </a>
            <button onClick={logout} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" /> Salir
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 flex gap-1 overflow-x-auto">
          {([
            { id: "dashboard", label: "Dashboard de clientes", icon: Users },
            { id: "catalog", label: "Productos y servicios", icon: Package },
            { id: "services", label: "Servicios y tiempos", icon: Settings },
            { id: "invoices", label: "Facturas (Siigo)", icon: FileSpreadsheet },
          ] as { id: Tab; label: string; icon: any }[]).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? "border-primary text-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        {tab === "dashboard" && <CustomerDashboard />}
        {tab === "catalog" && <CatalogManager />}
        {tab === "services" && <Services onGoInvoice={() => setTab("invoices")} />}
        {tab === "invoices" && <InvoiceHistory />}
      </main>
    </div>
  );
}
