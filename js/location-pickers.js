/**
 * location-pickers.js
 *
 * Country and city/timezone controls.
 *
 * Sections:
 * 1. Shared native-select helpers
 * 2. Country dialog/search/keyboard navigation
 * 3. City/timezone dialog/search/keyboard navigation
 *
 * Troubleshooting:
 * - Native selects remain the source of truth; generated buttons are visual triggers.
 * - visualViewport values keep mobile dialogs aligned above the software keyboard.
 */

// ============================================================================
// SHARED NATIVE SELECT HELPERS
// ============================================================================

/** Appends a plain option to one of the hidden/native select elements. */
function addOption(select, value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.append(option);
}

/** Rebuilds a country select from either the main or manual-timezone dataset. */
function populateCountries(select = countrySelect, source = countries) {
    select.replaceChildren();

    for (const country of source) {
        addOption(select, country.slug, country.name);
    }
}

/** Selects the correct country dataset for creator vs manual-timezone controls. */
function countrySourceForSelect(select) {
    return select === manualCountrySelect ? manualCountries : countries;
}

/** Makes picker searches case- and accent-insensitive. */
function normalizeCountrySearch(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

// ============================================================================
// COUNTRY PICKER
// ============================================================================

/** Keeps a custom country trigger's label synchronized with its native select. */
function syncCountryTrigger(select) {
    const trigger = select._countryTrigger;

    if (!trigger) {
        return;
    }

    const selected = countrySourceForSelect(select).find((country) => country.slug === select.value);
    const label = selected?.name || "Choose a country";
    trigger.querySelector("span").textContent = label;
    trigger.title = label;
}

/** Moves keyboard highlight to a country option and keeps it visible. */
function setActiveCountryOption(index) {
    const buttons = [...countryResults.querySelectorAll(".country-option")];

    if (!buttons.length) {
        activeCountryOptionIndex = -1;
        return;
    }

    activeCountryOptionIndex = Math.max(0, Math.min(index, buttons.length - 1));

    for (const [buttonIndex, button] of buttons.entries()) {
        button.classList.toggle("is-active", buttonIndex === activeCountryOptionIndex);
    }

    buttons[activeCountryOptionIndex].scrollIntoView({ block: "nearest" });
}

/** Commits a country choice through the native select's normal change event. */
function chooseCountry(country) {
    const select = activeCountrySelect;

    if (!select) {
        return;
    }

    closeCountryPicker();
    select.value = country.slug;
    syncCountryTrigger(select);
    select.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Filters and rebuilds the country result buttons for the current search text. */
function renderCountryOptions(query = "") {
    if (!activeCountrySelect) {
        return;
    }

    const normalizedQuery = normalizeCountrySearch(query);
    const selectedValue = activeCountrySelect.value;

    visibleCountryOptions = countrySourceForSelect(activeCountrySelect).filter((country) => {
        const name = normalizeCountrySearch(country.name);
        const code = normalizeCountrySearch(country.code || country.slug);
        return !normalizedQuery || name.includes(normalizedQuery) || code.startsWith(normalizedQuery);
    });

    countryResults.replaceChildren();

    for (const country of visibleCountryOptions) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "country-option";
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", String(country.slug === selectedValue));
        button.classList.toggle("is-selected", country.slug === selectedValue);
        button.textContent = country.name;
        button.title = country.name;
        button.addEventListener("click", () => chooseCountry(country));
        countryResults.append(button);
    }

    countryEmpty.hidden = visibleCountryOptions.length !== 0;
    activeCountryOptionIndex = visibleCountryOptions.findIndex((country) => country.slug === selectedValue);

    if (activeCountryOptionIndex < 0 && visibleCountryOptions.length) {
        activeCountryOptionIndex = 0;
    }

    if (activeCountryOptionIndex >= 0) {
        setActiveCountryOption(activeCountryOptionIndex);
    }
}

/** Fits the mobile picker to the visual viewport when the keyboard opens. */
function updateCountryPickerViewport() {
    // Mobile keyboards resize visualViewport without changing the layout viewport.
    const viewport = window.visualViewport;
    countryPicker.style.setProperty(
        "--country-picker-height",
        `${viewport?.height || window.innerHeight}px`
    );
    countryPicker.style.setProperty(
        "--country-picker-top",
        `${viewport?.offsetTop || 0}px`
    );
}

/** Opens the shared country dialog for whichever country select triggered it. */
function openCountryPicker(select) {
    activeCountrySelect = select;
    activeCountryTrigger = select._countryTrigger;
    activeCountryTrigger?.setAttribute("aria-expanded", "true");
    countrySearchInput.value = "";
    renderCountryOptions();
    updateCountryPickerViewport();
    lockPageScroll();
    countryPicker.inert = false;
    countryPicker.classList.add("is-open");
    countryPicker.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
        countrySearchInput.focus({ preventScroll: true });

        const selected = countryResults.querySelector(".country-option.is-selected");
        selected?.scrollIntoView({ block: "center" });
    });
}

