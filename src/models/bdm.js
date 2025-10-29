// models/BDM.js
import mongoose from "mongoose";

const BDMSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
  },
  { timestamps: true }
);

const BDM = mongoose.model("BDM", BDMSchema);

export default BDM;
