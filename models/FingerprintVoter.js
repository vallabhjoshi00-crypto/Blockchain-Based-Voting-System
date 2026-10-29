import mongoose from "mongoose";

/**
 * Minimal Citizen Voter Schema
 * Stores essential demographic and franchise identification only:
 * _id, voterId, name, constituency, region, district, age, gender, fingerIndex, registrationAt, registeredAt, fingerprintSlot, hasVoted
 * (Excludes heavy 1024-char templates, hashes, quality telemetry, and audit artifacts)
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
    hasVoted: {
      type: Boolean,
      default: false,
      index: true
    },
    registrationAt: {
      type: Date,
      default: Date.now
    },
    registeredAt: {
      type: Date,
      default: Date.now
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
      type: Date,
      default: Date.now
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
 * Helper to get region-specific Voter model (e.g. voters_konkan, voters_marathwada)
 */
export function getRegionalVoterModel(region) {
  const regKey = sanitizeRegionKey(region);
  const collName = `voters_${regKey}`;
  if (mongoose.models[collName]) {
    return mongoose.models[collName];
  }
  return mongoose.model(collName, MinimalVoterSchema, collName);
}

/**
 * Helper to get region-specific Cast Ballot model (e.g. votes_konkan, votes_marathwada)
 */
export function getRegionalVoteModel(region) {
  const regKey = sanitizeRegionKey(region);
  const collName = `votes_${regKey}`;
  if (mongoose.models[collName]) {
    return mongoose.models[collName];
  }
  return mongoose.model(collName, RegionalVoteSchema, collName);
}

export const FingerprintVoter =
  mongoose.models.FingerprintVoter || mongoose.model("FingerprintVoter", MinimalVoterSchema);
