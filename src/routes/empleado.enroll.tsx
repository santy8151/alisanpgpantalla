import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Loader2, ScanFace, Trash2, UserPlus, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadFaceModels, computeDescriptorFromVideo } from "@/lib/face-recognition";

export const Route = createFileRoute("/empleado/enroll")({
  component: EnrollPage,
  head: () => ({ meta: [{ title: "Soporte · Reconocimiento facial | Alisan PG" }] }),
});

const SUPPORT_PASSWORD = "ReconocimientoAlisanPG";

type Enrollment = { id: string; name: string; created_at: string };

function EnrollPage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [list, setList] = useState<Enrollment[]>([]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const loadList = async () => {
    const { data } = await supabase
      .from("face_enrollments")
      .select("id,name,created_at")
      .order("created_at", { ascending: false });
    setList((data ?? []) as Enrollment[]);
  };

  useEffect(() => {
    if (authed) {
      loadList();
      setModelLoading(true);
      loadFaceModels().finally(() => setModelLoading(false));
    }
  }, [authed]);

  const tryAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === SUPPORT_PASSWORD) {
      setAuthed(true);
      setPwError(null);
    } else {
      setPwError("Contraseña incorrecta");
    }
  };

  const startCam = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setErr("No se pudo acceder a la cámara.");
    }
  };

  const enroll = async () => {
    setErr(null);
    setMsg(null);
    if (!name.trim()) {
      setErr("Ingresa el nombre de la persona.");
      return;
    }
    if (!videoRef.current) {
      setErr("Inicia la cámara primero.");
      return;
    }
    setSaving(true);
    try {
      const descriptor = await computeDescriptorFromVideo(videoRef.current);
      if (!descriptor) {
        setErr("No se detectó un rostro. Asegúrate de estar bien iluminado y de frente.");
        setSaving(false);
        return;
      }
      const { error } = await supabase.from("face_enrollments").insert({
        name: name.trim(),
        descriptor: Array.from(descriptor),
      });
      if (error) throw error;
      setMsg(`Rostro de "${name.trim()}" guardado correctamente.`);
      setName("");
      await loadList();
    } catch (e) {
      setErr((e as Error).message ?? "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este rostro?")) return;
    await supabase.from("face_enrollments").delete().eq("id", id);
    await loadList();
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <button
            onClick={() => navigate({ to: "/empleado" })}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <form onSubmit={tryAuth} className="rounded-2xl border bg-card p-8 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Acceso de soporte</h1>
                <p className="text-sm text-muted-foreground">Ingresa la contraseña</p>
              </div>
            </div>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Contraseña"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
              autoFocus
            />
            {pwError && <p className="mt-2 text-xs text-destructive">{pwError}</p>}
            <button
              type="submit"
              className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <Link to="/empleado" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Volver a empleado
        </Link>

        <div className="rounded-2xl border bg-card p-6 shadow-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ScanFace className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Registro de rostros</h1>
              <p className="text-sm text-muted-foreground">
                Captura el rostro y guarda sus longitudes matemáticas (descriptor 128-d)
              </p>
            </div>
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            {!cameraOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
                <Camera className="h-10 w-10 opacity-60" />
              </div>
            )}
            {modelLoading && (
              <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-white">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando modelo…
              </div>
            )}
          </div>

          {!cameraOn ? (
            <button
              onClick={startCam}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Camera className="h-4 w-4" /> Activar cámara
            </button>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la persona"
                className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
              />
              <button
                onClick={enroll}
                disabled={saving || modelLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {saving ? "Guardando…" : "Capturar y guardar"}
              </button>
            </div>
          )}

          {msg && <p className="mt-3 text-xs text-primary">{msg}</p>}
          {err && <p className="mt-3 text-xs text-destructive">{err}</p>}
        </div>

        <div className="mt-6 rounded-2xl border bg-card p-6 shadow-xl">
          <h2 className="text-base font-bold mb-3">Personas registradas ({list.length})</h2>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay rostros guardados.</p>
          ) : (
            <ul className="divide-y">
              {list.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(p.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(p.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
