// ============================================
// KEDRIX — CONTROLLED BETA LICENSE SYSTEM
// Compatible with existing app.js hooks
// ============================================

class KedrixLicense {
    constructor() {
        this.endpoint = this.resolveEndpoint();
        this.storage = {
            email: 'license_email',
            testerId: 'tester_id',
            role: 'kedrix_role',
            status: 'kedrix_license_status',
            type: 'kedrix_license_type',
            batch: 'kedrix_license_batch',
            expiresAt: 'kedrix_license_expires_at',
            checkedAt: 'kedrix_license_checked_at',
            message: 'kedrix_license_message'
        };

        this.state = {
            email: localStorage.getItem(this.storage.email) || '',
            testerId: localStorage.getItem(this.storage.testerId) || '',
            role: localStorage.getItem(this.storage.role) || 'guest',
            status: localStorage.getItem(this.storage.status) || 'missing',
            type: localStorage.getItem(this.storage.type) || 'beta',
            batch: localStorage.getItem(this.storage.batch) || '',
            expiresAt: localStorage.getItem(this.storage.expiresAt) || '',
            checkedAt: localStorage.getItem(this.storage.checkedAt) || '',
            message: localStorage.getItem(this.storage.message) || '',
            accessAllowed: false
        };

        this.limits = {
            denied: {
                maxTransactions: 0,
                maxCategories: 0,
                csvImport: false,
                aiAssistant: false,
                voiceRecognition: false,
                cloudSync: false,
                customCategories: false,
                advancedReports: false,
                calendarExport: false
            },
            allowed: {
                maxTransactions: Infinity,
                maxCategories: Infinity,
                csvImport: true,
                aiAssistant: true,
                voiceRecognition: true,
                cloudSync: true,
                customCategories: true,
                advancedReports: true,
                calendarExport: true
            }
        };

        this.bootstrapPromise = this.bootstrap();
        this.startHeartbeat();
    }

    resolveEndpoint() {
        if (window.KedrixRuntimeConfig && typeof window.KedrixRuntimeConfig.getEndpoint === 'function') {
            const endpoint = window.KedrixRuntimeConfig.getEndpoint('registry');
            if (endpoint) return endpoint;
        }
        const meta = document.querySelector('meta[name="kedrix-beta-registry-endpoint"]');
        if (meta && meta.content) return meta.content.trim();
        return '';
    }

    async bootstrap() {
        this.injectGateStyles();
        this.renderGate();

        if (!this.state.email) {
            this.showGate('missing');
            return this.state;
        }

        await this.verifyRemote({
            email: this.state.email,
            testerId: this.state.testerId,
            silent: true
        });
        return this.state;
    }

    async whenReady() {
        return this.bootstrapPromise;
    }

    async verifyRemote({ email, testerId, silent = false } = {}) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedTesterId = String(testerId || '').trim();

        if (!normalizedEmail && !normalizedTesterId) {
            this.updateState({
                status: 'missing',
                message: 'Inserisci l’email con cui hai richiesto l’accesso beta.',
                accessAllowed: false
            });
            this.showGate('missing');
            return { ok: false, reason: 'missing_credentials' };
        }

        this.setGateLoading(true, 'Verifica accesso beta in corso…');

