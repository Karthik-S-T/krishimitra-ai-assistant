/**
 * KrishiMitra entry — master timeline.
 *
 * The 3D scene runs on a single normalized progress `P` (0..1) driven by
 * elapsed seconds, so every subsystem (camera, farmer, rings) reads the same
 * clock and stays in sync. HTML overlays switch phases on the same seconds.
 */

export const DURATION_S = 16; // full intro length (farmer walk → logo → cards)

/** Normalized progress 0..1 from elapsed seconds. */
export const progressOf = (elapsed: number) =>
  Math.min(1, Math.max(0, elapsed / DURATION_S));

/** Camera: wide establishing shot starts moving after a short hold. */
export const CAM_START = 0.04;
export const CAM_ARRIVE = 0.62; // camera reaches hero framing
export const CAM_PUSH_END = 1.0; // slow final push toward the farmer

/** Farmer walk window (walk cycle ref goes 0..1 inside this window). */
export const WALK_START = 0.06;
export const WALK_END = 0.58;
export const walkPhaseOf = (p: number) =>
  Math.min(1, Math.max(0, (p - WALK_START) / (WALK_END - WALK_START)));

/** AI rings / hologram ramp after the farmer stops. */
export const HOLO_START = 0.6;
export const HOLO_FULL = 0.72;

/** HTML overlay phase times (seconds since scene start). Spec order:
 *  farmer arrives → logo → motto → AI cards → ENTER button. */
export const OVERLAY = {
  loaderMinMs: 1100,
  brand: 10200, // KRISHIMITRA logo + tagline + motto
  cards: 12200, // AI feature cards appear one by one
  button: 14500, // ENTER KRISHIMITRA button
  skip: 3500, // skip control becomes available
} as const;

/** Smooth 0→1 ramp of x between edges. */
export const ramp = (x: number, a: number, b: number) =>
  Math.min(1, Math.max(0, (x - a) / (b - a)));

export const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
