// === KEDRIX LEGACY TRACKING HOOKS (NON-DUPLICATING BRIDGE) ===
(function () {
  function forward(eventName, data) {
    try {
      if (window.KedrixTracking && typeof window.KedrixTracking.trackEvent === 'function') {
        return window.KedrixTracking.trackEvent(eventName, data || {});
      }
      if (typeof window.trackEvent === 'function') {
        return window.trackEvent(eventName, data || {});
      }
    } catch (_err) {}
    return null;
  }

  window.KedrixLegacyTracking = {
    trackEvent: forward
  };
})();
