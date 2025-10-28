let clients = [];

export function initSSE(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  req.on("close", () => {
    clients = clients.filter(c => c.id !== clientId);
  });
}

export function sendSSE(event, data) {
  clients.forEach(c => {
    c.res.write(`data: ${JSON.stringify({ event, data })}\n\n`);
  });
}
