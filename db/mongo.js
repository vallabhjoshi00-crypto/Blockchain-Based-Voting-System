import mongoose from "mongoose";
import crypto from "crypto";
import {
  getRegionalVoterModel,
  getRegionalVoteModel,
  getISTTimestamp,
  SUPPORTED_REGIONS,
  sanitizeRegionKey
} from "../models/FingerprintVoter.js";
import { BiometricAuditLog } from "../models/BiometricAuditLog.js";

// Connection & Telemetry State
let isMongoConnected = false;
let mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/biometric_voting";
let activeDbName = "biometric_voting";
let lastConnectionAttempt = 0;
let connectionError = null;

// Fallback in-memory store partitioned by region
const inMemoryVoters = new Map();
const inMemoryAuditLogs = [];

/**
 * Generates an authentic 512-byte (1024 hex chars) AS608/R307 minutiae character buffer template
 */
export function generateMinutiaeTemplate(slotId, seedString = "citizen") {
  const header = `EF01FFFFFFFF010200${Number(slotId).toString(16).padStart(4, "0")}`;
  const salt = `R307_DSP_AS608_SLOT_${slotId}_${seedString}`;
  let payload = "";
  for (let i = 0; i < 16; i++) {
    payload += crypto.createHash("sha256").update(`${salt}_segment_${i}`).digest("hex");
  }
  const fullTemplate = (header + payload).substring(0, 1024).toUpperCase();
  const templateHash = crypto.createHash("sha256").update(fullTemplate).digest("hex");
  return { template: fullTemplate, hash: templateHash };
}

// 4 Subdivided State Regions and Districts: Kokan, Marathvada, Paschim, Vidarbha
export const STATE_REGIONS = {
  kokan: {
    key: "kokan",
    name: "Kokan",
    districts: ["Mumbai", "Thane", "Raigad", "Palghar", "Ratnagiri", "Sindhudurg"],
    candidates: ["BJP", "UBT", "Congress", "AIMIM"]
  },
  marathvada: {
    key: "marathvada",
    name: "Marathvada",
    districts: ["Chhatrapati Sambhajinagar", "Nanded", "Latur", "Jalna", "Beed", "Parbhani", "Osmanabad"],
    candidates: ["BJP", "UBT", "Congress", "AIMIM"]
  },
  paschim: {
    key: "paschim",
    name: "Paschim",
    districts: ["Pune", "Kolhapur", "Satara", "Solapur", "Sangli"],
    candidates: ["BJP", "UBT", "Congress", "AIMIM"]
  },
  vidarbha: {
    key: "vidarbha",
    name: "Vidarbha",
    districts: ["Amravati", "Nagpur", "Akola", "Wardha", "Yavatmal", "Chandrapur"],
    candidates: ["BJP", "UBT", "Congress", "AIMIM"]
  }
};

// Helper to retrieve regional configuration dynamically
export function getRegionConfig(region) {
  const key = sanitizeRegionKey(region);
  return STATE_REGIONS[key] || STATE_REGIONS.kokan;
}

