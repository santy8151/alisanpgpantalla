import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Wrench, Clock, ArrowUpRight, AlertCircle, Megaphone } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { playCallChime } from "@/lib/callSound";

export const Route = createFileRoute("/")({
  component: CustomerDisplay,
  head: () => ({
    meta: [
      { title: "Alisan PG | Tablero de turnos en vivo" },
      { name: "description", content: "Visualización en tiempo real de placas en proceso, demoras y llamados de turno." },
    ],
  }),
});

type Job = {
  id: string;
  plate: string;
  customer: string | null;
  service_type: "revision" | "instalacion" | string;
  service_name: string | null;
  status: "en_proceso" | "llamado" | "finalizado" | string;
  estimated_minutes: number;
  progress: number;
  delay_message: string | null;
  bay: string | null;
  called_at: string | null;
};

function CustomerDisplay() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [now, setNow] = useState(new Date());
  const seenCalled = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioUnlockedRef = useRef(false);

  // Load + realtime
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("active_jobs")
        .select("*")
        .neq("status", "finalizado")
        .order("created_at", { ascending: true });
      const list = (data as Job[]) ?? [];
      // En la PRIMERA carga, no hacemos sonar nada: solo registramos las llamadas existentes
      if (firstLoad.current) {
        list.filter((j) => j.status === "llamado").forEach((j) => seenCalled.current.add(j.id));
        firstLoad.current = false;
      }
      setJobs(list);
    };
    load();
    const ch = supabase
      .channel("active_jobs_display")
      .on("postgres_changes", { event: "*", schema: "public", table: "active_jobs" }, () => load())
      .subscribe();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(t);
    };
  }, []);

  // Sonido cuando aparece una NUEVA llamada (después de la primera carga)
  useEffect(() => {
    jobs.forEach((j) => {
      if (j.status === "llamado" && !seenCalled.current.has(j.id)) {
        seenCalled.current.add(j.id);
        if (audioUnlockedRef.current) {
          // suena 2 veces para que se escuche bien
          playCallChime();
          setTimeout(() => playCallChime(), 700);
        }
      }
    });
  }, [jobs]);

  const unlockAudio = () => {
    audioUnlockedRef.current = true;
    setAudioUnlocked(true);
    playCallChime();
  };

  const called = jobs.filter((j) => j.status === "llamado");
  const inProgress = jobs.filter((j) => j.status !== "llamado");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Alisan PG" className="h-12 w-auto" />
            <div>
              <h1 className="text-lg font-bold leading-tight">Alisan PG</h1>
              <p className="text-xs text-muted-foreground">Tablero de servicio en tiempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="font-mono font-semibold">{now.toLocaleTimeString("es-CO")}</div>
              <div className="text-xs text-muted-foreground">
                {now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            </div>
            {!audioUnlocked ? (
              <button
                onClick={unlockAudio}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 border border-amber-500/40 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-500/25"
                title="Da permiso al navegador para reproducir el sonido de los llamados de turno"
              >
                <Megaphone className="h-3.5 w-3.5" /> Activar sonido
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-700">
                <Megaphone className="h-3.5 w-3.5" /> Sonido activo
              </span>
            )}
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
          {/* Panal funcional de placas */}
          <section className="rounded-lg border bg-card overflow-hidden">
            <div className="border-b bg-primary/10 px-5 py-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-primary">
                Placas en proceso
              </h2>
              <span className="text-xs text-muted-foreground">{inProgress.length} activas</span>
            </div>
            {inProgress.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Sin placas en proceso</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                {inProgress.map((j) => (
                  <article
                    key={j.id}
                    className={`rounded-xl border-2 p-4 transition ${
                      j.delay_message
                        ? "border-amber-500/60 bg-amber-500/5"
                        : "border-border bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="rounded-md border-2 border-foreground bg-yellow-300 px-2.5 py-1 font-mono text-base font-black text-black">
                        {j.plate}
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        ~{Math.max(0, j.estimated_minutes)} min
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
                      {j.service_type === "instalacion" ? (
                        <>
                          <Wrench className="h-3.5 w-3.5 text-orange-500" />
                          <span>Servicio de instalación en proceso</span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-3.5 w-3.5 text-blue-500" />
                          <span>{j.service_name ?? "Revisión en proceso"}</span>
                        </>
                      )}
                    </div>
                    {j.customer && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{j.customer}</p>
                    )}
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${
                          j.service_type === "instalacion" ? "bg-orange-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.min(99, j.progress)}%` }}
                      />
                    </div>
                    {j.delay_message && (
                      <div className="mt-2 rounded-md bg-amber-500/15 border border-amber-500/40 p-2 text-[11px] text-amber-800 flex gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{j.delay_message}</span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Llamados */}
          <aside className="rounded-lg border bg-card overflow-hidden h-fit">
            <div className="border-b bg-destructive/10 px-5 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-destructive">
                Llamados de turno
              </h2>
            </div>
            {called.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Sin llamados activos</p>
            ) : (
              <ul className="divide-y">
                {called.map((c) => (
                  <li key={c.id} className="px-5 py-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <Megaphone className="h-5 w-5 text-destructive" />
                      <div>
                        <p className="font-mono text-lg font-extrabold">
                          {c.plate} → {c.bay ?? "Caja"}
                        </p>
                        {c.customer && (
                          <p className="text-xs text-muted-foreground">{c.customer}</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Por favor, esté atento a su placa. Los tiempos son aproximados.
        </p>
      </main>
    </div>
  );
}
