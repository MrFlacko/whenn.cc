/**
 * time-picker.js
 *
 * All time-picker behavior: desktop clock dials, 12/24-hour switching, AM/PM
 * state, and touch-driven mobile wheels with momentum.
 *
 * Sections:
 * 1. Shared time state
 * 2. Mobile wheel math/rendering/gestures
 * 3. Desktop dial pointer handling
 * 4. Modal lifecycle and initialization
 *
 * Troubleshooting:
 * - Wheel spacing constants are coupled to css/time-picker.css item heights.
 * - `setTimeValue()` is the single synchronization point for every visual control.
 */

// ============================================================================
// SHARED TIME VALUE AND DISPLAY STATE
// ============================================================================

/** Normalizes an HH:MM input value for the trigger/readout. */
function formatTimeValue(value) {
    const [hour, minute] = value.split(":");

    return `${hour}:${minute}`;
}

/** Formats the modal preview using the active 12/24-hour display mode. */
function formatPickerReadout() {
    if (hourFormat === "24") {
        return `${pad(pickerHour)}:${pad(pickerMinute)}`;
    }

    const hour = ((pickerHour + 11) % 12) + 1;
    const period = pickerHour >= 12 ? "PM" : "AM";

    return `${hour}:${pad(pickerMinute)} ${period}`;
}

/** Keeps the popup preview and main form label intentionally different. */
function updatePickerReadouts() {
    pickerReadout.textContent = formatPickerReadout();
    timePickerLabel.textContent = formatTimeValue(timeInput.value);
}

/**
 * Single source of truth for picker time.
 * Handles day wrapping, then refreshes every desktop and mobile representation.
 */
function setTimeValue(hour, minute) {
    const totalMinutes = (hour * 60) + minute;
    const normalized = ((totalMinutes % 1440) + 1440) % 1440;
    pickerHour = Math.floor(normalized / 60);
    pickerMinute = normalized % 60;
    timeInput.value = `${pad(pickerHour)}:${pad(pickerMinute)}`;
    updatePickerReadouts();
    hourValue.textContent = hourFormat === "12" ? pad(((pickerHour + 11) % 12) + 1) : pad(pickerHour);
    minuteValue.textContent = pad(pickerMinute);
    hourHand.style.transform = `translateX(-50%) rotate(${hourFormat === "24" ? pickerHour * 15 : (pickerHour % 12) * 30}deg)`;
    minuteHand.style.transform = `translateX(-50%) rotate(${pickerMinute * 6}deg)`;
    updateAmPmButtons();
    updateMobileWheels();
}

/** Switches the active desktop dial between hour and minute selection. */
function setPickerMode(mode) {
    pickerMode = mode;
    hourValue.classList.toggle("is-active", mode === "hour");
    minuteValue.classList.toggle("is-active", mode === "minute");
}

/** Nudges minutes by one, allowing setTimeValue to handle hour/day rollover. */
function adjustMinute(direction) {
    setTimeValue(pickerHour, pickerMinute + direction);
}

/** Synchronizes desktop and mobile AM/PM button states from pickerHour. */
function updateAmPmButtons() {
    for (const button of ampmToggle.querySelectorAll("button")) {
        button.classList.toggle("is-active", button.dataset.ampm === (pickerHour >= 12 ? "PM" : "AM"));
    }

    for (const button of mobileAmpmToggle.querySelectorAll("button")) {
        button.classList.toggle("is-active", button.dataset.mobileAmpm === (pickerHour >= 12 ? "PM" : "AM"));
    }
}

/** Switches 12/24-hour presentation without changing the underlying time. */
function setHourFormat(format) {
    hourFormat = format;
    hourDial.classList.toggle("hour-mode-12", format === "12");
    hourDial.classList.toggle("hour-mode-24", format === "24");
    ampmToggle.classList.toggle("is-disabled", format === "24");
    mobileAmpmToggle.classList.toggle("is-disabled", format === "24");
    populateMobileHourWheel();

    for (const button of ampmToggle.querySelectorAll("button")) {
        button.disabled = format === "24";
        button.setAttribute("aria-disabled", format === "24" ? "true" : "false");
    }

    for (const button of mobileAmpmToggle.querySelectorAll("button")) {
        button.disabled = format === "24";
        button.setAttribute("aria-disabled", format === "24" ? "true" : "false");
    }

    for (const button of document.querySelectorAll("[data-hour-format]")) {
        button.classList.toggle("is-active", button.dataset.hourFormat === format);
    }

    setTimeValue(pickerHour, pickerMinute);
    updatePickerReadouts();
    updateMobileWheels(true);
}

/** Changes only the AM/PM half while preserving the selected 12-hour value. */
function setAmPm(value) {
    const hour12 = pickerHour % 12;
    setTimeValue(value === "PM" ? hour12 + 12 : hour12, pickerMinute);
}

// ============================================================================
// WHEEL SETUP AND MATH
// ============================================================================

/** Rebuilds a wheel's button list from `{ value, label }` records. */
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

// Mobile wheel model: values are rendered once, then transformed instead of scrolled.
function mobileHourValues() {
    return Array.from({ length: hourFormat === "12" ? 12 : 24 }, (_, index) => (
        hourFormat === "12" ? index + 1 : index
    ));
}

/** Returns the visible wheel hour for the active 12/24-hour format. */
function mobileDisplayHour() {
    return hourFormat === "12" ? ((pickerHour + 11) % 12) + 1 : pickerHour;
}

