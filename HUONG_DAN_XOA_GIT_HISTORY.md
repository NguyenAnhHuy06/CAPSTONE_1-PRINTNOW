# HƯỚNG DẪN XÓA FILE NHẠY CẢM KHỎI GIT HISTORY

## ⚠️ CẢNH BÁO QUAN TRỌNG

- **Rewrite Git history** là thao tác nguy hiểm
- **KHÔNG thể undo** sau khi force push lên remote
- **Phải backup** trước khi thực hiện
- **Phải thông báo** cho team nếu làm việc nhóm

---

## 📋 CÁC BƯỚC THỰC HIỆN

### Bước 1: Tạo Backup

```powershell
cd D:\Cap1\CAPSTONE_1-PRINTNOW
git branch backup-before-cleanup
```

### Bước 2: Kiểm tra file nhạy cảm trong history

```powershell
# Kiểm tra file .env
git log --all --pretty=format:"%H %s" --name-only --diff-filter=A | Select-String -Pattern "\.env$"

# Kiểm tra file uploads
git log --all --pretty=format:"%H %s" --name-only | Select-String -Pattern "uploads/.*\.(docx|jpg|pdf)"
```

### Bước 3: Xóa file khỏi Git history

#### **Phương pháp 1: Sử dụng git filter-branch (Khuyến nghị cho Windows)**

```powershell
# Xóa tất cả file .env khỏi history
git filter-branch --force --index-filter `
    "git rm --cached --ignore-unmatch .env FE/.env BE/.env" `
    --prune-empty --tag-name-filter cat -- --all
```

#### **Phương pháp 2: Sử dụng git-filter-repo (Nhanh hơn, cần cài đặt)**

```powershell
# Cài đặt git-filter-repo (nếu chưa có)
pip install git-filter-repo

# Xóa file .env
git filter-repo --path .env --path FE/.env --path BE/.env --invert-paths --force
```

#### **Phương pháp 3: Sử dụng BFG Repo-Cleaner (Nhanh nhất, cần Java)**

```powershell
# Download BFG từ: https://rtyley.github.io/bfg-repo-cleaner/
# Xóa file .env
java -jar bfg.jar --delete-files .env
java -jar bfg.jar --delete-files FE/.env
java -jar bfg.jar --delete-files BE/.env
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

### Bước 4: Dọn dẹp refs và garbage collection

```powershell
# Xóa refs cũ
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin

# Xóa reflog
git reflog expire --expire=now --all

# Garbage collection
git gc --prune=now --aggressive
```

### Bước 5: Xác minh đã xóa

```powershell
# Kiểm tra lại - không còn file .env trong history
git log --all -- .env FE/.env BE/.env

# Nếu không có output = đã xóa thành công
```

### Bước 6: Force push lên remote (NẾU ĐÃ PUSH TRƯỚC ĐÓ)

⚠️ **CHỈ LÀM NẾU BẠN CHẮC CHẮN!**

```powershell
# Force push tất cả branches
git push origin --force --all

# Force push tags (nếu có)
git push origin --force --tags
```

**Lưu ý:** 
- Nếu làm việc nhóm, **PHẢI thông báo** cho tất cả thành viên
- Họ cần **clone lại repo** hoặc **reset hard**:
  ```powershell
  git fetch origin
  git reset --hard origin/main
  ```

---

## 🔄 KHÔI PHỤC NẾU CÓ LỖI

Nếu có lỗi và muốn khôi phục:

```powershell
# Khôi phục từ backup branch
git reset --hard backup-before-cleanup

# Hoặc xóa refs đã tạo và reset
git update-ref -d refs/original/refs/heads/main
git reflog expire --expire=now --all
git gc --prune=now
```

---

## ✅ CHECKLIST SAU KHI XÓA

- [ ] Đã tạo backup branch
- [ ] Đã xóa file khỏi history
- [ ] Đã dọn dẹp refs và gc
- [ ] Đã xác minh không còn file trong history
- [ ] Đã force push (nếu cần)
- [ ] Đã thông báo team (nếu làm việc nhóm)
- [ ] Đã test lại repo hoạt động bình thường

---

## 📝 LƯU Ý

1. **File .env hiện tại** trong working directory vẫn tồn tại, chỉ bị xóa khỏi Git history
2. **File .env.example** vẫn được giữ lại (đã có trong .gitignore exception)
3. Sau khi xóa, **tất cả commit SHA sẽ thay đổi** (vì đã rewrite history)
4. Nếu repo đã public, **phải đổi tất cả secrets** (DB password, JWT secret, email password) vì đã bị lộ trong history cũ

---

## 🆘 HỖ TRỢ

Nếu gặp vấn đề, có thể:
- Khôi phục từ backup branch
- Clone lại repo từ remote (nếu chưa force push)
- Liên hệ team lead để được hỗ trợ

