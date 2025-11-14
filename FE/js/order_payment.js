// js/order_payment.js
// ================== CONFIG ==================
const DEPOSIT_THRESHOLD = 100000;
const DEPOSIT_RATE = 0.5;
const ENABLE_VNPAY = true;

// ===== VIETQR CONFIG (thay bằng info thật của bạn) =====
const VIETQR = {
  bankCode: 'MB',                // MBBank (mã VietQR là 'MB')
  accountNumber: '0896216239',    // Số TK nhận
  accountName: 'NGUYEN ANH HUY',  // TÊN CHỦ TK – CHỮ HOA, KHÔNG DẤU càng tốt
};

// Build URL ảnh QR VietQR (NAPAS)
function buildVietQrUrl({ amount, addInfo, accountNameOverride }) {
  const bank = VIETQR.bankCode.trim();
  const acc = VIETQR.accountNumber.trim();
  const name = encodeURIComponent(
    (accountNameOverride || VIETQR.accountName || '').trim()
  );

  const safeAmount = Math.max(0, Math.round(Number(amount) || 0)); // VND integer
  const info = encodeURIComponent(String(addInfo || '').slice(0, 60)); // tránh quá dài

  // qr_only.png: chỉ ảnh QR (đúng nhu cầu Figma)
  // Có thể dùng .png?amount=...&addInfo=...&accountName=...
  return `https://img.vietqr.io/image/${bank}-${acc}-qr_only.png` +
    `?amount=${safeAmount}&addInfo=${info}&accountName=${name}`;
}

// State hiển thị QR theo Figma
let paymentPollTimer = null;
let orderSSE = null;              // SSE connection theo orderCode
let redirecting = false;          // tránh redirect nhiều lần

// ===== add globals =====
let waitingSince = 0;             // thời điểm vào trạng thái "waiting"
let sseOpenedAt = 0;              // thời điểm mở SSE
let uiState = "idle";             // "idle" | "waiting" | "success"
let successTimerId = null;        // tránh setTimeout trùng

function scheduleSuccess(minMs = 1200) {
  if (uiState === "success") return;
  // nếu chưa từng set waitingSince, coi như vừa vào waiting
  const started = waitingSince || Date.now();
  const elapsed = Date.now() - started;
  const delay = Math.max(0, minMs - elapsed);
  if (successTimerId) { clearTimeout(successTimerId); successTimerId = null; }
  successTimerId = setTimeout(() => {
    if (uiState !== "success") {
      setQrStateSuccess();
      uiState = "success";
    }
  }, delay);
}

// === QR states (3 trạng thái như mock) ===

// idle: hiển thị QR bình thường
function setQrStateIdle() {
  const img = document.getElementById("vietqrImg");
  const row = document.getElementById("qrStateRow");
  const title = document.getElementById("qrCodeTitle");
  const amount = document.getElementById("qrCodeAmountDisplay");
  const success = document.getElementById("qrSuccessBox");
  const waitingBox = document.getElementById("qrWaitingBox");
  const helper = document.getElementById("qrHelperText");
  const extra = document.getElementById("qrExtraLine");
  if (!img || !row || !title || !amount || !success || !waitingBox) return;

  img.style.display = "block";
  row.classList.remove("hidden");
  success.classList.add("hidden");
  waitingBox.classList.add("hidden");   // ẩn ô đồng hồ nếu có

  title.textContent = "Scan QR code to pay";
  // hiển thị “Amount: xxx₫”
  const raw = Number(document.getElementById("summaryPayNowDisplay")?.dataset?.value || 0);
  const totalNow = Number(document.getElementById("totalOrderValueDisplay")?.dataset?.value || 0);
  const showAmt = raw > 0 ? raw : totalNow;
  amount.style.display = "block";
  amount.textContent = `Amount: ${fmtVND(showAmt)}`;
  if (helper) helper.textContent = "Use banking apps or e-wallets that support VnPay";
  if (extra) extra.textContent = "";
  waitingSince = 0;
  uiState = "idle";
}

