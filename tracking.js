// === KEDRIX TRACKING BRIDGE ===
(function () {
  function callTracker(eventName, data) {
    try {
      if (window.KedrixTracking && typeof window.KedrixTracking.trackEvent === 'function') {
        return window.KedrixTracking.trackEvent(eventName, data || {});
      }
    } catch (_err) {}
    return null;
  }

  window.trackEvent = function trackEvent(eventName, data = {}) {
    return callTracker(eventName, data);
  };

  window.KedrixTrackingBridge = {
    trackEvent: window.trackEvent
  };
})();
