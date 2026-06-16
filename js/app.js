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
let hourFormat = "24";
let manualCountries = countries;
let calendarCursor = new Date();
let countdownTarget = null;

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
}

function setHourFormat(format) {
    hourFormat = format;
    hourDial.classList.toggle("hour-mode-12", format === "12");
    hourDial.classList.toggle("hour-mode-24", format === "24");
    ampmToggle.classList.toggle("is-visible", format === "12");

    for (const button of document.querySelectorAll("[data-hour-format]")) {
        button.classList.toggle("is-active", button.dataset.hourFormat === format);
    }

    setTimeValue(pickerHour, pickerMinute);
}

function setAmPm(value) {
    const hour12 = pickerHour % 12;
    setTimeValue(value === "PM" ? hour12 + 12 : hour12, pickerMinute);
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
    timePopover.classList.add("is-open");
    timePopover.setAttribute("aria-hidden", "false");
}

function closeTimePicker() {
    timePopover.classList.remove("is-open");
    timePopover.setAttribute("aria-hidden", "true");
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
    datePopover.classList.add("is-open");
    datePopover.setAttribute("aria-hidden", "false");
}

function closeDatePicker() {
    datePopover.classList.remove("is-open");
    datePopover.setAttribute("aria-hidden", "true");
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
    createdLink.textContent = link.replace(window.location.origin, "");
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
        countdownStatus.textContent = "Event started";
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
    countdownStatus.textContent = "Until event";
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

    try {
        await navigator.clipboard.writeText(createdLink.href);
        createCopyButton.textContent = "Copied";
    } catch (error) {
        createCopyButton.textContent = "Link Created";
    }

    setTimeout(() => {
        createCopyButton.textContent = "Create & Copy";
    }, 1400);
}

function initTimePicker() {
    setPickerMode("hour");
    setHourFormat("24");
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

    for (const button of document.querySelectorAll("[data-minute]")) {
        button.addEventListener("click", () => {
            setPickerMode("minute");
            setTimeValue(pickerHour, Number(button.dataset.minute));
        });
    }

    timePopover.addEventListener("click", (event) => {
        if (event.target === timePopover) {
            closeTimePicker();
        }
    });
}

function initDatePicker() {
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
    updateCreator();

    countrySelect.addEventListener("change", () => {
        populateCities();
        updateCreator();
        renderEventPreview();
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
    });
    manualCitySelect.addEventListener("change", updateManualTimezone);

    creatorForm.addEventListener("submit", (event) => {
        event.preventDefault();
        copyGeneratedLink();
    });
}

function init() {
    initCreator();

    if (!linkyData.hasEvent) {
        renderHomepageClock();
        setInterval(renderHomepageClock, 1000);
        return;
    }

    renderSharedEvent();
    setInterval(renderCountdown, 1000);
}

init();
