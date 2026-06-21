/**
 * calendar.js
 *
 * Calendar invite modal, duration handling, provider integration, and standards-based
 * ICS fallback.
 *
 * Sections:
 * 1. Event data/duration
 * 2. Third-party provider configuration
 * 3. Modal lifecycle
 * 4. ICS fallback generation
 *
 * Troubleshooting:
 * - Autumn DST rollback events use UTC provider values to avoid repeated-hour ambiguity.
 * - The external library may fail offline, so never remove the ICS fallback path.
 */

// ============================================================================
// EVENT DATA AND DURATION
// ============================================================================

/**
 * Takes the creator's current fields and produces one calendar-ready event model.
 * Start/end are absolute instants; country/zone/location remain display metadata.
 */
function getCalendarEventDetails() {
    const country = selectedCountry();
    const zone = selectedZone();

    if (!country || !zone || !dateInput.value || !timeInput.value) {
        return null;
    }

    const start = dateFromZonedTime(dateInput.value, timeInput.value, zone.timezone);
    const durationMinutes = Number(calendarDuration.value) || 60;

    return {
        country,
        zone,
        start,
        end: new Date(start.getTime() + (durationMinutes * 60 * 1000)),
        location: `${zone.label}, ${country.name}`,
        inviteUrl: buildLink(country, zone)
    };
}