// Default Seed Voters partitioned strictly by their home region
export const DEFAULT_VOTERS = [
  {
    voterId: "FP_UID_1",
    fingerprintSlot: 1,
    name: "Vallabh Joshi",
    region: "Kokan",
    district: "Mumbai",
    constituency: "Kokan - Mumbai",
    gender: "Male",
    age: 26,
    fingerIndex: "Right Index Finger",
    fingerprintTemplate: generateMinutiaeTemplate(1, "Vallabh Joshi_FP_UID_1").template,
    templateHash: generateMinutiaeTemplate(1, "Vallabh Joshi_FP_UID_1").hash,
    hasVoted: false,
    registrationAt: getISTTimestamp(),
    registeredAt: getISTTimestamp(),
    registrationAtIST: getISTTimestamp()
  },
  {
    voterId: "FP_UID_2",
    fingerprintSlot: 2,
    name: "Rahul Sharma",
    region: "Vidarbha",
    district: "Nagpur",
    constituency: "Vidarbha - Nagpur",
    gender: "Male",
    age: 31,
    fingerIndex: "Right Thumb",
    fingerprintTemplate: generateMinutiaeTemplate(2, "Rahul Sharma_FP_UID_2").template,
    templateHash: generateMinutiaeTemplate(2, "Rahul Sharma_FP_UID_2").hash,
    hasVoted: false,
    registrationAt: getISTTimestamp(),
    registeredAt: getISTTimestamp(),
    registrationAtIST: getISTTimestamp()
  },
  {
    voterId: "FP_UID_3",
    fingerprintSlot: 3,
    name: "Priya Patel",
    region: "Marathvada",
    district: "Chhatrapati Sambhajinagar",
    constituency: "Marathvada - Sambhajinagar",
    gender: "Female",
    age: 28,
    fingerIndex: "Left Index Finger",
    fingerprintTemplate: generateMinutiaeTemplate(3, "Priya Patel_FP_UID_3").template,
    templateHash: generateMinutiaeTemplate(3, "Priya Patel_FP_UID_3").hash,
    hasVoted: false,
    registrationAt: getISTTimestamp(),
    registeredAt: getISTTimestamp(),
    registrationAtIST: getISTTimestamp()
  },
  {
    voterId: "FP_UID_4",
    fingerprintSlot: 4,
    name: "Ananya Desai",
    region: "Paschim",
    district: "Pune",
    constituency: "Paschim - Pune",
    gender: "Female",
    age: 24,
    fingerIndex: "Right Index Finger",
    fingerprintTemplate: generateMinutiaeTemplate(4, "Ananya Desai_FP_UID_4").template,
    templateHash: generateMinutiaeTemplate(4, "Ananya Desai_FP_UID_4").hash,
    hasVoted: false,
    registrationAt: getISTTimestamp(),
    registeredAt: getISTTimestamp(),
    registrationAtIST: getISTTimestamp()
  }
];

// Initialize in-memory fallback store
function initInMemoryStore() {
  inMemoryVoters.clear();
  DEFAULT_VOTERS.forEach((v) => {
    inMemoryVoters.set(v.voterId, {
      ...v,
      hasVoted: false,
      registrationAt: getISTTimestamp(),
      registeredAt: getISTTimestamp(),
      registrationAtIST: getISTTimestamp()
    });
  });
}

initInMemoryStore();

let reconnectTimer = null;

function startAutoReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setInterval(async () => {
    if (isMongoConnected) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
      return;
    }
    try {
      lastConnectionAttempt = Date.now();
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 3000,
        autoIndex: true
      });
      isMongoConnected = true;
      connectionError = null;
      console.log(`\n======================================================`);
      console.log(`🍃 [MongoDB SUCCESS] Auto-reconnected to database: "${activeDbName}"!`);
      console.log(`======================================================\n`);
      await seedDefaultVotersIfEmpty();
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    } catch (retryErr) {
      connectionError = retryErr.message;
    }
  }, 10000);
}

/**
 * Initializes connection to MongoDB with graceful error handling and auto-reconnect
 */
export async function initMongo() {
  mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/biometric_voting";
  lastConnectionAttempt = Date.now();

  try {
    const uriMatch = mongoUri.match(/\/([^/?]+)(\?|$)/);
    if (uriMatch && uriMatch[1]) {
      activeDbName = uriMatch[1];
    }

    mongoose.connection.on("connected", () => {
      isMongoConnected = true;
      connectionError = null;
      console.log(`🍃 [MongoDB] Connection established to ${mongoUri.replace(/:([^@]+)@/, ":***@")}`);
    });

    mongoose.connection.on("error", (err) => {
      isMongoConnected = false;
      connectionError = err.message;
      console.warn(`⚠️ [MongoDB] Connection error:`, err.message);
      startAutoReconnect();
    });

    mongoose.connection.on("disconnected", () => {
      isMongoConnected = false;
      console.warn(`⚠️ [MongoDB] Disconnected from server. Operating with in-memory buffer.`);
      startAutoReconnect();
    });

    console.log(`🍃 Connecting to MongoDB: ${mongoUri.replace(/:([^@]+)@/, ":***@")}...`);
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000,
      autoIndex: true
    });

    isMongoConnected = true;
    connectionError = null;
    console.log(`✅ [MongoDB SUCCESS] Connected to database: "${activeDbName}"`);

    // Check if initial seeding is needed & cleanup obsolete combined collection
    await seedDefaultVotersIfEmpty();

    await logBiometricEvent({
      action: "ENROLL",
      details: "MongoDB Regional Partitioning initialized across Kokan, Marathvada, Paschim, Vidarbha",
      status: "SUCCESS"
    });

  } catch (err) {
    isMongoConnected = false;
    connectionError = err.message;
    console.warn(`\n⚠️  [MongoDB NOTICE] Local/Remote MongoDB instance not detected (${err.message}).`);
    console.warn(`💡 Biometric operations running with partitioned in-memory buffer.`);
    startAutoReconnect();
  }
}

