import mongoose from "mongoose";

/**
 * Formats a Date into Indian Standard Time (IST - Asia/Kolkata, UTC+05:30)
 * Example output: "2026-10-30 10:25:30 IST"
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
 * Returns ISO-8601 string with explicit IST (+05:30) offset:
 * Example: "2026-10-30T10:25:40.123+05:30"
 */
export function getISTISO(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString();

  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffsetMs);
  return istDate.toISOString().replace("Z", "+05:30");
}

/**
 * Citizen Voter Schema
 * Stores demographic information, franchise identification, and biometric templates on MongoDB:
 * _id, voterId, name, constituency, region, district, age, gender, fingerIndex, fingerprintTemplate, templateHash, fingerprintSlot, hasVoted, registrationAt
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
      enum: ["Konkan", "Vidarbha", "Marathwada", "Paschim"],
      default: "Konkan",
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
 * Minimal Regional Vote Schema
 * Cast ballots partitioned by constituency into separate collections (votes_konkan, votes_vidarbha, etc.)
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
 * Normalizes state region string (e.g. "Konkan" -> "konkan")
 */
function sanitizeRegionKey(region) {
  const norm = (region || "Konkan").toLowerCase().trim();
  if (norm.includes("vidarbha")) return "vidarbha";
  if (norm.includes("marathwada")) return "marathwada";
  if (norm.includes("paschim")) return "paschim";
  return "konkan";
}

/**
 * Factory for regional citizen voter models
 */
export function getRegionalVoterModel(region) {
  const key = sanitizeRegionKey(region);
  const collectionName = `voters_${key}`;
  const modelName = `Voter_${key}`;
  return mongoose.models[modelName] || mongoose.model(modelName, MinimalVoterSchema, collectionName);
}

/**
 * Factory for regional cast votes models
 */
export function getRegionalVoteModel(region) {
  const key = sanitizeRegionKey(region);
  const collectionName = `votes_${key}`;
  const modelName = `Vote_${key}`;
  return mongoose.models[modelName] || mongoose.model(modelName, RegionalVoteSchema, collectionName);
}

export const FingerprintVoter = mongoose.models.FingerprintVoter || mongoose.model("FingerprintVoter", MinimalVoterSchema, "fingerprintvoters");
export default FingerprintVoter;
