// KEDRIX — app.js (FIXED HARD GATE)
(function () {
    function blockAccess() {
        window.location.href = "https://landing.kedrix.tech";
    }

    async function checkAccess() {
        if (!window.app || !window.app.license) {
            blockAccess();
            return;
        }

        try {
            if (window.app.license.whenReady) {
                await window.app.license.whenReady();
            }
        } catch (e) {}

        if (!window.app.license.hasFullPremiumAccess()) {
            blockAccess();
            return;
        }
    }

    document.addEventListener("DOMContentLoaded", checkAccess);
})();
