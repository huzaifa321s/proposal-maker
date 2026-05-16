// src/models/Proposal.js
import mongoose from "mongoose";

const proposalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // Important slices only
  businessInfo: Object,
  transcript: Object,
  form: Object,

  // Individual page slices
  page1Slice: Object,
  page2: Object,
  page3: Object,  // agar aur pages hain add kar sakte ho

  pages: Object,           // page names / summary
  customContent: Object,
  blankContent: Object,
  pricing: Object,
  paymentTerms: Object,

  // Auto-save timestamps
  lastUpdated: { type: Date, default: Date.now },

}, { timestamps: true });

export default mongoose.model("proposalRT", proposalSchema);
