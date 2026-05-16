import express from "express";
import TokenPool from "../models/TokenPool.js";
import {
    getAssemblyAIUsage,
    getCurrentMonthUsage,
    getLast30DaysUsage,
    getAccountInfo
} from "../utils/assemblyUsage.js";

const router = express.Router();

router.get("/usage", async (req, res) => {
    try {
        const pool = await TokenPool.getPool();

        // Get actual usage from AssemblyAI API (All time)
        const realUsageSeconds = await getAssemblyAIUsage();

        // Get detailed stats
        const currentMonth = await getCurrentMonthUsage();
        const last30Days = await getLast30DaysUsage();
        const account = await getAccountInfo();

        // Update pool with real usage (All time)
        pool.usedTokens = realUsageSeconds + (pool.streamingOffsetSeconds || 0);
        await pool.save();

        const remainingPercentage = ((pool.totalTokens - pool.usedTokens) / pool.totalTokens) * 100;

        console.log('--- USAGE DEBUG ---');
        console.log('Pool Groq Limit:', pool.groqLimit);
        console.log('Pool Used Groq Tokens:', pool.usedGroqTokens);

        const groqLimit = pool.groqLimit || 1000000;
        const usedGroqTokens = pool.usedGroqTokens || 0;
        const groqRemainingPercentage = ((groqLimit - usedGroqTokens) / groqLimit) * 100;

        console.log('Calculated Groq Percentage:', groqRemainingPercentage);
        console.log('-------------------');

        let status = "green";
        if (remainingPercentage < 20) {
            status = "red";
        } else if (remainingPercentage < 50) {
            status = "blue";
        }

        let groqStatus = "green";
        if (groqRemainingPercentage < 10) {
            groqStatus = "red";
        } else if (groqRemainingPercentage < 25) {
            groqStatus = "blue";
        }

        const finalData = {
            total: pool.totalTokens,
            used: pool.usedTokens,
            remaining: pool.totalTokens - pool.usedTokens,
            percentage: remainingPercentage.toFixed(2),
            status,
            level: status === "red" ? "Critical" : status === "blue" ? "Low" : "Good",
            formattedUsage: `${(pool.usedTokens / 3600).toFixed(3)} hours`,
            remainingTime: `${((pool.totalTokens - pool.usedTokens) / 3600).toFixed(3)} hours`,
            _DEBUG_FIX_VERSION: "v3",

            // Groq Stats
            groq: {
                total: groqLimit,
                used: usedGroqTokens,
                remaining: groqLimit - usedGroqTokens,
                percentage: groqRemainingPercentage.toFixed(2),
                status: groqStatus,
                level: groqStatus === "red" ? "Critical" : groqStatus === "blue" ? "Low" : "Good"
            },

            details: {
                currentMonth: {
                    duration_seconds: currentMonth.audio_duration_seconds,
                    cost: currentMonth.total_cost,
                    transcripts: currentMonth.transcript_count
                },
                last30Days: {
                    duration_seconds: last30Days.audio_duration_seconds,
                    cost: last30Days.total_cost,
                    transcripts: last30Days.transcript_count
                },
                account
            }
        };

        console.log('Final Response Body:', JSON.stringify(finalData, null, 2));

        res.json({
            success: true,
            data: finalData
        });
    } catch (error) {
        console.error("Error fetching usage:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Admin endpoint to reset/update pool
router.post("/initialize", async (req, res) => {
    try {
        const { totalTokens, groqLimit, streamingOffsetSeconds } = req.body;
        let pool = await TokenPool.findOne();
        if (pool) {
            if (totalTokens) pool.totalTokens = totalTokens;
            if (groqLimit) pool.groqLimit = groqLimit;
            if (streamingOffsetSeconds !== undefined) pool.streamingOffsetSeconds = streamingOffsetSeconds;
            await pool.save();
        } else {
            pool = await TokenPool.create({
                totalTokens: totalTokens || 1000000,
                groqLimit: groqLimit || 1000000,
                streamingOffsetSeconds: streamingOffsetSeconds || 0
            });
        }
        res.json({ success: true, pool });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
