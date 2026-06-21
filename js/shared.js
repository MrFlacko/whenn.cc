/**
 * shared.js
 *
 * Shared DOM references, application state, formatting helpers, timezone math, and
 * scroll locking. Load this first: every feature file reads these shared lexical
 * bindings. Keep feature behavior out of this file unless multiple components
 * genuinely depend on it.
 *
 * Sections:
 * 1. DOM references
 * 2. Shared application state
 * 3. Date/string helpers
 * 4. Browser and modal helpers
 * 5. Timezone conversion/display
 *
 * Troubleshooting:
 * - A null DOM reference usually means an ID changed in index.php.
 * - This file must be the first local script imported by index.php.
 */

// ============================================================================
// DOM REFERENCES
// Centralizing these prevents every feature file from repeatedly querying the DOM.
// If an element is renamed in index.php, update its reference here first.
// ============================================================================
const eventTimeEl = document.getElementById("eventTime");
const eventDateEl = document.getElementById("eventDate");
const eventLocationEl = document.getElementById("eventLocation");
const eventTimeLabelEl = document.getElementById("eventTimeLabel");
const localTimeLabelEl = document.getElementById("localTimeLabel");
const timeDifferenceEl = document.getElementById("timeDifference");
const localTimeEl = document.getElementById("localTime");
const localDateEl = document.getElementById("localDate");
const locationEl = document.getElementById("location");
const countdownDays = document.getElementById("countdownDays");
const countdownHours = document.getElementById("countdownHours");
const countdownMinutes = document.getElementById("countdownMinutes");
const countdownSeconds = document.getElementById("countdownSeconds");
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
const addToCalendarButton = document.getElementById("addToCalendarButton");
const calendarPopover = document.getElementById("calendarPopover");
const calendarPopoverClose = document.getElementById("calendarPopoverClose");
const calendarForm = document.getElementById("calendarForm");
const calendarName = document.getElementById("calendarName");
const calendarDescription = document.getElementById("calendarDescription");
const calendarDuration = document.getElementById("calendarDuration");
const calendarDurationOutput = document.getElementById("calendarDurationOutput");
const calendarLibraryScript = document.getElementById("calendarLibraryScript");
const calendarProvider = document.getElementById("calendarProvider");
const calendarOpenButton = document.getElementById("calendarOpenButton");
const calendarDownloadFallback = document.getElementById("calendarDownloadFallback");
const calendarCountry = document.getElementById("calendarCountry");
const calendarCity = document.getElementById("calendarCity");
const calendarDate = document.getElementById("calendarDate");
const calendarTime = document.getElementById("calendarTime");
const calendarTimezone = document.getElementById("calendarTimezone");
const countdownPanel = document.querySelector(".countdown-inline");
const currentTimePanel = document.getElementById("currentTimePanel");
const currentTimeLink = document.getElementById("currentTimeLink");
const currentTimeCopyButton = document.getElementById("currentTimeCopyButton");
const countryPicker = document.getElementById("countryPicker");
const countryPickerClose = document.getElementById("countryPickerClose");
const countrySearchInput = document.getElementById("countrySearchInput");
const countryResults = document.getElementById("countryResults");
const countryEmpty = document.getElementById("countryEmpty");
const cityPicker = document.getElementById("cityPicker");
const cityPickerClose = document.getElementById("cityPickerClose");
const citySearchInput = document.getElementById("citySearchInput");
const cityResults = document.getElementById("cityResults");
const cityEmpty = document.getElementById("cityEmpty");

// ============================================================================
// SHARED APPLICATION STATE
// These values are intentionally global because several classic scripts cooperate.
// Keep write access predictable: picker files own picker state; clock.js owns the
// active timezone/countdown state; creator.js owns the default calendar name.
// ============================================================================
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
let activeCountrySelect = null;
let activeCountryTrigger = null;
let visibleCountryOptions = [];
let activeCountryOptionIndex = -1;
let activeCitySelect = null;
let activeCityTrigger = null;
let visibleCityOptions = [];
let activeCityOptionIndex = -1;
let calendarDefaultName = "";
const hourWheelItemGap = 42;
const hourWheelDragThreshold = 4;
const hourWheelCenterThreshold = 0.16;
const hourWheelMomentumMs12 = 235;
const hourWheelMomentumMs24 = 255;
const minuteWheelItemGap = 34;
const minuteWheelDragThreshold = 4;
const minuteWheelCenterThreshold = 0.14;
const minuteWheelMomentumMs = 300;

// ============================================================================
// BASIC DATE AND STRING HELPERS
// ============================================================================

/** Adds a leading zero for clock, date, and ICS values. */
function pad(value) {
    return String(value).padStart(2, "0");
}

/** Converts a local Date into the YYYY-MM-DD format used by hidden form inputs. */
function toInputDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Parses YYYY-MM-DD as local calendar fields.
 * Do not use `new Date(value)`: browsers interpret that form as UTC.
 */
