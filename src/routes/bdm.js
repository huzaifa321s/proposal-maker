import express from "express";
import { deleteBDM, getAllBDMs, getTotalBDMs, registerBDM, updateBDM, getBDMDetails } from "../controllers/bdm.js";
import { authenticateToken, requireRole } from "../middleware/authenticateToken.js";

const router = express.Router();

router.get("/get",getAllBDMs);


router.post("/register-bdm", registerBDM);
router.get("/get-all-bdms", getAllBDMs);
router.put("/update-bdm/:id", updateBDM);
router.delete("/delete-bdm/:id", deleteBDM);
router.get("/get-total-bdms", getTotalBDMs);
router.get("/details/:id", authenticateToken, requireRole(["admin"]), getBDMDetails);


export default router;
