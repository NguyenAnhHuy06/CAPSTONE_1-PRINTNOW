// FE/js/accountMenu.js
(function () {
  function getToken() {
    try {
      return (
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken") ||
        ""
      );
    } catch {
      return "";
    }
  }

  function buildAuthHeaders() {
    const token = getToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  async function fetchMe() {
    const headers = buildAuthHeaders();
    const res = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
      headers,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) throw new Error("Unauthenticated");
    return data?.user || data;
  }

  async function doLogout() {
    const headers = buildAuthHeaders();

    // Gọi logout backend (ưu tiên POST). Nếu BE bạn dùng GET thì đổi method.
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers,
      });
    } catch (e) {
      console.warn("logout request failed:", e);
    }

    // Clear token local/session
    try {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      localStorage.removeItem("authToken");
      sessionStorage.removeItem("authToken");
      sessionStorage.setItem("justLoggedOutAt", String(Date.now()));
    } catch {}

    // Về login
    window.location.href = "/login";
  }

  function ensureDropdownStyles() {
    if (document.getElementById("accountMenuStyles")) return;
    const style = document.createElement("style");
    style.id = "accountMenuStyles";
    style.textContent = `
      .account-menu {
        position: fixed;
        min-width: 220px;
        background: #fff;
        border: 1px solid rgba(0,0,0,.08);
        box-shadow: 0 10px 30px rgba(0,0,0,.12);
        border-radius: 12px;
        padding: 10px;
        z-index: 99999;
        display: none;
      }
      .account-menu.show { display: block; }
      .account-menu .am-head{
        padding: 10px 10px 8px;
        border-bottom: 1px solid rgba(0,0,0,.06);
        margin-bottom: 6px;
      }
      .account-menu .am-name{ font-weight: 700; font-size: 14px; }
      .account-menu .am-sub{ font-size: 12px; color: #666; margin-top: 2px; }
      .account-menu button{
        width: 100%;
        border: 0;
        background: transparent;
        text-align: left;
        padding: 10px;
        border-radius: 10px;
        cursor: pointer;
        font-size: 14px;
      }
      .account-menu button:hover { background: rgba(0,0,0,.05); }
      .account-menu .danger { color: #e74c3c; font-weight: 600; }
    `;
    document.head.appendChild(style);
  }

  function mountAccountMenu(accountBtn, me) {
    ensureDropdownStyles();

    const menu = document.createElement("div");
    menu.className = "account-menu";
    menu.innerHTML = `
      <div class="am-head">
        <div class="am-name">${me?.fullName || me?.name || "Account"}</div>
        <div class="am-sub">${me?.email || ""} ${me?.role ? `• ${me.role}` : ""}</div>
      </div>
      <button type="button" id="amProfile">Profile (coming soon)</button>
      <button type="button" class="danger" id="amLogout">Logout</button>
    `;
    document.body.appendChild(menu);

    function positionMenu() {
      const r = accountBtn.getBoundingClientRect();
      // đặt menu dưới icon, canh phải
      menu.style.top = `${r.bottom + 10}px`;
      menu.style.left = `${Math.max(10, r.right - 220)}px`;
    }

    function closeMenu() {
      menu.classList.remove("show");
    }

    accountBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      positionMenu();
      menu.classList.toggle("show");
    });

    menu.addEventListener("click", (e) => e.stopPropagation());

    document.addEventListener("click", () => closeMenu());
    window.addEventListener("resize", () => closeMenu());
    window.addEventListener("scroll", () => closeMenu(), true);

    menu.querySelector("#amProfile").addEventListener("click", () => {
      alert("Profile chưa triển khai. Bạn có thể thêm trang Profile sau.");
      closeMenu();
    });

    menu.querySelector("#amLogout").addEventListener("click", async () => {
      await doLogout();
    });
  }

  function bindSidebarLogout() {
    document.querySelectorAll(".nav-item.logout").forEach((el) => {
      el.addEventListener("click", async (e) => {
        e.preventDefault();
        await doLogout();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    // 1) logout ở sidebar (nếu có)
    bindSidebarLogout();

    // 2) account dropdown (nếu có icon)
    const accountBtn = document.querySelector(".top-icons .account, a.account");
    if (!accountBtn) return;

    try {
      const me = await fetchMe();
      mountAccountMenu(accountBtn, me);
    } catch (e) {
      // nếu chưa đăng nhập thì bấm account sẽ về login
      accountBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        window.location.href = "/login";
      });
    }
  });
})();