// === KEDRIX ACTIVATION FORCED (STRUCTURAL I18N REFACTOR) ===
(function () {
  const COPY = {
    it: {
      title: 'Ti bastano 30 secondi',
      body: 'Inserisci un dato per attivare Kedrix',
      income: '➕ Entrata',
      expense: '➖ Spesa',
      completion: 'Perfetto. Kedrix ora può aiutarti davvero.'
    },
    en: {
      title: '30 seconds are enough',
      body: 'Enter one item to activate Kedrix',
      income: '➕ Income',
      expense: '➖ Expense',
      completion: 'Perfect. Kedrix can now help you for real.'
    },
    es: {
      title: 'Solo necesitas 30 segundos',
      body: 'Introduce un dato para activar Kedrix',
      income: '➕ Ingreso',
      expense: '➖ Gasto',
      completion: 'Perfecto. Kedrix ahora puede ayudarte de verdad.'
    },
    fr: {
      title: '30 secondes suffisent',
      body: 'Saisissez une donnée pour activer Kedrix',
      income: '➕ Revenu',
      expense: '➖ Dépense',
      completion: 'Parfait. Kedrix peut maintenant vraiment vous aider.'
    }
  };

  function getLang(stage = 'runtime') {
    try {
      if (window.KedrixI18n && typeof window.KedrixI18n.resolveLanguage === 'function') {
        return window.KedrixI18n.resolveLanguage(stage, window.app || window.KedrixApp || null);
      }
      return 'it';
    } catch (_err) {
      return 'it';
    }
  }

  function copy() {
    return COPY[getLang()] || COPY.it;
  }

  function waitForAppReady() {
    const interval = setInterval(() => {
      const appReady =
        document.querySelector('input[type="number"]') ||
        document.querySelector('[data-section="quick-entry"]') ||
        document.querySelector('[data-i18n="incomeTitle"]') ||
        document.querySelector('[data-i18n="homeQuickActionsTitle"]');

      if (appReady) {
        clearInterval(interval);
        startActivation();
      }
    }, 300);
  }

  function startActivation() {
    if (localStorage.getItem('kedrix_first_action_done')) return;
    showActivationModal();
  }

  function showActivationModal() {
    const t = copy();
    const modal = document.createElement('div');
    modal.id = 'kedrixActivationModal';
    modal.style = `
      position:fixed; top:0; left:0; width:100%; height:100%;
      background:rgba(0,0,0,0.9); z-index:99999;
      display:flex; align-items:center; justify-content:center;
    `;

    modal.innerHTML = `
      <div style="background:#111; color:#fff; padding:30px; border-radius:12px; text-align:center; max-width:420px;">
        <h2 style="margin-bottom:10px;">${t.title}</h2>
        <p style="margin-bottom:20px;">${t.body}</p>
        <button id="kedrixAddIncome" style="margin:5px; padding:12px 22px;">${t.income}</button>
        <button id="kedrixAddExpense" style="margin:5px; padding:12px 22px;">${t.expense}</button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('kedrixAddIncome').onclick = handleAction;
    document.getElementById('kedrixAddExpense').onclick = handleAction;

    window.kedrix_activation_start = Date.now();
    if (typeof window.trackEvent === 'function') {
      window.trackEvent('activation_started', { mode: 'forced_fallback', language: getLang() });
    }
  }

  function handleAction() {
    const modal = document.getElementById('kedrixActivationModal');
    if (modal) modal.remove();

    focusInput();
    trackFirstAction();
  }

  function focusInput() {
    const tryFocus = setInterval(() => {
      const input = document.querySelector('input[type="number"]');
      if (input) {
        input.focus();
        input.style.border = '2px solid #00ffcc';
        clearInterval(tryFocus);
      }
    }, 200);
  }

  function trackFirstAction() {
    document.addEventListener('input', function handler() {
      localStorage.setItem('kedrix_first_action_done', '1');

      if (typeof window.trackEvent === 'function') {
        window.trackEvent('first_action_done', { language: getLang() });

        const start = window.kedrix_activation_start || Date.now();
        window.trackEvent('time_to_first_action', {
          time: Date.now() - start,
          language: getLang()
        });
      }

      showCompletion();
      document.removeEventListener('input', handler);
    });
  }

  function showCompletion() {
    const t = copy();
    const msg = document.createElement('div');
    msg.innerText = t.completion;
    msg.style = `
      position:fixed; bottom:20px; left:50%;
      transform:translateX(-50%);
      background:#00ffcc; color:#000;
      padding:10px 20px; border-radius:8px;
      z-index:99999;
    `;
    document.body.appendChild(msg);

    setTimeout(() => msg.remove(), 3000);
  }

  window.addEventListener('load', () => {
    setTimeout(waitForAppReady, 500);
  });
})();