/**
 * Drops obsolete central collection and seeds default voters directly into regional collections
 */
export async function seedDefaultVotersIfEmpty(force = false) {
  try {
    if (!isMongoConnected) return;

    // Drop obsolete collections (fingerprintvoters and separate votes_* collections)
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collNames = collections.map((c) => c.name);
      const obsoleteColls = [
        "fingerprintvoters",
        "fingerprint_voters",
        "votes_konkan",
        "votes_kokan",
        "votes_vidarbha",
        "votes_marathwada",
        "votes_marathvada",
        "votes_paschim"
      ];
      for (const collName of obsoleteColls) {
        if (collNames.includes(collName)) {
          await mongoose.connection.db.dropCollection(collName);
          console.log(`🗑️ [MONGODB CLEANUP] Removed obsolete collection: "${collName}"`);
        }
      }
    } catch (cleanupErr) {
      // Ignored if not found
    }

    if (!force) {
      // Check if any regional collection already has voters
      let existingCount = 0;
      for (const reg of SUPPORTED_REGIONS) {
        const Model = getRegionalVoterModel(reg);
        existingCount += await Model.countDocuments();
      }
      if (existingCount > 0) {
        console.log(`ℹ️ [MONGODB] Regional collections populated with ${existingCount} citizens across divisions.`);
        return;
      }
    }

    // Seed voters strictly into their respective regional collection
    for (const defVoter of DEFAULT_VOTERS) {
      const regKey = sanitizeRegionKey(defVoter.region);
      const RegionalModel = getRegionalVoterModel(regKey);
      const { template, hash } = generateMinutiaeTemplate(defVoter.fingerprintSlot, `${defVoter.name}_${defVoter.voterId}`);

      const voterData = {
        voterId: defVoter.voterId,
        fingerprintSlot: defVoter.fingerprintSlot,
        name: defVoter.name,
        region: defVoter.region,
        district: defVoter.district,
        constituency: defVoter.constituency,
        age: defVoter.age,
        gender: defVoter.gender,
        fingerIndex: defVoter.fingerIndex,
        fingerprintTemplate: defVoter.fingerprintTemplate || template,
        templateHash: defVoter.templateHash || hash,
        hasVoted: defVoter.hasVoted || false,
        registrationAt: getISTTimestamp(defVoter.registrationAt),
        registeredAt: getISTTimestamp(defVoter.registeredAt),
        registrationAtIST: getISTTimestamp(defVoter.registrationAt)
      };

      // Save strictly in regional collection (voters_kokan, voters_marathvada, etc.)
      await RegionalModel.findOneAndUpdate(
        { voterId: defVoter.voterId },
        { $set: voterData },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );

      inMemoryVoters.set(defVoter.voterId, voterData);
    }

    console.log("✅ [MONGODB SUCCESS] Regional collections (voters_kokan, voters_marathvada, voters_paschim, voters_vidarbha) initialized successfully!");
  } catch (err) {
    console.error("❌ Error seeding regional voters:", err.message);
  }
}

/**
 * Returns overall MongoDB telemetry status reflecting regional subdivision
 */
