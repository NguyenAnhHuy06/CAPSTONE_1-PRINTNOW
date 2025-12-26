const fs = require('fs');
const path = require('path');
const pdf = require('pdf-poppler');
const mammoth = require('mammoth');

/**
 * Đếm số trang trong file PDF
 * @param {string} filePath - Đường dẫn file PDF
 * @returns {Promise<number>} - Số trang
 */
const countPDFPages = async (filePath) => {
    try {
        const options = {
            format: 'png',
            out_dir: path.dirname(filePath),
            out_prefix: 'temp_pdf_page',
            page: null, // Đếm tất cả trang
        };

        // Thử dùng poppler path nếu có, nếu không thì để mặc định
        const popplerPath = process.env.POPPLER_PATH || 'C:\\Release-25.07.0-0\\poppler-25.07.0\\Library\\bin';
        if (fs.existsSync(popplerPath)) {
            options.poppler_path = popplerPath;
        }

        // Sử dụng pdf-poppler để đếm trang
        const result = await pdf.convert(filePath, options);

        // Đếm số file ảnh được tạo (mỗi file = 1 trang)
        const dir = path.dirname(filePath);
        const files = fs.readdirSync(dir);
        const pageFiles = files.filter(file => file.startsWith('temp_pdf_page'));

        // Xóa các file tạm
        pageFiles.forEach(file => {
            try {
                fs.unlinkSync(path.join(dir, file));
            } catch (error) {
                console.warn(`Không thể xóa file tạm: ${file}`);
            }
        });

        return pageFiles.length;
    } catch (error) {
        console.error('Lỗi khi đếm trang PDF:', error.message);
        // Không throw error, để hàm gọi xử lý fallback
        throw error;
    }
};

/**
 * Đếm số trang trong file Word (DOCX)
 * @param {string} filePath - Đường dẫn file DOCX
 * @returns {Promise<number>} - Số trang
 */
const countWordPages = async (filePath) => {
    try {
        const result = await mammoth.convertToHtml({ path: filePath });

        // Đếm số lần xuất hiện của page-break hoặc ước tính dựa trên nội dung
        const html = result.value;

        // Đếm page-break
        const pageBreaks = (html.match(/<div[^>]*style="[^"]*page-break[^"]*"/gi) || []).length;

        // Ước tính dựa trên độ dài nội dung
        const textLength = html.replace(/<[^>]*>/g, '').length;
        const estimatedPages = Math.max(1, Math.ceil(textLength / 2000)); // ~2000 ký tự/trang

        return Math.max(pageBreaks + 1, estimatedPages);
    } catch (error) {
        console.error('Lỗi khi đếm trang Word:', error);
        throw new Error('Không thể đếm số trang Word');
    }
};

/**
 * Đếm số trang trong file PowerPoint (PPTX)
 * @param {string} filePath - Đường dẫn file PPTX
 * @returns {Promise<number>} - Số trang
 */
const countPowerPointPages = async (filePath) => {
    try {
        // Sử dụng thư viện officegen để đọc PPTX
        const officegen = require('officegen');

        // Đọc file PPTX và đếm slide
        const pptx = officegen('pptx');
        const slides = [];

        // Đây là cách đơn giản - trong thực tế cần thư viện chuyên dụng hơn
        const stats = fs.statSync(filePath);
        const fileSizeKB = stats.size / 1024;

        // Ước tính số slide dựa trên kích thước file
        const estimatedSlides = Math.max(1, Math.round(fileSizeKB / 100)); // ~100KB/slide

        return Math.min(estimatedSlides, 200); // Giới hạn tối đa 200 slide
    } catch (error) {
        console.error('Lỗi khi đếm slide PowerPoint:', error);
        throw new Error('Không thể đếm số slide PowerPoint');
    }
};

/**
 * Đếm số trang trong file DOC (Word cũ)
 * @param {string} filePath - Đường dẫn file DOC
 * @returns {Promise<number>} - Số trang
 */
const countDocPages = async (filePath) => {
    try {
        // File DOC cũ khó đọc hơn, sử dụng phương pháp ước tính
        const stats = fs.statSync(filePath);
        const fileSizeKB = stats.size / 1024;

        // Ước tính số trang dựa trên kích thước file
        const estimatedPages = Math.max(1, Math.round(fileSizeKB / 30)); // ~30KB/trang cho DOC

        return Math.min(estimatedPages, 200); // Giới hạn tối đa 200 trang
    } catch (error) {
        console.error('Lỗi khi đếm trang DOC:', error);
        throw new Error('Không thể đếm số trang DOC');
    }
};

/**
 * Đếm số trang trong file PPT (PowerPoint cũ)
 * @param {string} filePath - Đường dẫn file PPT
 * @returns {Promise<number>} - Số trang
 */
