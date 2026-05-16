import proposal from "../models/proposal.js";
import path from "path";
import fs from "fs";
import mongoose from 'mongoose'
import multer from "multer";
import proposalRT from "../models/proposalRT.js";
import { fileURLToPath } from "url";
import { del } from '@vercel/blob';

// fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});


// controllers/proposalController.js

const createProposal = async (req, res) => {
  const { data, pdfPages } = req.body;
  console.log('req.body', req.body);
  const {
    clientName,
    clientEmail,
    brandName,
    projectTitle,
    businessDescription,
    proposedSolution,
    advancePercent,
    additionalCosts,
    callOutcome,
    yourName,
    yourEmail,
    date,
    projectCategory,
  } = data;


  try {
    // Required field validation
    if (!clientName || !clientEmail || !projectTitle || !callOutcome || !yourName || !yourEmail) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields: Client Name, Email, Project Title, Call Outcome, Your Name & Email",
      });
    }

    // Optional: PDF upload path (if you add file upload later)
    const pdfPath = req.file ? req.file.path : null;

    // Create new proposal
    const newProposal = await proposal.create({
      clientName: clientName.trim(),
      clientEmail: clientEmail.toLowerCase().trim(),
      brandName: brandName?.trim() || "",
      projectTitle: projectTitle.trim(),
      advancePercent: advancePercent ? Number(advancePercent) : undefined,
      additionalCosts: additionalCosts ? Number(additionalCosts) : 0,
      callOutcome,
      date: date || new Date().toISOString().split("T")[0],
      yourName: yourName.trim(),
      yourEmail: yourEmail.toLowerCase().trim(),
      pdfPath,
      pdfPages,
      selectedCurrency: req?.body?.selectedCurrency,
      projectCategory: projectCategory?.trim() || "",
      createdBy: req.user.id, // from auth middleware
    });

    console.log("Proposal created successfully:", newProposal._id);

    return res.status(201).json({
      success: true,
      message: "Proposal created successfully!",
      data: newProposal,
    });
  } catch (error) {
    console.error("Error creating proposal:", error);

    // Handle duplicate or validation errors from Mongoose
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: messages,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create proposal. Please try again later.",
    });
  }
};




