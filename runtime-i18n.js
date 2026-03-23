(function (global) {
  const SUPPORTED = ['it', 'en', 'es', 'fr'];
  const STORAGE_KEYS = ['kedrix-data', 'budgetwise-data'];
  const LEGACY_KEYS = ['bw-language'];

  function normalizeLanguage(value, fallback = 'it') {
    const raw = String(value || '').trim().toLowerCase().replace('_', '-');
    if (!raw) return fallback;
    const primary = raw.split('-')[0];
    return SUPPORTED.includes(primary) ? primary : fallback;
  }

  function safeParse(raw, fallback = null) {
    if (raw == null || raw === '') return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (_err) {
      return fallback;
    }
  }

  function readPersistedLanguage() {
    try {
      for (const key of STORAGE_KEYS) {
        const parsed = safeParse(localStorage.getItem(key), null);
        const lang = normalizeLanguage(parsed && parsed.language, '');
        if (lang) return lang;
      }
      for (const key of LEGACY_KEYS) {
        const lang = normalizeLanguage(localStorage.getItem(key), '');
        if (lang) return lang;
      }
    } catch (_err) {}
    return '';
  }

  function readSystemLanguage() {
    try {
      const candidates = [
        ...(Array.isArray(navigator.languages) ? navigator.languages : []),
        navigator.language,
        document.documentElement && document.documentElement.getAttribute('lang')
      ];
      for (const candidate of candidates) {
        const lang = normalizeLanguage(candidate, '');
        if (lang) return lang;
      }
    } catch (_err) {}
    return 'it';
  }

  function resolveBootstrapLanguage() {
    return readSystemLanguage();
  }

  function resolveRuntimeLanguage(appLike) {
    const candidates = [
      appLike && appLike.data && appLike.data.language,
      global.app && global.app.data && global.app.data.language,
      global.KedrixApp && global.KedrixApp.data && global.KedrixApp.data.language,
      document.getElementById('languageSelect') && document.getElementById('languageSelect').value,
      readPersistedLanguage(),
      document.documentElement && document.documentElement.getAttribute('lang'),
      readSystemLanguage()
    ];
    for (const candidate of candidates) {
      const lang = normalizeLanguage(candidate, '');
      if (lang) return lang;
    }
    return 'it';
  }

  function resolveLanguage(stage, appLike) {
    return stage === 'bootstrap'
      ? resolveBootstrapLanguage()
      : resolveRuntimeLanguage(appLike);
  }

  function setDocumentLanguage(lang) {
    const normalized = normalizeLanguage(lang, 'it');
    if (document.documentElement) {
      document.documentElement.setAttribute('lang', normalized);
    }
    return normalized;
  }

  function interpolate(template, vars) {
    let value = String(template == null ? '' : template);
    if (vars && typeof vars === 'object') {
      Object.entries(vars).forEach(([key, replacement]) => {
        value = value.replaceAll(`{${key}}`, String(replacement));
      });
    }
    return value;
  }

  function applyBootstrapTranslations(root = document, forcedLanguage) {
    const lang = normalizeLanguage(forcedLanguage || resolveBootstrapLanguage(), 'it');
    const map = global.KEDRIX_BOOTSTRAP_TRANSLATIONS || {};
    if (!root || typeof root.querySelectorAll !== 'function') return lang;

    root.querySelectorAll('[data-bootstrap-i18n]').forEach((element) => {
      const key = element.getAttribute('data-bootstrap-i18n');
      if (!key) return;
      const value = map[lang] && map[lang][key] != null
        ? map[lang][key]
        : (map.it && map.it[key] != null ? map.it[key] : '');
      if (!value) return;

      if (element.hasAttribute('data-bootstrap-i18n-html')) {
        element.innerHTML = interpolate(value);
        return;
      }

      const tag = String(element.tagName || '').toUpperCase();
      if ((tag === 'INPUT' || tag === 'TEXTAREA') && element.hasAttribute('placeholder')) {
        element.setAttribute('placeholder', interpolate(value));
        return;
      }

      element.textContent = interpolate(value);
    });

    return lang;
  }

  function revealPrebootUI() {
    document.documentElement.classList.remove('kedrix-preboot');
  }

  function boot() {
    const lang = setDocumentLanguage(resolveBootstrapLanguage());
    const run = () => {
      applyBootstrapTranslations(document, lang);
      revealPrebootUI();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
  }

  const api = {
    SUPPORTED,
    normalizeLanguage,
    safeParse,
    readPersistedLanguage,
    readSystemLanguage,
    resolveBootstrapLanguage,
    resolveRuntimeLanguage,
    resolveLanguage,
    setDocumentLanguage,
    applyBootstrapTranslations,
    revealPrebootUI,
    boot
  };


  global.resolveRuntimeLang = function(appLike) {
    return resolveRuntimeLanguage(appLike);
  };

  global.resolveRuntimeLangLocal = function(appLike) {
    return resolveRuntimeLanguage(appLike);
  };

  global.KedrixI18n = api;
  boot();
})(window);
