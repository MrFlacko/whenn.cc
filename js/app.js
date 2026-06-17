const eventTimeEl = document.getElementById("eventTime");
const eventDateEl = document.getElementById("eventDate");
const eventLocationEl = document.getElementById("eventLocation");
const eventTimeLabelEl = document.getElementById("eventTimeLabel");
const localTimeLabelEl = document.getElementById("localTimeLabel");
const localTimeEl = document.getElementById("localTime");
const localDateEl = document.getElementById("localDate");
const locationEl = document.getElementById("location");
const countdownDays = document.getElementById("countdownDays");
const countdownHours = document.getElementById("countdownHours");
const countdownMinutes = document.getElementById("countdownMinutes");
const countdownSeconds = document.getElementById("countdownSeconds");
const countdownStatus = document.getElementById("countdownStatus");
const countrySelect = document.getElementById("countrySelect");
const citySelect = document.getElementById("citySelect");
const dateInput = document.getElementById("dateInput");
const datePickerButton = document.getElementById("datePickerButton");
const datePickerLabel = document.getElementById("datePickerLabel");
const datePopover = document.getElementById("datePopover");
const datePickerReadout = document.getElementById("datePickerReadout");
const calendarYearLabel = document.getElementById("calendarYearLabel");
const calendarMonthLabel = document.getElementById("calendarMonthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const timeInput = document.getElementById("timeInput");
const timePickerButton = document.getElementById("timePickerButton");
const timePickerLabel = document.getElementById("timePickerLabel");
const timePopover = document.getElementById("timePopover");
const pickerReadout = document.getElementById("pickerReadout");
const hourValue = document.getElementById("hourValue");
const minuteValue = document.getElementById("minuteValue");
const hourDial = document.getElementById("hourDial");
const hourHand = document.getElementById("hourHand");
const minuteHand = document.getElementById("minuteHand");
const ampmToggle = document.getElementById("ampmToggle");
const mobileHourWheel = document.getElementById("mobileHourWheel");
const mobileMinuteWheel = document.getElementById("mobileMinuteWheel");
const mobileAmpmToggle = document.getElementById("mobileAmpmToggle");
const mobileTimeOptions = document.querySelector(".mobile-time-options");
const manualCountrySelect = document.getElementById("manualCountrySelect");
const manualCitySelect = document.getElementById("manualCitySelect");
const creatorForm = document.getElementById("creatorForm");
const resultPanel = document.getElementById("resultPanel");
const createdLink = document.getElementById("createdLink");
const createCopyButton = document.getElementById("createCopyButton");

const countries = linkyData.countries || [];
let pickerHour = 9;
let pickerMinute = 0;
let activeTimezone = getBrowserTimezone();
let pickerMode = "hour";
let hourFormat = "12";
let manualCountries = countries;
let calendarCursor = new Date();
let countdownTarget = null;
let lockedScrollY = 0;
let wheelSyncing = false;
let hourWheelGesture = null;
let hourWheelPosition = 0;
let hourWheelAnimationFrame = null;
let suppressHourClick = false;
let minuteWheelGesture = null;
let minuteWheelPosition = 0;
let minuteWheelAnimationFrame = null;
let suppressMinuteClick = false;
const hourWheelItemGap = 42;
const hourWheelDragThreshold = 4;
const hourWheelCenterThreshold = 0.16;
const hourWheelMomentumMs12 = 235;
const hourWheelMomentumMs24 = 255;
const minuteWheelItemGap = 34;
const minuteWheelDragThreshold = 4;
const minuteWheelCenterThreshold = 0.14;
const minuteWheelMomentumMs = 300;

function pad(value) {
    return String(value).padStart(2, "0");
}

function toDisplayDate(date) {
    return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

async function getIpTimezone() {
    try {
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();

        if (data.timezone && isValidTimezone(data.timezone)) {
            return data.timezone;
        }
    } catch (error) {}

    return getBrowserTimezone();
}

function toInputDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromInputValue(value) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day);
}

function formatDateButton(value) {
    if (!value) {
        return "Select date";
    }

    return dateFromInputValue(value).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function toLinkDate(value) {
    const [year, month, day] = value.split("-");
    return `${day}-${month}-${year}`;
}

function isValidTimezone(timezone) {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
        return true;
    } catch (error) {
        return false;
    }
}

function getBrowserTimezone() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return isValidTimezone(timezone) ? timezone : "UTC";
}

function formatTimeValue(value) {
    const [hour, minute] = value.split(":");

    return `${hour}:${minute}`;
}

function setTimeValue(hour, minute) {
    const totalMinutes = (hour * 60) + minute;
    const normalized = ((totalMinutes % 1440) + 1440) % 1440;
    pickerHour = Math.floor(normalized / 60);
    pickerMinute = normalized % 60;
    timeInput.value = `${pad(pickerHour)}:${pad(pickerMinute)}`;
    timePickerLabel.textContent = formatTimeValue(timeInput.value);
    pickerReadout.textContent = `${pad(pickerHour)}:${pad(pickerMinute)}`;
    hourValue.textContent = hourFormat === "12" ? pad(((pickerHour + 11) % 12) + 1) : pad(pickerHour);
    minuteValue.textContent = pad(pickerMinute);
    hourHand.style.transform = `translateX(-50%) rotate(${hourFormat === "24" ? pickerHour * 15 : (pickerHour % 12) * 30}deg)`;
    minuteHand.style.transform = `translateX(-50%) rotate(${pickerMinute * 6}deg)`;
    updateAmPmButtons();
    updateMobileWheels();
}

