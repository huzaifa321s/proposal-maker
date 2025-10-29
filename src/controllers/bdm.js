import BDM from "../models/bdm.js";

// Fetch all BDMs
export const getAllBDMs = async (req, res) => {
  try {
    const bdms = await BDM.find().sort({ name: 1 });
    console.log("bdms", bdms);
    res.status(200).json({ success: true, data: bdms });
  } catch (err) {
    console.error("Error fetching BDMs:", err.message);
    res.status(500).json({ success: false, data: [], error: "Failed to fetch BDMs" });
  }
};