        try {
            const payload = {
                    action: 'check_license',
                    email: normalizedEmail,
                    testerId: normalizedTesterId,
                    tester_id: normalizedTesterId,
                    licenseKey: normalizedTesterId,
                    license_key: normalizedTesterId,
                    source: 'kedrix-app',
                    client_sig: (window.KedrixLicenseGuard && window.KedrixLicenseGuard.sign)
                        ? window.KedrixLicenseGuard.sign({ email: normalizedEmail, testerId: normalizedTesterId })
                        : ''
                };

            const apiResult = (window.KedrixAPI && window.KedrixAPI.request)
                ? await window.KedrixAPI.request(this.endpoint, payload, { meta: { route: 'check_license' } })
                : null;

            let data = apiResult ? (apiResult.data || {}) : {};
            if (!data || typeof data !== 'object') data = {};

            const status = String(data.license_status || 'missing').trim() || 'missing';
            const accessAllowed = !!data.access_allowed;

            this.updateState({
                email: data.email || normalizedEmail,
                testerId: data.tester_id || normalizedTesterId,
                role: data.role || 'tester',
                status: status,
                type: data.license_type || 'beta',
                batch: data.batch || '',
                expiresAt: data.expires_at || '',
                checkedAt: new Date().toISOString(),
                message: data.message || this.messageForStatus(status),
                accessAllowed: accessAllowed
            });

            if (accessAllowed) {
                if (window.KedrixSessionManager && window.KedrixSessionManager.refresh) {
                    window.KedrixSessionManager.refresh();
                }
                if (window.KedrixLicenseGuard && window.KedrixLicenseGuard.sealLicense) {
                    window.KedrixLicenseGuard.sealLicense({
                        email: data.email || normalizedEmail,
                        testerId: data.tester_id || normalizedTesterId,
                        status,
                        expiresAt: data.expires_at || ''
                    });
                }
                this.hideGate();
                this.syncLegacyPremiumFlags(true);
            } else {
                this.syncLegacyPremiumFlags(false);
                this.showGate(status);
                if (!silent) this.writeGateMessage(this.state.message);
            }

            return data;
        } catch (error) {
            this.updateState({
                status: 'error',
                message: 'Impossibile verificare la licenza beta. Controlla la connessione e riprova.',
                accessAllowed: false,
                checkedAt: new Date().toISOString()
            });
            this.syncLegacyPremiumFlags(false);
            if (window.KedrixLicenseGuard && window.KedrixLicenseGuard.softInvalidate) {
                window.KedrixLicenseGuard.softInvalidate('network_error');
            }
            this.showGate('error');
            this.writeGateMessage(this.state.message);
            return { ok: false, reason: 'network_error', error: String(error && error.message ? error.message : error) };
        } finally {
            this.setGateLoading(false);
        }
    }

    async activateLicense(email, key) {
        const result = await this.verifyRemote({ email, testerId: key, silent: false });
        return !!(result && result.access_allowed);
    }

    startTrial() {
        return false;
    }

    isTrialActive() {
        return false;
    }

    checkPremiumStatus() {
        return this.hasFullPremiumAccess();
    }

    hasFullPremiumAccess() {
        return this.state.accessAllowed === true;
    }

    getCurrentLimits() {
        return this.hasFullPremiumAccess() ? this.limits.allowed : this.limits.denied;
    }

    canAddTransaction(currentCount) {
        if (!this.hasFullPremiumAccess()) return false;
        const limits = this.getCurrentLimits();
        return currentCount < limits.maxTransactions;
    }

    canUseFeature(feature) {
        const limits = this.getCurrentLimits();
        return limits[feature] === true;
    }

    getUpgradeMessage(_feature) {
        return 'Accesso beta richiesto. Inserisci un’email autorizzata o attendi l’attivazione della licenza.';
    }

    getRemainingDays() {
        if (!this.state.expiresAt) return 0;
        const expiry = new Date(this.state.expiresAt);
        if (Number.isNaN(expiry.getTime())) return 0;
        const diff = expiry.getTime() - Date.now();
        return Math.max(0, Math.ceil(diff / 86400000));
    }

    getStatus() {
        return this.state.status || 'missing';
    }

    getPlanInfo() {
        const remainingDays = this.getRemainingDays();
        if (this.state.accessAllowed) {
            return {
                name: this.state.type === 'admin' ? 'Admin' : (this.state.type === 'internal' ? 'Internal' : 'Beta'),
                status: this.state.batch ? `Batch ${this.state.batch}` : 'Attivo',
                remaining: remainingDays > 0 ? `${remainingDays} giorni rimanenti` : 'Accesso attivo',
                color: '#10b981'
            };
        }

        const labels = {
            pending: 'In attesa',
            expired: 'Scaduto',
            revoked: 'Revocato',
            suspended: 'Sospeso',
            missing: 'Non attivo',
            error: 'Verifica richiesta'
        };

        return {
            name: 'Beta',
            status: labels[this.state.status] || 'Non attivo',
            remaining: this.state.message || 'Accesso beta non attivo',
            color: '#6b7280'
        };
    }

    messageForStatus(status) {
        const messages = {
            active: 'Accesso beta attivo.',
            pending: 'Richiesta ricevuta. L’accesso verrà attivato appena il tuo batch sarà aperto.',
            expired: 'La tua licenza beta è scaduta.',
            revoked: 'Il tuo accesso è stato revocato.',
            suspended: 'Il tuo accesso è temporaneamente sospeso.',
            missing: 'Email non ancora autorizzata alla beta.',
            error: 'Impossibile verificare la licenza beta.'
        };
        return messages[status] || messages.missing;
    }

    updateState(nextState) {
        this.state = { ...this.state, ...nextState };
        localStorage.setItem(this.storage.email, this.state.email || '');
        localStorage.setItem(this.storage.testerId, this.state.testerId || '');
        localStorage.setItem(this.storage.role, this.state.role || 'guest');
        localStorage.setItem(this.storage.status, this.state.status || 'missing');
        localStorage.setItem(this.storage.type, this.state.type || 'beta');
        localStorage.setItem(this.storage.batch, this.state.batch || '');
        localStorage.setItem(this.storage.expiresAt, this.state.expiresAt || '');
        localStorage.setItem(this.storage.checkedAt, this.state.checkedAt || '');
        localStorage.setItem(this.storage.message, this.state.message || '');
        if (this.state.email) localStorage.setItem('bw-license-email', this.state.email);
    }

    syncLegacyPremiumFlags(isAllowed) {
        this.isPremium = isAllowed;
        localStorage.setItem('bw-license-valid', isAllowed ? 'valid' : 'invalid');
        localStorage.setItem('bw-license-expiry', this.state.expiresAt || '');
    }

    renderGate() {
        if (document.getElementById('kedrixBetaGate')) return;

        const gate = document.createElement('div');
        gate.id = 'kedrixBetaGate';
        gate.className = 'kedrix-beta-gate is-visible';
        gate.innerHTML = `
            <div class="kedrix-beta-gate__card" role="dialog" aria-modal="true" aria-labelledby="kedrixBetaGateTitle">
                <div class="kedrix-beta-gate__eyebrow">Kedrix — Controlled Beta</div>
                <h1 id="kedrixBetaGateTitle" class="kedrix-beta-gate__title">Accesso beta controllato</h1>
                <p id="kedrixBetaGateMessage" class="kedrix-beta-gate__message">Inserisci l’email con cui hai richiesto l’accesso beta.</p>
                <form id="kedrixBetaGateForm" class="kedrix-beta-gate__form">
                    <label>
                        <span>Email autorizzata</span>
                        <input id="kedrixBetaEmail" type="email" autocomplete="email" placeholder="nome@email.com" required />
                    </label>
                    <label>
                        <span>Tester ID o codice accesso (opzionale)</span>
                        <input id="kedrixBetaCode" type="text" autocomplete="off" placeholder="kdx_..." />
                    </label>
                    <div class="kedrix-beta-gate__actions">
                        <button id="kedrixBetaSubmit" type="submit">Verifica accesso</button>
                        <a href="https://kedrix-site-81e099.gitlab.io/" target="_blank" rel="noreferrer">Richiedi accesso beta</a>
                    </div>
                </form>
                <div id="kedrixBetaGateStatus" class="kedrix-beta-gate__status"></div>
            </div>
        `;

        document.addEventListener('DOMContentLoaded', () => {
            if (!document.body.contains(gate)) {
                document.body.appendChild(gate);
                this.bindGateEvents();
                const emailField = document.getElementById('kedrixBetaEmail');
                const codeField = document.getElementById('kedrixBetaCode');
                if (emailField && this.state.email) emailField.value = this.state.email;
                if (codeField && this.state.testerId) codeField.value = this.state.testerId;
            }
        });

        if (document.body) {
            document.body.appendChild(gate);
            this.bindGateEvents();
            const emailField = document.getElementById('kedrixBetaEmail');
            const codeField = document.getElementById('kedrixBetaCode');
            if (emailField && this.state.email) emailField.value = this.state.email;
            if (codeField && this.state.testerId) codeField.value = this.state.testerId;
        }
    }

    bindGateEvents() {
        const form = document.getElementById('kedrixBetaGateForm');
        if (!form || form.dataset.bound === 'true') return;
        form.dataset.bound = 'true';
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('kedrixBetaEmail')?.value || '';
            const code = document.getElementById('kedrixBetaCode')?.value || '';
            await this.verifyRemote({ email, testerId: code, silent: false });
        });
    }

    injectGateStyles() {
        if (document.getElementById('kedrixBetaGateStyles')) return;
        const style = document.createElement('style');
        style.id = 'kedrixBetaGateStyles';
        style.textContent = `
            .kedrix-beta-gate { position: fixed; inset: 0; z-index: 2147483647; display: none; align-items: center; justify-content: center; padding: 20px; background: rgba(2, 6, 23, 0.88); backdrop-filter: blur(8px); }
            .kedrix-beta-gate.is-visible { display: flex; }
            .kedrix-beta-gate__card { width: min(92vw, 460px); background: #0f172a; color: #e2e8f0; border: 1px solid rgba(148,163,184,0.22); border-radius: 22px; box-shadow: 0 24px 80px rgba(0,0,0,0.45); padding: 24px; }
            .kedrix-beta-gate__eyebrow { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #38bdf8; margin-bottom: 10px; }
            .kedrix-beta-gate__title { margin: 0 0 10px; font-size: 28px; line-height: 1.1; color: #f8fafc; }
            .kedrix-beta-gate__message { margin: 0 0 18px; color: #cbd5e1; font-size: 15px; line-height: 1.45; }
            .kedrix-beta-gate__form { display: grid; gap: 14px; }
            .kedrix-beta-gate__form label { display: grid; gap: 8px; font-size: 13px; color: #cbd5e1; }
            .kedrix-beta-gate__form input { width: 100%; box-sizing: border-box; border-radius: 14px; border: 1px solid rgba(148,163,184,0.28); background: rgba(15,23,42,0.76); color: #f8fafc; padding: 14px 16px; font-size: 15px; outline: none; }
            .kedrix-beta-gate__form input:focus { border-color: #38bdf8; box-shadow: 0 0 0 4px rgba(56,189,248,0.16); }
            .kedrix-beta-gate__actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
            .kedrix-beta-gate__actions button, .kedrix-beta-gate__actions a { appearance: none; border: 0; border-radius: 999px; padding: 12px 16px; font-size: 14px; font-weight: 700; cursor: pointer; text-decoration: none; }
            .kedrix-beta-gate__actions button { background: linear-gradient(135deg, #38bdf8, #14b8a6); color: #082f49; }
            .kedrix-beta-gate__actions a { background: rgba(148,163,184,0.14); color: #f8fafc; }
            .kedrix-beta-gate__status { margin-top: 14px; min-height: 20px; font-size: 13px; color: #fbbf24; }
            .kedrix-beta-gate__status.is-success { color: #34d399; }
            .kedrix-beta-gate__status.is-error { color: #fca5a5; }
            body.kedrix-beta-locked { overflow: hidden !important; }
        `;
        document.head.appendChild(style);
    }

    setGateLoading(isLoading, message = '') {
        const submit = document.getElementById('kedrixBetaSubmit');
        if (submit) {
            submit.disabled = isLoading;
            submit.textContent = isLoading ? 'Verifica…' : 'Verifica accesso';
        }
        if (message) this.writeGateMessage(message, 'neutral');
    }

    writeGateMessage(message, tone = 'neutral') {
        const status = document.getElementById('kedrixBetaGateStatus');
        const paragraph = document.getElementById('kedrixBetaGateMessage');
        if (paragraph && message) paragraph.textContent = message;
        if (!status) return;
        status.textContent = message || '';
        status.classList.remove('is-success', 'is-error');
        if (tone === 'success') status.classList.add('is-success');
        if (tone === 'error') status.classList.add('is-error');
    }

    showGate(status = 'missing') {
        const gate = document.getElementById('kedrixBetaGate');
        if (!gate) return;
        gate.classList.add('is-visible');
        document.body.classList.add('kedrix-beta-locked');
        const message = this.state.message || this.messageForStatus(status);
        const tone = status === 'error' ? 'error' : (status === 'pending' ? 'neutral' : 'neutral');
        this.writeGateMessage(message, tone);
    }

    hideGate() {
        const gate = document.getElementById('kedrixBetaGate');
        if (gate) gate.classList.remove('is-visible');
        document.body.classList.remove('kedrix-beta-locked');
        this.writeGateMessage('Accesso beta attivo.', 'success');
    }

    startHeartbeat() {
        if (this._heartbeatTimer) return;
        this._heartbeatTimer = window.setInterval(async () => {
            if (!this.state || !this.state.email || !this.state.accessAllowed) return;
            const checkedAt = Date.parse(this.state.checkedAt || '') || 0;
            if (Date.now() - checkedAt < 1000 * 60 * 10) return;
            if (window.KedrixLicenseGuard && !window.KedrixLicenseGuard.verifySeal()) {
                this.updateState({
                    status: 'error',
                    message: 'Sessione beta non valida. Verifica nuovamente l’accesso.',
                    accessAllowed: false,
                    checkedAt: new Date().toISOString()
                });
                this.syncLegacyPremiumFlags(false);
                this.showGate('error');
                return;
            }
            await this.verifyRemote({
                email: this.state.email,
                testerId: this.state.testerId,
                silent: true
            });
        }, 1000 * 60 * 3);
    }

}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = KedrixLicense;
}

try { globalThis.KedrixLicense = KedrixLicense; } catch(e) {}
try { window.KedrixLicense = KedrixLicense; } catch(e) {}
try { globalThis.BudgetWiseLicense = KedrixLicense; } catch(e) {}
try { window.BudgetWiseLicense = KedrixLicense; } catch(e) {}