function setPickerMode(mode) {
    pickerMode = mode;
    hourValue.classList.toggle("is-active", mode === "hour");
    minuteValue.classList.toggle("is-active", mode === "minute");
}

function adjustMinute(direction) {
    setTimeValue(pickerHour, pickerMinute + direction);
}

function updateAmPmButtons() {
    for (const button of ampmToggle.querySelectorAll("button")) {
        button.classList.toggle("is-active", button.dataset.ampm === (pickerHour >= 12 ? "PM" : "AM"));
    }

    for (const button of mobileAmpmToggle.querySelectorAll("button")) {
        button.classList.toggle("is-active", button.dataset.mobileAmpm === (pickerHour >= 12 ? "PM" : "AM"));
    }
}

function setHourFormat(format) {
    hourFormat = format;
    hourDial.classList.toggle("hour-mode-12", format === "12");
    hourDial.classList.toggle("hour-mode-24", format === "24");
    ampmToggle.classList.toggle("is-visible", format === "12");
    mobileAmpmToggle.classList.toggle("is-hidden", format === "24");
    mobileTimeOptions.classList.toggle("is-24-hour", format === "24");
    populateMobileHourWheel();

    for (const button of document.querySelectorAll("[data-hour-format]")) {
        button.classList.toggle("is-active", button.dataset.hourFormat === format);
    }

    setTimeValue(pickerHour, pickerMinute);
    updateMobileWheels(true);
}

function setAmPm(value) {
    const hour12 = pickerHour % 12;
    setTimeValue(value === "PM" ? hour12 + 12 : hour12, pickerMinute);
}

function lockPageScroll() {
    if (document.body.classList.contains("is-modal-locked")) {
        return;
    }

    lockedScrollY = window.scrollY;
    document.body.classList.add("is-modal-locked");
    document.documentElement.classList.add("is-modal-locked");
}

function unlockPageScroll() {
    if (!document.body.classList.contains("is-modal-locked")) {
        return;
    }

    document.body.classList.remove("is-modal-locked");
    document.documentElement.classList.remove("is-modal-locked");
    window.scrollTo(0, lockedScrollY);
}

function populateTimeWheel(wheel, values) {
    wheel.replaceChildren();

    for (const value of values) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.value = String(value.value);
        button.textContent = value.label;
        wheel.append(button);
    }
}

function mobileHourValues() {
    return Array.from({ length: hourFormat === "12" ? 12 : 24 }, (_, index) => (
        hourFormat === "12" ? index + 1 : index
    ));
}

function mobileDisplayHour() {
    return hourFormat === "12" ? ((pickerHour + 11) % 12) + 1 : pickerHour;
}

function populateMobileHourWheel() {
    populateTimeWheel(
        mobileHourWheel,
        mobileHourValues().map((value) => ({
            value,
            label: pad(value)
        }))
    );
    setHourWheelPositionFromValue(mobileDisplayHour());
}

