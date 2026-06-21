/**
 * app.js
 *
 * Application entry point. All feature files are loaded before this file using
 * ordered `defer` scripts in index.php. This file initializes the shared creator
 * controls, then starts exactly one clock mode based on the current URL.
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

// Route flags are produced by PHP and are mutually exclusive.
if (linkyData.isLocationClock) {
    renderLocationClock();
    setInterval(renderLocationClock, 1000);
} else if (!linkyData.hasEvent) {
    renderHomepageClock();
    setInterval(renderHomepageClock, 1000);
} else {
    renderSharedEvent();
    setInterval(renderCountdown, 1000);
}