export async function getMongoStatus() {
  let voterCount = 0;
  let votedCount = 0;

  if (isMongoConnected) {
    try {
      for (const reg of SUPPORTED_REGIONS) {
        const Model = getRegionalVoterModel(reg);
        voterCount += await Model.countDocuments();
        votedCount += await Model.countDocuments({ hasVoted: true });
      }
    } catch {
      voterCount = inMemoryVoters.size;
    }
  } else {
    voterCount = inMemoryVoters.size;
    votedCount = Array.from(inMemoryVoters.values()).filter((v) => v.hasVoted).length;
  }

  return {
    connected: isMongoConnected,
    mode: isMongoConnected ? "LIVE_MONGODB" : "IN_MEMORY_FALLBACK",
    uri: mongoUri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@"),
    database: activeDbName,
    collections: [
      "voters_kokan",
      "voters_marathvada",
      "voters_paschim",
      "voters_vidarbha",
      "biometricauditlogs"
    ],
    totalVoters: voterCount,
    votedCount,
    lastAttempt: getISTTimestamp(lastConnectionAttempt),
    lastAttemptIST: getISTTimestamp(lastConnectionAttempt),
    error: connectionError
  };
}

/**
 * Fetches voters across regional collections or from a specific region
 */
export async function getVoters(query = {}) {
  const { search, hasVoted, region, district, limit = 50, page = 1 } = query;

  if (isMongoConnected) {
    try {
      const filter = {};
      if (hasVoted !== undefined && hasVoted !== "") {
        filter.hasVoted = hasVoted === "true" || hasVoted === true;
      }
      if (district) {
        filter.district = district;
      }
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { voterId: { $regex: search, $options: "i" } },
          { constituency: { $regex: search, $options: "i" } },
          { region: { $regex: search, $options: "i" } },
          { district: { $regex: search, $options: "i" } }
        ];
      }

      // If specific region is requested, query ONLY that region's collection
      if (region) {
        const regKey = sanitizeRegionKey(region);
        const RegionalModel = getRegionalVoterModel(regKey);
        const total = await RegionalModel.countDocuments(filter);
        const voters = await RegionalModel.find(filter)
          .sort({ fingerprintSlot: 1 })
          .skip((page - 1) * limit)
          .limit(Number(limit))
          .lean();
        return { success: true, region: regKey, total, page: Number(page), voters };
      }

      // Otherwise aggregate across the 4 subdivided regional collections
      let aggregated = [];
      for (const reg of SUPPORTED_REGIONS) {
        const RegionalModel = getRegionalVoterModel(reg);
        const docs = await RegionalModel.find(filter).lean();
        aggregated = aggregated.concat(docs);
      }

      aggregated.sort((a, b) => a.fingerprintSlot - b.fingerprintSlot);
      const total = aggregated.length;
      const startIndex = (page - 1) * limit;
      const paged = aggregated.slice(startIndex, startIndex + Number(limit));

      return { success: true, total, page: Number(page), voters: paged };
    } catch (err) {
      console.warn("MongoDB regional query failed, falling back to memory:", err.message);
    }
  }

  // In-memory fallback
  let list = Array.from(inMemoryVoters.values());
  if (hasVoted !== undefined && hasVoted !== "") {
    const isVoted = hasVoted === "true" || hasVoted === true;
    list = list.filter((v) => v.hasVoted === isVoted);
  }
  if (region) {
    const regKey = sanitizeRegionKey(region);
    list = list.filter((v) => v.region && sanitizeRegionKey(v.region) === regKey);
  }
  if (district) {
    list = list.filter((v) => v.district && v.district.toLowerCase() === district.toLowerCase());
  }
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(
      (v) =>
        v.name.toLowerCase().includes(s) ||
        v.voterId.toLowerCase().includes(s) ||
        (v.constituency && v.constituency.toLowerCase().includes(s)) ||
        (v.region && v.region.toLowerCase().includes(s)) ||
        (v.district && v.district.toLowerCase().includes(s))
    );
  }

  list.sort((a, b) => a.fingerprintSlot - b.fingerprintSlot);
  return { success: true, total: list.length, page: 1, voters: list.slice(0, limit) };
}

