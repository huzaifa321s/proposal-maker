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
export { createProposal }