const getAllProposals = async (req, res) => {
  try {
    // page aur limit query params se lo
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const status = req.query.status || "";
    const date = req.query.date || "";
    const createdBy = req.query.createdBy || "";
    const skip = (page - 1) * limit;

    let query = req.user.role === "admin"
      ? {}
      : { createdBy: new mongoose.Types.ObjectId(req.user.id) };

    if (req.user.role === "admin" && createdBy) {
      query.createdBy = new mongoose.Types.ObjectId(createdBy);
    }

    
    if (search) {
      const searchRegex = new RegExp(search, "i"); // Case-insensitive
      query.$or = [
        { clientName: searchRegex },
        { clientEmail: searchRegex },
        { projectTitle: searchRegex }
      ];
    }

    // Status Filter (callOutcome)
    if (status) {
      query.callOutcome = status;
    }

    // Date Filter
    if (date) {
      query.date = date;
    }

    // Total count
    const totalProposals = await proposal.countDocuments(query);

    // Proposals fetch with populate only for admin
    const proposals = await proposal.find(query)
      .populate(req.user.role === "admin" ? { path: "createdBy", select: "name email" } : "")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    let totalCount = 0
    if (req.user.role === 'admin') {
      totalCount = await proposal.estimatedDocumentCount()
    } else {
      totalCount = await proposal.countDocuments(query)
    }
    console.log('proposals', proposals)

    return res.status(200).json({
      success: true,
      message: "Proposals fetched successfully",
      currentPage: page,
      totalPages: Math.ceil(totalProposals / limit),
      totalProposals,
      proposals,
      totalCount
    });
  } catch (error) {
    console.error("Error fetching proposals:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// 🟢 Get Single Proposal (with ownership check)
const getSingleProposal = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Proposal ID is required",
      });
    }

    // Conditional populate — sirf admin ke liye
    const populateOptions = req.user.role === "admin"
      ? { path: "createdBy", select: "name email" }
      : null;

    const query = proposal.findById(id);
    if (populateOptions) query.populate(populateOptions);

    const data = await query.exec();

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    // Ownership check — agent sirf apna dekh sake
    if (req.user.role !== "admin") {
      if (!data.createdBy || data.createdBy.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your own proposals.",
        });
      }
    }

    // Agar admin ne khud banaya hai to bhi name sahi dikhe
    let creatorName = "Unknown";
    if (data.createdBy) {
      creatorName = data.createdBy.name || data.createdBy.email || "Unknown";
    }
    res.status(200).json({
      success: true,
      message: "Proposal fetched successfully",
      data: {
        ...data.toObject(),
        creatorName,
      },
      isAdmin: req.user.role === "admin" ? true : false,
    });
  } catch (error) {
    console.error("Error fetching proposal:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// Update Proposal (with ownership check)
const updateProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body.data || {}; // ✅ Handle both formats

    const proposalToUpdate = await proposal.findById(id);

    if (!proposalToUpdate) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    if (req.user.role !== "admin" && proposalToUpdate.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only edit your own proposals.",
      });
    }
    console.log('req.body.selected', req.body.data.selectedCurrency)

    // ✅ Build update object
    const updatePayload = { ...updateData, selectedCurrency: req?.body?.data.selectedCurrency };

    // ✅ Update pdfPages if provided
    if (req.body.pdfPages) {
      updatePayload.pdfPages = req.body.pdfPages;
    }

    // ✅ Update pdfPath if new PDF uploaded
    if (req.body.pdfPath) {
      updatePayload.pdfPath = req.body.pdfPath;
    }

    const updatedProposal = await proposal.findByIdAndUpdate(
      id,
      { ...updatePayload },
      {
        new: true,
        runValidators: true,
      }
    );

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

// Delete Proposal (with ownership check)
const deleteProposal = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('id', id);

    const proposalToDelete = await proposal.findById(id);

    if (!proposalToDelete) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    // Ownership Check: Agent sirf apna delete kar sake
    if (req.user.role !== "admin" && proposalToDelete.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only delete your own proposals.",
      });
    }

    // ✅ Delete PDF from Vercel Blob
    if (proposalToDelete.pdfPath) {
      try {
        await del(proposalToDelete.pdfPath);
        console.log(`Deleted Vercel Blob: ${proposalToDelete.pdfPath}`);
      } catch (blobError) {
        console.error("Failed to delete blob:", blobError.message);
        // Continue to delete document even if blob deletes fails (optional strategy)
      }
    }

    const deletedProposal = await proposal.findByIdAndDelete(id);

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

