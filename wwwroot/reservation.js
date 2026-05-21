const pageSize = 10;
const state = { bookings: [], filtered: [], currentPage: 1 };

const els = {
  rows: document.querySelector("#bookingRows"),
  loading: document.querySelector("#loadingState"),
  error: document.querySelector("#errorState"),
  empty: document.querySelector("#emptyState"),
  resultCount: document.querySelector("#resultCount"),
  monthSummary: document.querySelector("#monthSummary"),
  total: document.querySelector("#totalBookings"),
  pending: document.querySelector("#pendingBookings"),
  confirmed: document.querySelector("#confirmedBookings"),
  cancelled: document.querySelector("#cancelledBookings"),
  month: document.querySelector("#monthFilter"),
  search: document.querySelector("#searchInput"),
  status: document.querySelector("#statusFilter"),
  refresh: document.querySelector("#refreshButton"),
  previousPage: document.querySelector("#previousPageButton"),
  nextPage: document.querySelector("#nextPageButton"),
  pageInfo: document.querySelector("#pageInfo")
};

const timeFormatter = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
const monthFormatter = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long" });

els.month.addEventListener("change", () => applyFilters(true));
els.search.addEventListener("input", () => applyFilters(true));
els.status.addEventListener("change", () => applyFilters(true));
els.refresh.addEventListener("click", loadBookings);
els.previousPage.addEventListener("click", () => changePage(-1));
els.nextPage.addEventListener("click", () => changePage(1));

loadBookings();

async function loadBookings() {
  setLoading(true);
  els.error.hidden = true;

  try {
    const response = await fetch("/api/bookings");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    state.bookings = [...(data.bookings ?? [])].sort((left, right) => new Date(left.startTime) - new Date(right.startTime));
    renderMonthOptions();
    applyFilters(false);
  } catch (error) {
    showError(`讀取預約資料失敗：${error.message}`);
    state.bookings = [];
    renderMonthOptions();
    applyFilters(true);
  } finally {
    setLoading(false);
  }
}

function renderMonthOptions() {
  const currentValue = els.month.value || getCurrentMonthKey();
  const months = [...new Set(state.bookings.map((booking) => monthKey(booking.startTime)).filter(Boolean))]
    .sort()
    .reverse();

  els.month.innerHTML = `<option value="all">全部月份</option>`;
  for (const month of months) {
    els.month.append(new Option(formatMonthLabel(month), month));
  }

  els.month.value = months.includes(currentValue) ? currentValue : (months.includes(getCurrentMonthKey()) ? getCurrentMonthKey() : "all");
}

function applyFilters(resetPage) {
  const keyword = els.search.value.trim().toLowerCase();
  const status = els.status.value;
  const selectedMonth = els.month.value;

  state.filtered = state.bookings.filter((booking) => {
    const matchesMonth = selectedMonth === "all" || monthKey(booking.startTime) === selectedMonth;
    const matchesStatus = status === "all" || normalize(booking.status) === status;
    const haystack = [booking.id, booking.appointmentNo, booking.customerName, booking.therapistName, booking.serviceName, booking.customerNote]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return matchesMonth && matchesStatus && (!keyword || haystack.includes(keyword));
  });

  if (resetPage) state.currentPage = 1;
  clampPage();
  renderSummary();
  renderRows();
}

function renderSummary() {
  els.total.textContent = state.filtered.length;
  els.pending.textContent = state.filtered.filter((booking) => normalize(booking.status) === "pending").length;
  els.confirmed.textContent = state.filtered.filter((booking) => normalize(booking.status) === "confirmed").length;
  els.cancelled.textContent = state.filtered.filter((booking) => normalize(booking.status) === "cancelled").length;
  els.monthSummary.textContent = els.month.value === "all"
    ? "目前顯示全部月份的預約。"
    : `目前顯示 ${formatMonthLabel(els.month.value)} 的預約。`;
}

