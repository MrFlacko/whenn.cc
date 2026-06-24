/**
 * clock.js
 *
 * Clock, conversion, countdown, and live-location behavior.
 *
 * Sections:
 * 1. Fixed-event rendering/countdown
 * 2. Homepage and location live clocks
 * 3. Manual timezone controls/current-time links
 *
 * Troubleshooting:
 * - app.js owns the one-second timers; do not start extra intervals here.
 * - `activeTimezone` is visitor-controlled and may differ from the browser timezone.
 */

// ============================================================================
// FIXED EVENT CLOCKS
// ============================================================================

/** Renders one fixed instant in both the event timezone and the visitor timezone. */
function renderConvertedTime(eventDate, timezone, displayLocation) {
    countdownPanel.hidden = false;
    countdownKicker.textContent = "Countdown";
    countdownTitle.textContent = "Starts in";
    countdownTarget = eventDate;
    renderCountdown();
    renderTimeDifference(eventDate, timezone);
    eventTimeLabelEl.textContent = "Event timezone";
    localTimeLabelEl.textContent = "Your timezone";
    renderClockTime(eventTimeEl, eventDate, timezone);
    eventDateEl.textContent = eventDate.toLocaleDateString("en-US", {
        timeZone: timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    renderLocation(eventLocationEl, displayLocation, eventDate, timezone);
    renderClockTime(localTimeEl, eventDate, activeTimezone);
    localDateEl.textContent = eventDate.toLocaleDateString("en-US", {
        timeZone: activeTimezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    renderLocation(locationEl, activeTimezone, eventDate, activeTimezone);
}

/** Updates countdown digits from the shared `countdownTarget` once per second. */
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
}

/** Replaces the clock display with a helpful message for malformed/unknown routes. */
function renderError() {
    countdownTarget = null;
    countdownPanel.hidden = true;
    timeDifferenceEl.hidden = true;
    eventTimeLabelEl.textContent = "Event timezone";
    localTimeLabelEl.textContent = "Your timezone";
    eventTimeEl.textContent = linkyData.error || "Invalid Link";
    eventDateEl.textContent = "Try the creator below, or check the spelling in the URL.";
    eventLocationEl.textContent = linkyData.city ? linkyData.city.replace(/[-_]+/g, " ") : "";
    localTimeEl.textContent = "--:--";
    localDateEl.textContent = "";
}

/** Reuses the event page clock for the homepage preview and existing event edits. */
function renderEventPreview() {
    const country = selectedCountry();
    const zone = selectedZone();

    if (country && zone && dateInput.value && timeInput.value) {
        renderConvertedTime(
            dateFromZonedTime(dateInput.value, timeInput.value, zone.timezone),
            zone.timezone,
            `${zone.label}, ${country.name}`
        );
    }
}

/** Validates the server-provided UTC instant and renders a shared event route. */
function renderSharedEvent() {
    if (linkyData.error || !linkyData.eventUtc || !linkyData.timezone) {
        renderError();
        return;
    }

    renderConvertedTime(new Date(linkyData.eventUtc), linkyData.timezone, linkyData.displayLocation);
}

// ============================================================================
// LIVE CLOCK MODES
// ============================================================================

/** Renders a continuously updating location route such as /au/sydney. */
function renderLocationClock() {
    if (linkyData.error || !linkyData.timezone) {
        renderError();
        return;
    }

    const now = new Date();
    countdownTarget = null;
    countdownPanel.hidden = false;
    countdownKicker.textContent = "Live";
    countdownTitle.textContent = "Updating now";
    countdownDays.textContent = "--";
    countdownHours.textContent = "--";
    countdownMinutes.textContent = "--";
    countdownSeconds.textContent = "--";
    renderTimeDifference(now, linkyData.timezone);
    eventTimeLabelEl.textContent = "Location timezone";
    localTimeLabelEl.textContent = "Your timezone";
    renderClockTime(eventTimeEl, now, linkyData.timezone, true);
    eventDateEl.textContent = now.toLocaleDateString("en-US", {
        timeZone: linkyData.timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    renderLocation(eventLocationEl, linkyData.displayLocation, now, linkyData.timezone);
    renderClockTime(localTimeEl, now, activeTimezone, true);
    localDateEl.textContent = now.toLocaleDateString("en-US", {
        timeZone: activeTimezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    renderLocation(locationEl, activeTimezone, now, activeTimezone);
}

// ============================================================================
// MANUAL LOCAL TIMEZONE AND SHAREABLE CURRENT-TIME LINK
// ============================================================================

/** Returns the country selected in the clock card's manual timezone controls. */
function selectedManualCountry() {
    return manualCountries.find((country) => country.slug === manualCountrySelect.value) || manualCountries[0];
}

/** Returns the city/timezone selected under the manual country. */
function selectedManualZone() {
    const country = selectedManualCountry();
    return country?.zones.find((zone) => zone.slug === manualCitySelect.value) || country?.zones[0];
}

/** Converts an IANA timezone into a valid location-clock URL. */
function routeForTimezone(timezone) {
    const match = findZoneByTimezone(timezone);

    if (match) {
        return `/${match.country.slug}/${match.zone.slug}`;
    }

    if (timezone === "UTC") {
        return "/utc";
    }

    return "";
}

/** Returns the live link for the event/location timezone, not the visitor timezone. */
function currentTimeRoute() {
    if (linkyData.timezone) {
        return routeForTimezone(linkyData.timezone);
    }

    const zone = selectedZone();

    return zone ? routeForTimezone(zone.timezone) : "";
}

/** Shows or hides the current-time link when a valid location route is available. */
function updateCurrentTimeLink() {
    const route = currentTimeRoute();

    if (!route) {
        currentTimePanel.hidden = true;
        return;
    }

    const link = `${window.location.origin}${route}`;
    currentTimeLink.href = link;
    currentTimeLink.textContent = link;
    currentTimeLink.dataset.copyUrl = link;
    currentTimeLink.setAttribute("aria-label", `Open live time link: ${link}`);
    currentTimeLink.title = link;
    currentTimePanel.hidden = false;
}

/** Copies the current-time link and briefly changes the small button label. */
async function copyCurrentTimeLink() {
    const link = currentTimeLink.dataset.copyUrl || currentTimeLink.href;

    if (!link) {
        return;
    }

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(link);
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = link;
            textArea.setAttribute("readonly", "");
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.append(textArea);
            textArea.select();
            document.execCommand("copy");
            textArea.remove();
        }

        currentTimeCopyButton.textContent = "Copied!";
        currentTimeCopyButton.classList.add("is-success");
    } catch (error) {
        currentTimeCopyButton.textContent = "Copy link";
    }

    setTimeout(() => {
        currentTimeCopyButton.textContent = "Copy link";
        currentTimeCopyButton.classList.remove("is-success");
    }, 900);
}

/** Applies a manual timezone and re-renders whichever clock mode is currently active. */
function updateManualTimezone() {
    const zone = selectedManualZone();

    if (!zone) {
        return;
    }

    activeTimezone = zone.timezone;
    updateCurrentTimeLink();

    if (linkyData.hasEvent) {
        renderSharedEvent();
    } else if (linkyData.isLocationClock) {
        renderLocationClock();
    } else {
        renderEventPreview();
    }
}

/**
 * Seeds manual controls from the browser timezone.
 * Unknown browser zones receive a temporary synthetic option rather than failing.
 */
function populateManualTimezones() {
    const detectedTimezone = getBrowserTimezone();
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
