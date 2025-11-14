// js/apiService.js
/**
 * API Service - Helper functions để gọi Backend APIs
 * Không ảnh hưởng đến UI/UX, chỉ xử lý logic kết nối backend
 */

const API_BASE_URL = "http://localhost:5000/api";

// ===================================
// AUTHENTICATION HELPERS
// ===================================
const api = (path, opts = {}) =>
  fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...opts,
  });

/**
 * Lấy JWT token từ localStorage hoặc sessionStorage
 */
function getAuthToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

/**
 * Kiểm tra user đã đăng nhập chưa
 */
function isAuthenticated() {
  return !!getAuthToken();
}

/**
 * Lấy thông tin user từ token (decode JWT)
 */
function getUserFromToken() {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id: payload.id,
      email: payload.email,
      fullName: payload.fullName,
    };
  } catch (error) {
    console.error("Lỗi decode token:", error);
    return null;
  }
}

// Kiểm tra xác thực user từ backend
async function authMe() {
  const res = await api("/auth/me");
  return res.ok ? res.json() : null;
}

// ===================================
// CATALOG APIs (Lấy danh mục)
// ===================================

/**
 * Lấy tất cả catalog: paper sizes, color modes, sides
 */
async function getAllCatalog() {
  try {
    const response = await fetch(`${API_BASE_URL}/catalog/all`);
    const data = await response.json();

    if (data.success) {
      return data.catalog;
    }
    throw new Error(data.message || "Không thể lấy catalog");
  } catch (error) {
    console.error("Lỗi getAllCatalog:", error);
    throw error;
  }
}

/**
 * Lấy danh sách kích thước giấy
 */
async function getPaperSizes() {
  try {
    const response = await fetch(`${API_BASE_URL}/catalog/paper-sizes`);
    const data = await response.json();

    if (data.success) {
      return data.paperSizes;
    }
    throw new Error(data.message || "Không thể lấy danh sách kích thước giấy");
  } catch (error) {
    console.error("Lỗi getPaperSizes:", error);
    throw error;
  }
}

/**
 * Lấy danh sách chế độ màu
 */
async function getColorModes() {
  try {
    const response = await fetch(`${API_BASE_URL}/catalog/color-modes`);
    const data = await response.json();

    if (data.success) {
      return data.colorModes;
    }
    throw new Error(data.message || "Không thể lấy danh sách chế độ màu");
  } catch (error) {
    console.error("Lỗi getColorModes:", error);
    throw error;
  }
}

/**
 * Lấy danh sách chế độ in (1 side / 2 sides)
 */
async function getSides() {
  try {
    const response = await fetch(`${API_BASE_URL}/catalog/sides`);
    const data = await response.json();

    if (data.success) {
      return data.sides;
    }
    throw new Error(data.message || "Không thể lấy danh sách chế độ in");
  } catch (error) {
    console.error("Lỗi getSides:", error);
    throw error;
  }
}

// ===================================
// FILE ANALYZER APIs (Đếm số trang)
// ===================================

/**
 * Phân tích file và đếm số trang
 * @param {File} file - File object từ input
 * @returns {Promise<Object>} - Thông tin file và số trang
 */
async function analyzeFile(file) {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/file-analyzer/analyze-file`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      return {
        originalName: data.data.originalName,
        fileSize: data.data.fileSize,
        fileType: data.data.fileType,
        pageCount: data.data.pageCount,
        isSupported: data.data.analysis.isSupported,
      };
    }
    throw new Error(data.message || "Không thể phân tích file");
  } catch (error) {
    console.error("Lỗi analyzeFile:", error);
    throw error;
  }
}

/**
 * Phân tích nhiều file cùng lúc
 * @param {File[]} files - Mảng File objects
 * @returns {Promise<Object>} - Kết quả phân tích nhiều file
 */
async function analyzeMultipleFiles(files) {
  try {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const response = await fetch(
      `${API_BASE_URL}/file-analyzer/analyze-multiple-files`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (data.success) {
      return data.data;
    }
    throw new Error(data.message || "Không thể phân tích nhiều file");
  } catch (error) {
    console.error("Lỗi analyzeMultipleFiles:", error);
    throw error;
  }
}

// ===================================
// PRICE CALCULATION APIs (Tính giá)
// ===================================

/**
 * Tính giá cho một item
 * @param {Object} params - {paperSizeId, colorModeId, sideId, pages, quantity}
 * @returns {Promise<Object>} - Kết quả tính giá
 */
async function calculatePrice(params) {
  try {
    const response = await fetch(`${API_BASE_URL}/catalog/calculate-price`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (data.success) {
      return data.calculation;
    }
    throw new Error(data.message || "Không thể tính giá");
  } catch (error) {
    console.error("Lỗi calculatePrice:", error);
    throw error;
  }
}

// ===================================
// ORDER APIs (Tạo và quản lý đơn hàng)
// ===================================

/**
 * Tạo đơn hàng mới
 * @param {Object} orderData - {note, orderItems: [{printType, pricingMode, paperSizeId, colorModeId, sideId, pages, quantity, unitPrice}]}
 * @returns {Promise<Object>} - Đơn hàng đã tạo
 */
async function createOrder(orderData) {
  try {
    const response = await api("/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });
    const data = await response.json();
    if (data.success) return data.order;
    throw new Error(data.message || "Không thể tạo đơn hàng");
  } catch (error) {
    console.error("Lỗi createOrder:", error);
    throw error;
  }
}

/**
 * Lấy danh sách đơn hàng của user
 * @returns {Promise<Array>} - Danh sách đơn hàng
 */
async function getMyOrders() {
  try {
    const res = await api("/orders");
    if (res.status === 401)
      throw new Error("Bạn cần đăng nhập để xem đơn hàng");
    const data = await res.json();
    // BE trả: { success, data, pagination }
    if (data.success) return data.data;
    throw new Error(data.message || "Không thể lấy danh sách đơn hàng");
  } catch (err) {
    console.error("Lỗi getMyOrders:", err);
    throw err;
  }
}

/**
 * Lấy chi tiết một đơn hàng
 * @param {number} orderId - ID đơn hàng
 * @returns {Promise<Object>} - Chi tiết đơn hàng
 */
// FE/js/apiService.js
async function getOrderById(orderId) {
  try {
    const response = await api(`/orders/${orderId}`);
    const data = await response.json();
    if (data.success) return data.data; // <-- đổi từ data.order -> data.data
    throw new Error(data.message || "Không thể lấy chi tiết đơn hàng");
  } catch (error) {
    console.error("Lỗi getOrderById:", error);
    throw error;
  }
}

// Xác nhận thanh toán khi khách hàng chọn thanh toán tại cửa hàng
async function confirmStorePayment(orderId) {
  const res = await api(`/orders/${orderId}/confirm-store`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  const data = await res.json();
  if (!res.ok || !data?.success)
    throw new Error(data?.message || "Xác nhận thanh toán thất bại");
  // Luôn kỳ vọng BE trả về payment có id
  if (!data.payment || typeof data.payment.id === "undefined") {
    throw new Error("BACKEND_NO_PAYMENT_OBJECT");
  }
  return data.payment;
}

/**
 * Hủy đơn bằng orderCode (VD: "#ORD-2025-007" hoặc "PHOTO-000123")
 */
async function cancelOrderByCode(orderCode, reason = "") {
  const res = await api(`/orders/${encodeURIComponent(orderCode)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  const data = await res.json();
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Hủy đơn thất bại");
  }
  return true;
}

