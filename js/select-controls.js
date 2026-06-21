/**
 * select-controls.js
 *
 * Shared select-control interaction helpers. This bridges custom city pickers with
 * native select focus behavior and keeps active states consistent for keyboard and
 * pointer users. General form styling is still in css/forms.css.
 *
 * Troubleshooting:
 * - `showPicker()` is optional browser functionality and must remain inside try/catch.
 * - Custom city triggers are handled by location-pickers.js instead of native UI.
 */

// ============================================================================
// PROGRAMMATIC PICKER OPENING
// ============================================================================

/**
 * Opens the custom city dialog when available, otherwise asks the browser to open
 * its native select UI. showPicker is optional and may throw in unsupported browsers.
 */
function openLinkedSelect(select) {
    if (!select) {
        return;
    }

    if (select._cityTrigger) {
        openCityPicker(select);
        return;
    }

    select.focus({ preventScroll: true });
    select.classList.add("is-active");

    if (typeof select.showPicker === "function") {
        try {
            select.showPicker();
            return;
        } catch {
            // Focus still leaves the native control usable when showPicker is blocked.
        }
    }
}

// ============================================================================
// GENERIC NATIVE SELECT ACTIVE STATE
// ============================================================================

/** Adds/removes the visual active class consistently for mouse and keyboard use. */
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
