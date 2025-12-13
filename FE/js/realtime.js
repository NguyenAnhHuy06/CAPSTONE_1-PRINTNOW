// FE/js/realtime.js
(function (global) {
    const API_BASE_URL = "http://localhost:5000/api";
    const HEARTBEAT_TIMEOUT = 40_000; // tự đóng/khởi tạo lại nếu không thấy ping

    function getToken() {
        try {
            return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
        } catch { return ""; }
    }

    let es = null;
    let lastPing = null;
    let hbTimer = null;

    function start({ onEvent, onError } = {}) {
        stop();
        const token = getToken();
        const url = `${API_BASE_URL}/orders/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;
        es = new EventSource(url, { withCredentials: true });
        lastPing = Date.now();

        es.addEventListener("ping", () => { lastPing = Date.now(); });
        es.addEventListener("message", (e) => {
            try {
                const payload = JSON.parse(e.data || "{}");
                onEvent && onEvent(payload);
            } catch (err) {
                console.warn("[realtime] bad message", err);
            }
        });
        es.onerror = (err) => {
            onError && onError(err);
            // EventSource sẽ tự reconnect; mình chỉ theo dõi heartbeat
        };

        // Watchdog: nếu quá lâu không thấy ping -> reset kết nối
        hbTimer = setInterval(() => {
            if (!lastPing) return;
            if (Date.now() - lastPing > HEARTBEAT_TIMEOUT) {
                stop();
                start({ onEvent, onError });
            }
        }, 10_000);
    }

    function stop() {
        try { if (hbTimer) clearInterval(hbTimer); } catch { }
        hbTimer = null;
        try { if (es) es.close(); } catch { }
        es = null;
    }

    global.Realtime = { connect: start, disconnect: stop };
})(window);
