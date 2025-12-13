// /FE/js/employee-settings.page.js
(function () {
  // ====== Helpers chung ======
  const API_BASE_URL = window.API_BASE_URL || ""; // fallback same-origin
  const AUTH_TOKEN_KEY = window.AUTH_TOKEN_KEY || "authToken";

  function getToken() {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  async function apiFetch(path, options = {}) {
    const token = getToken();
    const isFormData = options.body instanceof FormData;

    const headers = new Headers(options.headers || {});
    if (!isFormData && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(API_BASE_URL + path, {
      credentials: "include",
      ...options,
      headers,
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      // ignore parse error
    }

    if (!res.ok) {
      const err = new Error(
        data.message || data.error || `Request failed with ${res.status}`
      );
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function showError(msg) {
    alert(msg || "Đã xảy ra lỗi, vui lòng thử lại.");
  }

  function showSuccess(msg) {
    alert(msg || "Thao tác thành công.");
  }

  function redirectToLogin() {
    // tuỳ hệ thống, anh có thể đổi sang /employee/login nếu có
    window.location.href = "/login";
  }

  // ====== DOM refs ======
  const firstNameInput = document.getElementById("firstName");
  const lastNameInput = document.getElementById("lastName");
  const emailInput = document.getElementById("email");
  const phoneInput = document.getElementById("phone");
  const addressInput = document.getElementById("address");
  const cityInput = document.getElementById("city");
  const countrySelect = document.getElementById("country");
  const btnSaveProfile = document.getElementById("btnSaveProfile");

  const avatarPreview = document.getElementById("avatarPreview");
  const avatarInput = document.getElementById("avatarInput");
  const btnChangeAvatar = document.getElementById("btnChangeAvatar");

  const languageSelect = document.getElementById("languageSelect");

  if (!firstNameInput) {
    // HTML không khớp, không chạy tiếp
    return;
  }

  // ====== Load profile ======
  async function loadProfile() {
    try {
      const resp = await apiFetch("/api/profile/me");
      if (!resp.success || !resp.user) {
        throw new Error("Không lấy được thông tin tài khoản");
      }
      const u = resp.user;

      // fullName -> firstName + lastName (tách đơn giản: last = từ cuối)
      const fullName = (u.fullName || "").trim();
      const parts = fullName.split(/\s+/).filter(Boolean);
      let firstName = "";
      let lastName = "";
      if (parts.length > 1) {
        lastName = parts[parts.length - 1];
        firstName = parts.slice(0, -1).join(" ");
      } else {
        firstName = fullName;
        lastName = "";
      }

      firstNameInput.value = firstName;
      lastNameInput.value = lastName;
      emailInput.value = u.email || "";
      phoneInput.value = u.phone || "";
      addressInput.value = u.address || "";

      // city/country hiện chưa có trên backend → dùng tạm giá trị mặc định
      // anh có thể map từ address nếu muốn
      cityInput.value = cityInput.value || "Da Nang";
      if (countrySelect && !countrySelect.value) {
        countrySelect.value = "Vietnam";
      }

      // avatar
      if (u.avatarUrl) {
        setAvatarPreview(API_BASE_URL + u.avatarUrl);
      }
    } catch (err) {
      console.error("loadProfile error", err);
      if (err.status === 401) {
        redirectToLogin();
      } else {
        showError("Không thể tải thông tin tài khoản.");
      }
    }
  }

  function setAvatarPreview(url) {
    if (!avatarPreview) return;
    avatarPreview.style.backgroundImage = `url("${url}")`;
    avatarPreview.style.backgroundSize = "cover";
    avatarPreview.style.backgroundPosition = "center";
    avatarPreview.style.backgroundRepeat = "no-repeat";
  }

  // ====== Save profile ======
  function buildFullName(first, last) {
    const f = (first || "").trim();
    const l = (last || "").trim();
    return l ? `${f} ${l}`.trim() : f;
  }

  function validateProfile() {
    const fullName = buildFullName(firstNameInput.value, lastNameInput.value);
    const email = (emailInput.value || "").trim();
    const phone = (phoneInput.value || "").trim();

    if (!fullName) {
      showError("Vui lòng nhập tên đầy đủ.");
      return false;
    }

    if (email) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email)) {
        showError("Email không hợp lệ.");
        return false;
      }
    }

    if (phone) {
      const phoneRe = /^[0-9]{9,11}$/; // linh hoạt chút
      if (!phoneRe.test(phone)) {
        showError("Số điện thoại phải có 9-11 chữ số (không gồm +84).");
        return false;
      }
    }

    return true;
  }

  async function saveProfile() {
    if (!validateProfile()) return;

    const btn = btnSaveProfile;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
      const body = {
        fullName: buildFullName(firstNameInput.value, lastNameInput.value),
        email: (emailInput.value || "").trim(),
        phone: (phoneInput.value || "").trim(),
        address: (addressInput.value || "").trim(),
        // city & country hiện chưa có field trên backend → không gửi
      };

      const resp = await apiFetch("/api/profile/me", {
        method: "PUT",
        body: JSON.stringify(body),
      });

      if (!resp.success) {
        throw new Error(resp.message || "Cập nhật thất bại");
      }

      showSuccess("Cập nhật tài khoản thành công.");
    } catch (err) {
      console.error("saveProfile error", err);
      if (err.status === 401) {
        redirectToLogin();
      } else if (err.data && err.data.errors) {
        const msg =
          err.data.errors.map((e) => e.msg || e.param).join("\n") ||
          "Cập nhật thất bại.";
        showError(msg);
      } else if (err.data && err.data.message === "EMAIL_ALREADY_EXISTS") {
        showError("Email này đã được sử dụng bởi tài khoản khác.");
      } else {
        showError(err.message);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // ====== Avatar upload ======
  function bindAvatarEvents() {
    if (!btnChangeAvatar || !avatarInput) return;

    btnChangeAvatar.addEventListener("click", () => {
      avatarInput.click();
    });

    avatarInput.addEventListener("change", () => {
      const file = avatarInput.files && avatarInput.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        showError("Vui lòng chọn file hình ảnh.");
        avatarInput.value = "";
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showError("Dung lượng ảnh tối đa 5MB.");
        avatarInput.value = "";
        return;
      }

      // Preview nhanh
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target.result);
      };
      reader.readAsDataURL(file);

      uploadAvatar(file);
    });
  }

  async function uploadAvatar(file) {
    const form = new FormData();
    form.append("avatar", file);

    try {
      const resp = await apiFetch("/api/profile/avatar", {
        method: "PUT",
        body: form,
      });

      if (!resp.success) {
        throw new Error(resp.message || "Upload avatar thất bại");
      }

      const avatarUrl = resp.avatarUrl
        ? API_BASE_URL + resp.avatarUrl
        : null;

      if (avatarUrl) {
        setAvatarPreview(avatarUrl);
      }

      // Nếu anh có header dùng avatar chung, có thể sync qua localStorage/event
      try {
        localStorage.setItem("avatarUpdatedAt", Date.now().toString());
        window.dispatchEvent(new CustomEvent("avatar-updated", {
          detail: { avatarUrl },
        }));
      } catch {
        // ignore
      }

      showSuccess("Cập nhật ảnh đại diện thành công.");
    } catch (err) {
      console.error("uploadAvatar error", err);
      if (err.status === 401) {
        redirectToLogin();
      } else {
        showError("Không thể upload avatar.");
      }
    }
  }

  // ====== Settings (language) ======
  async function loadSettings() {
    if (!languageSelect) return;
    try {
      const resp = await apiFetch("/api/settings/me");
      if (!resp.success || !resp.setting) return;

      const language = resp.setting.language || "en";
      if (languageSelect.querySelector(`option[value="${language}"]`)) {
        languageSelect.value = language;
      }

      // Sync với i18n global nếu có
      if (window.i18n && typeof window.i18n.setLang === "function") {
        window.i18n.setLang(language);
      }
    } catch (err) {
      console.error("loadSettings error", err);
      if (err.status === 401) {
        redirectToLogin();
      } else {
        // im lặng vì language không critical
      }
    }
  }

  async function updateLanguage(lang) {
    try {
      const resp = await apiFetch("/api/settings/me", {
        method: "PUT",
        body: JSON.stringify({ language: lang }),
      });

      if (!resp.success) {
        throw new Error(resp.message || "Cập nhật ngôn ngữ thất bại");
      }

      if (window.i18n && typeof window.i18n.setLang === "function") {
        window.i18n.setLang(lang);
      }

      showSuccess("Ngôn ngữ đã được cập nhật.");
    } catch (err) {
      console.error("updateLanguage error", err);
      if (err.status === 401) {
        redirectToLogin();
      } else {
        showError("Không thể cập nhật ngôn ngữ.");
      }
    }
  }

  function bindLanguageEvents() {
    if (!languageSelect) return;
    languageSelect.addEventListener("change", () => {
      const lang = languageSelect.value || "en";
      updateLanguage(lang);
    });
  }

  // ====== Init ======
  document.addEventListener("DOMContentLoaded", () => {
    bindAvatarEvents();
    bindLanguageEvents();

    if (btnSaveProfile) {
      btnSaveProfile.addEventListener("click", (e) => {
        e.preventDefault();
        saveProfile();
      });
    }

    loadProfile();
    loadSettings();
  });
})();