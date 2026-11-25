/**
 * KrishiMitra AI — Phase 1 recommendation API.
 * Mirrors the planned REST surface: POST /api/recommend-crop.
 * Pure deterministic computation, so it runs as a cached Convex query.
 */
import { query } from "./_generated/server";
import { v } from "convex/values";
import { classifyCrop, validateModelInput } from "./lib/cropModel";

export const recommendCrop = query({
  args: {
    N: v.number(),
    P: v.number(),
    K: v.number(),
    temperature: v.number(),
    humidity: v.number(),
    ph: v.number(),
    rainfall: v.number(),
  },
  handler: (_ctx, args) => {
    const error = validateModelInput(args);
    if (error) throw new Error(error);
    return classifyCrop(args);
  },
});
