// FE/js/i18n.js
(function () {
  const KEY = "lang";
  const DICT = {
    en: {
      "title.setting": "Setting",
      "subtitle.setting": "Manage account and interface preferences",

      "section.password.title": "Change Password",
      "section.password.desc": "Update your password to secure your account",
      "label.current_password": "Current password",
      "label.new_password": "New password",
      "label.confirm_password": "Confirm new password",
      "placeholder.current_password": "Enter current password",
      "placeholder.new_password": "Enter new password (minimum 6 characters)",
      "placeholder.confirm_password": "Re-enter new password",
      "btn.change_password": "Change Password",

      "section.language.title": "Language",
      "section.language.desc": "Select interface display language",
      "label.language": "Language",
      "note.language_applied": "Language changes will be applied immediately.",
      "btn.save_settings": "Save Settings",

      // alerts
      "alert.load_settings_failed": "Cannot load settings",
      "alert.save_ok": "Saved!",
      "alert.save_failed": "Save failed",
      "alert.lang_reload": "Saved! Reloading to apply language...",
      "alert.pw_mismatch": "New passwords do not match!",
      "alert.pw_minlen": "Password must be at least 6 characters.",
      "alert.pw_ok": "Password changed successfully",
      "alert.pw_fail": "Password change failed",
    },
    vi: {
      "title.setting": "Cài đặt",
      "subtitle.setting": "Quản lý tài khoản và tuỳ chọn giao diện",

      "section.password.title": "Đổi mật khẩu",
      "section.password.desc": "Cập nhật mật khẩu để bảo vệ tài khoản",
      "label.current_password": "Mật khẩu hiện tại",
      "label.new_password": "Mật khẩu mới",
      "label.confirm_password": "Xác nhận mật khẩu mới",
      "placeholder.current_password": "Nhập mật khẩu hiện tại",
      "placeholder.new_password": "Nhập mật khẩu mới (ít nhất 6 ký tự)",
      "placeholder.confirm_password": "Nhập lại mật khẩu mới",
      "btn.change_password": "Đổi mật khẩu",

      "section.language.title": "Ngôn ngữ",
      "section.language.desc": "Chọn ngôn ngữ hiển thị giao diện",
      "label.language": "Ngôn ngữ",
      "note.language_applied": "Thay đổi ngôn ngữ sẽ áp dụng ngay.",
      "btn.save_settings": "Lưu cài đặt",

      // alerts
      "alert.load_settings_failed": "Không thể tải cài đặt",
      "alert.save_ok": "Đã lưu!",
      "alert.save_failed": "Lưu thất bại",
      "alert.lang_reload": "Đã lưu! Đang tải lại để áp dụng ngôn ngữ...",
      "alert.pw_mismatch": "Mật khẩu mới không khớp!",
      "alert.pw_minlen": "Mật khẩu tối thiểu 6 ký tự.",
      "alert.pw_ok": "Đổi mật khẩu thành công",
      "alert.pw_fail": "Đổi mật khẩu thất bại",
    },
  };

  function getLang() {
    return localStorage.getItem(KEY) || "en";
  }
  function setLang(lang) {
    const v = ["en", "vi"].includes(lang) ? lang : "en";
    localStorage.setItem(KEY, v);
    document.documentElement.setAttribute("lang", v);
    translateDom();
    // phát tín hiệu cho các tab/JS khác nếu cần
    window.dispatchEvent(new CustomEvent("lang-changed", { detail: { lang: v } }));
  }
  function t(key) {
    const lang = getLang();
    return (DICT[lang] && DICT[lang][key]) || (DICT.en && DICT.en[key]) || key;
  }
  function translateDom(root = document) {
    // text nodes
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    // placeholders
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    // titles (optional)
    root.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
  }

  // expose
  window.i18n = { getLang, setLang, t, translateDom };

  // auto apply on DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.setAttribute("lang", getLang());
    translateDom();
  });
})();