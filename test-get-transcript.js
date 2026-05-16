import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const ASSEMBLY_API = "https://api.assemblyai.com/v2";
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

async function testGetTranscript() {
    try {
        const id = "d3a50f21-8097-4bab-b30b-89e903c84624";
        console.log(`Fetching transcript ${id}...`);
        const response = await axios.get(`${ASSEMBLY_API}/transcript/${id}`, {
            headers: { authorization: ASSEMBLYAI_API_KEY }
        });
        
        console.log("Audio duration:", response.data.audio_duration);
        
    } catch (error) {
        console.log('Error fetching transcript:', error.response?.status, error.response?.data || error.message);
    }
}

testGetTranscript();