function mobileMinuteValues() {
    return Array.from({ length: 60 }, (_, index) => index);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function projectedWheelTarget(position, velocity, values, momentumMs, maxItems, snapThreshold = 0.5) {
    const coastDistance = clamp(velocity * momentumMs, -maxItems, maxItems);
    const projected = position + coastDistance;
    const lower = Math.floor(projected);
    const upper = Math.ceil(projected);
    const fraction = projected - lower;

    if (velocity > 0.001) {
        return clamp(fraction >= snapThreshold ? upper : lower, 0, values.length - 1);
    }

    if (velocity < -0.001) {
        return clamp(fraction <= 1 - snapThreshold ? lower : upper, 0, values.length - 1);
    }

    return clamp(Math.round(projected), 0, values.length - 1);
}

function smootherStep(progress) {
    return progress * progress * progress * (progress * ((progress * 6) - 15) + 10);
}

function hourWheelMomentumMs() {
    return hourFormat === "24" ? hourWheelMomentumMs24 : hourWheelMomentumMs12;
}

function hourWheelMaxVelocity() {
    return hourFormat === "24" ? 0.033 : 0.028;
}

function hourWheelPixelsPerHour() {
    return hourFormat === "24" ? 41 : 48;
}

function renderHourWheel() {
    const selectedIndex = Math.round(hourWheelPosition);

    for (const [index, button] of [...mobileHourWheel.querySelectorAll("button")].entries()) {
        const offset = index - hourWheelPosition;
        const distance = Math.abs(offset);
        const centered = index === selectedIndex && distance <= hourWheelCenterThreshold;
        const scale = 0.94 + (Math.max(0, 1 - distance) * 0.12);

        button.classList.toggle("is-selected", centered);
        button.style.transform = `translateY(calc(-50% + ${offset * hourWheelItemGap}px)) scale(${scale})`;
        button.style.opacity = String(Math.max(0, 1 - (distance * 0.2)));
        button.style.pointerEvents = distance <= 2.4 ? "auto" : "none";
    }
}

function animateHourWheelTo(targetPosition, commit = true, initialVelocity = 0) {
    if (hourWheelAnimationFrame) {
        cancelAnimationFrame(hourWheelAnimationFrame);
    }

    const values = mobileHourValues();
    const clampedTarget = Math.max(0, Math.min(values.length - 1, targetPosition));
    const startPosition = hourWheelPosition;
    const distance = Math.abs(clampedTarget - startPosition);
    const duration = hourFormat === "24"
        ? clamp(110 + (distance * 36) - (Math.abs(initialVelocity) * 580), 100, 215)
        : clamp(120 + (distance * 50) - (Math.abs(initialVelocity) * 700), 110, 230);
    let startedAt = 0;

    function step(now) {
        if (!startedAt) {
            startedAt = now;
        }

        const progress = clamp((now - startedAt) / duration, 0, 1);
        const eased = smootherStep(progress);

        hourWheelPosition = startPosition + ((clampedTarget - startPosition) * eased);

        if (progress >= 1) {
            hourWheelPosition = clampedTarget;
            hourWheelAnimationFrame = null;
            renderHourWheel();

            if (commit) {
                setHourFromMobileValue(values[Math.round(hourWheelPosition)]);
            }

            return;
        }

        renderHourWheel();
        hourWheelAnimationFrame = requestAnimationFrame(step);
    }

    hourWheelAnimationFrame = requestAnimationFrame(step);
}

function coastHourWheel(releaseVelocity) {
    if (hourWheelAnimationFrame) {
        cancelAnimationFrame(hourWheelAnimationFrame);
    }

    const values = mobileHourValues();
    const maxCoast = Math.max(2.2, values.length * 0.22);
    const targetPosition = projectedWheelTarget(
        hourWheelPosition,
        releaseVelocity,
        values,
        hourWheelMomentumMs(),
        maxCoast
    );
    const direction = Math.sign(targetPosition - hourWheelPosition);
    let velocity = clamp(releaseVelocity, -hourWheelMaxVelocity(), hourWheelMaxVelocity());
    let lastAt = 0;

    if (!direction || Math.abs(velocity) < 0.001) {
        animateHourWheelTo(targetPosition);
        return;
    }

    function step(now) {
        const elapsed = lastAt ? Math.min(32, now - lastAt) : 16;
        lastAt = now;

        velocity *= Math.exp(-elapsed / hourWheelMomentumMs());
        hourWheelPosition = clamp(hourWheelPosition + (velocity * elapsed), 0, values.length - 1);

        const passedTarget = direction > 0 ? hourWheelPosition >= targetPosition : hourWheelPosition <= targetPosition;

        if (passedTarget || Math.abs(velocity) < 0.001) {
            animateHourWheelTo(targetPosition, true, velocity);
            return;
        }

        renderHourWheel();
        hourWheelAnimationFrame = requestAnimationFrame(step);
    }

    hourWheelAnimationFrame = requestAnimationFrame(step);
}

function renderMinuteWheel() {
    const selectedIndex = Math.round(minuteWheelPosition);

    for (const [index, button] of [...mobileMinuteWheel.querySelectorAll("button")].entries()) {
        const offset = index - minuteWheelPosition;
        const distance = Math.abs(offset);
        const centered = index === selectedIndex && distance <= minuteWheelCenterThreshold;
        const scale = 0.94 + (Math.max(0, 1 - distance) * 0.12);

        button.classList.toggle("is-selected", centered);
        button.style.transform = `translateY(calc(-50% + ${offset * minuteWheelItemGap}px)) scale(${scale})`;
        button.style.opacity = String(Math.max(0, 1 - (distance * 0.08)));
        button.style.pointerEvents = distance <= 3.2 ? "auto" : "none";
    }
}

function animateMinuteWheelTo(targetPosition, commit = true, initialVelocity = 0) {
    if (minuteWheelAnimationFrame) {
        cancelAnimationFrame(minuteWheelAnimationFrame);
    }

    const values = mobileMinuteValues();
    const clampedTarget = Math.max(0, Math.min(values.length - 1, targetPosition));
    const startPosition = minuteWheelPosition;
    const distance = Math.abs(clampedTarget - startPosition);
    const duration = clamp(155 + (distance * 24) - (Math.abs(initialVelocity) * 420), 140, 320);
    let startedAt = 0;

    function step(now) {
        if (!startedAt) {
            startedAt = now;
        }

        const progress = clamp((now - startedAt) / duration, 0, 1);
        const eased = smootherStep(progress);

        minuteWheelPosition = startPosition + ((clampedTarget - startPosition) * eased);

        if (progress >= 1) {
            minuteWheelPosition = clampedTarget;
            minuteWheelAnimationFrame = null;
            renderMinuteWheel();

            if (commit) {
                setMinuteFromMobileValue(values[Math.round(minuteWheelPosition)]);
            }

            return;
        }

        renderMinuteWheel();
        minuteWheelAnimationFrame = requestAnimationFrame(step);
    }

    minuteWheelAnimationFrame = requestAnimationFrame(step);
}

function coastMinuteWheel(releaseVelocity) {
    if (minuteWheelAnimationFrame) {
        cancelAnimationFrame(minuteWheelAnimationFrame);
    }

    const values = mobileMinuteValues();
    const targetPosition = projectedWheelTarget(
        minuteWheelPosition,
        releaseVelocity,
        values,
        minuteWheelMomentumMs,
        values.length * 0.2,
        0.78
    );
    const direction = Math.sign(targetPosition - minuteWheelPosition);
    let velocity = clamp(releaseVelocity, -0.038, 0.038);
    let lastAt = 0;

    if (!direction || Math.abs(velocity) < 0.001) {
        animateMinuteWheelTo(targetPosition);
        return;
    }

    function step(now) {
        const elapsed = lastAt ? Math.min(32, now - lastAt) : 16;
        lastAt = now;

        velocity *= Math.exp(-elapsed / minuteWheelMomentumMs);
        minuteWheelPosition = clamp(minuteWheelPosition + (velocity * elapsed), 0, values.length - 1);

        const passedTarget = direction > 0 ? minuteWheelPosition >= targetPosition : minuteWheelPosition <= targetPosition;

        if (passedTarget || Math.abs(velocity) < 0.001) {
            animateMinuteWheelTo(targetPosition, true, velocity);
            return;
        }

        renderMinuteWheel();
        minuteWheelAnimationFrame = requestAnimationFrame(step);
    }

    minuteWheelAnimationFrame = requestAnimationFrame(step);
}

function setMinuteWheelPositionFromValue(value, animate = false) {
    const values = mobileMinuteValues();
    const index = values.indexOf(value);

    if (index === -1) {
        return;
    }

    if (animate) {
        animateMinuteWheelTo(index, false);
        return;
    }

    if (minuteWheelAnimationFrame) {
        cancelAnimationFrame(minuteWheelAnimationFrame);
        minuteWheelAnimationFrame = null;
    }

    minuteWheelPosition = index;
    renderMinuteWheel();
}

function setHourWheelPositionFromValue(value, animate = false) {
    const values = mobileHourValues();
    const index = values.indexOf(value);

    if (index === -1) {
        return;
    }

    if (animate) {
        animateHourWheelTo(index, false);
        return;
    }

    if (hourWheelAnimationFrame) {
        cancelAnimationFrame(hourWheelAnimationFrame);
        hourWheelAnimationFrame = null;
    }

    hourWheelPosition = index;
    renderHourWheel();
}

function updateMobileWheels(scroll = false) {
    if (!mobileHourWheel || !mobileMinuteWheel || (wheelSyncing && !scroll)) {
        return;
    }

    const displayHour = mobileDisplayHour();

    setHourWheelPositionFromValue(displayHour, scroll);
    setMinuteWheelPositionFromValue(pickerMinute, scroll);

    if (scroll) {
        wheelSyncing = true;
        requestAnimationFrame(() => {
            wheelSyncing = false;
        });
    }
}

function setHourFromMobileValue(value) {
    const base = pickerHour >= 12 ? 12 : 0;
    setTimeValue(hourFormat === "12" ? base + (value % 12) : value, pickerMinute);
}

function setMinuteFromMobileValue(value) {
    setTimeValue(pickerHour, value);
}

function startHourWheelGesture(event) {
    if (hourWheelAnimationFrame) {
        cancelAnimationFrame(hourWheelAnimationFrame);
        hourWheelAnimationFrame = null;
    }

    const touch = event.touches[0];

    hourWheelGesture = {
        active: true,
        moved: false,
        startPosition: hourWheelPosition,
        startY: touch.clientY,
        lastY: touch.clientY,
        lastAt: Date.now(),
        totalDistance: 0,
        velocity: 0
    };
}

function moveHourWheelGesture(event) {
    if (!hourWheelGesture) {
        return;
    }

    event.preventDefault();

    const touch = event.touches[0];
    const now = Date.now();
    const elapsed = Math.max(1, now - hourWheelGesture.lastAt);
    const delta = hourWheelGesture.lastY - touch.clientY;
    const pixelsPerHour = hourWheelPixelsPerHour();
    const values = mobileHourValues();
    const rawPosition = hourWheelGesture.startPosition + ((hourWheelGesture.startY - touch.clientY) / pixelsPerHour);
    const minPosition = -0.3;
    const maxPosition = values.length - 0.7;
    const clampedPosition = Math.max(minPosition, Math.min(maxPosition, rawPosition));

    hourWheelPosition = Math.max(0, Math.min(values.length - 1, clampedPosition));
    hourWheelGesture.totalDistance += Math.abs(delta);
    const velocity = delta / elapsed / pixelsPerHour;

    hourWheelGesture.velocity = (hourWheelGesture.velocity * 0.35) + (velocity * 0.65);
    hourWheelGesture.lastY = touch.clientY;
    hourWheelGesture.lastAt = now;
    hourWheelGesture.moved = hourWheelGesture.totalDistance > hourWheelDragThreshold;
    renderHourWheel();
}

function finishHourWheelGesture(useMomentum = true) {
    if (!hourWheelGesture) {
        return;
    }

    const releaseVelocity = useMomentum ? hourWheelGesture.velocity : 0;
    suppressHourClick = hourWheelGesture.moved;
    hourWheelGesture.active = false;
    hourWheelGesture = null;
    coastHourWheel(releaseVelocity);

    window.setTimeout(() => {
        suppressHourClick = false;
    }, 250);
}

function startMinuteWheelGesture(event) {
    if (minuteWheelAnimationFrame) {
        cancelAnimationFrame(minuteWheelAnimationFrame);
        minuteWheelAnimationFrame = null;
    }

    const touch = event.touches[0];

    minuteWheelGesture = {
        moved: false,
        startPosition: minuteWheelPosition,
        startY: touch.clientY,
        lastY: touch.clientY,
        lastAt: Date.now(),
        totalDistance: 0,
        velocity: 0
    };
}

function moveMinuteWheelGesture(event) {
    if (!minuteWheelGesture) {
        return;
    }

    event.preventDefault();

    const touch = event.touches[0];
    const now = Date.now();
    const elapsed = Math.max(1, now - minuteWheelGesture.lastAt);
    const delta = minuteWheelGesture.lastY - touch.clientY;
    const pixelsPerMinute = 34;
    const values = mobileMinuteValues();
    const rawPosition = minuteWheelGesture.startPosition + ((minuteWheelGesture.startY - touch.clientY) / pixelsPerMinute);
    const clampedPosition = Math.max(-0.45, Math.min(values.length - 0.55, rawPosition));

    minuteWheelPosition = Math.max(0, Math.min(values.length - 1, clampedPosition));
    minuteWheelGesture.totalDistance += Math.abs(delta);
    const velocity = delta / elapsed / pixelsPerMinute;

    minuteWheelGesture.velocity = (minuteWheelGesture.velocity * 0.35) + (velocity * 0.65);
    minuteWheelGesture.lastY = touch.clientY;
    minuteWheelGesture.lastAt = now;
    minuteWheelGesture.moved = minuteWheelGesture.totalDistance > minuteWheelDragThreshold;
    renderMinuteWheel();
}

function finishMinuteWheelGesture(useMomentum = true) {
    if (!minuteWheelGesture) {
        return;
    }

    const releaseVelocity = useMomentum ? minuteWheelGesture.velocity : 0;
    suppressMinuteClick = minuteWheelGesture.moved;
    minuteWheelGesture = null;
    coastMinuteWheel(releaseVelocity);

    window.setTimeout(() => {
        suppressMinuteClick = false;
    }, 250);
}

function degreesFromDial(event, dial) {
    const rect = dial.getBoundingClientRect();
    const centerX = rect.left + (rect.width / 2);
    const centerY = rect.top + (rect.height / 2);
    const point = event.touches?.[0] || event;
    const angle = Math.atan2(point.clientY - centerY, point.clientX - centerX);

    return (angle * 180 / Math.PI + 450) % 360;
}

function setTimeFromDial(event, mode = event.currentTarget.dataset.pickerMode) {
    const degrees = degreesFromDial(event, event.currentTarget);

    if (mode === "hour") {
        if (hourFormat === "12") {
            const hour12 = Math.round(degrees / 30) % 12;
            const base = pickerHour >= 12 ? 12 : 0;
            setTimeValue(base + hour12, pickerMinute);
        } else {
            setTimeValue(Math.round(degrees / 15) % 24, pickerMinute);
        }
        setPickerMode("hour");
        return;
    }

    setTimeValue(pickerHour, Math.round(degrees / 6) % 60);
    setPickerMode("minute");
}

function startDialDrag(event) {
    const dial = event.currentTarget;
    const mode = dial.dataset.pickerMode;
    setTimeFromDial(event, mode);
    dial.setPointerCapture?.(event.pointerId);

    function moveDial(pointerEvent) {
        setTimeFromDial(pointerEvent, mode);
    }

    function stopDialDrag() {
        dial.removeEventListener("pointermove", moveDial);
        dial.removeEventListener("pointerup", stopDialDrag);
        dial.removeEventListener("pointercancel", stopDialDrag);
    }

    dial.addEventListener("pointermove", moveDial);
    dial.addEventListener("pointerup", stopDialDrag);
    dial.addEventListener("pointercancel", stopDialDrag);
}

function syncPickerFromInput() {
    const [hour, minute] = (timeInput.value || "09:00").split(":").map(Number);
    setTimeValue(hour, minute);
}

function openTimePicker() {
    syncPickerFromInput();
    lockPageScroll();
    timePopover.inert = false;
    timePopover.classList.add("is-open");
    timePopover.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => updateMobileWheels(true));
}

