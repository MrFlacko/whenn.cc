/**
 * creator.js
 *
 * Invite-creator state and orchestration.
 *
 * Sections:
 * 1. Selected country/timezone and link generation
 * 2. Existing route parsing
 * 3. Defaults, preview, and copy feedback
 * 4. Cross-feature initialization
 *
 * Troubleshooting:
 * - This file coordinates features but should not contain picker/calendar internals.
 * - Existing event/location routes intentionally prefill the creator for editing.
 */

// ============================================================================
// CURRENT CREATOR SELECTION
// ============================================================================

/** Looks up the full country record behind the creator's selected slug. */
function selectedCountry() {
    return countries.find((country) => country.slug === countrySelect.value) || countries[0];
}

/** Looks up the full timezone record within the selected creator country. */
function selectedZone() {
    const country = selectedCountry();
    return country?.zones.find((zone) => zone.slug === citySelect.value) || country?.zones[0];
}

/** Builds the canonical whenn.cc event URL, or an empty string if fields are incomplete. */
function buildLink(country, zone) {
    if (!country || !zone || !dateInput.value || !timeInput.value) {
        return "";
    }

    return `${window.location.origin}/${country.slug}/${zone.slug}/${toLinkDate(dateInput.value)}/${timeInput.value.replace(":", "")}`;
}

// ============================================================================
// GENERATED LINK DISPLAY
// ============================================================================

/** Refreshes the clickable "Try yourself" preview beneath the creator fields. */
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

// ============================================================================
// EXISTING ROUTE -> EDITABLE FORM VALUES
// ============================================================================

/** Finds the first country/zone pair matching an exact IANA timezone identifier. */
function findZoneByTimezone(timezone) {
    for (const country of countries) {
        const zone = country.zones.find((item) => item.timezone === timezone);

        if (zone) {
            return { country, zone };
        }
    }

    return null;
}

/** Parses a fixed-event route into creator-friendly country/date/time values. */
function getLinkedEventFormValues() {
    // Existing event URLs seed the creator so users can edit and recopy an invite.
    if (
        !linkyData.hasEvent ||
        linkyData.error ||
        !/^\d{2}-\d{2}-\d{4}$/.test(linkyData.date) ||
        !/^\d{4}$/.test(linkyData.time)
    ) {
        return null;
    }

    const [day, month, year] = linkyData.date.split("-");
    const hour = Number(linkyData.time.slice(0, 2));
    const minute = Number(linkyData.time.slice(2));
    const match = findZoneByTimezone(linkyData.timezone);

    if (!match || hour > 23 || minute > 59) {
        return null;
    }

    return {
        country: match.country,
        zone: match.zone,
        date: `${year}-${month}-${day}`,
        hour,
        minute
    };
}

/** Uses the current wall-clock time of a location route as the creator default. */
function getLinkedLocationFormValues() {
    if (!linkyData.isLocationClock || linkyData.error || !linkyData.timezone) {
        return null;
    }

    const match = findZoneByTimezone(linkyData.timezone);

    if (!match) {
        return null;
    }

    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: linkyData.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date());
    const value = (type) => parts.find((part) => part.type === type)?.value;

    return {
        country: match.country,
        zone: match.zone,
        date: `${value("year")}-${value("month")}-${value("day")}`,
        hour: Number(value("hour")),
        minute: Number(value("minute"))
    };
}

// ============================================================================
// DEFAULTS, PREVIEW, AND COPY FEEDBACK
// ============================================================================

/**
 * Chooses defaults in priority order: current route, browser timezone, Australia,
 * then the first dataset entry. Route values make existing invites easy to edit.
 */
function setInitialFormValues() {
    const now = new Date();
    const linkedRoute = getLinkedEventFormValues() || getLinkedLocationFormValues();
    const browserMatch = findZoneByTimezone(getBrowserTimezone());
    const defaultCountry =
        linkedRoute?.country ||
        browserMatch?.country ||
        countries.find((country) => country.code === "AU") ||
        countries[0];
    const defaultZone = linkedRoute?.zone || browserMatch?.zone || defaultCountry?.zones[0];

    dateInput.value = linkedRoute?.date || toInputDate(now);
    datePickerLabel.textContent = formatDateButton(dateInput.value);
    datePickerReadout.textContent = formatDateButton(dateInput.value);
    setTimeValue(linkedRoute?.hour ?? now.getHours(), linkedRoute?.minute ?? now.getMinutes());

    if (defaultCountry) {
        countrySelect.value = defaultCountry.slug;
        populateCities(defaultCountry.slug);
    }

    if (defaultZone) {
        citySelect.value = defaultZone.slug;
    }
}

/** Refreshes the generated URL and, on event pages, the large clock preview. */
function updateCreator() {
    renderGeneratedLink();

    if (linkyData.hasEvent) {
        renderEventPreview();
    }
}

/** Copies the generated link and runs the short visual success animation. */
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

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes every creator dependency and attaches the cross-feature wiring.
 * Keep dependency initialization above listeners so synthetic changes cannot fire
 * before custom select triggers and picker dialogs exist.
 */
function initCreator() {
    calendarPopover.inert = true;
    updateCalendarDuration();
    initCalendarProvider();
    populateCountries();
    populateCities();
    populateManualTimezones();
    setInitialFormValues();
    // Initialize dependencies before attaching cross-feature change handlers.
    initCountryPicker();
    initCityPicker();
    initDatePicker();
    initTimePicker();
    initSelectInteractions();
    updateCreator();

    // Country changes repopulate the city list, then immediately open that picker.
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
    currentTimeCopyButton.addEventListener("click", copyCurrentTimeLink);
    addToCalendarButton.addEventListener("click", openCalendarPopover);
    calendarOpenButton.addEventListener("click", openCalendarChooser);
    calendarDuration.addEventListener("input", updateCalendarDuration);
    calendarPopoverClose.addEventListener("click", closeCalendarPopover);
    calendarPopover.addEventListener("click", (event) => {
        if (event.target === calendarPopover) {
            closeCalendarPopover();
        }
    });
    calendarForm.addEventListener("submit", (event) => {
        event.preventDefault();
        downloadCalendarInvite();
    });
    // Let the provider library consume Escape while its own chooser is on top.
    document.addEventListener("keydown", (event) => {
        const providerChooserOpen = document.querySelector("[id^='atcb-customTrigger-']");

        if (
            event.key === "Escape" &&
            calendarPopover.classList.contains("is-open") &&
            !providerChooserOpen
        ) {
            closeCalendarPopover();
        }
    });

    creatorForm.addEventListener("submit", (event) => {
        event.preventDefault();
        copyGeneratedLink();
    });
}