/** Rebuilds hour labels because switching 12/24-hour format changes their range. */
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

/** Returns all 60 minute values used by the minute wheel. */
function mobileMinuteValues() {
    return Array.from({ length: 60 }, (_, index) => index);
}

/** Restricts animation/gesture values to a safe numeric range. */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Converts release velocity into a snapped wheel target.
 * Thresholds prevent tiny accidental drags from changing the selected value.
 */
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

/** Smooth acceleration/deceleration curve used by both wheel animations. */
function smootherStep(progress) {
    return progress * progress * progress * (progress * ((progress * 6) - 15) + 10);
}

/** Uses slightly different coast timing because 12h and 24h wheels have different density. */
function hourWheelMomentumMs() {
    return hourFormat === "24" ? hourWheelMomentumMs24 : hourWheelMomentumMs12;
}

/** Caps fling speed to avoid skipping an unreasonable number of hours. */
function hourWheelMaxVelocity() {
    return hourFormat === "24" ? 0.033 : 0.028;
}

/** Matches JavaScript wheel spacing to the corresponding mobile CSS item height. */
function hourWheelPixelsPerHour() {
    return hourFormat === "24" ? 41 : 48;
}

// ============================================================================
// HOUR WHEEL RENDERING AND ANIMATION
// ============================================================================

/** Positions hour buttons around the centered selection and adjusts opacity/scale. */
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

/** Animates to a snapped hour index and optionally commits it to picker state. */
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

/** Continues an hour drag with momentum, then snaps to a valid hour. */
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

// ============================================================================
// MINUTE WHEEL RENDERING AND ANIMATION
// ============================================================================

/** Positions minute buttons around the centered selection. */
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

/** Animates to a snapped minute and optionally commits it to picker state. */
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

/** Continues a minute drag with momentum, then snaps to a valid minute. */
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

/** Moves the minute wheel to a known value, with optional animation. */
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

/** Moves the hour wheel to a known value, respecting active hour format. */
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

/** Synchronizes both mobile wheels after time changes elsewhere in the picker. */
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

/** Commits a centered mobile hour while preserving the current AM/PM half. */
function setHourFromMobileValue(value) {
    const base = pickerHour >= 12 ? 12 : 0;
    setTimeValue(hourFormat === "12" ? base + (value % 12) : value, pickerMinute);
}

/** Commits a centered mobile minute. */
function setMinuteFromMobileValue(value) {
    setTimeValue(pickerHour, value);
}

// ============================================================================
// MOBILE TOUCH GESTURES
// Gesture objects store start position, last sample, velocity, and whether the
// movement crossed the click-suppression threshold.
// ============================================================================

/** Starts tracking an hour-wheel touch gesture. */
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

/** Updates hour-wheel position and velocity while dragging. */
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

/** Finishes the hour drag with momentum or snaps back when cancelled. */
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

/** Starts tracking a minute-wheel touch gesture. */
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

/** Updates minute-wheel position and velocity while dragging. */
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

/** Finishes the minute drag with momentum or snaps back when cancelled. */
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

// ============================================================================
// DESKTOP CLOCK DIAL
// Pointer angle is converted directly into hour/minute values.
// ============================================================================

/** Returns a pointer's clockwise angle from the top-center of a dial. */
function degreesFromDial(event, dial) {
    const rect = dial.getBoundingClientRect();
    const centerX = rect.left + (rect.width / 2);
    const centerY = rect.top + (rect.height / 2);
    const point = event.touches?.[0] || event;
    const angle = Math.atan2(point.clientY - centerY, point.clientX - centerX);

    return (angle * 180 / Math.PI + 450) % 360;
}

/** Maps a dial angle to an hour or a five-minute step. */
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

/** Captures pointer movement until desktop dial dragging finishes. */
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

// ============================================================================
// MODAL LIFECYCLE
// ============================================================================

/** Reads the hidden input before opening so stale picker state cannot leak in. */
function syncPickerFromInput() {
    const [hour, minute] = (timeInput.value || "09:00").split(":").map(Number);
    setTimeValue(hour, minute);
    updatePickerReadouts();
}

/** Opens the picker and refreshes wheel geometry after it becomes visible. */
function openTimePicker() {
    syncPickerFromInput();
    lockPageScroll();
    timePopover.inert = false;
    timePopover.classList.add("is-open");
    timePopover.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
        updatePickerReadouts();
        updateMobileWheels(true);
    });
}

/** Closes the picker, restores trigger focus, and releases page scroll. */
function closeTimePicker() {
    if (timePopover.contains(document.activeElement)) {
        timePickerButton.focus({ preventScroll: true });
    }

    timePopover.classList.remove("is-open");
    timePopover.inert = true;
    timePopover.setAttribute("aria-hidden", "true");
    unlockPageScroll();
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/** Builds wheel values and wires all desktop/mobile picker controls. */
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
    for (const button of document.querySelectorAll("[data-hour-format]")) {
        button.addEventListener("click", () => setHourFormat(button.dataset.hourFormat));
    }

    for (const button of ampmToggle.querySelectorAll("button")) {
        button.addEventListener("click", () => setAmPm(button.dataset.ampm));
    }

    for (const button of mobileAmpmToggle.querySelectorAll("button")) {
        button.addEventListener("click", () => setAmPm(button.dataset.mobileAmpm));
    }

    // Mobile: passive starts preserve tap responsiveness; move must prevent page scroll.
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
