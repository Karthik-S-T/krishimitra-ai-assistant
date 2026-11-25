/**
 * KrishiMitra AI — Smart Farming Alerts API.
 *
 * syncAlerts receives ONLY real data the farmer already fetched (Open-Meteo
 * forecast / AGMARKNET trend) and derives alerts via the pure rule engine,
 * combined with the farmer's own fields + soil report. Deduped by dayKey.
 * Nothing is fabricated: missing inputs → no alerts.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { deriveAlerts } from "./lib/alertRules";

export const syncAlerts = mutation({
  args: {
    daily: v.optional(
      v.array(
        v.object({ date: v.string(), precipSum: v.number(), tMax: v.number() }),
      ),
    ),
    market: v.optional(
      v.object({
        crop: v.string(),
        commodity: v.string(),
        direction: v.union(
          v.literal("up"),
          v.literal("down"),
          v.literal("flat"),
        ),
        pct: v.number(),
        latestDate: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { ok: false as const };

    const fields = await ctx.db
      .query("fields")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Latest soil report pH belonging to this farmer (soilReports are scanned
    // newest-first; we pick the first row this farmer owns).
    const recentReports = await ctx.db.query("soilReports").order("desc").take(100);
    const myReport = recentReports.find((r) => r.farmerId === userId);

    const today = new Date().toISOString().slice(0, 10);
    const derived = deriveAlerts({
      today,
      daily: args.daily ?? null,
      market: args.market ?? null,
      fields: fields.map((f) => ({
        fieldName: f.fieldName,
        crop: f.crop ?? null,
        sowingDate: f.sowingDate ?? null,
      })),
      soilPh: myReport?.ph ?? null,
    });

    const existing = await ctx.db
      .query("farmAlerts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const seen = new Set(existing.map((e) => e.dayKey));

    let created = 0;
    for (const a of derived) {
      if (seen.has(a.dayKey)) continue;
      await ctx.db.insert("farmAlerts", {
        userId,
        ruleKey: a.ruleKey,
        severity: a.severity,
        dayKey: a.dayKey,
        params: a.params,
        source: a.source,
        createdAt: Date.now(),
        dismissed: false,
      });
      created++;
    }
    return { ok: true as const, created };
  },
});

export const listAlerts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { alerts: [], unread: 0, enabled: true };
    const rows = await ctx.db
      .query("farmAlerts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
    const settings = await ctx.db
      .query("alertSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const enabled = settings?.enabled ?? true;
    const alerts = rows
      .filter((r) => !r.dismissed)
      .sort((a, b) => {
        const w = { urgent: 0, important: 1, warning: 2, info: 3 } as const;
        return w[a.severity] - w[b.severity] || b.createdAt - a.createdAt;
      });
    const unread = alerts.filter((a) => a.readAt === undefined).length;
    return { alerts, unread, enabled };
  },
});

export const markRead = mutation({
  args: { alertId: v.id("farmAlerts") },
  handler: async (ctx, { alertId }) => {
    const userId = await getAuthUserId(ctx);
    const alert = await ctx.db.get(alertId);
    if (!alert || alert.userId !== userId) return;
    await ctx.db.patch(alertId, { readAt: Date.now() });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const rows = await ctx.db
      .query("farmAlerts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const r of rows) {
      if (r.readAt === undefined && !r.dismissed) {
        await ctx.db.patch(r._id, { readAt: Date.now() });
      }
    }
  },
});

export const dismissAlert = mutation({
  args: { alertId: v.id("farmAlerts") },
  handler: async (ctx, { alertId }) => {
    const userId = await getAuthUserId(ctx);
    const alert = await ctx.db.get(alertId);
    if (!alert || alert.userId !== userId) return;
    await ctx.db.patch(alertId, { dismissed: true });
  },
});

export const setAlertsEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const settings = await ctx.db
      .query("alertSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (settings) {
      await ctx.db.patch(settings._id, { enabled });
    } else {
      await ctx.db.insert("alertSettings", { userId, enabled });
    }
  },
});
