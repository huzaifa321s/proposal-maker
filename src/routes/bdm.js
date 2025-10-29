import express from "express";
import { getAllBDMs } from "../controllers/bdm.js";

const router = express.Router();

router.get("/get", getAllBDMs);

export default router;
