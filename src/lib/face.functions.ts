import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const HF_MODEL = "CarPeAs/reconocimiento-facial";
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

const EMOTIONS_ES: Record<string, string> = {
  angry: "Enojo",
  disgust: "Disgusto",
  fear: "Miedo",
  happy: "Felicidad",
  sad: "Tristeza",
  surprise: "Sorpresa",
  neutral: "Neutral",
};

export type FaceScanResult = {
  ok: boolean;
  emotion: string | null;
  emotionEs: string | null;
  score: number | null;
  source: "huggingface" | "fallback";
  error?: string;
};

export const analyzeFace = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        imageBase64: z.string().min(50).max(8_000_000),
      })
      .parse(input)
  )
  .handler(async ({ data }): Promise<FaceScanResult> => {
    const token = process.env.HUGGINGFACE_API_TOKEN;
    if (!token) {
      return {
        ok: false,
        emotion: null,
        emotionEs: null,
        score: null,
        source: "fallback",
        error: "HUGGINGFACE_API_TOKEN no configurado",
      };
    }

    try {
      const b64 = data.imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

      const res = await fetch(HF_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          Accept: "application/json",
        },
        body: bytes,
      });

      if (!res.ok) {
        const text = await res.text();
        return {
          ok: false,
          emotion: null,
          emotionEs: null,
          score: null,
          source: "fallback",
          error: `HF ${res.status}: ${text.slice(0, 200)}`,
        };
      }

      const json: unknown = await res.json();
      let top: { label: string; score: number } | null = null;

      if (Array.isArray(json)) {
        const flat = (Array.isArray(json[0]) ? json[0] : json) as Array<{
          label: string;
          score: number;
        }>;
        for (const cur of flat) {
          if (!top || cur.score > top.score) top = cur;
        }
      }

      if (!top) {
        return {
          ok: false,
          emotion: null,
          emotionEs: null,
          score: null,
          source: "fallback",
          error: "Respuesta inesperada del modelo",
        };
      }

      const key = top.label.toLowerCase();
      return {
        ok: true,
        emotion: top.label,
        emotionEs: EMOTIONS_ES[key] ?? top.label,
        score: top.score,
        source: "huggingface",
      };
    } catch (e) {
      return {
        ok: false,
        emotion: null,
        emotionEs: null,
        score: null,
        source: "fallback",
        error: e instanceof Error ? e.message : "Error desconocido",
      };
    }
  });