function closeTimePicker() {
    if (timePopover.contains(document.activeElement)) {
        timePickerButton.focus({ preventScroll: true });
    }

    timePopover.classList.remove("is-open");
    timePopover.inert = true;
    timePopover.setAttribute("aria-hidden", "true");
    unlockPageScroll();
}

function setDateValue(value) {
    dateInput.value = value;
    datePickerLabel.textContent = formatDateButton(value);
    datePickerReadout.textContent = formatDateButton(value);
    updateCreator();
}

function renderCalendar() {
    const selectedDate = dateInput.value ? dateFromInputValue(dateInput.value) : new Date();
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(year, month, 1 - firstDay.getDay());
    const todayValue = toInputDate(new Date());
    const selectedValue = dateInput.value;

    calendarMonthLabel.textContent = calendarCursor.toLocaleDateString("en-US", {
        month: "long",
    });
    calendarYearLabel.textContent = String(year);
    calendarGrid.replaceChildren();

    for (let index = 0; index < 42; index += 1) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + index);

        const value = toInputDate(date);
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = String(date.getDate());
        button.classList.toggle("is-muted", date.getMonth() !== month);
        button.classList.toggle("is-today", value === todayValue);
        button.classList.toggle("is-selected", value === selectedValue);
        button.addEventListener("click", () => {
            setDateValue(value);
            calendarCursor = new Date(date);
            renderCalendar();
            closeDatePicker();
        });
        calendarGrid.append(button);
    }

    datePickerReadout.textContent = formatDateButton(toInputDate(selectedDate));
}

