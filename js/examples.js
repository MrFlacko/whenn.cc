/**
 * examples.js
 *
 * Mobile example-link accordion behavior.
 *
 * Troubleshooting:
 * - Height is animated manually because CSS cannot transition to/from `auto`.
 * - `isAnimating` prevents rapid taps from desynchronizing height and `open`.
 * - Desktop example links are static and require no JavaScript.
 */

// ============================================================================
// MOBILE ACCORDION
// ============================================================================

/**
 * Adds a measured-height animation around native details/summary behavior.
 * `isAnimating` prevents rapid taps from leaving `open` and height out of sync.
 */
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

    /** Opens first, then animates from zero to the panel's measured content height. */
    function openPanel() {
        accordion.open = true;
        panel.style.height = "0px";

        requestAnimationFrame(() => {
            panel.style.height = `${panel.scrollHeight}px`;
        });
    }

    /** Freezes the current height before animating down to zero. */
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
