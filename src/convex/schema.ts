import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      phone: v.optional(v.string()), // phone of the user. do not remove
      phoneVerificationTime: v.optional(v.number()), // phone verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove

      // Farmer profile (first-login setup, written only via convex/profile.ts)
      village: v.optional(v.string()),
      district: v.optional(v.string()),
      state: v.optional(v.string()),
      preferredLanguage: v.optional(v.string()), // "en" | "kn" | "hi"
      profileCompleted: v.optional(v.boolean()),

      // Farmer profile extras (edit-profile). Optional — never fabricated.
      landAreaAcres: v.optional(v.number()),
      irrigationType: v.optional(v.string()), // rainfed | canal | borewell | well | other
      currentCrop: v.optional(v.string()),
      sowingDate: v.optional(v.string()), // YYYY-MM-DD
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // add other tables here

    // Live Soil & Rainfall: cache of the last successful fetch per ~1 km grid
    // key, so farmers still see real data (with its timestamp) when the live
    // fetch fails. Never caches fabricated values.
    soilRainCache: defineTable({
      key: v.string(), // "lat,lon" rounded to 2 decimals
      data: v.any(), // SoilRainData shape from convex/soilRain.ts
      fetchedAt: v.number(), // ms epoch
    }).index("by_key", ["key"]),

    // Real soil-test records (Soil Health Card labs / KVK records) seeded by
    // officers. The app only shows these if a farmer is within 50 km — and
    // always with the source + test date + distance. Never auto-generated.
    soilTests: defineTable({
      label: v.string(), // "KVK Shimoga lab" / village name
      district: v.optional(v.string()),
      lat: v.number(),
      lon: v.number(),
      ph: v.number(),
      n: v.number(), // kg/ha
      p: v.number(), // kg/ha
      k: v.number(), // kg/ha
      testedOn: v.string(), // YYYY-MM-DD
      source: v.string(), // e.g. "Soil Health Card lab, Dept. of Agriculture"
      // Optional extra parameters when the lab provides them:
      oc: v.optional(v.number()), // organic carbon %
      ec: v.optional(v.number()), // electrical conductivity dS/m
      s: v.optional(v.number()), // sulphur ppm
    }),

    // Market price prediction: cache of raw AGMARKNET price history per
    // crop+state+market so forecasts stay fast and data.gov.in quota is used
    // sparingly. Only real API records are cached — never invented prices.
    priceHistoryCache: defineTable({
      key: v.string(), // "h|crop|state|market"
      records: v.any(), // raw AGMARKNET records (cleaned shape)
      fetchedAt: v.number(), // ms epoch
    }).index("by_key", ["key"]),

    // Farmer-confirmed soil data (SHC upload OCR or manual lab entry) and the
    // recommendation snapshot per the project data model.
    soilReports: defineTable({
      farmerId: v.optional(v.id("users")),
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
      soilDataSource: v.string(), // "shc_upload" | "manual" | "nearest_test" | "gov_dataset"
      // Recommendation snapshot (filled when a crop is recommended):
      temperature: v.optional(v.number()),
      humidity: v.optional(v.number()),
      rainfall: v.optional(v.number()),
      season: v.optional(v.string()),
      recommendedCrop: v.optional(v.string()),
      recommendationDate: v.optional(v.string()),
    }),

    // tableName: defineTable({
    //   ...
    //   // table fields
    // }).index("by_field", ["field"])

    // Crop & Soil Photo Analysis: the farmer's fields. Each field has its own
    // analysis timeline; analyses are never overwritten, only appended.
    // Phase 4: optional GPS location + drawn farm boundary (geospatial data).
    fields: defineTable({
      userId: v.id("users"),
      fieldName: v.string(),
      village: v.optional(v.string()),
      taluk: v.optional(v.string()),
      district: v.optional(v.string()),
      state: v.optional(v.string()),
      country: v.optional(v.string()),
      lat: v.optional(v.number()),
      lon: v.optional(v.number()),
      boundary: v.optional(v.array(v.array(v.number()))), // [[lat,lng],...]
      areaSqM: v.optional(v.number()), // polygon area in m²
      geoUpdatedAt: v.optional(v.number()),
      area: v.optional(v.number()), // acres (manual entry, Phase 1)
      crop: v.optional(v.string()), // one of the 22 model crops (free text ok)
      variety: v.optional(v.string()),
      sowingDate: v.optional(v.string()), // YYYY-MM-DD
      irrigationType: v.optional(v.string()), // rainfed | canal | borewell | well | other
    })
      .index("by_user", ["userId"]),

    // Saved results of every completed AI crop-photo analysis (append-only).
    cropAnalyses: defineTable({
      userId: v.id("users"),
      fieldId: v.id("fields"),
      analyzedAt: v.number(), // ms epoch
      images: v.array(v.string()), // compressed data URLs
      crop: v.string(),
      variety: v.optional(v.string()),
      cropAgeDays: v.optional(v.number()),
      growthStage: v.optional(v.string()),
      village: v.optional(v.string()),
      taluk: v.optional(v.string()),
      district: v.optional(v.string()),
      areaAcres: v.optional(v.number()),
      healthStatus: v.string(), // healthy | mild_stress | moderate_stress | severe_stress
      healthScore: v.optional(v.number()), // 0–100
      observations: v.array(v.string()), // disease/pest/nutrition observations
      fertilizerAdvice: v.optional(v.string()),
      irrigationAdvice: v.optional(v.string()),
      yieldLowQa: v.optional(v.number()), // quintals/acre band
      yieldHighQa: v.optional(v.number()),
      confidence: v.optional(v.number()), // 0–1
      aiResponse: v.optional(v.string()), // full model text
      engine: v.string(), // "llm" | "offline"
      farmerNotes: v.optional(v.string()),
    })
      .index("by_user", ["userId"])
      .index("by_field", ["fieldId", "analyzedAt"]),

    // Crop monitoring reminders (7/14/30 days or a custom date).
    monitorReminders: defineTable({
      userId: v.id("users"),
      fieldId: v.id("fields"),
      frequencyDays: v.optional(v.number()), // 7 | 14 | 30 | null for custom
      customDate: v.optional(v.string()), // YYYY-MM-DD when frequencyDays null
      nextDate: v.number(), // ms epoch of next reminder
      enabled: v.boolean(),
    })
      .index("by_user", ["userId"])
      .index("by_field", ["fieldId"]),

    // Phase 4 — GPS + farm mapping: optional geolocation and drawn boundary
    // stored on the EXISTING fields table (no duplicate farm model).
    // boundary: [[lat, lng], ...] polygon vertices drawn by the farmer on the
    // map. areaSqM is computed from the polygon (turf) — never guessed from
    // a single GPS point.

    // Phase 6 — satellite analysis cache: real Sentinel-2 scene metadata +
    // TiTiler-computed NDVI/EVI/NDWI statistics for one farm boundary+date
    // range. Only genuine provider results are cached, never invented ones.
    satelliteCache: defineTable({
      key: v.string(), // hash of boundary+days+maxCloud
      data: v.any(), // SatelliteResult shape from convex/satellite.ts
      fetchedAt: v.number(),
    }).index("by_key", ["key"]),

    // Smart Farming Alerts: one row per generated alert. Content is derived
    // ONLY from real inputs (weather forecast, mandi trend, field crop stage,
    // soil report) — the client renders it localized via ruleKey + params.
    farmAlerts: defineTable({
      userId: v.id("users"),
      ruleKey: v.string(), // "rain" | "heat" | "market" | "stage" | "disease" | "soil_ph"
      dayKey: v.string(), // dedupe key YYYY-MM-DD (+ params hash for market)
      severity: v.union(
        v.literal("info"),
        v.literal("warning"),
        v.literal("important"),
        v.literal("urgent"),
      ),
      params: v.any(), // localized rendering inputs {mm?, pct?, crop?, stage?, day?}
      source: v.string(), // "Open-Meteo forecast" / "AGMARKNET" / ...
      createdAt: v.number(),
      readAt: v.optional(v.number()),
      dismissed: v.optional(v.boolean()),
    })
      .index("by_user", ["userId"]),

    // Per-farmer notification toggle (alerts page enable/disable).
    alertSettings: defineTable({
      userId: v.id("users"),
      enabled: v.boolean(),
    }).index("by_user", ["userId"]),

    // Villages per State|District|Taluk from the official India Post PIN API
    // (real post-office localities, Block/District-verified). Cached
    // permanently so dropdowns are fast and the public API is hit once.
    villageCache: defineTable({
      key: v.string(), // "State|District|Taluk"
      villages: v.array(v.string()),
      fetchedAt: v.number(),
    }).index("by_key", ["key"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
