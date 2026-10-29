import mongoose from "mongoose";
import crypto from "crypto";
import { FingerprintVoter, getRegionalVoterModel, getRegionalVoteModel } from "../models/FingerprintVoter.js";
import { BiometricAuditLog } from "../models/BiometricAuditLog.js";

// Connection & Telemetry State
let isMongoConnected = false;
let mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/biometric_voting";
let activeDbName = "biometric_voting";
let lastConnectionAttempt = 0;
let connectionError = null;

// Fallback in-memory store if MongoDB instance is temporarily unreachable
const inMemoryVoters = new Map();
const inMemoryAuditLogs = [];

/**
 * Generates an authentic 512-byte (1024 hex chars) AS608/R307 minutiae character buffer template
 */
export function generateMinutiaeTemplate(slotId, seedString = "citizen") {
  // Standard R307 AS608 Character File Header: 0xEF01 + Header + Slot Token
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

// 4 State Regions and Sub-Regions (Districts)
export const STATE_REGIONS = {
  Konkan: {
    name: "Konkan",
    districts: ["Mumbai", "Thane", "Raigad", "Palghar"],
    candidates: ["BJP", "UBT", "Congress", "AIMIM"]
  },
  Vidarbha: {
    name: "Vidarbha",
    districts: ["Nagpur", "Amravati", "Akola", "Wardha"],
    candidates: ["BJP", "UBT", "Congress", "AIMIM"]
  },
  Marathwada: {
    name: "Marathwada",
    districts: ["Aurangabad", "Nanded", "Latur", "Jalna"],
    candidates: ["BJP", "UBT", "Congress", "AIMIM"]
  },
  Paschim: {
    name: "Paschim",
    districts: ["Pune", "Kolhapur", "Satara", "Solapur"],
    candidates: ["BJP", "UBT", "Congress", "AIMIM"]
  }
};

// Default Minimal Seed Voters matching ESP32 firmware & 4 State Regions
export const DEFAULT_VOTERS = [
  {
    voterId: "FP_UID_1",
    fingerprintSlot: 1,
    name: "Vallabh Joshi",
    region: "Konkan",
    district: "Mumbai",
    constituency: "Konkan - Mumbai",
    gender: "Male",
    age: 26,
    fingerIndex: "Right Index Finger",
    hasVoted: false,
    registrationAt: new Date(),
    registeredAt: new Date()
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
    hasVoted: false,
    registrationAt: new Date(),
    registeredAt: new Date()
  },
  {
    voterId: "FP_UID_3",
    fingerprintSlot: 3,
    name: "Priya Patel",
    region: "Marathwada",
    district: "Aurangabad",
    constituency: "Marathwada - Aurangabad",
    gender: "Female",
    age: 28,
    fingerIndex: "Left Index Finger",
    hasVoted: false,
    registrationAt: new Date(),
    registeredAt: new Date()
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
    hasVoted: false,
    registrationAt: new Date(),
    registeredAt: new Date()
  }
];

// Initialize in-memory fallback store
function initInMemoryStore() {
  inMemoryVoters.clear();
  DEFAULT_VOTERS.forEach((v) => {
    inMemoryVoters.set(v.voterId, {
      ...v,
      hasVoted: false,
      registrationAt: new Date(),
      registeredAt: new Date()
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
    // Parse DB name from URI if present
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

    // Check if initial seeding is needed
    await seedDefaultVotersIfEmpty();

    // Log connection in audit trail
    await logBiometricEvent({
      action: "ENROLL",
      details: "MongoDB Biometric consensus storage initialized",
      status: "SUCCESS"
    });

  } catch (err) {
    isMongoConnected = false;
    connectionError = err.message;
    console.warn(`\n⚠️  [MongoDB NOTICE] Local/Remote MongoDB instance not detected (${err.message}).`);
    console.warn(`💡 Biometric operations will run smoothly using the Hybrid In-Memory Biometric Buffer.`);
    console.warn(`👉 To activate persistent MongoDB storage:`);
    console.warn(`   1. Start local MongoDB: 'mongod' (or docker run -d -p 27017:27017 mongo)`);
    console.warn(`   2. Or set MONGODB_URI in .env to your MongoDB Atlas connection string.\n`);
    startAutoReconnect();
  }
}


/**
 * Seeds and synchronizes minimal voter profiles across regional collections
 */
export async function seedDefaultVotersIfEmpty(force = false) {
  try {
    if (!isMongoConnected) return;

    // 1. Clean up legacy bulky fields from all existing documents using replaceOne
    try {
      const allDocs = await FingerprintVoter.find({}).lean();
      for (const d of allDocs) {
        const reg = d.region || "Konkan";
        const dist = d.district || (reg === "Vidarbha" ? "Nagpur" : reg === "Marathwada" ? "Aurangabad" : reg === "Paschim" ? "Pune" : "Mumbai");
        await FingerprintVoter.replaceOne(
          { _id: d._id },
          {
            voterId: d.voterId,
            fingerprintSlot: d.fingerprintSlot,
            name: d.name,
            region: reg,
            district: dist,
            constituency: d.constituency || `${reg} - ${dist}`,
            age: d.age || 25,
            gender: d.gender || "Undisclosed",
            fingerIndex: d.fingerIndex || "Right Index Finger",
            hasVoted: d.hasVoted || false,
            registrationAt: d.registrationAt || d.registeredAt || new Date(),
            registeredAt: d.registeredAt || new Date()
          }
        );
      }
    } catch (cleanErr) {
      console.warn("Legacy schema cleanup notice:", cleanErr.message);
    }

    // 2. Synchronize all 4 regional collections + central collection with clean, minimal info
    for (const defVoter of DEFAULT_VOTERS) {
      const RegionalModel = getRegionalVoterModel(defVoter.region);
      const cleanData = {
        voterId: defVoter.voterId,
        fingerprintSlot: defVoter.fingerprintSlot,
        name: defVoter.name,
        region: defVoter.region,
        district: defVoter.district,
        constituency: defVoter.constituency,
        age: defVoter.age,
        gender: defVoter.gender,
        fingerIndex: defVoter.fingerIndex,
        hasVoted: defVoter.hasVoted || false,
        registrationAt: defVoter.registrationAt || new Date(),
        registeredAt: defVoter.registeredAt || new Date()
      };

      // Save into region-specific collection (e.g. voters_marathwada)
      await RegionalModel.findOneAndUpdate(
        { voterId: defVoter.voterId },
        { $set: cleanData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Save into central collection
      await FingerprintVoter.findOneAndUpdate(
        { voterId: defVoter.voterId },
        { $set: cleanData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    console.log(`✅ [MONGODB] Regional voter collections (voters_konkan, voters_vidarbha, voters_marathwada, voters_paschim) synchronized with minimal data!`);
  } catch (err) {
    console.error(`❌ Error seeding default voters:`, err.message);
  }
}

/**
 * Returns overall MongoDB telemetry status
 */
export async function getMongoStatus() {
  let voterCount = 0;
  let votedCount = 0;

  if (isMongoConnected) {
    try {
      voterCount = await FingerprintVoter.countDocuments();
      votedCount = await FingerprintVoter.countDocuments({ hasVoted: true });
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
    uri: mongoUri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@"), // sanitize auth if present
    database: activeDbName,
    collections: [
      "voters_konkan",
      "voters_vidarbha",
      "voters_marathwada",
      "voters_paschim",
      "votes_konkan",
      "votes_vidarbha",
      "votes_marathwada",
      "votes_paschim",
      "fingerprintvoters"
    ],
    totalVoters: voterCount,
    votedCount,
    lastAttempt: new Date(lastConnectionAttempt).toISOString(),
    error: connectionError
  };
}

/**
 * Fetches all registered voters
 */
export async function getVoters(query = {}) {
  const { search, hasVoted, region, district, limit = 50, page = 1 } = query;

  if (isMongoConnected) {
    try {
      const filter = {};
      if (hasVoted !== undefined && hasVoted !== "") {
        filter.hasVoted = hasVoted === "true" || hasVoted === true;
      }
      if (region) {
        filter.region = region;
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

      const total = await FingerprintVoter.countDocuments(filter);
      const voters = await FingerprintVoter.find(filter)
        .sort({ fingerprintSlot: 1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean();

      return { success: true, total, page: Number(page), voters };
    } catch (err) {
      console.warn("MongoDB query failed, falling back to memory:", err.message);
    }
  }

  // Memory fallback
  let list = Array.from(inMemoryVoters.values());
  if (hasVoted !== undefined && hasVoted !== "") {
    const isVoted = hasVoted === "true" || hasVoted === true;
    list = list.filter((v) => v.hasVoted === isVoted);
  }
  if (region) {
    list = list.filter((v) => v.region && v.region.toLowerCase() === region.toLowerCase());
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
 * Fetches single voter by voterId or slotId
 */
export async function getVoterById(voterId) {
  if (isMongoConnected) {
    try {
      const voter = await FingerprintVoter.findOne({ voterId }).lean();
      if (voter) return voter;

      for (const reg of ["Konkan", "Vidarbha", "Marathwada", "Paschim"]) {
        const RegionalModel = getRegionalVoterModel(reg);
        const regVoter = await RegionalModel.findOne({ voterId }).lean();
        if (regVoter) return regVoter;
      }
    } catch (err) {
      console.warn("MongoDB getVoterById error:", err.message);
    }
  }
  return inMemoryVoters.get(voterId) || null;
}

export async function getVoterBySlot(slotId) {
  const numSlot = Number(slotId);
  if (isMongoConnected) {
    try {
      const voter = await FingerprintVoter.findOne({ fingerprintSlot: numSlot }).lean();
      if (voter) return voter;

      for (const reg of ["Konkan", "Vidarbha", "Marathwada", "Paschim"]) {
        const RegionalModel = getRegionalVoterModel(reg);
        const regVoter = await RegionalModel.findOne({ fingerprintSlot: numSlot }).lean();
        if (regVoter) return regVoter;
      }
    } catch (err) {
      console.warn("MongoDB getVoterBySlot error:", err.message);
    }
  }
  return Array.from(inMemoryVoters.values()).find((v) => v.fingerprintSlot === numSlot) || null;
}

/**
 * Enrolls a new citizen fingerprint into MongoDB
 */
export async function enrollVoter(data) {
  const {
    voterId: rawVoterId,
    fingerprintSlot: rawSlot,
    name,
    nationalId,
    constituency: rawConstituency,
    boothNumber,
    gender,
    age,
    fingerIndex,
    fingerprintTemplate: suppliedTemplate
  } = data;

  if (!name || name.trim().length === 0) {
    throw new Error("Citizen full name is required.");
  }

  // Auto-allocate slot if not provided
  let slot = Number(rawSlot);
  if (!slot || isNaN(slot) || slot < 1 || slot > 127) {
    let existingSlots = new Set();
    if (isMongoConnected) {
      try {
        const docs = await FingerprintVoter.find({}, "fingerprintSlot").lean();
        docs.forEach((d) => existingSlots.add(d.fingerprintSlot));
      } catch {
        existingSlots = new Set(Array.from(inMemoryVoters.values()).map((v) => v.fingerprintSlot));
      }
    } else {
      existingSlots = new Set(Array.from(inMemoryVoters.values()).map((v) => v.fingerprintSlot));
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

  const region = data.region || "Konkan";
  const defaultDist = region === "Vidarbha" ? "Nagpur" : region === "Marathwada" ? "Aurangabad" : region === "Paschim" ? "Pune" : "Mumbai";
  const district = data.district || defaultDist;
  const constituency = data.constituency || `${region} - ${district}`;

  const voterRecord = {
    voterId,
    fingerprintSlot: slot,
    name: name.trim(),
    constituency,
    region,
    district,
    gender: gender || "Undisclosed",
    age: age ? Number(age) : 25,
    fingerIndex: fingerIndex || "Right Index Finger",
    hasVoted: false,
    registrationAt: new Date(),
    registeredAt: new Date()
  };

  if (isMongoConnected) {
    try {
      // 1. Save into separate regional collection (e.g. voters_marathwada)
      const RegionalVoterModel = getRegionalVoterModel(region);
      await RegionalVoterModel.findOneAndUpdate(
        { $or: [{ voterId }, { fingerprintSlot: slot }] },
        { $set: voterRecord },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // 2. Also save into central FingerprintVoter collection
      const doc = await FingerprintVoter.findOneAndUpdate(
        { $or: [{ voterId }, { fingerprintSlot: slot }] },
        { $set: voterRecord },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Keep in-memory cache synchronized
      inMemoryVoters.set(voterId, voterRecord);

      await logBiometricEvent({
        action: "ENROLL",
        voterId,
        fingerprintSlot: slot,
        voterName: name,
        region,
        district,
        details: `Enrolled citizen in slot #${slot} into voters_${region.toLowerCase()} [${constituency}]`,
        status: "SUCCESS"
      });

      return voterRecord;
    } catch (err) {
      console.warn("MongoDB enroll failed, saving to in-memory store:", err.message);
    }
  }

  // Memory fallback
  inMemoryVoters.set(voterId, voterRecord);
  await logBiometricEvent({
    action: "ENROLL",
    voterId,
    fingerprintSlot: slot,
    voterName: name,
    region,
    district,
    details: `Enrolled citizen in slot #${slot} [${region} - ${district}] (Buffer Mode)`,
    status: "SUCCESS"
  });

  return voterRecord;
}

/**
 * Updates an existing voter's details
 */
export async function updateVoter(voterId, updates) {
  if (isMongoConnected) {
    try {
      const doc = await FingerprintVoter.findOneAndUpdate({ voterId }, updates, { new: true }).lean();
      if (doc) {
        inMemoryVoters.set(voterId, doc);
        return doc;
      }
    } catch (err) {
      console.warn("MongoDB update error:", err.message);
    }
  }

  if (inMemoryVoters.has(voterId)) {
    const existing = inMemoryVoters.get(voterId);
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    inMemoryVoters.set(voterId, updated);
    return updated;
  }
  return null;
}

/**
 * Removes a voter record
 */
export async function deleteVoter(voterId) {
  let deleted = false;
  let slot = null;
  let name = null;

  if (isMongoConnected) {
    try {
      const doc = await FingerprintVoter.findOneAndDelete({ voterId }).lean();
      if (doc) {
        deleted = true;
        slot = doc.fingerprintSlot;
        name = doc.name;
        if (doc.region) {
          const RegionalModel = getRegionalVoterModel(doc.region);
          await RegionalModel.findOneAndDelete({ voterId });
        }
      } else {
        for (const reg of ["Konkan", "Vidarbha", "Marathwada", "Paschim"]) {
          const RegionalModel = getRegionalVoterModel(reg);
          const rDoc = await RegionalModel.findOneAndDelete({ voterId }).lean();
          if (rDoc) {
            deleted = true;
            slot = rDoc.fingerprintSlot;
            name = rDoc.name;
            break;
          }
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
      details: `Revoked biometric profile from MongoDB`,
      status: "SUCCESS"
    });
  }

  return deleted;
}

/**
 * Verifies a fingerprint scan against the database
 */
export async function verifyBiometric(criteria) {
  const { slotId, voterId, templateData } = criteria;
  let voter = null;

  if (slotId) {
    voter = await getVoterBySlot(slotId);
  } else if (voterId) {
    voter = await getVoterById(voterId);
  } else if (templateData) {
    const hash = crypto.createHash("sha256").update(templateData).digest("hex");
    if (isMongoConnected) {
      try {
        voter = await FingerprintVoter.findOne({ templateHash: hash }).lean();
      } catch {}
    }
    if (!voter) {
      voter = Array.from(inMemoryVoters.values()).find((v) => v.templateHash === hash);
    }
  }

  if (!voter) {
    await logBiometricEvent({
      action: "SCAN_NO_MATCH",
      details: `Fingerprint scan had no match in database (Slot: ${slotId || "N/A"})`,
      status: "WARNING"
    });
    return {
      matched: false,
      message: "No matching biometric profile found in database"
    };
  }

  // Update last verified timestamp
  await updateVoter(voter.voterId, { lastVerifiedAt: new Date() });

  await logBiometricEvent({
    action: "SCAN_MATCH",
    voterId: voter.voterId,
    fingerprintSlot: voter.fingerprintSlot,
    voterName: voter.name,
    details: `Optical match confirmed (Confidence: ${voter.qualityScore}%)`,
    status: "SUCCESS"
  });

  return {
    matched: true,
    voter,
    canVote: !voter.hasVoted,
    hasAlreadyVoted: voter.hasVoted
  };
}

/**
 * Records a cast vote against the biometric voter record
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

  // If voter is not yet registered (e.g. ad-hoc ID simulated via UI), auto-enroll them
  if (!voter) {
    let slot = 1;
    const match = voterId.match(/(\d+)/);
    if (match) slot = Number(match[1]);

    voter = await enrollVoter({
      voterId,
      fingerprintSlot: slot > 0 && slot <= 127 ? slot : undefined,
      name: `Citizen ${voterId}`,
      region: region || "Konkan",
      district: district || "Mumbai"
    });
  }

  const effectiveRegion = region || voter.region || "Konkan";
  const effectiveDistrict = district || voter.district || "Mumbai";
  const constituency = voter.constituency || `${effectiveRegion} - ${effectiveDistrict}`;

  if (isMongoConnected) {
    try {
      // 1. Store vote record in dedicated regional collection (e.g. votes_marathwada)
      const RegionalVoteModel = getRegionalVoteModel(effectiveRegion);
      await RegionalVoteModel.create({
        voterId,
        constituency,
        region: effectiveRegion,
        district: effectiveDistrict,
        party,
        transactionHash: transactionHash || null,
        blockNumber: blockNumber || null,
        votedAt: new Date()
      });

      // 2. Set hasVoted: true in regional voter collection (e.g. voters_marathwada)
      const RegionalVoterModel = getRegionalVoterModel(effectiveRegion);
      await RegionalVoterModel.updateOne({ voterId }, { $set: { hasVoted: true } });

      // 3. Set hasVoted: true in central collection
      await FingerprintVoter.updateOne({ voterId }, { $set: { hasVoted: true } });
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
    details: `Ballot cast saved in votes_${effectiveRegion.toLowerCase()} & Ethereum Sepolia Block #${blockNumber}`,
    status: "SUCCESS"
  });

  return { success: true, voterId, hasVoted: true, region: effectiveRegion, district: effectiveDistrict };
}

/**
 * Resets the voting flag for all registered voters for a new election round
 */
export async function resetBiometricsForRound(newRound) {
  if (isMongoConnected) {
    try {
      await FingerprintVoter.updateMany({}, { $set: { hasVoted: false } });

      for (const reg of ["Konkan", "Vidarbha", "Marathwada", "Paschim"]) {
        const RegionalVoterModel = getRegionalVoterModel(reg);
        await RegionalVoterModel.updateMany({}, { $set: { hasVoted: false } });
      }
      console.log("🔄 [MONGODB] Reset hasVoted = false across all regional voter collections!");
    } catch (err) {
      console.warn("MongoDB reset error:", err.message);
    }
  }

  // Update in-memory
  for (const [key, v] of inMemoryVoters.entries()) {
    inMemoryVoters.set(key, {
      ...v,
      hasVoted: false
    });
  }

  await logBiometricEvent({
    action: "RESET",
    electionRound: newRound,
    details: `Voter registry reset for Election Round #${newRound}. All citizens eligible to vote again.`,
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
    timestamp: new Date()
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
 * Returns biometric statistics
 */
export async function getBiometricStats() {
  let total = 0;
  let voted = 0;
  let unvoted = 0;

  if (isMongoConnected) {
    try {
      total = await FingerprintVoter.countDocuments();
      voted = await FingerprintVoter.countDocuments({ hasVoted: true });
      unvoted = total - voted;
      return { total, voted, unvoted, turnoutPct: total > 0 ? ((voted / total) * 100).toFixed(1) : "0.0" };
    } catch {}
  }

  const list = Array.from(inMemoryVoters.values());
  total = list.length;
  voted = list.filter((v) => v.hasVoted).length;
  unvoted = total - voted;

  return {
    total,
    voted,
    unvoted,
    turnoutPct: total > 0 ? ((voted / total) * 100).toFixed(1) : "0.0"
  };
}
