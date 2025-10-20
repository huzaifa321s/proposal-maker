import express from "express";
import { getCreds } from "../controllers/profile.js";
const router = express.Router();

router.get('/get-creds',getCreds)


export default router