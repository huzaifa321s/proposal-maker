import axios from 'axios';

async function testUsage() {
    try {
        console.log('Fetching usage from http://localhost:5000/api/tokens/usage ...');
        const res = await axios.get('http://localhost:5000/api/tokens/usage');
        console.log('Status:', res.status);
        console.log('Response Data Structure:', Object.keys(res.data));
        if (res.data.data) {
            console.log('Usage Data Keys:', Object.keys(res.data.data));
            console.log('Groq Data:', JSON.stringify(res.data.data.groq, null, 2));
        } else {
            console.log('Full Response Body:', JSON.stringify(res.data, null, 2));
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testUsage();
