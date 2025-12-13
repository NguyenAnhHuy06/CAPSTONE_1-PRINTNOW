// public/js/profile.page.js
// IIFE for managing user profile page
(async function () {
  // helper: cache-bust avatar URLs để tránh dính cache
  const bust = (url, ts = Date.now()) => {
    if (!url) return url;
    const u = new URL(url, window.location.origin);
    u.searchParams.set("v", String(ts));
    return u.toString();
  };

  const avatar = document.querySelector("#avatar");
  const btnEdit = document.querySelector("#btnEditProfile");
  const btnEditLabel = document.querySelector("#btnEditLabel");

  // Profile card (heading)
  const profileName = document.querySelector("#profile_name");
  const profileEmail = document.querySelector("#profile_email");

  const fullNameDisplay = document.querySelector("#full_name_display");
  const emailDisplay = document.querySelector("#email_display");
  const phoneDisplay = document.querySelector("#phone_display");
  const addressDisplay = document.querySelector("#address_display");
  const joinedDateSpan = document.querySelector("#joined_date");

  // Activity counters
  const elStatOrders = document.querySelector("#stat_orders");
  const elStatCompleted = document.querySelector("#stat_completed");
  const elStatInProgress = document.querySelector("#stat_inprogress");
  const elStatCancelled = document.querySelector("#stat_cancelled");

  // Edit inputs (inline)
  const fullNameInput = document.querySelector("#full_name_input");
  const emailInput = document.querySelector("#email_input");
  const phoneInput = document.querySelector("#phone_input");
  const addressInput = document.querySelector("#address_input");

  // Avatar modal refs
  const avatarModal = document.querySelector("#avatarModal");
  const avatarPreview = document.querySelector("#avatarPreview");
  const avatarFile = document.querySelector("#avatar_file");
  const avatarClose = document.querySelector("#avatarModalClose");
  const avatarCancel = document.querySelector("#avatarCancel");
  const avatarUpload = document.querySelector("#avatarUpload");

  let editing = false;
  let userCreatedAt = null;

  function updateEditButton() {
    if (!btnEdit || !btnEditLabel) return;

    const key = editing ? "profile.btn_save" : "profile.btn_edit";
    // cập nhật data-i18n để lần translateDom tiếp theo dùng đúng key
    btnEditLabel.setAttribute("data-i18n", key);

    if (window.i18n) {
      btnEditLabel.textContent = i18n.t(key);
    } else {
      btnEditLabel.textContent = editing ? "Save" : "Edit";
    }

    const icon = btnEdit.querySelector("i");
    if (icon) {
      icon.className = editing ? "bx bx-save" : "bx bx-edit-alt";
      icon.setAttribute("aria-hidden", "true");
    }
  }


  function formatJoinedMonthYear(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      const lang = window.i18n ? i18n.getLang() : "en";
      const locale = lang === "vi" ? "vi-VN" : "en-US";
      return d.toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  }

  window.addEventListener("lang-changed", () => {
    updateEditButton();
    if (joinedDateSpan && userCreatedAt) {
      joinedDateSpan.textContent = formatJoinedMonthYear(userCreatedAt);
    }
  });

  async function load() {
    try {
      const r = await fetch("/api/profile/me", { credentials: "include" });
      const data = await r.json();
      if (!data.success) throw new Error("Load profile failed");
      const u = data.user;
      if (avatar && u.avatarUrl) {
        // dùng cache-bust + tối ưu load ảnh
        avatar.loading = "lazy";
        avatar.decoding = "async";
        avatar.onerror = () => {
          // Ảnh lỗi ⇒ giữ layout đẹp, không vỡ hình tròn
          avatar.removeAttribute("src");
          avatar.style.background = "#bfc7d1";
        };
        avatar.src = bust(u.avatarUrl);
      }
      if (profileName) profileName.textContent = u.fullName || "";
      if (profileEmail) profileEmail.textContent = u.email || "";
      if (fullNameDisplay) fullNameDisplay.textContent = u.fullName || "";
      if (emailDisplay) emailDisplay.textContent = u.email || "";
      if (phoneDisplay) phoneDisplay.textContent = u.phone || "";
      if (addressDisplay) addressDisplay.textContent = u.address || "";
      if (fullNameInput) fullNameInput.value = u.fullName || "";
      if (emailInput) emailInput.value = u.email || "";
      if (phoneInput) phoneInput.value = u.phone || "";
      if (addressInput) addressInput.value = u.address || "";
      // Joined: từ createdAt
      userCreatedAt = u.createdAt;
      if (joinedDateSpan) {
        joinedDateSpan.textContent = formatJoinedMonthYear(userCreatedAt);
      }


      // Load activity sau khi có user
      await loadActivity();
    } catch (e) {
      console.error(e);
      alert("Cannot load profile");
    }
  }

  async function loadActivity() {
    try {
      const r = await fetch("/api/profile/activity", {
        credentials: "include",
      });
      const data = await r.json();
      if (!r.ok || !data.success)
        throw new Error(data.message || "Load activity failed");
      const s = data.stats || {};
      if (elStatOrders) elStatOrders.textContent = s.totalOrders ?? "0";
      if (elStatCompleted) elStatCompleted.textContent = s.completed ?? "0";
      if (elStatInProgress) elStatInProgress.textContent = s.inProgress ?? "0";
      if (elStatCancelled) elStatCancelled.textContent = s.cancelled ?? "0";
    } catch (e) {
      console.error(e);
      // Giữ nguyên placeholder nếu lỗi
    }
  }

  function setEditMode(on) {
    editing = on;
    // toggle inputs vs p view
    document.querySelectorAll(".edit-field").forEach((el) => {
      el.style.display = on ? "block" : "none";
    });
    [fullNameDisplay, emailDisplay, phoneDisplay, addressDisplay].forEach((p) => {
      if (p) p.style.display = on ? "none" : "block";
    });

    updateEditButton();
  }

  async function save() {
    if (!editing) return;
    if (!confirm("Bạn có muốn lưu thay đổi?")) return;
    if (btnEdit) btnEdit.disabled = true;
    try {
      const payload = {};
      const fv = (el) => (el?.value ?? "").trim();
      if (fullNameInput) payload.fullName = fv(fullNameInput);
      if (emailInput) payload.email = fv(emailInput);
      if (phoneInput) payload.phone = fv(phoneInput);
      if (addressInput) payload.address = fv(addressInput);
      const r = await fetch("/api/profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok || !data.success)
        throw new Error(data.message || "Update failed");

      // cập nhật lại hiển thị
      const u = data.user;
      if (profileName) profileName.textContent = u.fullName || "";
      if (profileEmail) profileEmail.textContent = u.email || "";
      if (fullNameDisplay) fullNameDisplay.textContent = u.fullName || "";
      if (emailDisplay) emailDisplay.textContent = u.email || "";
      if (phoneDisplay) phoneDisplay.textContent = u.phone || "";
      if (addressDisplay) addressDisplay.textContent = u.address || "";

      alert("Saved!");
      setEditMode(false);
    } catch (e) {
      console.error(e);
      alert("Save failed");
    } finally {
      if (btnEdit) btnEdit.disabled = false;
    }
  }

  // Edit ↔ Save toggle
  btnEdit?.addEventListener("click", () => {
    if (!editing) {
      // vào edit mode
      setEditMode(true);
      // đồng bộ input từ text (phòng khi vừa load)
      if (fullNameInput && fullNameDisplay)
        fullNameInput.value = (fullNameDisplay.textContent || "").trim();
      if (emailInput && emailDisplay)
        emailInput.value = (emailDisplay.textContent || "").trim();
      if (phoneInput && phoneDisplay)
        phoneInput.value = (phoneDisplay.textContent || "").trim();
      if (addressInput && addressDisplay)
        addressInput.value = (addressDisplay.textContent || "").trim();
    } else {
      // lưu
      save();
    }
  });

  // ===== Avatar modal =====
  function openAvatarModal() {
    if (!avatarModal) return;
    if (avatarPreview && avatar && avatar.src) avatarPreview.src = avatar.src;
    avatarModal.style.display = "block";
  }
  function closeAvatarModal() {
    if (!avatarModal) return;
    avatarModal.style.display = "none";
    if (avatarFile) avatarFile.value = "";
  }
  avatar?.addEventListener("click", openAvatarModal);
  avatarClose?.addEventListener("click", closeAvatarModal);
  avatarCancel?.addEventListener("click", closeAvatarModal);
  avatarModal?.addEventListener("click", (e) => {
    if (e.target === avatarModal) closeAvatarModal(); // click nền để đóng
  });
  avatarFile?.addEventListener("change", () => {
    const f = avatarFile.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (avatarPreview) {
        avatarPreview.onerror = () => {
          avatarPreview.removeAttribute("src");
        };
        avatarPreview.src = reader.result;
      }
    };
    reader.readAsDataURL(f);
  });
  avatarUpload?.addEventListener("click", async () => {
    const f = avatarFile?.files?.[0];
    if (!f) return alert("Hãy chọn ảnh trước.");
    try {
      const fd = new FormData();
      fd.append("avatar", f);
      const r2 = await fetch("/api/profile/avatar", {
        method: "PUT",
        credentials: "include",
        body: fd,
      });
      const d2 = await r2.json();
      if (!r2.ok || !d2.success) throw new Error(d2.message || "Upload failed");
      // dùng cùng một ts cho mọi nơi để đồng bộ cache-bust
      const ts = Date.now();
      if (avatar) avatar.src = bust(d2.avatarUrl, ts);
      if (avatarPreview) {
        avatarPreview.onerror = () => {
          avatarPreview.removeAttribute("src");
        };
        avatarPreview.src = bust(d2.avatarUrl, ts);
      }

      // 🔔 Phát tín hiệu để header ở tất cả trang cập nhật ngay (cùng ts)
      const payload = {
        url: d2.avatarUrl,
        ts,
        fullName: profileName?.textContent || ""
      }
      window.dispatchEvent(
        new CustomEvent("avatar-updated", { detail: payload })
      );
      localStorage.setItem("avatarUpdated", JSON.stringify(payload));
      alert("Cập nhật avatar thành công!");
      closeAvatarModal();
    } catch (err) {
      console.error(err);
      alert("Không thể cập nhật avatar");
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    setEditMode(false);
    load();
  });
})();
