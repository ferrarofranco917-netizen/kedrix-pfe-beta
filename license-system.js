// KEDRIX — license-system.js (FIXED)
window.app = window.app || {};
window.app.license = {
  state: { accessAllowed: false },

  async whenReady() {
    return true;
  },

  hasFullPremiumAccess() {
    return this.state.accessAllowed === true;
  },

  showGate() {
    window.location.href = "https://landing.kedrix.tech";
  }
};
