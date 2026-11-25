/**
 * KrishiMitra AI — Crop history data access (fields / analyses / reminders).
 *
 * All queries and mutations are scoped to the signed-in farmer via auth.
 * Analyses are append-only: createAnalysis never overwrites an older record.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

async function requireUser(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not signed in");
  return userId;
}

/** List the farmer's fields with their latest analysis summary. */
export const listFields = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const fields = await ctx.db
      .query("fields")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return fields;
  },
});

export const addField = mutation({
  args: {
    fieldName: v.string(),
    village: v.optional(v.string()),
    taluk: v.optional(v.string()),
    district: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    lat: v.optional(v.number()),
    lon: v.optional(v.number()),
    boundary: v.optional(v.array(v.array(v.number()))),
    areaSqM: v.optional(v.number()),
    area: v.optional(v.number()),
    crop: v.optional(v.string()),
    variety: v.optional(v.string()),
    sowingDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const id = await ctx.db.insert("fields", { userId, ...args });
    return id;
  },
});

export const updateField = mutation({
  args: {
    fieldId: v.id("fields"),
    fieldName: v.optional(v.string()),
    village: v.optional(v.string()),
    taluk: v.optional(v.string()),
    district: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    lat: v.optional(v.number()),
    lon: v.optional(v.number()),
    boundary: v.optional(v.array(v.array(v.number()))),
    areaSqM: v.optional(v.number()),
    geoUpdatedAt: v.optional(v.number()),
    area: v.optional(v.number()),
    crop: v.optional(v.string()),
    variety: v.optional(v.string()),
    sowingDate: v.optional(v.string()),
  },
  handler: async (ctx, { fieldId, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const field = await ctx.db.get(fieldId);
    if (!field || field.userId !== userId) throw new Error("Not found");
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    await ctx.db.patch(fieldId, clean);
  },
});

export const deleteField = mutation({
  args: { fieldId: v.id("fields") },
  handler: async (ctx, { fieldId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const field = await ctx.db.get(fieldId);
    if (!field || field.userId !== userId) throw new Error("Not found");
    // Deleting a field removes its timeline (UI asks for confirmation first).
    const analyses = await ctx.db
      .query("cropAnalyses")
      .withIndex("by_field", (q) => q.eq("fieldId", fieldId))
      .collect();
    for (const a of analyses) {
      await ctx.db.delete(a._id);
    }
    const rem = await ctx.db
      .query("monitorReminders")
      .withIndex("by_field", (q) => q.eq("fieldId", fieldId))
      .collect();
    for (const r of rem) {
      await ctx.db.delete(r._id);
    }
    await ctx.db.delete(fieldId);
  },
});

/** Recent analyses across all fields (reverse chronological). */
export const listAnalyses = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("cropAnalyses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    rows.sort((a, b) => b.analyzedAt - a.analyzedAt);
    return rows.slice(0, limit);
  },
});

