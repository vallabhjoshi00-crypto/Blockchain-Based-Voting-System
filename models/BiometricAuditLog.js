import mongoose from "mongoose";

const BiometricAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "ENROLL",
        "SCAN_MATCH",
        "SCAN_NO_MATCH",
        "BALLOT_CAST",
        "FRAUD_REJECTED",
        "RESET",
        "DE_ENROLL"
      ]
    },
    voterId: {
      type: String,
      default: null,
      index: true
    },
    fingerprintSlot: {
      type: Number,
      default: null
    },
    voterName: {
      type: String,
      default: null
    },
    region: {
      type: String,
      default: null,
      index: true
    },
    district: {
      type: String,
      default: null
    },
    party: {
      type: String,
      default: null
    },
    anonymizedHash: {
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
    electionRound: {
      type: Number,
      default: 1
    },
    terminalId: {
      type: String,
      default: "ESP32-BOOTH-01"
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED", "WARNING"],
      default: "SUCCESS"
    },
    details: {
      type: String,
      default: ""
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

export const BiometricAuditLog = mongoose.models.BiometricAuditLog || mongoose.model("BiometricAuditLog", BiometricAuditLogSchema);
