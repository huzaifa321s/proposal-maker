import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const ASSEMBLY_API = "https://api.assemblyai.com/v2";
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

async function testUsage() {
    try {
        const response = await axios.get(`${ASSEMBLY_API}/account`, {
            headers: { authorization: ASSEMBLYAI_API_KEY }
        });
        console.log('Usage Data:', response.data);
    } catch (error) {
        console.log('Error fetching usage:', error.response?.status, error.response?.data);
    }
}

testUsage();