/** Converts the slider's minute value into a short human-readable label. */
function formatDuration(minutes) {
    if (minutes < 60) {
        return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    const hourText = `${hours} hour${hours === 1 ? "" : "s"}`;

    return remainingMinutes ? `${hourText} ${remainingMinutes} min` : hourText;
}

/** Updates both the duration text and the CSS custom property that fills the track. */
function updateCalendarDuration() {
    const minutes = Number(calendarDuration.value);
    const minimum = Number(calendarDuration.min);
    const maximum = Number(calendarDuration.max);
    const progress = ((minutes - minimum) / (maximum - minimum)) * 100;

    calendarDurationOutput.textContent = formatDuration(minutes);
    calendarDuration.style.setProperty("--duration-progress", `${progress}%`);
}

// ============================================================================
// THIRD-PARTY CALENDAR PROVIDER
// ============================================================================

/** Formats one date or time component in a requested timezone for provider URLs. */
function formatZonedCalendarPart(date, timezone, type) {
    const options = type === "date"
        ? { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }
        : { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
    const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return type === "date"
        ? `${values.year}-${values.month}-${values.day}`
        : `${values.hour}:${values.minute}`;
}

/**
 * Uses the provider library's lightweight markup for line breaks and links.
 * This is not HTML; see add-to-calendar-button's description syntax.
 */
function calendarProviderDescription(inviteUrl) {
    const description = calendarDescription.value.trim().replace(/\r?\n/g, "[br]");
    const invite = inviteUrl ? `[url]${inviteUrl}|Open whenn.cc invite[/url]` : "";

    return [description, invite].filter(Boolean).join("[br][br]");
}

/** Creates a filesystem-safe, accent-normalized filename for downloaded ICS files. */
function calendarFilename(name) {
    return name
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "calendar-invite";
}

/**
 * Builds the configuration consumed by `window.atcb_action`.
 *
 * DST quirk: when an event crosses the autumn clock rollback, local times become
 * ambiguous (for example, 1:30 AM occurs twice). Those events are sent as UTC so
 * calendar providers preserve the exact start/end instants and duration.
 */
function calendarProviderConfig() {
    const details = getCalendarEventDetails();

    if (!details) {
        return null;
    }

    const name = calendarName.value.trim() || calendarDefaultName || `Event in ${details.zone.label}`;
    const localStartDate = dateInput.value;
    const localStartTime = timeInput.value;
    const localEndDate = formatZonedCalendarPart(details.end, details.zone.timezone, "date");
    const localEndTime = formatZonedCalendarPart(details.end, details.zone.timezone, "time");
    const repeatedHour =
        getTimeZoneOffset(details.end, details.zone.timezone) <
        getTimeZoneOffset(details.start, details.zone.timezone);
    const providerTimezone = repeatedHour ? "UTC" : details.zone.timezone;

    return {
        name,
        description: calendarProviderDescription(details.inviteUrl),
        startDate: repeatedHour ? formatZonedCalendarPart(details.start, "UTC", "date") : localStartDate,
        startTime: repeatedHour ? formatZonedCalendarPart(details.start, "UTC", "time") : localStartTime,
        endDate: repeatedHour ? formatZonedCalendarPart(details.end, "UTC", "date") : localEndDate,
        endTime: repeatedHour ? formatZonedCalendarPart(details.end, "UTC", "time") : localEndTime,
        timeZone: providerTimezone,
        location: details.location,
        iCalFileName: calendarFilename(name),
        options: ["Apple", "Google", "iCal", "Microsoft365", "Outlook.com", "Yahoo"],
        optionsMobile: ["Apple", "Google", "iCal", "Microsoft365", "Outlook.com"],
        listStyle: "modal",
        lightMode: "dark",
        hideCheckmark: true
    };
}

/** Opens the provider chooser, falling back to a local ICS file on any failure. */
async function openCalendarChooser() {
    const config = calendarProviderConfig();

    if (!config || typeof window.atcb_action !== "function") {
        downloadCalendarInvite();
        return;
    }

    calendarOpenButton.disabled = true;
    calendarOpenButton.textContent = "Opening…";

    try {
        await window.atcb_action(config, calendarOpenButton);
    } catch (error) {
        console.error("Calendar chooser failed; using ICS fallback.", error);
        downloadCalendarInvite();
    } finally {
        calendarOpenButton.disabled = false;
        calendarOpenButton.textContent = "Open Calendar";
    }
}

/**
 * Swaps the fallback download button for "Open Calendar" only after the external
 * provider script has loaded successfully. Offline users always retain the fallback.
 */
function initCalendarProvider() {
    function enableCalendarProvider() {
        if (typeof window.atcb_action !== "function") {
            return;
        }

        calendarProvider.hidden = false;
        calendarDownloadFallback.hidden = true;
    }

    if (typeof window.atcb_action === "function") {
        enableCalendarProvider();
        return;
    }

    calendarLibraryScript?.addEventListener("load", enableCalendarProvider, { once: true });
}

// ============================================================================
// MODAL DISPLAY
// ============================================================================

/** Converts the 24-hour form value into the modal's 12-hour display format. */
function formatCalendarTime(value) {
    const [hour, minute] = value.split(":").map(Number);
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = ((hour + 11) % 12) + 1;

    return `${displayHour}:${pad(minute)} ${period}`;
}

/** Refreshes the immutable event preview and opens/focuses the calendar modal. */
function openCalendarPopover() {
    const details = getCalendarEventDetails();

    if (!details) {
        return;
    }

    calendarCountry.textContent = details.country.name;
    calendarCity.textContent = details.zone.label;
    calendarDate.textContent = formatDateButton(dateInput.value);
    calendarTime.textContent = formatCalendarTime(timeInput.value);
    calendarTimezone.textContent = `${details.zone.timezone} · ${formatUtcOffset(details.start, details.zone.timezone)}`;
    updateCalendarDuration();

    const nextDefaultName = `Event in ${details.zone.label}`;

    if (!calendarName.value || calendarName.value === calendarDefaultName) {
        calendarName.value = nextDefaultName;
    }

    calendarDefaultName = nextDefaultName;
    lockPageScroll();
    calendarPopover.inert = false;
    calendarPopover.classList.add("is-open");
    calendarPopover.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => calendarName.focus({ preventScroll: true }));
}

/** Closes the modal, restores its trigger focus, and releases page scroll. */
function closeCalendarPopover() {
    if (calendarPopover.contains(document.activeElement)) {
        addToCalendarButton.focus({ preventScroll: true });
    }

    calendarPopover.classList.remove("is-open");
    calendarPopover.inert = true;
    calendarPopover.setAttribute("aria-hidden", "true");
    unlockPageScroll();
}

// ============================================================================
// ICS FALLBACK
// RFC 5545 escaping/folding is intentionally kept local so the fallback has no
// dependency on the external provider library.
// ============================================================================

/** Escapes characters that have special meaning inside an ICS text field. */
function escapeIcsText(value) {
    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/\r?\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
}

/** Formats an absolute Date as the compact UTC timestamp required by ICS. */
function formatIcsUtc(date) {
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/**
 * Folds long ICS lines by UTF-8 byte length, not JavaScript character count.
 * Continuation lines begin with one space as required by RFC 5545.
 */
function foldIcsLine(line) {
    const chunks = [];
    const encoder = new TextEncoder();
    let current = "";

    for (const character of line) {
        if (current && encoder.encode(`${current}${character}`).length > 73) {
            chunks.push(current);
            current = ` ${character}`;
            continue;
        }

        current += character;
    }

    chunks.push(current);
    return chunks.join("\r\n");
}

/** Builds the complete VEVENT/VCALENDAR document using CRLF line endings. */
function buildCalendarInviteContent(details, name) {
    const descriptionParts = [calendarDescription.value.trim()];

    if (details.inviteUrl) {
        descriptionParts.push(`Invite: ${details.inviteUrl}`);
    }

    const description = descriptionParts.filter(Boolean).join("\n\n");
    const uid = `${details.start.getTime()}-${Math.random().toString(36).slice(2)}@whenn.cc`;
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//whenn.cc//Calendar Invite//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${formatIcsUtc(new Date())}`,
        `DTSTART:${formatIcsUtc(details.start)}`,
        `DTEND:${formatIcsUtc(details.end)}`,
        `SUMMARY:${escapeIcsText(name)}`,
        `LOCATION:${escapeIcsText(details.location)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        details.inviteUrl ? `URL:${details.inviteUrl}` : "",
        "END:VEVENT",
        "END:VCALENDAR"
    ].filter(Boolean);

    return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

/** Creates a temporary Blob URL, downloads the ICS file, then releases the URL. */
function downloadCalendarInvite() {
    const details = getCalendarEventDetails();

    if (!details) {
        return;
    }

    const name = calendarName.value.trim() || calendarDefaultName;
    const blob = new Blob(
        [buildCalendarInviteContent(details, name)],
        { type: "text/calendar;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const download = document.createElement("a");

    download.href = url;
    download.download = `${calendarFilename(name)}.ics`;
    document.body.append(download);
    download.click();
    download.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    closeCalendarPopover();
}
