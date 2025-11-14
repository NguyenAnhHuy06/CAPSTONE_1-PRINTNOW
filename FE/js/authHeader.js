// /js/authHeader.js
(() => {
    // --- cache-bust helper (để tránh dính ảnh cũ) ---
    let __AVATAR_TS__ = Date.now();
    // --- cache-bust URL helper ---
    const bust = (url) => {
        if (!url) return url;
        try {
            // KHÔNG cache-bust cho data URI
            if (String(url).startsWith("data:")) return url;
            const u = new URL(url, window.location.origin);
            u.searchParams.set("v", String(__AVATAR_TS__));
            return u.toString(); // trả về URL đầy đủ (an toàn khi dùng CDN/khác origin)
        } catch {
            return url;
        }
    };

    // --- inject CSS chỉ 1 lần ---
    if (!document.getElementById("authHeaderStyles")) {
        const css = `
.auth-area{display:flex;align-items:center;}
.avatar-menu{position:relative;}
.avatar-btn{background:transparent;border:0;cursor:pointer;padding:0;}
.avatar{
  width:36px;height:36px;border-radius:50%;
  display:inline-flex;align-items:center;justify-content:center;
  background:#043873;color:#fff;font-weight:700;font-size:14px;overflow:hidden;
}
.avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:none;}
.avatar .initials{display:inline-flex;align-items:center;justify-content:center;width:100%;height:100%;}

/* Dropdown */
.auth-menu{
  position:absolute;right:0;top:calc(100% + 8px);
  min-width:240px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;
  box-shadow:0 12px 28px rgba(0,0,0,.12);padding:8px;display:none;z-index:9999;
}
.auth-menu.open{display:block;}
.auth-menu [role="menuitem"]{outline:none}

/* Header (thông tin cá nhân) */
.menu-header{
  display:flex;align-items:center;gap:10px;padding:8px 10px 12px 10px;border-radius:10px;background:#f9fafb;
}
.menu-avatar{
  width:36px;height:36px;border-radius:50%;background:#203957;color:#fff;font-weight:700;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.user-name{font-weight:600;color:#111827;font-size:14px;line-height:1.1;}
.user-email{color:#6b7280;font-size:12px;line-height:1.1;margin-top:2px;}
.menu-sep{height:1px;border:0;background:#eef0f2;margin:8px 6px;}

/* Items */
.menu-item{
  width:100%;display:flex;align-items:center;gap:10px;
  background:transparent;border:0;padding:10px 12px;border-radius:8px;cursor:pointer;
  font:inherit;color:#111827;text-decoration:none;
}
.menu-item:hover{background:#f3f4f6;}
.menu-item i{font-size:18px;color:#374151;}
/* Avatar static */
.menu-avatar { width:36px;height:36px;border-radius:50%;background:#203957;color:#fff;
  font-weight:700;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.menu-avatar img{width:100%;height:100%;object-fit:cover;display:none;border-radius:50%;}
.menu-initials{display:flex;align-items:center;justify-content:center;width:100%;height:100%;}

`;

        const tag = document.createElement("style");
        tag.id = "authHeaderStyles";
        tag.textContent = css;
        document.head.appendChild(tag);
    }

    // Hàm để escape HTML (nếu cần)
    const escapeHTML = (s) =>
        String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

    // Hàm kiểm tra URL ảnh an toàn
    const isSafeImageUrl = (u) => {
        try {
            const url = new URL(u, window.location.origin);
            // Chỉ cho http(s) hoặc data:image/* (nếu bạn muốn cho phép data URI)
            return (
                url.protocol === "http:" ||
                url.protocol === "https:" ||
                (url.protocol === "data:" && /^data:image\//i.test(u))
            );
        } catch {
            return false;
        }
    };

    // Cập nhật avatar cho cả HEADER và DROPDOWN
    function setHeaderAvatar(elImg, elInitials, url, name) {
        const hasUrl = !!url;
        // Bảo đảm có <img> ở header
        if (!elImg) {
            const slot = document.querySelector("#authArea .avatar");
            if (slot) {
                elImg = slot.querySelector("img");
                if (!elImg) {
                    elImg = document.createElement("img");
                    elImg.alt = String(name || "User");
                    elImg.loading = "lazy";
                    elImg.decoding = "async";
                    slot.prepend(elImg);
                }
            }
        }
        // Các phần tử ở dropdown
        const menuWrap = document.querySelector("#authArea .menu-avatar");
        const menuImg = menuWrap?.querySelector("img") || null;
        const menuIni = menuWrap?.querySelector(".menu-initials") || null;
        // Tính initials
        const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
        const first = parts[0]?.[0] || "";
        const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] || "") : "";
        const ini = (first + last || "NA").toUpperCase();

        // --- Khi có URL ảnh ---
        if (hasUrl) {
            // Header
            if (elImg) {
                elImg.onerror = () => { elImg.removeAttribute("src"); elImg.style.display = "none"; if (elInitials) { elInitials.style.display = "flex"; elInitials.textContent = ini; } };
                elImg.src = bust(url);
                elImg.style.display = "block";
            }
            if (elInitials) elInitials.style.display = "none";
            // Dropdown
            if (menuImg) {
                menuImg.onerror = () => { menuImg.removeAttribute("src"); menuImg.style.display = "none"; if (menuIni) { menuIni.textContent = ini; menuIni.style.display = "flex"; } };
                menuImg.src = bust(url);
                menuImg.style.display = "block";
            }
            if (menuIni) menuIni.style.display = "none";
            return;
        }

        // --- Khi KHÔNG có URL ảnh (hiển thị initials) ---
        if (elImg) { elImg.removeAttribute("src"); elImg.style.display = "none"; }
        if (elInitials) { elInitials.textContent = ini; elInitials.style.display = "flex"; }
        if (menuImg) { menuImg.removeAttribute("src"); menuImg.style.display = "none"; }
        if (menuIni) { menuIni.textContent = ini; menuIni.style.display = "flex"; }
    }

    // Định nghĩa các đường dẫn chuẩn (pretty URL)
    const PATHS = {
        profile: "/profile",
        history: "/order/history",
        settings: "/settings",
    };

    // Hàm khởi tạo khu vực auth header
    async function initAuthHeader() {
        const container = document.getElementById("authArea");
        if (!container) return;

        const existingLoginHref =
            container.querySelector("a.login-btn")?.getAttribute("href") || "/login";

        try {
            // tránh dính cache khi vừa login/log out
            const res = await fetch("/api/auth/me", {
                credentials: "include",
                cache: "no-store",
            });
            if (!res.ok) return;

            const data = await res.json();
            const user = data.user || data.data || data;
            if (!user || user.success === false) return;

            const rawDisplay = (
                user.fullName ||
                user.name ||
                user.email ||
                "User"
            ).trim();
            const display = escapeHTML(rawDisplay);

            const initials = rawDisplay
                .split(/\s+/)
                .map((s) => s[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

            // chấp nhận một số key khác nhau từ BE
            const rawAvatar =
                user.avatarUrl ||
                user.avatar_url ||
                user.avatar ||
                user.photoUrl ||
                user.photo;
            const avatarUrl =
                rawAvatar && isSafeImageUrl(rawAvatar) ? rawAvatar : null; // giờ BE đã trả absolute ⇒ qua được isSafeImageUrl

            const menuId = "authMenu-" + Math.random().toString(36).slice(2);

            container.innerHTML = `
  <div class="avatar-menu">
    <button type="button" class="avatar-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="${menuId}" aria-label="User menu">
      <span class="avatar" title="${display}">
        <img alt="${display}" />
        <span class="initials">${initials}</span>
      </span>
    </button>

    <div class="auth-menu" id="${menuId}" role="menu" aria-hidden="true" hidden>
      <!-- Header: tên + email -->
      <div class="menu-header">
   <div class="menu-avatar">
     <img alt="${display}" style="display:none"/>
     <span class="menu-initials">${initials}</span>
   </div>
   <div>
          <div class="user-name">${display}</div>
          <div class="user-email">${escapeHTML(user.email || "")}</div>
        </div>
      </div>
      <div class="menu-sep"></div>

      <!-- Items có icon -->
        <!-- sửa lại path đúng thư mục -->
        <!-- Items có icon -->
      <a href="${PATHS.profile
                }" class="menu-item" role="menuitem" tabindex="-1">
        <i class='bx bx-user' aria-hidden="true"></i> <span>Profile</span>
      </a>
      <a href="${PATHS.history
                }" class="menu-item" role="menuitem" tabindex="-1">
        <i class='bx bx-receipt' aria-hidden="true"></i> <span>Order history</span>
      </a>
      <a href="${PATHS.settings
                }" class="menu-item" role="menuitem" tabindex="-1">
        <i class='bx bx-cog' aria-hidden="true"></i> <span>Setting</span>
      </a>
      <button type="button" id="logoutBtn" class="menu-item" role="menuitem" tabindex="-1">
        <i class='bx bx-log-out' aria-hidden="true"></i> <span>Log Out</span>
      </button>
    </div>
  </div>
`;

            // 1) set ngay từ localStorage nếu có (ưu tiên new nhất)
            try {
                const cached = localStorage.getItem("avatarUpdated");
                if (cached) {
                    const { url, ts, fullName } = JSON.parse(cached);
                    if (url) {
                        __AVATAR_TS__ = ts || Date.now();
                        const img = container.querySelector(".avatar img");
                        const ini = container.querySelector(".avatar .initials");
                        setHeaderAvatar(img, ini, url, fullName);
                    }
                }
            } catch { }

            // Lấy cả img + initials để toggle
            const img = container.querySelector(".avatar img");
            const ini = container.querySelector(".avatar .initials");
            if (img) {
                img.loading = "lazy"; // ⬅️ lazy-load
                img.decoding = "async"; // ⬅️ decode async
                img.referrerPolicy = "no-referrer"; // ⬅️ không gửi referrer ra ngoài
                // ban đầu ẩn; setHeaderAvatar sẽ lo hiển thị đúng
            }

            // fallback: nếu header có "avatar-small" (các trang cũ)
            const fallbackSmall = document.querySelector(".avatar-small");
            // ⚠️ Nếu server trả có avatar ⇒ set + ghi vào localStorage để tab khác dùng ngay
            if (avatarUrl) {
                setHeaderAvatar(img, ini, avatarUrl, rawDisplay);
                try {
                    const ts = Date.now();
                    localStorage.setItem(
                        "avatarUpdated",
                        JSON.stringify({
                            url: avatarUrl,
                            ts,
                            fullName: rawDisplay,
                        })
                    );
                } catch { }
            }

            const btn = container.querySelector(".avatar-btn");
            const menu = container.querySelector(".auth-menu");
            const items = [...menu.querySelectorAll('[role="menuitem"]')];

            menu.setAttribute("hidden", ""); // ẩn ban đầu cho SR
            menu.setAttribute("aria-hidden", "true"); // đồng bộ trạng thái

            // Kiểm tra tồn tại của btn, menu và items
            if (!btn || !menu || items.length === 0) return;

            const openMenu = () => {
                if (!menu) return;
                menu.classList.add("open");
                menu.removeAttribute("hidden");
                menu.setAttribute("aria-hidden", "false");
                btn.setAttribute("aria-expanded", "true");
                // Focus item đầu tiên để hỗ trợ keyboard
                items[0]?.focus();
                // Bấm ngoài để đóng
                const onDocClick = (e) => {
                    if (!container.contains(e.target)) closeMenu();
                };
                setTimeout(() => {
                    document.addEventListener("click", onDocClick, { once: true });
                }, 0); // ⬅️ chờ qua tick hiện tại để không bắt sự kiện click đang nổi bọt
            };

            const closeMenu = () => {
                if (!menu) return;
                menu.classList.remove("open");
                menu.setAttribute("hidden", "");
                menu.setAttribute("aria-hidden", "true");
                btn.setAttribute("aria-expanded", "false");
                btn.focus();
            };

            // Mở menu bằng bàn phím từ nút avatar
            btn.addEventListener("keydown", (e) => {
                if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!menu.classList.contains("open")) {
                        openMenu();
                    } else {
                        items[0]?.focus();
                    }
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    if (menu.classList.contains("open")) closeMenu();
                }
            });

            // Hàm mở menu
            menu.addEventListener("keydown", (e) => {
                const i = items.indexOf(document.activeElement);

                // Trap Tab
                if (e.key === "Tab") {
                    const first = items[0];
                    const last = items[items.length - 1];
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                        return;
                    }
                    if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                        return;
                    }
                }

                // Điều hướng bằng phím
                if (e.key === "Escape") {
                    e.preventDefault();
                    closeMenu();
                    return;
                }
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    items[(i + 1) % items.length]?.focus();
                    return;
                }
                if (e.key === "ArrowUp") {
                    e.preventDefault();
                    items[(i - 1 + items.length) % items.length]?.focus();
                    return;
                }
                if (e.key === "Home") {
                    e.preventDefault();
                    items[0]?.focus();
                    return;
                }
                if (e.key === "End") {
                    e.preventDefault();
                    items[items.length - 1]?.focus();
                    return;
                }
            });

            // Đóng menu khi click vào 1 item
            items.forEach((el) => {
                el.addEventListener("click", () => closeMenu()); // ⬅️ thêm block này
            });

            // Mở/đóng menu khi click nút avata
            btn.addEventListener("click", (e) => {
                e.stopPropagation(); // ⬅️ ngăn click hiện tại chạm vào document handler
                if (e.button !== 0) return; // ⬅️ chỉ nhận left-click
                const open = !menu.classList.contains("open");
                open ? openMenu() : closeMenu();
            });

            // Đóng menu khi focus rời khỏi menu + nút
            menu.addEventListener("focusout", (e) => {
                // nếu focus mới KHÔNG còn trong container => đóng
                if (!container.contains(e.relatedTarget)) {
                    closeMenu();
                }
            });

            container
                .querySelector("#logoutBtn")
                .addEventListener("click", async () => {
                    try {
                        await fetch("/api/auth/logout", {
                            method: "POST",
                            credentials: "include",
                        });
                    } catch (_) { }

                    // Dọn cache avatar & reset UI tức thời
                    try {
                        localStorage.removeItem("avatarUpdated");
                        const img = container.querySelector(".avatar img");
                        const ini = container.querySelector(".avatar .initials");
                        const mImg = container.querySelector(".menu-avatar img");
                        const mIni = container.querySelector(".menu-avatar .menu-initials");
                        if (img) {
                            img.removeAttribute("src");
                            img.style.display = "none";
                        }
                        if (ini) {
                            ini.style.display = "flex";
                            ini.textContent = "NA";
                        }
                        if (mImg) {
                            mImg.removeAttribute("src");
                            mImg.style.display = "none";
                        }
                        if (mIni) {
                            mIni.style.display = "flex";
                            mIni.textContent = "NA";
                        }
                    } catch { }

                    window.location.href = existingLoginHref || "./Login.html";
                });
        } catch (err) {
            console.warn("initAuthHeader failed:", err);
        }
    }

    document.addEventListener("DOMContentLoaded", initAuthHeader);

    // --- Lắng nghe tín hiệu avatar đổi (cùng tab & tab khác) ---
    window.addEventListener("avatar-updated", (e) => {
        const { url, ts, fullName } = e.detail || {};
        if (!url) return;
        __AVATAR_TS__ = ts || Date.now();
        const img = document.querySelector("#authArea .avatar img");
        const ini =
            document.querySelector("#authArea .avatar .initials") ||
            document.querySelector(".avatar-small");
        setHeaderAvatar(img, ini, url, fullName);
    });
    window.addEventListener("storage", (e) => {
        if (e.key === "avatarUpdated" && e.newValue) {
            try {
                const { url, ts, fullName } = JSON.parse(e.newValue);
                __AVATAR_TS__ = ts || Date.now();
                const img = document.querySelector("#authArea .avatar img");
                const ini =
                    document.querySelector("#authArea .avatar .initials") ||
                    document.querySelector(".avatar-small");
                setHeaderAvatar(img, ini, url, fullName);
            } catch { }
        }
    });
})();