function dateFromInputValue(value) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day);
}

/** Produces the readable date shown on buttons and calendar previews. */
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

/** Converts the form date into the DD-MM-YYYY segment used by whenn.cc URLs. */
function toLinkDate(value) {
    const [year, month, day] = value.split("-");
    return `${day}-${month}-${year}`;
}

/** Guards Intl calls against missing or browser-unsupported IANA timezone names. */
function isValidTimezone(timezone) {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
        return true;
    } catch {
        return false;
    }
}

// ============================================================================
// BROWSER AND MODAL HELPERS
// ============================================================================

/** Returns the browser timezone, falling back to UTC when detection is unavailable. */
function getBrowserTimezone() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return isValidTimezone(timezone) ? timezone : "UTC";
}

/**
 * Stops the document behind a modal from scrolling.
 * `lockedScrollY` is restored on close so mobile Safari does not jump to the top.
 */
function lockPageScroll() {
    if (document.body.classList.contains("is-modal-locked")) {
        return;
    }

    lockedScrollY = window.scrollY;
    document.body.classList.add("is-modal-locked");
    document.documentElement.classList.add("is-modal-locked");
}

/** Releases the shared modal lock and restores the previous page position. */
function unlockPageScroll() {
    if (!document.body.classList.contains("is-modal-locked")) {
        return;
    }

    document.body.classList.remove("is-modal-locked");
    document.documentElement.classList.remove("is-modal-locked");
    window.scrollTo(0, lockedScrollY);
}

// ============================================================================
// TIMEZONE CONVERSION AND DISPLAY
// ============================================================================

/**
 * Returns the timezone's UTC offset in minutes for a specific instant.
 * The date matters because daylight-saving offsets change during the year.
 */
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

/** Formats a numeric timezone offset as UTC+10, UTC-5, UTC+5:30, etc. */
function formatUtcOffset(date, timezone) {
    const offsetMinutes = getTimeZoneOffset(date, timezone);
    const sign = offsetMinutes < 0 ? "-" : "+";
    const absoluteMinutes = Math.abs(offsetMinutes);
    const hours = Math.floor(absoluteMinutes / 60);
    const minutes = absoluteMinutes % 60;

    return `UTC${sign}${hours}${minutes ? `:${pad(minutes)}` : ""}`;
}

/** Rebuilds a location label and appends its small UTC-offset badge. */
function renderLocation(element, label, date, timezone) {
    const offset = document.createElement("span");
    offset.className = "utc-offset";
    offset.textContent = formatUtcOffset(date, timezone);
    element.replaceChildren(document.createTextNode(label), offset);
}

/**
 * Renders a clock value while wrapping AM/PM separately for responsive styling.
 * Using formatToParts avoids brittle string splitting across browsers.
 */
function renderClockTime(element, date, timezone, includeSeconds = false) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
        second: includeSeconds ? "2-digit" : undefined,
        hour12: true
    }).formatToParts(date);
    const timeText = parts
        .filter((part) => part.type !== "dayPeriod")
        .map((part) => part.value)
        .join("")
        .trim();
    const periodText = parts.find((part) => part.type === "dayPeriod")?.value;

    element.replaceChildren(document.createTextNode(timeText));

    if (periodText) {
        const period = document.createElement("span");
        period.className = "time-period";
        period.textContent = periodText;
        element.append(period);
    }
}

/** Updates the +/- hour marker between event time and the selected local timezone. */
function renderTimeDifference(eventDate, eventTimezone) {
    const differenceMinutes =
        getTimeZoneOffset(eventDate, activeTimezone) -
        getTimeZoneOffset(eventDate, eventTimezone);
    const differenceHours = Math.abs(differenceMinutes) / 60;
    const sign = differenceMinutes < 0 ? "-" : "+";

    timeDifferenceEl.textContent = `${sign}${differenceHours}hr`;
    timeDifferenceEl.title = differenceMinutes === 0
        ? "Same as event time"
        : `${differenceHours} hour${differenceHours === 1 ? "" : "s"} ${differenceMinutes < 0 ? "behind" : "ahead of"} event time`;
    timeDifferenceEl.hidden = false;
}

/**
 * Converts a wall-clock date/time in an IANA timezone into an absolute Date.
 * The second offset pass corrects dates near daylight-saving transitions.
 */
function dateFromZonedTime(dateValue, timeValue, timezone) {
    const [year, month, day] = dateValue.split("-").map(Number);
    const [hour, minute] = timeValue.split(":").map(Number);
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
    const offset = getTimeZoneOffset(utcGuess, timezone);
    const firstPass = new Date(utcGuess.getTime() - (offset * 60 * 1000));
    const correctedOffset = getTimeZoneOffset(firstPass, timezone);

    return new Date(utcGuess.getTime() - (correctedOffset * 60 * 1000));
}
