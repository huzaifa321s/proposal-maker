import proposal from "../models/proposal.js";

const createProposal = async (req, res) => {
    const {
        clientName,
        clientEmail,
        projectTitle,
        businessDescription,
        proposedSolution,
        developmentPlatforms,
        projectDuration,
        chargeAmount,
        advancePercent,
        additionalCosts,
        timelineMilestones,
        callOutcome,
        terms,
        yourName,
        yourEmail,
        yourPhone,
        date,
        status,
    } = req.body;
console.log('clientName',clientName)
    try {

        // Validation (optional)
        if (!clientName || !projectTitle || !yourName) {
            return res
                .status(400)
                .json({ success: false, message: "Required fields missing" });
        }

        // Create document
        const data = await proposal.create({
            clientName,
            clientEmail,
            projectTitle,
            businessDescription,
            proposedSolution,
            developmentPlatforms,
            projectDuration,
            chargeAmount,
            advancePercent,
            additionalCosts,
            timelineMilestones,
            callOutcome,
            terms,
            yourName,
            yourEmail,
            yourPhone,
            date,
            status,
        });

        res.status(201).json({
            success: true,
            message: "Proposal created successfully",
            data,
        })
    } catch (error) {
        console.error("Proposal creation error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}


 const getAllProposals = async (req, res) => {
  try {

    // page aur limit query params se lo
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    // skip logic
    const skip = (page - 1) * limit;

    // total proposals count
    const totalProposals = await proposal.countDocuments();

    // proposals data
    const proposals = await proposal.find()
      .sort({ createdAt: -1 }) // latest first
      .skip(skip)
      .limit(limit);

    // response
    return res.status(200).json({
      success: true,
      message: "Proposals fetched successfully",
      currentPage: page,
      totalPages: Math.ceil(totalProposals / limit),
      totalProposals,
      proposals,
    });
  } catch (error) {
    console.error("Error fetching proposals:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

 const getSingleProposal = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Proposal ID is required",
      });
    }

    // Fetch proposal
    const data = await proposal.findById(id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Proposal fetched successfully",
      data,
    });
  } catch (error) {
    console.error("Error fetching proposal:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};



// 🟢 Update Proposal
 const updateProposal = async (req, res) => {
  try {
    const { id } = req.params;

    // 🧠 Body destructure (sab kuch allow kar do)
    const updateData = req.body;

    // ✅ Find and update
    const updatedProposal = await proposal.findByIdAndUpdate(id, updateData, {
      new: true, // return updated document
      runValidators: true,
    });

    if (!updatedProposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Proposal updated successfully",
      data: updatedProposal,
    });
  } catch (error) {
    console.error("Error updating proposal:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating proposal",
      error: error.message,
    });
  }
};


// 🗑️ Delete Proposal
 const deleteProposal = async (req, res) => {
  try {
    const { id } = req.params;
console.log('id',id)
    const deletedProposal = await proposal.findByIdAndDelete(id);

    if (!deletedProposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Proposal deleted successfully",
      data: deletedProposal,
    });
  } catch (error) {
    console.error("Error deleting proposal:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while deleting proposal",
      error: error.message,
    });
  }
};

export { createProposal,getAllProposals,getSingleProposal,updateProposal ,deleteProposal}