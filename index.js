// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./src/config/db.js";
import profileRoutes from './src/routes/profile.js'
import proposalRoutes from './src/routes/proposal.js'


// Load environment variables
dotenv.config();

const app = express();
// Middleware
connectDB();
app.use(cors());
app.use(express.json());
app.use(express.json());
app.use(express.urlencoded({ limit: "60mb", extended: true }));
// Simple route
app.get("/", (req, res) => {
    res.send("🚀 Server is running successfully (In-House Proposal System API)");
});

app.use('/api',profileRoutes)
app.use('/api/proposals',proposalRoutes)

// Port
const PORT = process.env.PORT;

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});

export default app;