/**
 * date-picker.js
 *
 * Date-picker rendering and interaction.
 *
 * Sections:
 * 1. Value/grid rendering
 * 2. Modal lifecycle
 * 3. Navigation and initialization
 *
 * Troubleshooting:
 * - Dates use local calendar components, not UTC timestamps.
 * - The six-week grid deliberately includes clickable adjacent-month dates.
 */

// ============================================================================
// VALUE AND GRID RENDERING
// ============================================================================

/** Commits YYYY-MM-DD to the hidden input and refreshes creator-dependent output. */
function setDateValue(value) {
    dateInput.value = value;
    datePickerLabel.textContent = formatDateButton(value);
    datePickerReadout.textContent = formatDateButton(value);
    updateCreator();
}

/**
 * Builds a fixed six-week (42 cell) calendar.
 * Leading/trailing dates remain clickable but receive the muted-month style.
 */
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

// ============================================================================
// MODAL LIFECYCLE
// ============================================================================

/** Aligns the visible month to the selected date and opens the dialog. */
function openDatePicker() {
    calendarCursor = dateInput.value ? dateFromInputValue(dateInput.value) : new Date();
    renderCalendar();
    lockPageScroll();
    datePopover.inert = false;
    datePopover.classList.add("is-open");
    datePopover.setAttribute("aria-hidden", "false");
}

/** Closes the dialog and returns keyboard focus to the date trigger. */
function closeDatePicker() {
    if (datePopover.contains(document.activeElement)) {
        datePickerButton.focus({ preventScroll: true });
    }

    datePopover.classList.remove("is-open");
    datePopover.inert = true;
    datePopover.setAttribute("aria-hidden", "true");
    unlockPageScroll();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/** Wires navigation, Today/Cancel controls, and click-outside dismissal. */
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