// waiting: chờ thanh toán (hiển thị đồng hồ, dùng khi ĐÃ quét xong)
function setQrStateWaiting() {
  const img = document.getElementById("vietqrImg");
  const row = document.getElementById("qrStateRow");
  const title = document.getElementById("qrCodeTitle");
  const amount = document.getElementById("qrCodeAmountDisplay");
  const success = document.getElementById("qrSuccessBox");
  const waitingBox = document.getElementById("qrWaitingBox");
  const helper = document.getElementById("qrHelperText");
  const extra = document.getElementById("qrExtraLine");
  if (!img || !row || !title || !amount || !success || !waitingBox) return;

  // ẨN QR, HIỆN Ô ĐỒNG HỒ (không dùng hàng text)
  img.style.display = "none";
  success.classList.add("hidden");
  waitingBox.classList.remove("hidden");
  // ensure có đồng hồ
  if (waitingBox && !waitingBox.firstElementChild) {
    waitingBox.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="animate-spin text-gray-500"><circle cx="12" cy="12" r="10" stroke-opacity=".25"></circle><path d="M12 6v6l4 2" stroke-opacity=".8"></path></svg>';
  }
  row.classList.remove("hidden");      // HIỆN dòng chữ dưới đồng hồ

  title.textContent = "Waiting for payment...";
  // “Amount: xxx₫”
  const raw = Number(document.getElementById("summaryPayNowDisplay")?.dataset?.value || 0);
  const totalNow = Number(document.getElementById("totalOrderValueDisplay")?.dataset?.value || 0);
  const showAmt = raw > 0 ? raw : totalNow;
  amount.style.display = "block";
  amount.textContent = `Amount: ${fmtVND(showAmt)}`;
  if (helper) helper.textContent = "Use banking apps or e-wallets that support VnPay";
  if (extra) extra.textContent = "";
  waitingSince = Date.now();     // <-- ĐÁNH DẤU đang waiting
  uiState = "waiting";
}

// success: thanh toán thành công
function setQrStateSuccess() {
  const img = document.getElementById("vietqrImg");
  const row = document.getElementById("qrStateRow");
  const title = document.getElementById("qrCodeTitle");
  const amount = document.getElementById("qrCodeAmountDisplay");
  const success = document.getElementById("qrSuccessBox");
  const waitingBox = document.getElementById("qrWaitingBox");
  const helper = document.getElementById("qrHelperText");
  const extra = document.getElementById("qrExtraLine");
  if (!img || !row || !title || !amount || !success || !waitingBox) return;


  img.style.display = "none";
  row.classList.remove("hidden");
  waitingBox.classList.add("hidden");  // ẩn ô đồng hồ
  success.classList.remove("hidden");

  title.textContent = "Payment Successful";
  amount.style.display = "none";       // theo yêu cầu: không hiện Amount ở success
  if (helper) helper.textContent = "Redirecting...";
  if (extra) {
    const oc = (document.getElementById("orderCodeDisplay")?.textContent || "").trim();
    extra.textContent = oc ? `Code: ${oc}` : "";
  }
  uiState = "success";
}