/** All analyses of one field, chronological (oldest first) for timelines. */
export const listFieldAnalyses = query({
  args: { fieldId: v.id("fields") },
  handler: async (ctx, { fieldId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const field = await ctx.db.get(fieldId);
    if (!field || field.userId !== userId) return [];
    const rows = await ctx.db
      .query("cropAnalyses")
      .withIndex("by_field", (q) => q.eq("fieldId", fieldId))
      .collect();
    rows.sort((a, b) => a.analyzedAt - b.analyzedAt);
    return rows;
  },
});

export const getAnalysis = query({
  args: { analysisId: v.id("cropAnalyses") },
  handler: async (ctx, { analysisId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const a = await ctx.db.get(analysisId);
    if (!a || a.userId !== userId) return null;
    return a;
  },
});

/** Append a new analysis; returns its id. Never overwrites existing records. */
export const saveAnalysis = mutation({
  args: {
    fieldId: v.id("fields"),
    crop: v.string(),
    variety: v.optional(v.string()),
    cropAgeDays: v.optional(v.number()),
    growthStage: v.optional(v.string()),
    images: v.array(v.string()),
    healthStatus: v.string(),
    healthScore: v.optional(v.number()),
    observations: v.array(v.string()),
    fertilizerAdvice: v.optional(v.string()),
    irrigationAdvice: v.optional(v.string()),
    yieldLowQa: v.optional(v.number()),
    yieldHighQa: v.optional(v.number()),
    confidence: v.optional(v.number()),
    aiResponse: v.optional(v.string()),
    engine: v.string(),
    village: v.optional(v.string()),
    taluk: v.optional(v.string()),
    district: v.optional(v.string()),
    areaAcres: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const field = await ctx.db.get(args.fieldId);
    if (!field || field.userId !== userId) throw new Error("Field not found");
    const id = await ctx.db.insert("cropAnalyses", {
      userId,
      fieldId: args.fieldId,
      analyzedAt: Date.now(),
      images: args.images.slice(0, 4),
      crop: args.crop,
      variety: args.variety,
      cropAgeDays: args.cropAgeDays,
      growthStage: args.growthStage,
      village: args.village ?? field.village,
      taluk: args.taluk ?? field.taluk,
      district: args.district ?? field.district,
      areaAcres: args.areaAcres ?? field.area,
      healthStatus: args.healthStatus,
      healthScore: args.healthScore,
      observations: args.observations,
      fertilizerAdvice: args.fertilizerAdvice,
      irrigationAdvice: args.irrigationAdvice,
      yieldLowQa: args.yieldLowQa,
      yieldHighQa: args.yieldHighQa,
      confidence: args.confidence,
      aiResponse: args.aiResponse,
      engine: args.engine,
      farmerNotes: undefined,
    });
    return id;
  },
});

/** Farmer notes are additive context, not an AI overwrite. */
export const saveNotes = mutation({
  args: { analysisId: v.id("cropAnalyses"), notes: v.string() },
  handler: async (ctx, { analysisId, notes }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const a = await ctx.db.get(analysisId);
    if (!a || a.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(analysisId, { farmerNotes: notes.trim() || undefined });
  },
});

export const deleteAnalysis = mutation({
  args: { analysisId: v.id("cropAnalyses") },
  handler: async (ctx, { analysisId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const a = await ctx.db.get(analysisId);
    if (!a || a.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(analysisId);
  },
});

/** Get the latest analysis of a field (for current-vs-previous comparison). */
export const latestFieldAnalysis = query({
  args: { fieldId: v.id("fields") },
  handler: async (ctx, { fieldId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const field = await ctx.db.get(fieldId);
    if (!field || field.userId !== userId) return null;
    const rows = await ctx.db
      .query("cropAnalyses")
      .withIndex("by_field", (q) => q.eq("fieldId", fieldId))
      .collect();
    rows.sort((a, b) => b.analyzedAt - a.analyzedAt);
    return rows[0] ?? null;
  },
});

// ---- Reminders ---------------------------------------------------------------

export const getReminder = query({
  args: { fieldId: v.id("fields") },
  handler: async (ctx, { fieldId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const field = await ctx.db.get(fieldId);
    if (!field || field.userId !== userId) return null;
    const rows = await ctx.db
      .query("monitorReminders")
      .withIndex("by_field", (q) => q.eq("fieldId", fieldId))
      .collect();
    return rows[0] ?? null;
  },
});

export const setReminder = mutation({
  args: {
    fieldId: v.id("fields"),
    frequencyDays: v.optional(v.number()),
    customDate: v.optional(v.string()),
    enabled: v.boolean(),
  },
  handler: async (ctx, { fieldId, frequencyDays, customDate, enabled }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const field = await ctx.db.get(fieldId);
    if (!field || field.userId !== userId) throw new Error("Field not found");
    const rows = await ctx.db
      .query("monitorReminders")
      .withIndex("by_field", (q) => q.eq("fieldId", fieldId))
      .collect();
    const now = Date.now();
    const next =
      customDate != null && customDate.trim() !== ""
        ? new Date(`${customDate}T09:00:00`).getTime()
        : now + (frequencyDays ?? 7) * 24 * 3600 * 1000;
    if (rows[0]) {
      await ctx.db.patch(rows[0]._id, {
        frequencyDays,
        customDate,
        enabled,
        nextDate: next,
      });
      return rows[0]._id;
    }
    return ctx.db.insert("monitorReminders", {
      userId,
      fieldId,
      frequencyDays,
      customDate,
      enabled,
      nextDate: next,
    });
  },
});

/** Due reminders for the signed-in farmer (nextDate <= now). */
export const dueReminders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("monitorReminders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const now = Date.now();
    return rows.filter((r) => r.enabled && r.nextDate <= now);
  },
});

/** Reschedule after the farmer completes a scan (snooze to next cycle). */
export const rescheduleReminder = mutation({
  args: { reminderId: v.id("monitorReminders") },
  handler: async (ctx, { reminderId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const r = await ctx.db.get(reminderId);
    if (!r || r.userId !== userId) throw new Error("Not found");
    const days = r.frequencyDays ?? 7;
    await ctx.db.patch(reminderId, { nextDate: Date.now() + days * 24 * 3600 * 1000 });
  },
});
