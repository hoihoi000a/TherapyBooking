const pageSize = 10;
const state = { bookings: [], filtered: [], currentPage: 1 };

const els = {
  rows: document.querySelector("#bookingRows"),
  loading: document.querySelector("#loadingState"),
  error: document.querySelector("#errorState"),
  empty: document.querySelector("#emptyState"),
  resultCount: document.querySelector("#resultCount"),
  grossRevenue: document.querySelector("#grossRevenue"),
  paidRevenue: document.querySelector("#paidRevenue"),
  outstandingRevenue: document.querySelector("#outstandingRevenue"),
  averageTicket: document.querySelector("#averageTicket"),
  search: document.querySelector("#searchInput"),
  status: document.querySelector("#statusFilter"),
  refresh: document.querySelector("#refreshButton"),
  previousPage: document.querySelector("#previousPageButton"),
  nextPage: document.querySelector("#nextPageButton"),
  pageInfo: document.querySelector("#pageInfo")
};

const money = new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
const timeFormatter = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });

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
    state.bookings = [...(data.bookings ?? [])].sort((left, right) => left.id - right.id);
    applyFilters(false);
  } catch (error) {
    els.error.textContent = `讀取收益資料失敗：${error.message}`;
    els.error.hidden = false;
    state.bookings = [];
    applyFilters(true);
  } finally {
    setLoading(false);
  }
}

function applyFilters(resetPage) {
  const keyword = els.search.value.trim().toLowerCase();
  const status = els.status.value;

  state.filtered = state.bookings
    .filter((booking) => {
      const matchesStatus = status === "all" || normalize(booking.status) === status;
      const haystack = [
        booking.id,
        booking.appointmentNo,
        booking.customerName,
        booking.therapistName,
        booking.serviceName,
        booking.paymentStatus,
        booking.paymentMethod
      ].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && (!keyword || haystack.includes(keyword));
    })
    .sort((left, right) => left.id - right.id);

  if (resetPage) state.currentPage = 1;
  clampPage();
  renderSummary();
  renderRows();
}

function renderSummary() {
  const validRows = state.filtered.filter((booking) => normalize(booking.status) !== "cancelled");
  const grossRevenue = validRows.reduce((sum, booking) => sum + getExpectedAmount(booking), 0);
  const paidRevenue = validRows
    .filter((booking) => normalize(booking.paymentStatus) === "paid")
    .reduce((sum, booking) => sum + getExpectedAmount(booking), 0);
  const outstandingRevenue = validRows
    .filter((booking) => normalize(booking.paymentStatus) !== "paid")
    .reduce((sum, booking) => sum + getExpectedAmount(booking), 0);
  const averageTicket = validRows.length > 0 ? grossRevenue / validRows.length : 0;

  els.grossRevenue.textContent = money.format(grossRevenue);
  els.paidRevenue.textContent = money.format(paidRevenue);
  els.outstandingRevenue.textContent = money.format(outstandingRevenue);
  els.averageTicket.textContent = money.format(averageTicket);
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
    const expectedAmount = getExpectedAmount(booking);
    const actualAmount = normalize(booking.paymentStatus) === "paid" ? expectedAmount : 0;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="primary">${escapeHtml(booking.appointmentNo)}</span><span class="sub">#${booking.id} · ${formatDate(booking.appointmentDate)} ${formatTimeRange(booking.startTime, booking.endTime)}</span></td>
      <td><span class="primary">${escapeHtml(booking.customerName)}</span><span class="sub">${escapeHtml(booking.customerPhone || booking.customerEmail || "")}</span></td>
      <td><span class="primary">${escapeHtml(booking.serviceName)}</span><span class="sub">${formatService(booking)}</span></td>
      <td><span class="pill ${normalize(booking.status)}">${escapeHtml(booking.status || "-")}</span></td>
      <td>${escapeHtml(booking.paymentMethod || "-")}</td>
      <td><span class="pill ${normalize(booking.paymentStatus)}">${escapeHtml(booking.paymentStatus || "-")}</span></td>
      <td class="moneyCell">${money.format(expectedAmount)}</td>
      <td class="moneyCell ${actualAmount > 0 ? "paidAmount" : "unpaidAmount"}">${money.format(actualAmount)}</td>
      <td><select class="statusSelect" data-id="${booking.id}">${statusOption("pending", booking.status)}${statusOption("confirmed", booking.status)}${statusOption("completed", booking.status)}${statusOption("cancelled", booking.status)}</select></td>
    `;
    fragment.append(row);
  }

  els.rows.append(fragment);
  document.querySelectorAll(".statusSelect").forEach((select) => select.addEventListener("change", updateStatus));
}

async function updateStatus(event) {
  const select = event.target;
  select.disabled = true;
  try {
    const response = await fetch(`/api/admin/bookings/${select.dataset.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: select.value })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await loadBookings();
  } catch (error) {
    els.error.textContent = `更新狀態失敗：${error.message}`;
    els.error.hidden = false;
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

function getExpectedAmount(booking) {
  return Number(booking.paymentAmount ?? booking.servicePrice ?? 0);
}

function statusOption(value, current) {
  return `<option value="${value}" ${normalize(current) === value ? "selected" : ""}>${value}</option>`;
}

function setLoading(isLoading) {
  els.loading.hidden = !isLoading;
  if (isLoading) {
    els.previousPage.disabled = true;
    els.nextPage.disabled = true;
  }
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDate(value) {
  if (!value) return "-";
  const [date] = String(value).split("T");
  return date ? date.replaceAll("-", "/") : dateFormatter.format(new Date(value));
}

function formatTimeRange(start, end) {
  if (!start || !end) return "-";
  return `${formatClock(start)}-${formatClock(end)}`;
}

function formatService(booking) {
  return escapeHtml([booking.durationMinutes ? `${booking.durationMinutes} 分` : null, booking.therapistName].filter(Boolean).join(" / "));
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
