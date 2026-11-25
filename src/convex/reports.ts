/**
 * KrishiMitra AI — soil report + recommendation snapshots.
 * Database requirement #14: store the farmer's soil data and the
 * recommendation that was produced from it.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

export const saveSoilReport = mutation({
  args: {
    lat: v.optional(v.number()),
    lon: v.optional(v.number()),
    village: v.optional(v.string()),
    taluk: v.optional(v.string()),
    district: v.optional(v.string()),
    surveyNumber: v.optional(v.string()),
    ph: v.number(),
    nitrogen: v.number(),
    phosphorus: v.number(),
    potassium: v.number(),
    soilSampleDate: v.optional(v.string()),
    soilDataSource: v.string(),
    temperature: v.optional(v.number()),
    humidity: v.optional(v.number()),
    rainfall: v.optional(v.number()),
    season: v.optional(v.string()),
    recommendedCrop: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserIdentity();
    const farmerId: string | undefined = userId?.subject;
    await ctx.db.insert("soilReports", {
      ...args,
      farmerId: farmerId as never,
    });
  },
});

/** The signed-in farmer's most recent soil report — used to prefill the
 * Phase 7 suitability engine with the farmer's own (user-provided) data. */
export const latestSoilReport = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const rows = await ctx.db
      .query("soilReports")
      .order("desc")
      .take(30);
    return rows.find((r) => r.farmerId === userId) ?? null;
  },
});

/** Called after a recommendation completes, to attach the crop to the report. */
export const attachRecommendation = mutation({
  args: { reportId: v.id("soilReports"), recommendedCrop: v.string() },
  handler: async (ctx, { reportId, recommendedCrop }) => {
    await ctx.db.patch(reportId, {
      recommendedCrop,
      recommendationDate: new Date().toISOString().slice(0, 10),
    });
    return reportId;
  },
});
