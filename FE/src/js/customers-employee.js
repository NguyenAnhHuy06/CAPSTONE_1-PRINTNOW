// /js/customers-employee.js

// i18n safe helper
function t(key) {
  try {
    if (window.i18n && typeof i18n.t === "function") return i18n.t(key);
  } catch (_) { }
  return key;
}

// ==== Helper: validate text search cho Customer ====
function isEmailLike(str) {
  if (!str) return false;
  const s = String(str).trim();
  return s.includes("@") && !s.includes(" ");
}

function isValidEmail(str) {
  if (!str) return false;
  const s = String(str).trim();
  // regex email đơn giản, đủ dùng cho validate nhẹ
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(s);
}

document.addEventListener("DOMContentLoaded", () => {
  // --- KHAI BÁO BIẾN CHUNG ---
  // Logout sidebar
  const sidebarLogout = document.getElementById("sidebarLogout");
  if (sidebarLogout) {
    sidebarLogout.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      } catch (_) { }
      try {
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
        localStorage.removeItem("authToken");
        sessionStorage.removeItem("authToken");
        sessionStorage.setItem("justLoggedOutAt", String(Date.now()));
      } catch (_) { }
      try {
        if (window.Realtime && typeof window.Realtime.disconnect === "function") {
          window.Realtime.disconnect();
        }
      } catch (_) { }
      // về Login
      try {
        window.location.href = "Login.html";
      } catch (_) {
        window.location.href = "./Login.html";
      }
    });
  }

  const generalFilterBtn = document.getElementById("generalFilterBtn");
  const generalFilterDropdown = document.getElementById(
    "generalFilterDropdown"
  );
  const dateFilterBtn = document.getElementById("dateFilterBtn");
  const dateFilterDropdown = document.getElementById("dateFilterDropdown");
  const dateRangeDetails = document.getElementById("dateRangeDetails");
  const dateRangeRadios = document.querySelectorAll(
    'input[name="date_range"]'
  );
  const statsPeriodTop = document.getElementById("statsPeriodTop");
  const statsPeriodBottom = document.getElementById("statsPeriodBottom");

  // Khai báo các biến DOM cho Lịch
  const calendarGrid = document.querySelector(
    "#dateRangeDetails .calendar-grid"
  );
  const fromDateBtn = document.querySelector("#dateRangeDetails .from-date");
  const toDateBtn = document.querySelector("#dateRangeDetails .to-date");

  // Biến điều hướng Lịch
  const prevMonthBtn = document.getElementById("prevMonthBtn");
  const nextMonthBtn = document.getElementById("nextMonthBtn");
  const monthSelect = document.getElementById("monthSelect");
  const yearSelect = document.getElementById("yearSelect");

  // Biến trạng thái Lịch
  let isSelectingFrom = true;
  let dateRange = {
    fromElement: null,
    toElement: null,
  };

  // TRẠNG THÁI LỊCH HIỆN TẠI
  const today = new Date();
  let currentMonth = today.getMonth();
  let currentYear = today.getFullYear();
  const currentMaxYear = today.getFullYear(); // Ràng buộc: Năm lớn nhất được chọn

  // --- LOGIC HỖ TRỢ LỊCH ĐỘNG ---

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  function setupMonthSelect() {
    monthSelect.innerHTML = "";
    monthNames.forEach((name, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = name;
      monthSelect.appendChild(option);
    });
    // Thiết lập sự kiện thay đổi
    monthSelect.addEventListener("change", (e) => {
      currentMonth = parseInt(e.target.value);
      renderCalendar(currentMonth, currentYear);
    });
  }

  function setupYearSelect() {
    yearSelect.innerHTML = "";
    const startYear = currentMaxYear - 10;
    const endYear = currentMaxYear;

    for (let year = endYear; year >= startYear; year--) {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    }

    if (currentYear > currentMaxYear) {
      currentYear = currentMaxYear; // Tự động về năm hiện tại nếu nó đã vượt quá
    }
    yearSelect.value = currentYear;
    yearSelect.addEventListener("change", (e) => {
      currentYear = parseInt(e.target.value);
      renderCalendar(currentMonth, currentYear);
    });
  }

  // Hàm Tạo Lưới Lịch
  function renderCalendar(month, year) {
    // Ràng buộc tháng/năm khi chuyển mũi tên (Nếu đang ở năm hiện tại thì không được chuyển sang tháng sau tháng hiện tại)
    if (year === currentMaxYear && month > today.getMonth()) {
      month = today.getMonth();
      currentMonth = month;
    }

    monthSelect.value = month;
    yearSelect.value = year;

    // Cập nhật trạng thái nút Prev/Next (Tùy chọn: Vô hiệu hóa nút Next nếu đang ở tháng/năm hiện tại)
    if (year === currentMaxYear && month === today.getMonth()) {
      nextMonthBtn.disabled = true;
    } else {
      nextMonthBtn.disabled = false;
    }

    while (calendarGrid.children.length > 7) {
      calendarGrid.removeChild(calendarGrid.lastChild);
    }

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    let startingDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < startingDayIndex; i++) {
      const emptyDay = document.createElement("span");
      emptyDay.classList.add("day", "empty-day");
      calendarGrid.appendChild(emptyDay);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dayEl = document.createElement("span");
      dayEl.classList.add("day");
      dayEl.textContent = i;

      dayEl.dataset.date = `${year}-${String(month + 1).padStart(
        2,
        "0"
      )}-${String(i).padStart(2, "0")}`;

      calendarGrid.appendChild(dayEl);
    }

    highlightSelectedRange();
  }

  // Xử lý chuyển tháng (khi nhấn mũi tên)
  function changeMonth(delta) {
    let newMonth = currentMonth + delta;
    let newYear = currentYear;

    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }

    // Ràng buộc: Không được chuyển tới năm/tháng trong tương lai
    if (
      newYear > currentMaxYear ||
      (newYear === currentMaxYear && newMonth > today.getMonth())
    ) {
      return; // Dừng lại, không cho phép chuyển
    }

    currentMonth = newMonth;
    currentYear = newYear;

    renderCalendar(currentMonth, currentYear);
  }

  // Lắng nghe sự kiện chuyển tháng
  if (prevMonthBtn && nextMonthBtn) {
    prevMonthBtn.addEventListener("click", () => changeMonth(-1));
    nextMonthBtn.addEventListener("click", () => changeMonth(1));
  }

  // --- LOGIC LỊCH (Ràng buộc và Highlight) ---

  function updateDateButtons() {
    if (fromDateBtn) {
      fromDateBtn.textContent = t("customers.date_from_btn");
      fromDateBtn.classList.toggle("selected", isSelectingFrom);
    }
    if (toDateBtn) {
      toDateBtn.textContent = t("customers.date_to_btn");
      toDateBtn.classList.toggle("selected", !isSelectingFrom);
    }
  }

  function highlightSelectedRange() {
    document
      .querySelectorAll(".day")
      .forEach((d) =>
        d.classList.remove(
          "start-range",
          "end-range",
          "in-range",
          "selected-range"
        )
      );

    const fromEl = dateRange.fromElement;
    const toEl = dateRange.toElement;

    if (fromEl) {
      fromEl.classList.add("selected-range", "start-range");
    }
    if (toEl) {
      toEl.classList.add("selected-range", "end-range");
    }

    if (fromEl && toEl) {
      const startDate = new Date(fromEl.dataset.date);
      const endDate = new Date(toEl.dataset.date);

      const minDate = startDate <= endDate ? startDate : endDate;
      const maxDate = startDate <= endDate ? endDate : startDate;

      document.querySelectorAll(".day").forEach((dayEl) => {
        const dayDateStr = dayEl.dataset.date;
        if (dayDateStr) {
          const dayDate = new Date(dayDateStr);
          const dayTime = dayDate.getTime();

          if (
            dayTime > minDate.getTime() &&
            dayTime < maxDate.getTime() &&
            dayDate.getMonth() === currentMonth &&
            dayDate.getFullYear() === currentYear
          ) {
            dayEl.classList.add("in-range");
          }
        }
      });
    }
  }

  if (calendarGrid) {
    calendarGrid.addEventListener("click", function (e) {
      const clickedDay = e.target;

      if (
        clickedDay.classList.contains("day") &&
        !clickedDay.classList.contains("empty-day")
      ) {
        const clickedDateStr = clickedDay.dataset.date;
        const clickedDate = new Date(clickedDateStr);

        // Ràng buộc: Không cho phép chọn ngày trong tương lai
        if (clickedDate.getTime() > today.getTime()) {
          alert("Không được chọn ngày trong tương lai!");
          return;
        }

        // --- LOGIC RÀNG BUỘC MẠNH (Sử dụng Date Objects) ---

        // Nếu đang chọn 1 ngày (from == to == clicked) và nhấn lại đúng ngày đó -> hủy chọn (clear filter)
        const fromElCurrent = dateRange.fromElement;
        const toElCurrent = dateRange.toElement;
        if (
          fromElCurrent &&
          toElCurrent &&
          fromElCurrent.dataset?.date === clickedDateStr &&
          toElCurrent.dataset?.date === clickedDateStr
        ) {
          dateRange.fromElement = null;
          dateRange.toElement = null;
          isSelectingFrom = true;
          updateDateButtons();
          highlightSelectedRange();
          return;
        }

        if (isSelectingFrom) {
          dateRange.fromElement = clickedDay;

          if (dateRange.toElement) {
            const endDate = new Date(dateRange.toElement.dataset.date);
            if (clickedDate.getTime() > endDate.getTime()) {
              dateRange.toElement = null;
            }
          }
          isSelectingFrom = false;
        } else {
          if (dateRange.fromElement) {
            const startDate = new Date(dateRange.fromElement.dataset.date);

            if (clickedDate.getTime() < startDate.getTime()) {
              const tempFromEl = dateRange.fromElement;
              dateRange.fromElement = clickedDay;
              dateRange.toElement = tempFromEl;
            } else {
              dateRange.toElement = clickedDay;
            }
          } else {
            dateRange.fromElement = clickedDay;
            dateRange.toElement = null;
          }
          isSelectingFrom = true;
        }

        updateDateButtons();
        highlightSelectedRange();
      }
    });
  }

  if (fromDateBtn && toDateBtn) {
    fromDateBtn.addEventListener("click", () => {
      isSelectingFrom = true;
      updateDateButtons();
    });

    toDateBtn.addEventListener("click", () => {
      isSelectingFrom = false;
      updateDateButtons();
    });
  }

  function closeAllDropdowns() {
    generalFilterDropdown.classList.remove("show");
    dateFilterDropdown.classList.remove("show");
  }

  generalFilterBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (!generalFilterDropdown.classList.contains("show")) {
      dateFilterDropdown.classList.remove("show");
    }
    generalFilterDropdown.classList.toggle("show");
  });

  dateFilterBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (!dateFilterDropdown.classList.contains("show")) {
      generalFilterDropdown.classList.remove("show");
    }
    dateFilterDropdown.classList.toggle("show");
  });

  document.addEventListener("click", function (e) {
    const isClickInsideGeneral =
      generalFilterDropdown.contains(e.target) ||
      generalFilterBtn.contains(e.target);
    const isClickInsideDate =
      dateFilterDropdown.contains(e.target) || dateFilterBtn.contains(e.target);

    if (
      !isClickInsideGeneral &&
      generalFilterDropdown.classList.contains("show")
    ) {
      generalFilterDropdown.classList.remove("show");
    }

    if (
      !isClickInsideDate &&
      dateFilterDropdown.classList.contains("show")
    ) {
      dateFilterDropdown.classList.remove("show");
    }
  });

  generalFilterDropdown.addEventListener("click", function (e) {
    e.stopPropagation();
  });
  dateFilterDropdown.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  // Logic Ẩn/Hiện Chi tiết Date Range (ĐÃ SỬA: SỬ DỤNG CLASS HIDDEN)
  function toggleDateRangeDetails() {
    // Hiện tại không dùng radio "Custom range" -> luôn hiển thị lịch
    dateRangeDetails.style.display = "flex";
  }

  dateRangeRadios.forEach((radio) => {
    radio.addEventListener("change", toggleDateRangeDetails);
  });
  const tableBody = document.getElementById("ordersTableBody");
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  const bulkStatusSelect = document.getElementById("bulkStatusSelect");
  const shareBtn = document.getElementById("shareBtn");

  // Period cho 2 card summary (This Week / This Month / This Year)
  let statsPeriod = "this_week";

  // Đồng bộ 2 dropdown period
  function syncStatsPeriodDropdowns(newValue) {
    statsPeriod = newValue || "this_week";
    if (statsPeriodTop) statsPeriodTop.value = statsPeriod;
    if (statsPeriodBottom) statsPeriodBottom.value = statsPeriod;
  }

  // Khởi tạo statsPeriod từ dropdown (nếu có)
  if (statsPeriodTop && statsPeriodTop.value) {
    statsPeriod = statsPeriodTop.value;
  } else if (statsPeriodBottom && statsPeriodBottom.value) {
    statsPeriod = statsPeriodBottom.value;
  }

  // Đảm bảo 2 dropdown hiển thị cùng 1 period ban đầu
  syncStatsPeriodDropdowns(statsPeriod);

  if (statsPeriodTop) {
    statsPeriodTop.addEventListener("change", (e) => {
      const val = e.target.value || "this_week";
      if (statsPeriodBottom && statsPeriodBottom.value !== val) {
        statsPeriodBottom.value = val;
      }
      statsPeriod = val;
      loadStats(statsPeriod, { filters });
    });
  }

  if (statsPeriodBottom) {
    statsPeriodBottom.addEventListener("change", (e) => {
      const val = e.target.value || "this_week";
      if (statsPeriodTop && statsPeriodTop.value !== val) {
        statsPeriodTop.value = val;
      }
      statsPeriod = val;
      loadStats(statsPeriod, { filters });
    });
  }
  // --- KHỞI TẠO ---
  setupMonthSelect();
  setupYearSelect();
  renderCalendar(currentMonth, currentYear);
  updateDateButtons();

  // KHẮC PHỤC LỖI HIỂN THỊ: Đảm bảo ẩn lịch theo trạng thái radio button ban đầu
  toggleDateRangeDetails();

  // ======================
  // GỌI API KHÁCH HÀNG (dùng api() trong apiService.js)
  // ======================

  // Trạng thái filter
  const filters = {
    page: 1,
    limit: 10,
    search: "",
    status: "",
    fromDate: "",
    toDate: "",
    minAmount: "",
    maxAmount: "",
  };

  // ==== Helper: checkbox chọn nhiều khách hàng ====
  function getSelectedCustomerIds() {
    const checked = document.querySelectorAll(".row-checkbox:checked");
    return Array.from(checked).map((cb) => cb.dataset.id);
  }

  // ==== SHARE: export CSV danh sách đang hiển thị ====
  function exportCurrentTableToCSV() {
    const bodyRows = document.querySelectorAll(".orders-table tbody tr");
    if (!bodyRows.length) {
      alert("Không có dữ liệu để xuất.");
      return;
    }

    const headerCells = document.querySelectorAll(".orders-table thead th");
    const headers = Array.from(headerCells)
      .slice(1) // bỏ cột checkbox
      .map((th) => th.textContent.trim());
    const rows = [headers];

    const orderTotalIndex = headers.findIndex(
      (h) => h.toLowerCase() === "order total"
    );

    bodyRows.forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      if (!cells.length) return;
      const row = [];

      for (let i = 1; i < cells.length; i++) {
        let cellValue = cells[i].innerText.trim();

        if (orderTotalIndex !== -1 && i - 1 === orderTotalIndex) {
          // Lấy số thô từ data-raw (vd: 45100)
          const raw = cells[i].getAttribute("data-raw");
          const num =
            raw != null && raw !== "" && !isNaN(raw) ? Number(raw) : 0;

          // Format sang dạng có dấu chấm theo kiểu VN: 45.100
          const formatted = num.toLocaleString("vi-VN");

          // Thêm dấu ' để Excel hiểu đây là TEXT và giữ nguyên "45.100"
          //cellValue = "'" + formatted;
        }

        row.push(cellValue);
      }

      rows.push(row);
    });

    if (rows.length <= 1) {
      alert("Không có dữ liệu để xuất.");
      return;
    }

    const csvBody = rows
      .map((r) =>
        r
          .map((val) => `"${String(val || "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const csvWithBom = "\uFEFF" + csvBody;
    const blob = new Blob([csvWithBom], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    a.href = url;
    a.download = `customers_${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (shareBtn) {
    shareBtn.addEventListener("click", exportCurrentTableToCSV);
  }

  // ==== BULK STATUS: cập nhật Active / In-Active cho các khách hàng đã chọn ====
  if (bulkStatusSelect) {
    bulkStatusSelect.addEventListener("change", async (e) => {
      const selectedVal = e.target.value;
      if (selectedVal !== "active" && selectedVal !== "inactive") {
        return;
      }
      const ids = getSelectedCustomerIds();
      if (!ids.length) {
        alert("Vui lòng chọn ít nhất một khách hàng trước.");
        e.target.value = "all";
        return;
      }
      const status = selectedVal;
      try {
        const res = await api("/customers/bulk-status", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ids,
            status,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Cập nhật trạng thái thất bại.");
        }
        alert("Cập nhật trạng thái thành công!");
        e.target.value = "all";
        loadCustomers();
        loadStats(statsPeriod, { filters });
      } catch (err) {
        console.error("Bulk status error:", err);
        alert(err.message || "Lỗi khi cập nhật trạng thái.");
        e.target.value = "all";
      }
    });
  }

  // Đồng bộ checkbox "Select all"
  if (selectAllCheckbox && tableBody) {
    selectAllCheckbox.addEventListener("change", () => {
      const rowCheckboxes = document.querySelectorAll(".row-checkbox");
      rowCheckboxes.forEach((cb) => {
        cb.checked = selectAllCheckbox.checked;
      });
    });

    // Khi tick từng dòng thì cập nhật lại trạng thái của selectAll
    tableBody.addEventListener("change", (e) => {
      if (!e.target.classList.contains("row-checkbox")) return;
      const all = document.querySelectorAll(".row-checkbox");
      const checked = document.querySelectorAll(".row-checkbox:checked");
      if (!all.length) {
        selectAllCheckbox.checked = false;
      } else {
        selectAllCheckbox.checked = all.length === checked.length;
      }
    });
  }

  function formatCurrency(amount) {
    if (!amount) return "0₫";
    try {
      return Number(amount).toLocaleString("vi-VN") + "₫";
    } catch (_) {
      return amount + "₫";
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleString("vi-VN", {
      hour12: false,
    });
  }

  // Hiệu ứng nhỏ khi card summary được cập nhật (smooth UI giống Orders Dashboard)
  function animateCardValue(el) {
    if (!el) return;
    el.classList.remove("card-updating");
    // force reflow để restart animation mỗi lần
    void el.offsetWidth;
    el.classList.add("card-updating");
  }

  // ==== Helper cho summary card (All Customers + %, Abandoned Cart) ====
  function setPercentElement(span, value) {
    if (!span) return;
    const v = Number(value || 0);
    span.classList.remove("negative", "positive");
    span.classList.add(v < 0 ? "negative" : "positive");
    const prefix = v > 0 ? "+" : "";
    span.textContent = prefix + v + "%";
  }

  function updateAllCustomersCard(countValue, deltaValue) {
    const wrap = document.querySelector(".all-customer .card-value");
    if (!wrap) return;

    const numStr = Number(countValue || 0).toLocaleString();
    let pctSpan = wrap.querySelector(".percent");
    if (!pctSpan) {
      pctSpan = document.createElement("span");
      pctSpan.className = "percent positive";
    }

    wrap.innerHTML = numStr + " ";
    wrap.appendChild(pctSpan);

    if (deltaValue != null) {
      setPercentElement(pctSpan, deltaValue);
    } else {
      // nếu chưa có delta thì để 0%
      setPercentElement(pctSpan, 0);
    }
    animateCardValue(wrap);
  }

  function updateAbandonedCartCard(countValue) {
    const wrap = document.querySelector(".abandoned-cart .card-value");
    if (!wrap) return;
    wrap.textContent = Number(countValue || 0).toLocaleString();
    animateCardValue(wrap);
  }

  async function loadStats(period, opts) {
    try {
      const p = (
        period ||
        statsPeriod ||
        "this_week"
      )
        .toString()
        .toLowerCase();
      statsPeriod = p;

      // Build query cho /customers/stats (đồng bộ với filter đang áp dụng cho bảng)
      const params = new URLSearchParams({ period: p });
      const f = opts && opts.filters ? opts.filters : null;
      if (f) {
        if (f.search) params.set("search", f.search);
        if (f.status) params.set("status", f.status);
        if (f.fromDate) params.set("fromDate", f.fromDate);
        if (f.toDate) params.set("toDate", f.toDate);
        if (f.minAmount !== "" && f.minAmount != null)
          params.set("minAmount", String(f.minAmount));
        if (f.maxAmount !== "" && f.maxAmount != null)
          params.set("maxAmount", String(f.maxAmount));
      }

      // gọi /customers/stats và, nếu có, getOrdersSummary(p) song song
      const statsPromise = api(`/customers/stats?${params.toString()}`);
      const summaryPromise =
        typeof getOrdersSummary === "function"
          ? getOrdersSummary(p)
          : Promise.resolve(null);

      const [res, summary] = await Promise.all([
        statsPromise,
        summaryPromise,
      ]);

      if (!res.ok) return;
      const data = await res.json();
      const s = data.data || {};

      // ---- All Customers: số từ /customers/stats, % từ orders summary (nếu có) ----
      const customersDelta =
        summary && summary.deltas ? summary.deltas.customers : null;
      updateAllCustomersCard(s.allCustomers, customersDelta);

      // ---- Active / In-Active / New / Purchasing: chỉ hiển thị số, không fake % ----
      const activeWrap = document.querySelector(".active .card-value");
      if (activeWrap) {
        activeWrap.textContent = Number(s.active || 0).toLocaleString();
        animateCardValue(activeWrap);
      }

      const inactiveWrap = document.querySelector(".in-active .card-value");
      if (inactiveWrap) {
        inactiveWrap.textContent = Number(s.inactive || 0).toLocaleString();
        animateCardValue(inactiveWrap);
      }

      const newWrap = document.querySelector(".new-customer .card-value");
      if (newWrap) {
        newWrap.textContent = (s.newCustomers || 0).toString();
        animateCardValue(newWrap);
      }

      const purchasingWrap = document.querySelector(".purchasing .card-value");
      if (purchasingWrap) {
        purchasingWrap.textContent = (s.purchasing || 0).toString();
        animateCardValue(purchasingWrap);
      }

      // ---- Abandoned Carts: ưu tiên lấy từ orders summary (canceled), fallback customers/stats ----
      const abandonedFromSummary =
        summary && summary.counts ? summary.counts.canceled : null;
      updateAbandonedCartCard(
        abandonedFromSummary != null ? abandonedFromSummary : s.abandonedCarts
      );
    } catch (e) {
      console.error("Load stats error:", e);
    }
  }

  async function loadCustomers() {
    try {
      const params = new URLSearchParams({
        page: String(filters.page),
        limit: String(filters.limit),
      });
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.fromDate) params.set("fromDate", filters.fromDate);
      if (filters.toDate) params.set("toDate", filters.toDate);
      if (filters.minAmount !== "" && !isNaN(filters.minAmount))
        params.set("minAmount", String(filters.minAmount));
      if (filters.maxAmount !== "" && !isNaN(filters.maxAmount))
        params.set("maxAmount", String(filters.maxAmount));

      // Dùng api() -> cookie auth, không header Bearer null
      const res = await api(`/customers?${params.toString()}`);
      if (!res.ok) {
        console.error("Không thể tải danh sách khách hàng");
        return;
      }
      const data = await res.json();
      const rows = (data.data || [])
        .map((c) => {
          const normalizedStatus = String(c.status || "").toLowerCase();
          const statusKey =
            normalizedStatus === "active"
              ? "customers.status_active"
              : "customers.status_inactive";
          const statusClass =
            normalizedStatus === "active" ? "status-active" : "status-in_active";

          return `
      <tr class="customer-row" data-id="${c.id}" data-customer-id="${c.id}" style="cursor: pointer;">
        <td><input type="checkbox" class="row-checkbox" data-id="${c.id}" onclick="event.stopPropagation();"></td>
        <td>${c.name}</td>
        <td>${c.email}</td>
        <td>${c.phone || "-"}</td>
        <td>${c.orderCount}</td>
        <td class="order-total" data-raw="${c.totalSpent}">
          ${formatCurrency(c.totalSpent)}
        </td>
        <td>${formatDate(c.joinedDate)}</td>
       <td>
          <span class="status ${statusClass}">${t(statusKey)}</span>
        </td>
      </tr>
    `;
        })
        .join("");

      tableBody.innerHTML =
        rows ||
        `<tr><td colspan="8" style="text-align:center; padding:20px;">Không có dữ liệu</td></tr>`;

      // Gắn click handler cho từng dòng khách hàng -> sang trang Customer_details.html kèm id
      const customerRows = document.querySelectorAll(".customer-row");
      customerRows.forEach((row) => {
        row.addEventListener("click", (e) => {
          // Nếu bấm trực tiếp vào checkbox thì không redirect
          if (e.target && e.target.type === "checkbox") return;
          const customerId = row.getAttribute("data-customer-id");
          if (customerId) {
            // Nếu file Customer_details.html nằm cùng thư mục với ManageCustomer_Employee.html:
            window.location.href = `Customer_Details.html?id=${customerId}`;
            // Nếu khác thư mục, bạn chỉ cần chỉnh lại path cho đúng, ví dụ:
            // window.location.href = `./Customer_details.html?id=${customerId}`;
          }
        });
      });

      // reset "select all" mỗi lần load lại bảng
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
      }

      // cập nhật thông tin phân trang hiển thị (đơn giản)
      const pag = data.pagination || {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
      };
      const startItem = (pag.page - 1) * pag.limit + 1;
      const endItem = Math.min(pag.page * pag.limit, pag.total);
      const pagElems = document.querySelectorAll(".pagination span");
      if (pagElems.length >= 3) {
        pagElems[0].textContent = `${pag.limit} items per page`;
        pagElems[1].textContent =
          pag.total > 0
            ? `${startItem}-${endItem} of ${pag.total} items`
            : "0-0 of 0 items";
        pagElems[2].textContent = `${pag.page} of ${pag.totalPages} pages`;
      }
      updatePaginationControls(pag);
    } catch (e) {
      console.error("Load customers error:", e);
    }
  }

  // ==================
  // PHÂN TRANG: NÚT PREV / NEXT
  // ==================
  const pageNavButtons = document.querySelectorAll(".pagination .page-nav");
  const prevPageBtn = pageNavButtons[0];
  const nextPageBtn = pageNavButtons[1];

  function updatePaginationControls(pag) {
    // lưu lại page thực tế từ backend
    filters.page = pag.page;

    if (prevPageBtn) {
      prevPageBtn.disabled = pag.page <= 1;
    }
    if (nextPageBtn) {
      nextPageBtn.disabled = pag.page >= pag.totalPages;
    }
  }

  // Gắn sự kiện click cho 2 nút
  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (filters.page > 1) {
        filters.page -= 1;
        loadCustomers();
        // ✅ Cập nhật luôn orders-summary theo filter + trang hiện tại
        loadStats(statsPeriod, { filters });
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      // totalPages sẽ được cập nhật mỗi lần loadCustomers() -> dùng tạm số lớn, backend sẽ tự chặn
      filters.page += 1;
      loadCustomers();
      // ✅ Bấm Next cũng cập nhật lại summary
      loadStats(statsPeriod, { filters });
    });
  }

  // Gọi khi vào trang
  loadStats(statsPeriod, { filters });
  loadCustomers();

  // ==============
  // THÊM KHÁCH HÀNG
  // ==============
  const addBtn = document.querySelector(".btn-create-order");
  const modal = document.getElementById("addCustomerModal");
  const btnCancel = document.getElementById("acCancel");
  const btnSubmit = document.getElementById("acSubmit");
  const errBox = document.getElementById("addCustomerError");

  function openModal() {
    modal.style.display = "flex";
  }

  function closeModal() {
    modal.style.display = "none";
    if (errBox) {
      errBox.style.display = "none";
      errBox.textContent = "";
    }
  }

  if (addBtn) addBtn.addEventListener("click", openModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);
  if (modal)
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

  if (btnSubmit)
    btnSubmit.addEventListener("click", async () => {
      try {
        const fullName = document.getElementById("acFullName").value.trim();
        const email = document.getElementById("acEmail").value.trim();
        const phoneRaw = document.getElementById("acPhone").value.trim();
        if (!fullName || !email || !phoneRaw) {
          if (errBox) {
            errBox.textContent =
              "Vui lòng nhập đầy đủ họ tên, email, số điện thoại.";
            errBox.style.display = "block";
          } else {
            alert("Vui lòng nhập đầy đủ họ tên, email, số điện thoại.");
          }
          return;
        }

        // Validate email cơ bản (tận dụng helper isValidEmail ở đầu file)
        if (!isValidEmail(email)) {
          const msg = "Email không hợp lệ, vui lòng kiểm tra lại.";
          if (errBox) {
            errBox.textContent = msg;
            errBox.style.display = "block";
          } else {
            alert(msg);
          }
          return;
        }

        // Chuẩn hóa & validate số điện thoại ở FE
        const phoneDigits = phoneRaw.replace(/\D/g, "");
        if (phoneDigits.length < 10 || phoneDigits.length > 11) {
          const msg =
            "Số điện thoại phải có 10-11 chữ số (chỉ nhập số, bỏ dấu cách, dấu +, ...).";
          if (errBox) {
            errBox.textContent = msg;
            errBox.style.display = "block";
          } else {
            alert(msg);
          }
          return;
        }

        // Gọi API tạo khách hàng (dùng cookie auth)
        const res = await api("/customers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName,
            email,
            password: "Temp@1234",
            phone: phoneDigits,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Tạo khách hàng thất bại");
        }
        closeModal();
        alert("Tạo khách hàng thành công!");
        loadCustomers();
        loadStats(statsPeriod, { filters });
      } catch (e) {
        if (errBox) {
          errBox.textContent = e.message;
          errBox.style.display = "block";
        } else {
          alert(e.message || "Tạo khách hàng thất bại");
        }
      }
    });

  // =========
  // FILTER UI
  // =========
  // Search
  // Search (search-bar trên cùng) - fuzzy Name/Email/Phone
  const searchInput = document.querySelector(".search-bar input");
  let searchDebounce;
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const raw = e.target.value || "";
      const trimmed = raw.trim();

      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        // Nếu rỗng -> reset filter search
        if (trimmed === "") {
          filters.search = "";
          filters.page = 1;
          loadCustomers();
          loadStats(statsPeriod, { filters });
          return;
        }

        // Nếu < 2 ký tự -> không gửi request (giữ kết quả hiện tại)
        if (trimmed.length < 2) {
          // Có thể sau này bạn muốn show tooltip nhỏ tại đây
          return;
        }

        filters.search = trimmed;
        filters.page = 1;
        loadCustomers();
        loadStats(statsPeriod, { filters });
      }, 300);
    });
  }

  // General Filter: Status, Customer (sử dụng như search), Amount
  const generalFilterApplyBtn =
    generalFilterDropdown.querySelector(".btn-apply-filter");
  const generalSelects = generalFilterDropdown.querySelectorAll(
    ".filter-section select"
  ); // status select
  const customerNameInput = document.getElementById("customerNameFilter");
  const amountInputs = generalFilterDropdown.querySelectorAll(
    '.amount-group input[type="number"]'
  );
  if (generalFilterApplyBtn) {
    generalFilterApplyBtn.addEventListener("click", () => {
      // Khi áp dụng Filter chung, reset toàn bộ filter theo ngày
      filters.fromDate = "";
      filters.toDate = "";
      // reset trạng thái chọn ngày trên calendar
      dateRange.fromElement = null;
      dateRange.toElement = null;
      isSelectingFrom = true;
      updateDateButtons();
      highlightSelectedRange();
      // đưa radio range về mặc định "This Week"
      const defaultRadio = document.querySelector(
        'input[name="date_range"][value="this_week"]'
      );
      if (defaultRadio) defaultRadio.checked = true;

      // Status
      const statusVal = generalSelects[0]?.value || "all";
      filters.status =
        statusVal === "active"
          ? "active"
          : statusVal === "inactive"
            ? "inactive"
            : "";

      // Customer text -> dùng làm search chung Name/Email/Phone
      const customerVal = (customerNameInput?.value || "").trim();

      // Nếu có nhập mà < 2 ký tự -> cảnh báo, không lọc
      if (customerVal && customerVal.length < 2) {
        alert("Vui lòng nhập ít nhất 2 ký tự để lọc theo khách hàng.");
        return;
      }

      // Nếu chuỗi trông giống email nhưng regex không match -> hỏi confirm
      if (customerVal && isEmailLike(customerVal) && !isValidEmail(customerVal)) {
        const ok = window.confirm(
          "Chuỗi bạn nhập trông giống email nhưng có vẻ không đúng định dạng.\nBạn vẫn muốn dùng chuỗi này để lọc không?"
        );
        if (!ok) {
          return;
        }
      }

      // Gán vào filters.search + sync lên ô search-bar phía trên
      filters.search = customerVal;
      if (searchInput) searchInput.value = customerVal;

      // Amount
      let minV = amountInputs[0]?.value || "";
      let maxV = amountInputs[1]?.value || "";
      let minNum =
        minV === "" || isNaN(parseFloat(minV)) ? "" : parseFloat(minV);
      let maxNum =
        maxV === "" || isNaN(parseFloat(maxV)) ? "" : parseFloat(maxV);
      if (minNum !== "" && minNum < 0) minNum = 0;
      if (maxNum !== "" && maxNum < 0) maxNum = 0;
      // Nếu người dùng nhập ngược, tự hoán đổi và cập nhật lại vào ô input
      if (minNum !== "" && maxNum !== "" && minNum > maxNum) {
        const tmp = minNum;
        minNum = maxNum;
        maxNum = tmp;
        if (amountInputs[0]) amountInputs[0].value = String(minNum);
        if (amountInputs[1]) amountInputs[1].value = String(maxNum);
      }
      filters.minAmount = minNum;
      filters.maxAmount = maxNum;

      filters.page = 1;
      closeAllDropdowns();
      loadCustomers();
      loadStats(statsPeriod, { filters });
    });
  }

  // Date Filter
  const dateFilterApplyBtn =
    dateFilterDropdown.querySelector(".btn-apply-filter");

  function getRangeByKey(key) {
    const now = new Date();
    const start = new Date();
    const end = new Date();
    // Normalize end to end-of-day
    end.setHours(23, 59, 59, 999);

    function firstDayOfWeek(d) {
      const day = d.getDay() || 7; // Monday-first style
      const diff = d.getDate() - day + 1;
      return new Date(d.getFullYear(), d.getMonth(), diff);
    }

    function lastDayOfWeek(d) {
      const first = firstDayOfWeek(d);
      const last = new Date(first);
      last.setDate(first.getDate() + 6);
      last.setHours(23, 59, 59, 999);
      return last;
    }
    if (key === "this_week") {
      const s = firstDayOfWeek(now);
      return {
        from: s,
        to: lastDayOfWeek(now),
      };
    }
    if (key === "last_week") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      const s = firstDayOfWeek(d);
      const t = lastDayOfWeek(d);
      return {
        from: s,
        to: t,
      };
    }
    if (key === "this_month") {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const t = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      t.setHours(23, 59, 59, 999);
      return {
        from: s,
        to: t,
      };
    }
    if (key === "last_month") {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const t = new Date(now.getFullYear(), now.getMonth(), 0);
      t.setHours(23, 59, 59, 999);
      return {
        from: s,
        to: t,
      };
    }
    if (key === "this_year") {
      const s = new Date(now.getFullYear(), 0, 1);
      const t = new Date(now.getFullYear(), 11, 31);
      t.setHours(23, 59, 59, 999);
      return {
        from: s,
        to: t,
      };
    }
    if (key === "last_year") {
      const year = now.getFullYear() - 1;
      const s = new Date(year, 0, 1);
      const t = new Date(year, 11, 31);
      t.setHours(23, 59, 59, 999);
      return {
        from: s,
        to: t,
      };
    }
    return {
      from: null,
      to: null,
    };
  }

  if (dateFilterApplyBtn) {
    dateFilterApplyBtn.addEventListener("click", () => {
      // Khi lọc theo ngày, reset toàn bộ filter chung
      filters.search = "";
      filters.status = "";
      filters.minAmount = "";
      filters.maxAmount = "";
      // reset UI của filter chung (search, status, amount)
      if (searchInput) searchInput.value = "";
      if (generalSelects[0]) generalSelects[0].value = "all";
      if (customerNameInput) customerNameInput.value = "";
      if (amountInputs[0]) amountInputs[0].value = "";
      if (amountInputs[1]) amountInputs[1].value = "";

      // Ưu tiên dùng khoảng ngày chọn trên calendar (From/To)
      function fmt(d) {
        if (!d) return "";
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }

      let fromSel = dateRange?.fromElement?.dataset?.date
        ? new Date(dateRange.fromElement.dataset.date)
        : null;
      let toSel = dateRange?.toElement?.dataset?.date
        ? new Date(dateRange.toElement.dataset.date)
        : null;

      // Nếu chỉ chọn 1 ngày, coi như từ = tới = ngày đó
      if (fromSel && !toSel) toSel = new Date(fromSel);
      if (!fromSel && toSel) fromSel = new Date(toSel);

      if (fromSel && toSel) {
        // Chuẩn hóa: nếu from > to thì hoán đổi
        if (fromSel.getTime() > toSel.getTime()) {
          const tmp = fromSel;
          fromSel = toSel;
          toSel = tmp;
        }
        filters.fromDate = fmt(fromSel);
        filters.toDate = fmt(toSel);
      } else {
        // Không chọn ngày trên calendar -> dùng preset radio
        const checkedRadio = document.querySelector(
          'input[name="date_range"]:checked'
        );
        if (checkedRadio) {
          const range = getRangeByKey(checkedRadio.value);
          if (range.from && range.to) {
            filters.fromDate = fmt(range.from);
            filters.toDate = fmt(range.to);
          } else {
            filters.fromDate = "";
            filters.toDate = "";
          }
        } else {
          filters.fromDate = "";
          filters.toDate = "";
        }
      }

      filters.page = 1;
      closeAllDropdowns();
      loadCustomers();
      loadStats(statsPeriod, { filters });
    });
  }

  // ==================
  // REALTIME: Tự động refresh Customers + Stats (debounce)
  // ==================
  let _customersDirty = false;
  let _statsDirty = false;
  let _customersTimer = null;
  let _statsTimer = null;

  function scheduleReloadCustomers() {
    _customersDirty = true;
    clearTimeout(_customersTimer);
    _customersTimer = setTimeout(() => {
      if (!_customersDirty) return;
      _customersDirty = false;
      loadCustomers(); // dùng filters hiện tại
    }, 400);
  }

  function scheduleReloadStats() {
    _statsDirty = true;
    clearTimeout(_statsTimer);
    _statsTimer = setTimeout(() => {
      if (!_statsDirty) return;
      _statsDirty = false;
      loadStats(statsPeriod, { filters });
    }, 800);
  }

  if (window.Realtime && typeof window.Realtime.connect === "function") {
    try {
      Realtime.connect({
        onEvent: function (evt) {
          if (!evt || !evt.type) return;

          // 👥 Khách hàng thay đổi (tạo mới / bulk-status)
          if (evt.type === "customers.changed") {
            scheduleReloadCustomers();
            scheduleReloadStats();
          }

          // 📦 Đơn hàng thay đổi (tạo / cập nhật / hoàn tất...)
          // gồm: orders.updated, orders.created, orders.changed (nếu có)
          if (evt.type.startsWith("orders.")) {
            // Đơn hàng chỉ ảnh hưởng thống kê (purchasing, abandoned...), không cần reload bảng khách
            scheduleReloadStats();
          }
        },
        onError: function (err) {
          console.warn("[customers] realtime error:", err);
        },
      });
    } catch (e) {
      console.warn("[customers] cannot init realtime:", e);
    }
  }
});