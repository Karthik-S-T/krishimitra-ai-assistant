/**
 * KrishiMitra AI — client-side image compression for farmer photos.
 *
 * Keeps uploads light for low-bandwidth farm connections: max 1280px on the
 * long edge, JPEG q≈0.72, capped at ~600 KB. Returns a data URL ready for
 * the vision action and for storage in the analysis history.
 */
const MAX_EDGE = 1280;
const MAX_BYTES = 600_000;

/** Max size accepted before compression (10 MB). */
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
/** Accepted photo formats for crop analysis. */
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/**
 * Validation errors surfaced as farmer-friendly toasts by the caller.
 * "not_image" → invalid file, "too_large" → file bigger than 10 MB.
 */
export type PhotoError = "not_image" | "too_large";

/**
 * Validate a picked photo BEFORE compression. Accepts JPG, JPEG, PNG, WEBP;
 * rejects anything else and anything over 10 MB. Some Android galleries
 * report an empty MIME type, so when unknown we fall back to the extension.
 */
export function validatePhoto(file: File): PhotoError | null {
  const knownType = ACCEPTED_TYPES.includes(file.type);
  const byExtension =
    !file.type && /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!knownType && !byExtension) return "not_image";
  if (file.size > MAX_INPUT_BYTES) return "too_large";
  return null;
}

export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("not_image");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("read_failed"));
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode_failed"));
    image.src = dataUrl;
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_failed");
  ctx.drawImage(img, 0, 0, w, h);

  let q = 0.72;
  let out = canvas.toDataURL("image/jpeg", q);
  while (out.length > MAX_BYTES && q > 0.35) {
    q -= 0.12;
    out = canvas.toDataURL("image/jpeg", q);
  }
  return out;
}
