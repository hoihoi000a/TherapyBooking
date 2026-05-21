const state = {
  therapists: [],
  schedules: [],
  appointments: [],
  currentMonth: startOfMonth(new Date()),
  selectedDate: null
};

const els = {
  therapistFilter: document.querySelector("#therapistFilter"),
  refresh: document.querySelector("#refreshButton"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  monthTitle: document.querySelector("#monthTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  message: document.querySelector("#calendarMessage"),
  selectedDateTitle: document.querySelector("#selectedDateTitle"),
  selectedDateSummary: document.querySelector("#selectedDateSummary"),
  toggleBusinessDay: document.querySelector("#toggleBusinessDay"),
  daySlotList: document.querySelector("#daySlotList")
};

const monthFormatter = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long" });
const dateFormatter = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });

els.therapistFilter.addEventListener("change", async () => {
  state.selectedDate = null;
  await loadMonthData();
});
els.refresh.addEventListener("click", loadMonthData);
els.prevMonth.addEventListener("click", async () => changeMonth(-1));
els.nextMonth.addEventListener("click", async () => changeMonth(1));
els.toggleBusinessDay.addEventListener("click", toggleSelectedDate);

init();

async function init() {
  await loadTherapists();
  await loadMonthData();
}

async function loadTherapists() {
  try {
    const response = await fetch("/api/admin/therapists");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.therapists = await response.json();
    renderTherapistOptions();
  } catch (error) {
    showMessage(`治療師資料載入失敗：${error.message}`, "error");
  }
}

async function loadMonthData() {
  hideMessage();
  const therapistId = Number(els.therapistFilter.value);
  if (!therapistId) {
    renderCalendar();
    renderSelectedDate();
    return;
  }

  try {
    const [schedulesResponse, bookingsResponse] = await Promise.all([
      fetch(`/api/admin/schedules?therapistId=${therapistId}`),
      fetch("/api/bookings")
    ]);
    if (!schedulesResponse.ok || !bookingsResponse.ok) throw new Error("無法讀取時段資料");

    state.schedules = await schedulesResponse.json();
    const bookingData = await bookingsResponse.json();
    state.appointments = (bookingData.bookings ?? []).filter((booking) => Number(booking.therapistId) === therapistId);
    renderCalendar();
    renderSelectedDate();
  } catch (error) {
    showMessage(`時段資料載入失敗：${error.message}`, "error");
  }
}

async function changeMonth(amount) {
  state.currentMonth = addMonths(state.currentMonth, amount);
  state.selectedDate = null;
  await loadMonthData();
}

async function toggleSelectedDate() {
  if (!state.selectedDate) return;
  const day = getDayInfo(state.selectedDate);
  const nextState = !day.isBusinessDay;
  await updateBusinessDay(nextState);
}

async function updateBusinessDay(isBusinessDay) {
  const therapistId = Number(els.therapistFilter.value);
  els.toggleBusinessDay.disabled = true;
  showMessage(isBusinessDay ? "正在產生當天兩個可預約時段..." : "正在關閉當天尚未預約的時段...", "muted");

  try {
    const response = await fetch("/api/admin/schedules/day", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        therapistId,
        date: toDateKey(state.selectedDate),
        isBusinessDay
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);

    showMessage(isBusinessDay ? "已設為營業日。" : "已設為未營業。", "muted");
    await loadMonthData();
  } catch (error) {
    showMessage(`更新失敗：${error.message}`, "error");
    renderSelectedDate();
  }
}

async function toggleSlot(slotKey) {
  const therapistId = Number(els.therapistFilter.value);
  const slot = fixedSlotsForDate(state.selectedDate).find((item) => item.key === slotKey);
  if (!slot) return;

  const schedule = state.schedules.find((item) => sameSlot(item, slot));
  const booked = hasBookedSlot(slot.start);
  if (booked) {
    showMessage("此時段已有預約，不能改為不可預約。", "error");
    return;
  }

  const nextState = !schedule?.isAvailable;
  showMessage(nextState ? "正在開放此時段..." : "正在關閉此時段...", "muted");

  try {
    const response = await fetch("/api/admin/schedules/slot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        therapistId,
        startTime: slot.start,
        endTime: slot.end,
        isAvailable: nextState
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);

    showMessage(nextState ? "此時段已開放可預約。" : "此時段已改為不可預約。", "muted");
    await loadMonthData();
  } catch (error) {
    showMessage(`時段更新失敗：${error.message}`, "error");
  }
}

function renderTherapistOptions() {
  els.therapistFilter.innerHTML = "";
  for (const therapist of state.therapists) {
    const label = `${therapist.therapistName} (${therapist.therapistCode})`;
    els.therapistFilter.append(new Option(label, therapist.id));
  }
}