/** Closes country search, clears temporary state, and restores trigger focus. */
function closeCountryPicker() {
    if (!countryPicker.classList.contains("is-open")) {
        return;
    }

    countryPicker.classList.remove("is-open");
    countryPicker.inert = true;
    countryPicker.setAttribute("aria-hidden", "true");
    activeCountryTrigger?.setAttribute("aria-expanded", "false");
    activeCountryTrigger?.focus({ preventScroll: true });
    activeCountrySelect = null;
    activeCountryTrigger = null;
    visibleCountryOptions = [];
    activeCountryOptionIndex = -1;
    unlockPageScroll();
}

/**
 * Replaces both visible country selects with accessible custom trigger buttons,
 * then wires search, keyboard navigation, outside-click, and viewport behavior.
 */
function initCountryPicker() {
    countryPicker.inert = true;

    for (const select of [countrySelect, manualCountrySelect]) {
        const trigger = document.createElement("button");
        const label = document.createElement("span");
        trigger.type = "button";
        trigger.className = "country-select-button";
        trigger.setAttribute("aria-haspopup", "dialog");
        trigger.setAttribute("aria-expanded", "false");
        trigger.append(label);
        trigger.addEventListener("click", () => openCountryPicker(select));
        // Keep the native select for form state; the button is only the visual trigger.
        select.classList.add("country-native-select");
        select.before(trigger);
        select._countryTrigger = trigger;
        syncCountryTrigger(select);
        select.addEventListener("change", () => syncCountryTrigger(select));
    }

    countrySearchInput.addEventListener("input", () => renderCountryOptions(countrySearchInput.value));
    countrySearchInput.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveCountryOption(activeCountryOptionIndex + 1);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveCountryOption(activeCountryOptionIndex <= 0
                ? visibleCountryOptions.length - 1
                : activeCountryOptionIndex - 1);
        } else if (event.key === "Enter" && activeCountryOptionIndex >= 0) {
            event.preventDefault();
            chooseCountry(visibleCountryOptions[activeCountryOptionIndex]);
        } else if (event.key === "Escape") {
            closeCountryPicker();
        }
    });
    countryPickerClose.addEventListener("click", closeCountryPicker);
    countryPicker.addEventListener("click", (event) => {
        if (event.target === countryPicker) {
            closeCountryPicker();
        }
    });
    window.visualViewport?.addEventListener("resize", updateCountryPickerViewport);
    window.visualViewport?.addEventListener("scroll", updateCountryPickerViewport);
}

// ============================================================================
// CITY / TIMEZONE PICKER
// The city picker mirrors the country picker but its source depends on the country.
// ============================================================================

/** Rebuilds city/timezone options for a selected country. */
function populateCities(countrySlug = countrySelect.value, select = citySelect, source = countries) {
    const country = source.find((item) => item.slug === countrySlug) || source[0];
    select.replaceChildren();

    for (const zone of country.zones) {
        addOption(select, zone.slug, zone.label);
    }

    syncCityTrigger(select);
}

/** Gives an auto-filled city trigger a short visual nudge. */
function pulseCityTrigger(select) {
    const trigger = select?._cityTrigger;

    if (!trigger) {
        return;
    }

    trigger.classList.remove("is-auto-filled");
    trigger.getBoundingClientRect();
    trigger.classList.add("is-auto-filled");
}

/**
 * Countries with a single timezone do not need a second choice.
 * Select it immediately and draw attention to the filled city field.
 */
function autoSelectOnlyCity(select) {
    const zones = citySourceForSelect(select);

    if (zones.length !== 1) {
        return false;
    }

    select.value = zones[0].slug;
    syncCityTrigger(select);
    pulseCityTrigger(select);
    return true;
}

/** Returns the correct zone list for creator vs manual-timezone city selects. */
function citySourceForSelect(select) {
    const source = select === manualCitySelect ? manualCountries : countries;
    const countrySlug = select === manualCitySelect
        ? manualCountrySelect.value
        : countrySelect.value;
    const country = source.find((item) => item.slug === countrySlug) || source[0];

    return country?.zones || [];
}

/** Keeps a custom city trigger synchronized with its hidden/native select. */
function syncCityTrigger(select) {
    const trigger = select?._cityTrigger;

    if (!trigger) {
        return;
    }

    const selected = citySourceForSelect(select).find((zone) => zone.slug === select.value);
    const label = selected?.label || "Choose a city";
    trigger.querySelector("span").textContent = label;
    trigger.title = selected ? `${selected.label} · ${selected.timezone}` : label;
}

/** Moves keyboard highlight to a city option and keeps it visible. */
function setActiveCityOption(index) {
    const buttons = [...cityResults.querySelectorAll(".country-option")];

    if (!buttons.length) {
        activeCityOptionIndex = -1;
        return;
    }

    activeCityOptionIndex = Math.max(0, Math.min(index, buttons.length - 1));

    for (const [buttonIndex, button] of buttons.entries()) {
        button.classList.toggle("is-active", buttonIndex === activeCityOptionIndex);
    }

    buttons[activeCityOptionIndex].scrollIntoView({ block: "nearest" });
}

