(function(global){
  const DEFAULT_TIMEOUT = 12000;
  const API = {
    buildMeta(extra){
      const guard = global.KedrixLicenseGuard;
      const session = global.KedrixSessionManager;
      return {
        app: 'kedrix-pfe',
        channel: 'beta',
        sentAt: new Date().toISOString(),
        fingerprint: guard && typeof guard.getFingerprint === 'function' ? guard.getFingerprint() : '',
        sessionId: session && typeof session.getSessionId === 'function' ? session.getSessionId() : '',
        ...extra
      };
    },
    async request(url, payload = {}, options = {}){
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);
      try {
        const response = await fetch(url, {
          method: options.method || 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ ...payload, _meta: API.buildMeta(options.meta || {}) }),
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          signal: controller.signal
        });
        const raw = await response.text().catch(() => '');
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch(_e) { data = { ok:false, raw }; }
        return { ok: response.ok, status: response.status, data, raw };
      } finally {
        clearTimeout(timeout);
      }
    }
  };
  global.KedrixAPI = API;
})(window);