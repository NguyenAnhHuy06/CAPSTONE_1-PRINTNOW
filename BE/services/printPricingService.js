const fs = require('fs');
const path = require('path');

// Cấu hình giá cơ bản và hệ số
const PRICING_CONFIG = {
    // Giá cơ bản cho 1 trang
    BASE_PRICE_PER_PAGE: 1000, // VND

    // Hệ số nhân cho kích thước giấy
    PAPER_SIZE_MULTIPLIERS: {
        'A0': 8.00,   // A0 = 8x A4
        'A1': 4.00,   // A1 = 4x A4  
        'A2': 2.00,   // A2 = 2x A4
        'A3': 1.50,   // A3 = 1.5x A4
        'A4': 1.00,   // A4 = chuẩn
        'A5': 0.70,   // A5 = 0.7x A4
        'Letter': 1.05, // Letter ≈ A4
        'Legal': 1.20   // Legal > A4
    },

    // Phí in màu
    COLOR_FEE: 5000, // VND

    // Phí đóng bìa
    BINDING_FEE: 5000, // VND

    // Phí trang bìa
    COVER_PAGE_FEE: 2000, // VND

    // Phí bìa kiếng
    GLASS_COVER_FEE: 3000, // VND

    // Hệ số cho in 2 mặt (sau khi chia 2, làm tròn lên)
    DOUBLE_SIDE_MULTIPLIER: 1.5 // 1500 VND/trang
};

/**
 * Tính số trang sau khi xử lý in 2 mặt
 * @param {number} totalPages - Tổng số trang
 * @param {string} printSides - 'single' hoặc 'double'
 * @returns {number} - Số trang tính toán
 */
const calculatePrintPages = (totalPages, printSides) => {
    if (printSides === 'single') {
        return totalPages;
    } else if (printSides === 'double') {
        // Chia 2 và làm tròn lên
        return Math.ceil(totalPages / 2);
    }
    return totalPages;
};

/**
 * Tính giá cơ bản cho file
 * @param {number} calculatedPages - Số trang đã tính toán
 * @param {string} printSides - Chế độ in
 * @returns {number} - Giá cơ bản
 */
const calculateBasePrice = (calculatedPages, printSides) => {
    if (printSides === 'double') {
        return calculatedPages * PRICING_CONFIG.DOUBLE_SIDE_MULTIPLIER * PRICING_CONFIG.BASE_PRICE_PER_PAGE;
    } else {
        return calculatedPages * PRICING_CONFIG.BASE_PRICE_PER_PAGE;
    }
};

/**
 * Tính phí in màu
 * @param {string} printMode - Chế độ in màu
 * @param {string} colorPages - Các trang in màu (nếu có)
 * @returns {number} - Phí in màu
 */
const calculateColorFee = (printMode, colorPages = null) => {
    // Chỉ tính phí khi khách hàng thực sự chọn in màu
    if (printMode === 'color') {
        return PRICING_CONFIG.COLOR_FEE;
    } else if (printMode === 'combination' && colorPages) {
        // Nếu in kết hợp, tính phí theo số trang màu
        const colorPageCount = parseColorPages(colorPages);
        return colorPageCount * (PRICING_CONFIG.COLOR_FEE / 2); // Giảm 50% cho in kết hợp
    }
    return 0;
};

/**
 * Parse chuỗi trang màu (ví dụ: "1,3,5-8,10")
 * @param {string} colorPages - Chuỗi mô tả trang màu
 * @returns {number} - Số trang màu
 */
const parseColorPages = (colorPages) => {
    if (!colorPages) return 0;

    let totalPages = 0;
    const ranges = colorPages.split(',');

    for (const range of ranges) {
        const trimmed = range.trim();
        if (trimmed.includes('-')) {
            // Range (ví dụ: 5-8)
            const [start, end] = trimmed.split('-').map(num => parseInt(num.trim()));
            if (start && end && end >= start) {
                totalPages += (end - start + 1);
            }
        } else {
            // Single page (ví dụ: 1, 3, 10)
            const pageNum = parseInt(trimmed);
            if (pageNum) {
                totalPages += 1;
            }
        }
    }

    return totalPages;
};

