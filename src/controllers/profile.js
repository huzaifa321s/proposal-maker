
import user from "../models/user.js";
const getCreds = async (req, res) => {
    try {
        const data = await user.findOne({_id:req.user.id});
        console.log('data',data)
        return res.status(200).json({
            message: "user found",
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