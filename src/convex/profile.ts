import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

/**
 * Farmer profile completeness + first-login profile setup.
 *
 * The users table (src/convex/schema.ts) now carries optional farmer profile
 * fields: phone, village, district, state, preferredLanguage and
 * profileCompleted. This module is the single write path for them.
 */

export const profileStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { signedIn: false as const, profileCompleted: false, needsProfile: false, isAnonymous: false };
    const user = await ctx.db.get(userId);
    if (!user) return { signedIn: true as const, profileCompleted: false, needsProfile: false, isAnonymous: false };
    const profileCompleted = user.profileCompleted === true;
    const isAnonymous = user.isAnonymous === true;
    return {
      signedIn: true as const,
      profileCompleted,
      // First-time farmers (real accounts without a completed profile) are
      // asked to complete their profile. Guests never are.
      needsProfile: !isAnonymous && !profileCompleted,
      isAnonymous,
    };
  },
});

export const completeProfile = mutation({
  args: {
    name: v.string(),
    village: v.string(),
    district: v.string(),
    state: v.string(),
    preferredLanguage: v.string(),
    landAreaAcres: v.optional(v.number()),
    irrigationType: v.optional(v.string()),
    currentCrop: v.optional(v.string()),
    sowingDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (user.isAnonymous) throw new Error("Guest users cannot complete a farmer profile. Please sign in.");

    const name = args.name.trim();
    const village = args.village.trim();
    if (name.length < 2) throw new Error("Please enter your full name.");
    if (village.length < 2) throw new Error("Please enter your village or location.");
    if (!args.district) throw new Error("Please select your district.");
    if (!args.state) throw new Error("Please select your state.");
    if (!["en", "kn", "hi"].includes(args.preferredLanguage)) {
      throw new Error("Please choose a valid language.");
    }
    if (
      args.landAreaAcres !== undefined &&
      (!Number.isFinite(args.landAreaAcres) || args.landAreaAcres < 0 || args.landAreaAcres > 100000)
    ) {
      throw new Error("Land area must be a non-negative number of acres.");
    }
    if (args.sowingDate && !/^\d{4}-\d{2}-\d{2}$/.test(args.sowingDate)) {
      throw new Error("Sowing date must be YYYY-MM-DD.");
    }

    await ctx.db.patch(userId, {
      name,
      village,
      district: args.district,
      state: args.state,
      preferredLanguage: args.preferredLanguage,
      profileCompleted: true,
      landAreaAcres: args.landAreaAcres,
      irrigationType: args.irrigationType,
      currentCrop: args.currentCrop,
      sowingDate: args.sowingDate,
    });
    return { ok: true as const };
  },
});

/** Mark an authenticated non-anonymous user's profile as complete without
 *  collecting details (used when an existing farmer skips setup). */
export const markProfileComplete = internalMutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const user = await ctx.db.get(userId);
    if (!user || user.isAnonymous) return { ok: false as const };
    await ctx.db.patch(userId, { profileCompleted: true });
    return { ok: true as const };
  },
});