function openDatePicker() {
    calendarCursor = dateInput.value ? dateFromInputValue(dateInput.value) : new Date();
    renderCalendar();
    lockPageScroll();
    datePopover.inert = false;
    datePopover.classList.add("is-open");
    datePopover.setAttribute("aria-hidden", "false");
}

function closeDatePicker() {
    if (datePopover.contains(document.activeElement)) {
        datePickerButton.focus({ preventScroll: true });
    }

    datePopover.classList.remove("is-open");
    datePopover.inert = true;
    datePopover.setAttribute("aria-hidden", "true");
    unlockPageScroll();
}

function getTimeZoneOffset(date, timezone) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "shortOffset"
    }).formatToParts(date);
    const value = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
    const match = value.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);

    if (!match) {
        return 0;
    }

    const sign = match[1] === "-" ? -1 : 1;
    return sign * ((Number(match[2]) * 60) + Number(match[3] || 0));
}

function dateFromZonedTime(dateValue, timeValue, timezone) {
    const [year, month, day] = dateValue.split("-").map(Number);
    const [hour, minute] = timeValue.split(":").map(Number);
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
    const offset = getTimeZoneOffset(utcGuess, timezone);
    const firstPass = new Date(utcGuess.getTime() - (offset * 60 * 1000));
    const correctedOffset = getTimeZoneOffset(firstPass, timezone);

    return new Date(utcGuess.getTime() - (correctedOffset * 60 * 1000));
}

