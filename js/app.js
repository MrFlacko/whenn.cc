/**
 * app.js
 *
 * Application entry point. All feature files are loaded before this file using
 * ordered `defer` scripts in index.php. This file initializes the shared creator
 * controls, then starts the route-appropriate live clock or countdown.
 *
 * Troubleshooting:
 * - If a function is undefined here, check the script order in index.php.
 *   shared.js must remain first and this file must remain last.
 * - Fixed events update only the countdown each second; live clocks re-render fully.
 * - There is no separate mobile startup path. Mobile differences stay inside each
 *   feature file so desktop and mobile use the same application state.
 */

initCreator();
initExampleAccordion();
initCreatorGuide();

function initCreatorGuide() {
    const guide = document.querySelector('.creator-guide');

    if (!guide) {
        return;
    }

    const entries = [...guide.querySelectorAll('.creator-guide-entry')];

    entries.forEach((entry) => {
        const button = entry.querySelector('.creator-guide-item');

        button?.addEventListener('click', () => {
            const shouldFlip = !entry.classList.contains('is-flipped');

            entries.forEach((candidate) => {
                const isFlipped = shouldFlip && candidate === entry;
                const candidateButton = candidate.querySelector('.creator-guide-item');

                candidate.classList.toggle('is-flipped', isFlipped);
                candidateButton?.setAttribute('aria-pressed', String(isFlipped));
            });
        });
    });
}

// Route flags are produced by PHP and are mutually exclusive.
if (linkyData.isLocationClock) {
    renderLocationClock();
    setInterval(renderLocationClock, 1000);
} else if (!linkyData.hasEvent) {
    renderEventPreview();
    setInterval(renderCountdown, 1000);
} else {
    renderSharedEvent();
    setInterval(renderCountdown, 1000);
}
