const statusState = {
  rows: [],
  currentPage: 1,
  pageSize: 10
};

const statusEls = {
  rows: document.querySelector("#bookingStatusRows"),
  empty: document.querySelector("#bookingStatusEmpty"),
  summary: document.querySelector("#statusSummary"),
  prev: document.querySelector("#prevPage"),
  next: document.querySelector("#nextPage"),
  pageInfo: document.querySelector("#pageInfo")
};

statusEls.prev.addEventListener("click", () => {
  if (statusState.currentPage > 1) {
    statusState.currentPage -= 1;
    renderBookingStatus();
  }
});

statusEls.next.addEventListener("click", () => {
  if (statusState.currentPage < totalPages()) {
    statusState.currentPage += 1;
    renderBookingStatus();
  }
});

loadBookingStatus();

async function loadBookingStatus() {
  try {
    const response = await fetch("/api/public/bookings/upcoming");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    statusState.rows = await response.json();
    statusState.currentPage = 1;
    renderBookingStatus();
  } catch (error) {
    statusEls.summary.textContent = `載入失敗：${error.message}`;
    statusEls.rows.innerHTML = "";
    statusEls.empty.hidden = false;
  }
}

function renderBookingStatus() {
  const total = totalPages();
  const start = (statusState.currentPage - 1) * statusState.pageSize;
  const visibleRows = statusState.rows.slice(start, start + statusState.pageSize);

  statusEls.summary.textContent = `共 ${statusState.rows.length} 筆，每頁最多 10 筆`;
  statusEls.empty.hidden = statusState.rows.length > 0;
  statusEls.rows.innerHTML = "";

  for (const booking of visibleRows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="primary">${escapeHtml(booking.appointmentNo)}</span></td>
      <td><span class="primary">${formatDate(booking.startTime)}</span><span class="sub">${formatTimeRange(booking.startTime, booking.endTime)}</span></td>
      <td>${escapeHtml(booking.serviceName)}</td>
      <td>${escapeHtml(booking.customerName)}</td>
      <td>${escapeHtml(booking.therapistName)}</td>
      <td><span class="pill ${normalizeStatus(booking.status)}">${statusLabel(booking.status)}</span></td>
    `;
    statusEls.rows.append(tr);
  }

  statusEls.pageInfo.textContent = `${statusState.currentPage} / ${total}`;
  statusEls.prev.disabled = statusState.currentPage <= 1;
  statusEls.next.disabled = statusState.currentPage >= total;
}

function totalPages() {
  return Math.max(1, Math.ceil(statusState.rows.length / statusState.pageSize));
}

function statusLabel(value) {
  const status = normalizeStatus(value);
  return {
    pending: "待確認",
    confirmed: "已接受",
    completed: "已完成",
    cancelled: "已取消"
  }[status] ?? value ?? "-";
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDate(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : new Date(value).toLocaleDateString("zh-TW");
}

function formatTimeRange(start, end) {
  return `${formatClock(start)} - ${formatClock(end)}`;
}

function formatClock(value) {
  const match = String(value).match(/T(\d{2}:\d{2})/);
  return match ? match[1] : new Date(value).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