export const resetPage3 = async (req, res) => {
  try {
    const { userId } = req.params;
    const defaultPage3Data = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // 🔹 Find existing page3 document for user
    let page = await proposalRT.findOne({ userId: userId });

    if (!page) {
      page = new proposalRT({
        userId: userId,
        page3: defaultPage3Data,
      });
    } else {
      // 🔹 Reset page3 data to default
      page.page3 = defaultPage3Data;
    }

    await page.save();

    return res.status(200).json({
      message: 'Page reset to default successfully',
      data: page.page3,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};






export const resetPage2 = async (req, res) => {
  try {
    const { userId } = req.params;
    const defaultPage2Data = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    console.log('req.body', req.body)
    // 🔹 Find existing page3 document for user
    let page = await proposalRT.findOne({ userId: userId });
    if (!page) {
      // Agar page nahi mila to create new
      page = new proposalRT({
        userId: userId,
        page2: defaultPage2Data,
      });
    } else {
      // 🔹 Reset page3 data to default
      page.pages.page2 = defaultPage2Data;
    }

    await page.save();

    return res.status(200).json({
      message: 'Page reset to default successfully',
      data: page.page2,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};



export const resetTermsPage = async (req, res) => {
  try {
    const { userId } = req.params;
    const defaultTermsPageData = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // 🔹 Find existing page3 document for user
    let page = await proposalRT.findOne({ userId: userId });

    if (!page) {
      // Agar page nahi mila to create new
      page = new proposalRT({
        userId: userId,
        paymentTerms: defaultTermsPageData,
      });
    } else {
      // 🔹 Reset page3 data to default
      page.paymentTerms = defaultTermsPageData;
    }

    await page.save();

    return res.status(200).json({
      message: 'Page reset to default successfully',
      data: page.paymentTerms,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const resetPricingPage = async (req, res) => {
  try {
    const { userId } = req.params;
    const defaultPricingPageData = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // 🔹 Find existing page3 document for user
    let page = await proposalRT.findOne({ userId: userId });

    if (!page) {
      // Agar page nahi mila to create new
      page = new proposalRT({
        userId: userId,
        pricing: defaultPricingPageData,
      });
    } else {
      // 🔹 Reset page3 data to default
      page.pricing = defaultPricingPageData;
    }

    await page.save();

    return res.status(200).json({
      message: 'Page reset to default successfully',
      data: page.pricing,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const resetPage1 = async (req, res) => {
  try {
    const { userId } = req.params;
    const defaultPage1Data = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    console.log('userId', userId)
    // 🔹 Find existing page3 document for user
    let page = await proposalRT.findOne({ userId: userId });
    console.log('page', page)
    if (!page) {
      // Agar page nahi mila to create new
      page = new proposalRT({
        userId: userId,
        page1Slice: defaultPage1Data,
      });
    } else {
      // 🔹 Reset page3 data to default
      page.page1Slice = defaultPage1Data;
    }

    await page.save();

    return res.status(200).json({
      message: 'Page reset to default successfully',
      data: page.page1Slice,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


export const resetPagesOrder = async (req, res) => {
  try {
    const { userId } = req.params;
    const defaultPagesOrder = req.body;
    console.log('defaultPagesOrder', req.body)
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    console.log('userId', userId)
    // 🔹 Find existing page3 document for user
    let page = await proposalRT.findOne({ userId: userId });
    console.log('page', page)
    if (!page) {
      // Agar page nahi mila to create new
      page = new proposalRT({
        userId: userId,
        pages: defaultPagesOrder.pagesRT.pages,
      });
    } else {
      // 🔹 Reset page3 data to default
      page.pages = defaultPagesOrder.pagesRT.pages;
    }

    await page.save();

    return res.status(200).json({
      message: 'Pages reset to default successfully',
      data: page.pages,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
const getProposal = async (req, res) => {
  const userId = req.params.id;

  const proposal = await proposalRT.findOne({ userId });
  console.log('porp---------------', proposal)
  res.json(proposal || {});
};

const saveProposal = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('userID', userId)
    const {
      businessInfo,
      transcript,
      form,
      page1Slice,
      page2,
      page3,
      pages,
      customContent,
      blankContent,
      pricing,
      paymentTerms
    } = req.body.data; // ✅ <- notice .data here

    const updateData = {
      businessInfo,
      transcript,
      form,
      page1Slice,
      page2,
      page3,
      pages,
      customContent,
      blankContent,
      pricing,
      paymentTerms,
      lastUpdated: Date.now(),
    };

    const saved = await proposalRT.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, upsert: true }
    );



    res.json({ success: true, proposal: saved });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};


const checkClientEmail = async (req, res) => {
  try {
    const { email, excludeId } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const query = { clientEmail: email.toLowerCase().trim() };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existingProposals = await proposal.find(query);
    const count = existingProposals.length;

    if (count > 0) {
      return res.status(200).json({
        success: true,
        exists: true,
        count: count,
        limitExceeded: count >= 5,
        proposalId: existingProposals[0]._id,
        createdBy: existingProposals[0].createdBy,
      });
    }

    return res.status(200).json({
      success: true,
      exists: false,
      count: 0,
      limitExceeded: false,
    });
  } catch (error) {
    console.error("Error checking client email:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export { createProposal, getAllProposals, getSingleProposal, updateProposal, deleteProposal, saveProposal, getProposal, checkClientEmail }
