/**
 * KrishiMitra AI — Soil Health Card upload + extraction (Phase: auto-soil).
 * Mirrors the planned REST surface: POST /api/soil-card/upload.
 *
 * The farmer's card image is parsed by a vision-capable LLM when
 * OPENAI_API_KEY is configured (key stays server-side). Extraction is
 * strictly read-from-document: the model is instructed to return null for
 * any value not printed on the card — values are NEVER estimated.
 * Values are only used after the farmer confirms them in the UI.
 */
import { action } from "./_generated/server";
import { v } from "convex/values";

export interface ExtractedSoil {
  ph: number | null;
  n: number | null; // kg/ha
  p: number | null; // kg/ha
  k: number | null; // kg/ha
  oc: number | null; // organic carbon %
  ec: number | null; // electrical conductivity dS/m
  s: number | null; // sulphur ppm
  sampleDate: string | null; // YYYY-MM-DD or raw text
  locationText: string | null; // village/farm name printed on the card
  docType: string | null; // what the document looks like
  notes: string | null;
}

export type ExtractResponse =
  | { ok: true; data: ExtractedSoil; engine: "llm" }
  | { ok: false; reason: "missing_key" | "api_error" | "no_values_found" | "unsupported_file"; detail?: string };

const SYSTEM_PROMPT =
  "You are a document parser for Indian Soil Health Cards (Government of India scheme) " +
  "and generic soil-test laboratory reports. Extract ONLY values that are actually " +
  "printed in the document. Never estimate, never guess, never infer. If a parameter " +
  "is not on the document, return null for it. Units on Indian Soil Health Cards: " +
  "N/P/K in kg/ha, pH unitless, OC in %, EC in dS/m (or mmhos/cm), S in ppm (or kg/ha). " +
  'Reply with ONLY a JSON object: {"ph": number|null, "n": number|null, "p": number|null, ' +
  '"k": number|null, "oc": number|null, "ec": number|null, "s": number|null, ' +
  '"sampleDate": "YYYY-MM-DD"|null, "locationText": string|null, ' +
  '"docType": string|null, "notes": string|null}. In notes, add unit clarifications only.';

function coerce(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export const extractSoilCard = action({
  args: {
    // base64 data URL of the uploaded image or PDF first page
    fileDataUrl: v.string(),
    fileName: v.optional(v.string()),
  },
  handler: async (_ctx, { fileDataUrl, fileName }): Promise<ExtractResponse> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { ok: false, reason: "missing_key" };
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

    const isImage = /^data:image\//i.test(fileDataUrl);
    const isPdf = /^data:application\/pdf/i.test(fileDataUrl);
    if (!isImage && !isPdf) {
      return { ok: false, reason: "unsupported_file" };
    }
    if (fileDataUrl.length > 6_000_000) {
      return { ok: false, reason: "unsupported_file", detail: "file_too_large" };
    }

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          temperature: 0,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Extract the soil test values from this document" +
                    (fileName ? ` ("${fileName}")` : "") +
                    ". Return only the JSON object.",
                },
                {
                  type: "image_url",
                  image_url: { url: fileDataUrl },
                },
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        return { ok: false, reason: "api_error", detail: `HTTP ${res.status}` };
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      const jsonMatch = /\{[\s\S]*\}/.exec(content);
      if (!jsonMatch) return { ok: false, reason: "no_values_found" };
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } catch {
        return { ok: false, reason: "no_values_found" };
      }
      const out: ExtractedSoil = {
        ph: coerce(parsed.ph),
        n: coerce(parsed.n),
        p: coerce(parsed.p),
        k: coerce(parsed.k),
        oc: coerce(parsed.oc),
        ec: coerce(parsed.ec),
        s: coerce(parsed.s),
        sampleDate:
          typeof parsed.sampleDate === "string" && parsed.sampleDate.trim()
            ? parsed.sampleDate.trim()
            : null,
        locationText:
          typeof parsed.locationText === "string" && parsed.locationText.trim()
            ? parsed.locationText.trim()
            : null,
        docType:
          typeof parsed.docType === "string" && parsed.docType.trim()
            ? parsed.docType.trim()
            : null,
        notes:
          typeof parsed.notes === "string" && parsed.notes.trim()
            ? parsed.notes.trim()
            : null,
      };
      if (out.ph === null && out.n === null && out.p === null && out.k === null) {
        return { ok: false, reason: "no_values_found" };
      }
      return { ok: true, data: out, engine: "llm" };
    } catch (e) {
      return {
        ok: false,
        reason: "api_error",
        detail: e instanceof Error ? e.message : "fetch failed",
      };
    }
  },
});
