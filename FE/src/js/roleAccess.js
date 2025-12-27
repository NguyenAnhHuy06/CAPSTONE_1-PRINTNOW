// FE/js/roleAccess.js
// Role-based redirect + page guard for static HTML pages
(function () {
  function normalizeRole(role) {
    return String(role || "")
      .trim()
      .toLowerCase();
  }

  // Detect if current page is under /html/ folder (common in your project)
  function resolvePath(fileName) {
    const p = window.location.pathname || "";
    if (p.includes("/html/")) return `/html/${fileName}`;
    return fileName; // fallback: relative in same folder
  }

  function roleHome(role) {
    const r = normalizeRole(role);
    if (r === "customer") return "/home"; // your Home_customer is served at /home
    if (r === "staff") return resolvePath("Employee_Dashboard.html");
    if (r === "owner") return resolvePath("Owner_Dashboard.html");
    return "/home";
  }

  function getCurrentRole() {
    try {
      // 1. Ưu tiên lấy từ sessionStorage (đã set khi login hoặc load trang)
      let role = sessionStorage.getItem("currentRole");
      if (role) return role;
      
      // 2. Tự động detect từ URL/pathname
      const path = window.location.pathname.toLowerCase();
      if (path.includes("owner") || path.includes("owner_dashboard") || path.includes("pricemanagement_owner")) {
        return "owner";
      }
      if (path.includes("employee") || path.includes("employee_dashboard") || path.includes("staff")) {
        return "staff";
      }
      if (path.includes("customer") || path.includes("home_customer") || path.includes("printdocument")) {
        return "customer";
      }
      
      // 3. Fallback: thử tìm token theo role
      const roles = ["owner", "staff", "customer"];
      for (const r of roles) {
        if (sessionStorage.getItem(`token_${r}`)) {
          return r;
        }
      }
      
      return null;
    } catch (e) {
      console.warn("Lỗi getCurrentRole:", e);
      return null;
    }
  }

  function getToken() {
    try {
      // ✅ Ưu tiên lấy token theo role hiện tại của tab
      const currentRole = getCurrentRole();
      if (currentRole) {
        const roleToken = sessionStorage.getItem(`token_${currentRole}`);
        if (roleToken) {
          return roleToken;
        }
      }
      
      // Fallback: lấy token chung (tương thích với code cũ)
      return (
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        ""
      );
    } catch {
      return "";
    }
  }

  function clearToken() {
    try { 
      // Xóa token theo role hiện tại
      const currentRole = getCurrentRole();
      if (currentRole) {
        sessionStorage.removeItem(`token_${currentRole}`);
        sessionStorage.removeItem(`user_${currentRole}`);
      }
      // Xóa token chung
      localStorage.removeItem("token"); 
    } catch { }
    try { 
      sessionStorage.removeItem("token"); 
      sessionStorage.removeItem("currentRole");
    } catch { }
  }

  function justLoggedOutRecently(ms = 1500) {
    try {
      const t = Number(sessionStorage.getItem("justLoggedOutAt") || "0");
      return t && (Date.now() - t) < ms;
    } catch {
      return false;
    }
  }

  async function fetchMe() {
    // Try to use authMe() if apiService.js is loaded
    try {
      if (typeof authMe === "function") {
        const me = await authMe();
        return me;
      }
    } catch (_) { }

    // Fallback: fetch directly
    const token = getToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const endpoints = ["/api/auth/me", "/auth/me"];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers,
        });
        if (res.status === 401) {
          // token/cookie không hợp lệ -> clear token để tránh redirect loop
          clearToken();
          continue;
        }
        if (!res.ok) continue;
        const data = await res.json().catch(() => null);
        if (data) return data;
      } catch (_) { }
    }
    return null;
  }

  function extractRole(me) {
    // supports shapes: {success, user:{role}}, {role}, {data:{role}}
    const role =
      me?.user?.role ??
      me?.role ??
      me?.data?.role ??
      me?.data?.user?.role ??
      "";
    return normalizeRole(role);
  }

  function isAuthed(me) {
    // supports: {success:true}, or has user/id
    if (!me) return false;
    if (me?.success === false) return false;
    if (me?.success === true) return true;
    if (me?.user?.id || me?.id || me?.data?.id || me?.data?.user?.id) return true;
    return false;
  }

  async function redirectAfterLogin() {
    const me = await fetchMe();
    if (!isAuthed(me)) {
      // not logged in, stay on login
      return false;
    }
    const role = extractRole(me);
    window.location.replace(roleHome(role));
    return true;
  }

  /**
   * Guard a page by role:
   * - If not logged in => redirect to loginPath
   * - If logged in but role not allowed => redirect to role home (or custom forbiddenPath)
   *
   * opts:
   *  - allowRoles: ["customer"|"staff"|"owner"]
   *  - allowGuests: boolean (default false)
   *  - loginPath: string (default resolvePath("Login.html"))
   *  - forbiddenRedirect: function(role)->path OR string
   *  - silent: boolean (default true) // no alert
   */
  async function guardPage(opts) {
    const cfg = Object.assign(
      {
        allowRoles: [],
        allowGuests: false,
        loginPath: resolvePath("Login.html"),
        forbiddenRedirect: null,
        silent: true,
      },
      opts || {}
    );

    const me = await fetchMe();
    const authed = isAuthed(me);

    if (!authed) {
      if (cfg.allowGuests) return { ok: true, role: "guest" };
      window.location.replace(cfg.loginPath);
      return { ok: false, reason: "unauth" };
    }

    const role = extractRole(me);
    if (!cfg.allowRoles || cfg.allowRoles.length === 0) {
      return { ok: true, role };
    }

    const allowed = cfg.allowRoles.map(normalizeRole).includes(role);
    if (allowed) return { ok: true, role };

    // forbidden: redirect
    let to = null;
    if (typeof cfg.forbiddenRedirect === "function") to = cfg.forbiddenRedirect(role);
    else if (typeof cfg.forbiddenRedirect === "string") to = cfg.forbiddenRedirect;
    else to = roleHome(role);

    if (!cfg.silent) {
      try {
        alert("Bạn không có quyền truy cập trang này.");
      } catch (_) { }
    }
    window.location.replace(to);
    return { ok: false, role, reason: "forbidden" };
  }

  // Auto: nếu user đã đăng nhập mà vẫn mở trang Login thì đá về đúng dashboard
  document.addEventListener("DOMContentLoaded", () => {
    const path = (window.location.pathname || "").toLowerCase();
    const isLogin =
      path.endsWith("/login") ||
      path.includes("login.html") ||
      path.endsWith("/login.html");
    if (isLogin) {
      // vừa logout xong -> đừng auto-redirect khỏi login
      if (justLoggedOutRecently()) return;
      // best-effort, no blocking
      redirectAfterLogin().catch(() => { });
    }
  });

  window.RoleAccess = {
    normalizeRole,
    resolvePath,
    roleHome,
    fetchMe,
    extractRole,
    guardPage,
    redirectAfterLogin,
  };
})();