// ================== UTILS ==================
const fmtVND = (n) => Math.round(Number(n) || 0).toLocaleString("vi-VN") + "₫";
const $ = (sel) => document.querySelector(sel);
function safeParseLocal(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

// ================== RENDER BASICS ==================
function bindBasics({ orderCode, fileCount, totalAmount, customer }) {
  $("#orderCodeDisplay").textContent = orderCode || "N/A";
  $("#fileCountDisplay").textContent = `${fileCount} ${fileCount > 1 ? "files" : "file"
    }`;
  $("#totalOrderValueDisplay").textContent = fmtVND(totalAmount);
  $("#totalOrderValueDisplay").dataset.value = totalAmount;
  $("#summaryTotalDisplay").textContent = fmtVND(totalAmount);

  const infoBox = $("#customerInfoSummary");
  const emptyBox = $("#emptySummaryInfoBlock");
  if (customer?.name) {
    $("#summaryCustomerName").textContent = customer.name;
    $("#summaryCustomerEmail").textContent = customer.email || "N/A";
    infoBox.style.display = "block";
    emptyBox.style.display = "none";
  } else {
    infoBox.style.display = "none";
    emptyBox.style.display = "block";
  }
}

// ================== PAYMENT UI ==================
function wirePaymentOptions(total, defaultConfirmHandler) {
  const depositSec = $("#depositRequiredSection");
  const vnpayOpt = document.querySelector('.payment-option[data-method="vnpay"]');
  const storeOpt = document.querySelector('.payment-option[data-method="store"]');
  const vnpayDesc = $("#vnpayDescription");
  const summaryPayNow = $("#summaryPayNowDisplay");
  const qrSec = $("#qrCodePaymentSection");
  const qrAmt = $("#qrCodeAmountDisplay");
  const btn = $("#confirmPaymentButton");

  const isDeposit = total >= DEPOSIT_THRESHOLD;

  // MẶC ĐỊNH ẨN deposit; chỉ hiện khi CHỌN VNPAY
  depositSec.style.display = "none";
  vnpayDesc.textContent = ENABLE_VNPAY
    ? "Pay full amount online"
    : "Online payment is not available yet";

  // Mặc định chọn "Pay at store"
  $("#payAtStore").checked = true;
  document.querySelectorAll(".payment-option").forEach(o => o.classList.remove("active"));
  storeOpt.classList.add("active");
  qrSec.style.display = "none";
  depositSec.style.display = "none";     // <- đảm bảo ẩn khi mặc định Store
  summaryPayNow.textContent = fmtVND(0);
  btn.style.display = "block";
  btn.textContent = "Confirm payment at the store";
  btn.classList.remove("bg-green-500");
  btn.classList.add("bg-primary-blue");
  btn.style.backgroundColor = "#0095ff";
  if (typeof defaultConfirmHandler === "function") btn.onclick = defaultConfirmHandler;
  // --- Trở lại "Pay at store" ---
  if (orderSSE) { orderSSE.close(); orderSSE = null; }
  if (paymentPollTimer) { clearInterval(paymentPollTimer); paymentPollTimer = null; }
  setQrStateIdle();                 // ⬅️ reset QR UI
  qrSec.style.display = "none";
  summaryPayNow.textContent = fmtVND(0);

  // --- Chọn phương thức ---
  document.querySelectorAll(".payment-option").forEach((option) => {
    const radio = option.querySelector('input[type="radio"]');
    option.onclick = async () => {
      const method = option.dataset.method;

      if (!ENABLE_VNPAY && method === "vnpay") {
        alert('Online payment is not available yet. Please choose "Pay at store".');
        return;
      }

      document.querySelectorAll(".payment-option").forEach(o => o.classList.remove("active"));
      option.classList.add("active");
      radio.checked = true;

      if (method === "vnpay") {
        // mỗi lần chọn lại VNPAY thì reset cờ
        redirecting = false;
        // Số tiền phải trả ngay (đặt cọc 50% nếu vượt ngưỡng)
        const payNow = isDeposit ? total * DEPOSIT_RATE : total;

        // Hiển thị QR section + số tiền
        qrSec.style.display = "block";
        qrAmt.textContent = fmtVND(payNow);
        summaryPayNow.textContent = fmtVND(payNow);
        summaryPayNow.dataset.value = Math.round(payNow); // lưu số thô

        // CHỈ hiện thẻ deposit khi chọn VnPay và đơn vượt ngưỡng
        if (isDeposit) {
          const depositAmount = total * DEPOSIT_RATE;
          const remain = total - depositAmount;
          $("#depositAmountDisplay").textContent = fmtVND(depositAmount);
          $("#remainingAmountDisplay").textContent = fmtVND(remain);
          vnpayDesc.textContent = "Pay the deposit online (50% of total)";
          depositSec.style.display = "block";
        } else {
          vnpayDesc.textContent = "Pay full amount online";
          depositSec.style.display = "none";
        }

        // ẨN nút (không còn “I’ve paid — check now”)
        btn.style.display = "none";
        btn.onclick = null;

        // Dựng QR: chỉ dùng 1 mã "dính liền" để tránh app ngân hàng hiển thị 2 dòng nội dung
        // SSE vẫn nghe theo mã CHUẨN để khớp với broadcastPaid("#ORD-YYYY-XXX", ...)
        const ocRaw = ($("#orderCodeDisplay").textContent || "ORDER").trim();   // ví dụ: "#ORD-2025-145"
        const ocCompact = ocRaw.replace(/[#-]/g, "");                           // "ORD2025145"
        const addInfo = ocCompact; // ✅ chỉ một mã
        const img = document.querySelector(".qr-code-img");
        const qrUrl = buildVietQrUrl({ amount: Math.round(payNow), addInfo });

        // 1) KHÔNG bật "chờ" ở đây. Ban đầu CHỈ hiển thị QR
        setQrStateIdle();

        // 2) CHỈ mở SSE sau khi ảnh QR đã load (tránh nhảy quá nhanh)
        img.onload = () => {
          try {
            if (orderSSE) { orderSSE.close(); orderSSE = null; }
            sseOpenedAt = Date.now();
            // ⚠️ Nghe theo mã CHUẨN (không phải chuỗi addInfo đôi) để trùng với BE broadcast
            orderSSE = new EventSource(`/api/orders/${encodeURIComponent(ocRaw)}/stream`);

            orderSSE.onmessage = (ev) => {
              try {
                const data = JSON.parse(ev.data || "{}");
                if (data.type === "paid") {
                  if (redirecting) return;
                  redirecting = true;

                  const paidNow = Math.round(Number(data.paidAmount ?? payNow) || 0);
                  $("#summaryPayNowDisplay").textContent = fmtVND(paidNow);
                  $("#summaryPayNowDisplay").dataset.value = paidNow; // đồng bộ số thô

                  // Chỉ khi nhận 'paid' mới vào trạng thái "waiting"
                  if (uiState !== "waiting") setQrStateWaiting();
                  // Giữ "waiting" tối thiểu 1.2s rồi chuyển success
                  scheduleSuccess(5000);

                  // NEW: Ghi currentOrderData để trang /order/status đọc được dù refresh/đi thẳng link
                  try {
                    const paidAmount = Number(data.paidAmount ?? payNow) || 0;
                    const total = Number($("#totalOrderValueDisplay")?.dataset?.value || 0);
                    const orderCode = ocRaw || "N/A";
                    const fileCount = Number($("#fileCountDisplay")?.textContent?.match(/\d+/)?.[0] || 0);

                    const current = safeParseLocal("currentOrderData", {});
                    // Nếu có giảm giá => xem số phải trả cuối cùng là paidAmount
                    const finalTotal = Math.min(Math.max(0, total), paidAmount || total);
                    const remainingAfterPay = Math.max(0, finalTotal - paidAmount);
                    const updated = {
                      ...current,
                      orderCode,
                      service: current?.service ?? "Print Documents",
                      fileCount: current?.fileCount ?? fileCount,
                      paymentMethod: "VnPay",
                      paidAmount,
                      remainingAmount: remainingAfterPay,
                      orderDate: new Date().toISOString(),
                      expectedCompletion: current?.expectedCompletion ?? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                      // Ưu tiên lưu tổng sau giảm để trang Status hiển thị đúng
                      summary: {
                        ...(current?.summary ?? {}),
                        totalPrice: finalTotal,
                        fileCount
                      },
                      // Thêm field tường minh cho về sau (FE ưu tiên dùng nếu có)
                      finalTotal
                    };
                    localStorage.setItem("currentOrderData", JSON.stringify(updated));
                  } catch { }

                  // đóng SSE và chuyển trang sau khi đã hiển thị success
                  if (orderSSE) { try { orderSSE.close(); } catch { } orderSSE = null; }
                  // Cho người dùng thấy ✓ rõ trước khi chuyển trang
                  setTimeout(() => {
                    // Điều hướng bằng mã CHUẨN
                    window.location.href = `/order/status?orderCode=${encodeURIComponent(ocRaw)}`;
                  }, 10000);
                }
              } catch { }
            };
            orderSSE.onerror = () => { };
          } catch { }
        };
        // fallback nếu ảnh QR lỗi vẫn mở SSE để không chặn thanh toán
        img.onerror = () => {
          try {
            if (orderSSE) { orderSSE.close(); orderSSE = null; }
            orderSSE = new EventSource(`/api/orders/${encodeURIComponent(ocRaw)}/stream`);
          } catch { }
        };
        // 3) set src SAU khi đã gán onload/onerror
        img.src = qrUrl;

        // Nếu có timer poll cũ thì clear
        if (paymentPollTimer) { clearInterval(paymentPollTimer); paymentPollTimer = null; }
        return;
      }

      // --- Trở lại "Pay at store" ---
      if (orderSSE) { orderSSE.close(); orderSSE = null; }
      if (successTimerId) { clearTimeout(successTimerId); successTimerId = null; }
      qrSec.style.display = "none";
      summaryPayNow.textContent = fmtVND(0);
      depositSec.style.display = "none";   // <- ẨN khi chuyển về Store
      btn.style.display = "block";
      btn.textContent = "Confirm payment at the store";
      btn.classList.remove("bg-green-500");
      btn.classList.add("bg-primary-blue");
      btn.style.backgroundColor = "#0095ff";
      if (typeof defaultConfirmHandler === "function") btn.onclick = defaultConfirmHandler;
      setQrStateIdle();
    };
  });
}

// ================== CONFIRM ACTION ==================
function wireConfirmButton(
  total,
  backendOrderId,
  orderCodeForRedirect,
  localOrder
) {
  const btn = $("#confirmPaymentButton");
  const confirmHandler = async () => {
    const method =
      document.querySelector('input[name="paymentMethod"]:checked')?.value ||
      "store";

    // Online
    if (method === "vnpay") {
      if (!ENABLE_VNPAY) {
        alert(
          'Online payment is not available yet. Please choose "Pay at store".'
        );
        return;
      }
      const amount = total >= DEPOSIT_THRESHOLD ? total * DEPOSIT_RATE : total;
      alert(
        `Vui lòng quét mã QR để thanh toán ${fmtVND(amount)} (mô phỏng VNPAY).`
      );
      return;
    }

    // Store (cash)
    if (!backendOrderId) {
      alert("Không tìm thấy orderId! Vui lòng quay lại trang trước.");
      return;
    }

    const btn = $("#confirmPaymentButton");
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Confirming...";

    try {
      // Gọi backend xác nhận thanh toán tại cửa hàng
      const payment = await confirmStorePayment(backendOrderId);

      if (payment) {
        const pid = payment.id != null ? `Payment #${payment.id}\n` : "";
        alert(
          `Đã ghi nhận thanh toán tại cửa hàng.\n` +
          pid +
          `Số tiền: ${fmtVND(payment.amount ?? 0)}\n` +
          `Trạng thái: ${payment.status || "PENDING"}`
        );
      } else {
        alert("Đơn hàng đã được xác nhận. Thanh toán tại cửa hàng khi nhận.");
      }

      // (tùy) lưu nhanh 1 số info để trang status hiển thị
      if (localOrder) {
        const paidAmount = 0; // cash tại quầy
        const updatedOrderData = {
          ...localOrder,
          service: localOrder.service ?? "Print Documents",
          fileCount:
            localOrder?.summary?.fileCount ?? localOrder?.files?.length ?? 0,
          paymentMethod: "At the store",
          paidAmount,
          remainingAmount: total - paidAmount,
          orderDate: new Date().toISOString(),
          expectedCompletion: new Date(
            Date.now() + 2 * 24 * 60 * 60 * 1000
          ).toISOString(),
        };
        localStorage.setItem(
          "currentOrderData",
          JSON.stringify(updatedOrderData)
        );
      }

      // Điều hướng sang trang trạng thái (sửa typo)
      const code = orderCodeForRedirect || "N/A";
      window.location.href = `/order/status?orderCode=${encodeURIComponent(
        code
      )}`;
    } catch (e) {
      console.error(e);
      if (String(e.message).includes("UNAUTHORIZED")) {
        alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        window.location.href = "/login";
        return;
      }
      alert("Xác nhận thanh toán tại cửa hàng thất bại.");
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  };
  btn.onclick = confirmHandler;
  return confirmHandler; // ⬅️ trả về để tái gán khi cần
}

// ================== MAIN ==================
document.addEventListener("DOMContentLoaded", async () => {
  const overlay = $("#loadingOverlay");
  if (overlay) overlay.style.display = "flex";

  // Ưu tiên currentOrderData; fallback printOrderData (từ PrintPhoto.html)
  const local = safeParseLocal(
    "currentOrderData",
    safeParseLocal("printOrderData", {})
  );
  const backendOrderId = localStorage.getItem("backendOrderId") || null;

  let serverOrder = null;
  let orderCode = local?.orderCode || "N/A";
  let totalAmount = Number(local?.summary?.totalPrice || 0);
  let fileCount = Number(
    local?.summary?.fileCount || local?.files?.length || 0
  );

  if (backendOrderId && typeof getOrderById === "function") {
    try {
      const order = await getOrderById(backendOrderId);
      if (order) {
        serverOrder = order;
        orderCode = order.code || order.orderCode || orderCode;
        totalAmount =
          order.totalAmount != null ? Number(order.totalAmount) : totalAmount;
        fileCount = order.items?.length ?? fileCount;
      }
    } catch (e) {
      console.warn("Load order from backend failed, fallback local:", e);
      if (String(e.message).includes("UNAUTHORIZED")) {
        alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        window.location.href = "/login";
        return;
      }
    }
  }

  // Dữ liệu khách
  const customer = local?.customer || null;

  // Nếu hoàn toàn không có dữ liệu
  if (!serverOrder && !fileCount && !totalAmount) {
    alert("Không tìm thấy dữ liệu đơn hàng. Vui lòng tạo đơn lại.");
    window.location.href = "/service/print";
    return;
  }

  bindBasics({ orderCode, fileCount, totalAmount, customer });
  const defaultConfirmHandler = wireConfirmButton(
    totalAmount,
    backendOrderId,
    orderCode,
    local
  );
  wirePaymentOptions(totalAmount, defaultConfirmHandler);

  if (overlay) overlay.style.display = "none";
});

// Clear timer khi rời trang
window.addEventListener("beforeunload", () => {
  if (paymentPollTimer) clearInterval(paymentPollTimer);
  if (orderSSE) { orderSSE.close(); orderSSE = null; }
});