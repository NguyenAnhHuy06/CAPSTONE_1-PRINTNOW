// public/js/settings.page.js
// IIFE for managing user settings page
(async function () {
  const sel = document.querySelector("#language");
  const btn = document.querySelector("#btnSaveSettings");

  // nếu thiếu phần tử thì không chạy tiếp để tránh lỗi
  if (!sel || !btn) return;

  async function load() {
    try {
      // UX: hiển thị theo localStorage trước khi gọi API
      if (window.i18n) {
        const cached = i18n.getLang();
        sel.value = cached;
        i18n.setLang(cached);
      }

      const r = await fetch("/api/settings/me", { credentials: "include" });
      const data = await r.json();
      if (!data.success) throw new Error("Load settings failed");

      const lang = data.setting?.language || "en";
      if (sel) sel.value = lang;
      // áp i18n ngay theo setting từ server (fallback localStorage nếu server chưa có)
      if (window.i18n) i18n.setLang(lang);
    } catch (e) {
      console.error(e);
      alert(
        window.i18n
          ? i18n.t("alert.load_settings_failed")
          : "Cannot load settings"
      );
    }
  }

  async function save() {
    btn.disabled = true;
    try {
      const payload = { language: sel?.value || "en" };
      const r = await fetch("/api/settings/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok || !data.success)
        throw new Error(data.message || "Update failed");
      // ghi localStorage và áp dụng ngay
      if (window.i18n) i18n.setLang(payload.language);
      alert(window.i18n ? i18n.t("alert.save_ok") : "Saved!");
    } catch (e) {
      console.error(e);
      alert(window.i18n ? i18n.t("alert.save_failed") : "Save failed");
    } finally {
      btn.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", load);
  btn?.addEventListener("click", save);
})();
