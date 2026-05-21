const bookingState = {
  services: [],
  slots: []
};

const bookingEls = {
  form: document.querySelector("#bookingForm"),
  service: document.querySelector("#serviceSelect"),
  schedule: document.querySelector("#scheduleSelect"),
  availableCount: document.querySelector("#availableCount"),
  message: document.querySelector("#formMessage"),
  summaryService: document.querySelector("#summaryService"),
  summaryPrice: document.querySelector("#summaryPrice"),
  summaryTime: document.querySelector("#summaryTime"),
  summaryTherapist: document.querySelector("#summaryTherapist")
};

const bookingMoney = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
});

bookingEls.service.addEventListener("change", updateSummary);
bookingEls.schedule.addEventListener("change", updateSummary);
bookingEls.form.addEventListener("submit", submitBooking);

loadBookingOptions();

async function loadBookingOptions() {
  showMessage("正在載入服務與可預約時段...", "muted");

  try {
    const [servicesResponse, slotsResponse] = await Promise.all([
      fetch("/api/services"),
      fetch("/api/booking-slots")
    ]);

    if (!servicesResponse.ok || !slotsResponse.ok) {
      throw new Error("無法載入預約選項");
    }

    bookingState.services = await servicesResponse.json();
    bookingState.slots = await slotsResponse.json();
    renderServiceOptions();
    renderSlotOptions();
    updateSummary();
    hideMessage();
  } catch (error) {
    showMessage(`載入失敗：${error.message}`, "error");
  }
}

async function submitBooking(event) {
  event.preventDefault();
  const formData = new FormData(bookingEls.form);

  const payload = {
    serviceId: Number(formData.get("serviceId")),
    slotId: String(formData.get("slotId") || ""),
    customerName: String(formData.get("customerName") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    note: String(formData.get("note") || "").trim()
  };

  showMessage("正在送出預約...", "muted");
  bookingEls.form.querySelector("button[type='submit']").disabled = true;

  try {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || `HTTP ${response.status}`);
    }

    location.href = `/booking-success?appointmentNo=${encodeURIComponent(result.booking.appointmentNo)}`;
  } catch (error) {
    showMessage(`預約失敗：${error.message}`, "error");
  } finally {
    bookingEls.form.querySelector("button[type='submit']").disabled = false;
  }
}

function renderServiceOptions() {
  bookingEls.service.innerHTML = `<option value="">請選擇服務</option>`;
  for (const service of bookingState.services) {
    const option = document.createElement("option");
    option.value = service.id;
    option.textContent = `${service.serviceName} - ${service.durationMinutes} 分 - ${bookingMoney.format(service.price)}`;
    bookingEls.service.append(option);
  }
}

function renderSlotOptions() {
  bookingEls.schedule.innerHTML = `<option value="">請選擇時段</option>`;
  bookingEls.availableCount.textContent = bookingState.slots.length;

  for (const slot of bookingState.slots) {
    const option = document.createElement("option");
    option.value = slot.slotId;
    option.textContent = `${formatRange(slot.startTime, slot.endTime)} / ${slot.therapistName}`;
    bookingEls.schedule.append(option);
  }
}

function updateSummary() {
  const service = bookingState.services.find((item) => String(item.id) === bookingEls.service.value);
  const slot = bookingState.slots.find((item) => item.slotId === bookingEls.schedule.value);

  bookingEls.summaryService.textContent = service?.serviceName ?? "尚未選擇";
  bookingEls.summaryPrice.textContent = service ? bookingMoney.format(service.price) : "-";
  bookingEls.summaryTime.textContent = slot ? formatRange(slot.startTime, slot.endTime) : "尚未選擇";
  bookingEls.summaryTherapist.textContent = slot?.therapistName ?? "尚未選擇";
}

function formatRange(start, end) {
  return `${formatDateTime(start)} - ${formatClock(end)}`;
}

function showMessage(text, type) {
  bookingEls.message.textContent = text;
  bookingEls.message.className = `formMessage ${type}`;
  bookingEls.message.hidden = false;
}

function hideMessage() {
  bookingEls.message.hidden = true;
}

function formatDateTime(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[2]}/${match[3]} ${match[4]}` : new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatClock(value) {
  const match = String(value).match(/T(\d{2}:\d{2})/);
  return match ? match[1] : new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}
