/**
 * install-prompt.js
 *
 * Progressive Web App installation handling.
 *
 * Troubleshooting:
 * - Chromium exposes `beforeinstallprompt`; iOS does not.
 * - Dismissal persists in localStorage under `whennInstallDismissed`.
 * - Installed/standalone mode suppresses the banner entirely.
 */

// ============================================================================
// INSTALL STATE
// ============================================================================
let deferredInstallPrompt = null;

const installPromptBox = document.getElementById("installPrompt");
const installButton = document.getElementById("installButton");
const installDismiss = document.getElementById("installDismiss");
const installPromptText = document.getElementById("installPromptText");

const installDismissed = localStorage.getItem("whennInstallDismissed") === "1";
const alreadyInstalled =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

/** Permanently hides the banner for this browser profile. */
function hideInstallPromptForever() {
    localStorage.setItem("whennInstallDismissed", "1");
    installPromptBox.hidden = true;
}

// Chromium exposes the prompt as an event; saving it lets our own button trigger it.
window.addEventListener("beforeinstallprompt", (event) => {
    if (installDismissed || alreadyInstalled) {
        return;
    }

    event.preventDefault();
    deferredInstallPrompt = event;
    installPromptBox.hidden = false;
});

// The browser must call prompt() from a user gesture, hence this click handler.
installButton?.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
        return;
    }

    const result = await deferredInstallPrompt.prompt();
    deferredInstallPrompt = null;

    if (result.outcome === "accepted" || result.outcome === "dismissed") {
        hideInstallPromptForever();
    }
});

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

// iOS does not expose beforeinstallprompt, so show manual Share-menu instructions.
if (isIos && !installDismissed && !alreadyInstalled) {
    installPromptText.textContent = "On iPhone: tap Share, then Add to Home Screen.";
    installButton.hidden = true;
    installPromptBox.hidden = false;
}

installDismiss?.addEventListener("click", hideInstallPromptForever);

window.addEventListener("appinstalled", hideInstallPromptForever);
