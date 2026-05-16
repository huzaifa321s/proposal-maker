// src/models/TokenPool.js
import mongoose from "mongoose";

// src/models/TokenPool.js

const tokenPoolSchema = new mongoose.Schema({
  totalTokens: { type: Number, default: 1000000 },
  usedTokens: { type: Number, default: 0 },
  usedGroqTokens: { type: Number, default: 0 },
  groqLimit: { type: Number, default: 1000000 },
  streamingOffsetSeconds: { type: Number, default: 0 },
  lastGroqAlert: {
    low: { type: Date, default: null },
    critical: { type: Date, default: null },
    final: { type: Date, default: null },
    groq80: { type: Date, default: null },
    groq95: { type: Date, default: null }
  },
  lastAlertSent: {
    low: { type: Date, default: null },
    critical: { type: Date, default: null },
    final: { type: Date, default: null }
  },
  notifications: [{
    type: String,
    title: String,
    message: String,
    action: String,
    color: String,
    urgency: String,
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
  }],

  // YE SCHEMA CORRECT HAI – ARRAY OF OBJECTS
  usageHistory: [{
    timestamp: { type: Date, default: Date.now },
    tokensUsed: { type: Number, required: true },
    type: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userEmail: { type: String, default: 'unknown' },
    details: { type: String, default: '{}' }
  }]
}, { timestamps: true });


// Ensure only one document exists
tokenPoolSchema.statics.getPool = async function () {
  let pool = await this.findOne();
  if (!pool) {
    pool = await this.create({});
  }
  return pool;
};

export default mongoose.model("TokenPool", tokenPoolSchema);