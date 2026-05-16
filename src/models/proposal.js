// src/models/Proposal.js
import mongoose from "mongoose";

const proposalSchema = new mongoose.Schema(
  {
    // === Client Info ===
    clientName: {
      type: String,
      required: [true, "Client name is required"],
      trim: true,
    },
    clientEmail: {
      type: String,
      required: [true, "Client email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },

    // === Project Details ===
    brandName: {
      type: String,
      trim: true,
    },
    projectTitle: {
      type: String,
      required: [true, "Project title is required"],
      trim: true,
    },
    projectCategory: {
      type: String,
      trim: true,
    },

    // === Costs ===
    advancePercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    additionalCosts: {
      type: Number,
      default: 0,
    },

    // === Additional Details ===
    callOutcome: {
      type: String,
      enum: ["Interested", "No Fit", "Flaked", "Follow-up"],
      default: "Interested",
    },
    date: {
      type: String,
      default: () => new Date().toISOString().split("T")[0], // YYYY-MM-DD
    },

    // === Your (Freelancer/Agency) Info ===
    yourName: {
      type: String,
      required: [true, "Your name is required"],
      trim: true,
    },
    yourEmail: {
      type: String,
      required: [true, "Your email is required"],
      lowercase: true,
      trim: true,
    },

    // === PDF & System Fields ===
    pdfPath: {
      type: String,
      default: null,
    },
    pdfPages: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // === Ownership ===
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    selectedCurrency: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true, // createdAt & updatedAt automatically
  }
);

// Indexes for better query performance
proposalSchema.index({ createdBy: 1 });
proposalSchema.index({ clientEmail: 1 });
proposalSchema.index({ date: -1 });

export default mongoose.model("Proposal", proposalSchema);