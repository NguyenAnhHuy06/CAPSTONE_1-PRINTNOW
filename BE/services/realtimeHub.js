// services/realtimeHub.js
// Hub siêu nhẹ cho SSE dashboard (broadcast cùng 1 topic)
const clients = new Set(); // Set(res)

function addClient(res) { clients.add(res); }
function removeClient(res) { clients.delete(res); }

function publish(evt) {
    // evt: { type, ts, data }
    if (!evt || clients.size === 0) return;

    const payload = JSON.stringify({
        type: evt.type || 'orders.updated',
        ts: evt.ts || Date.now(),
        data: evt.data ?? null,
    });

    for (const res of clients) {
        try {
            res.write(`data: ${payload}\n\n`);
        } catch {
            // Nếu client đã đóng kết nối thì lần sau sẽ được cleanup ở nơi khác
        }
    }
}

module.exports = { addClient, removeClient, publish };
