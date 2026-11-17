import mongoose from "mongoose";

/**
 * Formats a Date into Indian Standard Time (IST - Asia/Kolkata, UTC+05:30)
 * Example output: "2026-11-01 10:25:30 IST"
 */
export function getISTTimestamp(date = new Date()) {
  if (typeof date === "string" && date.includes("IST")) {
    return date.trim();
  }

  let d;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === "number") {
    d = new Date(date);
  } else if (typeof date === "string") {
    d = new Date(date);
    if (isNaN(d.getTime())) {
      d = new Date(date.replace(/\s*IST\s*$/i, ""));
    }
  } else {
    d = new Date();
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const options = {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  };

  const parts = new Intl.DateTimeFormat("en-GB", options).formatToParts(d);
  const p = {};
  parts.forEach(({ type, value }) => {
    p[type] = value;
  });

  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} IST`;
}

/**
 * Returns ISO-8601 string with explicit IST (+05:30) offset
 */
export function getISTISO(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString();

  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffsetMs);
  return istDate.toISOString().replace("Z", "+05:30");
}

/**
 * Canonical 4 Administrative Regional Divisions of Maharashtra:
 * 1. Kokan (Mumbai, Thane, Raigad, Palghar, Ratnagiri, Sindhudurg)
 * 2. Marathvada (Chhatrapati Sambhajinagar, Nanded, Latur, Jalna, Beed, Parbhani, Osmanabad)
 * 3. Paschim (Pune, Kolhapur, Satara, Solapur, Sangli)
 * 4. Vidarbha (Amravati, Nagpur, Akola, Wardha, Yavatmal, Chandrapur)
 */
export const SUPPORTED_REGIONS = ["kokan", "marathvada", "paschim", "vidarbha"];

/**
 * Normalizes state region string to canonical regional key (e.g. "Kokan" -> "kokan")
 */
export function sanitizeRegionKey(region) {
  const norm = (region || "kokan").toLowerCase().trim();
  if (norm.includes("vidarbha") || norm.includes("amravati") || norm.includes("nagpur")) return "vidarbha";
  if (norm.includes("marath")) return "marathvada";
  if (norm.includes("paschim") || norm.includes("pune") || norm.includes("kolhapur") || norm.includes("western")) return "paschim";
  if (norm.includes("kokan") || norm.includes("konkan") || norm.includes("mumbai") || norm.includes("thane")) return "kokan";
  return "kokan";
}

/**
 * Minimal Regional Voter Schema
 * Stored strictly within dedicated regional collections:
 * voters_kokan, voters_marathvada, voters_paschim, voters_vidarbha
 */
export const MinimalVoterSchema = new mongoose.Schema(
  {
    voterId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    fingerprintSlot: {
      type: Number,
      required: true,
      min: 1,
      max: 127,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    region: {
      type: String,
      enum: ["Kokan", "Marathvada", "Paschim", "Vidarbha", "Konkan", "Marathwada"],
      default: "Kokan",
      index: true
    },
    district: {
      type: String,
      default: "Mumbai",
      index: true
    },
    constituency: {
      type: String,
      required: true
    },
    age: {
      type: Number,
      default: 25,
      min: 18,
      max: 120
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other", "Undisclosed"],
      default: "Undisclosed"
    },
    fingerIndex: {
      type: String,
      default: "Right Index Finger"
    },
    fingerprintTemplate: {
      type: String,
      default: "",
      trim: true
    },
    templateHash: {
      type: String,
      default: "",
      trim: true
    },
    hasVoted: {
      type: Boolean,
      default: false,
      index: true
    },
    votedParty: {
      type: String,
      default: null
    },
    transactionHash: {
      type: String,
      default: null
    },
    blockNumber: {
      type: Number,
      default: null
    },
    votedAt: {
      type: String,
      default: null
    },
    votedAtIST: {
      type: String,
      default: null
    },
    registrationAt: {
      type: String,
      default: () => getISTTimestamp()
    },
    registeredAt: {
      type: String,
      default: () => getISTTimestamp()
    },
    registrationAtIST: {
      type: String,
      default: () => getISTTimestamp()
    }
  },
  {
    versionKey: false,
    timestamps: false
  }
);

/**
 * Regional Cast Votes Schema
 * Incoming cast ballots partitioned strictly by region into separate collections:
 * votes_kokan, votes_marathvada, votes_paschim, votes_vidarbha
 */
export const RegionalVoteSchema = new mongoose.Schema(
  {
    voterId: {
      type: String,
      required: true,
      index: true
    },
    constituency: {
      type: String,
      required: true
    },
    region: {
      type: String,
      index: true
    },
    district: {
      type: String,
      index: true
    },
    party: {
      type: String,
      required: true
    },
    transactionHash: {
      type: String,
      default: null
    },
    blockNumber: {
      type: Number,
      default: null
    },
    votedAt: {
      type: String,
      default: () => getISTTimestamp()
    },
    votedAtIST: {
      type: String,
      default: () => getISTTimestamp()
    }
  },
  {
    versionKey: false,
    timestamps: false
  }
);

/**
 * Factory for regional citizen voter models (voters_kokan, voters_marathvada, etc.)
 * Serves as the single unified collection for both voter registration and cast ballot status per region.
 */
export function getRegionalVoterModel(region) {
  const key = sanitizeRegionKey(region);
  const collectionName = `voters_${key}`;
  const modelName = `Voter_${key}`;
  return mongoose.models[modelName] || mongoose.model(modelName, MinimalVoterSchema, collectionName);
}

/**
 * Maps to the unified single regional collection for backward compatibility
 */
export function getRegionalVoteModel(region) {
  return getRegionalVoterModel(region);
}

// Obsolete combined collection is retired; export regional model factory as default
export default getRegionalVoterModel;
