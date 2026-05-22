import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, ClipboardList, Receipt, ArrowLeft, LogOut, Settings } from "lucide-react";
import AIChat from "@/components/empleado/AIChat";
import WorkForm from "@/components/empleado/WorkForm";
import Invoice from "@/components/empleado/Invoice";
import Services from "@/components/empleado/Services";

export const Route = createFileRoute("/panel")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Panel empleado | TECNI-RTM" }] }),
});

type Tab = "chat" | "form" | "invoice" | "services";

function Dashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("chat");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const a = sessionStorage.getItem("emp_auth");
    if (!a) navigate({ to: "/empleado" });
    else setAuthed(true);
  }, [navigate]);

  const logout = () => {
    sessionStorage.removeItem("emp_auth");
    navigate({ to: "/empleado" });
  };

  if (!authed) return null;

  const tabs: { id: Tab; label: string; icon: typeof Sparkles }[] = [
    { id: "chat", label: "Chat con IA", icon: Sparkles },
    { id: "form", label: "Formulario de trabajo", icon: ClipboardList },
    { id: "services", label: "Servicios y tiempos", icon: Settings },
    { id: "invoice", label: "Factura", icon: Receipt },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-base font-bold">Panel empleado · Alisan PG</h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://alisanpg.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Ir a la app de Alisan PG ↗
            </a>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> Salir
            </button>
          </div>
        </div>
        <nav className="mx-auto max-w-7xl px-6 flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {tab === "chat" && <AIChat onDone={() => setTab("form")} />}
        {tab === "form" && <WorkForm onDone={() => setTab("invoice")} />}
        {tab === "services" && <Services onGoInvoice={() => setTab("invoice")} />}
        {tab === "invoice" && <Invoice />}
      </main>
    </div>
  );
}
