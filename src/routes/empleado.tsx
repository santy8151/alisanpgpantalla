import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ScanFace, Camera, Play, ArrowLeft, Loader2, Wrench, Shield } from "lucide-react";

export const Route = createFileRoute("/empleado")({
  component: EmpleadoGate,
  head: () => ({ meta: [{ title: "Acceso empleado | Alisan PG" }] }),
});

type Role = "operativo" | "admin";

function EmpleadoGate() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  const goNext = (r: Role) => {
    sessionStorage.setItem("emp_role", r);
    navigate({ to: r === "admin" ? "/admin" : "/panel" });
  };

  const startFaceScan = async () => {
    if (!role) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      let p = 0;
      const interval = setInterval(() => {
        p += 4;
        setProgress(p);
        if (p >= 100) {
          clearInterval(interval);
          stream.getTracks().forEach((t) => t.stop());
          sessionStorage.setItem("emp_auth", "face");
          goNext(role);
        }
      }, 80);
    } catch {
      setError("No se pudo acceder a la cámara. Use el modo demo.");
    }
  };

  useEffect(() => {
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const goDemo = () => {
    if (!role) return;
    sessionStorage.setItem("emp_auth", "demo");
    goNext(role);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Volver al tablero
        </Link>

        <div className="rounded-2xl border bg-card p-8 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ScanFace className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Acceso restringido</h1>
              <p className="text-sm text-muted-foreground">Selecciona tu perfil y autentícate</p>
            </div>
          </div>

          {/* Selector de perfil */}
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Tipo de acceso</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRole("operativo")}
                className={`rounded-xl border-2 p-3 text-left transition ${
                  role === "operativo" ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                }`}
              >
                <Wrench className="h-5 w-5 text-primary mb-1.5" />
                <p className="font-bold text-sm">Empleado operativo</p>
                <p className="text-[11px] text-muted-foreground">Chat IA, formularios, facturación, placas</p>
              </button>
              <button
                onClick={() => setRole("admin")}
                className={`rounded-xl border-2 p-3 text-left transition ${
                  role === "admin" ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                }`}
              >
                <Shield className="h-5 w-5 text-primary mb-1.5" />
                <p className="font-bold text-sm">Área administrativa</p>
                <p className="text-[11px] text-muted-foreground">Solo gestión de productos y servicios</p>
              </button>
            </div>
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            {!scanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
                <Camera className="h-10 w-10 opacity-60" />
              </div>
            )}
            {scanning && (
              <>
                <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-primary/80 animate-pulse" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-white">
                    <Loader2 className="h-3 w-3 animate-spin" /> Analizando rostro… {progress}%
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/20">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </>
            )}
          </div>

          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

          <button
            onClick={startFaceScan}
            disabled={scanning || !role}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <ScanFace className="h-4 w-4" />
            {scanning ? "Escaneando…" : "Iniciar reconocimiento facial"}
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase text-muted-foreground">o</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={goDemo}
            disabled={!role}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-3 text-sm font-semibold hover:bg-accent disabled:opacity-50"
          >
            <Play className="h-4 w-4" /> Modo demo
          </button>
          {!role && (
            <p className="mt-2 text-[11px] text-center text-muted-foreground">
              Selecciona un perfil arriba para continuar
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