/** Commits a city/timezone choice and dispatches the native change event. */
function chooseCity(zone) {
    const select = activeCitySelect;

    if (!select) {
        return;
    }

    closeCityPicker();
    select.value = zone.slug;
    syncCityTrigger(select);
    select.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Filters city labels and full IANA timezone names, then rebuilds results. */
function renderCityOptions(query = "") {
    if (!activeCitySelect) {
        return;
    }

    const normalizedQuery = normalizeCountrySearch(query);
    const selectedValue = activeCitySelect.value;

    visibleCityOptions = citySourceForSelect(activeCitySelect).filter((zone) => {
        const label = normalizeCountrySearch(zone.label);
        const timezone = normalizeCountrySearch(zone.timezone);
        return !normalizedQuery || label.includes(normalizedQuery) || timezone.includes(normalizedQuery);
    });

    cityResults.replaceChildren();

    for (const zone of visibleCityOptions) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "country-option";
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", String(zone.slug === selectedValue));
        button.classList.toggle("is-selected", zone.slug === selectedValue);
        button.textContent = zone.label;
        button.title = `${zone.label} · ${zone.timezone}`;
        button.addEventListener("click", () => chooseCity(zone));
        cityResults.append(button);
    }

    cityEmpty.hidden = visibleCityOptions.length !== 0;
    activeCityOptionIndex = visibleCityOptions.findIndex((zone) => zone.slug === selectedValue);

    if (activeCityOptionIndex < 0 && visibleCityOptions.length) {
        activeCityOptionIndex = 0;
    }

    if (activeCityOptionIndex >= 0) {
        setActiveCityOption(activeCityOptionIndex);
    }
}

/** Applies the same mobile visual-viewport correction used by country search. */
function updateCityPickerViewport() {
    const viewport = window.visualViewport;
    cityPicker.style.setProperty("--country-picker-height", `${viewport?.height || window.innerHeight}px`);
    cityPicker.style.setProperty("--country-picker-top", `${viewport?.offsetTop || 0}px`);
}

/** Opens city search for the creator or manual-timezone control. */
function openCityPicker(select) {
    activeCitySelect = select;
    activeCityTrigger = select._cityTrigger;
    activeCityTrigger?.setAttribute("aria-expanded", "true");
    citySearchInput.value = "";
    renderCityOptions();
    updateCityPickerViewport();
    lockPageScroll();
    cityPicker.inert = false;
    cityPicker.classList.add("is-open");
    cityPicker.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
        citySearchInput.focus({ preventScroll: true });
        cityResults.querySelector(".country-option.is-selected")?.scrollIntoView({ block: "center" });
    });
}

/** Closes city search, clears temporary state, and restores trigger focus. */
function closeCityPicker() {
    if (!cityPicker.classList.contains("is-open")) {
        return;
    }

    cityPicker.classList.remove("is-open");
    cityPicker.inert = true;
    cityPicker.setAttribute("aria-hidden", "true");
    activeCityTrigger?.setAttribute("aria-expanded", "false");
    activeCityTrigger?.focus({ preventScroll: true });
    activeCitySelect = null;
    activeCityTrigger = null;
    visibleCityOptions = [];
    activeCityOptionIndex = -1;
    unlockPageScroll();
}

/** Creates city triggers and wires search, keyboard, outside-click, and viewport events. */
function initCityPicker() {
    cityPicker.inert = true;

    for (const select of [citySelect, manualCitySelect]) {
        const trigger = document.createElement("button");
        const label = document.createElement("span");
        trigger.type = "button";
        trigger.className = "country-select-button";
        trigger.setAttribute("aria-haspopup", "dialog");
        trigger.setAttribute("aria-expanded", "false");
        trigger.append(label);
        trigger.addEventListener("click", () => openCityPicker(select));
        select.classList.add("country-native-select");
        select.before(trigger);
        select._cityTrigger = trigger;
        syncCityTrigger(select);
        select.addEventListener("change", () => syncCityTrigger(select));
    }

    citySearchInput.addEventListener("input", () => renderCityOptions(citySearchInput.value));
    citySearchInput.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveCityOption(activeCityOptionIndex + 1);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveCityOption(activeCityOptionIndex <= 0
                ? visibleCityOptions.length - 1
                : activeCityOptionIndex - 1);
        } else if (event.key === "Enter" && activeCityOptionIndex >= 0) {
            event.preventDefault();
            chooseCity(visibleCityOptions[activeCityOptionIndex]);
        } else if (event.key === "Escape") {
            closeCityPicker();
        }
    });
    cityPickerClose.addEventListener("click", closeCityPicker);
    cityPicker.addEventListener("click", (event) => {
        if (event.target === cityPicker) {
            closeCityPicker();
        }
    });
    window.visualViewport?.addEventListener("resize", updateCityPickerViewport);
    window.visualViewport?.addEventListener("scroll", updateCityPickerViewport);
}
