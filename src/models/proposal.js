import mongoose from "mongoose";

const proposalSchema = new mongoose.Schema(
  {
    // 🧍 Client Details
    clientName: { type: String, required: true },
    clientEmail: { type: String },

    // 💼 Project Details
    projectTitle: { type: String, required: true },
    businessDescription: { type: String },
    proposedSolution: { type: String },
    developmentPlatforms: { type: [String], default: [] },

    // 💰 Financial Info
    projectDuration: { type: String },
    chargeAmount: { type: Number },
    advancePercent: { type: Number },
    additionalCosts: { type: String },

    // 🕒 Timeline
    timelineMilestones: { type: String },

    // 📞 Call Outcome
    callOutcome: {
      type: String,
      enum: ["Interested", "No Fit", "Flaked", "Follow-up"],
      default: "Interested",
    },

    // 📜 Legal / Terms
    terms: { type: String },

    // 👤 Creator Info (in-house user)
    yourName: { type: String, required: true },
    yourEmail: { type: String },
    yourPhone: { type: String },

    // 📅 Metadata
    date: { type: String, default: () => new Date().toISOString().split("T")[0] },

    // 🔖 Status (optional for tracking later)
    status: {
      type: String,
      enum: ["Pending", "Sent", "Accepted", "Declined"],
      default: "Pending",
    },
    emailPreview: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Proposal", proposalSchema);
