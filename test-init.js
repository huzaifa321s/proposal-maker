import axios from 'axios';

async function testInit() {
    try {
        console.log('Testing INITIALIZE endpoint...');
        const res = await axios.post('http://localhost:5000/api/tokens/initialize', {
            totalTokens: 1234567,
            groqLimit: 987654
        });
        console.log('Status:', res.status);
        console.log('Response Pool Data:', JSON.stringify(res.data.pool, null, 2));
    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
    }
}

testInit();