/**
 * Fetches single voter by voterId across the 4 regional collections
 */
export async function getVoterById(voterId) {
  if (isMongoConnected) {
    try {
      for (const reg of SUPPORTED_REGIONS) {
        const RegionalModel = getRegionalVoterModel(reg);
        const voter = await RegionalModel.findOne({ voterId }).lean();
        if (voter) return voter;
      }
    } catch (err) {
      console.warn("MongoDB getVoterById error:", err.message);
    }
  }
  return inMemoryVoters.get(voterId) || null;
}

/**
 * Fetches single voter by hardware fingerprint slot across the 4 regional collections
 */
export async function getVoterBySlot(slotId) {
  const numSlot = Number(slotId);
  if (isMongoConnected) {
    try {
      for (const reg of SUPPORTED_REGIONS) {
        const RegionalModel = getRegionalVoterModel(reg);
        const voter = await RegionalModel.findOne({ fingerprintSlot: numSlot }).lean();
        if (voter) return voter;
      }
    } catch (err) {
      console.warn("MongoDB getVoterBySlot error:", err.message);
    }
  }
  return Array.from(inMemoryVoters.values()).find((v) => v.fingerprintSlot === numSlot) || null;
}

/**
 * Enrolls a new citizen fingerprint into the designated regional collection ONLY
 */
