(function (global) {
  const CONFIG = {
    build: '20260322_refactor_i18n_v1a',
    channel: 'beta',
    serviceWorkerVersion: '20260322_cf1',
    serviceWorkerPath: './sw.js',
    scope: './',
    endpoints: {
      registry: 'https://script.google.com/macros/s/AKfycbxNM0y7ohRqW3r5c4rUP3chtvf-e-0fe3KHuZ04nLmmQzCxz4WaYy1OmATcHw08CWqG/exec',
      tracking: 'https://script.google.com/macros/s/AKfycbxNM0y7ohRqW3r5c4rUP3chtvf-e-0fe3KHuZ04nLmmQzCxz4WaYy1OmATcHw08CWqG/exec'
    }
  };

  function readMeta(name) {
    try {
      const node = document.querySelector(`meta[name="${name}"]`);
      return node && node.content ? String(node.content).trim() : '';
    } catch (_err) {
      return '';
    }
  }

  function readStorage(key) {
    try {
      const value = localStorage.getItem(key);
      return value ? String(value).trim() : '';
    } catch (_err) {
      return '';
    }
  }

  const api = {
    getBuild() {
      return readMeta('kedrix-build') || CONFIG.build;
    },
    getChannel() {
      return readMeta('kedrix-channel') || CONFIG.channel;
    },
    getScope() {
      return CONFIG.scope;
    },
    getServiceWorkerUrl() {
      return `${CONFIG.serviceWorkerPath}?v=${CONFIG.serviceWorkerVersion}`;
    },
    getEndpoint(kind) {
      const normalizedKind = String(kind || '').trim().toLowerCase();
      if (!normalizedKind) return '';

      const storageKeys = {
        registry: ['kedrix_registry_endpoint'],
        tracking: ['kedrix_tracking_endpoint', 'kedrix_registry_endpoint']
      };
      const metaKeys = {
        registry: 'kedrix-beta-registry-endpoint',
        tracking: 'kedrix-tracking-endpoint'
      };

      const metaValue = readMeta(metaKeys[normalizedKind] || '');
      if (metaValue) return metaValue;

      const storageCandidates = storageKeys[normalizedKind] || [];
      for (const key of storageCandidates) {
        const value = readStorage(key);
        if (value) return value;
      }

      return CONFIG.endpoints[normalizedKind] || '';
    }
  };


  try {
    const registryMeta = api.getEndpoint('registry');
    const trackingMeta = api.getEndpoint('tracking');
    if (registryMeta) localStorage.setItem('kedrix_registry_endpoint', registryMeta);
    if (trackingMeta) localStorage.setItem('kedrix_tracking_endpoint', trackingMeta);
  } catch (_err) {}

  global.KedrixRuntimeConfig = api;
})(window);