function renderCalendar() {
  els.monthTitle.textContent = monthFormatter.format(state.currentMonth);
  els.calendarGrid.innerHTML = "";

  const firstDay = startOfMonth(state.currentMonth);
  const totalDays = endOfMonth(state.currentMonth).getDate();

  for (let index = 0; index < firstDay.getDay(); index++) {
    const spacer = document.createElement("div");
    spacer.className = "calendarDay spacer";
    els.calendarGrid.append(spacer);
  }

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), day);
    const info = getDayInfo(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "calendarDay",
      info.isBusinessDay ? "open" : "closed",
      info.hasBooked ? "hasBooked" : "",
      sameDate(date, state.selectedDate) ? "selected" : ""
    ].filter(Boolean).join(" ");
    button.innerHTML = `
      <span class="dayNumber">${day}</span>
      <span class="dayStatus">${info.isBusinessDay ? "營業" : "未營業"}</span>
      <span class="daySlots">${info.openSlots}/2 時段</span>
    `;
    button.addEventListener("click", () => {
      state.selectedDate = date;
      renderCalendar();
      renderSelectedDate();
    });
    els.calendarGrid.append(button);
  }
}

function renderSelectedDate() {
  if (!state.selectedDate) {
    els.selectedDateTitle.textContent = "請選擇日期";
    els.selectedDateSummary.textContent = "點擊月曆中的日期，查看與切換當天營業狀態。";
    els.toggleBusinessDay.textContent = "設為營業日";
    els.toggleBusinessDay.disabled = true;
    els.daySlotList.innerHTML = `<li>尚未選擇日期</li>`;
    return;
  }

  const info = getDayInfo(state.selectedDate);
  els.selectedDateTitle.textContent = dateFormatter.format(state.selectedDate);
  els.selectedDateSummary.textContent = info.isBusinessDay
    ? `當天目前開放 ${info.openSlots} 個時段。也可以直接點下方單一時段切換。`
    : "當天未營業。可設為營業日，或直接點下方單一時段開放。";
  els.toggleBusinessDay.textContent = info.isBusinessDay ? "設為未營業" : "設為營業日";
  els.toggleBusinessDay.disabled = !Number(els.therapistFilter.value);

  const slots = fixedSlotsForDate(state.selectedDate);
  els.daySlotList.innerHTML = "";
  for (const slot of slots) {
    const schedule = state.schedules.find((item) => sameSlot(item, slot));
    const booked = hasBookedSlot(slot.start);
    const available = Boolean(schedule?.isAvailable);
    const label = booked ? "已有預約" : available ? "可預約" : "不可預約";
    const status = booked ? "booked" : available ? "open" : "closed";
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${slot.label}</span>
      <button class="slotToggle ${status}" type="button" data-slot="${slot.key}" ${booked ? "disabled" : ""}>${label}</button>
    `;
    els.daySlotList.append(li);
  }

  document.querySelectorAll(".slotToggle").forEach((button) => {
    button.addEventListener("click", () => toggleSlot(button.dataset.slot));
  });
}

function getDayInfo(date) {
  const slots = fixedSlotsForDate(date);
  const openSlots = slots.filter((slot) => state.schedules.some((item) => sameSlot(item, slot) && item.isAvailable)).length;
  const hasBooked = slots.some((slot) => hasBookedSlot(slot.start));
  return { openSlots, hasBooked, isBusinessDay: openSlots > 0 || hasBooked };
}

function fixedSlotsForDate(date) {
  const key = toDateKey(date);
  return [
    { key: `${key}-morning`, start: `${key}T09:00:00`, end: `${key}T11:00:00`, label: "09:00-11:00" },
    { key: `${key}-afternoon`, start: `${key}T14:00:00`, end: `${key}T16:00:00`, label: "14:00-16:00" }
  ];
}

function sameSlot(schedule, slot) {
  return minuteKey(schedule.startTime) === minuteKey(slot.start) && minuteKey(schedule.endTime) === minuteKey(slot.end);
}

function hasBookedSlot(start) {
  const key = minuteKey(start);
  return state.appointments.some((booking) => minuteKey(booking.startTime) === key && normalizeStatus(booking.status) !== "cancelled");
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function sameDate(left, right) {
  return !!right && toDateKey(left) === toDateKey(right);
}

function toDateKey(date) {
  const value = date instanceof Date ? date : new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function minuteKey(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return match ? `${match[1]}${match[2]}${match[3]}${match[4]}${match[5]}` : "";
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function showMessage(text, type) {
  els.message.textContent = text;
  els.message.className = `formMessage ${type}`;
  els.message.hidden = false;
}

function hideMessage() {
  els.message.hidden = true;
}