/**
 * Tính giá cho một file in ấn
 * @param {Object} fileData - Dữ liệu file
 * @returns {Object} - Kết quả tính giá
 */
const calculateFilePrice = (fileData) => {
    const {
        totalPages,
        copies = 1,
        paperSize = 'A4',
        printSides = 'single',
        printMode = 'black-white',
        colorPages = null,
        documentType = 'regular',
        binding = false,
        coverPage = false,
        glassCover = false
    } = fileData;

    // Tính số trang sau khi xử lý in 2 mặt
    const calculatedPages = calculatePrintPages(totalPages, printSides);

    // Tính giá cơ bản
    const basePrice = calculateBasePrice(calculatedPages, printSides);

    // Tính hệ số kích thước giấy
    const paperMultiplier = PRICING_CONFIG.PAPER_SIZE_MULTIPLIERS[paperSize] || 1.00;

    // Tính phí in màu (chỉ khi khách chọn in màu)
    const colorFee = calculateColorFee(printMode, colorPages);

    // Tính phí đóng bìa (chỉ khi khách chọn đóng bìa)
    const bindingFee = binding ? PRICING_CONFIG.BINDING_FEE : 0;

    // Tính phí trang bìa (chỉ khi khách chọn trang bìa)
    const coverPageFee = coverPage ? PRICING_CONFIG.COVER_PAGE_FEE : 0;

    // Tính phí bìa kiếng (chỉ khi khách chọn bìa kiếng)
    const glassCoverFee = glassCover ? PRICING_CONFIG.GLASS_COVER_FEE : 0;

    // Tính tổng giá cho 1 bản
    const pricePerCopy = (basePrice * paperMultiplier) + colorFee + bindingFee + coverPageFee + glassCoverFee;

    // Tính tổng giá cho tất cả bản
    const totalPrice = pricePerCopy * copies;

    return {
        totalPages,
        calculatedPages,
        copies,
        basePrice: Math.round(basePrice),
        paperMultiplier,
        colorFee: Math.round(colorFee),
        bindingFee: Math.round(bindingFee),
        coverPageFee: Math.round(coverPageFee),
        glassCoverFee: Math.round(glassCoverFee),
        pricePerCopy: Math.round(pricePerCopy),
        totalPrice: Math.round(totalPrice),
        breakdown: {
            basePrice: Math.round(basePrice * paperMultiplier),
            colorFee: Math.round(colorFee),
            bindingFee: Math.round(bindingFee),
            coverPageFee: Math.round(coverPageFee),
            glassCoverFee: Math.round(glassCoverFee),
            totalPerCopy: Math.round(pricePerCopy),
            totalForAllCopies: Math.round(totalPrice)
        }
    };
};

/**
 * Tính tổng giá cho nhiều file
 * @param {Array} filesData - Mảng dữ liệu các file
 * @returns {Object} - Kết quả tính tổng
 */
const calculateOrderTotal = (filesData) => {
    let totalAmount = 0;
    let totalPages = 0;
    const fileCalculations = [];

    for (const fileData of filesData) {
        const calculation = calculateFilePrice(fileData);
        fileCalculations.push({
            ...fileData,
            calculation
        });
        totalAmount += calculation.totalPrice;
        totalPages += calculation.totalPages;
    }

    return {
        totalFiles: filesData.length,
        totalPages,
        totalAmount: Math.round(totalAmount),
        files: fileCalculations
    };
};

/**
 * Lấy cấu hình giá hiện tại
 * @returns {Object} - Cấu hình giá
 */
const getPricingConfig = () => {
    return {
        ...PRICING_CONFIG,
        paperSizes: Object.keys(PRICING_CONFIG.PAPER_SIZE_MULTIPLIERS)
    };
};

module.exports = {
    calculateFilePrice,
    calculateOrderTotal,
    getPricingConfig,
    PRICING_CONFIG
};
