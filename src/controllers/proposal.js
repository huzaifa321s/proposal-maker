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
      console.log('hi')
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

export { createProposal,getAllProposals }