function renderRows() {
  els.rows.innerHTML = "";
  const totalRows = state.filtered.length;
  const totalPages = getTotalPages();
  const visibleRows = state.filtered.slice((state.currentPage - 1) * pageSize, state.currentPage * pageSize);

  els.resultCount.textContent = `${totalRows} 筆`;
  els.empty.hidden = totalRows !== 0 || !els.error.hidden;
  els.pageInfo.textContent = `第 ${state.currentPage} / ${totalPages} 頁`;
  els.previousPage.disabled = state.currentPage <= 1;
  els.nextPage.disabled = state.currentPage >= totalPages;

  const fragment = document.createDocumentFragment();
  for (const booking of visibleRows) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="primary">${escapeHtml(booking.appointmentNo)}</span><span class="sub">#${booking.id}</span></td>
      <td><span class="primary">${formatDate(booking.startTime)}</span><span class="sub">${formatTimeRange(booking.startTime, booking.endTime)}</span></td>
      <td><span class="primary">${escapeHtml(booking.customerName)}</span><span class="sub">${escapeHtml(booking.customerPhone || booking.customerEmail || "")}</span></td>
      <td><span class="primary">${escapeHtml(booking.therapistName)}</span><span class="sub">${escapeHtml(booking.therapistCode || "")}</span></td>
      <td><span class="primary">${escapeHtml(booking.serviceName)}</span><span class="sub">${booking.durationMinutes ?? "-"} 分</span></td>
      <td class="noteCell">${escapeHtml(booking.customerNote || "-")}</td>
      <td><span class="pill ${normalize(booking.status)}">${statusLabel(booking.status)}</span></td>
      <td>
        <select class="statusSelect" data-id="${booking.id}" aria-label="更新 ${escapeHtml(booking.appointmentNo)} 狀態">
          ${statusOption("pending", booking.status)}
          ${statusOption("confirmed", booking.status)}
          ${statusOption("cancelled", booking.status)}
          ${statusOption("completed", booking.status)}
        </select>
      </td>
    `;
    fragment.append(row);
  }

  els.rows.append(fragment);
  document.querySelectorAll(".statusSelect").forEach((select) => select.addEventListener("change", updateStatus));
}

async function updateStatus(event) {
  const select = event.target;
  const booking = state.bookings.find((item) => String(item.id) === String(select.dataset.id));
  const oldStatus = booking?.status ?? "pending";

  select.disabled = true;
  els.error.hidden = true;

  try {
    const response = await fetch(`/api/admin/bookings/${select.dataset.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: select.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);

    if (booking) booking.status = select.value;
    applyFilters(false);
  } catch (error) {
    select.value = normalize(oldStatus);
    showError(`更新狀態失敗：${error.message}`);
  } finally {
    select.disabled = false;
  }
}

function changePage(direction) {
  state.currentPage += direction;
  clampPage();
  renderRows();
}

function clampPage() {
  state.currentPage = Math.min(Math.max(state.currentPage, 1), getTotalPages());
}

function getTotalPages() {
  return Math.max(1, Math.ceil(state.filtered.length / pageSize));
}

function statusOption(value, current) {
  return `<option value="${value}" ${normalize(current) === value ? "selected" : ""}>${statusLabel(value)}</option>`;
}

function statusLabel(value) {
  return {
    pending: "待確認",
    confirmed: "已確認",
    cancelled: "已取消",
    completed: "已完成"
  }[normalize(value)] ?? value ?? "-";
}

function setLoading(isLoading) {
  els.loading.hidden = !isLoading;
  if (isLoading) {
    els.previousPage.disabled = true;
    els.nextPage.disabled = true;
  }
}

function showError(text) {
  els.error.textContent = text;
  els.error.hidden = false;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function monthKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(value) {
  const [year, month] = String(value).split("-");
  return monthFormatter.format(new Date(Number(year), Number(month) - 1, 1));
}

function formatDate(value) {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : new Date(value).toLocaleDateString("zh-TW");
}

function formatTimeRange(start, end) {
  if (!start || !end) return "-";
  return `${formatClock(start)}-${formatClock(end)}`;
}

function formatClock(value) {
  const match = String(value).match(/T(\d{2}:\d{2})/);
  return match ? match[1] : timeFormatter.format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
