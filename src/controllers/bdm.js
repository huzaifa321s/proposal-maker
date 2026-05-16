import BDM from "../models/bdm.js";
import User from "../models/user.js";
import Proposal from "../models/proposal.js";
export const registerBDM = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "All fields required" });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: "Email already registered" });

    const user = new User({
      name,
      email,
      password,
      role: "agent",
    });

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    res.status(201).json({ message: "BDM created", bdm: userObj });
  } catch (err) {
    console.error("registerBDM error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


export const getAllBDMs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, parseInt(req.query.limit || "10", 10));
    const sortBy = req.query.sortBy || "latest"; // latest, oldest, most-proposals
    const skip = (page - 1) * limit;

    const filter = { role: "agent" };

    let sortOption = { createdAt: -1 };
    if (sortBy === "oldest") {
      sortOption = { createdAt: 1 };
    }

    let bdms;
    let total;

    if (sortBy === "most-proposals") {
      // Aggregation for most proposals
      const aggregation = [
        { $match: filter },
        {
          $lookup: {
            from: "proposals", // proposal collection name (usually lowercase plural)
            localField: "_id",
            foreignField: "createdBy",
            as: "proposals",
          },
        },
        {
          $addFields: {
            proposalCount: { $size: "$proposals" },
          },
        },
        { $sort: { proposalCount: -1 } },
        { $project: { password: 0, proposals: 0 } }, // exclude password and heavy proposals array
      ];

      // Total count for pagination
      const allMatches = await User.aggregate([{ $match: filter }]);
      total = allMatches.length;

      // Apply pagination to aggregation
      bdms = await User.aggregate([
        ...aggregation,
        { $skip: skip },
        { $limit: limit },
      ]);
    } else {
      // Standard find for latest/oldest
      [total, bdms] = await Promise.all([
        User.countDocuments(filter),
        User.find(filter)
          .sort(sortOption)
          .skip(skip)
          .limit(limit)
          .select("-password")
          .lean(),
      ]);
    }

    const pages = Math.ceil(total / limit);

    res.json({
      bdms,
      total,
      page,
      pages,
      limit,
    });
  } catch (err) {
    console.error("getAllBDMs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



// ✅ Count total BDMs (role = 'agent')
export const getTotalBDMs = async (req, res) => {
  try {
    const total = await User.countDocuments({ role: "agent" });
    res.status(200).json({ total });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch total BDM count." });
  }
};



export const updateBDM = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "BDM not found" });

    // Only update allowed fields
    if (name) user.name = name;
    if (email) user.email = email.toLowerCase();
    if (password) user.password = password; // saved below to trigger hash

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    res.json({ message: "BDM updated", bdm: userObj });
  } catch (err) {
    console.error("updateBDM error:", err);
    // Unique email error
    if (err.code === 11000) return res.status(409).json({ message: "Email already in use" });
    res.status(500).json({ message: "Server error" });
  }
};


export const deleteBDM = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ message: "BDM not found" });
    res.json({ message: "BDM deleted" });
  } catch (err) {
    console.error("deleteBDM error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getBDMDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password").lean();
    if (!user) return res.status(404).json({ message: "BDO not found" });
    const totalProposals = await Proposal.countDocuments({ createdBy: id });
    res.json({
      success: true,
      data: {
        ...user,
        totalProposals,
      },
    });
  } catch (err) {
    console.error("getBDMDetails error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
