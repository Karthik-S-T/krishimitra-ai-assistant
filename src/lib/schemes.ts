/**
 * KrishiMitra AI — Government agriculture schemes registry.
 *
 * ONLY real, verifiable Government of India schemes with their official
 * websites are listed. Benefits/eligibility are summarized from the official
 * portals (last reviewed date shown). The app NEVER says "you are eligible" —
 * cards say "Potentially relevant based on the information provided" and
 * direct the farmer to verify with the official authority.
 *
 * `relevance` tags power light personalization (state-agnostic central
 * schemes; Karnataka state portal listed under resources).
 */

export interface Scheme {
  id: string;
  emoji: string;
  name: string;
  department: string;
  description: string;
  whoMayBenefit: string;
  documents: string[];
  process: string;
  officialSource: string;
  website: string;
  lastReviewed: string; // YYYY-MM-DD
  /** Tags used for personalization (never eligibility claims). */
  relevance: (
    | "all-farmers"
    | "landholders"
    | "crop-insurance"
    | "irrigation"
    | "soil"
    | "machinery"
    | "market"
    | "credit"
  )[];
}

export const SCHEMES: Scheme[] = [
  {
    id: "pm-kisan",
    emoji: "🌾",
    name: "PM-KISAN",
    department: "Ministry of Agriculture & Farmers Welfare, Government of India",
    description:
      "Income support of ₹6,000 per year in three equal instalments to eligible landholding farmer families, paid directly into bank accounts.",
    whoMayBenefit:
      "Landholding farmer families (subject to the exclusion criteria on the official portal, e.g. income-tax payers and institutional landholders are excluded).",
    documents: ["Aadhaar", "Land records (RTC/khata)", "Bank account details"],
    process:
      "Register through the official portal, a Common Service Centre (CSC), or via the village revenue officer / agriculture department.",
    officialSource: "pm-kisan.gov.in (official portal)",
    website: "https://pmkisan.gov.in/",
    lastReviewed: "2026-09-01",
    relevance: ["all-farmers", "landholders"],
  },
  {
    id: "pmfby",
    emoji: "🌧️",
    name: "PMFBY — Pradhan Mantri Fasal Bima Yojana (Crop Insurance)",
    department: "Ministry of Agriculture & Farmers Welfare, Government of India",
    description:
      "Comprehensive crop insurance against natural calamities, pests and diseases. Farmer premium share: ~2% for kharif, ~1.5% for rabi crops.",
    whoMayBenefit:
      "Farmers growing notified crops in notified areas — including sharecroppers and tenant farmers (with valid agreement, as per state norms).",
    documents: [
      "Aadhaar",
      "Land record / tenancy agreement",
      "Sowing certificate (as required)",
      "Bank account details",
    ],
    process:
      "Apply online on the official portal or via the CSC/bank within the notified enrolment window for the season.",
    officialSource: "pmfby.gov.in (official portal)",
    website: "https://pmfby.gov.in/",
    lastReviewed: "2026-09-01",
    relevance: ["all-farmers", "crop-insurance"],
  },
  {
    id: "pmkcc",
    emoji: "🏦",
    name: "Kisan Credit Card (KCC)",
    department: "Department of Financial Services / NABARD (with banks)",
    description:
      "Short-term credit for crop cultivation and allied activities at subsidised interest (with prompt-repayment benefit), issued as a rupee debit card.",
    whoMayBenefit:
      "Farmers (owners, tenants, sharecroppers, SHG members) cultivating land or engaged in allied activities; small/marginal farmers prioritised by banks.",
    documents: [
      "Identity proof (Aadhaar)",
      "Land documents / tenancy proof",
      "Crop plan",
      "Passport photos",
    ],
    process:
      "Apply at any bank branch / CSC / via the KCC saturation campaign camps; the bank verifies and sanctions the limit.",
    officialSource: "jansamarth / NABARD / bank branches",
    website: "https://www.myscheme.gov.in/schemes/kcc",
    lastReviewed: "2026-09-01",
    relevance: ["all-farmers", "credit"],
  },
  {
    id: "shc",
    emoji: "🌱",
    name: "Soil Health Card Scheme",
    department: "Department of Agriculture & Cooperation (state agriculture departments)",
    description:
      "Free/documented soil testing (N, P, K, pH, organic carbon and more) with a card carrying fertiliser recommendations based on the test.",
    whoMayBenefit:
      "All farmers; samples are usually collected village-wise through the state agriculture department's schedule.",
    documents: ["Land / survey details for the sample", "Aadhaar (as required by state)"],
    process:
      "Through the state agriculture department's soil-health portal or local agriculture officer / Raitha Samparka Kendra.",
    officialSource: "soilhealth.dac.gov.in (official portal)",
    website: "https://soilhealth.dac.gov.in/",
    lastReviewed: "2026-09-01",
    relevance: ["all-farmers", "soil"],
  },
  {
    id: "pmkusum",
    emoji: "☀️",
    name: "PM-KUSUM (Solar Pump / Solarisation)",
    department: "Ministry of New & Renewable Energy, Government of India",
    description:
      "Subsidised standalone solar agriculture pumps and solarisation of existing grid-connected pumps; supports irrigation cost reduction.",
    whoMayBenefit:
      "Individual farmers, water-user associations and cooperatives per state implementation norms and component limits.",
    documents: ["Aadhaar", "Land documents", "Pump details", "Bank account"],
    process:
      "Apply through the state renewable-energy development agency or designated vendor during the state's empanelment window.",
    officialSource: "pmkusum.mnre.gov.in (official portal)",
    website: "https://pmkusum.mnre.gov.in/",
    lastReviewed: "2026-09-01",
    relevance: ["irrigation"],
  },
  {
    id: "smam",
    emoji: "🚜",
    name: "SMAM — Farm Machinery & Equipment Subsidy",
    department: "Ministry of Agriculture & Farmers Welfare (Sub-Mission on Agricultural Mechanization)",
    description:
      "Subsidies for purchasing agricultural machinery (tractors, power tillers, implements) and establishing Custom Hiring Centres.",
    whoMayBenefit:
      "Individual farmers (higher assistance for small/marginal/women/SC-ST farmers) and groups establishing Custom Hiring Centres, per state norms.",
    documents: ["Aadhaar", "Land record", "Bank details", "Quotation of machinery"],
    process:
      "Apply on the Direct Benefit Transfer (DBT) agri portal of the department of agriculture; selection as per state guidelines.",
    officialSource: "agrimachinery.nic.in (official portal)",
    website: "https://agrimachinery.nic.in/",
    lastReviewed: "2026-09-01",
    relevance: ["machinery"],
  },
  {
    id: "enam",
    emoji: "📈",
    name: "e-NAM (National Agriculture Market)",
    department: "Ministry of Agriculture & Farmers Welfare (SFAC implementation)",
    description:
      "Electronic trading platform connecting APMC mandis for transparent online price discovery and direct online payment.",
    whoMayBenefit:
      "Farmers registered with a linked APMC mandi; registration is free through the portal or the e-NAM kiosk at the mandi.",
    documents: ["Aadhaar", "Bank account", "Mobile number"],
    process:
      "Register on enam.gov.in or at the e-NAM kiosk in a linked mandi; sell lots through the mandi's online auction.",
    officialSource: "enam.gov.in (official portal)",
    website: "https://enam.gov.in/",
    lastReviewed: "2026-09-01",
    relevance: ["all-farmers", "market"],
  },
  {
    id: "pmchcsc",
    emoji: "🚜",
    name: "Agri Infrastructure Fund (Custom Hiring / Post-harvest)",
    department: "Ministry of Agriculture & Farmers Welfare (AIF)",
    description:
      "Interest-subsidised financing for community farming assets — warehouses, custom hiring centres, processing units — via PM-MKSY umbrella.",
    whoMayBenefit:
      "Farmers, FPOs, PACS, agri-entrepreneurs and start-ups applying as individual or group projects via the AIF portal.",
    documents: ["Project proposal", "KYC", "Land/site documents", "Bank details"],
    process:
      "Submit the project on the official AIF portal; banks/financial institutions then appraise and sanction.",
    officialSource: "agriinfra.dac.gov.in (official portal)",
    website: "https://agriinfra.dac.gov.in/",
    lastReviewed: "2026-09-01",
    relevance: ["machinery", "market"],
  },
];

export const STATE_RESOURCES: Record<
  string,
  { name: string; website: string }[]
> = {
  Karnataka: [
    {
      name: "Karnataka Department of Agriculture (Raitha Samparka Kendra)",
      website: "https://raitamitra.karnataka.gov.in/",
    },
    {
      name: "Karnataka Soil Health & Fertiliser Management",
      website: "https://raitamitra.karnataka.gov.in/",
    },
  ],
};
