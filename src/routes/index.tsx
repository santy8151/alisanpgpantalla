import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wrench, Clock, ArrowUpRight } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  component: CustomerDisplay,
  head: () => ({
    meta: [
      { title: "TECNI-RTM | Tablero de turnos" },
      { name: "description", content: "Visualización en tiempo real de placas en proceso e instalaciones" },
    ],
  }),
});

type Job = {
  plate: string;
  type: "revision" | "instalacion";
  minutes: number;
  progress: number;
};

const initialJobs: Job[] = [
  { plate: "QJT81G", type: "revision", minutes: 2, progress: 92 },
  { plate: "DSV-505", type: "revision", minutes: 14, progress: 45 },
  { plate: "TPR-55F", type: "revision", minutes: 42, progress: 18 },
  { plate: "HKL-219", type: "instalacion", minutes: 28, progress: 55 },
  { plate: "MNB-774", type: "instalacion", minutes: 8, progress: 78 },
];

function CustomerDisplay() {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      setJobs((prev) =>
        prev.map((j) => ({
          ...j,
          progress: Math.min(99, j.progress + Math.random() * 1.2),
          minutes: Math.max(1, +(j.minutes - 0.05).toFixed(0)),
        }))
      );
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const calls = ["XKM-902 → Bahía 3", "FRT-118 → Caja 1"];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Alisan PG" className="h-12 w-auto" />
            <div>
              <h1 className="text-lg font-bold leading-tight">Alisan PG</h1>
              <p className="text-xs text-muted-foreground">Centro de servicio automotriz</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="font-mono font-semibold">
                {now.toLocaleTimeString("es-CO")}
              </div>
              <div className="text-xs text-muted-foreground">
                {now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            </div>
            <Link
              to="/empleado"
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition"
            >
              Acceso empleados <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          {/* Placas en proceso */}
          <section className="rounded-lg border bg-card overflow-hidden">
            <div className="border-b bg-primary/10 px-5 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
                Placas en proceso
              </h2>
            </div>
            <ul className="divide-y">
              {jobs.map((j) => (
                <li key={j.plate} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="rounded-md border-2 border-foreground bg-yellow-300 px-3 py-1.5 font-mono text-lg font-black text-black">
                        {j.plate}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          {j.type === "instalacion" ? (
                            <>
                              <Wrench className="h-4 w-4 text-orange-500" />
                              <span>Servicio de instalación en proceso</span>
                            </>
                          ) : (
                            <>
                              <Clock className="h-4 w-4 text-blue-500" />
                              <span>Revisión técnica en proceso</span>
                            </>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Tiempo restante: ~{Math.round(j.minutes)} min
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all duration-500 ${
                        j.type === "instalacion" ? "bg-orange-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${j.progress}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Llamados */}
          <aside className="rounded-lg border bg-card overflow-hidden h-fit">
            <div className="border-b bg-destructive/10 px-5 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-destructive">
                Llamados de turno
              </h2>
            </div>
            <ul className="divide-y">
              {calls.map((c) => (
                <li key={c} className="px-5 py-4 font-mono text-base font-semibold animate-pulse">
                  {c}
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Por favor, esté atento a su placa. Los tiempos son aproximados.
        </p>
      </main>
    </div>
  );
}