// ===================================
// MAPPING HELPERS (Convert frontend → backend IDs)
// ===================================

/**
 * Lưu catalog vào localStorage để dùng offline
 */
function saveCatalogToStorage(catalog) {
  localStorage.setItem("catalog", JSON.stringify(catalog));
  localStorage.setItem("catalog_timestamp", Date.now().toString());
}

/**
 * Lấy catalog từ localStorage
 */
function getCatalogFromStorage() {
  const catalog = localStorage.getItem("catalog");
  const timestamp = localStorage.getItem("catalog_timestamp");

  // Cache 24 giờ
  if (
    catalog &&
    timestamp &&
    Date.now() - parseInt(timestamp) < 24 * 60 * 60 * 1000
  ) {
    return JSON.parse(catalog);
  }
  return null;
}

/**
 * Lấy catalog (từ cache hoặc API)
 */
async function getCatalogData() {
  // Thử lấy từ cache trước
  const cached = getCatalogFromStorage();
  if (cached) {
    return cached;
  }

  // Nếu không có cache, gọi API
  const catalog = await getAllCatalog();
  saveCatalogToStorage(catalog);
  return catalog;
}

/**
 * Tìm ID kích thước giấy từ tên (VD: "A4" → 1)
 */
function findPaperSizeId(name, catalog) {
  const paperSize = catalog.paperSizes.find((ps) => ps.name === name);
  return paperSize ? paperSize.id : null;
}

/**
 * Tìm ID chế độ màu từ description (VD: "Black & White" → 1)
 */
function findColorModeId(description, catalog) {
  const colorMode = catalog.colorModes.find(
    (cm) =>
      cm.description.toLowerCase().includes(description.toLowerCase()) ||
      description.toLowerCase().includes(cm.description.toLowerCase())
  );
  return colorMode ? colorMode.id : null;
}

/**
 * Tìm ID chế độ in từ description (VD: "1 side" → 1)
 */
function findSideId(description, catalog) {
  const side = catalog.sides.find(
    (s) =>
      s.description.toLowerCase().includes(description.toLowerCase()) ||
      description.toLowerCase().includes(s.description.toLowerCase())
  );
  return side ? side.id : null;
}

// ===================================
// EXPORT (Make functions available globally)
// ===================================

// ======= VNPAY PAYMENT APIS =======
async function createVnpayPayment({ orderId, amount, payType, returnUrl }) {
  const res = await api("/payments/vnpay/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, amount, payType, returnUrl }),
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  const data = await res.json();
  if (!data?.success) throw new Error(data?.message || "Tạo phiên VNPAY thất bại");
  return data.payment; // {id, qrImageUrl, status, expireAt, ...}
}

async function getPaymentStatus(paymentId) {
  const res = await api(`/payments/${paymentId}/status`);
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  const data = await res.json();
  if (!data?.success) throw new Error(data?.message || "Lấy trạng thái thanh toán thất bại");
  return data.payment; // {status: "PENDING"|"SUCCESS"|"FAILED"|"EXPIRED"}
}

// Nếu dùng module system (ES6)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    // Auth
    getAuthToken,
    isAuthenticated,
    getUserFromToken,
    authMe, // Authentication

    // Catalog
    getAllCatalog,
    getPaperSizes,
    getColorModes,
    getSides,
    getCatalogData,

    // File Analyzer
    analyzeFile,
    analyzeMultipleFiles,

    // Price
    calculatePrice,

    // Orders
    createOrder,
    getMyOrders,
    getOrderById,
    confirmStorePayment, // Orders
    cancelOrderByCode,   // Orders

    // Mapping Helpers
    findPaperSizeId,
    findColorModeId,
    findSideId,

    // VNPay
    createVnpayPayment,
    getPaymentStatus,

  };
}
