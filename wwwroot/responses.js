const pageSize = 10;
const state = { responses: [], filtered: [], currentPage: 1 };

const els = {
  rows: document.querySelector("#responseRows"),
  loading: document.querySelector("#loadingState"),
  error: document.querySelector("#errorState"),
  empty: document.querySelector("#emptyState"),
  resultCount: document.querySelector("#resultCount"),
  total: document.querySelector("#totalResponses"),
  average: document.querySelector("#averageRating"),
  fiveStar: document.querySelector("#fiveStarResponses"),
  lowRating: document.querySelector("#lowRatingResponses"),
  search: document.querySelector("#searchInput"),
  rating: document.querySelector("#ratingFilter"),
  refresh: document.querySelector("#refreshButton"),
  previousPage: document.querySelector("#previousPageButton"),
  nextPage: document.querySelector("#nextPageButton"),
  pageInfo: document.querySelector("#pageInfo")
};

els.search.addEventListener("input", () => applyFilters(true));
els.rating.addEventListener("change", () => applyFilters(true));
els.refresh.addEventListener("click", loadResponses);
els.previousPage.addEventListener("click", () => changePage(-1));
els.nextPage.addEventListener("click", () => changePage(1));

loadResponses();

async function loadResponses() {
  setLoading(true);
  els.error.hidden = true;
  try {
    const response = await fetch("/api/bookings");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.responses = [...(data.bookings ?? [])]
      .filter((booking) => booking.rating || booking.reviewComment || booking.customerNote)
      .sort((left, right) => left.id - right.id);
    applyFilters(false);
  } catch (error) {
    els.error.textContent = `讀取顧客回應失敗：${error.message}`;
    els.error.hidden = false;
    state.responses = [];
    applyFilters(true);
  } finally {
    setLoading(false);
  }
}

function applyFilters(resetPage) {
  const keyword = els.search.value.trim().toLowerCase();
  const rating = els.rating.value;
  state.filtered = state.responses.filter((item) => {
    const matchesRating = rating === "all" || String(item.rating ?? "") === rating;
    const haystack = [item.appointmentNo, item.customerName, item.serviceName, item.reviewComment, item.customerNote].filter(Boolean).join(" ").toLowerCase();
    return matchesRating && (!keyword || haystack.includes(keyword));
  });
  if (resetPage) state.currentPage = 1;
  clampPage();
  renderSummary();
  renderRows();
}

function renderSummary() {
  const total = state.filtered.length;
  const ratingSum = state.filtered.reduce((sum, item) => sum + Number(item.rating ?? 0), 0);
  els.total.textContent = total;
  els.average.textContent = total > 0 ? (ratingSum / total).toFixed(1) : "0.0";
  els.fiveStar.textContent = state.filtered.filter((item) => Number(item.rating) === 5).length;
  els.lowRating.textContent = state.filtered.filter((item) => Number(item.rating) > 0 && Number(item.rating) <= 3).length;
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
  for (const item of visibleRows) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="primary">${escapeHtml(item.appointmentNo)}</span><span class="sub">#${item.id}</span></td>
      <td><span class="primary">${escapeHtml(item.customerName)}</span><span class="sub">${escapeHtml(item.customerPhone || item.customerEmail || "")}</span></td>
      <td>${escapeHtml(item.serviceName)}</td>
      <td><span class="ratingBadge">${formatRating(item.rating)}</span></td>
      <td class="noteCell">${escapeHtml(item.reviewComment || "-")}</td>
      <td class="noteCell">${escapeHtml(item.customerNote || "-")}</td>
    `;
    fragment.append(row);
  }
  els.rows.append(fragment);
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

function setLoading(isLoading) {
  els.loading.hidden = !isLoading;
  if (isLoading) {
    els.previousPage.disabled = true;
    els.nextPage.disabled = true;
  }
}

function formatRating(rating) {
  return rating ? `${rating} / 5` : "-";
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
