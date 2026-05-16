import Pusher from 'pusher';
import dotenv from 'dotenv';
dotenv.config()
// ✅ Pusher initialize (serverless-friendly)
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER, // e.g., 'ap2' for Asia
  useTLS: true
});

let clients = []; // Optional: agar SSE bhi rakhna hai

export function initSSE(req, res) {
  // Ye ab optional hai - Pusher automatically handle karega
  res.status(200).json({ 
    message: "Use Pusher for real-time events",
    pusherKey: process.env.PUSHER_KEY,
    cluster: process.env.PUSHER_CLUSTER
  });
}

export function sendSSE(event, data) {
  // ✅ Pusher se broadcast karo
  pusher.trigger('sse-channel', event, data)
    .catch(err => console.error('Pusher error:', err));
  
  // Optional: Purane SSE clients ke liye
  clients.forEach(c => {
    c.res.write(`data: ${JSON.stringify({ event, data })}\n\n`);
  });
}