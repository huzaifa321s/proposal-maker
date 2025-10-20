
import mongoose from "mongoose"
import Admin from "../models/Admin.js";
const getCreds = async (req, res) => {
    try {
        const data = await Admin.findOne();
        console.log('data',data)
        return res.status(200).json({
            message: "Admin found",
            success: true,
            data
        });
    } catch (error) {
        console.log('error', error)
        return res.status(400).json({
            message: "Internal server error",
            success: true,
            data: null
        });
    }
}

export { getCreds }