const countPptPages = async (filePath) => {
    try {
        // File PPT cũ khó đọc hơn, sử dụng phương pháp ước tính
        const stats = fs.statSync(filePath);
        const fileSizeKB = stats.size / 1024;

        // Ước tính số slide dựa trên kích thước file
        const estimatedSlides = Math.max(1, Math.round(fileSizeKB / 80)); // ~80KB/slide cho PPT

        return Math.min(estimatedSlides, 200); // Giới hạn tối đa 200 slide
    } catch (error) {
        console.error('Lỗi khi đếm slide PPT:', error);
        throw new Error('Không thể đếm số slide PPT');
    }
};

/**
 * Đếm số trang trong file dựa trên loại file
 * @param {string} filePath - Đường dẫn file
 * @param {string} fileType - Loại file (pdf, docx, doc, pptx, ppt)
 * @returns {Promise<number>} - Số trang
 */
const countFilePages = async (filePath, fileType) => {
    try {
        // Kiểm tra file tồn tại
        if (!fs.existsSync(filePath)) {
            throw new Error('File không tồn tại');
        }

        let pageCount;

        switch (fileType.toLowerCase()) {
            case 'pdf':
                try {
                    pageCount = await countPDFPages(filePath);
                } catch (pdfError) {
                    console.warn(`Không thể đếm PDF chính xác, sử dụng ước tính:`, pdfError.message);
                    // Fallback: ước tính dựa trên kích thước file
                    const stats = fs.statSync(filePath);
                    const fileSizeKB = stats.size / 1024;
                    pageCount = Math.max(1, Math.round(fileSizeKB / 50)); // ~50KB/trang cho PDF
                }
                break;
            case 'docx':
                try {
                    pageCount = await countWordPages(filePath);
                } catch (wordError) {
                    console.warn(`Không thể đếm DOCX chính xác, sử dụng ước tính:`, wordError.message);
                    const stats = fs.statSync(filePath);
                    const fileSizeKB = stats.size / 1024;
                    pageCount = Math.max(1, Math.round(fileSizeKB / 30)); // ~30KB/trang cho DOCX
                }
                break;
            case 'doc':
                pageCount = await countDocPages(filePath);
                break;
            case 'pptx':
                try {
                    pageCount = await countPowerPointPages(filePath);
                } catch (pptError) {
                    console.warn(`Không thể đếm PPTX chính xác, sử dụng ước tính:`, pptError.message);
                    const stats = fs.statSync(filePath);
                    const fileSizeKB = stats.size / 1024;
                    pageCount = Math.max(1, Math.round(fileSizeKB / 100)); // ~100KB/slide cho PPTX
                }
                break;
            case 'ppt':
                pageCount = await countPptPages(filePath);
                break;
            default:
                // Fallback: ước tính dựa trên kích thước file
                const stats = fs.statSync(filePath);
                const fileSizeKB = stats.size / 1024;
                pageCount = Math.max(1, Math.round(fileSizeKB / 40)); // Ước tính chung
                console.warn(`Loại file ${fileType} không được hỗ trợ đầy đủ, sử dụng ước tính`);
        }

        // Đảm bảo số trang hợp lệ
        if (pageCount < 1) {
            pageCount = 1;
        }

        // Giới hạn tối đa số trang (có thể điều chỉnh theo nhu cầu)
        const MAX_PAGES = 2000;
        if (pageCount > MAX_PAGES) {
            console.warn(`Số trang quá lớn (${pageCount}), giới hạn ở ${MAX_PAGES} trang`);
            pageCount = MAX_PAGES;
        }

        console.log(`File ${path.basename(filePath)} (${fileType}): ${pageCount} trang`);
        return pageCount;

    } catch (error) {
        console.error(`Lỗi khi đếm trang file ${fileType}:`, error);

        // Fallback: ước tính dựa trên kích thước file
        try {
            const stats = fs.statSync(filePath);
            const fileSizeKB = stats.size / 1024;
            const estimatedPages = Math.max(1, Math.round(fileSizeKB / 50));
            console.warn(`Sử dụng ước tính: ${estimatedPages} trang`);
            const MAX_PAGES = 2000;
            return Math.min(estimatedPages, MAX_PAGES);
        } catch (fallbackError) {
            console.error('Lỗi fallback:', fallbackError);
            return 1; // Trả về 1 trang mặc định
        }
    }
};

/**
 * Lấy thông tin chi tiết về file
 * @param {string} filePath - Đường dẫn file
 * @returns {Promise<Object>} - Thông tin file
 */
const getFileInfo = async (filePath) => {
    try {
        const stats = fs.statSync(filePath);
        const fileType = path.extname(filePath).toLowerCase().substring(1);
        const pageCount = await countFilePages(filePath, fileType);

        return {
            fileName: path.basename(filePath),
            fileType: fileType,
            fileSize: stats.size,
            pageCount: pageCount,
            lastModified: stats.mtime
        };
    } catch (error) {
        console.error('Lỗi khi lấy thông tin file:', error);
        throw error;
    }
};

module.exports = {
    countFilePages,
    getFileInfo,
    countPDFPages,
    countWordPages,
    countPowerPointPages,
    countDocPages,
    countPptPages
};
