# Script để xóa file nhạy cảm khỏi Git history
# CẢNH BÁO: Script này sẽ rewrite Git history. Chỉ chạy nếu bạn chắc chắn!

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "CLEANUP GIT HISTORY - XÓA FILE NHẠY CẢM" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# Kiểm tra xem có đang ở trong Git repo không
if (-not (Test-Path ".git")) {
    Write-Host "❌ ERROR: Không phải Git repository!" -ForegroundColor Red
    exit 1
}

# Tạo backup branch
Write-Host "📦 Bước 1: Tạo backup branch..." -ForegroundColor Cyan
$backupBranch = "backup-before-cleanup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
git branch $backupBranch
Write-Host "✅ Đã tạo backup branch: $backupBranch" -ForegroundColor Green
Write-Host ""

# Danh sách file cần xóa khỏi history
$filesToRemove = @(
    ".env",
    "FE/.env",
    "BE/.env",
    "**/.env"
)

Write-Host "🔍 Bước 2: Kiểm tra file nhạy cảm trong history..." -ForegroundColor Cyan
foreach ($file in $filesToRemove) {
    $commits = git log --all --pretty=format:"%H" -- "$file" 2>$null
    if ($commits) {
        Write-Host "⚠️  Tìm thấy: $file trong history" -ForegroundColor Yellow
    }
}
Write-Host ""

# Hỏi xác nhận
Write-Host "⚠️  CẢNH BÁO: Script này sẽ:" -ForegroundColor Red
Write-Host "   1. Xóa các file .env khỏi TOÀN BỘ Git history" -ForegroundColor Red
Write-Host "   2. Rewrite tất cả commits" -ForegroundColor Red
Write-Host "   3. Cần force push nếu đã push lên remote" -ForegroundColor Red
Write-Host ""
$confirm = Read-Host "Bạn có chắc chắn muốn tiếp tục? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "❌ Đã hủy." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🧹 Bước 3: Xóa file khỏi Git history..." -ForegroundColor Cyan

# Sử dụng git filter-branch để xóa file
# Lưu ý: git filter-branch đã deprecated, nhưng vẫn hoạt động
# Nếu có git-filter-repo thì nên dùng thay thế

$filterBranchCmd = @"
git filter-branch --force --index-filter `
    "git rm --cached --ignore-unmatch .env FE/.env BE/.env" `
    --prune-empty --tag-name-filter cat -- --all
"@

Write-Host "Đang chạy git filter-branch (có thể mất vài phút)..." -ForegroundColor Yellow
Invoke-Expression $filterBranchCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Đã xóa file khỏi history!" -ForegroundColor Green
} else {
    Write-Host "❌ Có lỗi xảy ra!" -ForegroundColor Red
    Write-Host "Khôi phục từ backup: git reset --hard $backupBranch" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🧹 Bước 4: Dọn dẹp refs..." -ForegroundColor Cyan
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

Write-Host ""
Write-Host "✅ HOÀN TẤT!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Các bước tiếp theo:" -ForegroundColor Cyan
Write-Host "   1. Kiểm tra lại: git log --all -- .env" -ForegroundColor White
Write-Host "   2. Nếu đã push lên remote, cần force push:" -ForegroundColor White
Write-Host "      git push origin --force --all" -ForegroundColor Yellow
Write-Host "      git push origin --force --tags" -ForegroundColor Yellow
Write-Host "   3. Backup branch: $backupBranch" -ForegroundColor White
Write-Host ""

