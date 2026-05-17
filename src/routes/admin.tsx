import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, LogOut, Shield } from "lucide-react";
import CatalogManager from "@/components/admin/CatalogManager";

export const Route = createFileRoute("/admin")({
  component: AdminArea,
  head: () => ({ meta: [{ title: "Área administrativa | Alisan PG" }] }),
});

function AdminArea() {
  const navigate = useNavigate();
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
              <p className="text-xs text-muted-foreground">Gestión de productos y servicios</p>
            </div>
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
            <button onClick={logout} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" /> Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <CatalogManager />
      </main>
    </div>
  );
}