function selectedCountry() {
    return countries.find((country) => country.slug === countrySelect.value) || countries[0];
}

function selectedZone() {
    const country = selectedCountry();
    return country?.zones.find((zone) => zone.slug === citySelect.value) || country?.zones[0];
}

function buildLink(country, zone) {
    if (!country || !zone || !dateInput.value || !timeInput.value) {
        return "";
    }

    return `${window.location.origin}/${country.slug}/${zone.slug}/${toLinkDate(dateInput.value)}/${timeInput.value.replace(":", "")}`;
}

function renderGeneratedLink() {
    const link = buildLink(selectedCountry(), selectedZone());

    if (!link) {
        resultPanel.classList.remove("is-visible");
        return;
    }

    createdLink.href = link;
    createdLink.textContent = link.replace(/^https?:\/\//, "");
    createdLink.title = "Open preview link";
    resultPanel.classList.add("is-visible");
}

function renderConvertedTime(eventDate, timezone, displayLocation) {
    countdownTarget = eventDate;
    renderCountdown();
    eventTimeLabelEl.textContent = "Event Time";
    localTimeLabelEl.textContent = "Your Time";
    eventTimeEl.textContent = eventDate.toLocaleTimeString("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
    eventDateEl.textContent = eventDate.toLocaleDateString("en-US", {
        timeZone: timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    eventLocationEl.textContent = displayLocation;
    localTimeEl.textContent = eventDate.toLocaleTimeString("en-US", {
        timeZone: activeTimezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
    localDateEl.textContent = eventDate.toLocaleDateString("en-US", {
        timeZone: activeTimezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    locationEl.textContent = activeTimezone;
}

function renderCountdown() {
    if (!countdownTarget || !countdownDays) {
        return;
    }

    const remaining = countdownTarget.getTime() - Date.now();

    if (remaining <= 0) {
        countdownDays.textContent = "00";
        countdownHours.textContent = "00";
        countdownMinutes.textContent = "00";
        countdownSeconds.textContent = "00";
        if (countdownStatus) {
            countdownStatus.textContent = "Event started";
        }
        return;
    }

    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    countdownDays.textContent = String(days).padStart(2, "0");
    countdownHours.textContent = pad(hours);
    countdownMinutes.textContent = pad(minutes);
    countdownSeconds.textContent = pad(seconds);
    if (countdownStatus) {
        countdownStatus.textContent = "Until event";
    }
}

function renderError() {
    countdownTarget = null;
    eventTimeLabelEl.textContent = "Event Time";
    localTimeLabelEl.textContent = "Your Time";
    eventTimeEl.textContent = linkyData.error || "Invalid Link";
    eventDateEl.textContent = "Try the creator below, or check the spelling in the URL.";
    eventLocationEl.textContent = linkyData.city ? linkyData.city.replace(/[-_]+/g, " ") : "";
    localTimeEl.textContent = "--:--";
    localDateEl.textContent = "";
}

function renderEventPreview() {
    const country = selectedCountry();
    const zone = selectedZone();

    if (linkyData.hasEvent && country && zone && dateInput.value && timeInput.value) {
        renderConvertedTime(
            dateFromZonedTime(dateInput.value, timeInput.value, zone.timezone),
            zone.timezone,
            `${zone.label}, ${country.name}`
        );
    }
}

function renderSharedEvent() {
    if (linkyData.error || !linkyData.eventUtc || !linkyData.timezone) {
        renderError();
        return;
    }

    renderConvertedTime(new Date(linkyData.eventUtc), linkyData.timezone, linkyData.displayLocation);
}

function renderHomepageClock() {
    const now = new Date();

    eventTimeLabelEl.textContent = "Your Clock";
    eventTimeEl.textContent = now.toLocaleTimeString("en-US", {
        timeZone: activeTimezone,
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    });
    eventDateEl.textContent = now.toLocaleDateString("en-US", {
        timeZone: activeTimezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    eventLocationEl.textContent = activeTimezone;
}

function addOption(select, value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.append(option);
}

function populateCountries(select = countrySelect, source = countries) {
    select.replaceChildren();

    for (const country of source) {
        addOption(select, country.slug, country.name);
    }
}

function populateCities(countrySlug = countrySelect.value, select = citySelect, source = countries) {
    const country = source.find((item) => item.slug === countrySlug) || source[0];
    select.replaceChildren();

    for (const zone of country.zones) {
        addOption(select, zone.slug, zone.label);
    }
}

function findZoneByTimezone(timezone) {
    for (const country of countries) {
        const zone = country.zones.find((item) => item.timezone === timezone);

        if (zone) {
            return { country, zone };
        }
    }

    return null;
}

function selectedManualCountry() {
    return manualCountries.find((country) => country.slug === manualCountrySelect.value) || manualCountries[0];
}

function selectedManualZone() {
    const country = selectedManualCountry();
    return country?.zones.find((zone) => zone.slug === manualCitySelect.value) || country?.zones[0];
}

function updateManualTimezone() {
    const zone = selectedManualZone();

    if (!zone) {
        return;
    }

    activeTimezone = zone.timezone;

    if (linkyData.hasEvent) {
        renderSharedEvent();
    } else {
        renderHomepageClock();
    }
}

async function populateManualTimezones() {
    const detectedTimezone = await getIpTimezone();
    const match = findZoneByTimezone(detectedTimezone);

    manualCountries = countries;

    if (!match) {
        manualCountries = [{
            name: "Detected timezone",
            slug: "detected-timezone",
            zones: [{
                label: detectedTimezone,
                slug: "detected-timezone",
                timezone: detectedTimezone
            }]
        }, ...countries];
    }

    populateCountries(manualCountrySelect, manualCountries);

    manualCountrySelect.value = match ? match.country.slug : "detected-timezone";

    populateCities(manualCountrySelect.value, manualCitySelect, manualCountries);

    if (match) {
        manualCitySelect.value = match.zone.slug;
    }

    activeTimezone = detectedTimezone;
    updateManualTimezone();
}

function initExampleAccordion() {
    const accordion = document.querySelector(".examples-mobile-accordion");

    if (!accordion) {
        return;
    }

    const summary = accordion.querySelector("summary");
    const panel = accordion.querySelector(".examples-mobile-list");

    if (!summary || !panel) {
        return;
    }

    let isAnimating = false;
    let isClosing = false;

    function openPanel() {
        accordion.open = true;
        panel.style.height = "0px";

        requestAnimationFrame(() => {
            panel.style.height = `${panel.scrollHeight}px`;
        });
    }

    function closePanel() {
        panel.style.height = `${panel.scrollHeight}px`;

        requestAnimationFrame(() => {
            panel.style.height = "0px";
        });
    }

    panel.addEventListener("transitionend", (event) => {
        if (event.propertyName !== "height") {
            return;
        }

        if (isClosing) {
            accordion.open = false;
            panel.style.height = "0px";
            isClosing = false;
        } else if (accordion.open) {
            panel.style.height = "auto";
        } else {
            panel.style.height = "0px";
        }

        isAnimating = false;
    });

    summary.addEventListener("click", (event) => {
        event.preventDefault();

        if (isAnimating) {
            return;
        }

        isAnimating = true;

        if (accordion.open) {
            isClosing = true;
            closePanel();
            return;
        }

        isClosing = false;
        openPanel();
    });
}

function setInitialFormValues() {
    const now = new Date();
    const match = findZoneByTimezone(getBrowserTimezone());
    const defaultCountry = match?.country || countries.find((country) => country.code === "AU") || countries[0];
    const defaultZone = match?.zone || defaultCountry?.zones[0];

    dateInput.value = toInputDate(now);
    datePickerLabel.textContent = formatDateButton(dateInput.value);
    datePickerReadout.textContent = formatDateButton(dateInput.value);
    setTimeValue(now.getHours(), now.getMinutes());

    if (defaultCountry) {
        countrySelect.value = defaultCountry.slug;
        populateCities(defaultCountry.slug);
    }

    if (defaultZone) {
        citySelect.value = defaultZone.slug;
    }
}

function updateCreator() {
    renderGeneratedLink();

    if (linkyData.hasEvent) {
        renderEventPreview();
    }
}

async function copyGeneratedLink() {
    renderGeneratedLink();

    if (!createdLink.href) {
        return;
    }

    createCopyButton.classList.remove("is-flashing");
    createCopyButton.classList.remove("is-success");
    createCopyButton.getBoundingClientRect();
    createCopyButton.classList.add("is-flashing");

    try {
        await navigator.clipboard.writeText(createdLink.href);
        createCopyButton.textContent = "Copied!";
        createCopyButton.classList.add("is-success");
    } catch (error) {
        createCopyButton.textContent = "Link Created";
    }

    setTimeout(() => {
        createCopyButton.textContent = "Copy Invite Link";
        createCopyButton.classList.remove("is-flashing");
        createCopyButton.classList.remove("is-success");
    }, 900);
}

function openLinkedSelect(select) {
    if (!select) {
        return;
    }

    select.focus({ preventScroll: true });
    select.classList.add("is-active");

    if (typeof select.showPicker === "function") {
        try {
            select.showPicker();
            return;
        } catch (error) {}
    }
}

function initSelectInteractions() {
    for (const select of document.querySelectorAll("select")) {
        select.addEventListener("focus", () => {
            select.classList.add("is-active");
        });

        select.addEventListener("blur", () => {
            select.classList.remove("is-active");
        });

        select.addEventListener("change", () => {
            window.setTimeout(() => {
                select.classList.remove("is-active");
                select.blur();
            }, 0);
        });

        select.addEventListener("keydown", (event) => {
            if (event.key === "Escape" || event.key === "Tab") {
                select.classList.remove("is-active");
            }
        });
    }
}

function initTimePicker() {
    timePopover.inert = true;
    populateTimeWheel(
        mobileMinuteWheel,
        Array.from({ length: 60 }, (_, index) => ({
            value: index,
            label: pad(index)
        }))
    );
    setMinuteWheelPositionFromValue(pickerMinute);

    setPickerMode("hour");
    setHourFormat("12");
    timePickerButton.addEventListener("click", openTimePicker);
    hourDial.addEventListener("pointerdown", startDialDrag);
    document.getElementById("minuteDial").addEventListener("pointerdown", startDialDrag);
    hourValue.addEventListener("click", () => setPickerMode("hour"));
    minuteValue.addEventListener("click", () => setPickerMode("minute"));
    document.getElementById("timePickerClose").addEventListener("click", closeTimePicker);
    document.getElementById("timePickerCancel").addEventListener("click", closeTimePicker);
    document.getElementById("timePickerDone").addEventListener("click", () => {
        closeTimePicker();
        updateCreator();
        renderEventPreview();
    });
    document.getElementById("hourUp").addEventListener("click", () => setTimeValue(pickerHour + 1, pickerMinute));
    document.getElementById("hourDown").addEventListener("click", () => setTimeValue(pickerHour - 1, pickerMinute));
    document.getElementById("minuteUp").addEventListener("click", () => adjustMinute(1));
    document.getElementById("minuteDown").addEventListener("click", () => adjustMinute(-1));

    for (const button of document.querySelectorAll("[data-hour-format]")) {
        button.addEventListener("click", () => setHourFormat(button.dataset.hourFormat));
    }

    for (const button of ampmToggle.querySelectorAll("button")) {
        button.addEventListener("click", () => setAmPm(button.dataset.ampm));
    }

    for (const button of mobileAmpmToggle.querySelectorAll("button")) {
        button.addEventListener("click", () => setAmPm(button.dataset.mobileAmpm));
    }

    mobileHourWheel.addEventListener("touchstart", startHourWheelGesture, { passive: true });
    mobileHourWheel.addEventListener("touchmove", moveHourWheelGesture, { passive: false });
    mobileHourWheel.addEventListener("touchend", () => finishHourWheelGesture(true));
    mobileHourWheel.addEventListener("touchcancel", () => finishHourWheelGesture(false));
    mobileHourWheel.addEventListener("click", (event) => {
        const button = event.target.closest("button");

        if (!button || suppressHourClick) {
            return;
        }

        const values = mobileHourValues();
        const targetIndex = values.indexOf(Number(button.dataset.value));

        if (targetIndex !== -1) {
            animateHourWheelTo(targetIndex);
        }
    });

    mobileMinuteWheel.addEventListener("touchstart", startMinuteWheelGesture, { passive: true });
    mobileMinuteWheel.addEventListener("touchmove", moveMinuteWheelGesture, { passive: false });
    mobileMinuteWheel.addEventListener("touchend", () => finishMinuteWheelGesture(true));
    mobileMinuteWheel.addEventListener("touchcancel", () => finishMinuteWheelGesture(false));
    mobileMinuteWheel.addEventListener("click", (event) => {
        const button = event.target.closest("button");

        if (!button || suppressMinuteClick) {
            return;
        }

        animateMinuteWheelTo(Number(button.dataset.value));
    });

    for (const button of document.querySelectorAll("[data-minute]")) {
        button.addEventListener("click", () => {
            setPickerMode("minute");
            setTimeValue(pickerHour, Number(button.dataset.minute));
            updateMobileWheels(true);
        });
    }

    timePopover.addEventListener("click", (event) => {
        if (event.target === timePopover) {
            closeTimePicker();
        }
    });
}

function initDatePicker() {
    datePopover.inert = true;
    datePickerButton.addEventListener("click", openDatePicker);
    document.getElementById("datePickerClose").addEventListener("click", closeDatePicker);
    document.getElementById("datePickerCancel").addEventListener("click", closeDatePicker);
    document.getElementById("datePickerToday").addEventListener("click", () => {
        const today = new Date();
        calendarCursor = today;
        setDateValue(toInputDate(today));
        renderCalendar();
        closeDatePicker();
    });
    document.getElementById("prevMonthButton").addEventListener("click", () => {
        calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
        renderCalendar();
    });
    document.getElementById("nextMonthButton").addEventListener("click", () => {
        calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
        renderCalendar();
    });
    document.getElementById("prevYearButton").addEventListener("click", () => {
        calendarCursor = new Date(calendarCursor.getFullYear() - 1, calendarCursor.getMonth(), 1);
        renderCalendar();
    });
    document.getElementById("nextYearButton").addEventListener("click", () => {
        calendarCursor = new Date(calendarCursor.getFullYear() + 1, calendarCursor.getMonth(), 1);
        renderCalendar();
    });

    datePopover.addEventListener("click", (event) => {
        if (event.target === datePopover) {
            closeDatePicker();
        }
    });
}

function initCreator() {
    populateCountries();
    populateCities();
    populateManualTimezones();
    setInitialFormValues();
    initDatePicker();
    initTimePicker();
    initSelectInteractions();
    updateCreator();

    countrySelect.addEventListener("change", () => {
        populateCities();
        updateCreator();
        renderEventPreview();
        openLinkedSelect(citySelect);
    });

    citySelect.addEventListener("change", () => {
        updateCreator();
        renderEventPreview();
    });
    dateInput.addEventListener("change", () => {
        datePickerLabel.textContent = formatDateButton(dateInput.value);
        datePickerReadout.textContent = formatDateButton(dateInput.value);
        updateCreator();
        renderEventPreview();
    });
    manualCountrySelect.addEventListener("change", () => {
        populateCities(manualCountrySelect.value, manualCitySelect, manualCountries);
        updateManualTimezone();
        openLinkedSelect(manualCitySelect);
    });
    manualCitySelect.addEventListener("change", updateManualTimezone);

    creatorForm.addEventListener("submit", (event) => {
        event.preventDefault();
        copyGeneratedLink();
    });
}

function init() {
    initCreator();
    initExampleAccordion();

    if (!linkyData.hasEvent) {
        renderHomepageClock();
        setInterval(renderHomepageClock, 1000);
        return;
    }

    renderSharedEvent();
    setInterval(renderCountdown, 1000);
}

init();
