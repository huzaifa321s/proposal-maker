import axios from 'axios';

async function init() {
    try {
        console.log('Initializing TokenPool...');
        const res = await axios.post('http://localhost:5000/api/tokens/initialize', {
            totalTokens: 2185200,      // 607 hours
            streamingOffsetSeconds: 953200 // 264.7777 hours
        });
        console.log('Success:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
    }
}

init();
