import axios from "axios";

const ASSEMBLY_API = "https://api.assemblyai.com/v2";
const COST_PER_HOUR = 0.37; // Standard tier estimation

// Cache for specific queries to avoid rate limits
const cache = new Map();

/**
 * Helper to clear cache entries older than TTL
 */
function cleanCache() {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > 60 * 1000) { // 1 minute TTL
            cache.delete(key);
        }
    }
}

/**
 * Get usage statistics for a specific date range
 * @param {string} startDate - ISO date string (optional)
 * @param {string} endDate - ISO date string (optional)
 */
export async function getUsageStats(startDate, endDate) {
    cleanCache();
    const cacheKey = `${startDate || 'start'}-${endDate || 'end'}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey).data;
    }

    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();

    try {
        let totalSeconds = 0;
        let transcriptCount = 0;
        let nextUrl = `${ASSEMBLY_API}/transcript?limit=50&status=completed`;
        const headers = { authorization: process.env.ASSEMBLYAI_API_KEY };
        
        const idsToFetch = [];
        let stopFetching = false;

        // Step 1: Collect IDs within date range
        while (nextUrl && !stopFetching) {
            const response = await axios.get(nextUrl, { headers });
            const { transcripts, page_details } = response.data;
            
            for (const t of transcripts) {
                const created = new Date(t.created);
                
                if (created > end) continue; // Skip newer than end date
                if (created < start) {
                    stopFetching = true; // Stop if older than start date (assuming desc order)
                    break;
                }
                
                idsToFetch.push(t.id);
            }

            nextUrl = stopFetching ? null : page_details.next_url;
        }

        // Step 2: Fetch details for duration (in batches)
        for (let i = 0; i < idsToFetch.length; i += 10) {
            const batchIds = idsToFetch.slice(i, i + 10);
            const promises = batchIds.map(id => 
                axios.get(`${ASSEMBLY_API}/transcript/${id}`, { headers })
                    .then(res => res.data.audio_duration || 0)
                    .catch(err => 0)
            );
            
            const durations = await Promise.all(promises);
            totalSeconds += durations.reduce((a, b) => a + b, 0);
            transcriptCount += durations.length;
        }

        const stats = {
            audio_duration_seconds: totalSeconds,
            transcript_count: transcriptCount,
            total_cost: ((totalSeconds / 3600) * COST_PER_HOUR).toFixed(2)
        };

        cache.set(cacheKey, {
            data: stats,
            timestamp: Date.now()
        });

        return stats;

    } catch (error) {
        console.error("Error calculating usage stats:", error);
        throw error;
    }
}

/**
 * Get usage for the current month
 */
export async function getCurrentMonthUsage() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return await getUsageStats(startOfMonth.toISOString());
}

/**
 * Get usage for the last 30 days
 */
export async function getLast30DaysUsage() {
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - 30);
    return await getUsageStats(start.toISOString());
}

/**
 * Get detailed usage breakdown (mimicking user request)
 */
export async function getDetailedUsage() {
    const currentMonth = await getCurrentMonthUsage();
    // Since we don't have feature breakdown from API, we'll return a simplified structure
    // matching the user's requested fields where possible
    return {
        ...currentMonth,
        breakdown: {
            "Transcription": {
                audio_duration_seconds: currentMonth.audio_duration_seconds,
                cost: currentMonth.total_cost
            }
        }
    };
}

/**
 * Get account info (Mocked/Limited as API endpoint /user is 404)
 */
export async function getAccountInfo() {
    // Since /v2/user returns 404, we return what we know or a placeholder
    return {
        id: "unavailable_via_api",
        email: "check_dashboard",
        plan: "standard" // assumption
    };
}

// Backward compatibility
export async function getAssemblyAIUsage() {
    const stats = await getUsageStats(); // All time
    return stats.audio_duration_seconds;
}
