import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ScanFace, Camera, Play, ArrowLeft, Loader2, Wrench, Shield, UserCheck, LifeBuoy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { computeDescriptorFromVideo, euclideanDistance, loadFaceModels, MATCH_THRESHOLD } from "@/lib/face-recognition";

export const Route = createFileRoute("/empleado")({
  component: EmpleadoGate,
  head: () => ({ meta: [{ title: "Acceso empleado | Alisan PG" }] }),
});

type Role = "operativo" | "admin";
type Enrollment = { id: string; name: string; descriptor: number[] };

function EmpleadoGate() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

  useEffect(() => {
    loadFaceModels().catch(() => {});
    supabase
      .from("face_enrollments")
      .select("id,name,descriptor")
      .then(({ data }) => setEnrollments((data ?? []) as Enrollment[]));
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const goNext = (r: Role) => {
    sessionStorage.setItem("emp_role", r);
    navigate({ to: r === "admin" ? "/admin" : "/panel" });
  };

  const startFaceScan = async () => {
    if (!role) return;
    setError(null);
    setInfo(null);
    if (enrollments.length === 0) {
      setError("No hay rostros registrados. Pide a soporte que registre tu rostro primero.");
      return;
    }
    try {
      setModelLoading(true);
      await loadFaceModels();
      setModelLoading(false);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      await new Promise((r) => setTimeout(r, 600));

      // Try up to 6 frames to detect a face
      let descriptor: Float32Array | null = null;
      for (let i = 0; i < 6 && !descriptor; i++) {
        descriptor = await computeDescriptorFromVideo(videoRef.current!);
        if (!descriptor) await new Promise((r) => setTimeout(r, 350));
      }

      if (!descriptor) {
        setError("No se detectó un rostro. Intenta de nuevo de frente y con buena luz.");
        setScanning(false);
        stopStream();
        return;
      }

      // Find best match
      let best: { name: string; distance: number } | null = null;
      for (const e of enrollments) {
        const dist = euclideanDistance(descriptor, e.descriptor);
        if (!best || dist < best.distance) best = { name: e.name, distance: dist };
      }

      if (best && best.distance <= MATCH_THRESHOLD) {
        setInfo(`Acceso concedido · ${best.name} (similitud ${(1 - best.distance).toFixed(2)})`);
        sessionStorage.setItem("emp_auth", "face");
        sessionStorage.setItem("emp_name", best.name);
        await new Promise((r) => setTimeout(r, 700));
        stopStream();
        goNext(role);
      } else {
        setError(
          `Rostro no reconocido${best ? ` (distancia ${best.distance.toFixed(2)})` : ""}. Pide a soporte que te registre.`
        );
        setScanning(false);
        stopStream();
      }
    } catch (e) {
      console.error(e);
      setError("No se pudo acceder a la cámara.");
      setScanning(false);
      stopStream();
      setModelLoading(false);
    }
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
              <p className="text-sm text-muted-foreground">Reconocimiento facial por descriptor 128-d</p>
            </div>
          </div>

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
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-3 py-2 flex items-center gap-2 text-xs text-white">
                  <Loader2 className="h-3 w-3 animate-spin" /> Analizando rostro…
                </div>
              </>
            )}
            {modelLoading && !scanning && (
              <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-white">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando modelo…
              </div>
            )}
          </div>

          {info && (
            <p className="mt-3 text-xs text-primary flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5" /> {info}
            </p>
          )}
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

          <button
            onClick={startFaceScan}
            disabled={scanning || !role || modelLoading}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <ScanFace className="h-4 w-4" />
            {scanning ? "Escaneando…" : "Iniciar reconocimiento facial"}
          </button>

          {!role && (
            <p className="mt-2 text-[11px] text-center text-muted-foreground">
              Selecciona un perfil arriba para continuar
            </p>
          )}

          <p className="mt-3 text-[10px] text-center text-muted-foreground">
            {enrollments.length} rostro(s) registrado(s) · Umbral de similitud {MATCH_THRESHOLD}
          </p>

          <div className="my-5 h-px bg-border" />

          <Link
            to="/empleado/enroll"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-3 text-sm font-semibold hover:bg-accent"
          >
            <LifeBuoy className="h-4 w-4" /> Soporte · Registrar rostros
          </Link>
        </div>
      </div>
    </div>
  );
}