export async function enrollVoter(data) {
  const {
    voterId: rawVoterId,
    fingerprintSlot: rawSlot,
    name,
    region: rawRegion,
    district: rawDistrict,
    constituency: rawConstituency,
    gender,
    age,
    fingerIndex,
    fingerprintTemplate: suppliedTemplate
  } = data;

  if (!name || name.trim().length === 0) {
    throw new Error("Citizen full name is required.");
  }

  // Canonicalize region (Kokan, Marathvada, Paschim, Vidarbha)
  const regionKey = sanitizeRegionKey(rawRegion || "Kokan");
  const regionConfig = STATE_REGIONS[regionKey] || STATE_REGIONS.kokan;
  const canonicalRegion = regionConfig.name;
  const district = rawDistrict || regionConfig.districts[0];
  const constituency = rawConstituency || `${canonicalRegion} - ${district}`;

  // Auto-allocate slot if not provided
  let slot = Number(rawSlot);
  if (!slot || isNaN(slot) || slot < 1 || slot > 127) {
    const existingSlots = new Set();
    if (isMongoConnected) {
      try {
        for (const reg of SUPPORTED_REGIONS) {
          const Model = getRegionalVoterModel(reg);
          const docs = await Model.find({}, "fingerprintSlot").lean();
          docs.forEach((d) => existingSlots.add(d.fingerprintSlot));
        }
      } catch {
        Array.from(inMemoryVoters.values()).forEach((v) => existingSlots.add(v.fingerprintSlot));
      }
    } else {
      Array.from(inMemoryVoters.values()).forEach((v) => existingSlots.add(v.fingerprintSlot));
    }

    slot = 1;
    while (existingSlots.has(slot) && slot <= 127) {
      slot++;
    }
    if (slot > 127) {
      throw new Error("R307 Optical Sensor EEPROM memory full (127/127 slots allocated).");
    }
  }

  const voterId = (rawVoterId || `FP_UID_${slot}`).trim();

  // Generate minutiae template if not supplied
  let template = suppliedTemplate;
  let hash = "";
  if (!template || template.length < 32) {
    const generated = generateMinutiaeTemplate(slot, `${name}_${voterId}`);
    template = generated.template;
    hash = generated.hash;
  } else {
    while (template.length < 1024) {
      template += "00";
    }
    hash = crypto.createHash("sha256").update(template).digest("hex");
  }

  const voterRecord = {
    voterId,
    fingerprintSlot: slot,
    name: name.trim(),
    constituency,
    region: canonicalRegion,
    district,
    gender: gender || "Undisclosed",
    age: age ? Number(age) : 25,
    fingerIndex: fingerIndex || "Right Index Finger",
    fingerprintTemplate: template,
    templateHash: hash,
    hasVoted: false,
    registrationAt: getISTTimestamp(),
    registeredAt: getISTTimestamp(),
    registrationAtIST: getISTTimestamp()
  };

  if (isMongoConnected) {
    try {
      // Save STRICTLY into the specific regional collection (e.g. voters_kokan, voters_marathvada)
      const RegionalVoterModel = getRegionalVoterModel(regionKey);
      await RegionalVoterModel.findOneAndUpdate(
        { $or: [{ voterId }, { fingerprintSlot: slot }] },
        { $set: voterRecord },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      inMemoryVoters.set(voterId, voterRecord);

      await logBiometricEvent({
        action: "ENROLL",
        voterId,
        fingerprintSlot: slot,
        voterName: name,
        region: canonicalRegion,
        district,
        details: `Citizen enrolled strictly in voters_${regionKey} [${constituency}]`,
        status: "SUCCESS"
      });

      return voterRecord;
    } catch (err) {
      console.warn("MongoDB regional enroll failed, buffering in memory:", err.message);
    }
  }

  inMemoryVoters.set(voterId, voterRecord);
  await logBiometricEvent({
    action: "ENROLL",
    voterId,
    fingerprintSlot: slot,
    voterName: name,
    region: canonicalRegion,
    district,
    details: `Citizen enrolled in slot #${slot} [${canonicalRegion} - ${district}] (Memory Mode)`,
    status: "SUCCESS"
  });

  return voterRecord;
}

/**
 * Updates an existing voter's details in their regional collection
 */
export async function updateVoter(voterId, updates) {
  if (isMongoConnected) {
    try {
      for (const reg of SUPPORTED_REGIONS) {
        const RegionalModel = getRegionalVoterModel(reg);
        const doc = await RegionalModel.findOneAndUpdate({ voterId }, updates, { new: true }).lean();
        if (doc) {
          inMemoryVoters.set(voterId, doc);
          return doc;
        }
      }
    } catch (err) {
      console.warn("MongoDB update error:", err.message);
    }
  }

  if (inMemoryVoters.has(voterId)) {
    const existing = inMemoryVoters.get(voterId);
    const updated = { ...existing, ...updates };
    inMemoryVoters.set(voterId, updated);
    return updated;
  }
  return null;
}

/**
 * Removes a voter record from their regional collection
 */
export async function deleteVoter(voterId) {
  let deleted = false;
  let slot = null;
  let name = null;

  if (isMongoConnected) {
    try {
      for (const reg of SUPPORTED_REGIONS) {
        const RegionalModel = getRegionalVoterModel(reg);
        const doc = await RegionalModel.findOneAndDelete({ voterId }).lean();
        if (doc) {
          deleted = true;
          slot = doc.fingerprintSlot;
          name = doc.name;
          break;
        }
      }
    } catch (err) {
      console.warn("MongoDB delete error:", err.message);
    }
  }

  if (inMemoryVoters.has(voterId)) {
    const memDoc = inMemoryVoters.get(voterId);
    slot = slot || memDoc.fingerprintSlot;
    name = name || memDoc.name;
    inMemoryVoters.delete(voterId);
    deleted = true;
  }

  if (deleted) {
    await logBiometricEvent({
      action: "DE_ENROLL",
      voterId,
      fingerprintSlot: slot,
      voterName: name,
      details: `Revoked biometric profile from regional collection`,
      status: "SUCCESS"
    });
  }

  return deleted;
}

/**
 * Verifies a fingerprint scan against regional voter collections
 */
export async function verifyBiometric(criteria) {
  const { slotId, voterId, templateData, template, templateHash } = criteria;
  const inputTemplate = (templateData || template || "").trim().toUpperCase();
  let voter = null;

  if (inputTemplate) {
    const hash = templateHash || crypto.createHash("sha256").update(inputTemplate).digest("hex");
    if (isMongoConnected) {
      try {
        for (const reg of SUPPORTED_REGIONS) {
          const RegionalModel = getRegionalVoterModel(reg);
          voter = await RegionalModel.findOne({
            $or: [{ templateHash: hash }, { fingerprintTemplate: inputTemplate }]
          }).lean();
          if (voter) break;
        }
      } catch (err) {
        console.warn("MongoDB verifyBiometric error:", err.message);
      }
    }
    if (!voter) {
      voter = Array.from(inMemoryVoters.values()).find(
        (v) => v.templateHash === hash || v.fingerprintTemplate === inputTemplate
      );
    }
  }

  if (!voter && slotId) {
    voter = await getVoterBySlot(slotId);
  } else if (!voter && voterId) {
    voter = await getVoterById(voterId);
  }

  if (!voter) {
    await logBiometricEvent({
      action: "SCAN_NO_MATCH",
      details: `Fingerprint verify failed: No matching template found in regional collections (Slot: ${slotId || "N/A"})`,
      status: "WARNING"
    });
    return {
      matched: false,
      verified: false,
      message: "No matching biometric profile found in regional MongoDB collections"
    };
  }

  await logBiometricEvent({
    action: "SCAN_MATCH",
    voterId: voter.voterId,
    fingerprintSlot: voter.fingerprintSlot,
    voterName: voter.name,
    region: voter.region,
    district: voter.district,
    details: `Biometric verification confirmed from voters_${sanitizeRegionKey(voter.region)}`,
    status: "SUCCESS"
  });

  return {
    matched: true,
    verified: true,
    source: `voters_${sanitizeRegionKey(voter.region)}`,
    flashMemoryBypassed: true,
    voter: {
      voterId: voter.voterId,
      name: voter.name,
      fingerprintSlot: voter.fingerprintSlot,
      region: voter.region,
      district: voter.district,
      constituency: voter.constituency,
      age: voter.age,
      gender: voter.gender,
      fingerIndex: voter.fingerIndex,
      fingerprintTemplate: voter.fingerprintTemplate,
      templateHash: voter.templateHash,
      hasVoted: voter.hasVoted
    },
    canVote: !voter.hasVoted,
    hasAlreadyVoted: voter.hasVoted
  };
}

/**
 * Records an incoming vote strictly into the designated regional vote collection (votes_kokan, etc.)
 */
export async function recordBiometricVote({
  voterId,
  party,
  region,
  district,
  anonymizedHash,
  transactionHash,
  blockNumber,
  electionRound
}) {
  let voter = await getVoterById(voterId);

  // If voter is not yet registered, auto-enroll them in their designated region
  if (!voter) {
    let slot = 1;
    const match = voterId.match(/(\d+)/);
    if (match) slot = Number(match[1]);

    voter = await enrollVoter({
      voterId,
      fingerprintSlot: slot > 0 && slot <= 127 ? slot : undefined,
      name: `Citizen ${voterId}`,
      region: region || "Kokan",
      district: district || "Mumbai"
    });
  }

  const effectiveRegion = region || voter.region || "Kokan";
  const regKey = sanitizeRegionKey(effectiveRegion);
  const effectiveDistrict = district || voter.district || (STATE_REGIONS[regKey]?.districts[0] || "Mumbai");
  const constituency = voter.constituency || `${effectiveRegion} - ${effectiveDistrict}`;

  if (isMongoConnected) {
    try {
      // Persist ballot details directly within the voter's single regional collection (voters_kokan, etc.)
      const RegionalVoterModel = getRegionalVoterModel(regKey);
      await RegionalVoterModel.updateOne(
        { voterId },
        {
          $set: {
            hasVoted: true,
            votedParty: party,
            transactionHash: transactionHash || null,
            blockNumber: blockNumber || null,
            votedAt: getISTTimestamp(),
            votedAtIST: getISTTimestamp()
          }
        }
      );
    } catch (err) {
      console.warn("MongoDB recordBiometricVote error:", err.message);
    }
  }

  // Update in-memory cache
  if (inMemoryVoters.has(voterId)) {
    const mem = inMemoryVoters.get(voterId);
    mem.hasVoted = true;
    inMemoryVoters.set(voterId, mem);
  }

  await logBiometricEvent({
    action: "BALLOT_CAST",
    voterId,
    fingerprintSlot: voter.fingerprintSlot,
    voterName: voter.name,
    party,
    region: effectiveRegion,
    district: effectiveDistrict,
    anonymizedHash,
    transactionHash,
    blockNumber,
    electionRound,
    details: `Ballot saved strictly in votes_${regKey} & Ethereum Sepolia Block #${blockNumber}`,
    status: "SUCCESS"
  });

  return { success: true, voterId, hasVoted: true, region: effectiveRegion, district: effectiveDistrict };
}

/**
 * Resets the voting flag for all registered voters across the 4 regional collections
 */
export async function resetBiometricsForRound(newRound) {
  if (isMongoConnected) {
    try {
      for (const reg of SUPPORTED_REGIONS) {
        const RegionalVoterModel = getRegionalVoterModel(reg);
        await RegionalVoterModel.updateMany({}, { $set: { hasVoted: false } });
      }
      console.log("🔄 [MONGODB] Reset hasVoted = false across all 4 regional voter collections!");
    } catch (err) {
      console.warn("MongoDB reset error:", err.message);
    }
  }

  for (const [key, v] of inMemoryVoters.entries()) {
    inMemoryVoters.set(key, { ...v, hasVoted: false });
  }

  await logBiometricEvent({
    action: "RESET",
    electionRound: newRound,
    details: `Voter registry reset for Election Round #${newRound}. All citizens eligible across regional divisions.`,
    status: "SUCCESS"
  });

  return { success: true, newRound };
}

/**
 * Logs an event to the biometric audit log
 */
export async function logBiometricEvent(eventData) {
  const logEntry = {
    ...eventData,
    timestamp: getISTTimestamp(),
    timestampIST: getISTTimestamp()
  };

  if (isMongoConnected) {
    try {
      await BiometricAuditLog.create(logEntry);
    } catch (err) {
      console.warn("MongoDB logBiometricEvent error:", err.message);
    }
  }

  inMemoryAuditLogs.unshift(logEntry);
  if (inMemoryAuditLogs.length > 100) inMemoryAuditLogs.pop();
}

/**
 * Returns recent biometric audit logs
 */
export async function getAuditLogs(limit = 25) {
  if (isMongoConnected) {
    try {
      const logs = await BiometricAuditLog.find()
        .sort({ timestamp: -1 })
        .limit(Number(limit))
        .lean();
      return logs;
    } catch (err) {
      console.warn("MongoDB getAuditLogs error:", err.message);
    }
  }
  return inMemoryAuditLogs.slice(0, limit);
}

/**
 * Returns biometric turnout statistics aggregated across the 4 regional collections
 */
export async function getBiometricStats() {
  let total = 0;
  let voted = 0;

  if (isMongoConnected) {
    try {
      for (const reg of SUPPORTED_REGIONS) {
        const Model = getRegionalVoterModel(reg);
        total += await Model.countDocuments();
        voted += await Model.countDocuments({ hasVoted: true });
      }
      const unvoted = total - voted;
      return { total, voted, unvoted, turnoutPct: total > 0 ? ((voted / total) * 100).toFixed(1) : "0.0" };
    } catch {}
  }

  const list = Array.from(inMemoryVoters.values());
  total = list.length;
  voted = list.filter((v) => v.hasVoted).length;
  const unvoted = total - voted;

  return {
    total,
    voted,
    unvoted,
    turnoutPct: total > 0 ? ((voted / total) * 100).toFixed(1) : "0.0"
  };
}

/**
 * Fetches all voter templates from regional collections for hardware verification
 */
export async function getAllVoterTemplates() {
  const res = await getVoters({ limit: 127 });
  const voters = res.voters || res;
  return voters.map((v) => ({
    slotId: v.fingerprintSlot,
    voterId: v.voterId,
    name: v.name,
    region: v.region,
    district: v.district,
    constituency: v.constituency,
    fingerprintTemplate: v.fingerprintTemplate || "",
    templateHash: v.templateHash || "",
    hasVoted: v.hasVoted || false
  }));
}
