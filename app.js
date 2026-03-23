const KEDRIX_BUILD = (window.KedrixRuntimeConfig && typeof window.KedrixRuntimeConfig.getBuild === 'function')
    ? window.KedrixRuntimeConfig.getBuild()
    : '20260322_refactor_i18n_v1a';
const KEDRIX_RELEASE_CHANNEL = (window.KedrixRuntimeConfig && typeof window.KedrixRuntimeConfig.getChannel === 'function')
    ? window.KedrixRuntimeConfig.getChannel()
    : 'beta';
const KEDRIX_FEEDBACK_EMAIL = 'feedback@kedrix.ai';

function resolveRuntimeLang(appLike) {
    try {
        if (window.KedrixI18n && typeof window.KedrixI18n.resolveRuntimeLanguage === 'function') {
            return window.KedrixI18n.resolveRuntimeLanguage(appLike);
        }
        const htmlLang = String(document.documentElement?.lang || '').trim().toLowerCase();
        return htmlLang || 'it';
    } catch (_e) {
        return 'it';
    }
}

function resolveRuntimeLangLocal(appLike) {
    return resolveRuntimeLang(appLike);
}

function getSessionId() {
    try {
        return window.KedrixSessionManager && typeof window.KedrixSessionManager.getSessionId === 'function'
            ? window.KedrixSessionManager.getSessionId()
            : null;
    } catch (_e) {
        return null;
    }
}
// ========= LOCALE MAP GLOBALE =========
const LOCALE_MAP = { 
    it: 'it-IT', 
    en: 'en-GB', 
    es: 'es-ES', 
    fr: 'fr-FR' 
};

// ========= CLASSE PRINCIPALE =========
class Kedrix {
    legacyStorageKey(key) {
        return key.replace(/^kedrix/, 'budgetwise');
    }

    readStorage(key) {
        const value = localStorage.getItem(key);
        if (value !== null) return value;
        const legacyKey = this.legacyStorageKey(key);
        return legacyKey !== key ? localStorage.getItem(legacyKey) : null;
    }

    writeStorage(key, value) {
        localStorage.setItem(key, value);
        const legacyKey = this.legacyStorageKey(key);
        if (legacyKey !== key) localStorage.removeItem(legacyKey);
    }

    removeStorage(key) {
        localStorage.removeItem(key);
        const legacyKey = this.legacyStorageKey(key);
        if (legacyKey !== key) localStorage.removeItem(legacyKey);
    }

    migrateLegacyStorageKeys() {
        const mappings = [
            'kedrix-category-rules','kedrix-show-all-expenses','kedrix-fixed-date-format','kedrix-custom-colors','kedrix-custom-colors-theme','kedrix-privacy-hidden','kedrix-first-run-seen','kedrix-demo-loaded','kedrix-theme','kedrix-data','kedrix-custom-categories','kedrix-onboarding-completed'
        ];
        mappings.forEach((key) => {
            const legacyKey = this.legacyStorageKey(key);
            if (localStorage.getItem(key) === null && legacyKey !== key) {
                const legacyValue = localStorage.getItem(legacyKey);
                if (legacyValue !== null) localStorage.setItem(key, legacyValue);
            }
        });
    }
    constructor() {
        // ========== DATI INIZIALI ==========
        this.license = null; // Inizializza a null, verrà impostato dopo
        
        this.data = {
            incomes: [],
            fixedExpenses: [],
            variableExpenses: {},
            savingsPercent: 0,
            savingsGoal: 0,
            savingsPot: 0,
            threshold: 50,
            language: (window.KedrixI18n ? window.KedrixI18n.resolveRuntimeLanguage() : 'it'),
            fixedMatchAliases: {},
            fixedMatchDismissed: {},
            // Periodo: viene inizializzato dopo l'assegnazione di this.data
            periodStart: '',
            periodEnd: ''
        };

        // Inizializza il periodo di default (oggi/+28) o basato su stipendio, se presente nei dati caricati.
        this.data.periodStart = this.getDefaultPeriodStart();
        this.data.periodEnd = this.getDefaultPeriodEnd();
        
        this.chart = null;
        this.categoryExpenses = {};
        
        // ========== REGOLE CATEGORIE APPRESE (chiave -> { category, confidence }) ==========
        this.categoryRules = this.migrateCategoryRules(JSON.parse(localStorage.getItem('bw_category_learning')) || JSON.parse(this.readStorage('kedrix-category-rules')) || {});
        this.CATEGORY_CONFIDENCE_THRESHOLD = 2; // >= 2 → auto-applica
        this.saveCategoryLearning();
        
        // ========== CATEGORIE GERARCHICHE ==========
        this.categoryTree = this.loadCategoryTree();
        this.defaultCategories = this.categoryTree.filter(cat => !!cat.isDefault).map(cat => cat.label);
        this.customCategories = this.categoryTree.filter(cat => !cat.isDefault).map(cat => cat.label);

        // ========== UI STATE ==========
        this.showAllExpenses = this.readStorage('kedrix-show-all-expenses') === 'true';
                // ========== FORMATO DATE SPESE FISSE ==========
this.fixedDateFormat = this.readStorage('kedrix-fixed-date-format') || 'days';
                // ========== STATO RICERCA ==========
        this.searchTerm = '';
        this.searchCategoryFilter = 'all';
        this.filteredExpenses = [];
        // ========== COLORI PERSONALIZZATI ==========
        const savedColors = this.readStorage('kedrix-custom-colors');
        if (savedColors) {
            this.customColors = JSON.parse(savedColors);
        } else {
            this.customColors = null;
        }

        
        // Tema associato ai colori personalizzati (per evitare che blocchino la dark mode)
        this.customColorsTheme = this.readStorage('kedrix-custom-colors-theme') || null;
        this.isPrivacyHidden = this.readStorage('kedrix-privacy-hidden') !== 'false';
// ========== TRADUZIONI ==========
        this.translations = {
            it: {
                never: "Mai",
currentPaceReachOn: "Al ritmo attuale, raggiungerai l'obiettivo il {date}",
goalNotReachable: "Con questi parametri non raggiungerai l'obiettivo",
savingsSuggestionTitle: "Suggerimento",
applySuggestion: "Applica suggerimento",
increaseToPercentToArriveEarlier: "Aumenta al {percent}% per arrivare {months} mesi prima!",
increaseToPercentToArriveEarlier_one: "Aumenta al {percent}% per arrivare {months} mese prima!",
suggestionAppliedToast: "💡 Suggerimento applicato: {percent}% di risparmio",
                onboardingDemo: "✨ Carica demo",
                loadDemo: "Carica demo",
                savingsPotLabel: 'Piano risparmi',
searchPlaceholder: 'Cerca per descrizione, categoria o importo',
maybeLater: 'Forse dopo',
                betaLaunchTitle: 'Programma Beta',
                betaLaunchKicker: 'Decision Intelligence Finance',
                betaLaunchSubtitle: 'Kedrix non è una semplice budgeting app: è un motore decisionale finanziario pensato per tester selezionati.',
                betaPillarAudienceLabel: 'Utenti ideali',
                betaPillarAudience: 'early adopters, tester fidati, demo guidate',
                betaPillarMessageLabel: 'Posizionamento',
                betaPillarMessage: 'Decision Intelligence Finance, non semplice budgeting',
                betaPillarGoalLabel: 'Obiettivo beta',
                betaPillarGoal: 'raccolta feedback di qualità prima del rilascio pubblico',
                installAppBtn: 'Installa Kedrix',
                shareBetaInviteBtn: 'Condividi invito beta',
                copyBetaInviteBtn: 'Copia testo invito',
                installPromptReady: 'Kedrix è pronta da installare su questo dispositivo.',
                installOpenStandalone: "Kedrix è già installata. Aprila dalla schermata Home come un'app.",
                installIosHint: 'Su iPhone: Condividi → Aggiungi a Home per avere Kedrix come app.',
                installUnsupportedHint: "Installazione non disponibile qui: usa Chrome o Safari mobile per l'esperienza app.",
                betaInviteShared: 'Invito beta condiviso.',
                betaInviteCopied: 'Testo invito copiato negli appunti.',
                betaInviteUnavailable: 'Condivisione non disponibile su questo dispositivo.',
                betaInviteError: 'Operazione non completata. Riprova.',
                resetColors: 'Ripristina colori predefiniti',
                colorsTitle: 'Personalizza colori',
                colorsSubtitle: 'Scegli i tuoi colori preferiti per personalizzare l\'app.',
                colorAccentLabel: 'Colore accento',
                colorAccentLightLabel: 'Accento chiaro',
                colorCardBgLabel: 'Sfondo card',
                colorTextPrimaryLabel: 'Testo principale',
                colorTextSecondaryLabel: 'Testo secondario',
                colorBgLabel: 'Sfondo pagina',
                colorSuccessLabel: 'Successo',
                colorDangerLabel: 'Errore',
                colorWarningLabel: 'Avviso',
                colorBorderLabel: 'Bordo',
                fixedPaid: '✅ Pagata',
                fixedPlanned: ' Prevista',
                fixedDue: 'Scadenza',
                fixedFound: 'Trovata',
                budget: 'Budget giornaliero',
                remaining: 'Rimanenza',
                days: 'Giorni rimasti',
                period: 'Periodo',
                periodStartedWith: 'Periodo iniziato con: {desc} del {date}',
                totalIncome: 'Totale entrate',
                startGuide: '👋 Inizia inserendo le tue entrate nella sezione qui sotto!',
                incomes: '🏦 Entrate del periodo',
                fixed: '📌 Spese fisse mensili',
                variable: '🧾 Spese variabili',
                chart: '📊 Distribuzione spese',
                balanceChartTitle: '📈 Entrate vs Uscite',
                balanceChartNote: 'Aggiungi entrate o spese per vedere il grafico',
                balanceChartIncome: 'Entrate',
                balanceChartFixed: 'Fisse',
                balanceChartVariable: 'Variabili',
                balanceChartRemaining: 'Rimanenza',
                monthlyBalanceTitle: '📉 Trend saldo mensile',
                monthlyBalanceNote: 'Andamento mensile di entrate e uscite',
                monthlyBalanceEmpty: 'Nessun dato storico disponibile<br>Importa movimenti o inserisci spese',
                monthlyBalanceDataset: 'Saldo mensile',
                totalExpensesLabel: 'Totale spese',
                transactionsLabel: 'transazioni',
                comparisonMoreThanLastMonth: 'in più rispetto al mese scorso',
                comparisonLessThanLastMonth: 'in meno rispetto al mese scorso',
                youLabel: 'Tu',
                assistant: 'Assistente Finanziario AI',
                savings: 'Obiettivo risparmio',
                settings: 'Impostazioni',
                badge: 'multiplo',
                addIncome: '➕ Aggiungi entrata',
                addFixed: '➕ Aggiungi spesa fissa',
                addExpense: '➕ Aggiungi spesa',
                resetDay: '🗑️ Cancella spese del giorno',
                applySavings: 'Applica risparmio',
                backup: 'Scarica backup',
                restore: 'Ripristina',
                resetAll: 'Reset completo',
                resetFixed: '🗑️ Reset spese fisse',
                export: ' Esporta in Calendar',
                calendarToolsTitle: 'Calendar',
                calendarToolsSubtitle: 'Mostra le scadenze del periodo nel tuo calendario senza lasciarle in Home.',
                send: 'Invia',
                incomeDesc: 'Descrizione (es. Stipendio)',
                incomeAmount: 'Importo €',
                incomeDateLabel: 'Data',
                fixedName: 'Nome (es. Mutuo)',
                fixedAmount: 'Importo €',
                fixedDay: 'Giorno (es. 27)',
                expenseName: 'Cosa hai comprato?',
                expenseAmount: '€',
                expenseSubCategory: 'Sottocategoria (facoltativa)',
                chatPlaceholder: 'Es. Quanto posso risparmiare questo mese?',
                dateLabel: 'Seleziona data:',
                dayLabel: 'Giorno del mese',
                endDateLabel: 'Data scadenza (fine)',
                percentLabel: 'Percentuale su entrate (%)',
                goalLabel: 'Obiettivo (€)',
                thresholdLabel: '🔔 Soglia avviso (€)',
                languageLabel: '🌍 Lingua',
                backupLabel: 'Backup dati',
                micFixed: 'Tocca e di\' tutto in una frase',
                micVariable: 'Tocca per parlare',
                helpFixed: 'Verrà conteggiata automaticamente ogni mese fino alla scadenza',
                chartNote: 'Aggiungi spese per vedere il grafico',
                noIncome: 'Nessuna entrata',
                noFixed: 'Nessuna spesa fissa',
                noVariable: 'Nessuna spesa in questo giorno',
                noMatchingExpenses: 'Nessuna spesa corrisponde ai filtri selezionati',
                welcomeMessage: 'Ciao! Sono il tuo assistente finanziario. Chiedimi qualsiasi cosa sul tuo budget!',
                suggestion1: 'Risparmia 100€',
                suggestion2: 'Simula aumento',
                suggestion3: 'Obiettivo',
                suggestion4: 'Categoria top',
                assistantName: 'Assistente',
                incomeAdded: '✅ Entrata aggiunta!',
                incomeDeleted: '🗑️ Entrata eliminata',
                fixedAdded: '✅ Spesa fissa aggiunta!',
                fixedDeleted: '🗑️ Spesa eliminata',
                expenseAdded: '✅ Spesa aggiunta!',
                expenseDeleted: '🗑️ Spesa eliminata',
                dayReset: '🗑️ Spese del giorno cancellate',
                savingsApplied: '💰 Risparmio applicato!',
                backupDownloaded: '💾 Backup scaricato!',
                dataRestored: '📂 Dati ripristinati!',
                resetCompleted: '🔄 Reset completato',
                resetFixedCompleted: '🗑️ Spese fisse cancellate',
                calendarExported: ' Calendario esportato!',
                fillFields: '⚠️ Compila tutti i campi',
                invalidDay: '⚠️ Giorno non valido (1-31)',
                thresholdExceeded: '⚠️ Attenzione! Hai superato la soglia di ',
                active: '🟢 Attivo',
                expired: '🔴 Scaduto',
                dueToday: 'Scade oggi',
                daysAgo: 'Scaduta da {days} giorni',
                inDays: 'Tra {days} giorni',
                today: 'Oggi',
                yearSing: 'anno',
                yearPlur: 'anni',
                monthSing: 'mese',
                monthPlur: 'mesi',
                daySing: 'giorno',
                dayPlur: 'giorni',
                andConj: 'e',
                confirmReset: 'Questo reset cancellerà tutte le entrate e tutte le spese variabili. Le spese fisse NON verranno cancellate. Vuoi continuare?',
                confirmResetFixed: 'Vuoi cancellare tutte le spese fisse salvate?',
                noGoal: 'Non hai ancora impostato un obiettivo di risparmio. Vai nella sezione 🎯 e impostalo!',
                noExpenses: 'Non hai ancora spese registrate. Aggiungine qualcuna per avere un\'analisi!',
                footerText: 'Stato periodo',
                footerPeriodLabel: 'Periodo stipendio',
                footerDaysLabel: 'Giorni rimanenti',
                footerBudgetLabel: 'Budget medio',
                wiseScoreStatusPrefix: 'Stato finanziario',
                footerFeatures: 'Periodo operativo sempre basato su stipendio → stipendio',
                footerBrandSignature: 'Kedrix — Personal Finance Engine',
                fixedVoiceButton: 'Inserisci spesa fissa con voce',
                variableVoiceButton: 'Inserisci con voce',
                homeManualOpen: 'Apri inserimento manuale',
                homeQuickActionsTitle: 'Inserimento rapido variabili',
                homePriorityKicker: 'Appena apri Kedrix, parti da qui',
                homeVoiceVariableButton: 'Inserisci variabile con voce',
                heroBudgetEyebrow: 'BUDGET GIORNALIERO',
                spendingPace: 'Ritmo di spesa',
                spendingPaceSafe: '🟢 Zona sicura',
                spendingPaceOnTrack: '🟡 In linea',
                spendingPaceWarning: '🟠 Attenzione',
                spendingPaceRisk: '🔴 Rischio',
                wiseForecastTitle: '🔮 WiseForecast',
                wiseForecastSubtitle: 'Saldo stimato a fine periodo con rimanenza già allineata alle fisse residue del periodo.',
                wiseForecastEndLabel: 'Saldo stimato fine periodo',
                wiseForecastAvgLabel: 'Media variabili / giorno',
                wiseForecastPositive: '🟢 Chiusura positiva stimata',
                wiseForecastNegative: '🔴 Rischio chiusura negativa',
                wiseForecastNeutral: '🟡 Chiusura in equilibrio',
                wiseForecastDetailRemaining: 'Rimanenza attuale',
                wiseForecastDetailFixedResidual: 'Fisse residue nel periodo',
                wiseForecastDetailVariableProjection: 'Spesa variabile prevista',
                wiseForecastRiskDayLabel: 'Giorno di rischio finanziario',
                wiseForecastRiskDayPositive: '✔ Con questo ritmo chiudi il periodo positivo',
                wiseForecastRiskDayNegative: '⚠ Con l\'attuale ritmo di spesa entrerai in deficit il {date}',
                wiseForecastRiskDayAlreadyDeficit: '⚠ Sei già in deficit in questo periodo',
                wiseForecastSafeDaysLabel: 'Giorni sicuri',
                wiseForecastSafeDaysPositive: '✔ Con questo ritmo sei tranquillo per tutto il periodo',
                wiseForecastSafeDaysNegative: '⚠ Con questo ritmo sei tranquillo per ancora {days} giorni',
                wiseForecastSafeDaysNoCoverage: '⚠ Non hai copertura sicura per il periodo',
                forecastSimulatorTitle: 'Simula una spesa',
                forecastSimulatorHint: 'Anteprima veloce: non modifica i dati reali.',
                forecastSimulatorPlaceholder: 'Es. 120',
                forecastSimulatorForecastLabel: 'Nuovo forecast',
                forecastSimulatorBudgetLabel: 'Nuovo budget giornaliero',
                forecastSimulatorEmpty: 'Inserisci un importo per vedere l\'impatto immediato.',
                wiseForecastAdvancedDailyAverage: 'Media giornaliera',
                wiseForecastAdvancedDaysRemaining: 'Giorni rimanenti',
                wiseForecastAdvancedFixedPlanned: 'Fisse previste',
                wiseForecastAdvancedSimulateReduction: 'Simula riduzione spesa',
                wiseForecastAdvancedNewForecast: 'Nuovo saldo previsto',
                wiseForecastAdvancedRiskGreen: 'Gestione sostenibile',
                wiseForecastAdvancedRiskWarning: 'Attenzione ai consumi',
                wiseForecastAdvancedRiskDanger: 'Rischio scoperto',
                safeToSpendLabel: 'Spesa sicura oggi',
                safeToSpendHint: 'Quanto puoi spendere oggi senza compromettere il periodo.',
                safeToSpendPositive: 'Puoi spendere oggi fino a {amount}',
                safeToSpendNegative: 'Oggi meglio restare prudente',
                dailyCheckInTitle: 'WiseMind™ · Check di oggi',
                dailyCheckInSubtitle: 'Lettura rapida del tuo ritmo finanziario quotidiano.',
                dailyCheckInWaiting: 'Aggiungi un movimento o un\'entrata per sbloccare un check più preciso.',
                dailyCheckInNoSpend: '✔ Nessuna spesa variabile registrata oggi. Ottimo controllo fin qui.',
                dailyCheckInPositive: '✔ Oggi stai spendendo {amount} in meno della tua media. Continua così.',
                dailyCheckInNeutral: '• Oggi sei in linea con la tua media. Mantieni questo ritmo.',
                dailyCheckInWarning: '⚠ Oggi sei sopra la tua media di {amount}. Se continui così il forecast scende a {forecast}.',
                dailyCheckInNegative: '⚠ Il periodo è sotto pressione: con l\'attuale ritmo il forecast resta a {forecast}.',
                privacyHide: '🙈 Nascondi importi',
                privacyShow: '👁️ Mostra importi',
                tabAnalysis: '📊 Analisi',
                tabAI: '🧠 AI',
                tabHomePlain: 'Home',
                voiceExampleHint: 'Es.: "12 euro bar"',
                categoryAlimentari: 'Alimentari',
                categoryTrasporti: 'Trasporti',
                categorySvago: 'Svago',
                categorySalute: 'Salute',
                categoryAbbigliamento: 'Abbigliamento',
                categoryAltro: 'Altro',
                
                // Onboarding
                onboardingWelcome: '👋 Benvenuto in Kedrix',
                onboardingStep1: 'Kedrix non usa il classico budget mensile. Calcola quanto puoi spendere oggi fino al prossimo stipendio.',
                onboardingStep2: '📌 Aggiungi le spese fisse come affitto, mutuo, bollette o abbonamenti per rendere il calcolo più preciso.',
                onboardingStep3: '🧾 Registra le spese quotidiane manualmente o con la voce. Esempi: “benzina 40”, “bar 5”, “spesa 25”.',
                onboardingStep4: '📊 Controlla il budget giornaliero, il saldo disponibile e il forecast per capire quanto puoi spendere oggi in sicurezza.',
                onboardingStep5: '🖨️ Nel modulo Analisi puoi vedere la distribuzione delle spese. Cliccando su una categoria del grafico puoi stampare o salvare il riepilogo dettagliato.',
                onboardingStep6: '🤖 Kedrix include anche demo guidata, import movimenti, memorizzazione intelligente delle categorie e controllo delle spese duplicate.',
                onboardingNext: 'Avanti →',
                onboardingSkip: 'Salta',
                
                // Import review
                importReview: '📋 Revisione spese importate',
                importConfirm: '✅ Conferma',
                importCancel: '✕ Annulla',
                importCategory: 'Categoria',
                importLearn: '📌 L\'app ricorderà questa scelta',
                importSuggested: 'Suggerito: {cat} (conferma per imparare)',
                
                // Traduzioni CSV
                csvTitle: 'Importa movimenti bancari',
                csvSubtitle: 'Scarica l\'estratto conto dalla tua banca in formato CSV o Excel (.xlsx)',
                csvChooseFile: 'Scegli file CSV o Excel',
                csvNoFile: 'Nessun file selezionato',
                csvImportBtn: '📥 Importa CSV / Excel',
                csvDateFormat: 'Formato data',
                csvSeparator: 'Separatore',
                csvComma: 'Virgola (,)',
                csvSemicolon: 'Punto e virgola (;)',
                csvTab: 'Tabulazione',
                csvPreview: 'Anteprima',
                
                // Gestione categorie
                manageCategories: '📂 Gestisci categorie',
                addCategory: '➕ Aggiungi categoria',
                categoryName: 'Nome categoria',
                saveCategory: 'Salva',
                deleteCategory: '🗑️ Elimina',
                confirmDeleteCategory: 'Sei sicuro di voler eliminare la categoria "{name}"?',
                categoryAlreadyExists: 'Categoria già esistente',
                categoryAdded: '✅ Categoria aggiunta!',
                categoryDeleted: '🗑️ Categoria eliminata',
                categoryUpdated: '✏️ Categoria aggiornata',
                defaultCategories: 'Categorie predefinite',
                customCategories: 'Le tue categorie',
                noCustomCategories: 'Nessuna categoria personalizzata',

                // NUOVE CHIAVI PER I TAB
                tabHome: '🏠 Home',
                tabIncomes: 'Entrate',
                tabFixed: '📌 Fisse',
                tabVariable: '🧾 Variabili',
                tabTools: '🛠️ Strumenti',

                // NUOVE CHIAVI PER SKIP ROWS
                skipRowsLabel: 'Salta righe iniziali',
                headerRowManualLabel: 'Riga intestazione',
                skipHelp: '📌 Per file con righe iniziali (es. Fineco): salta le righe fino a trovare le colonne',

                docTitle: '💠 Kedrix - Personal Finance Engine',
                subtitle: 'Stipendio a stipendio — gestione intelligente con AI',
                add: 'Aggiungi',
                dateHint: 'gg/mm/aaaa',
                autoRecommended: 'Auto (consigliato)',
                ddmmyyyy: 'GG/MM/AAAA',
                mmddyyyy: 'MM/DD/AAAA',
                positiveBalance: 'Saldo positivo',
                negativeBalance: 'Attenzione: saldo negativo',
                vsYesterday0: 'rispetto a ieri: 0%',
                detailTotal: 'Totale: {total}',
                noExpensesShort: 'Nessuna spesa',
                voiceSpeak: 'Parlare...',
                voiceTap: 'Tocca per parlare',
                error: 'Errore',
                genericExpense: 'Spesa',
                voiceDetected: '✅ Rilevato: {desc} {amount}€',
                voiceFixedDetected: '✅ Spesa fissa rilevata: {name} {amount}€ giorno {day}',
                invalidFile: '❌ File non valido',
                fixedExpense: 'Spesa fissa',
                everyMonthOnDay: 'Ogni mese il giorno',
                featureInDev: 'Funzionalità in sviluppo',
                csvTemplateDetected: '📌 Rilevato template CSV: "{name}".\nVuoi usarlo automaticamente?',
                csvFieldDate: ' Data',
                csvFieldDescription: '📝 Descrizione',
                csvFieldAmount: '💰 Importo',
                csvFieldCategory: '🏷️ Categoria',
                csvFieldIgnore: '❌ Ignora',
                csvSaveAsTemplate: 'Salva come template',
                csvTemplateNamePlaceholder: 'Nome template (es. Intesa, Unicredit...)',
                csvColumnN: 'Colonna {n}',
                empty: 'vuota',
                csvMappingRequired: '❌ Devi mappare Data, Descrizione e Importo!',
                csvEmpty: '❌ CSV vuoto',
                importCancelled: '⏸️ Import annullato',
                csvImportError: '❌ Errore durante l\'import CSV',
                fileReadError: '❌ Errore durante la lettura del file',
                importCompleted: '✅ Import completato!\n➕ Aggiunti: {added}{dupLine}',
                duplicatesSkipped: '⚠️ Duplicati saltati: {dup}',
                onboardingSubtitle: 'Scopri come controllare il tuo ciclo finanziario da stipendio a stipendio',
                onboardingDemo: "✨ Carica demo",
                onboardingEmpty: 'Inizia vuoto',
                you: 'Tu',
                adviceRed: '⚠️ Sei in rosso! Rivedi le spese.',
                adviceLowRemaining: '⚠️ Attenzione: ti rimangono solo {remaining} per i prossimi giorni.',
                adviceGood: '💪 Vai bene! Hai ancora {remaining} di margine.',
                aiSuggestionsTitle: 'Suggerimenti AI',
                aiTopCategoryMessage: 'Hai speso {amount} in {category}. Riducendo del 10% ({reduction}), potresti destinare quella cifra al risparmio.',
                aiTopCategoryAction: 'Imposta obiettivo',
                aiTransportMessage: 'Hai speso {amount} in trasporti. Usando più mezzi pubblici, potresti risparmiare circa {saving} al mese.',
                aiTransportAction: 'Scopri come',
                aiLeisureMessage: 'Hai speso {amount} in svago. Limitando le uscite a 2 a settimana, potresti risparmiare {saving}.',
                aiLeisureAction: 'Pianifica',
                aiSmartBadge: 'intelligente',
                csvMappingTitle: '📋 Mappa le colonne del file CSV',
                csvMappingInstructionsHtml: '<strong>📌 Istruzioni:</strong> Associa ogni colonna del tuo file al campo corrispondente. Le righe con importo positivo saranno considerate <strong>entrate</strong>, quelle negative <strong>spese</strong>.',
                csvMappingFieldsTitle: 'Associazione campi:',
                showAllExpenses: 'Mostra tutte le spese del periodo',
                edit: 'Modifica',
                categoriesSectionTitle: 'Gestione categorie',
                manageCustomCategories: 'Gestisci categorie personalizzate',
                newCategoryLabel: 'Nuova categoria',
                newCategoryPlaceholder: 'es. Viaggi',
                defaultCategoriesTitle: 'Categorie predefinite',
                yourCategoriesTitle: 'Le tue categorie',
                close: 'Chiudi',
                                // NUOVE TRADUZIONI
                fixedDateFormatDays: '🗓️ Giorni rimanenti',
                fixedDateFormatMonths: '📆 Mesi e giorni',
                fixedDateFormatHelp: 'Scegli come visualizzare le scadenze delle spese fisse',
                fixedSummaryTotalLabel: 'Totale fisse',
                fixedSummaryVoicesMeta: '{count} voci',
                fixedSummaryPaidLabel: 'Pagate',
                fixedSummaryRecognizedMeta: '{count} riconosciute',
                fixedSummaryDueLabel: 'Da assorbire',
                fixedSummaryPlannedMeta: '{count} ancora previste',
                variableSummaryTotalLabel: 'Totale variabili',
                variableSummaryCountLabel: 'Movimenti',
                variableSummaryCountMeta: '{count} nel periodo',
                variableSummaryAverageLabel: 'Media per movimento',
                variableSummaryAverageMeta: 'Periodo stipendio→stipendio',
                fixedManualMatchTitle: '⚠ Possibile corrispondenza trovata',
                fixedManualMatchText: 'Stesso importo e data compatibile, ma descrizione diversa.',
                fixedManualMatchConfirm: 'Conferma equivalenza',
                fixedManualMatchReject: 'Non è questa',
                noFixedInPeriod: 'Nessuna spesa fissa nel periodo',
                futureFixedTitle: 'Spese future fuori periodo',
                futureFixedSubtitle: 'Visibili ma non conteggiate nella rimanenza attuale.',
                futureFixedEmpty: 'Nessuna spesa futura rilevante fuori periodo',
                fixedCurrentSectionTitle: 'Fisse del periodo attivo',
                fixedCurrentSectionSubtitle: 'Mostra solo le scadenze che rientrano nel periodo stipendio→stipendio.',
                fixedSummarySectionTitle: 'Riepilogo periodo',
                fixedSummarySectionSubtitle: 'Totali rapidi per leggere impatto, pagate e previste senza scorrere tutta la lista.',
                variableSectionTitle: 'Movimenti del periodo',
                variableSectionSubtitle: 'Elenco filtrabile delle spese variabili registrate nel periodo attivo.',
                variableLinkedBadge: '🔗 Collegata banca',
                variableLinkedMeta: 'Movimento importato collegato senza doppio conteggio.',
                futureFixedCountMeta: '{count} voci in arrivo',
                futureFixedNotCounted: 'Fuori periodo',
                remainingTermLabel: 'Tempo residuo',
                noEndDateLabel: 'Senza scadenza',
                yearShort: 'a',
                monthShort: 'm',
                dayShort: 'g',
                toggleShowList: 'Mostra lista',
                toggleHideList: 'Nascondi lista',
                toggleShowFuture: 'Mostra future',
                toggleHideFuture: 'Nascondi future',
                hideOptions: 'Nascondi opzioni',
                excelSheet: 'Foglio Excel',
                excelHeaderRow: 'Riga intestazione',
                row1: 'Riga 1',
                row2: 'Riga 2',
                row3: 'Riga 3',
                rowNone: 'Nessuna (auto)',
                never: 'Mai',
                percent0: '0%',
                percent15: '15%',
                percent30: '30%',
                currentPlan: ' Piano attuale',
                currentPlanMessage: 'Con questi parametri non raggiungerai l\'obiettivo',
                endPeriod: 'Fine periodo',
                upgradeBanner: '🚀 Upgrade a Premium',
                upgradeBannerText: 'Sblocca funzionalità illimitate e l\'assistente AI!',
                upgrade: 'Upgrade',
                free: '🆓 Free',
                premium: '💎 Premium',
                transactionsLimit: '50 transazioni/mese',
                categoriesLimit: '3 categorie base',
                popular: 'POPOLARE',
                price: '€4.99',
                perMonth: '/mese',
                unlimitedTransactions: '✅ Transazioni illimitate',
                customCategories: '✅ Categorie personalizzate',
                excelImport: '✅ Importazione CSV/Excel',
                advancedAI: '✅ Assistente AI avanzato',
                detailedReports: '✅ Report dettagliati',
                voiceRecognition: '✅ Riconoscimento vocale',
                freeTrial: '🎁 Prova Gratuita',
                freeTrialText: '7 giorni di Premium, zero rischi!',
                startTrial: '🚀 Inizia Prova Gratuita',
                activateLicense: '🔑 Attiva Licenza',
                allCategories: 'Tutte le categorie',
                clearFilters: 'Cancella filtri',
                features: {
                    csvImport: '✅ Importazione CSV',
                    aiAssistant: '✅ Assistente AI',
                    cloudSync: '✅ Sincronizzazione cloud',
                    unlimitedTransactions: '✅ Transazioni illimitate',
                    customCategories: '✅ Categorie personalizzate',
                    excelImport: '✅ Importazione CSV/Excel',
                    advancedAI: '✅ Assistente AI avanzato',
                    detailedReports: '✅ Report dettagliati',
                    voiceRecognition: '✅ Riconoscimento vocale'
                }
            },
            en: {
                never: "Never",
currentPaceReachOn: "At the current pace, you'll reach the goal on {date}",
goalNotReachable: "With these parameters you won't reach the goal",
savingsSuggestionTitle: "Tip",
applySuggestion: "Apply suggestion",
increaseToPercentToArriveEarlier: "Increase to {percent}% to reach the goal {months} months earlier!",
increaseToPercentToArriveEarlier_one: "Increase to {percent}% to reach the goal {months} month earlier!",
suggestionAppliedToast: "💡 Suggestion applied: {percent}% savings",
                onboardingDemo: "✨ Load demo",
                loadDemo: "Load demo",
                upgradeBanner: '🚀 Upgrade to Premium',
upgradeBannerText: 'Unlock unlimited features and AI assistant!',
upgrade: 'Upgrade',
free: '🆓 Free',
premium: '💎 Premium',
transactionsLimit: '50 transactions/month',
categoriesLimit: '3 base categories',
popular: 'POPULAR',
price: '€4.99/month',
freeTrial: '🎁 Free Trial',
freeTrialText: '7 days of Premium, zero risk!',
startTrial: '🚀 Start Free Trial',
activateLicense: '🔑 Activate License',
maybeLater: 'Maybe later',
                betaLaunchTitle: 'Beta Program',
                betaLaunchKicker: 'Decision Intelligence Finance',
                betaLaunchSubtitle: 'Kedrix is not a simple budgeting app: it is a financial decision engine built for selected testers.',
                betaPillarAudienceLabel: 'Ideal users',
                betaPillarAudience: 'early adopters, trusted testers, guided demos',
                betaPillarMessageLabel: 'Positioning',
                betaPillarMessage: 'Decision Intelligence Finance, not simple budgeting',
                betaPillarGoalLabel: 'Beta goal',
                betaPillarGoal: 'collect high-quality feedback before public release',
                installAppBtn: 'Install Kedrix',
                shareBetaInviteBtn: 'Share beta invite',
                copyBetaInviteBtn: 'Copy invite text',
                installPromptReady: 'Kedrix is ready to install on this device.',
                installOpenStandalone: 'Kedrix is already installed. Open it from the Home screen like an app.',
                installIosHint: 'On iPhone: Share → Add to Home Screen to get Kedrix as an app.',
                installUnsupportedHint: 'Install is not available here: use Chrome or mobile Safari for the app-like experience.',
                betaInviteShared: 'Beta invite shared.',
                betaInviteCopied: 'Invite text copied to clipboard.',
                betaInviteUnavailable: 'Sharing is not available on this device.',
                betaInviteError: 'Action could not be completed. Please try again.',
                allCategories: '📋 All categories',
clearFilters: 'Clear filters',
maybeLater: 'Maybe later',

// Nella sezione del widget risparmio (cerca "savingsWidgetTitle"):
savingsWidgetTitle: 'Raggiungerai il tuo obiettivo',
never: 'Mai',
percent0: '0%',
percent15: '15%',
percent30: '30%',
currentPlan: 'Piano attuale',
currentPlanMessage: 'Con questi parametri non raggiungerai l\'obiettivo',

// Nella sezione import avanzato (cerca "excelSheet"):
excelSheet: 'Excel Sheet',
excelSheetPlaceholder: 'Load an Excel file',
rowNone: 'None (auto)',
excelHelp: '⚠️ Excel files are converted automatically',
hideOptions: 'Hide options',
advancedOptions: '⚙️ Advanced options',

// Nella sezione upgrade banner:
upgradeBanner: '🚀 Upgrade to Premium',
upgradeBannerText: 'Unlock unlimited features and AI assistant!',
upgrade: 'Upgrade',
free: '🆓 Free',
premium: '💎 Premium',
transactionsLimit: '50 transactions/month',
categoriesLimit: '3 base categories',
popular: 'POPULAR',
price: '€4.99/month',
freeTrial: '🎁 Free Trial',
freeTrialText: '7 days of Premium, zero risk!',
startTrial: '🚀 Start Free Trial',
activateLicense: '🔑 Activate License',
                savingsPotLabel: 'Savings plan',
searchPlaceholder: 'Search by description, category or amount',
maybeLater: 'Maybe later',
                resetColors: 'Reset default colors',
                colorsTitle: '🎨 Customize colors',
                colorsSubtitle: 'Choose your favorite colors to personalize the app.',
                colorAccentLabel: 'Accent color',
                colorAccentLightLabel: 'Light accent',
                colorCardBgLabel: 'Card background',
                colorTextPrimaryLabel: 'Primary text',
                colorTextSecondaryLabel: 'Secondary text',
                colorBgLabel: 'Page background',
                colorSuccessLabel: 'Success',
                colorDangerLabel: 'Danger',
                colorWarningLabel: 'Warning',
                colorBorderLabel: 'Border',
                fixedPaid: '✅ Paid',
                fixedPlanned: ' Planned',
                fixedDue: 'Due',
                fixedFound: 'Found',
                budget: 'Daily budget',
                remaining: 'Remaining',
                days: 'Days left',
                period: 'Period',
                periodStartedWith: 'Period started with: {desc} on {date}',
                totalIncome: 'Total income',
                startGuide: '👋 Start by adding your income below!',
                incomes: '🏦 Period income',
                fixed: '📌 Monthly fixed expenses',
                variable: '🧾 Variable expenses',
                chart: '📊 Expense distribution',
                balanceChartTitle: '📈 Income vs Expenses',
                balanceChartNote: 'Add income or expenses to see the chart',
                balanceChartIncome: 'Income',
                balanceChartFixed: 'Fixed',
                balanceChartVariable: 'Variable',
                balanceChartRemaining: 'Remaining',
                monthlyBalanceTitle: '📉 Monthly balance trend',
                monthlyBalanceNote: 'Monthly income and expense trend',
                monthlyBalanceEmpty: 'No historical data available<br>Import transactions or add expenses',
                monthlyBalanceDataset: 'Monthly balance',
                totalExpensesLabel: 'Total expenses',
                transactionsLabel: 'transactions',
                comparisonMoreThanLastMonth: 'more than last month',
                comparisonLessThanLastMonth: 'less than last month',
                youLabel: 'You',
                assistant: 'AI Financial Assistant',
                savings: 'Savings goal',
                settings: '⚙️ Settings',
                badge: 'multiple',
                addIncome: '➕ Add income',
                addFixed: '➕ Add fixed expense',
                addExpense: '➕ Add expense',
                resetDay: '🗑️ Clear day expenses',
                applySavings: 'Apply savings',
                backup: 'Download backup',
                restore: '📂 Restore',
                resetAll: '⚠️ Full reset',
                resetFixed: '🗑️ Reset fixed expenses',
                export: ' Export to Calendar',
                calendarToolsTitle: 'Calendar',
                calendarToolsSubtitle: 'Show period due dates in your calendar without keeping them on Home.',
                send: 'Send',
                incomeDesc: 'Description (e.g. Salary)',
                incomeAmount: 'Amount €',
                incomeDateLabel: 'Date',
                fixedName: 'Name (e.g. Mortgage)',
                fixedAmount: 'Amount €',
                fixedDay: 'Day (e.g. 27)',
                expenseName: 'What did you buy?',
                expenseAmount: '€',
                expenseSubCategory: 'Subcategory (optional)',
                chatPlaceholder: 'E.g. How much can I save this month?',
                dateLabel: 'Select date:',
                dayLabel: 'Day of month',
                endDateLabel: 'Expiry date',
                percentLabel: 'Percentage of income (%)',
                goalLabel: 'Goal (€)',
                thresholdLabel: '🔔 Alert threshold (€)',
                languageLabel: '🌍 Language',
                backupLabel: ' Data backup',
                micFixed: 'Say everything in one phrase',
                micVariable: 'Tap to speak',
                helpFixed: '⏰ Automatically counted each month until expiry',
                chartNote: 'Add expenses to see chart',
                noIncome: 'No income',
                noFixed: 'No fixed expenses',
                noVariable: 'No expenses on this day',
                noMatchingExpenses: 'No expenses match the selected filters',
                welcomeMessage: 'Hi! I\'m your financial assistant. Ask me anything about your budget!',
                suggestion1: '💶 Save 100€',
                suggestion2: '🔮 Simulate increase',
                suggestion3: '🎯 Goal',
                suggestion4: '📊 Top category',
                assistantName: 'Assistant',
                incomeAdded: '✅ Income added!',
                incomeDeleted: '🗑️ Income deleted',
                fixedAdded: '✅ Fixed expense added!',
                fixedDeleted: '🗑️ Expense deleted',
                expenseAdded: '✅ Expense added!',
                expenseDeleted: '🗑️ Expense deleted',
                dayReset: '🗑️ Day expenses cleared',
                savingsApplied: '💰 Savings applied!',
                backupDownloaded: '💾 Backup downloaded!',
                dataRestored: '📂 Data restored!',
                resetCompleted: '🔄 Reset completed',
                resetFixedCompleted: '🗑️ Fixed expenses deleted',
                calendarExported: ' Calendar exported!',
                fillFields: '⚠️ Fill all fields',
                invalidDay: '⚠️ Invalid day (1-31)',
                thresholdExceeded: '⚠️ Warning! You exceeded the threshold of ',
                active: '🟢 Active',
                expired: '🔴 Expired',
                dueToday: 'Due today',
                daysAgo: 'Expired {days} days ago',
                inDays: 'In {days} days',
                today: 'Today',
                yearSing: 'year',
                yearPlur: 'years',
                monthSing: 'month',
                monthPlur: 'months',
                daySing: 'day',
                dayPlur: 'days',
                andConj: 'and',
                confirmReset: 'This reset will delete all incomes and variable expenses. Fixed expenses will NOT be deleted. Continue?',
                confirmResetFixed: 'Do you want to delete all saved fixed expenses?',
                noGoal: 'You haven\'t set a savings goal yet. Go to the 🎯 section and set one!',
                noExpenses: 'You haven\'t recorded any expenses yet. Add some to get an analysis!',
                footerText: 'Period status',
                footerPeriodLabel: 'Salary period',
                footerDaysLabel: 'Days left',
                footerBudgetLabel: 'Average budget',
                wiseScoreStatusPrefix: 'Financial status',
                footerFeatures: 'Operational window always based on salary-to-salary period',
                footerBrandSignature: 'Kedrix — Personal Finance Engine',
                fixedVoiceButton: 'Add fixed expense with voice',
                variableVoiceButton: 'Add with voice',
                homeManualOpen: 'Open manual entry',
                homeQuickActionsTitle: 'Quick variable entry',
                homePriorityKicker: 'When Kedrix opens, start here',
                homeVoiceVariableButton: 'Add variable by voice',
                heroBudgetEyebrow: 'DAILY BUDGET',
                spendingPace: 'Spending pace',
                spendingPaceSafe: '🟢 Safe zone',
                spendingPaceOnTrack: '🟡 On track',
                spendingPaceWarning: '🟠 Warning',
                spendingPaceRisk: '🔴 Risk',
                wiseForecastTitle: '🔮 WiseForecast',
                wiseForecastSubtitle: 'Estimated end-of-period balance, with current remaining already aligned to unpaid fixed expenses in the period.',
                wiseForecastEndLabel: 'Estimated end balance',
                wiseForecastAvgLabel: 'Variable avg / day',
                wiseForecastPositive: '🟢 Estimated positive close',
                wiseForecastNegative: '🔴 Risk of negative close',
                wiseForecastNeutral: '🟡 Break-even close',
                wiseForecastDetailRemaining: 'Current remaining',
                wiseForecastDetailFixedResidual: 'Unpaid fixed in period',
                wiseForecastDetailVariableProjection: 'Expected variable spending',
                wiseForecastRiskDayLabel: 'Financial risk day',
                wiseForecastRiskDayPositive: '✔ With this pace you close the period positive',
                wiseForecastRiskDayNegative: '⚠ With the current spending pace you will go into deficit on {date}',
                wiseForecastRiskDayAlreadyDeficit: '⚠ You are already in deficit in this period',
                wiseForecastSafeDaysLabel: 'Safe days',
                wiseForecastSafeDaysPositive: '✔ With this pace you are safe for the whole period',
                wiseForecastSafeDaysNegative: '⚠ At this pace you are comfortable for {days} more days',
                wiseForecastSafeDaysNoCoverage: '⚠ You have no safe coverage for the period',
                forecastSimulatorTitle: 'Simulate an expense',
                forecastSimulatorHint: 'Quick preview: it does not change your real data.',
                forecastSimulatorPlaceholder: 'Ex. 120',
                forecastSimulatorForecastLabel: 'New forecast',
                forecastSimulatorBudgetLabel: 'New daily budget',
                forecastSimulatorEmpty: 'Enter an amount to see the immediate impact.',
                wiseForecastAdvancedDailyAverage: 'Daily average',
                wiseForecastAdvancedDaysRemaining: 'Days remaining',
                wiseForecastAdvancedFixedPlanned: 'Planned fixed expenses',
                wiseForecastAdvancedSimulateReduction: 'Simulate spending reduction',
                wiseForecastAdvancedNewForecast: 'New projected balance',
                wiseForecastAdvancedRiskGreen: 'Sustainable management',
                wiseForecastAdvancedRiskWarning: 'Watch your spending',
                wiseForecastAdvancedRiskDanger: 'Overdraft risk',
                safeToSpendLabel: 'Safe to spend today',
                safeToSpendHint: 'How much you can spend today without compromising the period.',
                safeToSpendPositive: 'You can spend today up to {amount}',
                safeToSpendNegative: 'Better stay cautious today',
                dailyCheckInTitle: 'WiseMind™ · Daily check-in',
                dailyCheckInSubtitle: 'A quick reading of your daily financial pace.',
                dailyCheckInWaiting: 'Add income or a transaction to unlock a more precise check-in.',
                dailyCheckInNoSpend: '✔ No variable spending recorded today. Great control so far.',
                dailyCheckInPositive: '✔ Today you are spending {amount} less than your average. Keep it up.',
                dailyCheckInNeutral: '• Today you are in line with your average. Keep this pace.',
                dailyCheckInWarning: '⚠ Today you are above your average by {amount}. If this continues, forecast drops to {forecast}.',
                dailyCheckInNegative: '⚠ The period is under pressure: at this pace forecast stays at {forecast}.',
                privacyHide: '🙈 Hide amounts',
                privacyShow: '👁️ Show amounts',
                tabAnalysis: '📊 Analysis',
                tabAI: '🧠 AI',
                tabHomePlain: 'Home',
                voiceExampleHint: 'Ex: "12 euro coffee"',
                categoryAlimentari: '🍎 Groceries',
                categoryTrasporti: '🚗 Transport',
                categorySvago: '🎮 Leisure',
                categorySalute: '💊 Health',
                categoryAbbigliamento: '👕 Clothing',
                categoryAltro: '📦 Other',
                
                // Onboarding
                onboardingWelcome: '👋 Welcome to Kedrix',
                onboardingStep1: 'Kedrix does not use a traditional monthly budget. It calculates how much you can safely spend today until your next salary.',
                onboardingStep2: '💶 Add your salary or main income. The app will automatically calculate your financial cycle from payday to payday.',
                onboardingStep3: '📌 Add fixed expenses like rent, mortgage, bills or subscriptions to make the calculation more accurate.',
                onboardingStep4: '🧾 Track daily expenses manually or by voice. Examples: “gas 40”, “coffee 5”, “groceries 25”.',
                onboardingStep5: '📊 In Analysis you can review spending distribution. Click a chart category to print or save the detailed category summary.',
                onboardingStep6: '🤖 Kedrix shows your daily safe budget, end-of-period forecast, smart suggestions and helpers like demo data, imports and category recognition.',
                onboardingNext: 'Next →',
                onboardingSkip: 'Skip',
                
                // Import review
                importReview: '📋 Import Review',
                importConfirm: '✅ Confirm',
                importCancel: '✕ Cancel',
                importCategory: 'Category',
                importLearn: '📌 The app will remember this choice',
                importSuggested: 'Suggested: {cat} (confirm to learn)',
                
                // Traduzioni CSV
                csvTitle: '📥 Import bank statements',
                csvSubtitle: 'Download your bank statement in CSV format',
                csvChooseFile: 'Choose file',
                csvNoFile: 'No file selected',
                csvImportBtn: '📥 Import CSV',
                csvDateFormat: 'Date format',
                csvSeparator: 'Separator',
                csvComma: 'Comma (,)',
                csvSemicolon: 'Semicolon (;)',
                csvTab: 'Tab',
                csvPreview: 'Preview',
                
                // Gestione categorie
                manageCategories: '📂 Manage categories',
                addCategory: '➕ Add category',
                categoryName: 'Category name',
                saveCategory: 'Save',
                deleteCategory: '🗑️ Delete',
                confirmDeleteCategory: 'Are you sure you want to delete the category "{name}"?',
                categoryAlreadyExists: 'Category already exists',
                categoryAdded: '✅ Category added!',
                categoryDeleted: '🗑️ Category deleted',
                categoryUpdated: '✏️ Category updated',
                defaultCategories: 'Default categories',
                customCategories: 'Your categories',
                noCustomCategories: 'No custom categories',

                // NUOVE CHIAVI PER I TAB
                tabHome: '🏠 Home',
                tabIncomes: 'Incomes',
                tabFixed: '📌 Fixed',
                tabVariable: '🧾 Variable',
                tabTools: '🛠️ Tools',

                // NUOVE CHIAVI PER SKIP ROWS
                skipRowsLabel: 'Skip initial rows',
                headerRowManualLabel: 'Header row',
                skipHelp: '📌 For files with initial rows (e.g., Fineco): skip rows until you find the columns',

                docTitle: '💠 Kedrix - Personal Finance Engine',
                subtitle: 'Paycheck to paycheck — smart management with AI',
                add: 'Add',
                dateHint: 'mm/dd/yyyy',
                autoRecommended: 'Auto (recommended)',
                ddmmyyyy: 'DD/MM/YYYY',
                mmddyyyy: 'MM/DD/YYYY',
                positiveBalance: 'Positive balance',
                negativeBalance: 'Warning: negative balance',
                vsYesterday0: 'vs yesterday: 0%',
                detailTotal: 'Total: {total}',
                noExpensesShort: 'No expenses',
                voiceSpeak: 'Speak...',
                voiceTap: 'Tap to speak',
                error: 'Error',
                genericExpense: 'Expense',
                voiceDetected: '✅ Detected: {desc} €{amount}',
                voiceFixedDetected: '✅ Fixed expense detected: {name} €{amount} day {day}',
                invalidFile: '❌ Invalid file',
                fixedExpense: 'Fixed expense',
                everyMonthOnDay: 'Every month on day',
                featureInDev: 'Feature in development',
                csvTemplateDetected: '📌 CSV template detected: "{name}".\nUse it automatically?',
                csvFieldDate: ' Date',
                csvFieldDescription: '📝 Description',
                csvFieldAmount: '💰 Amount',
                csvFieldCategory: '🏷️ Category',
                csvFieldIgnore: '❌ Ignore',
                csvSaveAsTemplate: 'Save as template',
                csvTemplateNamePlaceholder: 'Template name (e.g. Intesa, Unicredit...)',
                csvColumnN: 'Column {n}',
                empty: 'empty',
                csvMappingRequired: '❌ You must map Date, Description and Amount!',
                csvEmpty: '❌ Empty CSV',
                importCancelled: '⏸️ Import cancelled',
                csvImportError: '❌ Error during CSV import',
                fileReadError: '❌ Error reading the file',
                importCompleted: '✅ Import completed!\n➕ Added: {added}{dupLine}',
                duplicatesSkipped: '⚠️ Duplicates skipped: {dup}',
                onboardingSubtitle: 'Learn how to manage your financial cycle from payday to payday',
                onboardingDemo: "✨ Load demo",
                onboardingEmpty: 'Start empty',
                you: 'You',
                adviceRed: "⚠️ You're in the red! Review your expenses.",
                adviceLowRemaining: '⚠️ Warning: you only have {remaining} left for the coming days.',
                adviceGood: "💪 You're doing well! You still have {remaining} left.",
                aiSuggestionsTitle: 'AI Suggestions',
                aiTopCategoryMessage: 'You spent {amount} on {category}. By reducing it by 10% ({reduction}), you could add that to your savings.',
                aiTopCategoryAction: 'Set goal',
                aiTransportMessage: 'You spent {amount} on transport. Using public transport more could save you about {saving} per month.',
                aiTransportAction: 'Learn how',
                aiLeisureMessage: 'You spent {amount} on leisure. Limiting to 2 outings per week could save you {saving}.',
                aiLeisureAction: 'Plan',
                aiSmartBadge: 'smart',
                csvMappingTitle: '📋 Map CSV columns',
                csvMappingInstructionsHtml: '<strong>📌 Instructions:</strong> Map each CSV column to the right field. Positive amounts are treated as <strong>income</strong>, negative amounts as <strong>expenses</strong>.',
                csvMappingFieldsTitle: 'Field mapping:',
                showAllExpenses: 'Show all period expenses',
                edit: 'Edit',
                categoriesSectionTitle: '📂 Category management',
                manageCustomCategories: '➕ Manage custom categories',
                newCategoryLabel: 'New category',
                newCategoryPlaceholder: 'e.g. Travel',
                defaultCategoriesTitle: 'Default categories',
                yourCategoriesTitle: 'Your categories',
                close: 'Close',
                             
                // ===== WIDGET RISPARMIO =====
                savingsWidgetTitle: 'Raggiungerai il tuo obiettivo',
                never: 'Mai',
                percent0: '0%',
                percent15: '15%',
                percent30: '30%',
                savingsPotInputLabel: 'Fondo iniziale (€)',
                currentPlan: 'Piano attuale',
                currentPlanMessage: 'Con questi parametri non raggiungerai l\'obiettivo',
                
                // ===== IMPORT AVANZATO =====
                advancedOptions: '⚙️ Advanced options',
                excelSheet: 'Excel Sheet',
                excelHeaderRow: 'Header row',
                excelSheetPlaceholder: 'Load an Excel file',
                rowNone: 'None (auto)',
                excelHelp: '⚠️ Excel files are converted automatically',
                
                // ===== IMPOSTAZIONI =====
                backupButton: 'Download backup',
                restoreButton: 'Ripristina',
                                // NUOVE TRADUZIONI
                fixedDateFormatDays: '🗓️ Days remaining',
                fixedDateFormatMonths: '📆 Months and days',
                fixedDateFormatHelp: 'Choose how to display fixed expense deadlines',
                fixedSummaryTotalLabel: 'Total fixed',
                fixedSummaryVoicesMeta: '{count} items',
                fixedSummaryPaidLabel: 'Paid',
                fixedSummaryRecognizedMeta: '{count} recognized',
                fixedSummaryDueLabel: 'To absorb',
                fixedSummaryPlannedMeta: '{count} still planned',
                variableSummaryTotalLabel: 'Variable total',
                variableSummaryCountLabel: 'Transactions',
                variableSummaryCountMeta: '{count} in period',
                variableSummaryAverageLabel: 'Average per transaction',
                variableSummaryAverageMeta: 'Salary-to-salary period',
                fixedManualMatchTitle: '⚠ Possible match found',
                fixedManualMatchText: 'Same amount and compatible date, but different description.',
                fixedManualMatchConfirm: 'Confirm match',
                fixedManualMatchReject: 'Not this one',
                noFixedInPeriod: 'No fixed expenses in the period',
                futureFixedTitle: 'Future expenses outside period',
                futureFixedSubtitle: 'Visible but not counted in the current remaining.',
                futureFixedEmpty: 'No relevant future expenses outside the period',
                fixedCurrentSectionTitle: 'Fixed expenses in the active period',
                fixedCurrentSectionSubtitle: 'Shows only due dates that fall inside the salary-to-salary period.',
                fixedSummarySectionTitle: 'Period summary',
                fixedSummarySectionSubtitle: 'Quick totals to read impact, paid and planned items without scrolling the full list.',
                variableSectionTitle: 'Period movements',
                variableSectionSubtitle: 'Filterable list of variable expenses recorded in the active period.',
                variableLinkedBadge: '🔗 Bank linked',
                variableLinkedMeta: 'Imported movement linked without double counting.',
                futureFixedCountMeta: '{count} upcoming items',
                futureFixedNotCounted: 'Outside period',
                remainingTermLabel: 'Time left',
                noEndDateLabel: 'No end date',
                yearShort: 'y',
                monthShort: 'mo',
                dayShort: 'd',
                toggleShowList: 'Show list',
                toggleHideList: 'Hide list',
                toggleShowFuture: 'Show future',
                toggleHideFuture: 'Hide future',
                hideOptions: 'Hide options',
                excelSheet: 'Excel Sheet',
                excelHeaderRow: 'Header row',
                row1: 'Row 1',
                row2: 'Row 2',
                row3: 'Row 3',
                rowNone: 'None (auto)',
                never: 'Mai',
                percent0: '0%',
                percent15: '15%',
                percent30: '30%',
                currentPlan: 'Piano attuale',
                currentPlanMessage: 'Con questi parametri non raggiungerai l\'obiettivo',
                endPeriod: 'End of period',
                upgradeBanner: '🚀 Upgrade to Premium',
                upgradeBannerText: 'Unlock unlimited features and AI assistant!',
                upgrade: 'Upgrade',
                free: '🆓 Free',
                premium: '💎 Premium',
                transactionsLimit: '50 transactions/month',
                categoriesLimit: '3 base categories',
                popular: 'POPULAR',
                price: '€4.99',
                perMonth: '/month',
                unlimitedTransactions: '✅ Unlimited transactions',
                customCategories: '✅ Custom categories',
                excelImport: '✅ CSV/Excel import',
                advancedAI: '✅ Advanced AI assistant',
                detailedReports: '✅ Detailed reports',
                voiceRecognition: '✅ Voice recognition',
                freeTrial: '🎁 Free Trial',
                freeTrialText: '7 days of Premium, zero risk!',
                startTrial: '🚀 Start Free Trial',
                activateLicense: '🔑 Activate License',
                allCategories: '📋 All categories',
                clearFilters: 'Clear filters',
                features: {
                    csvImport: '✅ CSV Import',
                    aiAssistant: '✅ AI Assistant',
                    cloudSync: '✅ Cloud Sync',
                    unlimitedTransactions: '✅ Unlimited transactions',
                    customCategories: '✅ Custom categories',
                    excelImport: '✅ CSV/Excel Import',
                    advancedAI: '✅ Advanced AI Assistant',
                    detailedReports: '✅ Detailed reports',
                    voiceRecognition: '✅ Voice recognition'
                }
            },
            es: {
                never: "Nunca",
currentPaceReachOn: "Al ritmo actual, alcanzarás el objetivo el {date}",
goalNotReachable: "Con estos parámetros no alcanzarás el objetivo",
savingsSuggestionTitle: "Sugerencia",
applySuggestion: "Aplicar sugerencia",
increaseToPercentToArriveEarlier: "Aumenta al {percent}% para llegar {months} meses antes!",
increaseToPercentToArriveEarlier_one: "Aumenta al {percent}% para llegar {months} mes antes!",
suggestionAppliedToast: "💡 Sugerencia aplicada: {percent}% de ahorro",
                onboardingDemo: "✨ Cargar demo",
                loadDemo: "Cargar demo",
                upgradeBanner: '🚀 Mejora a Premium',
upgradeBannerText: '¡Desbloquea funciones ilimitadas y el asistente IA!',
upgrade: 'Mejorar',
free: '🆓 Gratis',
premium: '💎 Premium',
transactionsLimit: '50 transacciones/mes',
categoriesLimit: '3 categorías básicas',
popular: 'POPULAR',
price: '€4.99 /mes',
freeTrial: '🎁 Prueba Gratuita',
freeTrialText: '7 días de Premium, ¡sin riesgos!',
startTrial: '🚀 Iniciar Prueba Gratuita',
activateLicense: '🔑 Activar Licencia',
maybeLater: 'Quizás después',
                betaLaunchTitle: 'Programa Beta',
                betaLaunchKicker: 'Decision Intelligence Finance',
                betaLaunchSubtitle: 'Kedrix no es una simple app de presupuesto: es un motor de decisión financiera pensado para testers seleccionados.',
                betaPillarAudienceLabel: 'Usuarios ideales',
                betaPillarAudience: 'early adopters, testers de confianza, demos guiadas',
                betaPillarMessageLabel: 'Posicionamiento',
                betaPillarMessage: 'Decision Intelligence Finance, no presupuesto simple',
                betaPillarGoalLabel: 'Objetivo beta',
                betaPillarGoal: 'recoger feedback de calidad antes del lanzamiento público',
                installAppBtn: 'Instalar Kedrix',
                shareBetaInviteBtn: 'Compartir invitación beta',
                copyBetaInviteBtn: 'Copiar texto de invitación',
                installPromptReady: 'Kedrix está lista para instalarse en este dispositivo.',
                installOpenStandalone: 'Kedrix ya está instalada. Ábrela desde la pantalla de inicio como una app.',
                installIosHint: 'En iPhone: Compartir → Añadir a pantalla de inicio para tener Kedrix como app.',
                installUnsupportedHint: 'La instalación no está disponible aquí: usa Chrome o Safari móvil para una experiencia tipo app.',
                betaInviteShared: 'Invitación beta compartida.',
                betaInviteCopied: 'Texto de invitación copiado al portapapeles.',
                betaInviteUnavailable: 'La compartición no está disponible en este dispositivo.',
                betaInviteError: 'No se pudo completar la acción. Inténtalo de nuevo.',
                allCategories: '📋 Todas las categorías',
clearFilters: 'Cancelar filtros',
maybeLater: 'Quizás después',

// Nella sezione del widget risparmio:
savingsWidgetTitle: 'Alcanzarás tu objetivo',
never: 'Nunca',
percent0: '0%',
percent15: '15%',
percent30: '30%',
currentPlan: ' Plan actual',
currentPlanMessage: 'Con estos parámetros no alcanzarás el objetivo',

// Nella sezione import avanzato:
excelSheet: 'Hoja de Excel',
excelSheetPlaceholder: 'Cargar un archivo Excel',
rowNone: 'Ninguna (auto)',
excelHelp: '⚠️ Los archivos Excel se convierten automáticamente',
hideOptions: 'Ocultar opciones',
advancedOptions: '⚙️ Opciones avanzadas',

// Nella sezione upgrade banner:
upgradeBanner: '🚀 Mejora a Premium',
upgradeBannerText: '¡Desbloquea funciones ilimitadas y el asistente IA!',
upgrade: 'Mejorar',
free: '🆓 Gratis',
premium: '💎 Premium',
transactionsLimit: '50 transacciones/mes',
categoriesLimit: '3 categorías básicas',
popular: 'POPULAR',
price: '€4.99 /mes',
freeTrial: '🎁 Prueba Gratuita',
freeTrialText: '7 días de Premium, ¡sin riesgos!',
startTrial: '🚀 Iniciar Prueba Gratuita',
activateLicense: '🔑 Activar Licencia',
                savingsPotLabel: 'Plan de ahorro',
searchPlaceholder: 'Buscar por descripción, categoría o importe',
maybeLater: 'Quizás después',
                resetColors: 'Restablecer colores predeterminados',
                colorsTitle: '🎨 Personalizar colores',
                colorsSubtitle: 'Elige tus colores favoritos para personalizar la app.',
                colorAccentLabel: 'Color de acento',
                colorAccentLightLabel: 'Acento claro',
                colorCardBgLabel: 'Fondo de tarjeta',
                colorTextPrimaryLabel: 'Texto principal',
                colorTextSecondaryLabel: 'Texto secundario',
                colorBgLabel: 'Fondo de página',
                colorSuccessLabel: 'Éxito',
                colorDangerLabel: 'Error',
                colorWarningLabel: 'Aviso',
                colorBorderLabel: 'Borde',
                fixedPaid: '✅ Pagado',
                fixedPlanned: ' Previsto',
                fixedDue: 'Vence',
                fixedFound: 'Encontrado',
                budget: 'Presupuesto diario',
                remaining: 'Restante',
                days: 'Días restantes',
                period: 'Período',
                periodStartedWith: 'Período iniciado con: {desc} del {date}',
                totalIncome: 'Ingresos totales',
                startGuide: '👋 ¡Empieza añadiendo tus ingresos abajo!',
                incomes: '🏦 Ingresos del período',
                fixed: '📌 Gastos fijos mensuales',
                variable: '🧾 Gastos variables',
                chart: '📊 Distribución de gastos',
                balanceChartTitle: '📈 Ingresos vs Gastos',
                balanceChartNote: 'Añade ingresos o gastos para ver el gráfico',
                balanceChartIncome: 'Ingresos',
                balanceChartFixed: 'Fijas',
                balanceChartVariable: 'Variables',
                balanceChartRemaining: 'Disponible',
                monthlyBalanceTitle: '📉 Tendencia del saldo mensual',
                monthlyBalanceNote: 'Evolución mensual de ingresos y gastos',
                monthlyBalanceEmpty: 'No hay datos históricos disponibles<br>Importa movimientos o añade gastos',
                monthlyBalanceDataset: 'Saldo mensual',
                totalExpensesLabel: 'Gasto total',
                transactionsLabel: 'transacciones',
                comparisonMoreThanLastMonth: 'más que el mes pasado',
                comparisonLessThanLastMonth: 'menos que el mes pasado',
                youLabel: 'Tú',
                assistant: 'Asistente financiero IA',
                savings: 'Objetivo de ahorro',
                settings: '⚙️ Ajustes',
                badge: 'múltiple',
                addIncome: '➕ Añadir ingreso',
                addFixed: '➕ Añadir gasto fijo',
                addExpense: '➕ Añadir gasto',
                resetDay: '🗑️ Borrar gastos del día',
                applySavings: 'Aplicar ahorro',
                backup: 'Descargar copia',
                restore: '📂 Restaurar',
                resetAll: '⚠️ Reinicio total',
                resetFixed: '🗑️ Reiniciar gastos fijos',
                export: ' Exportar a Calendar',
                calendarToolsTitle: 'Calendario',
                calendarToolsSubtitle: 'Muestra los vencimientos del período en tu calendario sin dejarlos en Inicio.',
                send: 'Enviar',
                incomeDesc: 'Descripción (p. ej. Salario)',
                incomeAmount: 'Importe €',
                incomeDateLabel: 'Fecha',
                fixedName: 'Nombre (p. ej. Hipoteca)',
                fixedAmount: 'Importe €',
                fixedDay: 'Día (p. ej. 27)',
                expenseName: '¿Qué compraste?',
                expenseAmount: '€',
                expenseSubCategory: 'Subcategoría (opcional)',
                chatPlaceholder: 'p. ej. ¿Cuánto puedo ahorrar este mes?',
                dateLabel: 'Selecciona fecha:',
                dayLabel: 'Día del mes',
                endDateLabel: 'Fecha de vencimiento',
                percentLabel: 'Porcentaje de ingresos (%)',
                goalLabel: 'Objetivo (€)',
                thresholdLabel: '🔔 Umbral de aviso (€)',
                languageLabel: '🌍 Idioma',
                backupLabel: ' Copia de datos',
                micFixed: 'Toca y dilo en una frase',
                micVariable: 'Toca para hablar',
                helpFixed: '⏰ Se contabiliza automáticamente cada mes hasta el vencimiento',
                chartNote: 'Añade gastos para ver el gráfico',
                noIncome: 'Sin ingresos',
                noFixed: 'Sin gastos fijos',
                noVariable: 'Sin gastos en este día',
                welcomeMessage: '¡Hola! Soy tu asistente financiero. ¡Pregúntame lo que quieras sobre tu presupuesto!',
                suggestion1: '💶 Ahorrar 100€',
                suggestion2: '🔮 Simular aumento',
                suggestion3: '🎯 Objetivo',
                suggestion4: '📊 Categoría principal',
                assistantName: 'Asistente',
                incomeAdded: '✅ ¡Ingreso añadido!',
                incomeDeleted: '🗑️ Ingreso eliminado',
                fixedAdded: '✅ ¡Gasto fijo añadido!',
                fixedDeleted: '🗑️ Gasto eliminado',
                expenseAdded: '✅ ¡Gasto añadido!',
                expenseDeleted: '🗑️ Gasto eliminado',
                dayReset: '🗑️ Gastos del día borrados',
                savingsApplied: '💰 ¡Ahorro aplicado!',
                backupDownloaded: '💾 ¡Copia descargada!',
                dataRestored: '📂 ¡Datos restaurados!',
                resetCompleted: '🔄 Reinicio completado',
                resetFixedCompleted: '🗑️ Gastos fijos eliminados',
                calendarExported: ' ¡Calendario exportado!',
                fillFields: '⚠️ Rellena todos los campos',
                invalidDay: '⚠️ Día no válido (1-31)',
                thresholdExceeded: '⚠️ ¡Atención! Has superado el umbral de ',
                active: '🟢 Activo',
                expired: '🔴 Vencido',
                dueToday: 'Vence hoy',
                daysAgo: 'Vencido hace {days} días',
                inDays: 'En {days} días',
                today: 'Hoy',
                yearSing: 'año',
                yearPlur: 'años',
                monthSing: 'mes',
                monthPlur: 'meses',
                daySing: 'día',
                dayPlur: 'días',
                andConj: 'y',
                confirmReset: 'Este reinicio borrará todos los ingresos y gastos variables. Los gastos fijos NO se borrarán. ¿Continuar?',
                confirmResetFixed: '¿Quieres borrar todos los gastos fijos guardados?',
                noGoal: 'Aún no has establecido un objetivo de ahorro. Ve a 🎯 y configúralo.',
                noExpenses: 'Aún no tienes gastos registrados. Añade algunos para ver el análisis.',
                footerText: 'Estado del período',
                footerPeriodLabel: 'Período de salario',
                footerDaysLabel: 'Días restantes',
                footerBudgetLabel: 'Presupuesto medio',
                wiseScoreStatusPrefix: 'Estado financiero',
                footerFeatures: 'Ventana operativa siempre basada en salario a salario',
                footerBrandSignature: 'Kedrix — Personal Finance Engine',
                fixedVoiceButton: 'Añadir gasto fijo con voz',
                variableVoiceButton: 'Añadir con voz',
                homeManualOpen: 'Abrir inserción manual',
                homeQuickActionsTitle: 'Entrada rápida de variables',
                homePriorityKicker: 'Cuando abras Kedrix, empieza aquí',
                homeVoiceVariableButton: 'Añade variable por voz',
                heroBudgetEyebrow: 'PRESUPUESTO DIARIO',
                spendingPace: 'Ritmo de gasto',
                spendingPaceSafe: '🟢 Zona segura',
                spendingPaceOnTrack: '🟡 En línea',
                spendingPaceWarning: '🟠 Atención',
                spendingPaceRisk: '🔴 Riesgo',
                wiseForecastTitle: '🔮 WiseForecast',
                wiseForecastSubtitle: 'Saldo estimado al final del período, con el restante actual ya alineado con los fijos pendientes del período.',
                wiseForecastEndLabel: 'Saldo estimado final',
                wiseForecastAvgLabel: 'Media variables / día',
                wiseForecastPositive: '🟢 Cierre positivo estimado',
                wiseForecastNegative: '🔴 Riesgo de cierre negativo',
                wiseForecastNeutral: '🟡 Cierre en equilibrio',
                wiseForecastDetailRemaining: 'Restante actual',
                wiseForecastDetailFixedResidual: 'Fijos pendientes en el período',
                wiseForecastDetailVariableProjection: 'Gasto variable previsto',
                wiseForecastRiskDayLabel: 'Día de riesgo financiero',
                wiseForecastRiskDayPositive: '✔ Con este ritmo cierras el período en positivo',
                wiseForecastRiskDayNegative: '⚠ Con el ritmo actual de gasto entrarás en déficit el {date}',
                wiseForecastRiskDayAlreadyDeficit: '⚠ Ya estás en déficit en este período',
                wiseForecastSafeDaysLabel: 'Días seguros',
                wiseForecastSafeDaysPositive: '✔ Con este ritmo estás tranquilo durante todo el período',
                wiseForecastSafeDaysNegative: '⚠ Con este ritmo estás tranquilo durante {days} días más',
                wiseForecastSafeDaysNoCoverage: '⚠ No tienes cobertura segura para el período',
                forecastSimulatorTitle: 'Simula un gasto',
                forecastSimulatorHint: 'Vista previa rápida: no modifica tus datos reales.',
                forecastSimulatorPlaceholder: 'Ej. 120',
                forecastSimulatorForecastLabel: 'Nuevo forecast',
                forecastSimulatorBudgetLabel: 'Nuevo presupuesto diario',
                forecastSimulatorEmpty: 'Introduce un importe para ver el impacto inmediato.',
                wiseForecastAdvancedDailyAverage: 'Media diaria',
                wiseForecastAdvancedDaysRemaining: 'Días restantes',
                wiseForecastAdvancedFixedPlanned: 'Fijos previstos',
                wiseForecastAdvancedSimulateReduction: 'Simular reducción del gasto',
                wiseForecastAdvancedNewForecast: 'Nuevo saldo previsto',
                wiseForecastAdvancedRiskGreen: 'Gestión sostenible',
                wiseForecastAdvancedRiskWarning: 'Atención al gasto',
                wiseForecastAdvancedRiskDanger: 'Riesgo de descubierto',
                safeToSpendLabel: 'Gasto seguro hoy',
                safeToSpendHint: 'Cuánto puedes gastar hoy sin comprometer el periodo.',
                safeToSpendPositive: 'Puedes gastar hoy hasta {amount}',
                safeToSpendNegative: 'Hoy es mejor mantener prudencia',
                dailyCheckInTitle: 'WiseMind™ · Check diario',
                dailyCheckInSubtitle: 'Lectura rápida de tu ritmo financiero diario.',
                dailyCheckInWaiting: 'Añade un movimiento o un ingreso para desbloquear un check más preciso.',
                dailyCheckInNoSpend: '✔ No hay gastos variables registrados hoy. Muy buen control por ahora.',
                dailyCheckInPositive: '✔ Hoy estás gastando {amount} menos que tu media. Sigue así.',
                dailyCheckInNeutral: '• Hoy estás en línea con tu media. Mantén este ritmo.',
                dailyCheckInWarning: '⚠ Hoy estás por encima de tu media en {amount}. Si sigues así, el forecast baja a {forecast}.',
                dailyCheckInNegative: '⚠ El período está bajo presión: con este ritmo el forecast queda en {forecast}.',
                privacyHide: '🙈 Ocultar importes',
                privacyShow: '👁️ Mostrar importes',
                tabAnalysis: '📊 Análisis',
                tabAI: '🧠 AI',
                tabHomePlain: 'Home',
                voiceExampleHint: 'Ej.: "12 euros bar"',
                categoryAlimentari: '🍎 Alimentación',
                categoryTrasporti: '🚗 Transporte',
                categorySvago: '🎮 Ocio',
                categorySalute: '💊 Salud',
                categoryAbbigliamento: '👕 Ropa',
                categoryAltro: '📦 Otros',
                onboardingWelcome: '👋 Bienvenido a Kedrix',
                onboardingStep1: 'Kedrix no utiliza un presupuesto mensual tradicional. Calcula cuánto puedes gastar hoy hasta tu próximo salario.',
                onboardingStep2: '💶 Añade tu salario o ingreso principal. La app calculará automáticamente tu ciclo financiero de salario a salario.',
                onboardingStep3: '📌 Añade gastos fijos como alquiler, hipoteca, facturas o suscripciones para hacer el cálculo más preciso.',
                onboardingStep4: '🧾 Registra los gastos diarios manualmente o con la voz. Ejemplos: “gasolina 40”, “bar 5”, “compra 25”.',
                onboardingStep5: '📊 En Análisis puedes revisar la distribución de gastos. Al hacer clic en una categoría del gráfico puedes imprimir o guardar el resumen detallado.',
                onboardingStep6: '🤖 Kedrix muestra tu presupuesto diario seguro, la previsión de fin de periodo, sugerencias inteligentes y ayudas como demo, importación y reconocimiento de categorías.',
                onboardingNext: 'Siguiente →',
                onboardingSkip: 'Saltar',
                importReview: '📋 Revisión de importación',
                importConfirm: '✅ Confirmar',
                importCancel: '✕ Cancelar',
                importCategory: 'Categoría',
                importLearn: '📌 La app recordará esta elección',
                importSuggested: 'Sugerido: {cat} (confirma para aprender)',
                csvTitle: '📥 Importar movimientos bancarios',
                csvSubtitle: 'Descarga tu extracto en formato CSV',
                csvChooseFile: 'Elegir archivo',
                csvNoFile: 'Ningún archivo seleccionado',
                csvImportBtn: '📥 Importar CSV',
                csvDateFormat: 'Formato de fecha',
                csvSeparator: 'Separador',
                csvComma: 'Coma (,)',
                csvSemicolon: 'Punto y coma (;)',
                csvTab: 'Tabulación',
                csvPreview: 'Vista previa',
                categoriesSectionTitle: '📂 Gestión de categorías',
                manageCustomCategories: '➕ Gestionar categorías personalizadas',
                newCategoryLabel: 'Nueva categoría',
                newCategoryPlaceholder: 'p. ej. Viajes',
                defaultCategoriesTitle: 'Categorías predeterminadas',
                yourCategoriesTitle: 'Tus categorías',
                close: 'Cerrar',
                
                // ===== WIDGET RISPARMIO =====
                savingsWidgetTitle: 'Alcanzarás tu objetivo',
                never: 'Nunca',
                percent0: '0%',
                percent15: '15%',
                percent30: '30%',
                savingsPotInputLabel: 'Ahorro inicial (€)',
                currentPlan: ' Plan actual',
                currentPlanMessage: 'Con estos parámetros no alcanzarás el objetivo',
                
                // ===== IMPORT AVANZATO =====
                advancedOptions: '⚙️ Opciones avanzadas',
                excelSheet: 'Hoja de Excel',
                excelHeaderRow: 'Fila de encabezado',
                excelSheetPlaceholder: 'Cargar un archivo Excel',
                rowNone: 'Ninguna (auto)',
                excelHelp: '⚠️ Los archivos Excel se convierten automáticamente',
                
                // ===== IMPOSTAZIONI =====
                backupButton: 'Descargar copia',
                restoreButton: '📂 Restaurar',
                
                manageCategories: '📂 Gestionar categorías',
                addCategory: '➕ Añadir categoría',
                categoryName: 'Nombre de la categoría',
                saveCategory: 'Guardar',
                deleteCategory: '🗑️ Eliminar',
                confirmDeleteCategory: '¿Seguro que quieres eliminar la categoría "{name}"?',
                categoryAlreadyExists: 'La categoría ya existe',
                categoryAdded: '✅ ¡Categoría añadida!',
                categoryDeleted: '🗑️ Categoría eliminada',
                categoryUpdated: '✏️ Categoría actualizada',
                defaultCategories: 'Categorías predeterminadas',
                customCategories: 'Tus categorías',
                noCustomCategories: 'Sin categorías personalizadas',

                // NUOVE CHIAVI PER I TAB
                tabHome: '🏠 Inicio',
                tabIncomes: 'Ingresos',
                tabFixed: '📌 Fijas',
                tabVariable: '🧾 Variables',
                tabTools: '🛠️ Herramientas',

                // NUOVE CHIAVI PER SKIP ROWS
                skipRowsLabel: 'Saltar filas iniciales',
                headerRowManualLabel: 'Fila de encabezado',
                skipHelp: '📌 Para archivos con filas iniciales (ej. Fineco): salta las filas hasta encontrar las columnas',

                docTitle: '💠 Kedrix - Personal Finance Engine',
                subtitle: 'De nómina a nómina — gestión inteligente con IA',
                add: 'Añadir',
                dateHint: 'dd/mm/aaaa',
                autoRecommended: 'Auto (recomendado)',
                ddmmyyyy: 'DD/MM/AAAA',
                mmddyyyy: 'MM/DD/AAAA',
                positiveBalance: 'Saldo positivo',
                negativeBalance: 'Atención: saldo negativo',
                vsYesterday0: 'vs ayer: 0%',
                detailTotal: 'Total: {total}',
                noExpensesShort: 'Sin gastos',
                voiceSpeak: 'Habla...',
                voiceTap: 'Toca para hablar',
                error: 'Error',
                genericExpense: 'Gasto',
                voiceDetected: '✅ Detectado: {desc} €{amount}',
                voiceFixedDetected: '✅ Gasto fijo detectado: {name} €{amount} día {day}',
                invalidFile: '❌ Archivo no válido',
                fixedExpense: 'Gasto fijo',
                everyMonthOnDay: 'Cada mes el día',
                featureInDev: 'Función en desarrollo',
                csvTemplateDetected: '📌 Plantilla CSV detectada: "{name}".\\n¿Usarla automáticamente?',
                csvFieldDate: ' Fecha',
                csvFieldDescription: '📝 Descripción',
                csvFieldAmount: '💰 Importe',
                csvFieldCategory: '🏷️ Categoría',
                csvFieldIgnore: '❌ Ignorar',
                csvSaveAsTemplate: 'Guardar como plantilla',
                csvTemplateNamePlaceholder: 'Nombre de plantilla (p. ej. Intesa, Unicredit...)',
                csvColumnN: 'Columna {n}',
                empty: 'vacía',
                csvMappingRequired: '❌ Debes asignar Fecha, Descripción e Importe.',
                csvEmpty: '❌ CSV vacío',
                importCancelled: '⏸️ Importación cancelada',
                csvImportError: '❌ Error durante la importación CSV',
                fileReadError: '❌ Error al leer el archivo',
                duplicatesSkipped: '⚠️ Duplicados omitidos: {dup}',
                importCompleted: '✅ Importación completada!\\n➕ Añadidos: {added}{dupLine}',
                onboardingSubtitle: 'Descubre cómo controlar tu ciclo financiero de salario a salario',
                onboardingDemo: "✨ Cargar demo",
                onboardingEmpty: 'Empezar vacío',
                you: 'Tú',
                adviceRed: '⚠️ ¡Estás en negativo! Revisa tus gastos.',
                adviceLowRemaining: '⚠️ Atención: solo te quedan {remaining} para los próximos días.',
                adviceGood: '💪 ¡Vas bien! Aún te quedan {remaining}.',
                aiSuggestionsTitle: 'Sugerencias IA',
                aiTopCategoryMessage: 'Has gastado {amount} en {category}. Reduciendo un 10% ({reduction}), podrías destinar esa cantidad al ahorro.',
                aiTopCategoryAction: 'Fijar objetivo',
                aiTransportMessage: 'Has gastado {amount} en transporte. Usando más el transporte público, podrías ahorrar unos {saving} al mes.',
                aiTransportAction: 'Descubre cómo',
                aiLeisureMessage: 'Has gastado {amount} en ocio. Limitando las salidas a 2 por semana, podrías ahorrar {saving}.',
                aiLeisureAction: 'Planificar',
                aiSmartBadge: 'inteligente',
                csvMappingTitle: '📋 Mapear columnas CSV',
                csvMappingInstructionsHtml: '<strong>📌 Instrucciones:</strong> Asocia cada columna del CSV con su campo. Importes positivos = <strong>ingresos</strong>, negativos = <strong>gastos</strong>.',
                csvMappingFieldsTitle: 'Asignación de campos:',
                showAllExpenses: 'Mostrar todos los gastos del período',
                edit: 'Editar',
                                // NUOVE TRADUZIONI PER SPAGNOLO
                fixedDateFormatDays: '🗓️ Días restantes',
                fixedDateFormatMonths: '📆 Meses y días',
                fixedDateFormatHelp: 'Elige cómo visualizar los plazos de gastos fijos',
                fixedSummaryTotalLabel: 'Total fijos',
                fixedSummaryVoicesMeta: '{count} elementos',
                fixedSummaryPaidLabel: 'Pagados',
                fixedSummaryRecognizedMeta: '{count} reconocidos',
                fixedSummaryDueLabel: 'Por absorber',
                fixedSummaryPlannedMeta: '{count} aún previstos',
                variableSummaryTotalLabel: 'Total variables',
                variableSummaryCountLabel: 'Movimientos',
                variableSummaryCountMeta: '{count} en el periodo',
                variableSummaryAverageLabel: 'Media por movimiento',
                variableSummaryAverageMeta: 'Periodo sueldo→sueldo',
                fixedManualMatchTitle: '⚠ Posible coincidencia encontrada',
                fixedManualMatchText: 'Mismo importe y fecha compatible, pero descripción diferente.',
                fixedManualMatchConfirm: 'Confirmar equivalencia',
                fixedManualMatchReject: 'No es esta',
                noFixedInPeriod: 'No hay gastos fijos en el período',
                futureFixedTitle: 'Gastos futuros fuera del período',
                futureFixedSubtitle: 'Visibles pero no contados en el restante actual.',
                futureFixedEmpty: 'No hay gastos futuros relevantes fuera del período',
                fixedCurrentSectionTitle: 'Fijos del período activo',
                fixedCurrentSectionSubtitle: 'Muestra solo los vencimientos que entran en el período salario→salario.',
                fixedSummarySectionTitle: 'Resumen del período',
                fixedSummarySectionSubtitle: 'Totales rápidos para leer impacto, pagados y previstos sin recorrer toda la lista.',
                variableSectionTitle: 'Movimientos del período',
                variableSectionSubtitle: 'Lista filtrable de los gastos variables registrados en el período activo.',
                variableLinkedBadge: '🔗 Vinculado al banco',
                variableLinkedMeta: 'Movimiento importado vinculado sin doble cómputo.',
                futureFixedCountMeta: '{count} próximos elementos',
                futureFixedNotCounted: 'Fuera del período',
                remainingTermLabel: 'Tiempo restante',
                noEndDateLabel: 'Sin vencimiento',
                yearShort: 'a',
                monthShort: 'm',
                dayShort: 'd',
                toggleShowList: 'Mostrar lista',
                toggleHideList: 'Ocultar lista',
                toggleShowFuture: 'Mostrar futuros',
                toggleHideFuture: 'Ocultar futuros',
                hideOptions: 'Ocultar opciones',
                excelSheet: 'Hoja de Excel',
                excelHeaderRow: 'Fila de encabezado',
                row1: 'Fila 1',
                row2: 'Fila 2',
                row3: 'Fila 3',
                rowNone: 'Ninguna (auto)',
                never: 'Nunca',
                percent0: '0%',
                percent15: '15%',
                percent30: '30%',
                currentPlan: ' Plan actual',
                currentPlanMessage: 'Con estos parámetros no alcanzarás el objetivo',
                endPeriod: 'Fin del período',
                upgradeBanner: '🚀 Mejora a Premium',
                upgradeBannerText: '¡Desbloquea funciones ilimitadas y el asistente IA!',
                upgrade: 'Mejorar',
                free: '🆓 Gratis',
                premium: '💎 Premium',
                transactionsLimit: '50 transacciones/mes',
                categoriesLimit: '3 categorías básicas',
                popular: 'POPULAR',
                price: '€4.99',
                perMonth: '/mes',
                unlimitedTransactions: '✅ Transacciones ilimitadas',
                customCategories: '✅ Categorías personalizadas',
                excelImport: '✅ Importación CSV/Excel',
                advancedAI: '✅ Asistente IA avanzado',
                detailedReports: '✅ Informes detallados',
                voiceRecognition: '✅ Reconocimiento de voz',
                freeTrial: '🎁 Prueba Gratuita',
                freeTrialText: '7 días de Premium, ¡sin riesgos!',
                startTrial: '🚀 Iniciar Prueba Gratuita',
                activateLicense: '🔑 Activar Licencia',
                allCategories: '📋 Todas las categorías',
                clearFilters: 'Cancelar filtros',
                features: {
                    csvImport: '✅ Importación CSV',
                    aiAssistant: '✅ Asistente IA',
                    cloudSync: '✅ Sincronización en la nube',
                    unlimitedTransactions: '✅ Transacciones ilimitadas',
                    customCategories: '✅ Categorías personalizadas',
                    excelImport: '✅ Importación CSV/Excel',
                    advancedAI: '✅ Asistente IA avanzado',
                    detailedReports: '✅ Informes detallados',
                    voiceRecognition: '✅ Reconocimiento de voz'
                }
            },
            fr: {
                never: "Jamais",
currentPaceReachOn: "Au rythme actuel, vous atteindrez l'objectif le {date}",
goalNotReachable: "Avec ces paramètres, vous n'atteindrez pas l'objectif",
savingsSuggestionTitle: "Suggestion",
applySuggestion: "Appliquer la suggestion",
increaseToPercentToArriveEarlier: "Augmente à {percent}% pour atteindre l'objectif {months} mois plus tôt !",
increaseToPercentToArriveEarlier_one: "Augmente à {percent}% pour atteindre l'objectif {months} mois plus tôt !",
suggestionAppliedToast: "💡 Suggestion appliquée : {percent}% d'épargne",
                onboardingDemo: "✨ Charger la démo",
                loadDemo: "Cargar demo",
                upgradeBanner: '🚀 Passez à Premium',
upgradeBannerText: 'Débloquez des fonctionnalités illimitées et l\'assistant IA !',
upgrade: 'Passer à Premium',
free: '🆓 Gratuit',
premium: '💎 Premium',
transactionsLimit: '50 transactions/mois',
categoriesLimit: '3 catégories de base',
popular: 'POPULAIRE',
price: '€4.99 /mois',
freeTrial: '🎁 Essai Gratuit',
freeTrialText: '7 jours de Premium, zéro risque !',
startTrial: '🚀 Commencer l\'essai gratuit',
activateLicense: '🔑 Activer la licence',
maybeLater: 'Peut-être plus tard',
                betaLaunchTitle: 'Programme bêta',
                betaLaunchKicker: 'Decision Intelligence Finance',
                betaLaunchSubtitle: "Kedrix n'est pas une simple app de budget : c'est un moteur de décision financière conçu pour des testeurs sélectionnés.",
                betaPillarAudienceLabel: 'Utilisateurs idéaux',
                betaPillarAudience: 'early adopters, testeurs de confiance, démos guidées',
                betaPillarMessageLabel: 'Positionnement',
                betaPillarMessage: 'Decision Intelligence Finance, pas un simple budget',
                betaPillarGoalLabel: 'Objectif bêta',
                betaPillarGoal: 'collecter un feedback de qualité avant le lancement public',
                installAppBtn: 'Installer Kedrix',
                shareBetaInviteBtn: "Partager l'invitation bêta",
                copyBetaInviteBtn: "Copier le texte d'invitation",
                installPromptReady: 'Kedrix est prête à être installée sur cet appareil.',
                installOpenStandalone: "Kedrix est déjà installée. Ouvrez-la depuis l'écran d'accueil comme une app.",
                installIosHint: "Sur iPhone : Partager → Sur l'écran d'accueil pour avoir Kedrix comme app.",
                installUnsupportedHint: "L'installation n'est pas disponible ici : utilisez Chrome ou Safari mobile pour une expérience type app.",
                betaInviteShared: 'Invitation bêta partagée.',
                betaInviteCopied: "Texte d'invitation copié dans le presse-papiers.",
                betaInviteUnavailable: "Le partage n'est pas disponible sur cet appareil.",
                betaInviteError: 'Action impossible à terminer. Réessayez.',
                allCategories: '📋 Toutes les catégories',
clearFilters: 'Effacer les filtres',
maybeLater: 'Peut-être plus tard',

// Nella sezione del widget risparmio:
savingsWidgetTitle: 'Vous atteindrez votre objectif',
never: 'Jamais',
percent0: '0%',
percent15: '15%',
percent30: '30%',
currentPlan: ' Plan actuel',
currentPlanMessage: 'Avec ces paramètres, vous n\'atteindrez jamais l\'objectif',

// Nella sezione import avanzato:
excelSheet: 'Feuille Excel',
excelSheetPlaceholder: 'Charger un fichier Excel',
rowNone: 'Aucune (auto)',
excelHelp: '⚠️ Les fichiers Excel sont convertis automatiquement',
hideOptions: 'Masquer les options',
advancedOptions: '⚙️ Options avancées',

// Nella sezione upgrade banner:
upgradeBanner: '🚀 Passez à Premium',
upgradeBannerText: 'Débloquez des fonctionnalités illimitées et l\'assistant IA !',
upgrade: 'Passer à Premium',
free: '🆓 Gratuit',
premium: '💎 Premium',
transactionsLimit: '50 transactions/mois',
categoriesLimit: '3 catégories de base',
popular: 'POPULAIRE',
price: '€4.99 /mois',
freeTrial: '🎁 Essai Gratuit',
freeTrialText: '7 jours de Premium, zéro risque !',
startTrial: '🚀 Commencer l\'essai gratuit',
activateLicense: '🔑 Activer la licence',
                savingsPotLabel: 'Plan d\'épargne',
searchPlaceholder: 'Rechercher par description, catégorie ou montant',
maybeLater: 'Peut-être plus tard',
                resetColors: 'Réinitialiser les couleurs par défaut',
                colorsTitle: '🎨 Personnaliser les couleurs',
                colorsSubtitle: 'Choisissez vos couleurs préférées pour personnaliser l\'application.',
                colorAccentLabel: 'Couleur accent',
                colorAccentLightLabel: 'Accent clair',
                colorCardBgLabel: 'Fond de carte',
                colorTextPrimaryLabel: 'Texte principal',
                colorTextSecondaryLabel: 'Texte secondaire',
                colorBgLabel: 'Fond de page',
                colorSuccessLabel: 'Succès',
                colorDangerLabel: 'Erreur',
                colorWarningLabel: 'Avertissement',
                colorBorderLabel: 'Bordure',
                fixedPaid: '✅ Payé',
                fixedPlanned: ' Prévu',
                fixedDue: 'Échéance',
                fixedFound: 'Trouvé',
                budget: 'Budget journalier',
                remaining: 'Reste',
                days: 'Jours restants',
                period: 'Période',
                periodStartedWith: 'Période commencée avec : {desc} le {date}',
                totalIncome: 'Total des revenus',
                startGuide: '👋 Commence en ajoutant tes revenus ci-dessous !',
                incomes: '🏦 Revenus de la période',
                fixed: '📌 Dépenses fixes mensuelles',
                variable: '🧾 Dépenses variables',
                chart: '📊 Répartition des dépenses',
                balanceChartTitle: '📈 Revenus vs Dépenses',
                balanceChartNote: 'Ajoute des revenus ou des dépenses pour voir le graphique',
                balanceChartIncome: 'Revenus',
                balanceChartFixed: 'Fixes',
                balanceChartVariable: 'Variables',
                balanceChartRemaining: 'Reste',
                monthlyBalanceTitle: '📉 Tendance du solde mensuel',
                monthlyBalanceNote: 'Évolution mensuelle des revenus et des dépenses',
                monthlyBalanceEmpty: 'Aucune donnée historique disponible<br>Importe des mouvements ou ajoute des dépenses',
                monthlyBalanceDataset: 'Solde mensuel',
                totalExpensesLabel: 'Total des dépenses',
                transactionsLabel: 'transactions',
                comparisonMoreThanLastMonth: 'de plus que le mois dernier',
                comparisonLessThanLastMonth: 'de moins que le mois dernier',
                youLabel: 'Vous',
                assistant: 'Assistant financier IA',
                savings: 'Objectif d’épargne',
                settings: '⚙️ Paramètres',
                badge: 'multiple',
                addIncome: '➕ Ajouter un revenu',
                addFixed: '➕ Ajouter une dépense fixe',
                addExpense: '➕ Ajouter une dépense',
                resetDay: '🗑️ Supprimer les dépenses du jour',
                applySavings: 'Appliquer l’épargne',
                backup: 'Télécharger la sauvegarde',
                restore: '📂 Restaurer',
                resetAll: '⚠️ Réinitialisation complète',
                resetFixed: '🗑️ Réinitialiser les dépenses fixes',
                export: ' Exporter vers Calendar',
                calendarToolsTitle: 'Calendrier',
                calendarToolsSubtitle: 'Affiche les échéances de la période dans ton calendrier sans les laisser sur l\'accueil.',
                send: 'Envoyer',
                incomeDesc: 'Description (ex. Salaire)',
                incomeAmount: 'Montant €',
                incomeDateLabel: 'Date',
                fixedName: 'Nom (ex. Crédit)',
                fixedAmount: 'Montant €',
                fixedDay: 'Jour (ex. 27)',
                expenseName: 'Qu’as-tu acheté ?',
                expenseAmount: '€',
                expenseSubCategory: 'Sous-catégorie (optionnelle)',
                chatPlaceholder: 'Ex. Combien puis-je économiser ce mois-ci ?',
                dateLabel: 'Choisir une date :',
                dayLabel: 'Jour du mois',
                endDateLabel: 'Date d’échéance',
                percentLabel: 'Pourcentage des revenus (%)',
                goalLabel: 'Objectif (€)',
                thresholdLabel: '🔔 Seuil d’alerte (€)',
                languageLabel: '🌍 Langue',
                backupLabel: ' Sauvegarde des données',
                micFixed: 'Appuie et dis tout en une phrase',
                micVariable: 'Appuie pour parler',
                helpFixed: '⏰ Comptabilisée automatiquement chaque mois jusqu’à l’échéance',
                chartNote: 'Ajoute des dépenses pour voir le graphique',
                noIncome: 'Aucun revenu',
                noFixed: 'Aucune dépense fixe',
                noVariable: 'Aucune dépense ce jour',
                noMatchingExpenses: 'Aucune dépense ne correspond aux filtres sélectionnés',
                welcomeMessage: 'Salut ! Je suis ton assistant financier. Demande-moi n’importe quoi sur ton budget !',
                suggestion1: '💶 Économiser 100€',
                suggestion2: '🔮 Simuler une hausse',
                suggestion3: '🎯 Objectif',
                suggestion4: '📊 Catégorie principale',
                assistantName: 'Assistant',
                incomeAdded: '✅ Revenu ajouté !',
                incomeDeleted: '🗑️ Revenu supprimé',
                fixedAdded: '✅ Dépense fixe ajoutée !',
                fixedDeleted: '🗑️ Dépense supprimée',
                expenseAdded: '✅ Dépense ajoutée !',
                expenseDeleted: '🗑️ Dépense supprimée',
                dayReset: '🗑️ Dépenses du jour supprimées',
                savingsApplied: '💰 Épargne appliquée !',
                backupDownloaded: '💾 Sauvegarde téléchargée !',
                dataRestored: '📂 Données restaurées !',
                resetCompleted: '🔄 Réinitialisation terminée',
                resetFixedCompleted: '🗑️ Dépenses fixes supprimées',
                calendarExported: ' Calendrier exporté !',
                fillFields: '⚠️ Remplis tous les champs',
                invalidDay: '⚠️ Jour invalide (1-31)',
                thresholdExceeded: '⚠️ Attention ! Tu as dépassé le seuil de ',
                active: '🟢 Actif',
                expired: '🔴 Expiré',
                dueToday: 'Échéance aujourd’hui',
                daysAgo: 'Expiré il y a {days} jours',
                inDays: 'Dans {days} jours',
                today: 'Aujourd\'hui',
                yearSing: 'an',
                yearPlur: 'ans',
                monthSing: 'mois',
                monthPlur: 'mois',
                daySing: 'jour',
                dayPlur: 'jours',
                andConj: 'et',
                confirmReset: 'Cette réinitialisation supprimera tous les revenus et toutes les dépenses variables. Les dépenses fixes NE seront PAS supprimées. Continuer ?',
                confirmResetFixed: 'Voulez-vous supprimer toutes les dépenses fixes enregistrées ?',
                noGoal: 'Tu n’as pas encore défini d’objectif d’épargne. Va sur 🎯 et configure-le.',
                noExpenses: 'Tu n’as encore aucune dépense. Ajoute-en pour voir l’analyse.',
                footerText: 'État de la période',
                footerPeriodLabel: 'Période de salaire',
                footerDaysLabel: 'Jours restants',
                footerBudgetLabel: 'Budget moyen',
                wiseScoreStatusPrefix: 'État financier',
                footerFeatures: 'Fenêtre opérationnelle toujours basée sur salaire à salaire',
                footerBrandSignature: 'Kedrix — Personal Finance Engine',
                fixedVoiceButton: 'Ajouter une dépense fixe par voix',
                variableVoiceButton: 'Ajouter par voix',
                homeManualOpen: 'Ouvrir la saisie manuelle',
                homeQuickActionsTitle: 'Saisie rapide variables',
                homePriorityKicker: 'Quand Kedrix s’ouvre, commence ici',
                homeVoiceVariableButton: 'Ajouter une variable par voix',
                heroBudgetEyebrow: 'BUDGET JOURNALIER',
                spendingPace: 'Rythme de dépense',
                spendingPaceSafe: '🟢 Zone sûre',
                spendingPaceOnTrack: '🟡 En ligne',
                spendingPaceWarning: '🟠 Attention',
                spendingPaceRisk: '🔴 Risque',
                wiseForecastTitle: '🔮 WiseForecast',
                wiseForecastSubtitle: 'Solde estimé en fin de période si vous gardez le rythme actuel.',
                wiseForecastEndLabel: 'Solde estimé fin de période',
                wiseForecastAvgLabel: 'Moyenne variables / jour',
                wiseForecastDetailRemaining: 'Reste actuel',
                wiseForecastDetailFixedResidual: 'Fixes restantes sur la période',
                wiseForecastDetailVariableProjection: 'Dépense variable prévue',
                wiseForecastRiskDayLabel: 'Jour de risque financier',
                wiseForecastRiskDayPositive: '✔ Avec ce rythme vous terminez la période en positif',
                wiseForecastRiskDayNegative: '⚠ Avec le rythme actuel de dépense vous passerez en déficit le {date}',
                wiseForecastRiskDayAlreadyDeficit: '⚠ Vous êtes déjà en déficit sur cette période',
                wiseForecastSafeDaysLabel: 'Jours sûrs',
                wiseForecastSafeDaysPositive: '✔ Avec ce rythme vous êtes tranquille pour toute la période',
                wiseForecastSafeDaysNegative: '⚠ Avec ce rythme vous êtes tranquille encore {days} jours',
                wiseForecastSafeDaysNoCoverage: '⚠ Vous n\'avez pas de couverture sécurisée pour la période',
                forecastSimulatorTitle: 'Simuler une dépense',
                forecastSimulatorHint: 'Aperçu rapide : ne modifie pas vos données réelles.',
                forecastSimulatorPlaceholder: 'Ex. 120',
                forecastSimulatorForecastLabel: 'Nouveau forecast',
                forecastSimulatorBudgetLabel: 'Nouveau budget quotidien',
                forecastSimulatorEmpty: 'Saisissez un montant pour voir l\'impact immédiat.',
                wiseForecastAdvancedDailyAverage: 'Moyenne quotidienne',
                wiseForecastAdvancedDaysRemaining: 'Jours restants',
                wiseForecastAdvancedFixedPlanned: 'Fixes prévues',
                wiseForecastAdvancedSimulateReduction: 'Simuler une réduction des dépenses',
                wiseForecastAdvancedNewForecast: 'Nouveau solde prévu',
                wiseForecastAdvancedRiskGreen: 'Gestion durable',
                wiseForecastAdvancedRiskWarning: 'Attention aux dépenses',
                wiseForecastAdvancedRiskDanger: 'Risque de découvert',
                safeToSpendLabel: 'Dépense sûre aujourd\'hui',
                safeToSpendHint: 'Ce que vous pouvez dépenser aujourd\'hui sans compromettre la période.',
                safeToSpendPositive: 'Vous pouvez dépenser aujourd\'hui jusqu\'à {amount}',
                safeToSpendNegative: 'Mieux vaut rester prudent aujourd\'hui',
                dailyCheckInTitle: 'WiseMind™ · Check du jour',
                dailyCheckInSubtitle: 'Lecture rapide de votre rythme financier quotidien.',
                dailyCheckInWaiting: 'Ajoutez un mouvement ou un revenu pour débloquer un check plus précis.',
                dailyCheckInNoSpend: '✔ Aucune dépense variable enregistrée aujourd\'hui. Très bon contrôle jusqu\'ici.',
                dailyCheckInPositive: '✔ Aujourd\'hui vous dépensez {amount} de moins que votre moyenne. Continuez ainsi.',
                dailyCheckInNeutral: '• Aujourd\'hui vous êtes aligné sur votre moyenne. Gardez ce rythme.',
                dailyCheckInWarning: '⚠ Aujourd\'hui vous dépassez votre moyenne de {amount}. Si cela continue, le forecast descend à {forecast}.',
                dailyCheckInNegative: '⚠ La période est sous pression : à ce rythme le forecast reste à {forecast}.',
                wiseForecastPositive: '🟢 Clôture positive estimée',
                wiseForecastNegative: '🔴 Risque de clôture négative',
                wiseForecastNeutral: '🟡 Clôture à l\'équilibre',
                privacyHide: '🙈 Masquer les montants',
                privacyShow: '👁️ Afficher les montants',
                tabAnalysis: '📊 Analyse',
                tabAI: '🧠 IA',
                tabHomePlain: 'Home',
                voiceExampleHint: 'Ex. : "12 euros café"',
                categoryAlimentari: '🍎 Alimentation',
                categoryTrasporti: '🚗 Transport',
                categorySvago: '🎮 Loisirs',
                categorySalute: '💊 Santé',
                categoryAbbigliamento: '👕 Vêtements',
                categoryAltro: '📦 Autre',
                onboardingWelcome: '👋 Bienvenue sur Kedrix',
                onboardingStep1: "Kedrix n’utilise pas un budget mensuel classique. Il calcule combien vous pouvez dépenser aujourd’hui jusqu’au prochain salaire.",
                onboardingStep2: "💶 Ajoute ton salaire ou ton revenu principal. L'app calculera automatiquement ton cycle financier de salaire à salaire.",
                onboardingStep3: "📌 Ajoute les dépenses fixes comme le loyer, le crédit, les factures ou les abonnements pour rendre le calcul plus précis.",
                onboardingStep4: "🧾 Enregistre les dépenses quotidiennes manuellement ou à la voix. Exemples : “essence 40”, “bar 5”, “courses 25”.",
                onboardingStep5: "📊 Dans Analyse, tu peux consulter la répartition des dépenses. En cliquant sur une catégorie du graphique, tu peux imprimer ou enregistrer le récapitulatif détaillé.",
                onboardingStep6: "🤖 Kedrix affiche ton budget journalier sûr, la prévision de fin de période, des suggestions intelligentes et des aides comme la démo, l'import et la reconnaissance des catégories.",
                onboardingNext: 'Suivant →',
                onboardingSkip: 'Passer',
                importReview: '📋 Revue d’importation',
                importConfirm: '✅ Confirmer',
                importCancel: '✕ Annuler',
                importCategory: 'Catégorie',
                importLearn: '📌 L’app se souviendra de ce choix',
                importSuggested: 'Suggéré: {cat} (confirmer pour apprendre)',
                csvTitle: '📥 Importer des opérations bancaires',
                csvSubtitle: 'Télécharge ton relevé en CSV',
                csvChooseFile: 'Choisir un fichier',
                csvNoFile: 'Aucun fichier sélectionné',
                csvImportBtn: '📥 Importer CSV',
                csvDateFormat: 'Format de date',
                csvSeparator: 'Séparateur',
                csvComma: 'Virgule (,)',
                csvSemicolon: 'Point-virgule (;)',
                csvTab: 'Tabulation',
                csvPreview: 'Aperçu',
                categoriesSectionTitle: '📂 Gestion des catégories',
                manageCustomCategories: '➕ Gérer les catégories personnalisées',
                newCategoryLabel: 'Nouvelle catégorie',
                newCategoryPlaceholder: 'ex. Voyages',
                defaultCategoriesTitle: 'Catégories par défaut',
                yourCategoriesTitle: 'Vos catégories',
                close: 'Fermer',
                
                // ===== WIDGET RISPARMIO =====
                savingsWidgetTitle: 'Vous atteindrez votre objectif',
                never: 'Jamais',
                percent0: '0%',
                percent15: '15%',
                percent30: '30%',
                savingsPotInputLabel: 'Épargne initiale (€)',
                currentPlan: ' Plan actuel',
                currentPlanMessage: 'Avec ces paramètres, vous n\'atteindrez jamais l\'objectif',
                
                // ===== IMPORT AVANZATO =====
                advancedOptions: '⚙️ Options avancées',
                excelSheet: 'Feuille Excel',
                excelHeaderRow: 'Ligne d\'en-tête',
                excelSheetPlaceholder: 'Charger un fichier Excel',
                rowNone: 'Aucune (auto)',
                excelHelp: '⚠️ Les fichiers Excel sont convertis automatiquement',
                
                // ===== IMPOSTAZIONI =====
                backupButton: 'Télécharger la sauvegarde',
                restoreButton: '📂 Restaurer',
                manageCategories: '📂 Gérer les catégories',
                addCategory: '➕ Ajouter une catégorie',
                categoryName: 'Nom de la catégorie',
                saveCategory: 'Enregistrer',
                deleteCategory: '🗑️ Supprimer',
                confirmDeleteCategory: 'Supprimer la catégorie « {name} » ?',
                categoryAlreadyExists: 'La catégorie existe déjà',
                categoryAdded: '✅ Catégorie ajoutée !',
                categoryDeleted: '🗑️ Catégorie supprimée',
                categoryUpdated: '✏️ Catégorie mise à jour',
                defaultCategories: 'Catégories par défaut',
                customCategories: 'Tes catégories',
                noCustomCategories: 'Aucune catégorie personnalisée',

                // NUOVE CHIAVI PER I TAB
                tabHome: '🏠 Accueil',
                tabIncomes: 'Revenus',
                tabFixed: '📌 Fixes',
                tabVariable: '🧾 Variables',
                tabTools: '🛠️ Outils',

                // NUOVE CHIAVI PER SKIP ROWS
                skipRowsLabel: 'Ignorer les lignes initiales',
                headerRowManualLabel: 'Ligne d\'en-tête',
                skipHelp: '📌 Pour les fichiers avec lignes initiales (ex. Fineco): ignorez les lignes jusqu\'à trouver les colonnes',

                docTitle: '💠 Kedrix - Personal Finance Engine',
                subtitle: 'De paie en paie — gestion intelligente avec IA',
                add: 'Ajouter',
                dateHint: 'jj/mm/aaaa',
                autoRecommended: 'Auto (recommandé)',
                ddmmyyyy: 'JJ/MM/AAAA',
                mmddyyyy: 'MM/JJ/AAAA',
                positiveBalance: 'Solde positif',
                negativeBalance: 'Attention : solde négatif',
                vsYesterday0: 'vs hier : 0%',
                detailTotal: 'Total : {total}',
                noExpensesShort: 'Aucune dépense',
                voiceSpeak: 'Parle...',
                voiceTap: 'Appuie pour parler',
                error: 'Erreur',
                genericExpense: 'Dépense',
                voiceDetected: '✅ Détecté : {desc} €{amount}',
                voiceFixedDetected: '✅ Dépense fixe détectée : {name} €{amount} jour {day}',
                invalidFile: '❌ Fichier invalide',
                fixedExpense: 'Dépense fixe',
                everyMonthOnDay: 'Chaque mois le jour',
                featureInDev: 'Fonction en développement',
                csvTemplateDetected: '📌 Modèle CSV détecté : « {name} ».\\nL’utiliser automatiquement ?',
                csvFieldDate: ' Date',
                csvFieldDescription: '📝 Description',
                csvFieldAmount: '💰 Montant',
                csvFieldCategory: '🏷️ Catégorie',
                csvFieldIgnore: '❌ Ignorer',
                csvSaveAsTemplate: 'Enregistrer comme modèle',
                csvTemplateNamePlaceholder: 'Nom du modèle (ex. Intesa, Unicredit...)',
                csvColumnN: 'Colonne {n}',
                empty: 'vide',
                csvMappingRequired: '❌ Tu dois mapper Date, Description et Montant.',
                csvEmpty: '❌ CSV vide',
                importCancelled: '⏸️ Import annulé',
                csvImportError: '❌ Erreur pendant l’import CSV',
                fileReadError: '❌ Erreur de lecture du fichier',
                duplicatesSkipped: '⚠️ Doublons ignorés : {dup}',
                importCompleted: '✅ Import terminé !\\n➕ Ajoutés : {added}{dupLine}',
                onboardingSubtitle: 'Découvre comment piloter ton cycle financier de salaire à salaire',
                onboardingDemo: "✨ Charger la démo",
                onboardingEmpty: 'Commencer vide',
                you: 'Toi',
                adviceRed: '⚠️ Tu es dans le rouge ! Revois tes dépenses.',
                adviceLowRemaining: '⚠️ Attention : il ne te reste que {remaining} pour les prochains jours.',
                adviceGood: '💪 Ça va ! Il te reste encore {remaining}.',
                aiSuggestionsTitle: 'Suggestions IA',
                aiTopCategoryMessage: 'Vous avez dépensé {amount} en {category}. En réduisant de 10% ({reduction}), vous pourriez affecter cette somme à votre épargne.',
                aiTopCategoryAction: 'Définir l\'objectif',
                aiTransportMessage: 'Vous avez dépensé {amount} en transports. En utilisant davantage les transports publics, vous pourriez économiser environ {saving} par mois.',
                aiTransportAction: 'Voir comment',
                aiLeisureMessage: 'Vous avez dépensé {amount} en loisirs. En limitant les sorties à 2 par semaine, vous pourriez économiser {saving}.',
                aiLeisureAction: 'Planifier',
                aiSmartBadge: 'intelligent',
                csvMappingTitle: '📋 Mapper les colonnes CSV',
                csvMappingInstructionsHtml: '<strong>📌 Instructions :</strong> Associe chaque colonne du CSV au bon champ. Montants positifs = <strong>revenus</strong>, négatifs = <strong>dépenses</strong>.',
                csvMappingFieldsTitle: 'Association des champs :',
                showAllExpenses: 'Afficher toutes les dépenses de la période',
                edit: 'Modifier',
                                // NOUVELLES TRADUCTIONS POUR FRANÇAIS
                fixedDateFormatDays: '🗓️ Jours restants',
                fixedDateFormatMonths: '📆 Mois et jours',
                fixedDateFormatHelp: 'Choisissez comment afficher les échéances des dépenses fixes',
                fixedSummaryTotalLabel: 'Total fixes',
                fixedSummaryVoicesMeta: '{count} éléments',
                fixedSummaryPaidLabel: 'Payées',
                fixedSummaryRecognizedMeta: '{count} reconnues',
                fixedSummaryDueLabel: 'À absorber',
                fixedSummaryPlannedMeta: '{count} encore prévues',
                variableSummaryTotalLabel: 'Total variables',
                variableSummaryCountLabel: 'Mouvements',
                variableSummaryCountMeta: '{count} sur la période',
                variableSummaryAverageLabel: 'Moyenne par mouvement',
                variableSummaryAverageMeta: 'Période salaire→salaire',
                fixedManualMatchTitle: '⚠ Correspondance possible trouvée',
                fixedManualMatchText: 'Même montant et date compatible, mais description différente.',
                fixedManualMatchConfirm: 'Confirmer l\'équivalence',
                fixedManualMatchReject: 'Ce n\'est pas celle-ci',
                noFixedInPeriod: 'Aucune dépense fixe sur la période',
                futureFixedTitle: 'Dépenses futures hors période',
                futureFixedSubtitle: 'Visibles mais non comptées dans le restant actuel.',
                futureFixedEmpty: 'Aucune dépense future pertinente hors période',
                fixedCurrentSectionTitle: 'Fixes de la période active',
                fixedCurrentSectionSubtitle: 'Affiche uniquement les échéances qui tombent dans la période salaire→salaire.',
                fixedSummarySectionTitle: 'Résumé de la période',
                fixedSummarySectionSubtitle: 'Totaux rapides pour lire impact, payées et prévues sans parcourir toute la liste.',
                variableSectionTitle: 'Mouvements de la période',
                variableSectionSubtitle: 'Liste filtrable des dépenses variables enregistrées sur la période active.',
                variableLinkedBadge: '🔗 Lié à la banque',
                variableLinkedMeta: 'Mouvement importé lié sans double comptage.',
                futureFixedCountMeta: '{count} éléments à venir',
                futureFixedNotCounted: 'Hors période',
                remainingTermLabel: 'Temps restant',
                noEndDateLabel: 'Sans échéance',
                yearShort: 'a',
                monthShort: 'm',
                dayShort: 'j',
                toggleShowList: 'Afficher la liste',
                toggleHideList: 'Masquer la liste',
                toggleShowFuture: 'Afficher futures',
                toggleHideFuture: 'Masquer futures',
                hideOptions: 'Masquer les options',
                excelSheet: 'Feuille Excel',
                excelHeaderRow: 'Ligne d\'en-tête',
                row1: 'Ligne 1',
                row2: 'Ligne 2',
                row3: 'Ligne 3',
                rowNone: 'Aucune (auto)',
                never: 'Jamais',
                percent0: '0%',
                percent15: '15%',
                percent30: '30%',
                currentPlan: ' Plan actuel',
                currentPlanMessage: 'Avec ces paramètres, vous n\'atteindrez jamais l\'objectif',
                endPeriod: 'Fin de période',
                upgradeBanner: '🚀 Passez à Premium',
                upgradeBannerText: 'Débloquez des fonctionnalités illimitées et l\'assistant IA !',
                upgrade: 'Passer à Premium',
                free: '🆓 Gratuit',
                premium: '💎 Premium',
                transactionsLimit: '50 transactions/mois',
                categoriesLimit: '3 catégories de base',
                popular: 'POPULAIRE',
                price: '€4.99',
                perMonth: '/mois',
                unlimitedTransactions: '✅ Transactions illimitées',
                customCategories: '✅ Catégories personnalisées',
                excelImport: '✅ Importation CSV/Excel',
                advancedAI: '✅ Assistant IA avancé',
                detailedReports: '✅ Rapports détaillés',
                voiceRecognition: '✅ Reconnaissance vocale',
                freeTrial: '🎁 Essai Gratuit',
                freeTrialText: '7 jours de Premium, zéro risque !',
                startTrial: '🚀 Commencer l\'essai gratuit',
                activateLicense: '🔑 Activer la licence',
                allCategories: '📋 Toutes les catégories',
                clearFilters: 'Effacer les filtres',
                features: {
                    csvImport: '✅ Importation CSV',
                    aiAssistant: '✅ Assistant IA',
                    cloudSync: '✅ Synchronisation cloud',
                    unlimitedTransactions: '✅ Transactions illimitées',
                    customCategories: '✅ Catégories personnalisées',
                    excelImport: '✅ Importation CSV/Excel',
                    advancedAI: '✅ Assistant IA avancé',
                    detailedReports: '✅ Rapports détaillés',
                    voiceRecognition: '✅ Reconnaissance vocale'
                }
            }
        };
        this.translations = this.sanitizeTranslationMap(this.translations);
        this.extendDecisionTranslations();
        this.applyTranslationHotfixes();
        
        this.chartLegendCollapsed = true;
        this.selectedCategoryForPrint = null;
        this.selectedCategoryExpenses = [];
        this.init();
    }


applyTranslationHotfixes() {
    const overrides = {
        it: {
            savingsPotInputLabel: 'Fondo iniziale (€)',
            currentPlan: 'Piano attuale',
            currentPlanMessage: "Con questi parametri non raggiungerai l'obiettivo",
            backupButton: 'Scarica backup',
            restoreButton: 'Ripristina',
            chartTitleBars: 'Entrate vs uscite',
            chartTitleTrend: 'Trend saldo mensile',
            categoryPrintSelectedLabel: 'Categoria selezionata',
            categoryPrintHintReady: 'Premi Stampa PDF per esportare solo i movimenti di questa categoria.',
            categoryPrintHintEmpty: 'Questa categoria non contiene ancora movimenti esportabili nel periodo.',
            categoryPrintTotalLabel: 'Totale',
            categoryPrintCountLabel: 'Movimenti',
            categoryPrintButton: 'Stampa PDF categoria',
            categoryPrintPdfTopline: 'Kedrix · Category Report',
            categoryPrintSubtitle: 'Report stampabile dei movimenti associati alla categoria selezionata.',
            categoryPrintPeriodLabel: 'Periodo',
            categoryPrintGeneratedOn: 'Generato il {date}',
            categoryPrintListSubtitle: 'Elenco completo dei movimenti della categoria selezionata con totale finale.',
            categoryPrintMovements: 'Movimenti',
            categoryPrintTotalCategory: 'Totale categoria',
            categoryPrintDate: 'Data',
            categoryPrintItem: 'Voce',
            categoryPrintAmount: 'Importo',
            categoryPrintFooter: 'Kedrix · Browser-exportable PDF report',
            showCategories: 'Mostra categorie',
            hideCategories: 'Nascondi categorie',
            aiQuestionSave100: 'Come posso risparmiare 100€ questo mese?',
            aiQuestionSimulateIncrease: 'Cosa succede se aumento le spese del 20%?',
            aiQuestionGoal: 'Quando raggiungerò il mio obiettivo?',
            aiQuestionTopCategory: 'Qual è la categoria dove spendo di più?',
            goalRaisedToast: '🎯 Obiettivo aumentato a {amount}',
            aiTransportConfirm: '🚗 Prova a usare mezzi pubblici o car pooling per risparmiare {amount} al mese. Vuoi fissare un obiettivo?',
            aiLeisureConfirm: '🎮 Limitando le uscite a 2 a settimana, potresti risparmiare {amount}. Vuoi fissare un obiettivo?'
        },
        en: {
            savingsPotInputLabel: 'Initial fund (€)',
            currentPlan: 'Current plan',
            currentPlanMessage: "At the current pace, you'll never reach the goal",
            backupButton: 'Download backup',
            restoreButton: 'Restore',
            chartTitleBars: 'Income vs expenses',
            chartTitleTrend: 'Monthly balance trend',
            categoryPrintSelectedLabel: 'Selected category',
            categoryPrintHintReady: 'Press Print PDF to export only the movements in this category.',
            categoryPrintHintEmpty: 'This category does not contain exportable movements in the current period yet.',
            categoryPrintTotalLabel: 'Total',
            categoryPrintCountLabel: 'Transactions',
            categoryPrintButton: 'Print category PDF',
            categoryPrintPdfTopline: 'Kedrix · Category Report',
            categoryPrintSubtitle: 'Printable report of the movements linked to the selected category.',
            categoryPrintPeriodLabel: 'Period',
            categoryPrintGeneratedOn: 'Generated on {date}',
            categoryPrintListSubtitle: 'Complete list of movements for the selected category with final total.',
            categoryPrintMovements: 'Transactions',
            categoryPrintTotalCategory: 'Category total',
            categoryPrintDate: 'Date',
            categoryPrintItem: 'Item',
            categoryPrintAmount: 'Amount',
            categoryPrintFooter: 'Kedrix · Browser-exportable PDF report',
            showCategories: 'Show categories',
            hideCategories: 'Hide categories',
            aiQuestionSave100: 'How can I save 100€ this month?',
            aiQuestionSimulateIncrease: 'What happens if I increase expenses by 20%?',
            aiQuestionGoal: 'When will I reach my goal?',
            aiQuestionTopCategory: 'Which category am I spending the most on?',
            goalRaisedToast: '🎯 Goal increased to {amount}',
            aiTransportConfirm: '🚗 Try using public transport or car pooling to save {amount} per month. Want to set a goal?',
            aiLeisureConfirm: '🎮 Limiting yourself to 2 outings per week could save {amount}. Want to set a goal?'
        },
        es: {
            savingsPotInputLabel: 'Fondo inicial (€)',
            currentPlan: 'Plan actual',
            currentPlanMessage: 'Con estos parámetros no alcanzarás el objetivo',
            backupButton: 'Descargar copia',
            restoreButton: 'Restaurar',
            chartTitleBars: 'Ingresos vs gastos',
            chartTitleTrend: 'Tendencia del saldo mensual',
            categoryPrintSelectedLabel: 'Categoría seleccionada',
            categoryPrintHintReady: 'Pulsa Imprimir PDF para exportar solo los movimientos de esta categoría.',
            categoryPrintHintEmpty: 'Esta categoría todavía no contiene movimientos exportables en el período actual.',
            categoryPrintTotalLabel: 'Total',
            categoryPrintCountLabel: 'Movimientos',
            categoryPrintButton: 'Imprimir PDF de la categoría',
            categoryPrintPdfTopline: 'Kedrix · Category Report',
            categoryPrintSubtitle: 'Informe imprimible de los movimientos asociados a la categoría seleccionada.',
            categoryPrintPeriodLabel: 'Período',
            categoryPrintGeneratedOn: 'Generado el {date}',
            categoryPrintListSubtitle: 'Lista completa de movimientos de la categoría seleccionada con total final.',
            categoryPrintMovements: 'Movimientos',
            categoryPrintTotalCategory: 'Total de categoría',
            categoryPrintDate: 'Fecha',
            categoryPrintItem: 'Concepto',
            categoryPrintAmount: 'Importe',
            categoryPrintFooter: 'Kedrix · Browser-exportable PDF report',
            showCategories: 'Mostrar categorías',
            hideCategories: 'Ocultar categorías',
            aiQuestionSave100: '¿Cómo puedo ahorrar 100€ este mes?',
            aiQuestionSimulateIncrease: '¿Qué pasa si aumento los gastos un 20%?',
            aiQuestionGoal: '¿Cuándo alcanzaré mi objetivo?',
            aiQuestionTopCategory: '¿En qué categoría estoy gastando más?',
            goalRaisedToast: '🎯 Objetivo aumentado a {amount}',
            aiTransportConfirm: '🚗 Prueba el transporte público o compartir coche para ahorrar {amount} al mes. ¿Quieres fijar un objetivo?',
            aiLeisureConfirm: '🎮 Si limitas las salidas a 2 por semana, podrías ahorrar {amount}. ¿Quieres fijar un objetivo?'
        },
        fr: {
            savingsPotInputLabel: 'Fonds initial (€)',
            currentPlan: 'Plan actuel',
            currentPlanMessage: "Avec ces paramètres, vous n'atteindrez pas l'objectif",
            backupButton: 'Télécharger la sauvegarde',
            restoreButton: 'Restaurer',
            chartTitleBars: 'Revenus vs dépenses',
            chartTitleTrend: 'Tendance du solde mensuel',
            categoryPrintSelectedLabel: 'Catégorie sélectionnée',
            categoryPrintHintReady: 'Appuyez sur Imprimer le PDF pour exporter uniquement les mouvements de cette catégorie.',
            categoryPrintHintEmpty: "Cette catégorie ne contient pas encore de mouvements exportables sur la période en cours.",
            categoryPrintTotalLabel: 'Total',
            categoryPrintCountLabel: 'Mouvements',
            categoryPrintButton: 'Imprimer le PDF de la catégorie',
            categoryPrintPdfTopline: 'Kedrix · Category Report',
            categoryPrintSubtitle: 'Rapport imprimable des mouvements associés à la catégorie sélectionnée.',
            categoryPrintPeriodLabel: 'Période',
            categoryPrintGeneratedOn: 'Généré le {date}',
            categoryPrintListSubtitle: 'Liste complète des mouvements de la catégorie sélectionnée avec total final.',
            categoryPrintMovements: 'Mouvements',
            categoryPrintTotalCategory: 'Total catégorie',
            categoryPrintDate: 'Date',
            categoryPrintItem: 'Libellé',
            categoryPrintAmount: 'Montant',
            categoryPrintFooter: 'Kedrix · Browser-exportable PDF report',
            showCategories: 'Afficher les catégories',
            hideCategories: 'Masquer les catégories',
            aiQuestionSave100: 'Comment puis-je économiser 100€ ce mois-ci ?',
            aiQuestionSimulateIncrease: 'Que se passe-t-il si j’augmente mes dépenses de 20 % ?',
            aiQuestionGoal: 'Quand atteindrai-je mon objectif ?',
            aiQuestionTopCategory: 'Dans quelle catégorie est-ce que je dépense le plus ?',
            goalRaisedToast: '🎯 Objectif augmenté à {amount}',
            aiTransportConfirm: '🚗 Essayez les transports publics ou le covoiturage pour économiser {amount} par mois. Voulez-vous fixer un objectif ?',
            aiLeisureConfirm: '🎮 En limitant les sorties à 2 par semaine, vous pourriez économiser {amount}. Voulez-vous fixer un objectif ?'
        }
    };
    Object.entries(overrides).forEach(([lang, entries]) => {
        this.translations[lang] = this.translations[lang] || {};
        Object.assign(this.translations[lang], entries);
    });
}

extendDecisionTranslations() {
    const extra = {
        it: {
            homeQuickEntryTitle: 'Quick Entry',
            homeQuickEntrySubtitle: 'Registra una spesa adesso',
            decisionCardTitle: 'WiseDecision™',
            decisionCardLabel: 'Decisione di oggi',
            decisionSafeTitle: 'Mantieni il ritmo',
            decisionSafeText: 'Oggi puoi mantenere una spesa equilibrata: il forecast del periodo resta sotto controllo.',
            decisionBalancedTitle: 'Controllo attivo',
            decisionBalancedText: 'Mantieni il controllo: oggi conviene restare vicino al budget giornaliero.',
            decisionCautiousTitle: 'Spesa prudente',
            decisionCautiousText: 'Meglio una spesa cauta: margine giornaliero o piano risparmi richiedono attenzione.',
            decisionCriticalTitle: 'Blocca il superfluo',
            decisionCriticalText: 'Il forecast del periodo è sotto pressione: oggi evita spese non essenziali.',
            decisionReasonForecast: 'Forecast sotto controllo',
            decisionReasonLowBudget: 'Budget giornaliero ridotto',
            decisionReasonSustainability: 'Risparmio da alleggerire',
            decisionReasonStableSavings: 'Piano risparmi sostenibile',
            decisionReasonNeutral: 'Periodo in osservazione',
            allocationPeriod: 'Allocazione periodo',
            sustainability: 'Sostenibilità',
            accumulatedSavingsLabel: 'Risparmi accumulati',
            currentRateLabel: 'Tasso di risparmio',
            comfortable: 'Confortevole',
            balanced: 'Equilibrato',
            aggressive: 'Aggressivo',
            overstretched: 'Teso',
            savingsRolloverPrompt: 'Avevi pianificato di risparmiare {amount} in questo periodo.\n\nVuoi aggiungere questo importo ai risparmi accumulati?',
            confirmSavingsAdded: 'Risparmio accumulato aggiornato.',
            savingsDecisionNote: 'Impegno virtuale del periodo',
            periodAllocationLabel: 'Allocazione del periodo',
            decisionSummaryLabel: 'Sintesi operativa',
            projectedOnTarget: 'Allocazione attiva nel periodo',
            accumulatedSavingsHero: 'Risparmi accumulati',
            wiseBrainOk: 'WiseBrain™ · Coerenza OK',
            wiseBrainWarning: 'WiseBrain™ · Coerenza da verificare',
            wiseBrainMismatch: 'WiseBrain™ · Possibile mismatch',
            wiseBrainOkNote: 'I principali motori risultano coerenti nel periodo attivo.',
            wiseBrainWarningNote: 'Piano risparmio attivo mentre forecast o budget sono sotto pressione.',
            wiseBrainMismatchNote: 'Alcuni segnali del periodo richiedono una verifica dei dati.',
            decisionSavingsStressTitle: 'Riduci il piano risparmio',
            decisionSavingsStressText: 'Prima proteggi la liquidità del periodo: il piano attuale è troppo pesante rispetto al margine disponibile.',
            decisionLiquidityTitle: 'Proteggi la liquidità',
            decisionLiquidityText: 'Il periodo è sotto pressione: oggi dai priorità a spese essenziali e stabilità del saldo.',
            decisionDataTitle: 'Verifica i dati del periodo',
            decisionDataText: 'Alcuni segnali non sono perfettamente allineati: meglio controllare movimenti e piano attuale.',
            decisionActionSavings: 'Risparmio da ricalibrare',
            decisionActionLiquidity: 'Liquidità da proteggere',
            decisionActionData: 'Controllo dati consigliato',
            savingsDecisionActiveNote: 'Piano attivo nel periodo corrente.',
            savingsDecisionSuggestedNote: 'Miglior proposta del sistema in base a forecast e margine del periodo.',
            savingsDecisionStressNote: 'WiseBrain consiglia di alleggerire il piano per proteggere la liquidità del periodo.',
            savingsDecisionNoRoomNote: 'Meglio preservare liquidità: nessuna allocazione consigliata al momento.',
            savingsGoalReached: 'Obiettivo già raggiunto',
            savingsPlanInactive: 'Piano non attivo',
            savingsApplyBrainSuggestion: 'Applica suggerimento',
            savingsRecalibratedToast: 'Piano risparmio ricalibrato a {percent}%',
            zeroDataTitle: 'In attesa di dati',
            zeroDataDescription: 'Inserisci entrate o spese per attivare l’analisi del periodo.',
            zeroDataDecisionReason: 'Quick Entry pronto: i motori si attivano dopo i primi movimenti.',
            forecastIdleStatus: 'In attesa di dati',
            forecastIdleSubtitle: 'Forecast non disponibile finché non registri le prime operazioni del periodo.',
            forecastIdleInfo: 'Aggiungi entrate o spese per attivare il forecast del periodo.',
            scoreIdleStatus: 'In attesa di dati',
            scoreIdleMeta: 'Inserisci entrate e spese per calcolare il WiseScore™.',
            savingsIdleTarget: 'In attesa di dati',
            savingsIdlePlan: 'Inserisci la prima entrata o spesa per attivare il piano di risparmio.',
            savingsIdleSuggestion: 'Nessuna allocazione consigliata al momento.',
            savingsDecisionIdleNote: 'Nessuna allocazione consigliata: il piano si attiva dopo i primi movimenti del periodo.'
        },
        en: {
            homeQuickEntryTitle: 'Quick Entry',
            homeQuickEntrySubtitle: 'Log an expense now',
            decisionCardTitle: 'WiseDecision™',
            decisionCardLabel: 'Today’s decision',
            decisionSafeTitle: 'Stay on pace',
            decisionSafeText: 'You can keep spending balanced today: the period forecast remains under control.',
            decisionBalancedTitle: 'Active control',
            decisionBalancedText: 'Stay in control: it is better to remain close to the daily budget today.',
            decisionCautiousTitle: 'Spend cautiously',
            decisionCautiousText: 'Keep spending cautious today: daily margin or savings plan needs attention.',
            decisionCriticalTitle: 'Pause non-essential spending',
            decisionCriticalText: 'The period forecast is under pressure: avoid non-essential spending today.',
            decisionReasonForecast: 'Forecast under control',
            decisionReasonLowBudget: 'Daily budget is tight',
            decisionReasonSustainability: 'Savings plan is too stretched',
            decisionReasonStableSavings: 'Savings plan is sustainable',
            decisionReasonNeutral: 'Period is being monitored',
            allocationPeriod: 'Period allocation',
            sustainability: 'Sustainability',
            accumulatedSavingsLabel: 'Accumulated savings',
            currentRateLabel: 'Savings rate',
            comfortable: 'Comfortable',
            balanced: 'Balanced',
            aggressive: 'Aggressive',
            overstretched: 'Overstretched',
            savingsRolloverPrompt: 'You planned to save {amount} during this period.\n\nDo you want to add this amount to accumulated savings?',
            confirmSavingsAdded: 'Accumulated savings updated.',
            savingsDecisionNote: 'Virtual commitment for the period',
            periodAllocationLabel: 'Period allocation',
            decisionSummaryLabel: 'Operational summary',
            projectedOnTarget: 'Active allocation in the period',
            accumulatedSavingsHero: 'Accumulated savings',
            wiseBrainOk: 'WiseBrain™ · Coherence OK',
            wiseBrainWarning: 'WiseBrain™ · Coherence to review',
            wiseBrainMismatch: 'WiseBrain™ · Possible mismatch',
            wiseBrainOkNote: 'The main engines look coherent in the active period.',
            wiseBrainWarningNote: 'Savings plan is active while forecast or daily budget are under pressure.',
            wiseBrainMismatchNote: 'Some signals in the period require a quick data check.',
            decisionSavingsStressTitle: 'Reduce the savings plan',
            decisionSavingsStressText: 'Protect period liquidity first: the current plan is too heavy for the available margin.',
            decisionLiquidityTitle: 'Protect liquidity',
            decisionLiquidityText: 'The period is under pressure: prioritise essential spending and balance stability today.',
            decisionDataTitle: 'Check period data',
            decisionDataText: 'Some signals are not fully aligned: it is better to verify movements and the current plan.',
            decisionActionSavings: 'Savings to recalibrate',
            decisionActionLiquidity: 'Liquidity to protect',
            decisionActionData: 'Data check recommended',
            savingsDecisionActiveNote: 'Plan active in the current period.',
            savingsDecisionSuggestedNote: 'Best system proposal based on forecast and period margin.',
            savingsDecisionStressNote: 'WiseBrain recommends easing the plan to protect period liquidity.',
            savingsDecisionNoRoomNote: 'Preserve liquidity first: no allocation is recommended right now.',
            savingsGoalReached: 'Goal already reached',
            savingsPlanInactive: 'Plan inactive',
            savingsApplyBrainSuggestion: 'Apply suggestion',
            savingsRecalibratedToast: 'Savings plan recalibrated to {percent}%',
            zeroDataTitle: 'Waiting for data',
            zeroDataDescription: 'Add income or expenses to activate period analysis.',
            zeroDataDecisionReason: 'Quick Entry is ready: engines activate after the first transactions.',
            forecastIdleStatus: 'Waiting for data',
            forecastIdleSubtitle: 'Forecast is unavailable until you log the first period transactions.',
            forecastIdleInfo: 'Add income or expenses to activate the period forecast.',
            scoreIdleStatus: 'Waiting for data',
            scoreIdleMeta: 'Add income and expenses to calculate WiseScore™.',
            savingsIdleTarget: 'Waiting for data',
            savingsIdlePlan: 'Add the first income or expense to activate the savings plan.',
            savingsIdleSuggestion: 'No allocation is recommended right now.',
            savingsDecisionIdleNote: 'No allocation suggested yet: the plan activates after the first period transactions.'
        },
        es: {
            homeQuickEntryTitle: 'Entrada rápida',
            homeQuickEntrySubtitle: 'Registra un gasto ahora',
            decisionCardTitle: 'WiseDecision™',
            decisionCardLabel: 'Decisión de hoy',
            decisionSafeTitle: 'Mantén el ritmo',
            decisionSafeText: 'Hoy puedes mantener un gasto equilibrado: el forecast del período sigue bajo control.',
            decisionBalancedTitle: 'Control activo',
            decisionBalancedText: 'Mantén el control: hoy conviene seguir cerca del presupuesto diario.',
            decisionCautiousTitle: 'Gasto prudente',
            decisionCautiousText: 'Conviene gastar con prudencia hoy: el margen diario o el plan de ahorro requieren atención.',
            decisionCriticalTitle: 'Detén lo no esencial',
            decisionCriticalText: 'El forecast del período está bajo presión: evita hoy los gastos no esenciales.',
            decisionReasonForecast: 'Forecast bajo control',
            decisionReasonLowBudget: 'Presupuesto diario ajustado',
            decisionReasonSustainability: 'Plan de ahorro demasiado tenso',
            decisionReasonStableSavings: 'Plan de ahorro sostenible',
            decisionReasonNeutral: 'Período en observación',
            allocationPeriod: 'Asignación del período',
            sustainability: 'Sostenibilidad',
            accumulatedSavingsLabel: 'Ahorro acumulado',
            currentRateLabel: 'Tasa de ahorro',
            comfortable: 'Cómodo',
            balanced: 'Equilibrado',
            aggressive: 'Agresivo',
            overstretched: 'Forzado',
            savingsRolloverPrompt: 'Habías previsto ahorrar {amount} durante este período.\n\n¿Quieres añadir este importe al ahorro acumulado?',
            confirmSavingsAdded: 'Ahorro acumulado actualizado.',
            savingsDecisionNote: 'Compromiso virtual del período',
            periodAllocationLabel: 'Asignación del período',
            decisionSummaryLabel: 'Síntesis operativa',
            projectedOnTarget: 'Asignación activa en el período',
            accumulatedSavingsHero: 'Ahorro acumulado',
            wiseBrainOk: 'WiseBrain™ · Coherencia OK',
            wiseBrainWarning: 'WiseBrain™ · Coherencia por revisar',
            wiseBrainMismatch: 'WiseBrain™ · Posible desajuste',
            wiseBrainOkNote: 'Los motores principales son coherentes en el período activo.',
            wiseBrainWarningNote: 'El plan de ahorro está activo mientras el forecast o el presupuesto diario están bajo presión.',
            wiseBrainMismatchNote: 'Algunas señales del período requieren una verificación rápida de datos.',
            decisionSavingsStressTitle: 'Reduce el plan de ahorro',
            decisionSavingsStressText: 'Protege primero la liquidez del período: el plan actual es demasiado pesado para el margen disponible.',
            decisionLiquidityTitle: 'Protege la liquidez',
            decisionLiquidityText: 'El período está bajo presión: hoy prioriza gastos esenciales y estabilidad del saldo.',
            decisionDataTitle: 'Verifica los datos del período',
            decisionDataText: 'Algunas señales no están totalmente alineadas: conviene revisar movimientos y el plan actual.',
            decisionActionSavings: 'Ahorro para recalibrar',
            decisionActionLiquidity: 'Liquidez para proteger',
            decisionActionData: 'Se recomienda revisar datos',
            savingsDecisionActiveNote: 'Plan activo en el período actual.',
            savingsDecisionSuggestedNote: 'Mejor propuesta del sistema según forecast y margen del período.',
            savingsDecisionStressNote: 'WiseBrain recomienda aligerar el plan para proteger la liquidez del período.',
            savingsDecisionNoRoomNote: 'Conviene preservar liquidez: no se recomienda asignación en este momento.',
            savingsGoalReached: 'Objetivo ya alcanzado',
            savingsPlanInactive: 'Plan no activo',
            savingsApplyBrainSuggestion: 'Aplicar sugerencia',
            savingsRecalibratedToast: 'Plan de ahorro recalibrado al {percent}%',
            zeroDataTitle: 'Esperando datos',
            zeroDataDescription: 'Agrega ingresos o gastos para activar el análisis del período.',
            zeroDataDecisionReason: 'La entrada rápida está lista: los motores se activan después de los primeros movimientos.',
            forecastIdleStatus: 'Esperando datos',
            forecastIdleSubtitle: 'El pronóstico no está disponible hasta registrar las primeras operaciones del período.',
            forecastIdleInfo: 'Agrega ingresos o gastos para activar el pronóstico del período.',
            scoreIdleStatus: 'Esperando datos',
            scoreIdleMeta: 'Agrega ingresos y gastos para calcular WiseScore™.',
            savingsIdleTarget: 'Esperando datos',
            savingsIdlePlan: 'Agrega el primer ingreso o gasto para activar el plan de ahorro.',
            savingsIdleSuggestion: 'No hay asignación recomendada por ahora.',
            savingsDecisionIdleNote: 'Todavía no se recomienda una asignación: el plan se activa tras los primeros movimientos del período.'
        },
        fr: {
            homeQuickEntryTitle: 'Saisie rapide',
            homeQuickEntrySubtitle: 'Enregistrez une dépense maintenant',
            decisionCardTitle: 'WiseDecision™',
            decisionCardLabel: 'Décision du jour',
            decisionSafeTitle: 'Restez sur le rythme',
            decisionSafeText: 'Vous pouvez garder une dépense équilibrée aujourd’hui : le forecast de la période reste sous contrôle.',
            decisionBalancedTitle: 'Contrôle actif',
            decisionBalancedText: 'Restez en contrôle : il vaut mieux rester proche du budget quotidien aujourd’hui.',
            decisionCautiousTitle: 'Dépense prudente',
            decisionCautiousText: 'Mieux vaut rester prudent aujourd’hui : la marge quotidienne ou le plan d’épargne demandent de l’attention.',
            decisionCriticalTitle: 'Stoppez le non essentiel',
            decisionCriticalText: 'Le forecast de la période est sous pression : évitez aujourd’hui les dépenses non essentielles.',
            decisionReasonForecast: 'Forecast sous contrôle',
            decisionReasonLowBudget: 'Budget quotidien serré',
            decisionReasonSustainability: 'Plan d’épargne trop tendu',
            decisionReasonStableSavings: 'Plan d’épargne soutenable',
            decisionReasonNeutral: 'Période sous observation',
            allocationPeriod: 'Allocation de la période',
            sustainability: 'Soutenabilité',
            accumulatedSavingsLabel: 'Épargne accumulée',
            currentRateLabel: 'Taux d’épargne',
            comfortable: 'Confortable',
            balanced: 'Équilibré',
            aggressive: 'Agressif',
            overstretched: 'Trop tendu',
            savingsRolloverPrompt: 'Vous aviez prévu d’épargner {amount} pendant cette période.\n\nVoulez-vous ajouter ce montant à l’épargne accumulée ?',
            confirmSavingsAdded: 'Épargne accumulée mise à jour.',
            savingsDecisionNote: 'Engagement virtuel de la période',
            periodAllocationLabel: 'Allocation de la période',
            decisionSummaryLabel: 'Synthèse opérationnelle',
            projectedOnTarget: 'Allocation active dans la période',
            accumulatedSavingsHero: 'Épargne accumulée',
            wiseBrainOk: 'WiseBrain™ · Cohérence OK',
            wiseBrainWarning: 'WiseBrain™ · Cohérence à vérifier',
            wiseBrainMismatch: 'WiseBrain™ · Mismatch possible',
            wiseBrainOkNote: 'Les principaux moteurs restent cohérents sur la période active.',
            wiseBrainWarningNote: 'Le plan d’épargne est actif alors que le forecast ou le budget quotidien sont sous pression.',
            wiseBrainMismatchNote: 'Certains signaux de la période demandent une vérification rapide des données.',
            decisionSavingsStressTitle: 'Réduisez le plan d’épargne',
            decisionSavingsStressText: 'Protégez d’abord la liquidité de la période : le plan actuel est trop lourd par rapport à la marge disponible.',
            decisionLiquidityTitle: 'Protégez la liquidité',
            decisionLiquidityText: 'La période est sous pression : aujourd’hui, priorisez les dépenses essentielles et la stabilité du solde.',
            decisionDataTitle: 'Vérifiez les données de la période',
            decisionDataText: 'Certains signaux ne sont pas totalement alignés : mieux vaut vérifier les mouvements et le plan actuel.',
            decisionActionSavings: 'Épargne à recalibrer',
            decisionActionLiquidity: 'Liquidité à protéger',
            decisionActionData: 'Contrôle des données conseillé',
            savingsDecisionActiveNote: 'Plan actif sur la période en cours.',
            savingsDecisionSuggestedNote: 'Meilleure proposition du système selon le forecast et la marge de la période.',
            savingsDecisionStressNote: 'WiseBrain recommande d’alléger le plan pour protéger la liquidité de la période.',
            savingsDecisionNoRoomNote: 'Mieux vaut préserver la liquidité : aucune allocation n’est conseillée pour le moment.',
            savingsGoalReached: 'Objectif déjà atteint',
            savingsPlanInactive: 'Plan inactif',
            savingsApplyBrainSuggestion: 'Appliquer la suggestion',
            savingsRecalibratedToast: 'Plan d’épargne recalibré à {percent}%',
            zeroDataTitle: 'En attente de données',
            zeroDataDescription: 'Ajoutez des revenus ou des dépenses pour activer l’analyse de la période.',
            zeroDataDecisionReason: 'La saisie rapide est prête : les moteurs s’activent après les premiers mouvements.',
            forecastIdleStatus: 'En attente de données',
            forecastIdleSubtitle: 'La prévision n’est pas disponible tant que vous n’avez pas enregistré les premières opérations de la période.',
            forecastIdleInfo: 'Ajoutez des revenus ou des dépenses pour activer la prévision de la période.',
            scoreIdleStatus: 'En attente de données',
            scoreIdleMeta: 'Ajoutez des revenus et des dépenses pour calculer le WiseScore™.',
            savingsIdleTarget: 'En attente de données',
            savingsIdlePlan: 'Ajoutez le premier revenu ou la première dépense pour activer le plan d’épargne.',
            savingsIdleSuggestion: 'Aucune allocation n’est conseillée pour le moment.',
            savingsDecisionIdleNote: 'Aucune allocation conseillée pour l’instant : le plan s’active après les premiers mouvements de la période.'
        }
    };
    Object.entries(extra).forEach(([lang, values]) => {
        this.translations[lang] = { ...(this.translations[lang] || {}), ...values };
    });
}

calculateWiseSavingAllocation(income, rate) {
    const safeIncome = Math.max(0, Number(income) || 0);
    const safeRate = Math.max(0, Number(rate) || 0);
    const allocation = (safeIncome * safeRate) / 100;
    this.virtualSavingsAllocation = allocation;
    this.plannedSavingsPeriod = allocation;
    return allocation;
}

getCurrentPeriodKey() {
    return `${this.normalizeIsoDate(this.data.periodStart || '')}|${this.normalizeIsoDate(this.data.periodEnd || '')}`;
}

getAccumulatedSavings() {
    return Math.max(0, Number(localStorage.getItem('bw_accumulated_savings')) || 0);
}

setAccumulatedSavings(value) {
    localStorage.setItem('bw_accumulated_savings', String(Math.max(0, Number(value) || 0)));
}

syncWiseSavingState() {
    const rate = Math.max(0, Number(this.data.savingsPercent || 0));
    localStorage.setItem('bw_saving_rate', String(rate));
    const allocation = this.calculateWiseSavingAllocation(this.calculateTotalIncome(), rate);
    localStorage.setItem('bw_planned_savings_period', String(allocation));
    return allocation;
}

getAvailableBeforeSavings() {
    const periodIncome = Number(this.calculateTotalIncome() || 0);
    const fixedExpensesTotal = Number(this.calculateTotalFixedExpensesUnpaid() || 0);
    const variableExpensesTotal = Number(this.calculateTotalVariableExpenses() || 0);
    return periodIncome - fixedExpensesTotal - variableExpensesTotal;
}

calculateAvailableBalance() {
    const availableBeforeSavings = this.getAvailableBeforeSavings();
    const allocation = this.syncWiseSavingState();
    return availableBeforeSavings - allocation;
}

calculateDecisionDailyBudget() {
    const available = this.calculateAvailableBalance();
    const daysLeft = this.getDaysLeft();
    return daysLeft > 0 ? available / daysLeft : 0;
}

getSavingsSustainabilityData() {
    const availableBeforeSavings = this.getAvailableBeforeSavings();
    const allocation = this.syncWiseSavingState();
    const safeBase = Math.max(0, availableBeforeSavings);
    const ratio = safeBase > 0 ? allocation / safeBase : (allocation > 0 ? Number.POSITIVE_INFINITY : 0);
    let key = 'comfortable';
    let tone = 'comfortable';
    if (!isFinite(ratio) || ratio > 0.50) {
        key = 'overstretched';
        tone = 'overstretched';
    } else if (ratio > 0.35) {
        key = 'aggressive';
        tone = 'aggressive';
    } else if (ratio > 0.20) {
        key = 'balanced';
        tone = 'balanced';
    }
    return {
        ratio,
        tone,
        key,
        label: this.t(key),
        allocation,
        availableBeforeSavings
    };
}


isZeroDataState() {
    const income = Math.max(0, Number(this.calculateTotalIncome ? this.calculateTotalIncome() : 0) || 0);
    const fixed = Math.max(0, Number(this.calculateTotalFixedExpenses ? this.calculateTotalFixedExpenses() : 0) || 0);
    const variable = Math.max(0, Number(this.calculateTotalVariableExpenses ? this.calculateTotalVariableExpenses() : 0) || 0);
    return income <= 0.009 && fixed <= 0.009 && variable <= 0.009;
}

getWiseBrainState() {
    if (this.isZeroDataState && this.isZeroDataState()) {
        return {
            coherence: 'idle',
            priority: 'idle',
            forecast: { projectedEndBalance: 0 },
            sustainability: { key: 'balanced', label: this.t('balanced'), tone: 'balanced', allocation: 0, availableBeforeSavings: 0 },
            dailyBudget: 0,
            daysLeft: Math.max(0, Number(this.getDaysLeft ? this.getDaysLeft() : 0) || 0),
            income: 0,
            currentAllocation: 0,
            currentPercent: 0,
            recommendedAllocation: 0,
            recommendedPercent: 0,
            needsSavingsRecalibration: false,
            badge: '',
            note: ''
        };
    }
    const forecast = this.calculateWiseForecastData ? this.calculateWiseForecastData() : { projectedEndBalance: 0 };
    const sustainability = this.getSavingsSustainabilityData();
    const dailyBudget = Number(this.calculateDecisionDailyBudget() || 0);
    const daysLeft = Math.max(0, Number(this.getDaysLeft ? this.getDaysLeft() : 0) || 0);
    const income = Math.max(0, Number(this.calculateTotalIncome ? this.calculateTotalIncome() : 0) || 0);
    const availableBeforeSavings = Math.max(0, Number(sustainability?.availableBeforeSavings || 0));
    const currentAllocation = Math.max(0, Number(sustainability?.allocation || 0));
    const currentPercent = Math.max(0, Number(this.data?.savingsPercent || 0));
    const projectedEndBalance = Number(forecast?.projectedEndBalance || 0);
    const fixedToAbsorb = Math.max(0, Number(this.calculateTotalFixedExpensesUnpaid ? this.calculateTotalFixedExpensesUnpaid() : 0) || 0);

    let coherence = 'ok';
    if ((income <= 0 && currentAllocation > 0) || (!isFinite(dailyBudget) && income > 0)) {
        coherence = 'mismatch';
    } else if (currentAllocation > 0 && (projectedEndBalance < 0 || dailyBudget <= 0 || sustainability.key === 'overstretched')) {
        coherence = 'warning';
    }

    let priority = 'normal';
    if (coherence === 'mismatch') {
        priority = 'data';
    } else if (currentAllocation > 0 && (projectedEndBalance < 0 || dailyBudget <= 0 || sustainability.key === 'overstretched')) {
        priority = 'savings';
    } else if (projectedEndBalance < 0 || dailyBudget <= 0) {
        priority = 'liquidity';
    }

    const prudentRoom = Math.max(0, Math.min(projectedEndBalance > 0 ? projectedEndBalance * 0.12 : 0, availableBeforeSavings * 0.15));
    const bufferCap = Math.max(0, availableBeforeSavings - Math.max(0, fixedToAbsorb * 0.15));
    let recommendedAllocation = Math.min(prudentRoom, bufferCap);
    if (priority === 'savings' || priority === 'liquidity') {
        recommendedAllocation = Math.min(recommendedAllocation, availableBeforeSavings * 0.08, income * 0.10);
    }
    if (!isFinite(recommendedAllocation) || projectedEndBalance <= 0 || dailyBudget <= 0) {
        recommendedAllocation = 0;
    }
    if (recommendedAllocation > 0) {
        recommendedAllocation = recommendedAllocation >= 100 ? Math.round(recommendedAllocation / 10) * 10 : Math.round(recommendedAllocation / 5) * 5;
    }
    const recommendedPercent = income > 0 ? Math.max(0, Math.min(30, Number(((recommendedAllocation / income) * 100).toFixed(1)))) : 0;
    const needsSavingsRecalibration = currentAllocation > 0 && recommendedAllocation >= 0 && currentAllocation > Math.max(recommendedAllocation + 25, recommendedAllocation * 1.35) && (priority === 'savings' || priority === 'liquidity');

    const badgeKey = coherence === 'ok' ? 'wiseBrainOk' : (coherence === 'warning' ? 'wiseBrainWarning' : 'wiseBrainMismatch');
    const noteKey = coherence === 'ok' ? 'wiseBrainOkNote' : (coherence === 'warning' ? 'wiseBrainWarningNote' : 'wiseBrainMismatchNote');

    return {
        coherence,
        priority,
        forecast,
        sustainability,
        dailyBudget,
        daysLeft,
        income,
        currentAllocation,
        currentPercent,
        recommendedAllocation,
        recommendedPercent,
        needsSavingsRecalibration,
        badge: this.t(badgeKey),
        note: this.t(noteKey)
    };
}

getWiseDecisionData() {
    const brain = this.getWiseBrainState();
    if (this.isZeroDataState && this.isZeroDataState()) {
        return {
            tone: 'idle',
            title: this.t('zeroDataTitle'),
            text: this.t('zeroDataDescription'),
            reason: this.t('zeroDataDecisionReason'),
            sustainability: brain.sustainability,
            dailyBudget: 0,
            forecast: brain.forecast,
            brain
        };
    }
    let tone = 'safe';
    let titleKey = 'decisionSafeTitle';
    let textKey = 'decisionSafeText';
    let reasonKey = 'decisionReasonForecast';

    if (brain.priority === 'data') {
        tone = 'cautious';
        titleKey = 'decisionDataTitle';
        textKey = 'decisionDataText';
        reasonKey = 'decisionActionData';
    } else if (brain.priority === 'savings') {
        tone = 'cautious';
        titleKey = 'decisionSavingsStressTitle';
        textKey = 'decisionSavingsStressText';
        reasonKey = 'decisionActionSavings';
    } else if (brain.priority === 'liquidity') {
        tone = 'critical';
        titleKey = 'decisionLiquidityTitle';
        textKey = 'decisionLiquidityText';
        reasonKey = 'decisionActionLiquidity';
    } else if (Number(brain.forecast?.projectedEndBalance || 0) < 0) {
        tone = 'critical';
        titleKey = 'decisionCriticalTitle';
        textKey = 'decisionCriticalText';
        reasonKey = 'decisionReasonForecast';
    } else if (brain.sustainability.key === 'overstretched' || brain.dailyBudget <= 0 || brain.dailyBudget < 5) {
        tone = 'cautious';
        titleKey = 'decisionCautiousTitle';
        textKey = 'decisionCautiousText';
        reasonKey = brain.sustainability.key === 'overstretched' ? 'decisionReasonSustainability' : 'decisionReasonLowBudget';
    } else if (Number(brain.forecast?.projectedEndBalance || 0) > 0) {
        tone = 'safe';
        titleKey = 'decisionSafeTitle';
        textKey = 'decisionSafeText';
        reasonKey = brain.sustainability.key === 'comfortable' ? 'decisionReasonStableSavings' : 'decisionReasonForecast';
    } else {
        tone = 'balanced';
        titleKey = 'decisionBalancedTitle';
        textKey = 'decisionBalancedText';
        reasonKey = 'decisionReasonNeutral';
    }

    return {
        tone,
        title: this.t(titleKey),
        text: this.t(textKey),
        reason: this.t(reasonKey),
        sustainability: brain.sustainability,
        dailyBudget: brain.dailyBudget,
        forecast: brain.forecast,
        brain
    };
}

initDecisionEnginePatch() {
    const container = document.querySelector('.container');
    const quickCard = document.getElementById('homeQuickAddCard');
    const heroCard = document.querySelector('.home-hero-card');
    const wiseScoreCard = document.getElementById('wiseScoreHomeCard');
    const dailyCheckInCard = document.getElementById('dailyCheckInCard');

    if (container && quickCard && heroCard && heroCard.compareDocumentPosition(quickCard) & Node.DOCUMENT_POSITION_FOLLOWING) {
        container.insertBefore(quickCard, heroCard);
    }

    let decisionCard = document.getElementById('wiseDecisionCard');
    if (!decisionCard && container && quickCard) {
        decisionCard = document.createElement('div');
        decisionCard.className = 'section-card wise-decision-card';
        decisionCard.dataset.tab = 'home';
        decisionCard.id = 'wiseDecisionCard';
        decisionCard.innerHTML = `
            <div class="section-content">
                <div class="wise-decision-head">
                    <div class="wise-decision-title" id="wiseDecisionTitle">WiseDecision™</div>
                </div>
                <div class="wise-decision-label" id="wiseDecisionLabel">Decisione di oggi</div>
                <div class="wise-decision-main" id="wiseDecisionMain">—</div>
                <div class="wise-decision-copy sensitive-insight" id="wiseDecisionCopy">—</div>
                <div class="wise-decision-reason" id="wiseDecisionReason">—</div>
                <div class="wisebrain-badge" id="wiseBrainBadge">—</div>
                <div class="wisebrain-note sensitive-insight" id="wiseBrainNote">—</div>
            </div>
        `;
        quickCard.insertAdjacentElement('afterend', decisionCard);
    }

    if (container && dailyCheckInCard && wiseScoreCard) {
        wiseScoreCard.insertAdjacentElement('afterend', dailyCheckInCard);
    }

    const savingsWidget = document.querySelector('.analysis-savings-card .savings-widget');
    if (savingsWidget && !document.getElementById('wiseSavingSummary')) {
        const summary = document.createElement('div');
        summary.className = 'wise-saving-summary';
        summary.id = 'wiseSavingSummary';
        summary.innerHTML = `
            <div class="wise-saving-summary-card is-primary">
                <div class="wise-saving-summary-label" id="allocationPeriodLabel">Allocazione periodo</div>
                <div class="wise-saving-summary-value sensitive-amount" id="allocationPeriodValue">0,00 €</div>
                <div class="wise-saving-summary-note sensitive-insight" id="allocationPeriodNote">Impegno virtuale del periodo</div>
            </div>
            <div class="wise-saving-summary-grid">
                <div class="wise-saving-mini-card">
                    <div class="wise-saving-mini-label" id="sustainabilityLabel">Sostenibilità</div>
                    <div class="wise-saving-mini-value" id="sustainabilityValue">—</div>
                </div>
                <div class="wise-saving-mini-card">
                    <div class="wise-saving-mini-label" id="accumulatedSavingsLabel">Risparmi accumulati</div>
                    <div class="wise-saving-mini-value sensitive-amount" id="accumulatedSavingsValue">0,00 €</div>
                </div>
                <div class="wise-saving-mini-card">
                    <div class="wise-saving-mini-label" id="currentRateLabel">Tasso di risparmio</div>
                    <div class="wise-saving-mini-value" id="currentRateValue">0%</div>
                </div>
            </div>
        `;
        const controls = savingsWidget.querySelector('.interactive-controls');
        if (controls) controls.insertAdjacentElement('beforebegin', summary);
    }
}

checkSavingsPeriodRolloverAndPrompt() {
    const currentPeriodKey = this.getCurrentPeriodKey();
    const lastSeenPeriod = localStorage.getItem('bw_last_seen_period');
    if (!lastSeenPeriod) {
        localStorage.setItem('bw_last_seen_period', currentPeriodKey);
        this.syncWiseSavingState();
        return;
    }

    if (lastSeenPeriod !== currentPeriodKey) {
        const plannedPrevious = Math.max(0, Number(localStorage.getItem('bw_planned_savings_period')) || 0);
        const confirmedPeriod = localStorage.getItem('bw_last_savings_period');
        if (plannedPrevious > 0 && confirmedPeriod !== lastSeenPeriod) {
            this.showAppConfirm(this.t('savingsRolloverPrompt', { amount: this.formatCurrency(plannedPrevious) })).then((shouldAdd) => {
                if (!shouldAdd) return;
                this.setAccumulatedSavings(this.getAccumulatedSavings() + plannedPrevious);
                localStorage.setItem('bw_last_savings_period', lastSeenPeriod);
                this.showToast(this.t('confirmSavingsAdded'), 'success');
            });
        }
        localStorage.setItem('bw_last_seen_period', currentPeriodKey);
    }

    this.syncWiseSavingState();
}

updateWiseDecisionCard() {
    const decision = this.getWiseDecisionData();
    const titleEl = document.getElementById('wiseDecisionTitle');
    const labelEl = document.getElementById('wiseDecisionLabel');
    const mainEl = document.getElementById('wiseDecisionMain');
    const copyEl = document.getElementById('wiseDecisionCopy');
    const reasonEl = document.getElementById('wiseDecisionReason');
    const cardEl = document.getElementById('wiseDecisionCard');
    const brainBadgeEl = document.getElementById('wiseBrainBadge');
    const brainNoteEl = document.getElementById('wiseBrainNote');
    const quickTitleEl = document.querySelector('[data-i18n="homeQuickActionsTitle"]');
    const quickSubtitleEl = document.querySelector('[data-i18n="homePriorityKicker"]');

    if (quickTitleEl) quickTitleEl.textContent = this.t('homeQuickEntryTitle');
    if (quickSubtitleEl) quickSubtitleEl.textContent = this.t('homeQuickEntrySubtitle');

    if (titleEl) titleEl.textContent = this.t('decisionCardTitle');
    if (labelEl) labelEl.textContent = this.t('decisionCardLabel');
    if (cardEl) {
        cardEl.dataset.tone = decision.tone;
        cardEl.dataset.brain = decision.brain?.coherence || 'ok';
        cardEl.classList.toggle('is-idle', decision.tone === 'idle');
    }
    if (mainEl) {
        mainEl.textContent = decision.title;
        mainEl.className = `wise-decision-main ${decision.tone}`;
    }
    if (copyEl) copyEl.textContent = decision.text;
    if (reasonEl) {
        reasonEl.textContent = decision.reason || '';
        reasonEl.className = `wise-decision-reason ${decision.tone}`;
        reasonEl.style.display = decision.reason ? '' : 'none';
    }
    if (brainBadgeEl) {
        brainBadgeEl.textContent = decision.brain?.badge || '';
        brainBadgeEl.className = `wisebrain-badge ${decision.brain?.coherence || 'ok'}`;
        brainBadgeEl.style.display = decision.brain?.badge ? '' : 'none';
    }
    if (brainNoteEl) {
        brainNoteEl.textContent = decision.brain?.note || '';
        brainNoteEl.className = `wisebrain-note sensitive-insight ${decision.brain?.coherence || 'ok'}`;
        brainNoteEl.style.display = decision.brain?.note ? '' : 'none';
    }
}

    initializeLicenseSystem() {
        // ========== SISTEMA LICENZE ==========
        if (typeof KedrixLicense !== 'undefined') {
            this.license = new KedrixLicense();
            console.log('✅ Sistema licenze inizializzato correttamente');
        } else {
            console.warn('⚠️ KedrixLicense non disponibile, uso fallback');
            
            // Fallback inline
            this.license = {
                isPremium: false,
                trialUsed: false,
                limits: {
                    free: { maxTransactions: 50, maxCategories: 3, csvImport: false },
                    premium: { maxTransactions: Infinity, maxCategories: Infinity, csvImport: true }
                },
                checkPremiumStatus: () => false,
                getPlanInfo: () => ({ name: 'Free', status: 'Limitato' }),
                hasFullPremiumAccess: () => false,
                canUseFeature: (feature) => false,
                canAddTransaction: (count) => count < 50,
                getCurrentLimits: () => ({ maxTransactions: 50, maxCategories: 3, csvImport: false }),
                getUpgradeMessage: (feature) => 'Questa funzionalità è disponibile nella versione Premium! 💎'
            };
        }
    }

    init() {
        // ========== INIZIALIZZAZIONE SISTEMA LICENZE ==========
        this.initializeLicenseSystem();
        
        this.loadData();
        this.initDecisionEnginePatch();
        this.setupEventListeners();
        this.applyTheme();
        // NOTE: custom colors should NOT override theme defaults unless the user explicitly saved them.
        // Otherwise we would "freeze" light colors as inline CSS variables and dark mode would barely change.
        if (this.readStorage('kedrix-custom-colors')) {
            this.applyCustomColors();
        } else {
            this.clearThemeInlineOverrides();
        }
        this.setupColorPickers();
        this.updateUI();
        this.updateChart();
        this.setupVoice();
        this.applyLanguage();
        try { this.renderWiseForecastCard && this.renderWiseForecastCard(); } catch (_e) {}
        this.cleanupDecorativeUI();
        this.startOnboarding();
        this.updateAllCategorySelects();
        this.initTabs();
        this.initPrivacyToggle();
        this.updateBetaBuildUI();
        this.setupBetaFeedbackActions();
        this.setupDistributionActions();
        this.handleAppShortcuts();

        const toggle = document.getElementById('showAllExpensesToggle');
        if (toggle) toggle.checked = !!this.showAllExpenses;
        this.populateCategoryFilter();
    }

    getDefaultPeriodStart() {
        // Default: start from last salary income (if available), otherwise today
        const salary = this.findLastSalaryIncome();
        if (salary && salary.date) return this.normalizeIsoDate(salary.date);
        const today = new Date();
        return this.formatLocalDate(today);
    }

    getDefaultPeriodEnd() {
        // Default: next salary date (one month after last salary), otherwise +28 days
        const salary = this.findLastSalaryIncome();
        if (salary && salary.date) {
            const start = this.normalizeIsoDate(salary.date);
            const next = this.addMonthsClamp(start, 1);
            return next;
        }
        const end = new Date();
        end.setDate(end.getDate() + 28);
        return this.formatLocalDate(end);
    }

    normalizeIsoDate(dateStr) {
        if (!dateStr) return '';
        if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
            return this.formatLocalDate(dateStr);
        }

        let s = String(dateStr).trim().replace(/^﻿/, '');
        if (!s) return '';

        const iso = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
        if (iso) {
            const y = iso[1];
            const mm = String(iso[2]).padStart(2, '0');
            const dd = String(iso[3]).padStart(2, '0');
            return `${y}-${mm}-${dd}`;
        }

        const dmy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
        if (dmy) {
            const dd = String(dmy[1]).padStart(2, '0');
            const mm = String(dmy[2]).padStart(2, '0');
            const y = dmy[3];
            return `${y}-${mm}-${dd}`;
        }

        const dateTime = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s].*$/);
        if (dateTime) {
            return `${dateTime[1]}-${dateTime[2]}-${dateTime[3]}`;
        }

        const parsed = new Date(s);
        if (!isNaN(parsed.getTime())) {
            return this.formatLocalDate(parsed);
        }

        return s;
    }

sanitizeDelimitedText(text) {
        return String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    }

splitDelimitedLine(line, delimiter = ',') {
        const out = [];
        let current = '';
        let inQuotes = false;
        const src = String(line || '');

        for (let i = 0; i < src.length; i++) {
            const ch = src[i];
            if (ch === '"') {
                if (inQuotes && src[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }
            if (ch === delimiter && !inQuotes) {
                out.push(current.trim());
                current = '';
                continue;
            }
            current += ch;
        }

        out.push(current.trim());
        return out;
    }

detectCsvDelimiter(text, fallback = ',') {
        const sanitized = this.sanitizeDelimitedText(text);
        const lines = sanitized.split('\n').filter(line => line.trim() !== '');
        const sample = lines.slice(0, Math.min(5, lines.length));
        if (!sample.length) return fallback || ',';

        const candidates = [';', ',', '\t'];
        let best = fallback || ',';
        let bestScore = -1;

        for (const delim of candidates) {
            const counts = sample.map(line => this.splitDelimitedLine(line, delim).length);
            const valid = counts.filter(c => c > 1);
            if (!valid.length) continue;
            const consistency = valid.every(c => c === valid[0]);
            const score = (consistency ? 100 : 0) + valid[0] * 10 + valid.length;
            if (score > bestScore) {
                bestScore = score;
                best = delim;
            }
        }

        return best;
    }

    formatLocalDate(dateObj) {
        if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }


    // ==================== PERIODO BASATO SU STIPENDIO ====================
    isSalaryIncome(inc) {
        if (!inc) return false;
        const desc = String(inc.desc || '').toLowerCase();
        // Versione multilingua potenziata
        return /\b(stipend(io)?|mensilit[àa]|cedolino|paga|salario|retribuzione|salary|pay(|roll|check|cheque)|wage|earnings|stipend|sueldo|salario|estipendio|salaire|paie|traitement|rémunération|gehalt|lohn|besoldung|vergütung|entgelt|salär)\b/i.test(desc);
    }

    findLastSalaryIncome() {
        if (!this.data.incomes || !Array.isArray(this.data.incomes)) return null;
        const today = new Date();
        const candidates = this.data.incomes
            .filter(inc => inc && inc.date && this.isSalaryIncome(inc))
            .map(inc => ({ ...inc, _d: new Date(this.normalizeIsoDate(inc.date)) }))
            .filter(inc => !isNaN(inc._d.getTime()) && inc._d <= today)
            .sort((a, b) => a._d - b._d);
        return candidates.length ? candidates[candidates.length - 1] : null;
    }

    // Aggiunge mesi mantenendo il "giorno stipendio"; se il mese non ha quel giorno, usa l'ultimo giorno del mese
    addMonthsClamp(isoDate, monthsToAdd) {
        const d = new Date(this.normalizeIsoDate(isoDate));
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = d.getMonth();
        const day = d.getDate();
        const targetMonth = m + (monthsToAdd || 0);
        const ty = y + Math.floor(targetMonth / 12);
        const tm = ((targetMonth % 12) + 12) % 12;
        const lastDay = new Date(ty, tm + 1, 0).getDate();
        const dd = Math.min(day, lastDay);
        const out = new Date(ty, tm, dd);
        return this.formatLocalDate(out);
    }


    shiftIsoDate(isoDate, dayDelta) {
        const normalized = this.normalizeIsoDate(isoDate);
        const m = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return normalized;
        const y = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const d = parseInt(m[3], 10);
        const out = new Date(y, mo, d + (dayDelta || 0));
        return this.formatLocalDate(out);
    }

    getRemainingTermCompact(endDate) {
        const normalized = this.normalizeIsoDate(endDate || '');
        const m = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return this.t('noEndDateLabel');

        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const end = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
        if (isNaN(end.getTime())) return this.t('noEndDateLabel');
        if (end < start) return `0${this.t('dayShort')}`;

        let years = end.getFullYear() - start.getFullYear();
        let months = end.getMonth() - start.getMonth();
        let days = end.getDate() - start.getDate();

        if (days < 0) {
            months -= 1;
            const prevMonthLastDay = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
            days += prevMonthLastDay;
        }
        if (months < 0) {
            years -= 1;
            months += 12;
        }

        const parts = [];
        if (years > 0) parts.push(`${years}${this.t('yearShort')}`);
        if (months > 0) parts.push(`${months}${this.t('monthShort')}`);
        if (!parts.length) parts.push(`${Math.max(days, 0)}${this.t('dayShort')}`);
        return parts.join(' ');
    }

    ensureSalaryPeriod() {
        // CERCA PRIMA UNO STIPENDIO
        const lastSalary = this.findLastSalaryIncome();
        
        if (lastSalary && lastSalary.date) {
            const start = this.normalizeIsoDate(lastSalary.date);
            const nextSalary = this.addMonthsClamp(start, 1);
            const periodEnd = this.shiftIsoDate(nextSalary, -1);
            
            this.data.periodStart = start;
            this.data.periodEnd = periodEnd;
            console.log(' Periodo basato su stipendio:', start, '→', periodEnd);
            return;
        }
        
        // SE NON TROVA STIPENDIO, USA LA PRIMA ENTRATA
        if (this.data.incomes && this.data.incomes.length > 0) {
            // Ordina per data
            const sorted = [...this.data.incomes].sort((a, b) => 
                new Date(a.date) - new Date(b.date)
            );
            
            const start = this.normalizeIsoDate(sorted[0].date);
            const nextSalary = this.addMonthsClamp(start, 1);
            const periodEnd = this.shiftIsoDate(nextSalary, -1);
            
            this.data.periodStart = start;
            this.data.periodEnd = periodEnd;
            console.log(' Periodo basato su prima entrata:', start, '→', periodEnd);
            return;
        }
        
        // DEFAULT
        const today = new Date();
        const end = new Date(today);
        end.setDate(today.getDate() + 28);
        
        this.data.periodStart = this.formatLocalDate(today);
        this.data.periodEnd = this.formatLocalDate(end);
    }

    isDateInPeriod(isoDate) {
        const d = new Date(this.normalizeIsoDate(isoDate));
        const start = new Date(this.normalizeIsoDate(this.data.periodStart));
        const end = new Date(this.normalizeIsoDate(this.data.periodEnd));
        if ([d, start, end].some(x => isNaN(x.getTime()))) return false;
        return d >= start && d <= end;
    }

    getDisplayPeriodEnd() {
        return this.normalizeIsoDate(this.data.periodEnd || '');
    }


    // ==================== FIRST RUN / DEMO DATA ====================
    isFirstRun() {
        return this.readStorage('kedrix-first-run-seen') !== 'true';
    }

    markFirstRunSeen() {
        this.writeStorage('kedrix-first-run-seen', 'true');
    }

    getDemoCustomCategories() {
        const lang = resolveRuntimeLang(this);
        const map = {
            it: { home: 'Casa', kids: 'Bambini', work: 'Lavoro' },
            en: { home: 'Home', kids: 'Kids', work: 'Work' },
            es: { home: 'Casa', kids: 'Niños', work: 'Trabajo' },
            fr: { home: 'Maison', kids: 'Enfants', work: 'Travail' }
        };
        return map[lang] || map.it;
    }

    ensureDemoCategories() {
        const dc = this.getDemoCustomCategories();
        const demoCats = [dc.home, dc.kids, dc.work];
        let changed = false;

        demoCats.forEach(cat => {
            if (!this.getAllCategories().includes(cat)) {
                this.customCategories.push(cat);
                changed = true;
            }
        });

        if (changed) {
            this.saveCustomCategories();
            this.updateAllCategorySelects();
        }
    }

        getDemoData() {
        const today = new Date();
        const lang = resolveRuntimeLang(this);
        const demoText = {
            it: {
                income: 'Stipendio',
                rent: 'Affitto',
                phone: 'Telefono',
                grocery: 'Spesa supermercato',
                homeMaint: 'Manutenzione casa',
                fuel: 'Benzina',
                pharmacy: 'Farmacia',
                pizza: 'Pizza',
                daycare: 'Asilo',
                tshirt: 'Maglietta',
                coffee: 'Caffè',
                workLunch: 'Pranzo lavoro'
            },
            en: {
                income: 'Salary',
                rent: 'Rent',
                phone: 'Phone',
                grocery: 'Groceries',
                homeMaint: 'Home maintenance',
                fuel: 'Fuel',
                pharmacy: 'Pharmacy',
                pizza: 'Pizza',
                daycare: 'Daycare',
                tshirt: 'T-shirt',
                coffee: 'Coffee',
                workLunch: 'Work lunch'
            },
            es: {
                income: 'Salario',
                rent: 'Alquiler',
                phone: 'Teléfono',
                grocery: 'Supermercado',
                homeMaint: 'Mantenimiento del hogar',
                fuel: 'Gasolina',
                pharmacy: 'Farmacia',
                pizza: 'Pizza',
                daycare: 'Guardería',
                tshirt: 'Camiseta',
                coffee: 'Café',
                workLunch: 'Almuerzo de trabajo'
            },
            fr: {
                income: 'Salaire',
                rent: 'Loyer',
                phone: 'Téléphone',
                grocery: 'Courses',
                homeMaint: 'Entretien maison',
                fuel: 'Carburant',
                pharmacy: 'Pharmacie',
                pizza: 'Pizza',
                daycare: 'Crèche',
                tshirt: 'T-shirt',
                coffee: 'Café',
                workLunch: 'Déjeuner de travail'
            }
        };
        
        // Mappa delle categorie per lingua
        const categoryMap = {
            it: {
                groceries: 'Alimentari',
                transport: 'Trasporti',
                leisure: 'Svago',
                health: 'Salute',
                clothing: 'Abbigliamento',
                other: 'Altro'
            },
            en: {
                groceries: 'Groceries',
                transport: 'Transport',
                leisure: 'Leisure',
                health: 'Health',
                clothing: 'Clothing',
                other: 'Other'
            },
            es: {
                groceries: 'Alimentación',
                transport: 'Transporte',
                leisure: 'Ocio',
                health: 'Salud',
                clothing: 'Ropa',
                other: 'Otros'
            },
            fr: {
                groceries: 'Alimentation',
                transport: 'Transport',
                leisure: 'Loisirs',
                health: 'Santé',
                clothing: 'Vêtements',
                other: 'Autre'
            }
        };
        
        const T = demoText[lang] || demoText.it;
        const dc = this.getDemoCustomCategories();
        const cats = categoryMap[lang] || categoryMap.it;
        const iso = (d) => d.toISOString().split('T')[0];

        const start = new Date(today);
        const end = new Date(today);
        end.setDate(end.getDate() + 30);

        const makeDate = (offset) => {
            const d = new Date(today);
            d.setDate(d.getDate() - offset);
            return iso(d);
        };

        const now = Date.now();

        const demoVariable = {};
        demoVariable[makeDate(0)] = [
            { name: T.grocery, amount: 23.40, category: cats.groceries, id: now + 1 },
            { name: T.homeMaint, amount: 30.00, category: dc.home, id: now + 7 }
        ];
        demoVariable[makeDate(1)] = [
            { name: T.fuel, amount: 35.00, category: cats.transport, id: now + 2 }
        ];
        demoVariable[makeDate(2)] = [
            { name: T.pharmacy, amount: 12.90, category: cats.health, id: now + 3 }
        ];
        demoVariable[makeDate(3)] = [
            { name: T.pizza, amount: 18.00, category: cats.leisure, id: now + 4 },
            { name: T.daycare, amount: 120.00, category: dc.kids, id: now + 8 }
        ];
        demoVariable[makeDate(4)] = [
            { name: T.tshirt, amount: 19.99, category: cats.clothing, id: now + 5 }
        ];
        demoVariable[makeDate(5)] = [
            { name: T.coffee, amount: 2.20, category: cats.other, id: now + 6 },
            { name: T.workLunch, amount: 14.00, category: dc.work, id: now + 9 }
        ];

        const farFuture = new Date(today);
        farFuture.setFullYear(farFuture.getFullYear() + 5);

        return {
            incomes: [
                { desc: T.income, amount: 2000, date: iso(today), id: now + 100 }
            ],
            fixedExpenses: [
                { name: T.rent, amount: 650, day: 5, endDate: iso(farFuture), id: now + 200 },
                { name: T.phone, amount: 15, day: 12, endDate: iso(farFuture), id: now + 201 }
            ],
            variableExpenses: demoVariable,
            savingsPercent: 10,
            savingsGoal: 1500,
            threshold: 50,
            language: this.data.language || 'it',
            periodStart: iso(start),
            periodEnd: iso(end)
        };
    }

    loadDemoData() {
        this.ensureDemoCategories();
        this.data = this.getDemoData();
        this.saveData();
        this.updateAllCategorySelects();
        this.updateUI();
        this.updateChart();
        this.applyLanguage();

        this.writeStorage('kedrix-demo-loaded', 'true');
        this.showToast(this.t('demoLoaded'), 'success');
    }


    resolveLanguage(stage = 'runtime') {
        if (window.KedrixI18n && typeof window.KedrixI18n.resolveLanguage === 'function') {
            return window.KedrixI18n.resolveLanguage(stage, this);
        }
        const htmlLang = String(document.documentElement?.lang || '').trim().toLowerCase();
        return htmlLang || 'it';
    }

    getBootstrapLanguage() {
        return this.resolveLanguage('bootstrap');
    }

    getRuntimeLanguage() {
        return this.resolveLanguage('runtime');
    }

    t(key, vars) {
        const lang = this.getRuntimeLanguage();
        const dict = this.translations[lang] || this.translations.it || {};
        let str = dict[key] ?? (this.translations.en ? (this.translations.en[key] ?? key) : key);
        if (vars && typeof vars === "object") {
            for (const [k, v] of Object.entries(vars)) {
                str = String(str).replaceAll(`{${k}}`, String(v));
            }
        }
        return str;
    }


    getUiTextSet() {
        const lang = this.getRuntimeLanguage();
        const sets = {
            it: {
                wisePillarStability: 'Stability',
                wisePillarDiscipline: 'Discipline',
                wisePillarResilience: 'Resilience',
                wiseStatusNoData: 'In attesa dati',
                wiseStatusConsolidate: 'Da consolidare',
                wiseStatusVerySolid: 'Molto solido',
                wiseStatusGoodBalance: 'Buon equilibrio',
                wiseStatusUnderControl: 'Sotto controllo',
                wiseStatusAttention: 'Attenzione',
                wiseNoDataMeta: "Aggiungi almeno un’entrata nel periodo per attivare il calcolo WiseScore™.",
                wiseMetaIncome: 'Entrate periodo',
                wiseMetaFixed: 'Fisse nel periodo',
                wiseMetaVariable: 'Variabili registrate',
                wiseMetaRemaining: 'Rimanenza attuale',
                savingsWidgetTitleFixed: 'Raggiungerai il tuo obiettivo',
                reportToolsTitle: 'Report WiseScore™',
                reportToolsNote: 'Apri il report riepilogativo del periodo con score, pillar, entrate, spese e stato budget.',
                reportOpen: 'Apri report',
                reportRefresh: 'Aggiorna report',
                reportCurrentPeriodSummary: 'Riepilogo periodo corrente',
                close: 'Chiudi',
                exportPdf: 'Esporta PDF',
                reportGeneratedAtPrefix: 'Generato il',
                reportGeneralStatus: 'Stato generale: {status} con WiseScore™ {score}/100.',
                reportRemainingPositive: 'Rimanenza stimata positiva di {amount} nel periodo.',
                reportRemainingNegative: 'Rimanenza negativa di {amount}: serve contenere le uscite.',
                reportUnpaidFixedPresent: "Restano {amount} di spese fisse ancora da assorbire.",
                reportUnpaidFixedNone: 'Nessuna spesa fissa residua da assorbire nel periodo.',
                reportProjectionImprove: 'La proiezione finale migliora il risparmio di {amount}.',
                reportProjectionReduce: 'La proiezione finale riduce il risparmio di {amount}.',
                reportNoFixedPeriod: 'Nessuna spesa fissa nel periodo.',
                reportNoVariablePeriod: 'Nessuna spesa variabile registrata nel periodo.',
                reportNoCategories: 'Ancora nessuna categoria valorizzata.',
                reportDominantCategoryTitle: 'Categoria dominante',
                reportDominantCategoryText: '{name} è la voce variabile più pesante del periodo.',
                reportNoDominantCategory: 'Nessuna categoria dominante disponibile nel periodo.',
                reportResidualMarginTitle: 'Margine residuo',
                reportResidualPositiveText: 'Il periodo resta in equilibrio sulla base dei dati attuali.',
                reportResidualNegativeText: 'Il periodo è in tensione e richiede un contenimento delle uscite.',
                reportResidualNeutralText: 'Il periodo è in pareggio: serve attenzione alle prossime uscite.',
                reportDailyBufferTitle: 'Buffer giornaliero',
                reportDailyBufferPositiveText: 'Budget medio ancora disponibile per i giorni restanti del periodo.',
                reportDailyBufferNegativeText: 'Nessun margine giornaliero disponibile finché non arrivano nuovi dati o nuove entrate.',
                savingsPlanTitle: 'Piano risparmi',
                savedSoFar: 'Accantonato finora',
                basedOnCurrentTrend: 'Basata su andamento corrente',
                unpaidFixedExpenses: 'Fisse non ancora pagate',
                residualImpactPeriod: 'Impatto residuo nel periodo',
                focusOfPeriod: 'Focus del periodo',
                focusPeriodSubtitle: 'Tre indicatori rapidi per leggere pressione e margine operativo.',
                reportProfessionalTopline: 'Kedrix · Decision Intelligence Report',
                reportPeriodWiseScoreTitle: 'WiseScore™ del periodo',
                reportOverallScore: 'Score complessivo',
                reportOperatingExpenses: 'Uscite operative',
                reportResidualCoverage: 'Copertura residua',
                reportIncomePeriod: 'Entrate periodo',
                reportFixedPlanned: 'Fisse pianificate',
                reportFixedToAbsorb: 'Fisse da assorbire',
                reportVariableExpenses: 'Spese variabili',
                reportRemaining: 'Rimanenza',
                reportDailyBudget: 'Budget giornaliero',
                reportPeriodProjection: 'Proiezione fine periodo',
                reportQuickReadingTitle: 'Lettura rapida',
                reportQuickReadingSubtitle: 'Lettura rapida dello stato finanziario del periodo.',
                reportTopCategoriesTitle: 'Categorie principali',
                reportTopCategoriesSubtitle: 'Le categorie che pesano di più sulle uscite variabili.',
                reportPillarsTitle: 'Pillar WiseScore™',
                reportPillarsSubtitle: "I tre pilastri che guidano l'equilibrio del periodo.",
                reportRecurringTitle: 'Spese fisse del periodo',
                reportRecurringSubtitle: 'Impegni ricorrenti già pagati o ancora previsti.',
                reportVariableMovementsTitle: 'Spese variabili recenti',
                reportVariableMovementsSubtitle: 'Movimenti variabili più recenti registrati.',
                reportFocusTitle: 'Punti chiave',
                reportFocusSubtitle: "Focus su cuscinetto, proiezione e impatto residuo.",
                reportInsightsTitle: 'WiseMind™ Insights',
                reportInsightsSubtitle: 'Lettura automatica del periodo con alert e azioni suggerite.',
                reportInsightHighlights: 'Punti chiave',
                reportInsightAlerts: 'Alert intelligenti',
                reportInsightActions: 'Azioni consigliate',
                reportInsightsEmpty: 'Nessun insight disponibile per questo periodo.',
                reportPaid: 'pagata',
                reportPlanned: 'prevista',
                unknownDate: 'Data non disponibile',
                insightWaitingDataTitle: 'In attesa dati',
                insightWaitingDataText: "Aggiungi almeno un’entrata o importa movimenti del periodo per attivare analisi e suggerimenti più precisi.",
                insightPositiveMarginTitle: 'Margine positivo',
                insightPositiveMarginText: 'La rimanenza stimata resta positiva a {amount} nel periodo.',
                insightNegativeMarginTitle: 'Margine sotto pressione',
                insightNegativeMarginText: 'La rimanenza è negativa di {amount}: serve frenare le uscite subito.',
                insightBalancedMarginTitle: 'Margine in equilibrio',
                insightBalancedMarginText: "La rimanenza del periodo è in pareggio: conviene monitorare le prossime uscite per non scendere in negativo.",
                insightGoodResilienceTitle: 'Buona resilienza',
                insightGoodResilienceText: 'Il pilastro {pillar} è a {value}/100 e sostiene bene il periodo.',
                insightFavorableProjectionTitle: 'Proiezione favorevole',
                insightFavorableProjectionText: 'La proiezione finale sale a {amount}, sopra il risparmio già accantonato.',
                insightHighFixedWeightTitle: 'Peso fisse elevato',
                insightHighFixedWeightText: 'Le spese fisse assorbono circa {percent}% delle entrate del periodo.',
                insightDisciplineTitle: 'Disciplina migliorabile',
                insightDisciplineText: 'Il pilastro {pillar} è a {value}/100: conviene monitorare meglio il ritmo delle uscite variabili.',
                insightVariableThresholdTitle: 'Variabili sopra soglia',
                insightVariableThresholdText: 'Le spese variabili pesano circa {percent}% delle entrate del periodo.',
                insightFixedToAbsorbTitle: 'Fisse da assorbire',
                insightFixedToAbsorbText: 'Restano {amount} di spese fisse ancora da coprire nel periodo.',
                insightReduceTopCategoryTitle: 'Riduci la categoria dominante',
                insightReduceTopCategoryText: 'Tagliando di circa {amount} la categoria {category}, il WiseScore potrebbe migliorare di ~{boost} punti.',
                insightSaveMarginTitle: 'Trasforma margine in risparmio',
                insightSaveMarginText: "Accantonando almeno {amount} della rimanenza attuale, rafforzi il buffer senza irrigidire il mese.",
                insightDailyCeilingTitle: 'Tetto spesa giornaliero',
                insightDailyCeilingText: 'Per i prossimi {days} giorni, resta vicino a {amount} al giorno per mantenere la traiettoria attuale.'
            },
            en: {
                wisePillarStability: 'Stability', wisePillarDiscipline: 'Discipline', wisePillarResilience: 'Resilience',
                wiseStatusNoData: 'Waiting for data', wiseStatusConsolidate: 'To consolidate', wiseStatusVerySolid: 'Very solid', wiseStatusGoodBalance: 'Good balance', wiseStatusUnderControl: 'Under control', wiseStatusAttention: 'Attention',
                wiseNoDataMeta: 'Add at least one income in the period to activate the WiseScore™ calculation.', savingsWidgetTitleFixed: 'You will reach your goal', wiseMetaIncome: 'Period income', wiseMetaFixed: 'Fixed in period', wiseMetaVariable: 'Recorded variable expenses', wiseMetaRemaining: 'Current remaining',
                reportToolsTitle: 'WiseScore™ Report', reportToolsNote: 'Open the period summary report with score, pillars, income, expenses and budget status.', reportOpen: 'Open report', reportRefresh: 'Refresh report', reportCurrentPeriodSummary: 'Current period summary', close: 'Close', exportPdf: 'Export PDF', reportGeneratedAtPrefix: 'Generated on',
                reportGeneralStatus: 'Overall status: {status} with WiseScore™ {score}/100.', reportRemainingPositive: 'Estimated remaining is positive at {amount} for the period.', reportRemainingNegative: 'Negative remaining of {amount}: spending needs to be reduced.', reportUnpaidFixedPresent: '{amount} of fixed expenses still remain to be absorbed.', reportUnpaidFixedNone: 'All fixed expenses for the period are already covered.', reportProjectionImprove: 'The final projection improves savings by {amount}.', reportProjectionReduce: 'The final projection reduces savings by {amount}.', reportNoFixedPeriod: 'No fixed expenses in the period.', reportNoVariablePeriod: 'No variable expenses recorded in the period.', reportNoCategories: 'No categories valued yet.', reportDominantCategoryTitle: 'Top category', reportDominantCategoryText: '{name} is the heaviest variable category in the period.', reportNoDominantCategory: 'No dominant category available in the period.', reportResidualMarginTitle: 'Remaining margin', reportResidualPositiveText: 'The period stays balanced based on current data.', reportResidualNegativeText: 'The period is under pressure and requires lower spending.', reportResidualNeutralText: 'The period is breaking even: upcoming spending needs attention.', reportDailyBufferTitle: 'Daily buffer', reportDailyBufferPositiveText: 'Average budget still available for the remaining days of the period.', reportDailyBufferNegativeText: 'No daily margin available until new data or income arrives.', savingsPlanTitle: 'Savings plan', savedSoFar: 'Saved so far', basedOnCurrentTrend: 'Based on current trend', unpaidFixedExpenses: 'Unpaid fixed expenses', residualImpactPeriod: 'Residual impact in the period', focusOfPeriod: 'Focus of the period', focusPeriodSubtitle: 'Three quick indicators to read pressure and operating margin.', reportProfessionalTopline: 'Kedrix · Decision Intelligence Report', reportPeriodWiseScoreTitle: 'WiseScore™ for the period', reportOverallScore: 'Overall score', reportOperatingExpenses: 'Operating expenses', reportResidualCoverage: 'Residual coverage', reportIncomePeriod: 'Period income', reportFixedPlanned: 'Planned fixed', reportFixedToAbsorb: 'Fixed to absorb', reportVariableExpenses: 'Variable expenses', reportRemaining: 'Remaining', reportDailyBudget: 'Daily budget', reportPeriodProjection: 'End-of-period projection', reportQuickReadingTitle: 'Quick reading', reportQuickReadingSubtitle: 'Quick reading of the financial status for the period.', reportTopCategoriesTitle: 'Top categories', reportTopCategoriesSubtitle: 'The categories weighing most on variable expenses.', reportPillarsTitle: 'WiseScore™ pillars', reportPillarsSubtitle: 'The three pillars driving period balance.', reportRecurringTitle: 'Fixed expenses for the period', reportRecurringSubtitle: 'Recurring commitments already paid or still planned.', reportVariableMovementsTitle: 'Recent variable expenses', reportVariableMovementsSubtitle: 'Most recent variable movements recorded.', reportFocusTitle: 'Key points', reportFocusSubtitle: 'Focus on buffer, projection and residual impact.', reportInsightsTitle: 'WiseMind™ Insights', reportInsightsSubtitle: 'Automated reading of the period with alerts and suggested actions.', reportInsightHighlights: 'Highlights', reportInsightAlerts: 'Smart alerts', reportInsightActions: 'Suggested actions', reportInsightsEmpty: 'No insights available for this period.', reportPaid: 'paid', reportPlanned: 'planned', unknownDate: 'Date unavailable',
                insightWaitingDataTitle: 'Waiting for data', insightWaitingDataText: 'Add at least one income or import period movements to unlock more precise analysis and suggestions.', insightPositiveMarginTitle: 'Positive margin', insightPositiveMarginText: 'Estimated remaining stays positive at {amount} in the period.', insightNegativeMarginTitle: 'Margin under pressure', insightNegativeMarginText: 'Remaining is negative by {amount}: spending should be reduced immediately.', insightBalancedMarginTitle: 'Balanced margin', insightBalancedMarginText: 'The period is break-even: monitor upcoming spending to avoid going negative.', insightGoodResilienceTitle: 'Good resilience', insightGoodResilienceText: 'The {pillar} pillar is at {value}/100 and supports the period well.', insightFavorableProjectionTitle: 'Favorable projection', insightFavorableProjectionText: 'The final projection rises to {amount}, above the savings already set aside.', insightHighFixedWeightTitle: 'High fixed-cost weight', insightHighFixedWeightText: 'Fixed expenses absorb about {percent}% of period income.', insightDisciplineTitle: 'Discipline can improve', insightDisciplineText: 'The {pillar} pillar is at {value}/100: variable spending pace should be monitored more closely.', insightVariableThresholdTitle: 'Variables above threshold', insightVariableThresholdText: 'Variable expenses weigh about {percent}% of period income.', insightFixedToAbsorbTitle: 'Fixed to absorb', insightFixedToAbsorbText: '{amount} of fixed expenses still remain to be covered in the period.', insightReduceTopCategoryTitle: 'Reduce the top category', insightReduceTopCategoryText: 'Cutting about {amount} from category {category} could improve WiseScore by ~{boost} points.', insightSaveMarginTitle: 'Turn margin into savings', insightSaveMarginText: 'Setting aside at least {amount} from the current remaining strengthens the buffer without making the month too rigid.', insightDailyCeilingTitle: 'Daily spending ceiling', insightDailyCeilingText: 'For the next {days} days, stay close to {amount} per day to keep the current trajectory.'
            },
            es: {
                wisePillarStability: 'Estabilidad', wisePillarDiscipline: 'Disciplina', savingsWidgetTitleFixed: 'Alcanzarás tu objetivo', wisePillarResilience: 'Resiliencia', wiseStatusNoData: 'Esperando datos', wiseStatusConsolidate: 'Por consolidar', wiseStatusVerySolid: 'Muy sólido', wiseStatusGoodBalance: 'Buen equilibrio', wiseStatusUnderControl: 'Bajo control', wiseStatusAttention: 'Atención', wiseNoDataMeta: 'Añade al menos un ingreso en el período para activar el cálculo de WiseScore™.', wiseMetaIncome: 'Ingresos del período', wiseMetaFixed: 'Fijos del período', wiseMetaVariable: 'Variables registradas', wiseMetaRemaining: 'Remanente actual', reportToolsTitle: 'Informe WiseScore™', reportToolsNote: 'Abre el informe resumen del período con puntuación, pilares, ingresos, gastos y estado del presupuesto.', reportOpen: 'Abrir informe', reportRefresh: 'Actualizar informe', reportCurrentPeriodSummary: 'Resumen del período actual', close: 'Cerrar', exportPdf: 'Exportar PDF', reportGeneratedAtPrefix: 'Generado el', reportGeneralStatus: 'Estado general: {status} con WiseScore™ {score}/100.', reportRemainingPositive: 'El remanente estimado es positivo en {amount} en el período.', reportRemainingNegative: 'Remanente negativo de {amount}: hay que contener los gastos.', reportUnpaidFixedPresent: 'Quedan {amount} de gastos fijos aún por absorber.', reportUnpaidFixedNone: 'Todos los gastos fijos del período ya están absorbidos.', reportProjectionImprove: 'La proyección final mejora el ahorro en {amount}.', reportProjectionReduce: 'La proyección final reduce el ahorro en {amount}.', reportNoFixedPeriod: 'No hay gastos fijos en el período.', reportNoVariablePeriod: 'No hay gastos variables registrados en el período.', reportNoCategories: 'Aún no hay categorías valorizadas.', reportDominantCategoryTitle: 'Categoría dominante', reportDominantCategoryText: '{name} es la partida variable más pesada del período.', reportNoDominantCategory: 'No hay categoría dominante disponible en el período.', reportResidualMarginTitle: 'Margen restante', reportResidualPositiveText: 'El período se mantiene equilibrado según los datos actuales.', reportResidualNegativeText: 'El período está bajo presión y requiere contener los gastos.', reportResidualNeutralText: 'El período está en equilibrio: hay que vigilar los próximos gastos.', reportDailyBufferTitle: 'Colchón diario', reportDailyBufferPositiveText: 'Presupuesto medio aún disponible para los días restantes del período.', reportDailyBufferNegativeText: 'No hay margen diario disponible hasta que lleguen nuevos datos o ingresos.', savingsPlanTitle: 'Plan de ahorro', savedSoFar: 'Ahorrado hasta ahora', basedOnCurrentTrend: 'Basada en la tendencia actual', unpaidFixedExpenses: 'Gastos fijos aún no pagados', residualImpactPeriod: 'Impacto residual en el período', focusOfPeriod: 'Enfoque del período', focusPeriodSubtitle: 'Tres indicadores rápidos para leer la presión y el margen operativo.', reportProfessionalTopline: 'Kedrix · Decision Intelligence Report', reportPeriodWiseScoreTitle: 'WiseScore™ del período', reportOverallScore: 'Puntuación general', reportOperatingExpenses: 'Gastos operativos', reportResidualCoverage: 'Cobertura residual', reportIncomePeriod: 'Ingresos del período', reportFixedPlanned: 'Fijos planificados', reportFixedToAbsorb: 'Fijos por absorber', reportVariableExpenses: 'Gastos variables', reportRemaining: 'Remanente', reportDailyBudget: 'Presupuesto diario', reportPeriodProjection: 'Proyección fin de período', reportQuickReadingTitle: 'Lectura rápida', reportQuickReadingSubtitle: 'Lectura rápida del estado financiero del período.', reportTopCategoriesTitle: 'Categorías principales', reportTopCategoriesSubtitle: 'Las categorías que más pesan en los gastos variables.', reportPillarsTitle: 'Pilares WiseScore™', reportPillarsSubtitle: 'Los tres pilares que guían el equilibrio del período.', reportRecurringTitle: 'Gastos fijos del período', reportRecurringSubtitle: 'Compromisos recurrentes ya pagados o aún previstos.', reportVariableMovementsTitle: 'Gastos variables recientes', reportVariableMovementsSubtitle: 'Movimientos variables más recientes registrados.', reportFocusTitle: 'Puntos clave', reportFocusSubtitle: 'Enfoque sobre colchón, proyección e impacto residual.', reportInsightsTitle: 'WiseMind™ Insights', reportInsightsSubtitle: 'Automated reading of the period with alerts and suggested actions.', reportInsightHighlights: 'Highlights', reportInsightAlerts: 'Smart alerts', reportInsightActions: 'Suggested actions', reportInsightsEmpty: 'No hay insights disponibles para este período.', reportPaid: 'pagado', reportPlanned: 'previsto', unknownDate: 'Fecha no disponible', insightWaitingDataTitle: 'Esperando datos', insightWaitingDataText: 'Añade al menos un ingreso o importa movimientos del período para activar análisis y sugerencias más precisas.', insightPositiveMarginTitle: 'Margen positivo', insightPositiveMarginText: 'El remanente estimado se mantiene positivo en {amount} durante el período.', insightNegativeMarginTitle: 'Margen bajo presión', insightNegativeMarginText: 'El remanente es negativo en {amount}: conviene frenar los gastos cuanto antes.', insightBalancedMarginTitle: 'Margen equilibrado', insightBalancedMarginText: 'El período está en equilibrio: conviene vigilar los próximos gastos para no entrar en negativo.', insightGoodResilienceTitle: 'Buena resiliencia', insightGoodResilienceText: 'El pilar {pillar} está en {value}/100 y sostiene bien el período.', insightFavorableProjectionTitle: 'Proyección favorable', insightFavorableProjectionText: 'La proyección final sube a {amount}, por encima del ahorro ya acumulado.', insightHighFixedWeightTitle: 'Peso fijo elevado', insightHighFixedWeightText: 'Los gastos fijos absorben aproximadamente el {percent}% de los ingresos del período.', insightDisciplineTitle: 'Disciplina mejorable', insightDisciplineText: 'El pilar {pillar} está en {value}/100: conviene controlar mejor el ritmo de los gastos variables.', insightVariableThresholdTitle: 'Variables por encima del umbral', insightVariableThresholdText: 'Los gastos variables pesan aproximadamente el {percent}% de los ingresos del período.', insightFixedToAbsorbTitle: 'Fijos por absorber', insightFixedToAbsorbText: 'Quedan {amount} de gastos fijos aún por cubrir en el período.', insightReduceTopCategoryTitle: 'Reduce la categoría dominante', insightReduceTopCategoryText: 'Recortando aproximadamente {amount} de la categoría {category}, el WiseScore podría mejorar ~{boost} puntos.', insightSaveMarginTitle: 'Convierte margen en ahorro', insightSaveMarginText: 'Apartando al menos {amount} del remanente actual, refuerzas el colchón sin endurecer demasiado el mes.', insightDailyCeilingTitle: 'Tope diario de gasto', insightDailyCeilingText: 'Durante los próximos {days} días, mantente cerca de {amount} al día para conservar la trayectoria actual.'
            },
            fr: {
                wisePillarStability: 'Stabilité', wisePillarDiscipline: 'Discipline', savingsWidgetTitleFixed: 'Vous atteindrez votre objectif', wisePillarResilience: 'Résilience', wiseStatusNoData: 'En attente de données', wiseStatusConsolidate: 'À consolider', wiseStatusVerySolid: 'Très solide', wiseStatusGoodBalance: 'Bon équilibre', wiseStatusUnderControl: 'Sous contrôle', wiseStatusAttention: 'Attention', wiseNoDataMeta: 'Ajoutez au moins un revenu sur la période pour activer le calcul WiseScore™.', wiseMetaIncome: 'Revenus de la période', wiseMetaFixed: 'Fixes de la période', wiseMetaVariable: 'Variables enregistrées', wiseMetaRemaining: 'Reste actuel', reportToolsTitle: 'Rapport WiseScore™', reportToolsNote: 'Ouvrez le rapport récapitulatif de la période avec score, piliers, revenus, dépenses et état du budget.', reportOpen: 'Ouvrir le rapport', reportRefresh: 'Actualiser le rapport', reportCurrentPeriodSummary: 'Résumé de la période en cours', close: 'Fermer', exportPdf: 'Exporter PDF', reportGeneratedAtPrefix: 'Généré le', reportGeneralStatus: 'État général : {status} avec WiseScore™ {score}/100.', reportRemainingPositive: 'Le reste estimé est positif à {amount} sur la période.', reportRemainingNegative: 'Reste négatif de {amount} : il faut contenir les dépenses.', reportUnpaidFixedPresent: 'Il reste {amount} de charges fixes à absorber.', reportUnpaidFixedNone: 'Toutes les charges fixes de la période sont déjà absorbées.', reportProjectionImprove: 'La projection finale améliore l’épargne de {amount}.', reportProjectionReduce: 'La projection finale réduit l’épargne de {amount}.', reportNoFixedPeriod: 'Aucune dépense fixe sur la période.', reportNoVariablePeriod: 'Aucune dépense variable enregistrée sur la période.', reportNoCategories: 'Aucune catégorie valorisée pour le moment.', reportDominantCategoryTitle: 'Catégorie dominante', reportDominantCategoryText: '{name} est le poste variable le plus lourd de la période.', reportNoDominantCategory: 'Aucune catégorie dominante disponible sur la période.', reportResidualMarginTitle: 'Marge résiduelle', reportResidualPositiveText: 'La période reste équilibrée sur la base des données actuelles.', reportResidualNegativeText: 'La période est sous tension et nécessite de réduire les dépenses.', reportResidualNeutralText: 'La période est à l’équilibre : attention aux prochaines dépenses.', reportDailyBufferTitle: 'Buffer quotidien', reportDailyBufferPositiveText: 'Budget moyen encore disponible pour les jours restants de la période.', reportDailyBufferNegativeText: 'Aucune marge quotidienne disponible tant que de nouvelles données ou revenus n’arrivent pas.', savingsPlanTitle: 'Plan d’épargne', savedSoFar: 'Épargné jusqu’à présent', basedOnCurrentTrend: 'Basée sur la tendance actuelle', unpaidFixedExpenses: 'Dépenses fixes non encore payées', residualImpactPeriod: 'Impact résiduel sur la période', focusOfPeriod: 'Focus de la période', focusPeriodSubtitle: 'Trois indicateurs rapides pour lire la pression et la marge opérationnelle.', reportProfessionalTopline: 'Kedrix · Decision Intelligence Report', reportPeriodWiseScoreTitle: 'WiseScore™ de la période', reportOverallScore: 'Score global', reportOperatingExpenses: 'Dépenses opérationnelles', reportResidualCoverage: 'Couverture résiduelle', reportIncomePeriod: 'Revenus de la période', reportFixedPlanned: 'Fixes planifiées', reportFixedToAbsorb: 'Fixes à absorber', reportVariableExpenses: 'Dépenses variables', reportRemaining: 'Reste', reportDailyBudget: 'Budget quotidien', reportPeriodProjection: 'Projection fin de période', reportQuickReadingTitle: 'Lecture rapide', reportQuickReadingSubtitle: 'Lecture rapide de l’état financier de la période.', reportTopCategoriesTitle: 'Catégories principales', reportTopCategoriesSubtitle: 'Les catégories qui pèsent le plus sur les dépenses variables.', reportPillarsTitle: 'Piliers WiseScore™', reportPillarsSubtitle: 'Les trois piliers qui guident l’équilibre de la période.', reportRecurringTitle: 'Dépenses fixes de la période', reportRecurringSubtitle: 'Engagements récurrents déjà payés ou encore prévus.', reportVariableMovementsTitle: 'Dépenses variables récentes', reportVariableMovementsSubtitle: 'Mouvements variables les plus récents enregistrés.', reportFocusTitle: 'Points clés', reportFocusSubtitle: 'Focus sur le coussin, la projection et l’impact résiduel.', reportInsightsTitle: 'WiseMind™ Insights', reportInsightsSubtitle: 'Automated reading of the period with alerts and suggested actions.', reportInsightHighlights: 'Highlights', reportInsightAlerts: 'Smart alerts', reportInsightActions: 'Suggested actions', reportInsightsEmpty: 'Aucun insight disponible pour cette période.', reportPaid: 'payée', reportPlanned: 'prévue', unknownDate: 'Date indisponible', insightWaitingDataTitle: 'En attente de données', insightWaitingDataText: 'Ajoutez au moins un revenu ou importez des mouvements de la période pour activer des analyses et suggestions plus précises.', insightPositiveMarginTitle: 'Marge positive', insightPositiveMarginText: 'Le reste estimé reste positif à {amount} sur la période.', insightNegativeMarginTitle: 'Marge sous pression', insightNegativeMarginText: 'Le reste est négatif de {amount} : il faut freiner les dépenses immédiatement.', insightBalancedMarginTitle: 'Marge équilibrée', insightBalancedMarginText: 'La période est à l’équilibre : mieux vaut surveiller les prochaines dépenses pour ne pas passer en négatif.', insightGoodResilienceTitle: 'Bonne résilience', insightGoodResilienceText: 'Le pilier {pillar} est à {value}/100 et soutient bien la période.', insightFavorableProjectionTitle: 'Projection favorable', insightFavorableProjectionText: 'La projection finale monte à {amount}, au-dessus de l’épargne déjà mise de côté.', insightHighFixedWeightTitle: 'Poids des fixes élevé', insightHighFixedWeightText: 'Les dépenses fixes absorbent environ {percent}% des revenus de la période.', insightDisciplineTitle: 'Discipline à améliorer', insightDisciplineText: 'Le pilier {pillar} est à {value}/100 : il faut mieux surveiller le rythme des dépenses variables.', insightVariableThresholdTitle: 'Variables au-dessus du seuil', insightVariableThresholdText: 'Les dépenses variables pèsent environ {percent}% des revenus de la période.', insightFixedToAbsorbTitle: 'Fixes à absorber', insightFixedToAbsorbText: 'Il reste {amount} de dépenses fixes à couvrir sur la période.', insightReduceTopCategoryTitle: 'Réduire la catégorie dominante', insightReduceTopCategoryText: 'En réduisant d’environ {amount} la catégorie {category}, le WiseScore pourrait gagner ~{boost} points.', insightSaveMarginTitle: 'Transformer la marge en épargne', insightSaveMarginText: 'En mettant de côté au moins {amount} du reste actuel, vous renforcez le coussin sans rigidifier le mois.', insightDailyCeilingTitle: 'Plafond quotidien de dépense', insightDailyCeilingText: 'Pour les {days} prochains jours, restez proche de {amount} par jour pour conserver la trajectoire actuelle.'
            }
        };
        return sets[lang] || sets.it;
    }

    uiText(key, vars) {
        const dict = this.getUiTextSet();
        let str = dict[key] ?? key;
        if (vars && typeof vars === 'object') {
            for (const [k, v] of Object.entries(vars)) {
                str = String(str).replaceAll(`{${k}}`, String(v));
            }
        }
        return str;
    }


 applyLanguage() {
        console.log('🌐 Cambio lingua a:', this.data.language);
        // Applica traduzioni a tutti gli elementi con data-i18n (testi, placeholder, aria-label)
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            const val = this.t(key);
            const tag = (el.tagName || '').toUpperCase();

            // placeholder per input/textarea
            if ((tag === 'INPUT' || tag === 'TEXTAREA') && el.hasAttribute('placeholder')) {
                el.setAttribute('placeholder', val);
                return;
            }

           // Se serve HTML (es. <strong>, <br>), abilitalo solo dove dichiarato
if (el.hasAttribute('data-i18n-html')) {
    el.innerHTML = val;
} else {
    el.textContent = val;
}
        });

        const runtimeLang = this.getRuntimeLanguage();
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) languageSelect.value = runtimeLang;
        const subtitleEl = document.querySelector('.subtitle');
        if (subtitleEl) subtitleEl.textContent = this.t('subtitle');
        if (window.KedrixI18n && typeof window.KedrixI18n.setDocumentLanguage === 'function') {
            window.KedrixI18n.setDocumentLanguage(runtimeLang);
            if (typeof window.KedrixI18n.applyBootstrapTranslations === 'function') {
                window.KedrixI18n.applyBootstrapTranslations(document, runtimeLang);
            }
        } else {
            document.documentElement.lang = runtimeLang;
        }
        document.title = this.t('docTitle');
        
        const summaryLabels = document.querySelectorAll('.summary-label');
        if (summaryLabels.length >= 3) {
            summaryLabels[0].textContent = this.t('budget');
            summaryLabels[1].textContent = this.t('remaining');
            summaryLabels[2].textContent = this.t('days');
        }
        
        const headingMap = {
            incomesTitle: 'incomes',
            fixedTitle: 'fixed',
            variableTitle: 'variable',
            chartTitle: 'chart',
            wiseForecastTitle: 'wiseForecastTitle',
            wiseScoreHomeTitle: null,
            calendarToolsTitle: 'calendarToolsTitle'
        };
        Object.entries(headingMap).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (id === 'wiseScoreHomeTitle') {
                el.textContent = 'WiseScore™';
                return;
            }
            if (key) el.textContent = this.t(key);
        });
        
        const incomeBadge = document.getElementById('badge');
        if (incomeBadge) incomeBadge.textContent = this.t('badge');

        const setText = (id, value, useHtml = false) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (useHtml) el.innerHTML = value;
            else el.textContent = value;
        };
        const setPlaceholder = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.placeholder = value;
        };

        const betaUi = {
            it: {
                settingsTitle: 'Build beta',
                settingsText: 'Build controllata per tester. Accesso verificato tramite licenza beta e attivazione remota.',
                feedback: 'Invia feedback',
                footerBuild: 'Kedrix — BETA v1 · Candidata beta',
                accessKicker: 'Kedrix — Accesso beta',
                accessTitle: 'Verifica accesso beta',
                accessText: 'Questa build è riservata ai tester autorizzati. Inserisci l’email approvata per continuare.',
                accessLabel: 'Email autorizzata',
                accessSubmit: 'Verifica accesso'
            },
            en: {
                settingsTitle: 'Beta build',
                settingsText: 'Controlled build for testers. Access is verified through beta licensing and remote activation.',
                feedback: 'Send feedback',
                footerBuild: 'Kedrix — BETA v1 · Beta candidate',
                accessKicker: 'Kedrix — Beta Access',
                accessTitle: 'Verify beta access',
                accessText: 'This build is reserved for authorized testers. Enter the approved email to continue.',
                accessLabel: 'Approved email',
                accessSubmit: 'Verify access'
            },
            es: {
                settingsTitle: 'Versión beta',
                settingsText: 'Build controlada para testers. El acceso se verifica mediante licencia beta y activación remota.',
                feedback: 'Enviar feedback',
                footerBuild: 'Kedrix — BETA v1 · Candidata beta',
                accessKicker: 'Kedrix — Acceso beta',
                accessTitle: 'Verifica acceso beta',
                accessText: 'Esta build está reservada para testers autorizados. Introduce el correo aprobado para continuar.',
                accessLabel: 'Correo autorizado',
                accessSubmit: 'Verificar acceso'
            },
            fr: {
                settingsTitle: 'Version bêta',
                settingsText: 'Build contrôlée pour les testeurs. L’accès est vérifié via licence bêta et activation à distance.',
                feedback: 'Envoyer un feedback',
                footerBuild: 'Kedrix — BETA v1 · Candidate bêta',
                accessKicker: 'Kedrix — Accès bêta',
                accessTitle: 'Vérifier l’accès bêta',
                accessText: 'Cette build est réservée aux testeurs autorisés. Saisissez l’e-mail approuvé pour continuer.',
                accessLabel: 'E-mail autorisé',
                accessSubmit: 'Vérifier l’accès'
            }
        };
        const betaCopy = betaUi[runtimeLang] || betaUi.it;
        setText('betaSettingsTitle', betaCopy.settingsTitle);
        setText('betaSettingsText', betaCopy.settingsText);
        setText('sendFeedbackBtn', betaCopy.feedback);
        setText('footerFeedbackLink', betaCopy.feedback);
        setText('footerBuildLabel', betaCopy.footerBuild);
        setText('betaAccessKicker', betaCopy.accessKicker);
        setText('betaAccessTitle', betaCopy.accessTitle);
        setText('betaAccessText', betaCopy.accessText);
        setText('betaAccessLabel', betaCopy.accessLabel);
        setText('betaAccessSubmit', betaCopy.accessSubmit);

        setText('addIncomeBtn', this.t('addIncome'), true);
        setText('addFixedBtn', this.t('addFixed'), true);
        const resetFixedBtn = document.getElementById('resetFixedBtn');
        if (resetFixedBtn) resetFixedBtn.innerHTML = this.t('resetFixed');
        setText('addExpenseBtn', this.t('addExpense'), true);
        setText('resetDayBtn', this.t('resetDay'), true);
        setText('applySaveBtn', this.t('applySavings'));
        setText('backupBtn', this.t('backup'), true);
        setText('restoreBtn', this.t('restore'), true);

        const loadDemoBtn = document.getElementById('loadDemoBtn');
        if (loadDemoBtn) loadDemoBtn.textContent = this.t('onboardingDemo');
        setText('resetAllBtn', this.t('resetAll'), true);
        setText('exportCalendarBtn', this.t('export'));
        setText('sendChatBtn', this.t('send'));
        
        setPlaceholder('incomeDesc', this.t('incomeDesc'));
        setPlaceholder('incomeAmount', this.t('incomeAmount'));
        setPlaceholder('fixedName', this.t('fixedName'));
        setPlaceholder('fixedAmount', this.t('fixedAmount'));
        setPlaceholder('fixedDay', this.t('fixedDay'));
        setPlaceholder('expenseName', this.t('expenseName'));
        setPlaceholder('expenseAmount', this.t('expenseAmount'));
        setPlaceholder('expenseSubCategory', this.t('expenseSubCategory'));
        setPlaceholder('chatInput', this.t('chatPlaceholder'));
        
        const dateLabel = document.querySelector('.date-selector label');
        if (dateLabel) dateLabel.textContent = this.t('dateLabel');
        
        const dayLabel = document.querySelector('.input-group.half label');
        if (dayLabel) dayLabel.textContent = this.t('dayLabel');
        
        const endDateLabel = document.querySelectorAll('.input-group.half label')[1];
        if (endDateLabel) endDateLabel.textContent = this.t('endDateLabel');
        
        setText('fixedVoiceStatus', this.t('micFixed'));
        setText('voiceStatus', this.t('micVariable'));
        
        const helpFixed = document.getElementById('fixedHelp');
        if (helpFixed) helpFixed.textContent = this.t('helpFixed');
        
        setText('chartNote', this.t('chartNote'));
        
        const percentLabel = document.querySelector('.input-group label[for="savePercent"]');
        if (percentLabel) percentLabel.textContent = this.t('percentLabel');
        
        const goalLabel = document.querySelector('.input-group label[for="saveGoal"]');
        if (goalLabel) goalLabel.textContent = this.t('goalLabel');
        
        const settingLabels = document.querySelectorAll('.setting-item label');
        if (settingLabels.length >= 3) {
            settingLabels[0].innerHTML = this.t('thresholdLabel');
            settingLabels[1].innerHTML = this.t('languageLabel');
            settingLabels[2].innerHTML = this.t('backupLabel');
        }
        
        const welcomeMessage = document.querySelector('.chat-message.bot .message-text');
        if (welcomeMessage) welcomeMessage.textContent = this.t('welcomeMessage');
        
        const suggestionChips = document.querySelectorAll('.suggestion-chip');
        if (suggestionChips.length >= 4) {
            suggestionChips[0].textContent = this.t('suggestion1');
            suggestionChips[1].textContent = this.t('suggestion2');
            suggestionChips[2].textContent = this.t('suggestion3');
            suggestionChips[3].textContent = this.t('suggestion4');
            suggestionChips[0].dataset.question = this.t('aiQuestionSave100');
            suggestionChips[1].dataset.question = this.t('aiQuestionSimulateIncrease');
            suggestionChips[2].dataset.question = this.t('aiQuestionGoal');
            suggestionChips[3].dataset.question = this.t('aiQuestionTopCategory');
        }

        const balanceChartCard = document.getElementById('balanceChartCard');
        if (balanceChartCard) {
            const h2 = balanceChartCard.querySelector('h2');
            if (h2) h2.textContent = this.t('chartTitleBars');
        }
        setText('balanceChartNote', this.t('balanceChartNote'));

        const monthlyBalanceCard = document.getElementById('monthlyBalanceChartCard');
        if (monthlyBalanceCard) {
            const h2 = monthlyBalanceCard.querySelector('h2');
            if (h2) h2.textContent = this.t('chartTitleTrend');
        }
        setText('monthlyBalanceChartNote', this.t('monthlyBalanceNote'));
        setText('monthlyBalanceEmpty', this.t('monthlyBalanceEmpty'), true);

        const categoryPrintPanel = document.getElementById('categoryPrintPanel');
        if (categoryPrintPanel) {
            const labelEl = categoryPrintPanel.querySelector('.category-print-panel__eyebrow');
            if (labelEl) labelEl.textContent = this.t('categoryPrintSelectedLabel');
        }
        const categoryPrintCloseBtn = document.getElementById('closeCategoryPrintBtn');
        if (categoryPrintCloseBtn) categoryPrintCloseBtn.textContent = this.t('close');
        const categoryPrintHint = document.getElementById('categoryPrintHint');
        if (categoryPrintHint) {
            categoryPrintHint.textContent = (Array.isArray(this.selectedCategoryExpenses) && this.selectedCategoryExpenses.length > 0)
                ? this.t('categoryPrintHintReady')
                : this.t('categoryPrintHintEmpty');
        }
        const categoryPrintKpis = categoryPrintPanel ? categoryPrintPanel.querySelectorAll('.category-print-kpi span') : [];
        if (categoryPrintKpis.length >= 2) {
            categoryPrintKpis[0].textContent = this.t('categoryPrintTotalLabel');
            categoryPrintKpis[1].textContent = this.t('categoryPrintCountLabel');
        }
        const printCategoryPdfBtn = document.getElementById('printCategoryPdfBtn');
        if (printCategoryPdfBtn) printCategoryPdfBtn.textContent = this.t('categoryPrintButton');
        const chartLegendToggleBtn = document.getElementById('chartLegendToggleBtn');
        if (chartLegendToggleBtn) {
            chartLegendToggleBtn.textContent = this.chartLegendCollapsed ? this.t('showCategories') : this.t('hideCategories');
        }
        
        setText('guideMessage', this.t('startGuide'));
        
        const micFixedSpan = document.getElementById('micFixedText');
        if (micFixedSpan) micFixedSpan.textContent = this.t('fixedVoiceButton');

        const voiceBtnSpan = document.getElementById('voiceBtnText');
        if (voiceBtnSpan) voiceBtnSpan.textContent = this.t('variableVoiceButton');
        const homeVoiceBtnSpan = document.querySelector('#homeVoiceBtn > span');
        if (homeVoiceBtnSpan) homeVoiceBtnSpan.textContent = this.t('homeVoiceVariableButton');
        const homeManualBtnLabel = document.querySelector('#homeManualBtn > span');
        if (homeManualBtnLabel) homeManualBtnLabel.textContent = this.t('homeManualOpen');
        this.updateWiseDecisionCard();

        const totalIncomeLabel = document.getElementById('totalIncomeLabel');
        if (totalIncomeLabel) totalIncomeLabel.textContent = this.t('totalIncome');

        const footerText = document.getElementById('footerText');
        if (footerText) footerText.textContent = this.t('footerText');

        const footerFeatures = document.getElementById('footerFeatures');
        if (footerFeatures) footerFeatures.textContent = this.t('footerFeatures');
        const footerBrandSignature = document.getElementById('footerBrandSignature');
        if (footerBrandSignature) footerBrandSignature.textContent = this.t('footerBrandSignature');

        const footerPeriodLabel = document.getElementById('footerPeriodLabel');
        if (footerPeriodLabel) footerPeriodLabel.textContent = this.t('footerPeriodLabel');
        const footerDaysLabel = document.getElementById('footerDaysLabel');
        if (footerDaysLabel) footerDaysLabel.textContent = this.t('footerDaysLabel');
        const footerBudgetLabel = document.getElementById('footerBudgetLabel');
        if (footerBudgetLabel) footerBudgetLabel.textContent = this.t('footerBudgetLabel');

        const budgetLabel = document.getElementById('budgetLabel');
        if (budgetLabel) budgetLabel.textContent = this.t('budget');
        
        const remainingLabel = document.getElementById('remainingLabel');
        if (remainingLabel) remainingLabel.textContent = this.t('remaining');
        
        const daysLabel = document.getElementById('daysLabel');
        if (daysLabel) daysLabel.textContent = this.t('days');
        
        const assistantNameText = document.getElementById('assistantNameText');
        if (assistantNameText) assistantNameText.textContent = this.t('assistantName');
        
        const incomeDateLabel = document.getElementById('incomeDateLabel');
        if (incomeDateLabel) incomeDateLabel.textContent = this.t('incomeDateLabel');
        
        const categorySelect = document.getElementById('expenseCategory');
        if (categorySelect) {
            const options = categorySelect.options;
            options[0].text = this.t('categoryAlimentari');
            options[1].text = this.t('categoryTrasporti');
            options[2].text = this.t('categoryAltro');
            // Solo premium ha più categorie
            if (options.length > 3) {
                options[3].text = this.t('categorySvago');
                options[4].text = this.t('categorySalute');
                options[5].text = this.t('categoryAbbigliamento');
            }
        }
        
        const dateHintFixed = document.getElementById('dateHintFixed');
        if (dateHintFixed) dateHintFixed.textContent = this.t('dateHint');

        const dateHintVariable = document.getElementById('dateHintVariable');
        if (dateHintVariable) dateHintVariable.textContent = this.t('dateHint');

        const showAllLabel = document.getElementById('showAllExpensesLabel');
        if (showAllLabel) showAllLabel.textContent = this.t('showAllExpenses');
        
        const csvTitle = document.getElementById('csvTitle');
        if (csvTitle) csvTitle.textContent = this.t('csvTitle');

        const csvSubtitle = document.getElementById('csvSubtitle');
        if (csvSubtitle) csvSubtitle.textContent = this.t('csvSubtitle');

        const csvChooseFileLabel = document.getElementById('csvChooseFileLabel');
        if (csvChooseFileLabel) csvChooseFileLabel.textContent = this.t('csvChooseFile');

        const csvFileName = document.getElementById('csvFileName');
        if (csvFileName && ['Nessun file selezionato','No file selected','Ningún archivo seleccionado','Aucun fichier sélectionné'].includes(String(csvFileName.textContent || '').trim())) {
            csvFileName.textContent = this.t('csvNoFile');
        }

        const importCsvBtn = document.getElementById('importCsvBtn');
        if (importCsvBtn) importCsvBtn.innerHTML = this.t('csvImportBtn');

        const csvDateFormatLabel = document.getElementById('csvDateFormatLabel');
        if (csvDateFormatLabel) csvDateFormatLabel.textContent = this.t('csvDateFormat');

        const csvSeparatorLabel = document.getElementById('csvSeparatorLabel');
        if (csvSeparatorLabel) csvSeparatorLabel.textContent = this.t('csvSeparator');

        const delimiterSelect = document.getElementById('csvDelimiter');
        if (delimiterSelect) {
            const options = delimiterSelect.options;
            if (options.length >= 2) {
                options[0].text = this.data.language === 'it' ? 'GG/MM/AAAA' : 'DD/MM/YYYY';
                options[1].text = this.data.language === 'it' ? 'MM/DD/AAAA' : 'MM/DD/YYYY';
            }
        }

        const separatorSelect = document.getElementById('csvSeparator');
        if (separatorSelect) {
            const options = separatorSelect.options;
            if (options.length >= 3) {
                options[0].text = this.t('csvComma');
                options[1].text = this.t('csvSemicolon');
                options[2].text = this.t('csvTab');
            }
        }

        const csvPreviewTitle = document.getElementById('csvPreviewTitle');
        if (csvPreviewTitle) csvPreviewTitle.textContent = this.t('csvPreview');

        const aiWidgetTitle = document.getElementById('aiWidgetTitle');
        if (aiWidgetTitle) aiWidgetTitle.textContent = this.t('aiSuggestionsTitle');
        const aiWidgetBadge = document.getElementById('aiWidgetBadge');
        if (aiWidgetBadge) aiWidgetBadge.textContent = this.t('aiSmartBadge');
        const dismissAiSuggestionBtn = document.getElementById('dismissAiSuggestion');
        if (dismissAiSuggestionBtn) dismissAiSuggestionBtn.textContent = this.t('close');
        const closeDetailBtn2 = document.getElementById('closeDetailBtn');
        if (closeDetailBtn2) closeDetailBtn2.textContent = this.t('close');
        const importReviewTitle = document.getElementById('importReviewTitle');
        if (importReviewTitle) importReviewTitle.textContent = this.t('importReview');
        const csvMappingTitle = document.getElementById('csvMappingTitle');
        if (csvMappingTitle) csvMappingTitle.textContent = this.t('csvMappingTitle');
        const csvMappingInstructions = document.getElementById('csvMappingInstructions');
        if (csvMappingInstructions) csvMappingInstructions.innerHTML = this.t('csvMappingInstructionsHtml');
        const csvMappingFieldsTitle = document.getElementById('csvMappingFieldsTitle');
        if (csvMappingFieldsTitle) csvMappingFieldsTitle.textContent = this.t('csvMappingFieldsTitle');

        const catSectionTitle = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.includes('📂'));
        if (catSectionTitle) catSectionTitle.textContent = this.t('categoriesSectionTitle');

        const manageBtn = document.getElementById('manageCategoriesBtn');
        if (manageBtn) manageBtn.textContent = this.t('manageCustomCategories');

        const catOverlay = document.getElementById('categoryManagerOverlay');
        if (catOverlay) {
            const h3 = catOverlay.querySelector('h3');
            if (h3) h3.textContent = this.t('manageCategories');

            const h4s = catOverlay.querySelectorAll('h4');
            if (h4s.length >= 2) {
                h4s[0].textContent = this.t('defaultCategoriesTitle');
                h4s[1].textContent = this.t('yourCategoriesTitle');
            }

            const newCatLabel = catOverlay.querySelector('label[for="newCategoryName"]');
            if (newCatLabel) newCatLabel.textContent = this.t('newCategoryLabel');

            const newCatInput = document.getElementById('newCategoryName');
            if (newCatInput) newCatInput.placeholder = this.t('newCategoryPlaceholder');
            const newSubCatInput = document.getElementById('newSubcategoryName');
            if (newSubCatInput) newSubCatInput.placeholder = this.t('expenseSubCategory');

            const saveCatBtn = document.getElementById('saveCategoryBtn');
            if (saveCatBtn) saveCatBtn.textContent = this.t('add');

            const closeCatBtn = document.getElementById('closeCategoryManager');
            if (closeCatBtn) closeCatBtn.textContent = this.t('close');
        }

        // Traduci i bottoni dei tab
        const tabButtons = document.querySelectorAll('.tab-btn');
        if (tabButtons.length >= 7) {
            tabButtons[0].textContent = this.t('tabHome');
            tabButtons[1].textContent = this.t('tabIncomes');
            tabButtons[2].textContent = this.t('tabFixed');
            tabButtons[3].textContent = this.t('tabVariable');
            tabButtons[4].textContent = this.t('tabAnalysis');
            tabButtons[5].textContent = this.t('tabAI');
            tabButtons[6].textContent = this.t('tabTools');
        }

                        // Traduzioni per skip rows
        const skipRowsLabel = document.getElementById('skipRowsLabel');
        if (skipRowsLabel) skipRowsLabel.textContent = this.t('skipRowsLabel');
        const headerRowManualLabel = document.getElementById('headerRowManualLabel');
        if (headerRowManualLabel) headerRowManualLabel.textContent = this.t('headerRowManualLabel');
        const skipHelp = document.getElementById('skipHelp');
        if (skipHelp) skipHelp.textContent = this.t('skipHelp');

        // ===== NUOVE TRADUZIONI AGGIUNTIVE =====
        
        // 1. WIDGET RISPARMIO
        const savingsWidgetTitle = document.getElementById('savingsWidgetTitle');
        if (savingsWidgetTitle) savingsWidgetTitle.textContent = this.t('savingsWidgetTitle');
        
        const targetDate = document.getElementById('targetDate');
        if (targetDate && (targetDate.textContent === 'Mai' || targetDate.textContent === 'Never' || targetDate.textContent === 'Nunca' || targetDate.textContent === 'Jamais')) {
            targetDate.textContent = this.t('never');
        }
        
        const percentLabels = document.querySelectorAll('.slider-labels span');
        if (percentLabels.length >= 3) {
            percentLabels[0].textContent = this.t('percent0');
            percentLabels[1].textContent = this.t('percent15');
            percentLabels[2].textContent = this.t('percent30');
        }
        
        const savingsPotInputLabel = document.getElementById('savingsPotInputLabel');
        if (savingsPotInputLabel) savingsPotInputLabel.textContent = this.t('savingsPotInputLabel');
        
        const currentPlanTitle = document.getElementById('currentPlanTitle');
        if (currentPlanTitle) currentPlanTitle.innerHTML = this.t('currentPlan');
        
        const currentPlanMessage = document.getElementById('currentPlanMessage');
        if (currentPlanMessage) currentPlanMessage.innerHTML = this.t('currentPlanMessage');

        const wiseScoreHomeTitle = document.getElementById('wiseScoreHomeTitle');
        if (wiseScoreHomeTitle) wiseScoreHomeTitle.textContent = 'WiseScore™';
        const pillarNames = document.querySelectorAll('.wise-pillar-name');
        if (pillarNames.length >= 3) {
            pillarNames[0].textContent = this.uiText('wisePillarStability');
            pillarNames[1].textContent = this.uiText('wisePillarDiscipline');
            pillarNames[2].textContent = this.uiText('wisePillarResilience');
        }
        const reportToolsCard = document.getElementById('reportToolsCard');
        if (reportToolsCard) {
            const h2 = reportToolsCard.querySelector('h2');
            const note = reportToolsCard.querySelector('.chart-note');
            if (h2) h2.textContent = this.uiText('reportToolsTitle');
            if (note) note.textContent = this.uiText('reportToolsNote');
        }
        const openReportBtn = document.getElementById('openReportBtn');
        if (openReportBtn) openReportBtn.textContent = this.uiText('reportOpen');
        const refreshReportBtn = document.getElementById('refreshReportBtn');
        if (refreshReportBtn) refreshReportBtn.textContent = this.uiText('reportRefresh');
        const reportGeneratedAt = document.getElementById('reportGeneratedAt');
        if (reportGeneratedAt && !reportGeneratedAt.dataset.dynamicReportTs) reportGeneratedAt.textContent = this.uiText('reportCurrentPeriodSummary');
        const reportModalHeader = document.querySelector('#reportModal .report-modal-header h3');
        if (reportModalHeader) reportModalHeader.textContent = this.uiText('reportToolsTitle');
        const refreshReportModalBtn = document.getElementById('refreshReportModalBtn');
        if (refreshReportModalBtn) refreshReportModalBtn.textContent = this.uiText('reportRefresh');
        const exportReportPdfBtn = document.getElementById('exportReportPdfBtn');
        if (exportReportPdfBtn) exportReportPdfBtn.textContent = this.uiText('exportPdf');
        const closeReportBtn = document.getElementById('closeReportBtn');
        if (closeReportBtn) closeReportBtn.textContent = this.uiText('close');
        const savingsTitle = document.getElementById('savingsTitle');
        if (savingsTitle) savingsTitle.textContent = this.t('savings');
        if (savingsWidgetTitle) savingsWidgetTitle.textContent = this.uiText('savingsWidgetTitleFixed');
        
                // 2. IMPOSTAZIONI - FORMATO DATE FISSE
        const fixedDaysLabel = document.querySelector('label[for="dateFormatDays"] span');
        if (fixedDaysLabel) fixedDaysLabel.textContent = this.t('fixedDateFormatDays');
        
        const fixedMonthsLabel = document.querySelector('label[for="dateFormatMonths"] span');
        if (fixedMonthsLabel) fixedMonthsLabel.textContent = this.t('fixedDateFormatMonths');
        
        const helpText = document.getElementById('fixedDateFormatHelp');
        if (helpText) helpText.textContent = this.t('fixedDateFormatHelp');
        
        // 3. PULSANTI BACKUP
        const backupLabel = document.getElementById('backupLabel');
        if (backupLabel) backupLabel.textContent = this.t('backupLabel');
        
        const backupBtn = document.getElementById('backupBtn');
        if (backupBtn) backupBtn.innerHTML = this.t('backupButton');
        
        const restoreBtn = document.getElementById('restoreBtn');
        if (restoreBtn) restoreBtn.innerHTML = this.t('restoreButton');
        
        // 4. RICERCA
        const searchInput = document.getElementById('searchExpenses');
        if (searchInput) searchInput.placeholder = this.t('searchPlaceholder');
        
        const allCategoriesOption = document.querySelector('#searchCategory option[value="all"]');
        if (allCategoriesOption) allCategoriesOption.textContent = this.t('allCategories');
        
        const resetSearchBtn = document.getElementById('resetSearchBtn');
        if (resetSearchBtn) resetSearchBtn.innerHTML = this.t('clearFilters');
        
        // 5. RIEPILOGO IN ALTO
        const savingsPotLabel = document.getElementById('savingsPotLabel');
        if (savingsPotLabel) savingsPotLabel.textContent = this.t('savingsPotLabel');
        const paceLabel = document.getElementById('spendingPaceLabel');
        if (paceLabel) paceLabel.textContent = this.t('spendingPace');
        if (document.getElementById('remainingLabel')) document.getElementById('remainingLabel').textContent = this.t('remaining');
        if (document.getElementById('daysLabel')) document.getElementById('daysLabel').textContent = this.t('days');
        if (document.getElementById('budgetLabel')) document.getElementById('budgetLabel').textContent = this.t('budget');
        this.updateWiseForecastHome();
        
        // 6. IMPORT AVANZATO - EXCEL
        const excelSheetLabel = document.getElementById('excelSheetLabel');
        if (excelSheetLabel) excelSheetLabel.textContent = this.t('excelSheet');
        
        const excelHeaderLabel = document.getElementById('excelHeaderLabel');
        if (excelHeaderLabel) excelHeaderLabel.textContent = this.t('excelHeaderRow');
        
        const excelSheetSelect = document.getElementById('excelSheet');
        if (excelSheetSelect) {
            const placeholderOption = excelSheetSelect.querySelector('option[value=""]');
            if (placeholderOption) placeholderOption.textContent = this.t('excelSheetPlaceholder');
        }
        
        const excelHeaderSelect = document.getElementById('excelHeaderRow');
        if (excelHeaderSelect) {
            const options = excelHeaderSelect.options;
            if (options.length >= 4) {
                for (let i = 0; i < options.length; i++) {
                    if (options[i].value === "-1") {
                        options[i].text = this.t('rowNone');
                    }
                }
            }
        }
        
        const excelHelp = document.getElementById('excelHelp');
        if (excelHelp) excelHelp.textContent = this.t('excelHelp');

        this.updateIncomeList();
        this.updateFixedExpensesList();
        this.updateVariableExpensesList();
        this.updateFixedStatusHome();
        this.updateChart();

        this.updateAllCategorySelects();
        const catOverlayOpen = document.getElementById('categoryManagerOverlay');
        if (catOverlayOpen && catOverlayOpen.style.display === 'flex') this.refreshCategoryList();
// Traduci il pulsante "Forse dopo" nel modal Premium
const closePremiumBtn = document.getElementById('closePremiumBtn');
if (closePremiumBtn) {
    closePremiumBtn.textContent = this.t('maybeLater');
}
if (typeof this.normalizePremiumModalUI === 'function') {
    this.normalizePremiumModalUI();
}

// Traduci lo span del pulsante Aggiungi categoria
const addCategoryBtnText = document.getElementById('addCategoryBtnText');
if (addCategoryBtnText) {
    addCategoryBtnText.textContent = this.t('add');
}

// Traduci le opzioni del select delle righe intestazione Excel
const excelHeaderSelectEl = document.getElementById('excelHeaderRow');  // CAMBIATO IL NOME
if (excelHeaderSelectEl) {
    const options = excelHeaderSelectEl.options;
    if (options.length >= 4) {
        // Traduci "None (auto)"
        for (let i = 0; i < options.length; i++) {
            if (options[i].value === "-1") {
                options[i].text = this.t('rowNone');
            }
        }
    }
}


        this.updatePeriodInfo();
        this.updateHomeHeroMetrics();
        this.updateWiseForecastHome();
        this.applyPrivacyState();
    }
                


    updateHomeHeroMetrics() {
        const paceEl = document.getElementById('spendingPaceValue');
        if (paceEl) {
            const dailyBudget = Number(this.calculateDecisionDailyBudget() || 0);
            const forecast = this.calculateWiseForecastData ? this.calculateWiseForecastData() : null;
            const avgDaily = Number(forecast?.avgVariablePerDay || 0);
            const ratio = dailyBudget > 0 ? avgDaily / dailyBudget : Number.POSITIVE_INFINITY;

            let key = 'spendingPaceOnTrack';
            if (dailyBudget <= 0 || ratio > 1.3) key = 'spendingPaceRisk';
            else if (ratio > 1.1) key = 'spendingPaceWarning';
            else if (ratio <= 0.9) key = 'spendingPaceSafe';

            paceEl.textContent = this.t(key);
            paceEl.title = `${this.formatCurrency(avgDaily)} / ${this.formatCurrency(dailyBudget)}`;
        }
    }


    markRuntimeSensitiveAmounts(root = document) {
        if (!root || !root.querySelectorAll) return;
        const selector = [
            '.sensitive-amount',
            '.expense-amount',
            '.fixed-status-amount',
            '.fixed-expense-summary-value',
            '.review-amount',
            '.chart-legend-value',
            '#totalIncomeDisplay',
            '.report-kpi-value',
            '.future-fixed-total',
            '.future-fixed-amount',
            '.forecast-value',
            '.forecast-side-value',
            '.safe-to-spend-value',
            '.forecast-simulator-value',
            '.hero-main',
            '.hero-meta-value',
            '.trend-indicator',
            '.wise-score-value',
            '#categoryPrintTotal',
            '.report-hero-meta-item strong',
            '.report-list-item-top strong:last-child',
            '.report-variable-item-amount',
            '.report-recurring-item-amount',
            '.detail-kpi strong'
        ].join(',');

        root.querySelectorAll(selector).forEach((node) => {
            const text = String(node.textContent || '').trim();
            if (/€|\$|£/.test(text) || node.matches('.sensitive-amount, .expense-amount, .fixed-status-amount, .fixed-expense-summary-value, .review-amount, .chart-legend-value, .report-kpi-value, .future-fixed-total, .future-fixed-amount, .forecast-value, .forecast-side-value, .safe-to-spend-value, .forecast-simulator-value, .hero-main, .hero-meta-value, .trend-indicator, .wise-score-value, #totalIncomeDisplay, #categoryPrintTotal')) {
                node.classList.add('privacy-sensitive-runtime');
            }
        });
    }

    applyPrivacyState() {
        this.markRuntimeSensitiveAmounts(document);
        document.body.classList.toggle('privacy-hidden', !!this.isPrivacyHidden);
        const toggle = document.getElementById('privacyToggle');
        if (toggle) {
            toggle.textContent = this.t(this.isPrivacyHidden ? 'privacyShow' : 'privacyHide');
            toggle.setAttribute('aria-pressed', this.isPrivacyHidden ? 'true' : 'false');
        }
    }

    initPrivacyToggle() {
        const toggle = document.getElementById('privacyToggle');
        if (!toggle || toggle.dataset.bound === 'true') return;
        toggle.dataset.bound = 'true';
        toggle.addEventListener('click', () => {
            this.isPrivacyHidden = !this.isPrivacyHidden;
            this.writeStorage('kedrix-privacy-hidden', this.isPrivacyHidden ? 'true' : 'false');
            this.applyPrivacyState();
        });
        this.applyPrivacyState();
    }

    initTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        const sections = document.querySelectorAll('[data-tab].section-card, [data-tab].period-source');

        const showTab = (tabId) => {
            sections.forEach((section) => {
                const isActive = section.dataset.tab === tabId;
                section.style.transition = 'opacity 0.2s ease, transform 0.2s ease';

                if (isActive) {
                    section.style.setProperty('display', 'block', 'important');
                    void section.offsetWidth;
                    section.style.opacity = '1';
                    section.style.transform = 'translateY(0)';
                } else {
                    section.style.opacity = '0';
                    section.style.transform = 'translateY(10px)';
                    section.style.setProperty('display', 'none', 'important');
                }
            });

            const guide = document.querySelector('.guide-message[data-tab]');
            if (guide) {
                const guideActive = tabId === guide.dataset.tab;
                guide.style.setProperty('display', guideActive ? 'block' : 'none', 'important');
                guide.style.opacity = guideActive ? '1' : '0';
                guide.style.transform = guideActive ? 'translateY(0)' : 'translateY(10px)';
            }

            tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
        };

        this.showTab = showTab;

        tabs.forEach((btn) => {
            btn.addEventListener('click', () => {
                showTab(btn.dataset.tab);
            });
        });

        showTab('home');
    }

    openAnalysisReportFromShortcut() {
        if (typeof this.showTab === 'function') this.showTab('analysis');
        setTimeout(() => {
            if (typeof this.openReportModal === 'function') {
                this.openReportModal();
            }
            const reportBtn = document.getElementById('openReportBtn');
            if (reportBtn) reportBtn.focus();
        }, 80);
    }

    getBuildInfo() {
        const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
        const iosStandalone = typeof navigator !== 'undefined' && navigator.standalone === true;
        return {
            build: KEDRIX_BUILD,
            channel: KEDRIX_RELEASE_CHANNEL,
            language: this.data?.language || document.documentElement.lang || 'it',
            theme: document.documentElement.getAttribute('data-theme') || 'light',
            standalone: standalone || iosStandalone,
            userAgent: navigator.userAgent
        };
    }

    updateBetaBuildUI() {
        const info = this.getBuildInfo();
        const lang = this.getRuntimeLanguage();
        const buildLabel = `Kedrix — ${info.channel.toUpperCase()} · ${info.build}`;
        const footerBuildLabel = document.getElementById('footerBuildLabel');
        if (footerBuildLabel) footerBuildLabel.textContent = buildLabel;

        const betaSettingsBadge = document.getElementById('betaSettingsBadge');
        if (betaSettingsBadge) betaSettingsBadge.textContent = info.build;

        const buildUi = {
            it: {
                textInstalled: 'Build controllata per tester. Accesso verificato tramite licenza beta e attivazione remota. PWA installata.',
                textReady: 'Build controllata per tester. Accesso verificato tramite licenza beta e attivazione remota. PWA apribile/installabile.'
            },
            en: {
                textInstalled: 'Controlled build for testers. Access is verified through beta licensing and remote activation. PWA installed.',
                textReady: 'Controlled build for testers. Access is verified through beta licensing and remote activation. PWA ready to open/install.'
            },
            es: {
                textInstalled: 'Build controlada para testers. El acceso se verifica mediante licencia beta y activación remota. PWA instalada.',
                textReady: 'Build controlada para testers. El acceso se verifica mediante licencia beta y activación remota. PWA lista para abrir/instalar.'
            },
            fr: {
                textInstalled: 'Build contrôlée pour les testeurs. L’accès est vérifié via licence bêta et activation à distance. PWA installée.',
                textReady: 'Build contrôlée pour les testeurs. L’accès est vérifié via licence bêta et activation à distance. PWA prête à être ouverte/installée.'
            }
        };
        const copy = buildUi[lang] || buildUi.it;
        const betaSettingsText = document.getElementById('betaSettingsText');
        if (betaSettingsText) {
            betaSettingsText.textContent = info.standalone ? copy.textInstalled : copy.textReady;
        }
    }

    getFeedbackUiCopy() {
        const lang = this.data?.language || 'it';
        const map = {
            it: {
                title: 'Invia feedback',
                subtitle: 'Feedback interno Kedrix',
                messageLabel: 'Messaggio',
                messagePlaceholder: 'Scrivi qui cosa hai notato, cosa ti aspettavi e cosa è successo.',
                typeLabel: 'Tipo feedback',
                qualityLabel: 'Qualità feedback',
                categoryLabel: 'Categoria (facoltativa)',
                cancel: 'Annulla',
                send: 'Invia feedback',
                genericType: 'generale',
                bugType: 'bug',
                uxType: 'ux_ui',
                ideaType: 'idea',
                performanceType: 'performance',
                contentType: 'contenuto',
                genericTypeLabel: 'Generale',
                bugTypeLabel: 'Bug',
                uxTypeLabel: 'UX/UI',
                ideaTypeLabel: 'Idea',
                performanceTypeLabel: 'Performance',
                contentTypeLabel: 'Contenuto',
                lowQuality: 'bassa',
                mediumQuality: 'media',
                highQuality: 'alta',
                lowQualityLabel: 'Bassa',
                mediumQualityLabel: 'Media',
                highQualityLabel: 'Alta',
                messageRequired: 'Inserisci un feedback prima di inviare.',
                sent: '✅ Feedback inviato correttamente',
                failed: '⚠️ Invio feedback non riuscito. Controlla endpoint o connessione.'
            },
            en: {
                title: 'Send feedback',
                subtitle: 'Kedrix internal feedback',
                messageLabel: 'Message',
                messagePlaceholder: 'Write what you noticed, what you expected, and what happened.',
                typeLabel: 'Feedback type',
                qualityLabel: 'Feedback quality',
                categoryLabel: 'Category (optional)',
                cancel: 'Cancel',
                send: 'Send feedback',
                genericType: 'general',
                bugType: 'bug',
                uxType: 'ux_ui',
                ideaType: 'idea',
                performanceType: 'performance',
                contentType: 'content',
                genericTypeLabel: 'General',
                bugTypeLabel: 'Bug',
                uxTypeLabel: 'UX/UI',
                ideaTypeLabel: 'Idea',
                performanceTypeLabel: 'Performance',
                contentTypeLabel: 'Content',
                lowQuality: 'low',
                mediumQuality: 'medium',
                highQuality: 'high',
                lowQualityLabel: 'Low',
                mediumQualityLabel: 'Medium',
                highQualityLabel: 'High',
                messageRequired: 'Enter feedback before sending.',
                sent: '✅ Feedback sent successfully',
                failed: '⚠️ Feedback could not be sent. Check endpoint or connection.'
            },
            es: {
                title: 'Enviar feedback',
                subtitle: 'Feedback interno Kedrix',
                messageLabel: 'Mensaje',
                messagePlaceholder: 'Escribe qué has notado, qué esperabas y qué ha ocurrido.',
                typeLabel: 'Tipo de feedback',
                qualityLabel: 'Calidad del feedback',
                categoryLabel: 'Categoría (opcional)',
                cancel: 'Cancelar',
                send: 'Enviar feedback',
                genericType: 'general',
                bugType: 'bug',
                uxType: 'ux_ui',
                ideaType: 'idea',
                performanceType: 'performance',
                contentType: 'contenido',
                genericTypeLabel: 'General',
                bugTypeLabel: 'Bug',
                uxTypeLabel: 'UX/UI',
                ideaTypeLabel: 'Idea',
                performanceTypeLabel: 'Rendimiento',
                contentTypeLabel: 'Contenido',
                lowQuality: 'baja',
                mediumQuality: 'media',
                highQuality: 'alta',
                lowQualityLabel: 'Baja',
                mediumQualityLabel: 'Media',
                highQualityLabel: 'Alta',
                messageRequired: 'Introduce un feedback antes de enviar.',
                sent: '✅ Feedback enviado correctamente',
                failed: '⚠️ No se pudo enviar el feedback. Revisa endpoint o conexión.'
            },
            fr: {
                title: 'Envoyer un feedback',
                subtitle: 'Feedback interne Kedrix',
                messageLabel: 'Message',
                messagePlaceholder: 'Décris ce que tu as constaté, ce que tu attendais et ce qui s’est passé.',
                typeLabel: 'Type de feedback',
                qualityLabel: 'Qualité du feedback',
                categoryLabel: 'Catégorie (facultative)',
                cancel: 'Annuler',
                send: 'Envoyer le feedback',
                genericType: 'general',
                bugType: 'bug',
                uxType: 'ux_ui',
                ideaType: 'idee',
                performanceType: 'performance',
                contentType: 'contenu',
                genericTypeLabel: 'Général',
                bugTypeLabel: 'Bug',
                uxTypeLabel: 'UX/UI',
                ideaTypeLabel: 'Idée',
                performanceTypeLabel: 'Performance',
                contentTypeLabel: 'Contenu',
                lowQuality: 'basse',
                mediumQuality: 'moyenne',
                highQuality: 'haute',
                lowQualityLabel: 'Basse',
                mediumQualityLabel: 'Moyenne',
                highQualityLabel: 'Haute',
                messageRequired: 'Saisis un feedback avant l’envoi.',
                sent: '✅ Feedback envoyé correctement',
                failed: '⚠️ Envoi du feedback impossible. Vérifie le point de terminaison ou la connexion.'
            }
        };
        return map[lang] || map.it;
    }

    ensureFeedbackDialog() {
        let overlay = document.getElementById('kedrixFeedbackDialog');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'kedrixFeedbackDialog';
        overlay.className = 'modal-overlay modal-overlay-upgraded';
        overlay.style.display = 'none';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.padding = '12px';
        overlay.style.boxSizing = 'border-box';
        overlay.style.background = 'rgba(0,0,0,0.72)';
        overlay.style.backdropFilter = 'blur(4px)';
        overlay.style.zIndex = '10060';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.innerHTML = `
            <div id="kedrixFeedbackDialogCard" class="modal-content license-modal-card" style="background: var(--card-bg); border-radius: 22px; max-width: 520px; width: min(94vw, 520px); max-height: min(calc(100vh - 24px), calc(100dvh - 24px)); box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 1px solid rgba(148,163,184,0.18); display:flex; flex-direction:column; overflow:hidden;">
                <div id="kedrixFeedbackDialogBody" style="flex:1 1 auto; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:24px 24px 16px;">
                    <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:16px;">
                        <div id="kedrixFeedbackTitle" style="font-size: 1.05rem; font-weight: 800;"></div>
                        <div id="kedrixFeedbackSubtitle" style="font-size: 0.92rem; color: var(--text-secondary);"></div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:14px;">
                        <label style="display:flex; flex-direction:column; gap:6px;">
                            <span id="kedrixFeedbackMessageLabel" style="font-size:0.9rem; font-weight:700;"></span>
                            <textarea id="kedrixFeedbackMessage" rows="6" style="width:100%; min-height:140px; resize:vertical; padding:12px 14px; border-radius:14px; border:1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary);"></textarea>
                        </label>
                        <div id="kedrixFeedbackGrid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:12px;">
                            <label style="display:flex; flex-direction:column; gap:6px;">
                                <span id="kedrixFeedbackTypeLabel" style="font-size:0.86rem; font-weight:700;"></span>
                                <select id="kedrixFeedbackType" style="width:100%; padding:12px 14px; border-radius:14px; border:1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary);"></select>
                            </label>
                            <label style="display:flex; flex-direction:column; gap:6px;">
                                <span id="kedrixFeedbackQualityLabel" style="font-size:0.86rem; font-weight:700;"></span>
                                <select id="kedrixFeedbackQuality" style="width:100%; padding:12px 14px; border-radius:14px; border:1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary);"></select>
                            </label>
                        </div>
                        <label style="display:flex; flex-direction:column; gap:6px;">
                            <span id="kedrixFeedbackCategoryLabel" style="font-size:0.86rem; font-weight:700;"></span>
                            <input id="kedrixFeedbackCategory" type="text" style="width:100%; padding:12px 14px; border-radius:14px; border:1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary);" />
                        </label>
                    </div>
                </div>
                <div id="kedrixFeedbackDialogFooter" style="flex:0 0 auto; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap; padding:14px 24px calc(16px + env(safe-area-inset-bottom, 0px)); border-top:1px solid rgba(148,163,184,0.12); background: var(--card-bg);">
                    <button id="kedrixFeedbackCancel" class="btn-secondary" type="button"></button>
                    <button id="kedrixFeedbackSubmit" class="premium-btn premium-btn--fintech" type="button"></button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const applyFeedbackDialogResponsiveLayout = () => {
            const card = document.getElementById('kedrixFeedbackDialogCard');
            const body = document.getElementById('kedrixFeedbackDialogBody');
            const footer = document.getElementById('kedrixFeedbackDialogFooter');
            const grid = document.getElementById('kedrixFeedbackGrid');
            const cancelBtn = document.getElementById('kedrixFeedbackCancel');
            const submitBtn = document.getElementById('kedrixFeedbackSubmit');
            if (!card || !body || !footer) return;

            const mobile = window.innerWidth <= 640;
            overlay.style.padding = mobile ? '8px' : '12px';
            overlay.style.alignItems = mobile ? 'flex-end' : 'center';
            card.style.width = mobile ? '100%' : 'min(94vw, 520px)';
            card.style.maxWidth = mobile ? '100%' : '520px';
            card.style.maxHeight = mobile ? 'min(calc(100vh - 16px), calc(100dvh - 16px))' : 'min(calc(100vh - 24px), calc(100dvh - 24px))';
            card.style.borderRadius = mobile ? '24px 24px 20px 20px' : '22px';
            body.style.padding = mobile ? '20px 16px 12px' : '24px 24px 16px';
            footer.style.padding = mobile ? '12px 16px calc(16px + env(safe-area-inset-bottom, 0px))' : '14px 24px calc(16px + env(safe-area-inset-bottom, 0px))';
            footer.style.flexDirection = mobile ? 'column-reverse' : 'row';
            footer.style.justifyContent = mobile ? 'stretch' : 'flex-end';
            if (grid) {
                grid.style.gridTemplateColumns = mobile ? '1fr' : 'repeat(auto-fit, minmax(140px, 1fr))';
            }
            [cancelBtn, submitBtn].forEach((btn) => {
                if (!btn) return;
                btn.style.width = mobile ? '100%' : '';
                btn.style.minHeight = mobile ? '52px' : '';
            });
        };

        overlay._bwApplyLayout = applyFeedbackDialogResponsiveLayout;
        applyFeedbackDialogResponsiveLayout();
        window.addEventListener('resize', applyFeedbackDialogResponsiveLayout, { passive: true });

        this.bindOverlayEscape(overlay, () => {
            if (typeof overlay._bwClose === 'function') overlay._bwClose(null, true);
        });
        return overlay;
    }

    openFeedbackDialog() {
        return new Promise((resolve) => {
            const overlay = this.ensureFeedbackDialog();
            const copy = this.getFeedbackUiCopy();
            if (!overlay) {
                resolve(null);
                return;
            }

            const titleEl = document.getElementById('kedrixFeedbackTitle');
            const subtitleEl = document.getElementById('kedrixFeedbackSubtitle');
            const messageLabelEl = document.getElementById('kedrixFeedbackMessageLabel');
            const messageEl = document.getElementById('kedrixFeedbackMessage');
            const typeLabelEl = document.getElementById('kedrixFeedbackTypeLabel');
            const typeEl = document.getElementById('kedrixFeedbackType');
            const qualityLabelEl = document.getElementById('kedrixFeedbackQualityLabel');
            const qualityEl = document.getElementById('kedrixFeedbackQuality');
            const categoryLabelEl = document.getElementById('kedrixFeedbackCategoryLabel');
            const categoryEl = document.getElementById('kedrixFeedbackCategory');
            const cancelBtn = document.getElementById('kedrixFeedbackCancel');
            const submitBtn = document.getElementById('kedrixFeedbackSubmit');

            if (![titleEl, subtitleEl, messageLabelEl, messageEl, typeLabelEl, typeEl, qualityLabelEl, qualityEl, categoryLabelEl, categoryEl, cancelBtn, submitBtn].every(Boolean)) {
                resolve(null);
                return;
            }

            titleEl.textContent = copy.title;
            subtitleEl.textContent = copy.subtitle;
            messageLabelEl.textContent = copy.messageLabel;
            messageEl.placeholder = copy.messagePlaceholder;
            typeLabelEl.textContent = copy.typeLabel;
            qualityLabelEl.textContent = copy.qualityLabel;
            categoryLabelEl.textContent = copy.categoryLabel;
            categoryEl.placeholder = this.t('categoryName') || '';
            cancelBtn.textContent = copy.cancel;
            submitBtn.textContent = copy.send;

            typeEl.innerHTML = [
                { value: copy.genericType, label: copy.genericTypeLabel },
                { value: copy.bugType, label: copy.bugTypeLabel },
                { value: copy.uxType, label: copy.uxTypeLabel },
                { value: copy.ideaType, label: copy.ideaTypeLabel },
                { value: copy.performanceType, label: copy.performanceTypeLabel },
                { value: copy.contentType, label: copy.contentTypeLabel }
            ].map((item) => `<option value="${item.value}">${item.label}</option>`).join('');

            qualityEl.innerHTML = [
                { value: copy.lowQuality, label: copy.lowQualityLabel },
                { value: copy.mediumQuality, label: copy.mediumQualityLabel },
                { value: copy.highQuality, label: copy.highQualityLabel }
            ].map((item) => `<option value="${item.value}">${item.label}</option>`).join('');

            messageEl.value = '';
            typeEl.value = copy.genericType;
            qualityEl.value = copy.mediumQuality;
            categoryEl.value = '';

            const finish = (result, dismissed = false) => {
                overlay.style.display = 'none';
                this.setOverlayState(false);
                overlay._bwClose = null;
                resolve(dismissed ? null : result);
            };

            overlay._bwClose = (_result, dismissed = false) => finish(null, dismissed);
            cancelBtn.onclick = () => finish(null, true);
            submitBtn.onclick = () => {
                const messaggioFeedback = String(messageEl.value || '').trim();
                if (!messaggioFeedback) {
                    this.showToast(copy.messageRequired, 'error');
                    messageEl.focus();
                    return;
                }
                finish({
                    messaggioFeedback,
                    tipoFeedback: String(typeEl.value || copy.genericType).trim(),
                    qualitaFeedback: String(qualityEl.value || copy.mediumQuality).trim(),
                    categoriaFeedback: String(categoryEl.value || '').trim()
                });
            };

            overlay.style.display = 'flex';
            if (typeof overlay._bwApplyLayout === 'function') overlay._bwApplyLayout();
            this.setOverlayState(true);
            setTimeout(() => messageEl.focus(), 0);
        });
    }

    async sendInternalFeedback(payload) {
        const tracker = window.KedrixTracking;
        if (!tracker || typeof tracker.trackEvent !== 'function') return false;

        const feedbackCount = (typeof tracker.incrementCounter === 'function')
            ? tracker.incrementCounter('feedback_count')
            : (Number(localStorage.getItem('feedback_count') || 0) + 1);

        if (typeof tracker.incrementCounter !== 'function') {
            localStorage.setItem('feedback_count', String(feedbackCount));
        }

        const fullPayload = {
            testerId: localStorage.getItem('tester_id') || '',
            feedbackCount,
            messaggioFeedback: payload.messaggioFeedback || '',
            tipoFeedback: payload.tipoFeedback || 'generale',
            qualitaFeedback: payload.qualitaFeedback || 'media',
            categoriaFeedback: payload.categoriaFeedback || '',
            reason: 'feedback_inviato'
        };

        const response = await tracker.trackEvent('feedback_inviato', fullPayload);
        if (response && response.ok === false) return false;
        if (response === null) return false;
        if (response && response.skipped) return false;
        return true;
    }

    async handleFeedbackTrigger(ev) {
        if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
        }

        const payload = await this.openFeedbackDialog();
        if (!payload) return false;

        const sent = await this.sendInternalFeedback(payload);
        const copy = this.getFeedbackUiCopy();
        this.showToast(sent ? copy.sent : copy.failed, sent ? 'success' : 'error');
        return sent;
    }

    setupBetaFeedbackActions() {
        ['sendFeedbackBtn', 'footerFeedbackLink'].forEach((id) => {
            const trigger = document.getElementById(id);
            if (!trigger) return;
            if (trigger.tagName === 'A') {
                trigger.setAttribute('href', '#feedback');
                trigger.removeAttribute('target');
                trigger.removeAttribute('rel');
            }
            trigger.onclick = (ev) => this.handleFeedbackTrigger(ev);
        });
    }


    handleAppShortcuts() {
        const params = new URLSearchParams(window.location.search || '');
        const action = params.get('action');
        if (!action) return;

        const consumeAction = () => {
            const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
            window.history.replaceState({}, document.title, cleanUrl);
        };

        if (action === 'new-expense') {
            setTimeout(() => {
                this.openVariableTabFromHome();
                consumeAction();
            }, 120);
            return;
        }

        if (action === 'report') {
            setTimeout(() => {
                this.openAnalysisReportFromShortcut();
                consumeAction();
            }, 140);
        }
    }


    getInstallStatusMessage() {
        const info = this.getBuildInfo();
        const deferred = !!this.deferredInstallPrompt;
        const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || '');

        if (info.standalone) return this.t('installOpenStandalone');
        if (deferred) return this.t('installPromptReady');
        if (isIos) return this.t('installIosHint');
        return this.t('installUnsupportedHint');
    }

    updateDistributionUI() {
        const statusEl = document.getElementById('betaLaunchStatus');
        const installBtn = document.getElementById('installAppBtn');
        if (statusEl) {
            statusEl.classList.remove('is-success', 'is-warning', 'is-neutral');
            const msg = this.getInstallStatusMessage();
            statusEl.textContent = msg;
            const info = this.getBuildInfo();
            if (info.standalone) statusEl.classList.add('is-success');
            else if (this.deferredInstallPrompt || /iphone|ipad|ipod/i.test(navigator.userAgent || '')) statusEl.classList.add('is-warning');
            else statusEl.classList.add('is-neutral');
        }
        if (installBtn) {
            const info = this.getBuildInfo();
            installBtn.disabled = info.standalone;
        }
    }

    buildBetaInviteText() {
        const info = this.getBuildInfo();
        const safeUrl = `${location.origin}${location.pathname}`;
        const messages = {
            it: `Kedrix beta privata. Non è una semplice budgeting app: è Decision Intelligence Finance. Se vuoi testarla, installala come app da qui: ${safeUrl}\n\nBuild: ${info.build}`,
            en: `Kedrix private beta. It is not a simple budgeting app: it is Decision Intelligence Finance. If you want to test it, install it as an app from here: ${safeUrl}\n\nBuild: ${info.build}`,
            es: `Kedrix beta privada. No es una simple app de presupuesto: es Decision Intelligence Finance. Si quieres probarla, instálala como app desde aquí: ${safeUrl}\n\nBuild: ${info.build}`,
            fr: `Kedrix bêta privée. Ce n'est pas une simple app de budget : c'est Decision Intelligence Finance. Si vous voulez la tester, installez-la comme app depuis ici : ${safeUrl}\n\nBuild : ${info.build}`
        };
        return messages[info.language] || messages.en;
    }

    async shareBetaInvite() {
        const text = this.buildBetaInviteText();
        const statusEl = document.getElementById('betaLaunchStatus');
        try {
            if (navigator.share) {
                await navigator.share({
                    title: 'Kedrix Beta',
                    text
                });
                if (statusEl) {
                    statusEl.className = 'beta-launch-status is-success';
                    statusEl.textContent = this.t('betaInviteShared');
                }
                return;
            }
            throw new Error('share-unavailable');
        } catch (error) {
            if (error && error.message === 'share-unavailable') {
                if (statusEl) {
                    statusEl.className = 'beta-launch-status is-warning';
                    statusEl.textContent = this.t('betaInviteUnavailable');
                }
                return;
            }
            if (error && error.name === 'AbortError') return;
            if (statusEl) {
                statusEl.className = 'beta-launch-status is-warning';
                statusEl.textContent = this.t('betaInviteError');
            }
        }
    }

    async copyBetaInvite() {
        const text = this.buildBetaInviteText();
        const statusEl = document.getElementById('betaLaunchStatus');
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const helper = document.createElement('textarea');
                helper.value = text;
                helper.style.position = 'fixed';
                helper.style.opacity = '0';
                document.body.appendChild(helper);
                helper.focus();
                helper.select();
                document.execCommand('copy');
                helper.remove();
            }
            if (statusEl) {
                statusEl.className = 'beta-launch-status is-success';
                statusEl.textContent = this.t('betaInviteCopied');
            }
        } catch (error) {
            if (statusEl) {
                statusEl.className = 'beta-launch-status is-warning';
                statusEl.textContent = this.t('betaInviteError');
            }
        }
    }

    async promptInstallApp() {
        const statusEl = document.getElementById('betaLaunchStatus');
        const info = this.getBuildInfo();
        if (info.standalone) {
            this.updateDistributionUI();
            return;
        }
        if (!this.deferredInstallPrompt) {
            this.updateDistributionUI();
            return;
        }
        try {
            this.deferredInstallPrompt.prompt();
            await this.deferredInstallPrompt.userChoice;
        } catch (error) {
            if (statusEl) {
                statusEl.className = 'beta-launch-status is-warning';
                statusEl.textContent = this.t('betaInviteError');
            }
        } finally {
            this.deferredInstallPrompt = null;
            this.updateDistributionUI();
        }
    }

    setupDistributionActions() {
        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            this.deferredInstallPrompt = event;
            this.updateDistributionUI();
        });

        window.addEventListener('appinstalled', () => {
            this.deferredInstallPrompt = null;
            this.updateDistributionUI();
        });

        const installBtn = document.getElementById('installAppBtn');
        if (installBtn) installBtn.addEventListener('click', () => this.promptInstallApp());

        const shareBtn = document.getElementById('shareBetaInviteBtn');
        if (shareBtn) shareBtn.addEventListener('click', () => this.shareBetaInvite());

        const copyBtn = document.getElementById('copyBetaInviteBtn');
        if (copyBtn) copyBtn.addEventListener('click', () => this.copyBetaInvite());

        this.updateDistributionUI();
    }

    updatePeriodInfo() {
        document.getElementById('periodInfo').textContent = ` ${this.t('period')}: ${this.data.periodStart} → ${this.getDisplayPeriodEnd()}`;
        
        const sourceEl = document.getElementById('periodSource');
        if (sourceEl) {
            if (this.data.incomes && this.data.incomes.length > 0) {
                const firstIncome = this.data.incomes.sort((a,b) => new Date(a.date) - new Date(b.date))[0];
                sourceEl.textContent = ' ' + this.t('periodStartedWith', { desc: firstIncome.desc, date: firstIncome.date });
            } else {
                sourceEl.textContent = '';
            }
        }
    }

    // ========== CALCOLI CON CONTROLLI ==========
    calculateTotalIncome() {
        if (!this.data.incomes || !Array.isArray(this.data.incomes)) return 0;
        // Somma solo le entrate nel periodo [periodStart, periodEnd]
        return this.data.incomes.reduce((sum, inc) => {
            const d = this.normalizeIsoDate(inc.date);
            if (!d || !this.isDateInPeriod(d)) return sum;
            return sum + (inc.amount || 0);
        }, 0);
    }

    calculateTotalVariableExpenses() {
        if (!this.data.variableExpenses || typeof this.data.variableExpenses !== 'object') return 0;
        let total = 0;
        Object.entries(this.data.variableExpenses).forEach(([date, day]) => {
            const d = this.normalizeIsoDate(date);
            if (!d || !this.isDateInPeriod(d)) return;
            if (Array.isArray(day)) {
                day.forEach(exp => total += (exp.amount || 0));
            }
        });
        return total;
    }

    calculateCategoryExpenses() {
        const totals = {};
        if (!this.data.variableExpenses || typeof this.data.variableExpenses !== 'object') return totals;

        Object.entries(this.data.variableExpenses).forEach(([date, day]) => {
            const d = this.normalizeIsoDate(date);
            if (!d || !this.isDateInPeriod(d)) return;
            if (!Array.isArray(day)) return;

            day.forEach(exp => {
                const rawCategory = typeof exp?.category === 'string' ? exp.category.trim() : '';
                const categoryPath = rawCategory
                    ? this.getExpenseCategoryPath(exp)
                    : (this.data.language === 'it' ? 'Senza categoria' : 'Uncategorized');
                const amount = Number(exp?.amount || 0);
                totals[categoryPath] = (totals[categoryPath] || 0) + amount;
            });
        });

        return totals;
    }

    calculateTotalFixedExpenses() {
        if (!this.data.fixedExpenses || !Array.isArray(this.data.fixedExpenses)) return 0;

        const start = new Date(this.normalizeIsoDate(this.data.periodStart));
        const end = new Date(this.normalizeIsoDate(this.data.periodEnd));
        if ([start, end].some(d => isNaN(d.getTime()))) return 0;

        // Scorre i mesi compresi nel periodo e include le scadenze che cadono nel periodo
        const months = [];
        const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
        const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
        while (cursor <= endMonth) {
            months.push({ y: cursor.getFullYear(), m: cursor.getMonth() });
            cursor.setMonth(cursor.getMonth() + 1);
        }

        let total = 0;

        for (const exp of this.data.fixedExpenses) {
            if (!exp || !exp.day) continue;

            const expEnd = exp.endDate ? new Date(this.normalizeIsoDate(exp.endDate)) : null;

            for (const mm of months) {
                const lastDay = new Date(mm.y, mm.m + 1, 0).getDate();
                const dueDay = Math.min(parseInt(exp.day, 10) || 1, lastDay);
                const dueDate = new Date(mm.y, mm.m, dueDay);

                if (dueDate < start || dueDate > end) continue;
                if (expEnd && dueDate > expEnd) continue;

                total += (exp.amount || 0);
            }
        }

        return total;
    }

    /**
     * Ritorna la lista "flat" delle spese variabili nel periodo corrente
     */
    getVariableExpensesInPeriodFlat() {
        const out = [];
        if (!this.data.variableExpenses || typeof this.data.variableExpenses !== 'object') return out;
        Object.entries(this.data.variableExpenses).forEach(([date, arr]) => {
            const d = this.normalizeIsoDate(date);
            if (!d || !this.isDateInPeriod(d)) return;
            if (Array.isArray(arr)) {
                arr.forEach(e => {
                    if (!e) return;
                    out.push({
                        id: e.id,
                        date: d,
                        name: (e.name || '').toString(),
                        category: e.category,
                        subCategory: (e.subCategory || '').toString(),
                        amount: Number(e.amount || 0)
                    });
                });
            }
        });
        return out;
    }

    /**
     * Ritorna tutte le spese variabili archiviate in formato flat.
     * Non tocca l'import: legge solo i movimenti già salvati.
     * Recovery STEP 1B:
     * - tollera shape miste ereditate da repo storiche (name / description / desc / label)
     * - garantisce sempre un id stabile runtime per il motore Fisse
     */
    getAllVariableExpensesFlat() {
        const out = [];
        if (!this.data.variableExpenses || typeof this.data.variableExpenses !== 'object') return out;

        Object.entries(this.data.variableExpenses).forEach(([date, arr]) => {
            const d = this.normalizeIsoDate(date);
            if (!d || !Array.isArray(arr)) return;
            arr.forEach((e, index) => {
                if (!e) return;

                const name = (
                    e.name
                    || e.description
                    || e.desc
                    || e.label
                    || e.title
                    || ''
                ).toString();

                const amount = Number(e.amount || 0);
                const runtimeId = e.id
                    ?? `${d}|${this.normalizeMatchText(name || 'spesa')}|${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}|${index}`;

                out.push({
                    id: runtimeId,
                    date: d,
                    name,
                    category: e.category,
                    subCategory: (e.subCategory || '').toString(),
                    amount
                });
            });
        });

        return out;
    }

    normalizeMatchText(s) {
        return (s || '')
            .toString()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    getMeaningfulMatchTokens(s) {
        const stop = new Set([
            'addebito','pagamento','pagam','pagato','carta','bancomat','banco','banca','bank','sdd','rid','sep','sepa',
            'bonifico','ordine','permanente','domiciliazione','utenza','conto','corrente','pag','trx','transazione',
            'direct','debit','visa','mastercard','mc','ddb','dd',
            'di','del','della','dello','dei','degli','da','per','con','su','il','lo','la','i','gli','le','un','una'
        ]);
        return this.normalizeMatchText(s)
            .split(' ')
            .filter(t => t && t.length >= 3 && !stop.has(t));
    }

    getSemanticMatchHints(s) {
        const norm = this.normalizeMatchText(s);
        const hints = new Set();
        if (!norm) return hints;

        const add = (...values) => values.forEach(v => hints.add(v));

        if (/paypal|paga in 3|rate|rata/.test(norm)) add('rateizzazione', 'rata', 'paypal');
        if (/mutuo/.test(norm)) add('mutuo');
        if (/affitto|locazione|canone/.test(norm)) add('affitto');
        if (/finanziament|prestito|compass|findomestic|agos/.test(norm)) add('finanziamento', 'rata');
        if (/mondoconvenienza|mondo convenienza|divano|sofa|mobil/.test(norm)) add('arredamento', 'rata');
        if (/utenz|luce|gas|acqua|telefono|internet|tim|vodafone|fastweb|eni|enel/.test(norm)) add('utenza');
        if (/assicuraz|polizza/.test(norm)) add('assicurazione');
        if (/condominio|amministraz|amm ne|amm\.ne/.test(norm)) add('condominio');
        if (/scuola|classi|iscrizione|corso/.test(norm)) add('scuola');

        return hints;
    }


    getFixedAliasKey(source) {
        const expId = source?.expId ?? source?.id ?? null;
        const name = (source?.name || '').toString().trim();
        const amount = Number(source?.amount || 0).toFixed(2);
        const day = Number(source?.sourceDay || source?.day || 0);
        return expId ? `id:${expId}` : `name:${this.normalizeMatchText(name)}|amount:${amount}|day:${day}`;
    }

    getFixedAliasesFor(source) {
        const key = this.getFixedAliasKey(source);
        const raw = this.data?.fixedMatchAliases?.[key];
        return Array.isArray(raw) ? raw.filter(Boolean) : [];
    }

    addFixedAlias(source, variableName) {
        const key = this.getFixedAliasKey(source);
        const alias = this.normalizeMatchText(variableName);
        if (!alias) return;
        if (!this.data.fixedMatchAliases || typeof this.data.fixedMatchAliases !== 'object') this.data.fixedMatchAliases = {};
        const current = Array.isArray(this.data.fixedMatchAliases[key]) ? this.data.fixedMatchAliases[key] : [];
        if (!current.includes(alias)) current.push(alias);
        this.data.fixedMatchAliases[key] = current.slice(-8);
    }

    hasStrongFixedTextEvidence(occ, variable) {
        const occNorm = this.normalizeMatchText(occ?.name || '');
        const varNorm = this.normalizeMatchText(variable?.name || '');
        const occTokens = this.getMeaningfulMatchTokens(occ?.name || '');
        const varTokens = this.getMeaningfulMatchTokens(variable?.name || '');
        const occHints = Array.from(this.getSemanticMatchHints(occ?.name || ''));
        const varHints = Array.from(this.getSemanticMatchHints(variable?.name || ''));

        if (occNorm && varNorm && (varNorm.includes(occNorm) || occNorm.includes(varNorm))) return true;
        if (occTokens.filter(t => varTokens.includes(t)).length >= 1) return true;
        if (occHints.filter(t => varHints.includes(t)).length >= 1) return true;
        return false;
    }

    getFixedManualMatchKey(occ) {
        return this.getFixedOccurrenceUiKey(occ);
    }

    persistFixedManualMatch(occ, variable) {
        if (!occ || !variable) return;
        if (!this.data.fixedManualMatches || typeof this.data.fixedManualMatches !== 'object') this.data.fixedManualMatches = {};
        this.data.fixedManualMatches[this.getFixedManualMatchKey(occ)] = {
            id: variable.id,
            date: this.normalizeIsoDate(variable.date || ''),
            name: (variable.name || '').toString(),
            amount: Number(variable.amount || 0)
        };
    }

    getPersistedFixedManualMatch(occ, vars) {
        const raw = this.data?.fixedManualMatches?.[this.getFixedManualMatchKey(occ)];
        if (!raw) return null;
        const allVars = Array.isArray(vars) ? vars : this.getAllVariableExpensesFlat();
        const byId = allVars.find(v => String(v?.id) === String(raw.id));
        if (byId) return byId;
        const rawDate = this.normalizeIsoDate(raw.date || '');
        const rawName = this.normalizeMatchText(raw.name || '');
        const rawAmount = Math.abs(Number(raw.amount || 0));
        return allVars.find(v => (
            this.normalizeIsoDate(v?.date || '') === rawDate &&
            this.normalizeMatchText(v?.name || '') === rawName &&
            Math.abs(Math.abs(Number(v?.amount || 0)) - rawAmount) <= 0.02
        )) || null;
    }

    getFixedDismissKey(source, variable) {
        return `${this.getFixedAliasKey(source)}::${variable?.id || this.normalizeMatchText(variable?.name || '')}::${this.normalizeIsoDate(variable?.date || '')}`;
    }

    isFixedSuggestionDismissed(source, variable) {
        const key = this.getFixedDismissKey(source, variable);
        return !!this.data?.fixedMatchDismissed?.[key];
    }

    dismissFixedSuggestion(source, variable) {
        const key = this.getFixedDismissKey(source, variable);
        if (!this.data.fixedMatchDismissed || typeof this.data.fixedMatchDismissed !== 'object') this.data.fixedMatchDismissed = {};
        this.data.fixedMatchDismissed[key] = true;
    }

    getFixedOccurrenceUiKey(occ) {
        return `${occ?.expId ?? 'x'}|${this.normalizeIsoDate(occ?.dueDate || '')}|${Number(occ?.amount || 0).toFixed(2)}`;
    }

    getManualFixedMatchSuggestions() {
        const occs = Array.isArray(this.getFixedOccurrencesInPeriod?.()) ? this.getFixedOccurrencesInPeriod() : [];
        const vars = this.getAllVariableExpensesFlat();
        const paidIds = new Set(occs.filter(o => o?.paid && o?.match?.id).map(o => o.match.id));
        const suggestions = {};

        for (const occ of occs) {
            if (!occ || occ.paid) continue;
            const occDate = new Date(this.normalizeIsoDate(occ.dueDate));
            if (isNaN(occDate.getTime())) continue;

            const ranked = vars
                .filter(v => v && !paidIds.has(v.id) && !this.isFixedSuggestionDismissed(occ, v))
                .map(v => {
                    const vDate = new Date(this.normalizeIsoDate(v.date));
                    const diffDays = isNaN(vDate.getTime()) ? Infinity : Math.abs((vDate - occDate) / 86400000);
                    const amountDiff = Math.abs(Math.abs(Number(v.amount || 0)) - Math.abs(Number(occ.amount || 0)));
                    return { v, diffDays, amountDiff, score: this.scoreFixedVariableMatch(occ, v) };
                })
                .filter(x => x.amountDiff <= 0.02 && x.diffDays <= 3)
                .sort((a, b) => (a.diffDays - b.diffDays) || (a.amountDiff - b.amountDiff) || ((b.score || 0) - (a.score || 0)));

            if (this.getPersistedFixedManualMatch(occ, vars)) continue;
            if (ranked.length !== 1) continue;
            const candidate = ranked[0];
            const strongEvidence = this.hasStrongFixedTextEvidence(occ, candidate.v);
            if ((candidate.score || 0) >= 55 && strongEvidence) continue;

            suggestions[this.getFixedOccurrenceUiKey(occ)] = candidate.v;
        }

        return suggestions;
    }

    confirmFixedManualMatch(payload) {
        const occ = payload?.occ;
        const variable = payload?.variable;
        if (!occ || !variable) return;
        this.addFixedAlias(occ, variable.name || '');
        this.persistFixedManualMatch(occ, variable);
        this.saveData();
        this.updateUI();
        this.showToast('✅ Equivalenza spesa fissa confermata', 'success');
    }

    rejectFixedManualMatch(payload) {
        const occ = payload?.occ;
        const variable = payload?.variable;
        if (!occ || !variable) return;
        this.dismissFixedSuggestion(occ, variable);
        this.saveData();
        this.updateUI();
        this.showToast('👌 Suggerimento ignorato', 'info');
    }

    scoreFixedVariableMatch(occ, variable) {
        const occDate = new Date(this.normalizeIsoDate(occ.dueDate));
        const varDate = new Date(this.normalizeIsoDate(variable.date));
        if (isNaN(occDate.getTime()) || isNaN(varDate.getTime())) return -Infinity;

        const occAmount = Math.abs(Number(occ.amount || 0));
        const varAmount = Math.abs(Number(variable.amount || 0));
        const amountDiff = Math.abs(varAmount - occAmount);
        if (amountDiff > 0.05) return -Infinity;

        const diffDays = Math.abs((varDate - occDate) / (1000 * 60 * 60 * 24));
        if (diffDays > 7) return -Infinity;

        const occNorm = this.normalizeMatchText(occ.name);
        const varNorm = this.normalizeMatchText(variable.name);
        const aliases = this.getFixedAliasesFor(occ);
        const occTokens = this.getMeaningfulMatchTokens(occ.name);
        const varTokens = this.getMeaningfulMatchTokens(variable.name);
        const occHints = Array.from(this.getSemanticMatchHints(occ.name));
        const varHints = Array.from(this.getSemanticMatchHints(variable.name));

        let score = 0;
        score += Math.max(0, 40 - (diffDays * 5));
        score += Math.max(0, 30 - (amountDiff * 100));

        if (diffDays <= 3) score += 12;
        if (diffDays <= 1) score += 10;
        if (amountDiff <= 0.02) score += 12;

        if (occNorm && varNorm) {
            if (varNorm.includes(occNorm) || occNorm.includes(varNorm)) score += 35;
        }

        if (aliases.length && varNorm) {
            const aliasHit = aliases.some(a => a && (varNorm.includes(a) || a.includes(varNorm)));
            if (aliasHit) score += 90;
        }

        const overlap = occTokens.filter(t => varTokens.includes(t)).length;
        score += overlap * 18;

        const semanticOverlap = occHints.filter(t => varHints.includes(t)).length;
        score += semanticOverlap * 22;

        const sameMonth = occDate.getFullYear() === varDate.getFullYear() && occDate.getMonth() === varDate.getMonth();
        if (sameMonth) score += 10;

        if (!varNorm && !aliases.length) score -= 20;

        return score;
    }

    /**
     * Verifica se una spesa variabile corrisponde ad una scadenza fissa (per non conteggiarla 2 volte).
     * Legge i movimenti già salvati e usa un matching prudente ma più realistico:
     * - importo compatibile
     * - data entro +/- 7 giorni
     * - punteggio per similarità nome/descrizione
     * - fallback consentito solo se esiste un candidato unico molto vicino
     */
    matchFixedOccurrenceToVariable(occ, vars, consumedIds) {
    // FIXED MATCH ENGINE — hardening boundary
    // Source of truth for fixed-vs-variable recognition.
    // Keep this isolated from Home rendering so the Fixed tab remains autonomous.

        const consumed = consumedIds instanceof Set ? consumedIds : new Set();

        const ranked = (vars || [])
            .filter(v => v && !consumed.has(v.id))
            .map(v => ({ v, score: this.scoreFixedVariableMatch(occ, v) }))
            .filter(x => Number.isFinite(x.score) && x.score > -Infinity)
            .sort((a, b) => b.score - a.score);

        if (ranked.length === 0) return null;

        const best = ranked[0];
        const second = ranked[1] || null;

        const occDate = new Date(this.normalizeIsoDate(occ?.dueDate));
        const strictCandidates = ranked.filter(({ v, score }) => {
            const varDate = new Date(this.normalizeIsoDate(v?.date));
            if (isNaN(occDate.getTime()) || isNaN(varDate.getTime())) return false;
            const diffDays = Math.abs((varDate - occDate) / (1000 * 60 * 60 * 24));
            const amountDiff = Math.abs(Math.abs(Number(v?.amount || 0)) - Math.abs(Number(occ?.amount || 0)));
            return diffDays <= 3 && amountDiff <= 0.02 && Number.isFinite(score);
        });

        if (strictCandidates.length >= 1) {
            const strictBest = strictCandidates[0];
            const strictSecond = strictCandidates[1] || null;
            const strictScore = Number(strictBest?.score || -Infinity);
            const strictMargin = strictSecond ? (strictScore - Number(strictSecond.score || -Infinity)) : Infinity;
            if (strictScore >= 62 && strictMargin >= 8 && this.hasStrongFixedTextEvidence(occ, strictBest?.v || null)) {
                return strictBest.v;
            }
        }

        if (best.score >= 55 && (!second || (best.score - second.score) >= 8) && this.hasStrongFixedTextEvidence(occ, best.v)) return best.v;
        if (!second && best.score >= 38 && this.hasStrongFixedTextEvidence(occ, best.v)) return best.v;
        if (best.score >= 72 && this.hasStrongFixedTextEvidence(occ, best.v)) return best.v;
        return null;
    }

    /**
     * Calcola il totale delle spese fisse NON già presenti tra le variabili importate/inserite nel periodo.
     * Evita il doppio conteggio: una fissa pagata (presente nel file banca) resta tra le variabili,
     * e viene esclusa dal "forecast" delle fisse.
     */
    calculateTotalFixedExpensesUnpaid() {
        if (!this.data.fixedExpenses || !Array.isArray(this.data.fixedExpenses)) return 0;

        const start = new Date(this.normalizeIsoDate(this.data.periodStart));
        const end = new Date(this.normalizeIsoDate(this.data.periodEnd));
        if ([start, end].some(d => isNaN(d.getTime()))) return 0;

        // mesi nel periodo
        const months = [];
        const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
        const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
        while (cursor <= endMonth) {
            months.push({ y: cursor.getFullYear(), m: cursor.getMonth() });
            cursor.setMonth(cursor.getMonth() + 1);
        }

        const vars = this.getAllVariableExpensesFlat();
        const consumed = new Set();

        let total = 0;

        for (const exp of this.data.fixedExpenses) {
            if (!exp || !exp.day) continue;

            const expEnd = exp.endDate ? new Date(this.normalizeIsoDate(exp.endDate)) : null;

            for (const mm of months) {
                const lastDay = new Date(mm.y, mm.m + 1, 0).getDate();
                const dueDay = Math.min(parseInt(exp.day, 10) || 1, lastDay);
                const dueDate = new Date(mm.y, mm.m, dueDay);

                if (dueDate < start || dueDate > end) continue;
                if (expEnd && dueDate > expEnd) continue;

                const occ = { expId: exp.id ?? null, sourceDay: Number(exp.day || 0), name: exp.name, amount: exp.amount, dueDate: this.formatLocalDate(dueDate) };
                const match = this.getPersistedFixedManualMatch(occ, vars) || this.matchFixedOccurrenceToVariable(occ, vars, consumed);

                if (match) {
                    consumed.add(match.id);
                    // già pagata/registrata: NON la sommiamo nelle fisse
                } else {
                    total += (exp.amount || 0);
                }
            }
        }

        return total;
    }

/**
 * Ritorna le occorrenze delle spese fisse nel periodo corrente, marcate come
 * "Pagata" se trovate tra le spese variabili (estratto conto) con match prudente.
 * Regola periodo: start <= data <= end
 *
 * @returns {Array<{name:string, amount:number, dueDate:string, paid:boolean, match?:{id:string,date:string,name:string,amount:number}}>}
 */
getFixedOccurrencesInPeriod() {
    if (!this.data.fixedExpenses || !Array.isArray(this.data.fixedExpenses)) return [];

    const periodStartIso = this.normalizeIsoDate(this.data.periodStart || '');
    const periodEndIso = this.normalizeIsoDate(this.data.periodEnd || '');
    const start = new Date(periodStartIso);
    const end = new Date(periodEndIso);
    if ([start, end].some(d => isNaN(d.getTime()))) return [];

    // mesi nel periodo
    const months = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= endMonth) {
        months.push({ y: cursor.getFullYear(), m: cursor.getMonth() });
        cursor.setMonth(cursor.getMonth() + 1);
    }

    const vars = this.getAllVariableExpensesFlat();
    const consumed = new Set();

    const occs = [];

    // Recovery STEP 1A:
    // riallinea sempre lo stato runtime delle fisse nel periodo corrente.
    // Non tocca l'import e recupera campi storici persi in alcune repo:
    // exp.isPaid / exp.paid / exp.status / exp.match / exp.currentDueDate
    this.data.fixedExpenses.forEach(exp => {
        if (!exp) return;
        exp.isPaid = false;
        exp.paid = false;
        exp.status = 'planned';
        exp.match = null;
        exp.currentDueDate = '';
    });

    for (const exp of this.data.fixedExpenses) {
        if (!exp || !exp.day) continue;
        const expEndIso = this.normalizeIsoDate(exp.endDate || '');
        const expEnd = expEndIso ? new Date(expEndIso) : null;
        const futureAfterPeriod = this.getNextFixedOccurrenceAfterPeriod?.(exp, 6);
        const futureDueIso = this.normalizeIsoDate(futureAfterPeriod?.dueDate || '');
        const suppressCurrentPeriodOccurrence = !!(expEndIso && periodEndIso && futureDueIso && expEndIso === futureDueIso && expEndIso > periodEndIso);
        if (suppressCurrentPeriodOccurrence) {
            exp.currentDueDate = '';
            continue;
        }

        for (const mm of months) {
            const lastDay = new Date(mm.y, mm.m + 1, 0).getDate();
            const dueDay = Math.min(parseInt(exp.day, 10) || 1, lastDay);
            const dueDateObj = new Date(mm.y, mm.m, dueDay);

            if (dueDateObj < start || dueDateObj > end) continue;
            if (expEnd && dueDateObj > expEnd) continue;

            const dueDate = this.formatLocalDate(dueDateObj);
            const occ = { expId: exp.id ?? null, sourceDay: Number(exp.day || 0), name: exp.name, amount: exp.amount, dueDate };
            const persistedMatch = this.getPersistedFixedManualMatch(occ, vars);
            const match = persistedMatch || this.matchFixedOccurrenceToVariable(occ, vars, consumed);
            const matchPayload = match ? { id: match.id, date: match.date, name: match.name, amount: match.amount } : null;

            exp.currentDueDate = dueDate;
            if (match) {
                consumed.add(match.id);
                exp.isPaid = true;
                exp.paid = true;
                exp.status = 'paid';
                exp.match = matchPayload;
            }

            occs.push({
                expId: exp.id ?? null,
                sourceDay: Number(exp.day || 0),
                sourceEndDate: exp.endDate || '',
                name: (exp.name || '').toString(),
                amount: Number(exp.amount || 0),
                dueDate,
                paid: !!match,
                match: matchPayload
            });
        }
    }

    // sort per data, poi per nome
    occs.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || (a.name || '').localeCompare(b.name || ''));
    return occs;
}


getFixedEngineSnapshot() {
    const occs = Array.isArray(this.getFixedOccurrencesInPeriod?.()) ? this.getFixedOccurrencesInPeriod() : [];
    const totalCount = occs.length;
    const paidCount = occs.filter(o => !!o?.paid).length;
    const unpaidCount = Math.max(0, totalCount - paidCount);
    const totalAmount = occs.reduce((sum, o) => sum + Number(o?.amount || 0), 0);
    const paidAmount = occs.filter(o => !!o?.paid).reduce((sum, o) => sum + Number(o?.amount || 0), 0);
    const unpaidAmount = Math.max(0, totalAmount - paidAmount);
    return {
        occs,
        totalCount,
        paidCount,
        unpaidCount,
        totalAmount,
        paidAmount,
        unpaidAmount
    };
}

getFixedHomeSummary() {
    return this.getFixedEngineSnapshot();
}

getFixedTabSummary() {
    return this.getFixedEngineSnapshot();
}

getVariableTabSummary() {
    const items = Array.isArray(this.getVariableExpensesInPeriodFlat?.()) ? this.getVariableExpensesInPeriodFlat() : [];
    const totalCount = items.length;
    const totalAmount = items.reduce((sum, item) => sum + Number(item?.amount || 0), 0);
    const averageAmount = totalCount > 0 ? (totalAmount / totalCount) : 0;
    return {
        totalCount,
        totalAmount,
        averageAmount
    };
}

updateFixedStatusHome() {
    const listEl = document.getElementById('fixedStatusHomeList');
    const badgeEl = document.getElementById('fixedStatusHomeBadge');
    if (!listEl) return;

    const esc = (s) => (s ?? '').toString()
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const summary = this.getFixedHomeSummary();
    const occs = summary.occs;
    if (badgeEl) {
        badgeEl.textContent = `${summary.paidCount} ${this.t('fixedSummaryPaidLabel').toLowerCase()} • ${summary.unpaidCount} ${this.t('fixedSummaryDueLabel').toLowerCase()}`;
        badgeEl.title = `${this.t('fixedSummaryTotalLabel')} ${this.formatCurrency(summary.totalAmount)} • ${this.t('fixedSummaryPaidLabel').toLowerCase()} ${this.formatCurrency(summary.paidAmount)} • ${this.t('fixedSummaryDueLabel').toLowerCase()} ${this.formatCurrency(summary.unpaidAmount)}`;
    }
    if (!occs || occs.length === 0) {
        listEl.innerHTML = `<p class="chart-note">${this.t('noFixedInPeriod')}</p>`;
        return;
    }

    const fmtDate = (iso) => {
        try {
            const d = new Date(this.normalizeIsoDate(iso));
            if (isNaN(d.getTime())) return iso;
            return d.toLocaleDateString(LOCALE_MAP[this.data.language] || 'en-GB', { day: '2-digit', month: '2-digit' });
        } catch {
            return iso;
        }
    };

    listEl.innerHTML = occs.map(o => {
        const statusTxt = o.paid ? this.t('fixedPaid') : this.t('fixedPlanned');
        const pillClass = o.paid ? 'fixed-pill paid' : 'fixed-pill due';
        const matchTxt = (o.paid && o.match) ? `${this.t('fixedFound')}: ${fmtDate(o.match.date)} • ${(o.match.name || '')}` : '';

        return `
            <div class="fixed-status-row">
                <div class="fixed-status-left">
                    <div class="fixed-status-name" title="${esc(o.name)}">${esc(o.name)}</div>
                    <div class="fixed-status-sub">${this.t('fixedDue')}: ${fmtDate(o.dueDate)}</div>
                </div>
                <div class="fixed-status-right">
                    <div class="fixed-status-amount">${this.formatCurrency(o.amount)}</div>
                    <div class="${pillClass}">${statusTxt}</div>
                    ${matchTxt ? `<div class="fixed-match" title="${esc(matchTxt)}">${esc(matchTxt)}</div>` : ''}
                </div>
            </div>
        `;
    }).join('') + `</div>`;
}



    clampWiseScoreValue(value, min = 0, max = 100) {
        const n = Number(value);
        if (!Number.isFinite(n)) return min;
        return Math.max(min, Math.min(max, n));
    }

    calculateWiseScoreData() {
        const income = Number(this.calculateTotalIncome() || 0);
        const fixedTotal = Number(this.calculateTotalFixedExpenses() || 0);
        const variableTotal = Number(this.calculateTotalVariableExpenses() || 0);
        const unpaidFixed = Number(this.calculateTotalFixedExpensesUnpaid() || 0);
        const plannedSavings = Number(this.calculatePlannedSavings() || 0);
        const remaining = Number(this.calculateRemaining() || 0);
        const savingsPot = Number(this.data.savingsPot || 0);
        const projectedSavingsEnd = Number(this.calculateProjectedSavingsEnd() || 0);

        const start = new Date(this.normalizeIsoDate(this.data.periodStart));
        const end = new Date(this.normalizeIsoDate(this.data.periodEnd));
        const now = new Date();

        const periodDaysRaw = (end - start) / (1000 * 60 * 60 * 24);
        const elapsedDaysRaw = (now - start) / (1000 * 60 * 60 * 24);

        const periodDays = Math.max(1, Math.ceil(periodDaysRaw));
        const elapsedRatio = this.clampWiseScoreValue(elapsedDaysRaw / periodDays, 0, 1);

        const fixedOperational = unpaidFixed;

        if (income <= 0) {
            return {
                score: 0,
                pillars: {
                    stability: 0,
                    discipline: 0,
                    resilience: 0
                },
                status: this.uiText('wiseStatusNoData'),
                meta: this.uiText('wiseNoDataMeta'),
                inputs: {
                    income,
                    fixedTotal,
                    fixedOperational,
                    variableTotal,
                    unpaidFixed,
                    plannedSavings,
                    remaining,
                    savingsPot,
                    projectedSavingsEnd
                }
            };
        }
        const availableBudget = Math.max(1, income - fixedOperational - plannedSavings);
        const expectedVariableByNow = Math.max(1, availableBudget * elapsedRatio);

        const fixedBurdenRatio = fixedTotal / Math.max(1, income);
        const remainingRatio = remaining / Math.max(1, income);
        const paceRatio = variableTotal / expectedVariableByNow;
        const cushionBase = Math.max(1, fixedTotal + Math.max(variableTotal, availableBudget * 0.35));
        const resilienceRatio = (Math.max(0, savingsPot) + Math.max(0, remaining)) / cushionBase;

        const stability =
            (
                this.clampWiseScoreValue((1 - fixedBurdenRatio) * 100) * 0.45 +
                this.clampWiseScoreValue((remainingRatio + 0.30) * 100) * 0.55
            );

        let discipline = 100;
        if (paceRatio > 1) {
            discipline -= Math.min(55, (paceRatio - 1) * 85);
        } else {
            discipline += Math.min(10, (1 - paceRatio) * 20);
        }
        if (variableTotal > availableBudget) {
            discipline -= Math.min(35, ((variableTotal - availableBudget) / Math.max(1, availableBudget)) * 100);
        }
        discipline = this.clampWiseScoreValue(discipline);

        const resilience =
            (
                this.clampWiseScoreValue(resilienceRatio * 100) * 0.70 +
                this.clampWiseScoreValue((projectedSavingsEnd / Math.max(1, income)) * 100) * 0.30
            );

        const score = Math.round(
            this.clampWiseScoreValue(
                stability * 0.40 +
                discipline * 0.35 +
                resilience * 0.25
            )
        );

        let status = this.uiText('wiseStatusConsolidate');
        if (score >= 80) status = this.uiText('wiseStatusVerySolid');
        else if (score >= 65) status = this.uiText('wiseStatusGoodBalance');
        else if (score >= 50) status = this.uiText('wiseStatusUnderControl');
        else if (score >= 35) status = this.uiText('wiseStatusAttention');

        const metaParts = [];
        metaParts.push(`${this.uiText('wiseMetaIncome')}: ${this.formatCurrency(income)}`);
        metaParts.push(`${this.uiText('wiseMetaFixed')}: ${this.formatCurrency(fixedTotal)}`);
        metaParts.push(`${this.uiText('wiseMetaVariable')}: ${this.formatCurrency(variableTotal)}`);
        metaParts.push(`${this.uiText('wiseMetaRemaining')}: ${this.formatCurrency(remaining)}`);

        return {
            score,
            pillars: {
                stability: Math.round(this.clampWiseScoreValue(stability)),
                discipline: Math.round(this.clampWiseScoreValue(discipline)),
                resilience: Math.round(this.clampWiseScoreValue(resilience))
            },
            status,
            meta: metaParts.join(' • '),
            inputs: {
                income,
                fixedTotal,
                variableTotal,
                unpaidFixed,
                plannedSavings,
                remaining,
                savingsPot,
                projectedSavingsEnd
            }
        };
    }

    formatFooterPeriodRange() {
        const locale = LOCALE_MAP[this.data.language] || 'it-IT';
        const toShort = (value) => {
            const iso = this.normalizeIsoDate(value || '');
            if (!iso) return '—';
            const d = new Date(iso);
            if (isNaN(d.getTime())) return value || '—';
            return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
        };
        return `${toShort(this.data.periodStart)} → ${toShort(this.getDisplayPeriodEnd?.() || this.data.periodEnd)}`;
    }

    updateFooterPeriodState() {
        const periodRangeEl = document.getElementById('footerPeriodRange');
        const daysEl = document.getElementById('footerPeriodDays');
        const budgetEl = document.getElementById('footerPeriodBudget');
        const noteEl = document.getElementById('footerFeatures');

        if (periodRangeEl) periodRangeEl.textContent = this.formatFooterPeriodRange();
        if (daysEl) daysEl.textContent = `${this.getDaysLeft()}`;
        if (budgetEl) budgetEl.textContent = this.formatCurrency(this.calculateDecisionDailyBudget());
        if (noteEl) noteEl.textContent = this.t('footerFeatures');
    }

    updateWiseScoreHome() {
        const valueEl = document.getElementById('wiseScoreValue');
        const statusEl = document.getElementById('wiseScoreStatus');
        const metaEl = document.getElementById('wiseScoreMeta');

        const stabilityValueEl = document.getElementById('pillarStabilityValue');
        const disciplineValueEl = document.getElementById('pillarDisciplineValue');
        const resilienceValueEl = document.getElementById('pillarResilienceValue');

        const stabilityFillEl = document.getElementById('pillarStabilityFill');
        const disciplineFillEl = document.getElementById('pillarDisciplineFill');
        const resilienceFillEl = document.getElementById('pillarResilienceFill');

        if (!valueEl || !statusEl || !metaEl) return;

        if (this.isZeroDataState && this.isZeroDataState()) {
            valueEl.textContent = '—';
            statusEl.textContent = this.t('scoreIdleStatus');
            metaEl.textContent = this.t('scoreIdleMeta');
            if (stabilityValueEl) stabilityValueEl.textContent = '—';
            if (disciplineValueEl) disciplineValueEl.textContent = '—';
            if (resilienceValueEl) resilienceValueEl.textContent = '—';
            if (stabilityFillEl) stabilityFillEl.style.width = '0%';
            if (disciplineFillEl) disciplineFillEl.style.width = '0%';
            if (resilienceFillEl) resilienceFillEl.style.width = '0%';
            return;
        }

        const wise = this.calculateWiseScoreData();

        valueEl.textContent = wise.score;
        statusEl.textContent = `${this.t('wiseScoreStatusPrefix')}: ${wise.status}`;
        const fixedMeta = '';
        metaEl.textContent = `${wise.meta}${fixedMeta}`;

        if (stabilityValueEl) stabilityValueEl.textContent = `${wise.pillars.stability}/100`;
        if (disciplineValueEl) disciplineValueEl.textContent = `${wise.pillars.discipline}/100`;
        if (resilienceValueEl) resilienceValueEl.textContent = `${wise.pillars.resilience}/100`;

        if (stabilityFillEl) stabilityFillEl.style.width = `${wise.pillars.stability}%`;
        if (disciplineFillEl) disciplineFillEl.style.width = `${wise.pillars.discipline}%`;
        if (resilienceFillEl) resilienceFillEl.style.width = `${wise.pillars.resilience}%`;
    }


    calculateWiseForecastData() {
        const totalVariable = Number(this.calculateTotalVariableExpenses() || 0);
        const currentRemaining = Number(this.calculateRemaining() || 0);
        const fixedResidualInPeriod = Number(this.getFixedEngineSnapshot?.().unpaidAmount || 0);
        const daysLeft = Math.max(0, Number(this.getDaysLeft() || 0));
        const start = new Date(this.normalizeIsoDate(this.data.periodStart));
        const end = new Date(this.normalizeIsoDate(this.data.periodEnd));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const msPerDay = 1000 * 60 * 60 * 24;
        const periodDays = (!isNaN(start.getTime()) && !isNaN(end.getTime())) ? Math.max(1, Math.floor((end - start) / msPerDay) + 1) : 1;
        const elapsedDays = !isNaN(start.getTime()) ? Math.max(1, Math.min(periodDays, Math.floor((today - start) / msPerDay) + 1)) : 1;
        const forecastStabilityFloor = 7;
        const stabilizedDays = Math.max(elapsedDays, forecastStabilityFloor);
        const hasVariableHistory = totalVariable > 0.009;
        const avgVariablePerDay = hasVariableHistory && stabilizedDays > 0 ? totalVariable / stabilizedDays : null;
        const projectedVariableRemaining = avgVariablePerDay === null ? 0 : avgVariablePerDay * daysLeft;
        // currentRemaining usa già calculateTotalFixedExpensesUnpaid(), quindi le fisse residue
        // del periodo sono già incluse nella rimanenza attuale e non vanno sottratte di nuovo.
        const projectedEndBalance = currentRemaining - projectedVariableRemaining;
        let toneKey = 'wiseForecastNeutral';
        if (projectedEndBalance > 0.009) toneKey = 'wiseForecastPositive';
        else if (projectedEndBalance < -0.009) toneKey = 'wiseForecastNegative';
        return {
            totalVariable,
            currentRemaining,
            fixedResidualInPeriod,
            daysLeft,
            elapsedDays,
            avgVariablePerDay,
            projectedVariableRemaining,
            projectedEndBalance,
            toneKey,
            hasVariableHistory,
            forecastStabilityFloor
        };
    }

    getForecastRiskDayMessage(forecast) {
        const avgDaily = Number(forecast?.avgVariablePerDay || 0);
        const remaining = Number(forecast?.currentRemaining || 0);
        const locale = LOCALE_MAP[this.data.language] || 'it-IT';

        if (remaining <= -0.009) {
            return {
                tone: 'negative',
                text: this.t('wiseForecastRiskDayAlreadyDeficit')
            };
        }

        if (forecast?.projectedEndBalance >= -0.009 || avgDaily <= 0) {
            return {
                tone: 'positive',
                text: this.t('wiseForecastRiskDayPositive')
            };
        }

        const riskDate = new Date();
        riskDate.setHours(0, 0, 0, 0);
        const riskOffsetDays = Math.max(0, Math.floor(remaining / avgDaily) + 1);
        riskDate.setDate(riskDate.getDate() + riskOffsetDays);

        return {
            tone: 'negative',
            text: this.t('wiseForecastRiskDayNegative', {
                date: riskDate.toLocaleDateString(locale, { day: 'numeric', month: 'long' })
            })
        };
    }

    getForecastSafeDaysMessage(forecast) {
        const avgDaily = Number(forecast?.avgVariablePerDay || 0);
        const remaining = Number(forecast?.currentRemaining || 0);
        const daysLeft = Math.max(0, Number(forecast?.daysLeft || 0));

        if (remaining <= -0.009) {
            return {
                tone: 'negative',
                text: this.t('wiseForecastSafeDaysNoCoverage')
            };
        }

        if (daysLeft <= 0 || avgDaily <= 0) {
            return {
                tone: 'positive',
                text: this.t('wiseForecastSafeDaysPositive')
            };
        }

        const safeDays = Math.max(0, Math.floor(remaining / avgDaily));
        if (safeDays >= daysLeft || forecast?.projectedEndBalance >= -0.009) {
            return {
                tone: 'positive',
                text: this.t('wiseForecastSafeDaysPositive')
            };
        }

        return {
            tone: 'negative',
            text: this.t('wiseForecastSafeDaysNegative', {
                days: Math.max(0, safeDays)
            })
        };
    }

    getSafeToSpendData(forecast) {
        const currentRemaining = Math.max(0, Number(forecast?.currentRemaining || 0));
        const daysLeft = Math.max(0, Number(forecast?.daysLeft || 0));
        const projectedEndBalance = Number(forecast?.projectedEndBalance || 0);
        const dailyBudget = Math.max(0, Number(this.calculateDailyBudget() || 0));

        // La "spesa sicura oggi" non deve mai mostrare tutta la rimanenza del periodo.
        // Usa il budget giornaliero già esistente come tetto decisionale conservativo.
        const ceiling = daysLeft > 0
            ? Math.max(0, Math.min(currentRemaining, dailyBudget, projectedEndBalance > 0 ? projectedEndBalance : 0))
            : currentRemaining;

        return {
            amount: ceiling,
            positive: ceiling > 0.009,
            text: ceiling > 0.009
                ? this.t('safeToSpendPositive', { amount: this.formatCurrency(ceiling) })
                : this.t('safeToSpendNegative')
        };
    }

    parseForecastSimulationAmount(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : 0;
        const cleaned = String(value || '')
            .replace(/\s+/g, '')
            .replace(/€/g, '')
            .replace(/\.(?=\d{3}(?:\D|$))/g, '')
            .replace(',', '.')
            .replace(/[^0-9.-]/g, '');
        const amount = Number(cleaned);
        return Number.isFinite(amount) ? Math.max(0, amount) : 0;
    }

    getForecastSimulatorPreview(forecast) {
        const inputEl = document.getElementById('forecastSimulatorInput');
        const rawValue = typeof this._forecastSimulatorRaw === 'string'
            ? this._forecastSimulatorRaw
            : (inputEl ? inputEl.value : '');
        const amount = this.parseForecastSimulationAmount(rawValue);
        const daysLeft = Math.max(0, Number(forecast?.daysLeft || 0));
        const currentRemaining = Number(forecast?.currentRemaining || 0);
        const currentProjectedEnd = Number(forecast?.projectedEndBalance || 0);
        if (amount <= 0) {
            return { active: false, amount: 0, projectedEndBalance: currentProjectedEnd, dailyBudget: this.calculateDailyBudget() };
        }
        const simulatedRemaining = currentRemaining - amount;
        const dailyBudget = daysLeft > 0 ? (simulatedRemaining / daysLeft) : simulatedRemaining;
        return {
            active: true,
            amount,
            projectedEndBalance: currentProjectedEnd - amount,
            dailyBudget
        };
    }

    getTodayVariableSpend() {
        const todayIso = new Date().toISOString().split('T')[0];
        const items = this.data?.variableExpenses && Array.isArray(this.data.variableExpenses[todayIso])
            ? this.data.variableExpenses[todayIso]
            : [];
        return items.reduce((sum, exp) => sum + Number(exp?.amount || 0), 0);
    }

    getDailyCheckInData(forecast) {
        const projectedEndBalance = Number(forecast?.projectedEndBalance || 0);
        const avgDaily = Math.max(0, Number(forecast?.avgVariablePerDay || 0));
        const todaySpend = Math.max(0, this.getTodayVariableSpend());
        const totalIncome = Math.max(0, Number(this.calculateTotalIncome() || 0));
        const totalVariable = Math.max(0, Number(this.calculateTotalVariableExpenses() || 0));

        if (totalIncome <= 0 && totalVariable <= 0) {
            return { tone: 'neutral', text: this.t('dailyCheckInWaiting') };
        }

        if (projectedEndBalance < -0.009) {
            return {
                tone: 'negative',
                text: this.t('dailyCheckInNegative', { forecast: this.formatCurrency(projectedEndBalance) })
            };
        }

        if (todaySpend <= 0.009) {
            return { tone: 'positive', text: this.t('dailyCheckInNoSpend') };
        }

        if (avgDaily <= 0.009) {
            return { tone: 'neutral', text: this.t('dailyCheckInNeutral') };
        }

        const diff = todaySpend - avgDaily;
        if (diff > 0.01) {
            return {
                tone: diff > avgDaily * 0.2 ? 'negative' : 'warning',
                text: this.t('dailyCheckInWarning', {
                    amount: this.formatCurrency(diff),
                    forecast: this.formatCurrency(projectedEndBalance)
                })
            };
        }

        if (diff < -0.01) {
            return {
                tone: 'positive',
                text: this.t('dailyCheckInPositive', { amount: this.formatCurrency(Math.abs(diff)) })
            };
        }

        return { tone: 'neutral', text: this.t('dailyCheckInNeutral') };
    }

    updateWiseForecastHome() {
        const forecast = this.calculateWiseForecastData();
        const titleEl = document.getElementById('wiseForecastTitle');
        const subtitleEl = document.getElementById('wiseForecastSubtitle');
        const endLabelEl = document.getElementById('wiseForecastEndLabel');
        const avgLabelEl = document.getElementById('wiseForecastAvgLabel');
        const valueEl = document.getElementById('wiseForecastValue');
        const avgEl = document.getElementById('wiseForecastAvgValue');
        const statusEl = document.getElementById('wiseForecastStatus');
        const remainingLabelEl = document.getElementById('wiseForecastRemainingLabel');
        const remainingValueEl = document.getElementById('wiseForecastRemainingValue');
        const fixedResidualLabelEl = document.getElementById('wiseForecastFixedResidualLabel');
        const fixedResidualValueEl = document.getElementById('wiseForecastFixedResidualValue');
        const variableProjectionLabelEl = document.getElementById('wiseForecastVariableProjectionLabel');
        const variableProjectionValueEl = document.getElementById('wiseForecastVariableProjectionValue');
        const riskDayLabelEl = document.getElementById('wiseForecastRiskDayLabel');
        const riskDayValueEl = document.getElementById('wiseForecastRiskDayValue');
        const safeDaysLabelEl = document.getElementById('wiseForecastSafeDaysLabel');
        const safeDaysValueEl = document.getElementById('wiseForecastSafeDaysValue');
        const safeToSpendLabelEl = document.getElementById('safeToSpendLabel');
        const safeToSpendHintEl = document.getElementById('safeToSpendHint');
        const safeToSpendValueEl = document.getElementById('safeToSpendValue');
        const simulatorTitleEl = document.getElementById('forecastSimulatorTitle');
        const simulatorHintEl = document.getElementById('forecastSimulatorHint');
        const simulatorInputEl = document.getElementById('forecastSimulatorInput');
        const simulatorForecastLabelEl = document.getElementById('forecastSimulatorForecastLabel');
        const simulatorForecastValueEl = document.getElementById('forecastSimulatorForecastValue');
        const simulatorBudgetLabelEl = document.getElementById('forecastSimulatorBudgetLabel');
        const simulatorBudgetValueEl = document.getElementById('forecastSimulatorBudgetValue');
        const simulatorEmptyEl = document.getElementById('forecastSimulatorEmpty');
        const dailyCheckInTitleEl = document.getElementById('dailyCheckInTitle');
        const dailyCheckInSubtitleEl = document.getElementById('dailyCheckInSubtitle');
        const dailyCheckInValueEl = document.getElementById('dailyCheckInValue');
        if (titleEl) titleEl.textContent = this.t('wiseForecastTitle');
        if (endLabelEl) endLabelEl.textContent = this.t('wiseForecastEndLabel');
        if (avgLabelEl) avgLabelEl.textContent = this.t('wiseForecastAvgLabel');
        if (this.isZeroDataState && this.isZeroDataState()) {
            if (subtitleEl) subtitleEl.textContent = this.t('forecastIdleSubtitle');
            if (valueEl) valueEl.textContent = '—';
            if (avgEl) { avgEl.textContent = '—'; avgEl.classList.add('forecast-na'); }
            if (remainingLabelEl) remainingLabelEl.textContent = this.t('wiseForecastDetailRemaining');
            if (remainingValueEl) remainingValueEl.textContent = '—';
            if (fixedResidualLabelEl) fixedResidualLabelEl.textContent = this.t('wiseForecastDetailFixedResidual');
            if (fixedResidualValueEl) fixedResidualValueEl.textContent = '—';
            if (variableProjectionLabelEl) variableProjectionLabelEl.textContent = this.t('wiseForecastDetailVariableProjection');
            if (variableProjectionValueEl) { variableProjectionValueEl.textContent = '—'; variableProjectionValueEl.classList.add('forecast-na'); }
            if (riskDayLabelEl) riskDayLabelEl.textContent = this.t('wiseForecastRiskDayLabel');
            if (riskDayValueEl) { riskDayValueEl.textContent = this.t('forecastIdleInfo'); riskDayValueEl.className = 'forecast-risk-day-value neutral'; }
            if (safeDaysLabelEl) safeDaysLabelEl.textContent = this.t('wiseForecastSafeDaysLabel');
            if (safeDaysValueEl) { safeDaysValueEl.textContent = this.t('forecastIdleInfo'); safeDaysValueEl.className = 'forecast-risk-day-value neutral'; }
            if (safeToSpendLabelEl) safeToSpendLabelEl.textContent = this.t('safeToSpendLabel');
            if (safeToSpendHintEl) safeToSpendHintEl.textContent = this.t('safeToSpendHint');
            if (safeToSpendValueEl) { safeToSpendValueEl.textContent = '—'; safeToSpendValueEl.className = 'safe-to-spend-value sensitive-amount neutral'; }
            if (simulatorTitleEl) simulatorTitleEl.textContent = this.t('forecastSimulatorTitle');
            if (simulatorHintEl) simulatorHintEl.textContent = this.t('forecastIdleInfo');
            if (simulatorInputEl) simulatorInputEl.placeholder = this.t('forecastSimulatorPlaceholder');
            if (simulatorForecastLabelEl) simulatorForecastLabelEl.textContent = this.t('forecastSimulatorForecastLabel');
            if (simulatorBudgetLabelEl) simulatorBudgetLabelEl.textContent = this.t('forecastSimulatorBudgetLabel');
            if (simulatorForecastValueEl) { simulatorForecastValueEl.textContent = '—'; simulatorForecastValueEl.className = 'forecast-simulator-value sensitive-amount neutral'; }
            if (simulatorBudgetValueEl) { simulatorBudgetValueEl.textContent = '—'; simulatorBudgetValueEl.className = 'forecast-simulator-value sensitive-amount neutral'; }
            if (simulatorEmptyEl) { simulatorEmptyEl.textContent = this.t('forecastIdleInfo'); simulatorEmptyEl.style.display = 'block'; }
            if (dailyCheckInTitleEl) dailyCheckInTitleEl.textContent = this.t('dailyCheckInTitle');
            if (dailyCheckInSubtitleEl) dailyCheckInSubtitleEl.textContent = this.t('forecastIdleSubtitle');
            if (dailyCheckInValueEl) { dailyCheckInValueEl.textContent = this.t('dailyCheckInWaiting'); dailyCheckInValueEl.className = 'daily-checkin-value neutral'; }
            if (statusEl) { statusEl.textContent = this.t('forecastIdleStatus'); statusEl.className = 'forecast-status neutral'; }
            return;
        }
        if (subtitleEl) subtitleEl.textContent = this.t('wiseForecastSubtitle');
        if (valueEl) valueEl.textContent = this.formatCurrency(forecast.projectedEndBalance);
        if (avgEl) {
            const avgHasData = forecast.avgVariablePerDay !== null && Number.isFinite(forecast.avgVariablePerDay);
            avgEl.textContent = avgHasData ? this.formatCurrency(forecast.avgVariablePerDay) : '—';
            avgEl.classList.toggle('forecast-na', !avgHasData);
        }
        if (remainingLabelEl) remainingLabelEl.textContent = this.t('wiseForecastDetailRemaining');
        if (remainingValueEl) remainingValueEl.textContent = this.formatCurrency(forecast.currentRemaining);
        if (fixedResidualLabelEl) fixedResidualLabelEl.textContent = this.t('wiseForecastDetailFixedResidual');
        if (fixedResidualValueEl) fixedResidualValueEl.textContent = this.formatCurrency(forecast.fixedResidualInPeriod);
        if (variableProjectionLabelEl) variableProjectionLabelEl.textContent = this.t('wiseForecastDetailVariableProjection');
        if (variableProjectionValueEl) {
            const projectedHasData = Boolean(forecast.hasVariableHistory);
            variableProjectionValueEl.textContent = projectedHasData ? this.formatCurrency(forecast.projectedVariableRemaining) : '—';
            variableProjectionValueEl.classList.toggle('forecast-na', !projectedHasData);
        }
        const riskDay = this.getForecastRiskDayMessage(forecast);
        const safeDays = this.getForecastSafeDaysMessage(forecast);
        const safeToSpend = this.getSafeToSpendData(forecast);
        const simulation = this.getForecastSimulatorPreview(forecast);
        const dailyCheckIn = this.getDailyCheckInData(forecast);
        if (riskDayLabelEl) riskDayLabelEl.textContent = this.t('wiseForecastRiskDayLabel');
        if (riskDayValueEl) {
            riskDayValueEl.textContent = riskDay.text;
            riskDayValueEl.className = 'forecast-risk-day-value ' + riskDay.tone;
        }
        if (safeDaysLabelEl) safeDaysLabelEl.textContent = this.t('wiseForecastSafeDaysLabel');
        if (safeDaysValueEl) {
            safeDaysValueEl.textContent = safeDays.text;
            safeDaysValueEl.className = 'forecast-risk-day-value ' + safeDays.tone;
        }
        if (safeToSpendLabelEl) safeToSpendLabelEl.textContent = this.t('safeToSpendLabel');
        if (safeToSpendHintEl) safeToSpendHintEl.textContent = this.t('safeToSpendHint');
        if (safeToSpendValueEl) {
            safeToSpendValueEl.textContent = safeToSpend.text;
            safeToSpendValueEl.className = 'safe-to-spend-value sensitive-amount ' + (safeToSpend.positive ? 'positive' : 'negative');
        }
        if (simulatorTitleEl) simulatorTitleEl.textContent = this.t('forecastSimulatorTitle');
        if (simulatorHintEl) simulatorHintEl.textContent = this.t('forecastSimulatorHint');
        if (simulatorInputEl) simulatorInputEl.placeholder = this.t('forecastSimulatorPlaceholder');
        if (simulatorForecastLabelEl) simulatorForecastLabelEl.textContent = this.t('forecastSimulatorForecastLabel');
        if (simulatorBudgetLabelEl) simulatorBudgetLabelEl.textContent = this.t('forecastSimulatorBudgetLabel');
        if (simulatorForecastValueEl) {
            simulatorForecastValueEl.textContent = this.formatCurrency(simulation.projectedEndBalance);
            simulatorForecastValueEl.className = 'forecast-simulator-value sensitive-amount ' + (simulation.projectedEndBalance >= 0 ? 'positive' : 'negative');
        }
        if (simulatorBudgetValueEl) {
            simulatorBudgetValueEl.textContent = this.formatCurrency(simulation.dailyBudget);
            simulatorBudgetValueEl.className = 'forecast-simulator-value sensitive-amount ' + (simulation.dailyBudget >= 0 ? 'positive' : 'negative');
        }
        if (simulatorEmptyEl) {
            simulatorEmptyEl.textContent = this.t('forecastSimulatorEmpty');
            simulatorEmptyEl.style.display = simulation.active ? 'none' : 'block';
        }
        if (dailyCheckInTitleEl) dailyCheckInTitleEl.textContent = this.t('dailyCheckInTitle');
        if (dailyCheckInSubtitleEl) dailyCheckInSubtitleEl.textContent = this.t('dailyCheckInSubtitle');
        if (dailyCheckInValueEl) {
            dailyCheckInValueEl.textContent = dailyCheckIn.text;
            dailyCheckInValueEl.className = 'daily-checkin-value ' + dailyCheckIn.tone;
        }
        if (statusEl) {
            statusEl.textContent = this.t(forecast.toneKey);
            statusEl.className = 'forecast-status ' + (forecast.projectedEndBalance > 0.009 ? 'positive' : forecast.projectedEndBalance < -0.009 ? 'negative' : 'neutral');
        }
    }

    calculatePlannedSavings() {
        const totalIncome = this.calculateTotalIncome();
        const percent = this.data.savingsPercent || 0;
        return (totalIncome * percent) / 100;
    }

    calculateProjectedSavingsEnd() {
        const pot = this.data.savingsPot || 0;
        const planned = this.calculatePlannedSavings();
        const remaining = this.calculateAvailableBalance(); // remaining budget after fixed + planned savings - variable spent
        // Se vai in rosso, non aumentiamo il pot con un valore negativo
        return pot + planned + Math.max(0, remaining);
    }

    calculateRemaining() {
        const totalIncome = this.calculateTotalIncome();
        const totalFixed = this.calculateTotalFixedExpensesUnpaid();
        const totalVariable = this.calculateTotalVariableExpenses();
        return totalIncome - totalVariable - totalFixed;
    }

    calculateDailyBudget() {
        const remaining = this.calculateRemaining();
        const daysLeft = this.getDaysLeft();
        return daysLeft > 0 ? remaining / daysLeft : 0;
    }

    getDaysLeft() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const end = new Date(this.normalizeIsoDate(this.data.periodEnd));
        if (isNaN(end.getTime())) return 0;
        end.setHours(0, 0, 0, 0);

        const msPerDay = 1000 * 60 * 60 * 24;
        const diffDays = Math.floor((end - today) / msPerDay);

        return diffDays >= 0 ? diffDays + 1 : 0;
    }

    calculateSavingsProgress() {
        if (!this.data.savingsGoal) return 0;
        const saved = (this.calculateTotalIncome() * (this.data.savingsPercent || 0)) / 100;
        return (saved / this.data.savingsGoal) * 100;
    }

    getNextPaymentDate(day) {
        const periodStartIso = this.normalizeIsoDate(this.data?.periodStart || '');
        const base = new Date(periodStartIso);
        if (isNaN(base.getTime())) return '';
        base.setHours(0, 0, 0, 0);

        const targetDay = Math.max(1, parseInt(day, 10) || 1);
        const year = base.getFullYear();
        const month = base.getMonth();

        const currentMonthDays = new Date(year, month + 1, 0).getDate();
        const safeCurrentDay = Math.min(targetDay, currentMonthDays);
        let next = new Date(year, month, safeCurrentDay);
        next.setHours(0, 0, 0, 0);

        if (next < base) {
            const nextMonthDays = new Date(year, month + 2, 0).getDate();
            const safeNextDay = Math.min(targetDay, nextMonthDays);
            next = new Date(year, month + 1, safeNextDay);
            next.setHours(0, 0, 0, 0);
        }

        return this.formatLocalDate(next);
    }

    // ========== ENTRATE ==========
    addIncome() {
        const desc = document.getElementById('incomeDesc').value.trim();
        const amount = parseFloat(document.getElementById('incomeAmount').value);
        const dateInput = document.getElementById('incomeDate').value;
        
        const date = dateInput || new Date().toISOString().split('T')[0];
        
        if (!desc || !amount) {
            this.showToast(this.t('fillFields'), 'error');
            return;
        }
        
        if (!Array.isArray(this.data.incomes) || this.data.incomes.length === 0) {
            const startDate = new Date(date);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 30);
            
            this.data.periodStart = startDate.toISOString().split('T')[0];
            this.data.periodEnd = endDate.toISOString().split('T')[0];
            
        }
        
        if (!Array.isArray(this.data.incomes)) this.data.incomes = [];
        
        this.data.incomes.push({
            desc,
            amount,
            date: date,
            id: Date.now()
        });
        
        this.saveData();
        this.updateUI();
        this.showToast(this.t('incomeAdded'), 'success');
        
        document.getElementById('incomeDesc').value = '';
        document.getElementById('incomeAmount').value = '';
        document.getElementById('incomeDate').value = '';
    }

    deleteIncome(id) {
        if (!Array.isArray(this.data.incomes)) return;
        this.data.incomes = this.data.incomes.filter(inc => inc.id !== id);
        this.saveData();
        this.updateUI();
        this.showToast(this.t('incomeDeleted'), 'success');
    }

    // ========== SPESE FISSE ==========
    addFixedExpense() {
        const name = document.getElementById('fixedName').value.trim();
        const amount = parseFloat(document.getElementById('fixedAmount').value);
        const day = parseInt(document.getElementById('fixedDay').value);
        const endDate = document.getElementById('fixedEndDate').value;

        if (!name || !amount || !day || !endDate) {
            this.showToast(this.t('fillFields'), 'error');
            return;
        }
        if (day < 1 || day > 31) {
            this.showToast(this.t('invalidDay'), 'error');
            return;
        }

        if (!Array.isArray(this.data.fixedExpenses)) this.data.fixedExpenses = [];

        this.data.fixedExpenses.push({ name, amount, day, endDate, id: Date.now() });
        this.saveData();
        this.updateUI();

        const status = new Date(endDate) >= new Date() ? '🟢' : '🔴';
        this.showToast(`💰 ${name} ${this.formatCurrency(amount)} – giorno ${day} (scad. ${endDate}) ${status}`, 'success');
        this.highlightField('fixedName');
        this.highlightField('fixedAmount');
        this.highlightField('fixedDay');
        this.highlightField('fixedEndDate');

        document.getElementById('fixedName').value = '';
        document.getElementById('fixedAmount').value = '';
        document.getElementById('fixedDay').value = '';
        document.getElementById('fixedEndDate').value = '';
    }

    deleteFixedExpense(id) {
        if (!Array.isArray(this.data.fixedExpenses)) return;
        this.data.fixedExpenses = this.data.fixedExpenses.filter(exp => exp.id !== id);
        this.saveData();
        this.updateUI();
        this.showToast(this.t('fixedDeleted'), 'success');
    }

    async resolveManualExpenseDuplicate(expense) {
        const incoming = this.createVariableExpenseRecord(expense, { source: 'manual' });
        const candidate = this.findVariableDuplicateCandidate(incoming, { sourceType: 'manual' });
        if (!candidate) {
            return {
                action: 'insert',
                allowDuplicate: false,
                candidate: null
            };
        }
        const keepBoth = await this.showDuplicateDialog(candidate, incoming, 'manual');
        return {
            action: keepBoth ? 'insert' : 'cancel',
            allowDuplicate: keepBoth,
            candidate
        };
    }

    // ========== SPESE VARIABILI ==========
    async addVariableExpense() {
        let date = this.normalizeIsoDate(document.getElementById('expenseDate').value);
        if (!date) {
            date = this.formatLocalDate(new Date());
            const dateInput = document.getElementById('expenseDate');
            if (dateInput) dateInput.value = date;
        }
        const name = document.getElementById('expenseName').value.trim();
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const category = document.getElementById('expenseCategory').value;
        const subCategory = document.getElementById('expenseSubCategory')?.value.trim() || '';
        this.ensureCategoryExists(category, subCategory);

        if (!name || !amount) {
            this.showToast(this.t('fillFields'), 'error');
            return;
        }

        const baseExpense = {
            name,
            amount,
            category,
            subCategory,
            date,
            id: Date.now(),
            source: 'manual'
        };

        const duplicateDecision = await this.resolveManualExpenseDuplicate(baseExpense);
        if (duplicateDecision.action === 'cancel') {
            this.showToast('⚠️ Inserimento annullato: possibile duplicato', 'info');
            return;
        }

        const result = this.upsertVariableExpense(baseExpense, {
            sourceType: 'manual',
            allowDuplicate: duplicateDecision.allowDuplicate
        });

        this.learnCategory(name, category, subCategory);
        this.saveData();
        this.updateUI();
        this.updateChart();

        if (duplicateDecision.allowDuplicate) {
            this.showToast(`✅ Doppia voce mantenuta: ${name} · ${this.formatCurrency(amount)}`, 'success');
        } else if (result.matched) {
            this.showToast('🔗 Spesa già presente nei movimenti: collegata senza doppio conteggio', 'info');
        } else {
            this.showToast(`${name} · ${this.getCategoryDisplay(category)} · ${this.formatCurrency(amount)} ${this.t('addedSuffix') || 'aggiunto'}`.trim(), 'success');
        }
        this.highlightField('expenseName');
        this.highlightField('expenseAmount');

        document.getElementById('expenseName').value = '';
        document.getElementById('expenseAmount').value = '';
        const expenseSubCategory = document.getElementById('expenseSubCategory');
        if (expenseSubCategory) expenseSubCategory.value = '';
        this.checkThreshold(date);
    }

    ensureVariableExpensesStore() {
        if (!this.data.variableExpenses || typeof this.data.variableExpenses !== 'object') {
            this.data.variableExpenses = {};
        }
    }

    buildVariableDuplicateGuardKey(expense = {}) {
        const date = this.normalizeIsoDate(expense?.date || '');
        const amount = Math.abs(Number(expense?.amount || 0)).toFixed(2);
        const name = this.normalizeMatchText(expense?.name || '');
        if (!date || !name) return null;
        return `${date}|${amount}|${name}`;
    }

    createVariableExpenseRecord(expense = {}, overrides = {}) {
        const date = this.normalizeIsoDate(overrides.date || expense.date || this.formatLocalDate(new Date()));
        const amount = Math.abs(Number(overrides.amount ?? expense.amount ?? 0));
        const record = {
            name: (overrides.name || expense.name || '').toString().trim(),
            amount,
            category: overrides.category || expense.category || 'Altro',
            subCategory: (overrides.subCategory ?? expense.subCategory ?? '').toString().trim(),
            date,
            id: overrides.id || expense.id || Date.now(),
            source: overrides.source || expense.source || 'manual',
            bankLinked: !!(overrides.bankLinked ?? expense.bankLinked),
            linkedImportAt: overrides.linkedImportAt || expense.linkedImportAt || null,
            importSourceName: overrides.importSourceName || expense.importSourceName || null,
            duplicateGuardKey: overrides.duplicateGuardKey || expense.duplicateGuardKey || null
        };
        record.duplicateGuardKey = record.duplicateGuardKey || this.buildVariableDuplicateGuardKey(record);
        return record;
    }

    updateVariableExpenseById(id, updater) {
        this.ensureVariableExpensesStore();
        const fn = typeof updater === 'function' ? updater : (() => updater || {});
        for (const [date, list] of Object.entries(this.data.variableExpenses)) {
            const idx = Array.isArray(list) ? list.findIndex(exp => String(exp?.id) === String(id)) : -1;
            if (idx === -1) continue;
            const current = list[idx] || {};
            const patch = fn({ ...current, date }) || {};
            list[idx] = { ...current, ...patch };
            return list[idx];
        }
        return null;
    }

    isImportedVariableSource(source) {
        const normalized = (source || '').toString().trim().toLowerCase();
        return normalized === 'import' || normalized === 'bank-import';
    }

    isManualVariableSource(source) {
        return !this.isImportedVariableSource(source);
    }

    scoreVariableDuplicateMatch(existing, incoming) {
        if (!existing || !incoming) return -Infinity;
        const existingAmount = Math.abs(Number(existing.amount || 0));
        const incomingAmount = Math.abs(Number(incoming.amount || 0));
        const amountDiff = Math.abs(existingAmount - incomingAmount);
        if (amountDiff > 0.05) return -Infinity;

        const existingDate = new Date(this.normalizeIsoDate(existing.date));
        const incomingDate = new Date(this.normalizeIsoDate(incoming.date));
        if (isNaN(existingDate.getTime()) || isNaN(incomingDate.getTime())) return -Infinity;
        const diffDays = Math.abs((existingDate - incomingDate) / 86400000);
        if (diffDays > 1.1) return -Infinity;

        const existingNorm = this.normalizeMatchText(existing.name || '');
        const incomingNorm = this.normalizeMatchText(incoming.name || '');
        const existingTokens = this.getMeaningfulMatchTokens(existing.name || '');
        const incomingTokens = this.getMeaningfulMatchTokens(incoming.name || '');
        const tokenOverlap = existingTokens.filter(t => incomingTokens.includes(t));
        const semanticOverlap = Array.from(this.getSemanticMatchHints(existing.name || '')).filter(t => this.getSemanticMatchHints(incoming.name || '').has(t));

        let score = 0;
        score += Math.max(0, 50 - (amountDiff * 500));
        score += diffDays <= 0.01 ? 30 : 18;

        if (existingNorm && incomingNorm && (existingNorm.includes(incomingNorm) || incomingNorm.includes(existingNorm))) score += 45;
        score += tokenOverlap.length * 24;
        score += semanticOverlap.length * 18;

        const genericNames = new Set(['spesa', 'expense', 'pagamento', 'acquisto', 'movimento']);
        if (genericNames.has(existingNorm) || genericNames.has(incomingNorm)) score -= 20;
        if (!tokenOverlap.length && !semanticOverlap.length && !(existingNorm && incomingNorm && (existingNorm.includes(incomingNorm) || incomingNorm.includes(existingNorm)))) {
            score -= 60;
        }

        const existingIsImport = !!existing.bankLinked || this.isImportedVariableSource(existing.source);
        const incomingIsImport = !!incoming.bankLinked || this.isImportedVariableSource(incoming.source);
        if (existingIsImport !== incomingIsImport) {
            const exactSameDay = diffDays <= 0.01;
            const oneNameGeneric = genericNames.has(existingNorm) || genericNames.has(incomingNorm) || !existingNorm || !incomingNorm;
            const oneNameRicher = Math.abs(existingTokens.length - incomingTokens.length) >= 2;
            if (exactSameDay && amountDiff <= 0.02 && (tokenOverlap.length > 0 || semanticOverlap.length > 0 || oneNameGeneric || oneNameRicher)) {
                score += 18;
            }
        }

        return score;
    }

    findVariableDuplicateCandidate(incoming, options = {}) {
        const candidates = this.getAllVariableExpensesFlat()
            .filter(existing => existing && String(existing.id) !== String(incoming.id));

        const incomingRecord = this.createVariableExpenseRecord(incoming || {}, {
            source: incoming?.source || options.sourceType || 'import'
        });
        const incomingGuardKey = incomingRecord.duplicateGuardKey || this.buildVariableDuplicateGuardKey(incomingRecord);
        if (incomingGuardKey) {
            const exactMatch = candidates.find(existing => {
                const existingGuardKey = existing?.duplicateGuardKey || this.buildVariableDuplicateGuardKey(existing);
                return existingGuardKey && existingGuardKey === incomingGuardKey;
            });
            if (exactMatch) return exactMatch;
        }

        const ranked = candidates
            .map(existing => ({ existing, score: this.scoreVariableDuplicateMatch(existing, incomingRecord) }))
            .filter(item => Number.isFinite(item.score) && item.score >= 95)
            .sort((a, b) => b.score - a.score);

        if (ranked.length) {
            const [best, second] = ranked;
            if (second && (best.score - second.score) < 15) return null;
            return best.existing;
        }

        const incomingNorm = this.normalizeMatchText(incomingRecord?.name || '');
        const genericNames = new Set(['spesa', 'expense', 'pagamento', 'acquisto', 'movimento']);
        const fallbackCandidates = candidates.filter(existing => {
            const existingAmount = Math.abs(Number(existing?.amount || 0));
            const incomingAmount = Math.abs(Number(incomingRecord?.amount || 0));
            if (Math.abs(existingAmount - incomingAmount) > 0.02) return false;

            const existingDate = this.normalizeIsoDate(existing?.date || '');
            const incomingDate = this.normalizeIsoDate(incomingRecord?.date || '');
            if (!existingDate || !incomingDate || existingDate !== incomingDate) return false;

            const existingNorm = this.normalizeMatchText(existing?.name || '');
            const existingTokens = this.getMeaningfulMatchTokens(existing?.name || '');
            const incomingTokens = this.getMeaningfulMatchTokens(incomingRecord?.name || '');
            const tokenOverlap = existingTokens.filter(t => incomingTokens.includes(t)).length;
            const semanticOverlap = Array.from(this.getSemanticMatchHints(existing?.name || '')).filter(t => this.getSemanticMatchHints(incomingRecord?.name || '').has(t)).length;
            const oneGeneric = genericNames.has(existingNorm) || genericNames.has(incomingNorm) || !existingNorm || !incomingNorm;
            const oneClearlyRicher = Math.abs(existingTokens.length - incomingTokens.length) >= 2;

            return tokenOverlap > 0 || semanticOverlap > 0 || oneGeneric || oneClearlyRicher;
        });

        if (fallbackCandidates.length !== 1) return null;
        return fallbackCandidates[0];
    }

    getDuplicateDialogCopy(context = 'import') {
        if (context !== 'manual') {
            return this.getImportDuplicateDialogCopy();
        }
        const lang = this.data?.language || 'it';
        if (lang === 'en') {
            return {
                title: 'Possible duplicate',
                subtitle: 'A similar expense is already present. Choose whether to keep both entries.',
                existing: 'Already present',
                incoming: 'New entry',
                importCta: 'Insert anyway',
                skipCta: 'Cancel entry'
            };
        }
        if (lang === 'es') {
            return {
                title: 'Posible duplicado',
                subtitle: 'Ya existe un gasto similar. Elige si quieres conservar ambas entradas.',
                existing: 'Ya presente',
                incoming: 'Nueva entrada',
                importCta: 'Insertar igualmente',
                skipCta: 'Cancelar inserción'
            };
        }
        if (lang === 'fr') {
            return {
                title: 'Doublon possible',
                subtitle: 'Une dépense similaire est déjà présente. Choisissez si vous voulez garder les deux entrées.',
                existing: 'Déjà présent',
                incoming: 'Nouvelle saisie',
                importCta: 'Insérer quand même',
                skipCta: 'Annuler la saisie'
            };
        }
        return {
            title: 'Possibile duplicato',
            subtitle: 'Esiste già una spesa simile. Scegli se mantenere entrambe le voci.',
            existing: 'Già presente',
            incoming: 'Nuovo inserimento',
            importCta: 'Inserisci comunque',
            skipCta: 'Annulla inserimento'
        };
    }

    getImportDuplicateDialogCopy() {
        const lang = this.data?.language || 'it';
        if (lang === 'en') {
            return {
                title: 'Possible duplicate',
                subtitle: 'A similar transaction is already present. Decide whether to keep both.',
                existing: 'Already present',
                incoming: 'Import row',
                importCta: 'Import anyway',
                skipCta: 'Skip duplicate'
            };
        }
        if (lang === 'es') {
            return {
                title: 'Posible duplicado',
                subtitle: 'Ya existe un movimiento similar. Decide si quieres conservar ambos.',
                existing: 'Ya presente',
                incoming: 'Fila importada',
                importCta: 'Importar igualmente',
                skipCta: 'Omitir duplicado'
            };
        }
        if (lang === 'fr') {
            return {
                title: 'Doublon possible',
                subtitle: 'Une opération similaire est déjà présente. Décidez si vous voulez garder les deux.',
                existing: 'Déjà présent',
                incoming: 'Ligne importée',
                importCta: 'Importer quand même',
                skipCta: 'Ignorer le doublon'
            };
        }
        return {
            title: 'Possibile duplicato',
            subtitle: 'Esiste già un movimento simile. Decidi se mantenere entrambe le voci.',
            existing: 'Già presente',
            incoming: 'Riga in importazione',
            importCta: 'Importa comunque',
            skipCta: 'Salta duplicato'
        };
    }

    formatImportDuplicateLine(expense) {
        const normalizedDate = this.normalizeIsoDate(expense?.date || '') || expense?.date || '—';
        const label = (expense?.name || '').trim() || '—';
        const amount = this.formatCurrency(Math.abs(Number(expense?.amount || 0)));
        return `${normalizedDate} · ${label} · ${amount}`;
    }

    showDuplicateDialog(existing, incoming, context = 'import') {
        return new Promise((resolve) => {
            const overlay = document.getElementById('duplicateImportOverlay');
            const titleEl = document.getElementById('duplicateImportTitle');
            const subtitleEl = document.getElementById('duplicateImportSubtitle');
            const existingEl = document.getElementById('duplicateImportExisting');
            const incomingEl = document.getElementById('duplicateImportIncoming');
            const importBtn = document.getElementById('duplicateImportKeepBtn');
            const skipBtn = document.getElementById('duplicateImportSkipBtn');

            const copy = this.getDuplicateDialogCopy(context);
            if (!overlay || !titleEl || !subtitleEl || !existingEl || !incomingEl || !importBtn || !skipBtn) {
                this.showAppConfirm(`${copy.title}

${copy.existing}:
${this.formatImportDuplicateLine(existing)}

${copy.incoming}:
${this.formatImportDuplicateLine(incoming)}`).then(resolve);
                return;
            }

            titleEl.textContent = copy.title;
            subtitleEl.textContent = copy.subtitle;
            existingEl.innerHTML = `
                <div class="duplicate-import-card__label">${copy.existing}</div>
                <div class="duplicate-import-card__value">${this.formatImportDuplicateLine(existing)}</div>
            `;
            incomingEl.innerHTML = `
                <div class="duplicate-import-card__label">${copy.incoming}</div>
                <div class="duplicate-import-card__value">${this.formatImportDuplicateLine(incoming)}</div>
            `;
            importBtn.textContent = copy.importCta;
            skipBtn.textContent = copy.skipCta;

            let settled = false
            const finish = (shouldImport) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(shouldImport);
            };
            const onImport = () => finish(true);
            const onSkip = () => finish(false);
            const cleanup = () => {
                overlay.style.display = 'none';
                this.setOverlayState(false);
                importBtn.removeEventListener('click', onImport);
                skipBtn.removeEventListener('click', onSkip);
            };
            this.bindOverlayEscape(overlay, () => finish(false));
            this.setOverlayState(true);
            overlay.style.display = 'flex';
            importBtn.addEventListener('click', onImport);
            skipBtn.addEventListener('click', onSkip);
        });
    }

    showImportDuplicateDialog(existing, incoming) {
        return this.showDuplicateDialog(existing, incoming, 'import');
    }

    async resolveImportedExpenseDuplicate(expense) {
        const incoming = this.createVariableExpenseRecord(expense, { source: 'import' });
        const candidate = this.findVariableDuplicateCandidate(incoming, { sourceType: 'import' });
        if (!candidate) return { action: 'import', allowDuplicate: false, candidate: null };
        const shouldImportAnyway = await this.showImportDuplicateDialog(candidate, incoming);
        return {
            action: shouldImportAnyway ? 'import' : 'skip',
            allowDuplicate: shouldImportAnyway,
            candidate
        };
    }

    upsertVariableExpense(expense, options = {}) {
        this.ensureVariableExpensesStore();
        const sourceType = options.sourceType || expense?.source || 'manual';
        const record = this.createVariableExpenseRecord(expense, { source: sourceType });
        const candidate = options.allowDuplicate ? null : this.findVariableDuplicateCandidate(record, { sourceType });

        if (candidate) {
            const updated = this.updateVariableExpenseById(candidate.id, current => {
                const patch = {
                    bankLinked: current.bankLinked || sourceType === 'import',
                    linkedImportAt: sourceType === 'import' ? new Date().toISOString() : current.linkedImportAt,
                    duplicateGuardKey: current.duplicateGuardKey || record.duplicateGuardKey || null
                };
                if (sourceType === 'import') {
                    patch.importSourceName = record.name || current.importSourceName || null;
                    if ((!current.name || current.name.length <= 4 || current.name === this.t('genericExpense')) && record.name) patch.name = record.name;
                }
                if ((!current.category || current.category === 'Altro') && record.category) patch.category = record.category;
                if ((!current.subCategory || !String(current.subCategory).trim()) && record.subCategory) patch.subCategory = record.subCategory;
                return patch;
            });
            return { matched: true, record: updated || candidate };
        }

        if (!this.data.variableExpenses[record.date]) this.data.variableExpenses[record.date] = [];
        this.data.variableExpenses[record.date].push({
            name: record.name,
            amount: record.amount,
            category: record.category,
            subCategory: record.subCategory,
            id: record.id,
            source: record.source,
            bankLinked: !!record.bankLinked,
            linkedImportAt: record.linkedImportAt,
            importSourceName: record.importSourceName,
            duplicateGuardKey: record.duplicateGuardKey
        });
        return { matched: false, record };
    }

    deleteVariableExpense(date, id) {
        if (!this.data.variableExpenses || !this.data.variableExpenses[date]) return;
        this.data.variableExpenses[date] = this.data.variableExpenses[date].filter(exp => exp.id !== id);
        if (this.data.variableExpenses[date].length === 0) delete this.data.variableExpenses[date];
        this.saveData();
        this.updateUI();
        this.updateChart();
        this.showToast(this.t('expenseDeleted'), 'success');
    }

    resetDay() {
        const date = document.getElementById('expenseDate').value;
        if (this.data.variableExpenses && this.data.variableExpenses[date]) {
            delete this.data.variableExpenses[date];
            this.saveData();
            this.updateUI();
            this.updateChart();
            this.showToast(this.t('dayReset'), 'success');
        }
    }

    checkThreshold(date) {
        const today = new Date().toISOString().split('T')[0];
        if (date !== today) return;
        const totalSpent = this.calculateTotalVariableExpenses();
        if (totalSpent > this.data.threshold) {
            this.showToast(this.t('thresholdExceeded') + this.formatCurrency(this.data.threshold), 'error');
        }
    }

    applySavings() {
        const percent = parseFloat(document.getElementById('savePercent').value) || 0;
        const goal = parseFloat(document.getElementById('saveGoal').value) || 0;
        const pot = parseFloat(document.getElementById('savingsPotInput')?.value) || 0;
        this.data.savingsPercent = percent;
        this.data.savingsGoal = goal;
        this.data.savingsPot = pot;
        this.syncWiseSavingState();
        this.saveData();
        this.updateUI();
        this.updateSavingsWidget();
        if (typeof this.showToast === 'function') {
            this.showToast(this.t('savingsApplied'));
        } else {
            this.showToast(this.t('savingsApplied'), 'success');
        }
    }

    // ========== WIDGET RISPARMIO MIGLIORATO ==========
    
updateSavingsWidget() {
    const percent = this.data.savingsPercent || 0;
    const goal = this.data.savingsGoal || 0;
    const currentSavings = this.data.savingsPot || 0;
    const allocation = this.syncWiseSavingState();
    const sustainability = this.getSavingsSustainabilityData();
    const accumulatedSavings = this.getAccumulatedSavings();

    const percentInput = document.getElementById('savePercent');
    if (percentInput) percentInput.value = percent;

    const goalInput = document.getElementById('saveGoal');
    const potInput = document.getElementById('savingsPotInput');
    if (goalInput) goalInput.value = goal || '';
    if (potInput) potInput.value = currentSavings || '';

    const allocationLabelEl = document.getElementById('allocationPeriodLabel');
    const allocationValueEl = document.getElementById('allocationPeriodValue');
    const allocationNoteEl = document.getElementById('allocationPeriodNote');
    const sustainabilityLabelEl = document.getElementById('sustainabilityLabel');
    const sustainabilityValueEl = document.getElementById('sustainabilityValue');
    const accumulatedLabelEl = document.getElementById('accumulatedSavingsLabel');
    const accumulatedValueEl = document.getElementById('accumulatedSavingsValue');
    const currentRateLabelEl = document.getElementById('currentRateLabel');
    const currentRateValueEl = document.getElementById('currentRateValue');
    const savingsPotLabel = document.getElementById('savingsPotLabel');

    const brain = this.getWiseBrainState();
    const zeroData = this.isZeroDataState && this.isZeroDataState();
    const displayedAllocation = zeroData ? 0 : (brain.needsSavingsRecalibration ? brain.recommendedAllocation : allocation);

    if (allocationLabelEl) allocationLabelEl.textContent = this.t('allocationPeriod');
    if (allocationValueEl) allocationValueEl.textContent = this.formatCurrency(displayedAllocation);
    if (allocationNoteEl) {
        let noteKey = 'savingsDecisionSuggestedNote';
        if (zeroData) noteKey = 'savingsDecisionIdleNote';
        else if (percent > 0 && !brain.needsSavingsRecalibration) noteKey = 'savingsDecisionActiveNote';
        else if (brain.needsSavingsRecalibration) noteKey = 'savingsDecisionStressNote';
        else if (displayedAllocation <= 0) noteKey = 'savingsDecisionNoRoomNote';
        allocationNoteEl.textContent = this.t(noteKey);
    }
    if (sustainabilityLabelEl) sustainabilityLabelEl.textContent = this.t('sustainability');
    if (sustainabilityValueEl) {
        sustainabilityValueEl.textContent = sustainability.label;
        sustainabilityValueEl.className = `wise-saving-mini-value ${sustainability.tone}`;
    }
    if (accumulatedLabelEl) accumulatedLabelEl.textContent = this.t('accumulatedSavingsLabel');
    if (accumulatedValueEl) accumulatedValueEl.textContent = this.formatCurrency(accumulatedSavings);
    if (currentRateLabelEl) currentRateLabelEl.textContent = this.t('currentRateLabel');
    if (currentRateValueEl) {
        const shownPercent = zeroData ? 0 : (brain.needsSavingsRecalibration ? brain.recommendedPercent : Math.max(0, Number(percent) || 0));
        currentRateValueEl.textContent = `${shownPercent}%`;
    }
    if (savingsPotLabel) savingsPotLabel.textContent = this.t('accumulatedSavingsHero');

    this.updateSavingsMessages(percent, goal, currentSavings);
    this.updateProgressRing(currentSavings, goal);
}


    updateSavingsMessages(percent, goal, currentSavings) {
        const targetDateEl = document.getElementById('targetDate');
        const currentPlanEl = document.getElementById('currentPlanMessage');
        const suggestionEl = document.getElementById('suggestionMessage');
        const suggestionCard = document.getElementById('suggestionCard');
        const applyBtn = document.getElementById('applySuggestionBtn');

        if (this.isZeroDataState && this.isZeroDataState()) {
            if (targetDateEl) targetDateEl.textContent = this.t('savingsIdleTarget');
            if (currentPlanEl) currentPlanEl.textContent = this.t('savingsIdlePlan');
            if (suggestionEl) suggestionEl.textContent = this.t('savingsIdleSuggestion');
            if (applyBtn) {
                applyBtn.dataset.suggestedPercent = '';
                applyBtn.style.display = 'none';
                delete applyBtn.dataset.mode;
            }
            if (suggestionCard) suggestionCard.style.display = 'block';
            return;
        }

        if (!goal || goal <= 0) return;
        
        // Calcola entrate mensili medie
        const monthlyIncome = this.calculateAverageMonthlyIncome();
        if (monthlyIncome <= 0) return;
        
        const monthlySavings = (monthlyIncome * percent) / 100;
        const remaining = goal - currentSavings;
        const monthsToGoal = monthlySavings > 0 ? Math.ceil(remaining / monthlySavings) : Infinity;
        
        // Calcola data target
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + monthsToGoal);
        // Mappa lingua app → locale browser


const currentLang = this.data.language || 'it';
const locale = LOCALE_MAP[currentLang] || 'it-IT';

const dateStr = targetDate.toLocaleDateString(locale, {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});
        
        // Aggiorna messaggi
        if (targetDateEl) {
            if (goal > 0 && currentSavings >= goal) {
            targetDateEl.textContent = this.t('savingsGoalReached');
        } else {
            targetDateEl.textContent = monthsToGoal === Infinity ? (percent > 0 ? this.t('never') : this.t('savingsPlanInactive')) : dateStr;
        }
        }
        
        if (currentPlanEl) {
            if (goal > 0 && currentSavings >= goal) {
            currentPlanEl.textContent = this.t('savingsGoalReached');
        } else {
            currentPlanEl.innerHTML = monthsToGoal === Infinity
                ? (percent > 0 ? this.t('goalNotReachable') : this.t('savingsPlanInactive'))
                : this.t('currentPaceReachOn').replace('{date}', `<strong>${dateStr}</strong>`);
        }
        }
        
        // Calcola suggerimento
        this.updateSavingsSuggestion(percent, monthsToGoal, monthlyIncome, remaining);
    }

    updateSavingsSuggestion(currentPercent, currentMonths, monthlyIncome, remaining) {
        const suggestionEl = document.getElementById('suggestionMessage');
        const suggestionCard = document.getElementById('suggestionCard');
        const applyBtn = document.getElementById('applySuggestionBtn');
        const brain = this.getWiseBrainState();

        if (!suggestionEl) return;

        if (this.isZeroDataState && this.isZeroDataState()) {
            suggestionEl.textContent = this.t('savingsIdleSuggestion');
            if (applyBtn) {
                applyBtn.dataset.suggestedPercent = '';
                applyBtn.style.display = 'none';
                delete applyBtn.dataset.mode;
            }
            if (suggestionCard) suggestionCard.style.display = 'block';
            return;
        }

        if (brain.needsSavingsRecalibration && brain.recommendedPercent >= 0) {
            const amount = this.formatCurrency(brain.recommendedAllocation);
            suggestionEl.innerHTML = `${this.t('decisionSavingsStressText')} <strong class="suggestion-value">${amount}</strong>`;
            if (applyBtn) {
                applyBtn.textContent = this.t('savingsApplyBrainSuggestion');
                applyBtn.dataset.suggestedPercent = String(brain.recommendedPercent);
                applyBtn.dataset.mode = 'recalibrate';
                applyBtn.style.display = 'inline-flex';
                applyBtn.disabled = false;
            }
            if (suggestionCard) suggestionCard.style.display = 'block';
            return;
        }

        if (applyBtn) delete applyBtn.dataset.mode;
        if (currentMonths === Infinity || currentMonths <= 1) {
            if (applyBtn) applyBtn.dataset.suggestedPercent = '';
            if (suggestionCard) suggestionCard.style.display = 'none';
            return;
        }

        let bestPercent = currentPercent;
        let bestMonths = currentMonths;

        for (let p = currentPercent + 1; p <= Math.min(currentPercent + 10, 30); p++) {
            const monthlySavings = (monthlyIncome * p) / 100;
            const months = monthlySavings > 0 ? Math.ceil(remaining / monthlySavings) : Infinity;

            if (months < bestMonths && months < currentMonths - 1) {
                bestMonths = months;
                bestPercent = p;
            }
        }

        if (bestPercent > currentPercent && bestMonths < currentMonths) {
            const monthsSaved = currentMonths - bestMonths;
            const key = monthsSaved === 1 ? 'increaseToPercentToArriveEarlier_one' : 'increaseToPercentToArriveEarlier';
            suggestionEl.innerHTML = this.t(key)
                .replace('{percent}', `<strong class="suggestion-value">${bestPercent}%</strong>`)
                .replace('{months}', `<strong class="suggestion-meta">${monthsSaved}</strong>`);

            if (applyBtn) {
                applyBtn.textContent = this.t('applySuggestion');
                applyBtn.dataset.suggestedPercent = String(bestPercent);
                applyBtn.style.display = 'inline-flex';
                applyBtn.disabled = false;
            }
            if (suggestionCard) suggestionCard.style.display = 'block';
        } else {
            if (applyBtn) applyBtn.dataset.suggestedPercent = '';
            if (suggestionCard) suggestionCard.style.display = 'none';
        }
    }

        applySavingsSuggestion(newPercent) {
        const percentInput = document.getElementById('savePercent');
        const numericPercent = Math.max(0, Math.min(30, parseFloat(newPercent)));

        if (percentInput && Number.isFinite(numericPercent)) {
            percentInput.value = String(numericPercent);
            this.data.savingsPercent = numericPercent;
            this.syncWiseSavingState();
            this.saveData();
            percentInput.dispatchEvent(new Event('input', { bubbles: true }));
            this.updateSavingsWidget();
            const applySuggestionBtn = document.getElementById('applySuggestionBtn');
            const toastKey = applySuggestionBtn && applySuggestionBtn.dataset.mode === 'recalibrate' ? 'savingsRecalibratedToast' : 'suggestionAppliedToast';
            this.showToast(this.t(toastKey).replace('{percent}', numericPercent), 'success');
        }
    }

    updateProgressRing(current, goal) {
        const progressCircle = document.getElementById('progressCircle');
        const progressPercentage = document.getElementById('progressPercentage');
        const savingsProgressBar = document.getElementById('savingsProgressBar');

        if (!progressCircle || !progressPercentage) return;

        if (!(goal > 0)) {
            progressCircle.style.strokeDashoffset = 157;
            progressPercentage.textContent = '0%';
            if (savingsProgressBar) savingsProgressBar.style.width = '0%';
            return;
        }

        const percentage = Math.min((current / goal) * 100, 100);
        const offset = 157 - (157 * percentage) / 100;

        progressCircle.style.strokeDashoffset = offset;
        progressPercentage.textContent = Math.round(percentage) + '%';
        if (savingsProgressBar) savingsProgressBar.style.width = percentage.toFixed(2) + '%';
    }

    calculateAverageMonthlyIncome() {
        if (!this.data.incomes || this.data.incomes.length === 0) return 0;
        
        const totalIncome = this.data.incomes.reduce((sum, income) => sum + (income.amount || 0), 0);
        const months = this.calculateMonthsCovered();
        
        return months > 0 ? totalIncome / months : 0;
    }

    calculateMonthsCovered() {
        if (!this.data.incomes || this.data.incomes.length === 0) return 0;
        
        const dates = this.data.incomes.map(income => new Date(income.date));
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        const months = (maxDate.getFullYear() - minDate.getFullYear()) * 12 + 
                      (maxDate.getMonth() - minDate.getMonth()) + 1;
        
        return Math.max(months, 1);
    }

    setupSavingsWidgetListeners() {
        const percentInput = document.getElementById('savePercent');
        
        if (percentInput && !percentInput.dataset.boundSavingsPercent) {
            percentInput.dataset.boundSavingsPercent = 'true';
            percentInput.addEventListener('input', (e) => {
                const rawValue = parseFloat(e.target.value);
                const numericValue = Number.isFinite(rawValue) ? Math.max(0, Math.min(30, rawValue)) : 0;
                if (String(numericValue) !== e.target.value) {
                    e.target.value = String(numericValue);
                }
                this.data.savingsPercent = numericValue;
                this.syncWiseSavingState();
                this.saveData();
                this.updateSavingsWidget();
            });
            percentInput.addEventListener('change', (e) => {
                const rawValue = parseFloat(e.target.value);
                const numericValue = Number.isFinite(rawValue) ? Math.max(0, Math.min(30, rawValue)) : 0;
                e.target.value = String(numericValue);
                this.data.savingsPercent = numericValue;
                this.syncWiseSavingState();
                this.saveData();
                this.updateSavingsWidget();
            });
        }

        const applySuggestionBtn = document.getElementById('applySuggestionBtn');
        if (applySuggestionBtn && !applySuggestionBtn.dataset.boundSuggestionClick) {
            const handleSuggestionApply = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const suggested = parseFloat(applySuggestionBtn.dataset.suggestedPercent || '');
                if (!Number.isFinite(suggested)) return;
                this.applySavingsSuggestion(suggested);
            };
            applySuggestionBtn.dataset.boundSuggestionClick = 'true';
            applySuggestionBtn.onclick = handleSuggestionApply;
            applySuggestionBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    handleSuggestionApply(e);
                }
            });
        }
        
        // Input obiettivo e fondo iniziale
        const goalInput = document.getElementById('saveGoal');
        const potInput = document.getElementById('savingsPotInput');
        
        if (goalInput) {
            goalInput.addEventListener('input', (e) => {
                this.data.savingsGoal = parseFloat(e.target.value) || 0;
                this.updateSavingsWidget();
            });
        }
        
        if (potInput) {
            potInput.addEventListener('input', (e) => {
                this.data.savingsPot = parseFloat(e.target.value) || 0;
                this.updateSavingsWidget();
            });
        }
    }

    getLast7DaysData() {
        const today = new Date();
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            let daySpent = 0;
            if (this.data.variableExpenses && this.data.variableExpenses[dateStr] && Array.isArray(this.data.variableExpenses[dateStr])) {
                daySpent = this.data.variableExpenses[dateStr].reduce((sum, exp) => sum + (exp.amount || 0), 0);
            }
            data.push(daySpent);
        }
        return data;
    }

    getLast7DaysBudget() {
        const dailyBudget = this.calculateDailyBudget();
        const data = [];
        for (let i = 6; i >= 0; i--) data.push(dailyBudget);
        return data;
    }

    drawSparkline(canvasId, data, color = '#0ea5e9') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        if (data.length === 0 || data.every(v => v === 0)) return;
        const max = Math.max(...data, 1);
        const min = Math.min(...data, 0);
        const range = max - min || 1;
        const points = data.map((v, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((v - min) / range) * height;
            return { x, y };
        });
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.stroke();
        ctx.fillStyle = color;
        points.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    openVariableTabFromHome() {
        const variableTab = document.querySelector('.tab-btn[data-tab="variable"]');
        if (variableTab) variableTab.click();
        const expenseName = document.getElementById('expenseName');
        if (expenseName) setTimeout(() => expenseName.focus(), 60);
    }

    setupEventListeners() {
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('addIncomeBtn').addEventListener('click', () => this.addIncome());
        document.getElementById('addFixedBtn').addEventListener('click', () => this.addFixedExpense());
        const resetFixedBtnEl = document.getElementById('resetFixedBtn');
        if (resetFixedBtnEl) resetFixedBtnEl.addEventListener('click', () => this.resetFixedExpenses());
        document.getElementById('addExpenseBtn').addEventListener('click', () => this.addVariableExpense());
        const homeManualBtn = document.getElementById('homeManualBtn');
        if (homeManualBtn) homeManualBtn.addEventListener('click', () => this.openVariableTabFromHome());
        const forecastSimulatorInput = document.getElementById('forecastSimulatorInput');
        if (forecastSimulatorInput) {
            const syncForecastSimulator = () => {
                this._forecastSimulatorRaw = forecastSimulatorInput.value || '';
                this.updateWiseForecastHome();
            };
            ['input', 'change', 'keyup', 'blur'].forEach((eventName) => {
                forecastSimulatorInput.addEventListener(eventName, syncForecastSimulator);
            });
        }
        document.getElementById('resetDayBtn').addEventListener('click', () => this.resetDay());
        document.getElementById('expenseDate').valueAsDate = new Date();
        document.getElementById('expenseDate').addEventListener('change', () => this.updateVariableExpensesList());

        const showAllToggle = document.getElementById('showAllExpensesToggle');
        if (showAllToggle) {
            showAllToggle.checked = !!this.showAllExpenses;
            showAllToggle.addEventListener('change', (e) => {
                this.showAllExpenses = !!e.target.checked;
                this.writeStorage('kedrix-show-all-expenses', this.showAllExpenses ? 'true' : 'false');
                this.updateVariableExpensesList();
            });
        }
        document.getElementById('applySaveBtn').addEventListener('click', () => this.applySavings());
        
        // Setup widget risparmio migliorato
        this.setupSavingsWidgetListeners();
        this.updateSavingsWidget();

        const loadDemoBtn = document.getElementById('loadDemoBtn');
        if (loadDemoBtn) loadDemoBtn.addEventListener('click', () => this.loadDemoData());
        document.getElementById('backupBtn').addEventListener('click', () => this.backupData());
        document.getElementById('restoreBtn').addEventListener('click', () => document.getElementById('restoreFile').click());
        document.getElementById('restoreFile').addEventListener('change', (e) => this.restoreData(e));
        document.getElementById('resetAllBtn').addEventListener('click', () => this.resetAll());
        document.getElementById('exportCalendarBtn').addEventListener('click', () => this.exportToCalendar());
        const openReportBtn = document.getElementById('openReportBtn');
        if (openReportBtn) openReportBtn.addEventListener('click', () => this.openReportModal());
        const refreshReportBtn = document.getElementById('refreshReportBtn');
        if (refreshReportBtn) refreshReportBtn.addEventListener('click', () => this.updateReportView());
        const refreshReportModalBtn = document.getElementById('refreshReportModalBtn');
        if (refreshReportModalBtn) refreshReportModalBtn.addEventListener('click', () => this.updateReportView());
        const exportReportPdfBtn = document.getElementById('exportReportPdfBtn');
        if (exportReportPdfBtn) exportReportPdfBtn.addEventListener('click', () => this.exportReportPDF());
        const closeReportBtn = document.getElementById('closeReportBtn');
        if (closeReportBtn) closeReportBtn.addEventListener('click', () => this.closeReportModal());
        const reportModal = document.getElementById('reportModal');
        if (reportModal) {
            reportModal.addEventListener('click', (e) => {
                if (e.target === reportModal) this.closeReportModal();
            });
        }
        document.getElementById('sendChatBtn').addEventListener('click', () => this.handleChatInput());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleChatInput();
        });
        document.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.getElementById('chatInput').value = chip.dataset.question;
                this.handleChatInput();
            });
        });
        document.getElementById('thresholdInput').addEventListener('change', (e) => {
            this.data.threshold = parseFloat(e.target.value) || 50;
            this.saveData();
        });
        document.getElementById('savePercent').addEventListener('input', (e) => {
            this.data.savingsPercent = parseFloat(e.target.value) || 0;
            this.syncWiseSavingState();
            this.saveData();
        });
        document.getElementById('saveGoal').addEventListener('input', (e) => {
            this.data.savingsGoal = parseFloat(e.target.value) || 0;
            this.saveData();
        });
        document.getElementById('languageSelect').addEventListener('change', (e) => {
            this.data.language = window.KedrixI18n
                ? window.KedrixI18n.normalizeLanguage(e.target.value, 'it')
                : e.target.value;
            this.saveData();
            this.applyLanguage();
            this.updateUI();
            this.updateChart();
            try { this.renderActivationCard(true); } catch (_e) {}
            try { this.showActivationModal(true); } catch (_e) {}
            try { this.updateWiseForecastHome(); } catch (_e) {}
            try { this.renderWiseForecastCard && this.renderWiseForecastCard(); } catch (_e) {}
        });
        const chartLegendToggleBtn = document.getElementById('chartLegendToggleBtn');
        if (chartLegendToggleBtn) {
            chartLegendToggleBtn.addEventListener('click', () => {
                this.setChartLegendCollapsed(!this.chartLegendCollapsed);
            });
        }
        const printCategoryPdfBtn = document.getElementById('printCategoryPdfBtn');
        if (printCategoryPdfBtn) {
            printCategoryPdfBtn.addEventListener('click', () => {
                if (this.selectedCategoryForPrint) this.exportCategoryPDF(this.selectedCategoryForPrint);
            });
        }
        const closeCategoryPanelBtn = document.getElementById('closeCategoryPanelBtn');
        if (closeCategoryPanelBtn) {
            closeCategoryPanelBtn.addEventListener('click', () => this.hideCategoryPrintPanel());
        }
        
        const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
        if (manageCategoriesBtn) {
            manageCategoriesBtn.addEventListener('click', () => this.showCategoryManager());
        }
        const saveCategoryBtn = document.getElementById('saveCategoryBtn');
        if (saveCategoryBtn) {
            saveCategoryBtn.addEventListener('click', () => this.saveCategory());
        }
        const saveSubCategoryBtn = document.getElementById('saveSubCategoryBtn');
        if (saveSubCategoryBtn) {
            saveSubCategoryBtn.addEventListener('click', () => this.saveSubcategory());
        }
        const expenseCategorySelect = document.getElementById('expenseCategory');
        if (expenseCategorySelect) {
            expenseCategorySelect.addEventListener('change', () => this.updateSubcategorySelect(expenseCategorySelect.value));
        }
        const closeCategoryManager = document.getElementById('closeCategoryManager');
        if (closeCategoryManager) {
            closeCategoryManager.addEventListener('click', () => this.hideCategoryManager());
        }       
        // ===== TOGGLE FORMATO DATE SPESE FISSE =====
        const daysRadio = document.getElementById('dateFormatDays');
        const monthsRadio = document.getElementById('dateFormatMonths');
        
        if (daysRadio && monthsRadio) {
            // Imposta lo stato iniziale
            daysRadio.checked = this.fixedDateFormat === 'days';
            monthsRadio.checked = this.fixedDateFormat === 'months';
            
            daysRadio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.fixedDateFormat = 'days';
                    this.writeStorage('kedrix-fixed-date-format', 'days');
                    this.updateFixedExpensesList();
                    this.updateFixedStatusHome();
                }
            });
            
            monthsRadio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.fixedDateFormat = 'months';
                    this.writeStorage('kedrix-fixed-date-format', 'months');
                    this.updateFixedExpensesList();
                    this.updateFixedStatusHome();
                }
            });
        }
        
        this.setupAiActions();
                // ===== NUOVI LISTENER PER LA RICERCA =====
        const searchInput = document.getElementById('searchExpenses');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this.updateVariableExpensesList();
            });
        }

        const searchCategory = document.getElementById('searchCategory');
        if (searchCategory) {
            searchCategory.addEventListener('change', (e) => {
                this.searchCategoryFilter = e.target.value;
                this.updateVariableExpensesList();
            });
        }

        const resetSearchBtn = document.getElementById('resetSearchBtn');
        if (resetSearchBtn) {
            resetSearchBtn.addEventListener('click', () => {
                this.resetSearch();
            });
        }
    }

    getWiseScoreStatusTone(score) {
        if (score >= 80) return '🟢';
        if (score >= 65) return '🔵';
        if (score >= 50) return '🟡';
        if (score >= 35) return '🟠';
        return '🔴';
    }

    buildWiseScoreReportData() {
        const wise = this.calculateWiseScoreData();
        const totalIncome = Number(this.calculateTotalIncome() || 0);
        const totalFixed = Number(this.calculateTotalFixedExpenses() || 0);
        const totalVariable = Number(this.calculateTotalVariableExpenses() || 0);
        const unpaidFixed = Number(this.calculateTotalFixedExpensesUnpaid() || 0);
        const remaining = Number(this.calculateRemaining() || 0);
        const dailyBudget = Number(this.calculateDailyBudget() || 0);
        const projectedSavingsEnd = Number(this.calculateProjectedSavingsEnd() || 0);
        const savingsPot = Number(this.data.savingsPot || 0);
        const fixedOccurrences = Array.isArray(this.getFixedOccurrencesInPeriod?.()) ? this.getFixedOccurrencesInPeriod() : [];
        const variableEntries = Object.entries(this.data.variableExpenses || {})
            .flatMap(([date, list]) => (Array.isArray(list) ? list.map(exp => ({ ...exp, date })) : []))
            .sort((a, b) => new Date(this.normalizeIsoDate(b.date)) - new Date(this.normalizeIsoDate(a.date)));

        const topVariableCategories = Object.entries(this.calculateCategoryExpenses())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        return {
            generatedAt: new Date(),
            periodStart: this.data.periodStart,
            periodEnd: this.data.periodEnd,
            wise,
            totals: {
                totalIncome, totalFixed, totalVariable, unpaidFixed, remaining, dailyBudget, projectedSavingsEnd, savingsPot
            },
            fixedOccurrences,
            variableEntries,
            topVariableCategories
        };
    }

    buildWiseMindInsights(report) {
        const totalIncome = Number(report?.totals?.totalIncome || 0);
        const totalFixed = Number(report?.totals?.totalFixed || 0);
        const totalVariable = Number(report?.totals?.totalVariable || 0);
        const unpaidFixed = Number(report?.totals?.unpaidFixed || 0);
        const remaining = Number(report?.totals?.remaining || 0);
        const dailyBudget = Number(report?.totals?.dailyBudget || 0);
        const projectedSavingsEnd = Number(report?.totals?.projectedSavingsEnd || 0);
        const savingsPot = Number(report?.totals?.savingsPot || 0);
        const topCategory = report?.topVariableCategories?.[0] || null;
        const topCategoryName = topCategory?.[0] || this.uiText('reportVariableExpenses').toLowerCase();
        const topCategoryAmount = Number(topCategory?.[1] || 0);
        const variableShare = totalIncome > 0 ? totalVariable / totalIncome : 0;
        const fixedShare = totalIncome > 0 ? unpaidFixed / totalIncome : 0;
        const periodEnd = report?.periodEnd ? new Date(this.normalizeIsoDate(report.periodEnd)) : null;
        const now = report?.generatedAt ? new Date(report.generatedAt) : new Date();
        if (periodEnd && !isNaN(periodEnd.getTime())) periodEnd.setHours(0, 0, 0, 0);
        if (!isNaN(now.getTime())) now.setHours(0, 0, 0, 0);
        const msPerDay = 1000 * 60 * 60 * 24;
        const remainingDays = periodEnd
            ? Math.max(1, Math.floor((periodEnd - now) / msPerDay) + 1)
            : 1;
        const suggestedReserve = remaining > 0 ? Math.max(10, Math.round(remaining * 0.2)) : 0;
        const categoryTrim = topCategoryAmount > 0 ? Math.max(5, Math.round(topCategoryAmount * 0.1)) : 0;
        const roundScoreBoost = (value) => Math.max(1, Math.round(value));
        const estimatedScoreBoost = roundScoreBoost((categoryTrim / Math.max(1, totalIncome)) * 100 * 3);
        const hasAnyData = totalIncome > 0 || totalFixed > 0 || totalVariable > 0;
        const hasWiseData = totalIncome > 0;
        const hasVariableData = totalVariable > 0;

        const highlights = [];
        const alerts = [];
        const actions = [];
        const pushAlert = (priority, tone, title, text) => alerts.push({ priority, tone, title, text });
        const pushAction = (priority, tone, title, text) => actions.push({ priority, tone, title, text });

        if (!hasAnyData) {
            highlights.push({
                tone: 'neutral',
                title: this.uiText('insightWaitingDataTitle'),
                text: this.uiText('insightWaitingDataText')
            });
        } else if (remaining > 0) {
            highlights.push({
                tone: 'positive',
                title: this.uiText('insightPositiveMarginTitle'),
                text: this.uiText('insightPositiveMarginText', { amount: this.formatCurrency(remaining) })
            });
        } else if (remaining < 0) {
            pushAlert(100, 'critical', this.uiText('insightNegativeMarginTitle'), this.uiText('insightNegativeMarginText', { amount: this.formatCurrency(Math.abs(remaining)) }));
        } else {
            highlights.push({
                tone: 'neutral',
                title: this.uiText('insightBalancedMarginTitle'),
                text: this.uiText('insightBalancedMarginText')
            });
        }

        if (hasWiseData && report?.wise?.pillars?.resilience >= 75) {
            highlights.push({
                tone: 'positive',
                title: this.uiText('insightGoodResilienceTitle'),
                text: this.uiText('insightGoodResilienceText', { pillar: this.uiText('wisePillarResilience'), value: report.wise.pillars.resilience })
            });
        }

        if (hasWiseData && projectedSavingsEnd > Math.max(savingsPot, 0)) {
            highlights.push({
                tone: 'positive',
                title: this.uiText('insightFavorableProjectionTitle'),
                text: this.uiText('insightFavorableProjectionText', { amount: this.formatCurrency(projectedSavingsEnd) })
            });
        }

        if (hasWiseData && fixedShare >= 0.45) {
            pushAlert(80, 'warning', this.uiText('insightHighFixedWeightTitle'), this.uiText('insightHighFixedWeightText', { percent: Math.round(fixedShare * 100) }));
        }

        if (hasVariableData && report?.wise?.pillars?.discipline <= 55) {
            pushAlert(70, 'warning', this.uiText('insightDisciplineTitle'), this.uiText('insightDisciplineText', { pillar: this.uiText('wisePillarDiscipline'), value: report.wise.pillars.discipline }));
        }

        if (hasWiseData && variableShare >= 0.3) {
            pushAlert(60, 'warning', this.uiText('insightVariableThresholdTitle'), this.uiText('insightVariableThresholdText', { percent: Math.round(variableShare * 100) }));
        }

        if (unpaidFixed > 0 && unpaidFixed > Math.max(0, remaining)) {
            pushAlert(90, 'warning', this.uiText('insightFixedToAbsorbTitle'), this.uiText('insightFixedToAbsorbText', { amount: this.formatCurrency(unpaidFixed) }));
        }

        if (topCategoryAmount > 0) {
            pushAction(90, 'action', this.uiText('insightReduceTopCategoryTitle'), this.uiText('insightReduceTopCategoryText', { amount: this.formatCurrency(categoryTrim), category: topCategoryName, boost: estimatedScoreBoost }));
        }

        if (remaining > 0) {
            pushAction(80, 'action', this.uiText('insightSaveMarginTitle'), this.uiText('insightSaveMarginText', { amount: this.formatCurrency(suggestedReserve) }));
        }

        if (dailyBudget > 0) {
            pushAction(70, 'action', this.uiText('insightDailyCeilingTitle'), this.uiText('insightDailyCeilingText', { days: remainingDays, amount: this.formatCurrency(dailyBudget) }));
        }

        const sortByPriority = (items) => items
            .sort((a, b) => (b.priority || 0) - (a.priority || 0))
            .slice(0, 3)
            .map(({ priority, ...item }) => item);

        return {
            highlights: highlights.slice(0, 3),
            alerts: sortByPriority(alerts),
            actions: sortByPriority(actions)
        };
    }

    renderWiseScoreReportHTML(report) {
        const fmtDate = (iso) => {
            if (!iso) return this.uiText('unknownDate');
            try {
                const normalized = this.normalizeIsoDate(iso);
                const d = new Date(normalized);
                if (Number.isNaN(d.getTime())) return this.uiText('unknownDate');
                return d.toLocaleDateString(LOCALE_MAP[this.data.language] || 'it-IT');
            } catch (_) {
                return this.uiText('unknownDate');
            }
        };
        const wise = report.wise;
        const tone = this.getWiseScoreStatusTone(wise.score);
        const totalExpenses = Number(report.totals.unpaidFixed || 0) + Number(report.totals.totalVariable || 0);
        const savingsDelta = Number(report.totals.projectedSavingsEnd || 0) - Number(report.totals.savingsPot || 0);
        const expenseCoverage = report.totals.totalIncome > 0
            ? Math.round((report.totals.remaining / report.totals.totalIncome) * 100)
            : 0;
        const summaryItems = [
            this.uiText('reportGeneralStatus', { status: wise.status, score: wise.score }),
            report.totals.remaining >= 0
                ? this.uiText('reportRemainingPositive', { amount: this.formatCurrency(report.totals.remaining) })
                : this.uiText('reportRemainingNegative', { amount: this.formatCurrency(Math.abs(report.totals.remaining)) }) ,
            report.totals.unpaidFixed > 0
                ? this.uiText('reportUnpaidFixedPresent', { amount: this.formatCurrency(report.totals.unpaidFixed) })
                : this.uiText('reportUnpaidFixedNone'),
            savingsDelta >= 0
                ? this.uiText('reportProjectionImprove', { amount: this.formatCurrency(savingsDelta) })
                : this.uiText('reportProjectionReduce', { amount: this.formatCurrency(Math.abs(savingsDelta)) })
        ];

        const fixedRows = report.fixedOccurrences.length
            ? report.fixedOccurrences.map(o => `
                <div class="report-list-item">
                    <div class="report-list-item-top">
                        <strong>${o.name || 'Spesa fissa'}</strong>
                        <strong>${this.formatCurrency(o.amount || 0)}</strong>
                    </div>
                    <div class="report-list-item-sub">${fmtDate(o.dueDate)} · ${o.paid ? this.uiText('reportPaid') : this.uiText('reportPlanned')}</div>
                </div>
            `).join('')
            : `<p class="report-note">${this.uiText('reportNoFixedPeriod')}</p>`;
        const variableRows = report.variableEntries.length
            ? report.variableEntries.slice(0, 8).map(o => `
                <div class="report-list-item">
                    <div class="report-list-item-top">
                        <strong>${o.name || o.description || 'Spesa'}</strong>
                        <strong>${this.formatCurrency(o.amount || 0)}</strong>
                    </div>
                    <div class="report-list-item-sub">${fmtDate(o.date)}${o.category ? ' · ' + this.getExpenseCategoryPath(o) : ''}</div>
                </div>
            `).join('')
            : `<p class="report-note">${this.uiText('reportNoVariablePeriod')}</p>`;
        const categoryRows = report.topVariableCategories.length
            ? report.topVariableCategories.map(([name, amount]) => `
                <div class="report-list-item">
                    <div class="report-list-item-top">
                        <strong>${name}</strong>
                        <strong>${this.formatCurrency(amount || 0)}</strong>
                    </div>
                </div>
            `).join('')
            : `<p class="report-note">${this.uiText('reportNoCategories')}</p>`;
        const summaryRows = summaryItems.map(item => `<div class="report-summary-item">${item}</div>`).join('');
        const topCategory = report.topVariableCategories?.[0];
        const insights = this.buildWiseMindInsights(report);
        const renderInsightCards = (items, emptyText) => items.length
            ? items.map(item => `
                <div class="report-insight-card report-insight-card--${item.tone || 'neutral'}">
                    <div class="report-insight-title">${item.title}</div>
                    <div class="report-insight-text">${item.text}</div>
                </div>
            `).join('')
            : `<div class="report-insight-card report-insight-card--neutral"><div class="report-insight-text">${emptyText}</div></div>`;
        const insightHighlights = renderInsightCards(insights.highlights, 'Nessun punto di forza rilevato automaticamente nel periodo.');
        const insightAlerts = renderInsightCards(insights.alerts, 'Nessun alert prioritario rilevato nel periodo.');
        const insightActions = renderInsightCards(insights.actions, 'Nessuna azione consigliata disponibile nel periodo.');
        const attentionRows = [
            `<div class="report-list-item">
                <div class="report-list-item-top"><strong>${this.uiText('reportDominantCategoryTitle')}</strong><strong>${topCategory ? this.formatCurrency(topCategory[1] || 0) : '—'}</strong></div>
                <div class="report-list-item-sub">${topCategory ? this.uiText('reportDominantCategoryText', { name: topCategory[0] }) : this.uiText('reportNoDominantCategory')}</div>
            </div>`,
            `<div class="report-list-item">
                <div class="report-list-item-top"><strong>${this.uiText('reportResidualMarginTitle')}</strong><strong>${this.formatCurrency(report.totals.remaining)}</strong></div>
                <div class="report-list-item-sub">${report.totals.remaining > 0 ? this.uiText('reportResidualPositiveText') : report.totals.remaining < 0 ? this.uiText('reportResidualNegativeText') : this.uiText('reportResidualNeutralText')}</div>
            </div>`,
            `<div class="report-list-item">
                <div class="report-list-item-top"><strong>${this.uiText('reportDailyBufferTitle')}</strong><strong>${this.formatCurrency(report.totals.dailyBudget)}</strong></div>
                <div class="report-list-item-sub">${report.totals.dailyBudget > 0 ? this.uiText('reportDailyBufferPositiveText') : this.uiText('reportDailyBufferNegativeText')}</div>
            </div>`
        ].join('');

        return `
            <div class="report-sheet report-hero-sheet">
                <div class="report-hero-topline">${this.uiText('reportProfessionalTopline')}</div>
                <div class="report-hero">
                    <div>
                        <div class="report-modal-header report-modal-header--hero">
                            <div>
                                <h3><span class="report-title-mark" aria-hidden="true"></span>${this.uiText('reportPeriodWiseScoreTitle')}</h3>
                                <p class="report-modal-subtitle">${fmtDate(report.periodStart)} → ${fmtDate(report.periodEnd)}</p>
                            </div>
                            <div class="report-status-chip">${tone} ${wise.status}</div>
                        </div>
                        <div class="report-hero-score-row">
                            <div class="report-hero-score-card">
                                <span class="report-hero-score-label">${this.uiText('reportOverallScore')}</span>
                                <span class="report-hero-score-value">${wise.score}<small>/100</small></span>
                            </div>
                            <div class="report-hero-meta">
                                <div class="report-hero-meta-item"><span>${this.uiText('reportIncomePeriod')}</span><strong>${this.formatCurrency(report.totals.totalIncome)}</strong></div>
                                <div class="report-hero-meta-item"><span>${this.uiText('reportOperatingExpenses')}</span><strong>${this.formatCurrency(totalExpenses)}</strong></div>
                                <div class="report-hero-meta-item"><span>${this.uiText('reportResidualCoverage')}</span><strong>${expenseCoverage}%</strong></div>
                            </div>
                        </div>
                        <p class="report-note report-hero-note">${wise.meta}</p>
                    </div>
                </div>

                <div class="report-kpis report-kpis--highlight">
                    <div class="report-kpi"><span class="report-kpi-label">${this.uiText('reportIncomePeriod')}</span><span class="report-kpi-value">${this.formatCurrency(report.totals.totalIncome)}</span></div>
                    <div class="report-kpi"><span class="report-kpi-label">${this.uiText('reportFixedPlanned')}</span><span class="report-kpi-value">${this.formatCurrency(report.totals.totalFixed)}</span></div>
                    <div class="report-kpi"><span class="report-kpi-label">${this.uiText('reportFixedToAbsorb')}</span><span class="report-kpi-value">${this.formatCurrency(report.totals.unpaidFixed)}</span></div>
                    <div class="report-kpi"><span class="report-kpi-label">${this.uiText('reportVariableExpenses')}</span><span class="report-kpi-value">${this.formatCurrency(report.totals.totalVariable)}</span></div>
                    <div class="report-kpi"><span class="report-kpi-label">${this.uiText('reportRemaining')}</span><span class="report-kpi-value">${this.formatCurrency(report.totals.remaining)}</span></div>
                    <div class="report-kpi"><span class="report-kpi-label">${this.uiText('reportDailyBudget')}</span><span class="report-kpi-value">${this.formatCurrency(report.totals.dailyBudget)}</span></div>
                    <div class="report-kpi"><span class="report-kpi-label">${this.uiText('reportPeriodProjection')}</span><span class="report-kpi-value">${this.formatCurrency(report.totals.projectedSavingsEnd)}</span></div>
                </div>
            </div>

            <div class="report-sheet">
                <div class="report-grid-two report-grid-two--top">
                    <div>
                        <div class="report-section-head">
                            <div>
                                <h3><span class="report-title-mark report-title-mark--subtle" aria-hidden="true"></span>${this.uiText('reportQuickReadingTitle')}</h3>
                                <p class="report-modal-subtitle">${this.uiText('reportQuickReadingSubtitle')}</p>
                            </div>
                        </div>
                        <div class="report-summary-grid">${summaryRows}</div>
                    </div>
                    <div>
                        <div class="report-section-head">
                            <div>
                                <h3><span class="report-title-mark report-title-mark--subtle" aria-hidden="true"></span>${this.uiText('reportTopCategoriesTitle')}</h3>
                                <p class="report-modal-subtitle">${this.uiText('reportTopCategoriesSubtitle')}</p>
                            </div>
                        </div>
                        <div class="report-list">${categoryRows}</div>
                    </div>
                </div>
                <div class="report-section-spacer"></div>
                <div class="report-section-head">
                    <div>
                        <h3><span class="report-title-mark report-title-mark--subtle" aria-hidden="true"></span>${this.uiText('reportPillarsTitle')}</h3>
                        <p class="report-modal-subtitle">${this.uiText('reportPillarsSubtitle')}</p>
                    </div>
                </div>
                <div class="report-pillar-list">
                    <div class="report-pillar-item">
                        <div class="report-pillar-head"><strong>${this.uiText('wisePillarStability')}</strong><strong>${wise.pillars.stability}/100</strong></div>
                        <div class="report-pillar-bar"><div class="report-pillar-fill" style="width:${wise.pillars.stability}%"></div></div>
                    </div>
                    <div class="report-pillar-item">
                        <div class="report-pillar-head"><strong>${this.uiText('wisePillarDiscipline')}</strong><strong>${wise.pillars.discipline}/100</strong></div>
                        <div class="report-pillar-bar"><div class="report-pillar-fill" style="width:${wise.pillars.discipline}%"></div></div>
                    </div>
                    <div class="report-pillar-item">
                        <div class="report-pillar-head"><strong>${this.uiText('wisePillarResilience')}</strong><strong>${wise.pillars.resilience}/100</strong></div>
                        <div class="report-pillar-bar"><div class="report-pillar-fill" style="width:${wise.pillars.resilience}%"></div></div>
                    </div>
                </div>
            </div>

            <div class="report-sheet">
                <div class="report-grid-two">
                    <div>
                        <div class="report-section-head">
                            <div>
                                <h3><span class="report-title-mark report-title-mark--subtle" aria-hidden="true"></span>${this.uiText('reportRecurringTitle')}</h3>
                                <p class="report-modal-subtitle">${this.uiText('reportRecurringSubtitle')}</p>
                            </div>
                        </div>
                        <div class="report-list">${fixedRows}</div>
                    </div>
                    <div>
                        <div class="report-section-head">
                            <div>
                                <h3><span class="report-title-mark report-title-mark--subtle" aria-hidden="true"></span>${this.uiText('reportVariableMovementsTitle')}</h3>
                                <p class="report-modal-subtitle">${this.uiText('reportVariableMovementsSubtitle')}</p>
                            </div>
                        </div>
                        <div class="report-list">${variableRows}</div>
                    </div>
                </div>
            </div>

            <div class="report-sheet">
                <div class="report-grid-two">
                    <div>
                        <div class="report-section-head">
                            <div>
                                <h3><span class="report-title-mark report-title-mark--subtle" aria-hidden="true"></span>${this.uiText('reportFocusTitle')}</h3>
                                <p class="report-modal-subtitle">${this.uiText('reportFocusSubtitle')}</p>
                            </div>
                        </div>
                        <div class="report-list">
                            <div class="report-list-item">
                                <div class="report-list-item-top"><strong>${this.uiText('savingsPlanTitle')}</strong><strong>${this.formatCurrency(report.totals.savingsPot)}</strong></div>
                                <div class="report-list-item-sub">${this.uiText('savedSoFar')}</div>
                            </div>
                            <div class="report-list-item">
                                <div class="report-list-item-top"><strong>${this.uiText('reportPeriodProjection')}</strong><strong>${this.formatCurrency(report.totals.projectedSavingsEnd)}</strong></div>
                                <div class="report-list-item-sub">${this.uiText('basedOnCurrentTrend')}</div>
                            </div>
                            <div class="report-list-item">
                                <div class="report-list-item-top"><strong>${this.uiText('unpaidFixedExpenses')}</strong><strong>${this.formatCurrency(report.totals.unpaidFixed)}</strong></div>
                                <div class="report-list-item-sub">${this.uiText('residualImpactPeriod')}</div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div class="report-section-head">
                            <div>
                                <h3><span class="report-title-mark report-title-mark--subtle" aria-hidden="true"></span>${this.uiText('focusOfPeriod')}</h3>
                                <p class="report-modal-subtitle">${this.uiText('focusPeriodSubtitle')}</p>
                            </div>
                        </div>
                        <div class="report-list">${attentionRows}</div>
                    </div>
                </div>

                <div class="report-section-spacer"></div>

                <div class="report-section-head">
                    <div>
                        <h3><span class="report-title-mark report-title-mark--subtle" aria-hidden="true"></span>${this.uiText('reportInsightsTitle')}</h3>
                        <p class="report-modal-subtitle">${this.uiText('reportInsightsSubtitle')}</p>
                    </div>
                </div>
                <div class="report-insights-grid">
                    <div class="report-insight-column">
                        <div class="report-insight-column-head">${this.uiText('reportInsightHighlights')}</div>
                        <div class="report-insight-list">${insightHighlights}</div>
                    </div>
                    <div class="report-insight-column">
                        <div class="report-insight-column-head">${this.uiText('reportInsightAlerts')}</div>
                        <div class="report-insight-list">${insightAlerts}</div>
                    </div>
                    <div class="report-insight-column">
                        <div class="report-insight-column-head">${this.uiText('reportInsightActions')}</div>
                        <div class="report-insight-list">${insightActions}</div>
                    </div>
                </div>
            </div>
        `;
    }

    updateReportView() {
        const contentEl = document.getElementById('reportViewContent');
        const generatedAtEl = document.getElementById('reportGeneratedAt');
        if (!contentEl) return;
        const report = this.buildWiseScoreReportData();
        contentEl.innerHTML = this.renderWiseScoreReportHTML(report);
        if (generatedAtEl) {
            generatedAtEl.dataset.dynamicReportTs = '1'; generatedAtEl.textContent = `${this.uiText('reportGeneratedAtPrefix')} ${report.generatedAt.toLocaleDateString(LOCALE_MAP[this.data.language] || 'it-IT')} ${this.data.language === 'it' ? 'alle' : this.data.language === 'fr' ? 'à' : this.data.language === 'es' ? 'a las' : 'at'} ${report.generatedAt.toLocaleTimeString(LOCALE_MAP[this.data.language] || 'it-IT', { hour: '2-digit', minute: '2-digit' })}`;
        }
    }

    openReportModal() {
        const modal = document.getElementById('reportModal');
        if (!modal) return;
        this.updateReportView();
        modal.style.display = 'flex';
        this.applyPrivacyState();
    }

    closeReportModal() {
        const modal = document.getElementById('reportModal');
        if (!modal) return;
        modal.style.display = 'none';
    }

    getPrintTemplateLabels() {
        const lang = resolveRuntimeLang(this);
        const map = {
            it: {
                coverEyebrow: 'FINANCIAL INTELLIGENCE REPORT',
                coverSubtitle: 'Report finanziario intelligente del periodo analizzato',
                executiveTitle: 'Executive Summary',
                executiveSubtitle: 'Quadro sintetico del periodo stipendio → stipendio, con indicatori chiave e stato finanziario attuale.',
                periodLabel: 'Periodo',
                generatedLabel: 'Generato il',
                overallStatus: 'Stato generale',
                overallScore: 'WiseScore',
                income: 'Entrate periodo',
                fixed: 'Spese fisse',
                variable: 'Spese variabili',
                remaining: 'Rimanenza',
                dailyBudget: 'Budget giornaliero',
                projection: 'Proiezione fine periodo',
                reserve: 'Piano risparmi',
                metricsTitle: 'Metriche chiave',
                insightsTitle: 'Executive focus',
                insightsText: 'Il report integra il motore WiseScore™, le metriche operative del periodo e gli insight WiseMind™ per offrire una lettura chiara, professionale e stampabile della situazione finanziaria corrente.',
                categoryCoverSubtitle: 'Report stampabile dei movimenti associati alla categoria selezionata.',
                categoryDetailTitle: 'Dettaglio categoria'
            },
            en: {
                coverEyebrow: 'FINANCIAL INTELLIGENCE REPORT',
                coverSubtitle: 'Smart financial report for the analyzed salary period',
                executiveTitle: 'Executive Summary',
                executiveSubtitle: 'Compact overview of the salary-to-salary period with key indicators and current financial status.',
                periodLabel: 'Period',
                generatedLabel: 'Generated on',
                overallStatus: 'Overall status',
                overallScore: 'WiseScore',
                income: 'Period income',
                fixed: 'Fixed expenses',
                variable: 'Variable expenses',
                remaining: 'Remaining balance',
                dailyBudget: 'Daily budget',
                projection: 'End-period projection',
                reserve: 'Savings plan',
                metricsTitle: 'Key metrics',
                insightsTitle: 'Executive focus',
                insightsText: 'This report combines the WiseScore™ engine, the core period metrics and WiseMind™ insights to deliver a clear, professional and printable view of the current financial situation.',
                categoryCoverSubtitle: 'Printable report of the movements linked to the selected category.',
                categoryDetailTitle: 'Category detail'
            },
            fr: {
                coverEyebrow: 'FINANCIAL INTELLIGENCE REPORT',
                coverSubtitle: 'Rapport financier intelligent de la période analysée',
                executiveTitle: 'Résumé exécutif',
                executiveSubtitle: 'Vue synthétique de la période salaire → salaire avec indicateurs clés et état financier actuel.',
                periodLabel: 'Période',
                generatedLabel: 'Généré le',
                overallStatus: 'Statut général',
                overallScore: 'WiseScore',
                income: 'Revenus de période',
                fixed: 'Dépenses fixes',
                variable: 'Dépenses variables',
                remaining: 'Reste disponible',
                dailyBudget: 'Budget quotidien',
                projection: 'Projection fin de période',
                reserve: 'Plan d’épargne',
                metricsTitle: 'Indicateurs clés',
                insightsTitle: 'Focus exécutif',
                insightsText: 'Le rapport combine le moteur WiseScore™, les métriques opérationnelles de la période et les insights WiseMind™ pour offrir une lecture claire, professionnelle et imprimable de la situation financière actuelle.',
                categoryCoverSubtitle: 'Rapport imprimable des mouvements liés à la catégorie sélectionnée.',
                categoryDetailTitle: 'Détail catégorie'
            },
            es: {
                coverEyebrow: 'FINANCIAL INTELLIGENCE REPORT',
                coverSubtitle: 'Informe financiero inteligente del período analizado',
                executiveTitle: 'Resumen ejecutivo',
                executiveSubtitle: 'Vista compacta del período salario → salario con indicadores clave y estado financiero actual.',
                periodLabel: 'Período',
                generatedLabel: 'Generado el',
                overallStatus: 'Estado general',
                overallScore: 'WiseScore',
                income: 'Ingresos del período',
                fixed: 'Gastos fijos',
                variable: 'Gastos variables',
                remaining: 'Saldo restante',
                dailyBudget: 'Presupuesto diario',
                projection: 'Proyección fin de período',
                reserve: 'Plan de ahorro',
                metricsTitle: 'Métricas clave',
                insightsTitle: 'Enfoque ejecutivo',
                insightsText: 'El informe integra el motor WiseScore™, las métricas operativas del período y los insights WiseMind™ para ofrecer una lectura clara, profesional e imprimible de la situación financiera actual.',
                categoryCoverSubtitle: 'Informe imprimible de los movimientos asociados a la categoría seleccionada.',
                categoryDetailTitle: 'Detalle de categoría'
            }
        };
        return map[lang] || map.it;
    }

    buildReportExecutiveSummaryHTML(report) {
        const labels = this.getPrintTemplateLabels();
        const wise = report?.wise || { status: '—', score: 0 };
        const totals = report?.totals || {};
        const metrics = [
            { label: labels.income, value: this.formatCurrency(totals.totalIncome || 0) },
            { label: labels.fixed, value: this.formatCurrency(totals.totalFixed || 0) },
            { label: labels.variable, value: this.formatCurrency(totals.totalVariable || 0) },
            { label: labels.remaining, value: this.formatCurrency(totals.remaining || 0) },
            { label: labels.dailyBudget, value: this.formatCurrency(totals.dailyBudget || 0) },
            { label: labels.projection, value: this.formatCurrency(totals.projectedSavingsEnd || 0) },
            { label: labels.reserve, value: this.formatCurrency(totals.savingsPot || 0) }
        ];
        const metricCards = metrics.map(item => `
            <div class="bw-print-metric-card">
                <span>${this.escapeHTML(item.label)}</span>
                <strong>${this.escapeHTML(item.value)}</strong>
            </div>
        `).join('');

        return `
        <section class="summary-page">
            <div class="bw-executive-sheet">
                <div class="bw-executive-head">
                    <div>
                        <div class="bw-section-eyebrow">${this.escapeHTML(labels.executiveTitle)}</div>
                        <h2>${this.escapeHTML(labels.executiveTitle)}</h2>
                        <p>${this.escapeHTML(labels.executiveSubtitle)}</p>
                    </div>
                    <div class="bw-status-chip">${this.escapeHTML(String(wise.status || '—'))}</div>
                </div>
                <div class="bw-executive-hero">
                    <div class="bw-executive-score-card">
                        <span>${this.escapeHTML(labels.overallScore)}</span>
                        <strong>${this.escapeHTML(String(wise.score || 0))}<small>/100</small></strong>
                    </div>
                    <div class="bw-executive-story">
                        <div class="bw-executive-story-grid">
                            <div class="bw-story-card">
                                <span>${this.escapeHTML(labels.periodLabel)}</span>
                                <strong>${this.escapeHTML(report.periodStart || '—')} → ${this.escapeHTML(report.periodEnd || '—')}</strong>
                            </div>
                            <div class="bw-story-card">
                                <span>${this.escapeHTML(labels.overallStatus)}</span>
                                <strong>${this.escapeHTML(String(wise.status || '—'))}</strong>
                            </div>
                        </div>
                        <p class="bw-executive-story-text">${this.escapeHTML(labels.insightsText)}</p>
                    </div>
                </div>
                <div class="bw-section-eyebrow">${this.escapeHTML(labels.metricsTitle)}</div>
                <div class="bw-print-metrics-grid">${metricCards}</div>
            </div>
        </section>`;
    }

    getPdfCoverPath(type = 'wisescore', language = this.data.language || 'it') {
        const safeLang = String(language || 'it').toLowerCase();
        const lang = ['it', 'en', 'es', 'fr'].includes(safeLang) ? safeLang : 'en';
        const safeType = type === 'categories' ? 'categories' : 'wisescore';
        const base = window.location.origin;
        return `${base}/assets/cover/${safeType}-cover.${lang}.svg`;
    }

    buildFlagshipCoverHTML(options = {}) {
        const reportType = options.reportType === 'categories' ? 'categories' : 'wisescore';
        const coverSrc = this.getPdfCoverPath(reportType, options.language || this.data.language || 'it');
        const fallbackSrc = `${window.location.origin}/assets/cover/${reportType}-cover.svg`;
        const altText = reportType === 'categories' ? 'Kedrix Categories Report cover' : 'Kedrix WiseScore Report cover';
        return `
        <section class="cover-page cover-page--svg">
            <div class="pdf-svg-cover-wrap">
                <img class="pdf-svg-cover" src="${coverSrc}" alt="${altText}" onerror="if(this.dataset.fallback!=='1'){this.dataset.fallback='1';this.src='${fallbackSrc}';}">
            </div>
        </section>`;
    }

    buildReportPrintHTML(report) {
        const locale = LOCALE_MAP[this.data.language] || 'it-IT';
        const labels = this.getPrintTemplateLabels();
        const generatedAt = report.generatedAt.toLocaleDateString(locale) + ' ' + report.generatedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        const reportHtml = this.renderWiseScoreReportHTML(report);
        const coverHtml = this.buildFlagshipCoverHTML({
            reportType: 'wisescore',
            language: this.data.language || 'it'
        });
        const executiveHtml = this.buildReportExecutiveSummaryHTML(report);
        return `<!DOCTYPE html>
<html lang="${this.data.language || 'it'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Report WiseScore</title>
<style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #0f172a; font-family: Inter, Arial, Helvetica, sans-serif; }
    body { padding: 0; }
    .print-shell { max-width: 190mm; margin: 0 auto; }
    .cover-page, .summary-page { page-break-after: always; }
    .cover-page--svg { break-after: page; }
    .pdf-svg-cover-wrap { min-height: 277mm; border-radius: 24px; overflow: hidden; background: #050A16; }
    .pdf-svg-cover { display:block; width:100%; height:277mm; object-fit:cover; }
    .report-title-mark { display:inline-flex; width:10px; height:10px; margin-right:8px; border-radius:999px; vertical-align:middle; background:linear-gradient(135deg,#60A5FA 0%,#2563EB 100%); box-shadow:0 0 0 1px rgba(37,99,235,0.16); }
    .report-title-mark--subtle { width:8px; height:8px; margin-right:7px; }
    .report-sheet { page-break-inside: avoid; background: #ffffff; border: 1px solid #d7e0ea; border-radius: 18px; padding: 14px; margin-bottom: 10px; box-shadow: 0 3px 10px rgba(15, 23, 42, 0.04); }
    .report-hero-sheet { background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%); }
    .report-hero-topline { margin-bottom: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #2563eb; }
    .report-modal-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .report-modal-header h3, .report-section-head h3 { margin: 0 0 6px 0; font-size: 18px; }
    .report-modal-subtitle, .report-note, .report-list-item-sub, .print-footer { color: #475569; }
    .report-hero-score-row, .report-grid-two, .report-summary-grid, .report-kpis, .report-hero-meta { display: grid; gap: 10px; }
    .report-hero-score-row { grid-template-columns: 1.2fr 1fr; align-items: stretch; margin-bottom: 12px; }
    .report-hero-score-card { border: 1px solid #bfdbfe; border-radius: 16px; padding: 14px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); }
    .report-hero-score-label { display: block; margin-bottom: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1d4ed8; }
    .report-hero-score-value { display: block; font-size: 34px; font-weight: 800; line-height: 1; }
    .report-hero-score-value small { font-size: 14px; }
    .report-hero-meta { grid-template-columns: 1fr; }
    .report-hero-meta-item, .report-summary-item, .report-kpi, .report-pillar-item, .report-list-item { border: 1px solid #dbeafe; border-radius: 12px; padding: 10px; background: #f8fbff; }
    .report-hero-meta-item span, .report-kpi-label { display: block; margin-bottom: 4px; font-size: 11px; color: #475569; }
    .report-hero-meta-item strong, .report-kpi-value { display: block; font-size: 16px; font-weight: 700; }
    .report-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 10px; }
    .report-kpis--highlight .report-kpi { min-height: 72px; }
    .report-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .report-summary-item { background: #ffffff; }
    .report-grid-two { grid-template-columns: 1fr 1fr; }
    .report-pillar-list, .report-list { display: flex; flex-direction: column; gap: 8px; }
    .report-pillar-head, .report-list-item-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
    .report-pillar-bar { width: 100%; height: 10px; background: #dbeafe; border-radius: 999px; overflow: hidden; }
    .report-pillar-fill { height: 100%; background: linear-gradient(90deg, #2563eb 0%, #0ea5e9 100%); border-radius: 999px; }
    .report-status-chip, .bw-status-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: #eff6ff; border: 1px solid #bfdbfe; font-weight: 700; font-size: 12px; }
    .report-section-head { margin-bottom: 10px; }
    .report-hero-note { margin: 0; }
    .print-footer { margin-top: 10px; font-size: 11px; text-align: center; }
    .report-list-item, .report-pillar-item, .report-summary-item, .report-kpi, .report-hero-meta-item { page-break-inside: avoid; word-break: normal; overflow-wrap: normal; }
    .report-list-item-top { display: block; }
    .report-list-item-top strong { display: block; }
    .report-list-item-top strong:last-child { margin-top: 4px; }
    .report-list-item-sub { white-space: normal; word-break: normal; overflow-wrap: normal; hyphens: none; line-height: 1.45; }
    .report-insights-grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:10px; }
    .report-insight-column { min-width:0; }
    .report-insight-column-head { margin-bottom:8px; font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#2563eb; }
    .report-insight-list { display:flex; flex-direction:column; gap:8px; min-width:0; }
    .report-insight-card { page-break-inside: avoid; border:1px solid #dbeafe; border-radius:12px; padding:10px; background:#f8fbff; min-width:0; overflow:visible; }
    .report-insight-title { font-weight:800; margin-bottom:6px; white-space:normal; word-break:normal; overflow-wrap:normal; hyphens:none; }
    .report-insight-text { color:#475569; line-height:1.45; white-space:normal; word-break:normal; overflow-wrap:normal; hyphens:none; }
    .bw-flagship-cover { position: relative; min-height: 277mm; overflow: hidden; border-radius: 24px; background: #050A16; color: #fff; padding: 24mm 16mm 16mm; box-shadow: 0 8px 28px rgba(5, 10, 22, 0.18); }
    .bw-cover-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(22,32,64,0.75) 1px, transparent 1px), linear-gradient(90deg, rgba(22,32,64,0.75) 1px, transparent 1px); background-size: 34px 34px; opacity: 0.42; }
    .bw-cover-orb { position: absolute; border-radius: 999px; filter: blur(0px); opacity: 0.98; }
    .bw-cover-orb--one { width: 270px; height: 270px; right: -70px; top: -30px; background: radial-gradient(circle at 30% 30%, rgba(37,99,235,0.96), rgba(30,58,138,0.96)); }
    .bw-cover-orb--two { width: 220px; height: 220px; left: -60px; bottom: -40px; background: radial-gradient(circle at 40% 40%, rgba(37,99,235,0.86), rgba(14,165,233,0.65)); }
    .bw-cover-watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 180px; font-weight: 800; letter-spacing: 0.06em; color: rgba(20,32,74,0.88); user-select: none; }
    .bw-cover-content { position: relative; z-index: 4; display: flex; min-height: 100%; flex-direction: column; justify-content: center; }
    .bw-cover-eyebrow, .bw-section-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.28em; text-transform: uppercase; color: #93c5fd; }
    .bw-cover-title { margin: 14px 0 28px; font-size: 56px; line-height: 0.95; letter-spacing: 0.03em; color: #C8A75B; }
    .bw-cover-subtitle { max-width: 108mm; margin: 0 0 24px; font-size: 18px; line-height: 1.5; color: rgba(255,255,255,0.92); }
    .bw-cover-meta { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; max-width: 145mm; }
    .bw-cover-meta-card { padding: 12px 14px; border: 1px solid rgba(191,219,254,0.2); border-radius: 16px; background: rgba(11,18,32,0.44); backdrop-filter: blur(6px); font-size: 12px; color: rgba(255,255,255,0.92); }
    .bw-cover-brand { margin-top: 28px; font-size: 13px; letter-spacing: 0.08em; color: rgba(255,255,255,0.82); }
    .bw-cover-network, .bw-cover-chart { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
    .bw-cover-network .node { position: absolute; width: 8px; height: 8px; border: 1px solid #C8A75B; border-radius: 999px; }
    .bw-cover-network .link { position: absolute; display: block; height: 2px; background: linear-gradient(90deg, rgba(200,167,91,0.95), rgba(200,167,91,0.35)); transform-origin: left center; }
    .bw-cover-network .n1 { left: 28mm; top: 86mm; } .bw-cover-network .n2 { left: 48mm; top: 74mm; } .bw-cover-network .n3 { left: 68mm; top: 84mm; } .bw-cover-network .n4 { left: 88mm; top: 68mm; } .bw-cover-network .n5 { left: 108mm; top: 78mm; } .bw-cover-network .n6 { left: 128mm; top: 64mm; }
    .bw-cover-network .l1 { left: 31mm; top: 89mm; width: 24mm; transform: rotate(-24deg); } .bw-cover-network .l2 { left: 51mm; top: 77mm; width: 23mm; transform: rotate(23deg); } .bw-cover-network .l3 { left: 71mm; top: 87mm; width: 24mm; transform: rotate(-34deg); } .bw-cover-network .l4 { left: 91mm; top: 71mm; width: 24mm; transform: rotate(18deg); } .bw-cover-network .l5 { left: 111mm; top: 80mm; width: 24mm; transform: rotate(-28deg); }
    .bw-cover-chart .chart-dot { position: absolute; width: 8px; height: 8px; border-radius: 999px; border: 1px solid currentColor; background: transparent; }
    .bw-cover-chart .chart-line { position: absolute; display: block; height: 3px; transform-origin: left center; border-radius: 999px; }
    .bw-cover-chart .chart-bar { position: absolute; width: 12px; border-radius: 12px 12px 0 0; background: linear-gradient(180deg, rgba(37,99,235,0.92), rgba(37,99,235,0.32)); }
    .bw-cover-chart .d1 { left: 26mm; bottom: 37mm; color: #22C55E; } .bw-cover-chart .d2 { left: 48mm; bottom: 42mm; color: #34D399; } .bw-cover-chart .d3 { left: 70mm; bottom: 49mm; color: #2563EB; } .bw-cover-chart .d4 { left: 92mm; bottom: 55mm; color: #22C55E; } .bw-cover-chart .d5 { left: 114mm; bottom: 64mm; color: #34D399; } .bw-cover-chart .d6 { left: 136mm; bottom: 77mm; color: #2563EB; }
    .bw-cover-chart .s1 { left: 28mm; bottom: 40mm; width: 23mm; background: linear-gradient(90deg,#22C55E,#34D399); transform: rotate(12deg); } .bw-cover-chart .s2 { left: 50mm; bottom: 45mm; width: 23mm; background: linear-gradient(90deg,#34D399,#2563EB); transform: rotate(17deg); } .bw-cover-chart .s3 { left: 72mm; bottom: 52mm; width: 23mm; background: linear-gradient(90deg,#2563EB,#22C55E); transform: rotate(14deg); } .bw-cover-chart .s4 { left: 94mm; bottom: 59mm; width: 23mm; background: linear-gradient(90deg,#22C55E,#34D399); transform: rotate(21deg); } .bw-cover-chart .s5 { left: 116mm; bottom: 69mm; width: 23mm; background: linear-gradient(90deg,#34D399,#2563EB); transform: rotate(28deg); }
    .bw-cover-chart .b1 { right: 44mm; bottom: 24mm; height: 28mm; } .bw-cover-chart .b2 { right: 36mm; bottom: 24mm; height: 34mm; } .bw-cover-chart .b3 { right: 28mm; bottom: 24mm; height: 41mm; } .bw-cover-chart .b4 { right: 20mm; bottom: 24mm; height: 48mm; }
    .bw-executive-sheet { min-height: 277mm; border: 1px solid #d7e0ea; border-radius: 24px; background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); padding: 16mm 14mm; box-shadow: 0 6px 18px rgba(15,23,42,0.06); }
    .bw-executive-head { display:flex; justify-content:space-between; align-items:flex-start; gap: 14px; margin-bottom: 16px; }
    .bw-executive-head h2 { margin: 8px 0 8px; font-size: 32px; color: #0f172a; }
    .bw-executive-head p { margin: 0; max-width: 120mm; color: #475569; font-size: 13px; line-height: 1.5; }
    .bw-executive-hero { display:grid; grid-template-columns: 0.9fr 1.1fr; gap: 14px; margin-bottom: 16px; }
    .bw-executive-score-card { border-radius: 20px; padding: 18px; background: linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%); color:#fff; box-shadow: inset 0 0 0 1px rgba(191,219,254,0.14); }
    .bw-executive-score-card span { display:block; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:#bfdbfe; }
    .bw-executive-score-card strong { display:block; margin-top:12px; font-size:48px; line-height:1; } .bw-executive-score-card small { font-size:16px; }
    .bw-executive-story { border-radius: 20px; padding: 18px; background: #ffffff; border:1px solid #dbeafe; }
    .bw-executive-story-grid { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; margin-bottom: 12px; }
    .bw-story-card { padding: 12px; border:1px solid #e2e8f0; border-radius: 14px; background: #f8fbff; }
    .bw-story-card span, .bw-print-metric-card span { display:block; margin-bottom:4px; font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; }
    .bw-story-card strong, .bw-print-metric-card strong { display:block; font-size:18px; color:#0f172a; }
    .bw-executive-story-text { margin:0; color:#475569; font-size:13px; line-height:1.65; }
    .bw-print-metrics-grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:10px; margin-top: 12px; }
    .bw-print-metric-card { padding:12px; border-radius:16px; border:1px solid #dbeafe; background:#ffffff; min-height:74px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print-shell { max-width: none; } }
    @media (max-width: 900px) {
        .bw-cover-meta, .bw-executive-hero, .bw-executive-story-grid, .bw-print-metrics-grid, .report-hero-score-row, .report-kpis, .report-grid-two, .report-summary-grid { grid-template-columns: 1fr; }
        .bw-cover-title { font-size: 46px; }
    }
</style>
</head>
<body>
    <div class="print-shell">
        ${coverHtml}
        ${executiveHtml}
        ${reportHtml}
        <div class="print-footer">${this.t('categoryPrintFooter')}</div>
    </div>
</body>
</html>`;
    }

    async printHTMLInHiddenFrame(html, fileTitle = 'Kedrix_Report') {
        const baseHref = `${window.location.origin}/`;
        const normalizedHtml = html.includes('<base href=')
            ? html
            : html.replace('<head>', `<head><base href="${baseHref}">`);

        return new Promise((resolve, reject) => {
            const frame = document.createElement('iframe');
            frame.setAttribute('aria-hidden', 'true');
            frame.style.position = 'fixed';
            frame.style.width = '0';
            frame.style.height = '0';
            frame.style.right = '0';
            frame.style.bottom = '0';
            frame.style.opacity = '0';
            frame.style.border = '0';
            frame.style.pointerEvents = 'none';

            let finished = false;
            const cleanup = () => {
                try { frame.onload = null; } catch {}
                try { if (frame.parentNode) frame.parentNode.removeChild(frame); } catch {}
            };
            const settle = (ok, err = null) => {
                if (finished) return;
                finished = true;
                setTimeout(cleanup, 800);
                if (ok) resolve(); else reject(err || new Error('Print frame failed'));
            };

            frame.onload = async () => {
                try {
                    const win = frame.contentWindow;
                    const doc = win.document;
                    doc.open();
                    doc.write(normalizedHtml);
                    doc.close();

                    if (doc.fonts && doc.fonts.ready) {
                        await Promise.race([
                            doc.fonts.ready,
                            new Promise(r => setTimeout(r, 1200))
                        ]);
                    }

                    const images = Array.from(doc.images || []);
                    await Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(r => {
                        img.onload = () => r();
                        img.onerror = () => r();
                    })));

                    await new Promise(r => setTimeout(r, 350));

                    const afterPrint = () => settle(true);
                    win.addEventListener('afterprint', afterPrint, { once: true });
                    setTimeout(() => settle(true), 4000);

                    try { doc.title = fileTitle; } catch {}
                    try { win.focus(); } catch {}
                    win.print();
                } catch (err) {
                    console.warn('Print frame error:', err);
                    settle(false, err);
                }
            };

            document.body.appendChild(frame);
            frame.src = 'about:blank';
        });
    }

    async exportReportPDF() {
        const report = this.buildWiseScoreReportData();
        const html = this.buildReportPrintHTML(report);
        const fileTitle = `Kedrix_Report_${report.periodStart}_${report.periodEnd}`.replace(/[^a-z0-9-_]+/gi, '_');
        try {
            await this.printHTMLInHiddenFrame(html, fileTitle);
        } catch (err) {
            console.warn('Export PDF/print non riuscito:', err);
        }
    }

    updateUI() {
        // Allinea automaticamente il periodo all'ultimo stipendio (se presente)
        this.ensureSalaryPeriod();
        this.checkSavingsPeriodRolloverAndPrompt();
        document.getElementById('dailyBudget').textContent = this.formatCurrency(this.calculateDecisionDailyBudget());
        document.getElementById('remaining').textContent = this.formatCurrency(this.calculateAvailableBalance());
        document.getElementById('daysLeft').textContent = this.getDaysLeft();

        // Piano risparmi (fondo separato dal budget)
        const potEl = document.getElementById('savingsPot');
        const projEl = document.getElementById('savingsProjected');
        if (potEl) potEl.textContent = this.formatCurrency(this.getAccumulatedSavings());
                if (projEl) projEl.textContent = `${this.t('periodAllocationLabel')}: ${this.formatCurrency(this.syncWiseSavingState())}`;
        this.updateHomeHeroMetrics();
        this.applyPrivacyState();


        const remainingStatus = document.getElementById('remainingStatus');
        const remainingTrend = document.getElementById('remainingTrend');
        const remaining = this.calculateAvailableBalance();
        if (remainingStatus) {
            remainingStatus.textContent = remaining >= 0 ? '✅' : '⚠️';
            remainingStatus.title = remaining >= 0 ? this.t('positiveBalance') : this.t('negativeBalance');
        }
        if (remainingTrend) {
            remainingTrend.textContent = this.t('vsYesterday0');
        }

        this.updatePeriodInfo();
        this.updateFooterPeriodState();
        this.updateIncomeList();
        this.updateFixedExpensesList();
        this.updateVariableExpensesList();
        this.updateFixedStatusHome();
        this.updateWiseForecastHome();
        this.updateWiseScoreHome();
        const reportModal = document.getElementById('reportModal');
        if (reportModal && reportModal.style.display === 'flex') {
            this.updateReportView();
        }

        document.getElementById('savePercent').value = this.data.savingsPercent || 0;
        document.getElementById('saveGoal').value = this.data.savingsGoal || 0;
        const potInput = document.getElementById('savingsPotInput');
        if (potInput) potInput.value = this.data.savingsPot || 0;
        document.getElementById('thresholdInput').value = this.data.threshold || 50;

        // Usa il nuovo widget risparmio migliorato
        this.updateSavingsWidget();
        this.updateWiseDecisionCard();

        const guideMessage = document.getElementById('guideMessage');
        if (guideMessage) guideMessage.style.display = (!this.data.incomes || this.data.incomes.length === 0) ? 'block' : 'none';

        const last7Days = this.getLast7DaysData();
        const last7DaysBudget = this.getLast7DaysBudget();
        this.drawSparkline('budgetSparkline', last7DaysBudget, '#0ea5e9');
        const remainingColor = this.calculateAvailableBalance() >= 0 ? '#2dc653' : '#ef233c';
        this.drawSparkline('remainingSparkline', last7Days, remainingColor);

        this.generateAiSuggestion();
    }

    // ========== FUNZIONI DI VISUALIZZAZIONE LISTE ==========
    
    updateIncomeList() {
        const container = document.getElementById('incomeList');
        if (!container) return;

        if (!this.data.incomes || this.data.incomes.length === 0) {
            container.innerHTML = `<p class="chart-note">${this.t('noIncome')}</p>`;
        } else {
            container.innerHTML = this.data.incomes.map(inc => `
                <div class="expense-item" data-income-id="${inc.id}">
                    <div class="expense-info">
                        <span class="expense-name">${inc.desc || '?'}</span>
                        <span class="expense-category">${inc.date || ''}</span>
                    </div>
                    <span class="expense-amount" style="color: var(--success)">+${this.formatCurrency(inc.amount || 0)}</span>
                    <div class="expense-actions">
                        <button class="delete-income-btn icon-only-btn" title="${this.t('delete')}" aria-label="${this.t('delete')}" data-id="${inc.id}"></button>
                    </div>
                </div>
            `).join('');
        }

        document.querySelectorAll('.delete-income-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(e.currentTarget.dataset.id);
                this.deleteIncome(id);
            });
        });

        const totalDisplay = document.getElementById('totalIncomeDisplay');
        if (totalDisplay) {
            totalDisplay.textContent = this.formatCurrency(this.calculateTotalIncome());
        }
    }

    getFixedExpenseLiveStatus(exp) {
        try {
            const occs = Array.isArray(this.getFixedOccurrencesInPeriod?.()) ? this.getFixedOccurrencesInPeriod() : [];
            const expId = exp?.id ?? null;
            const name = (exp?.name || '').toString().trim().toLowerCase();
            const amount = Number(exp?.amount || 0);
            const day = parseInt(exp?.day, 10) || 0;

            let candidates = occs.filter(o => expId != null && o?.expId === expId);

            if (!candidates.length) {
                candidates = occs.filter(o => {
                    const sameName = (o?.name || '').toString().trim().toLowerCase() === name;
                    const sameAmount = Math.abs(Number(o?.amount || 0) - amount) <= 0.01;
                    const sourceDay = Number(o?.sourceDay || 0);
                    const due = new Date(this.normalizeIsoDate(o?.dueDate || ''));
                    const dueDay = isNaN(due.getTime()) ? 0 : due.getDate();
                    const sameDay = !day || sourceDay === day || dueDay === day;
                    return sameName && sameAmount && sameDay;
                });
            }

            if (!candidates.length) {
                return { paid: false, label: this.t('fixedPlanned'), matchText: '' };
            }

            candidates.sort((a, b) => (a?.dueDate || '').localeCompare(b?.dueDate || ''));
            const paidOcc = candidates.find(c => !!c.paid) || null;
            const refOcc = paidOcc || candidates[candidates.length - 1] || null;
            if (!refOcc || !paidOcc) {
                return { paid: false, label: this.t('fixedPlanned'), matchText: '' };
            }

            const fmtDate = (iso) => {
                try {
                    const d = new Date(this.normalizeIsoDate(iso));
                    if (isNaN(d.getTime())) return iso || '';
                    return d.toLocaleDateString(LOCALE_MAP[this.data.language] || 'en-GB', { day: '2-digit', month: '2-digit' });
                } catch {
                    return iso || '';
                }
            };

            const matchText = paidOcc.match
                ? `${this.t('fixedFound')}: ${fmtDate(paidOcc.match.date)} • ${(paidOcc.match.name || '').toString()}`
                : '';

            return { paid: true, label: this.t('fixedPaid'), matchText, occurrence: refOcc };
        } catch {
            return { paid: false, label: this.t('fixedPlanned'), matchText: '' };
        }
    }

    getFixedEndCountdownText(exp, liveStatus = null, todayRef = null) {
        try {
            const isoEnd = this.normalizeIsoDate(exp?.endDate || '');
            if (!isoEnd) return '';
            const endDate = new Date(isoEnd);
            if (isNaN(endDate.getTime())) return '';
            endDate.setHours(0, 0, 0, 0);
            const today = todayRef instanceof Date ? new Date(todayRef) : new Date();
            today.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((endDate - today) / 86400000);
            const it = (this.data?.language || 'it') === 'it';
            if (diffDays < 0) return liveStatus?.paid ? (it ? 'Piano terminato' : 'Plan completed') : '';
            if (diffDays === 0) return it ? 'Termina oggi' : 'Ends today';
            const residual = this.fixedDateFormat === 'months'
                ? this.formatDaysToYearsMonthsDays(diffDays)
                : this.t('inDays').replace('{days}', diffDays);
            return `${it ? '' : 'Ends in'} ${residual}`;
        } catch {
            return '';
        }
    }

    getFixedNextDueCountdownText(exp, liveStatus = null, todayRef = null) {
        try {
            const day = Math.max(1, parseInt(exp?.day, 10) || 1);
            const today = todayRef instanceof Date ? new Date(todayRef) : new Date();
            today.setHours(0, 0, 0, 0);
            const endIso = this.normalizeIsoDate(exp?.endDate || '');
            const endDate = endIso ? new Date(endIso) : null;
            if (endDate && !isNaN(endDate.getTime())) endDate.setHours(0, 0, 0, 0);

            const buildDue = (base) => {
                const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
                return new Date(base.getFullYear(), base.getMonth(), Math.min(day, lastDay));
            };

            let nextDue = buildDue(today);
            if (liveStatus?.paid || nextDue < today) {
                const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                nextDue = buildDue(nextMonth);
            }
            nextDue.setHours(0, 0, 0, 0);
            if (endDate && nextDue > endDate) return '';

            const diffDays = Math.ceil((nextDue - today) / 86400000);
            const it = (this.data?.language || 'it') === 'it';
            if (diffDays < 0) return '';
            const residual = this.fixedDateFormat === 'months'
                ? this.formatDaysToYearsMonthsDays(diffDays)
                : this.t('inDays').replace('{days}', diffDays);
        } catch {
            return '';
        }
    }

getNextFixedOccurrenceAfterPeriod(exp, monthsAhead = 6) {
    if (!exp || !exp.day) return null;

    const periodEndIso = this.normalizeIsoDate(this.data?.periodEnd || '');
    if (!periodEndIso) return null;

    const periodEnd = new Date(periodEndIso);
    if (isNaN(periodEnd.getTime())) return null;

    const expEndIso = this.normalizeIsoDate(exp.endDate || '');
    const expEnd = expEndIso ? new Date(expEndIso) : null;
    if (expEnd && isNaN(expEnd.getTime())) return null;

    const baseMonth = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);

    for (let offset = 0; offset <= monthsAhead; offset++) {
        const current = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + offset, 1);
        const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
        const dueDay = Math.min(parseInt(exp.day, 10) || 1, lastDay);
        const dueDateObj = new Date(current.getFullYear(), current.getMonth(), dueDay);
        const dueIso = this.formatLocalDate(dueDateObj);

        if (dueIso <= periodEndIso) continue;
        if (expEnd && dueDateObj > expEnd) return null;

        return {
            expId: exp.id ?? null,
            name: (exp.name || '').toString(),
            amount: Number(exp.amount || 0),
            dueDate: dueIso,
            sourceDay: Number(exp.day || 0),
            sourceEndDate: exp.endDate || ''
        };
    }

    return null;
}

getFutureFixedOccurrences(limit = 6) {
    if (!Array.isArray(this.data?.fixedExpenses)) return [];

    const items = this.data.fixedExpenses
        .map(exp => this.getNextFixedOccurrenceAfterPeriod(exp, limit))
        .filter(Boolean)
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || (a.name || '').localeCompare(b.name || ''));

    return items;
}

getUiToggleState(key, defaultValue = true) {
    try {
        const raw = localStorage.getItem(`bw_ui_toggle_${key}`);
        if (raw === null) return defaultValue;
        return raw === '1';
    } catch {
        return defaultValue;
    }
}

setUiToggleState(key, value) {
    try {
        localStorage.setItem(`bw_ui_toggle_${key}`, value ? '1' : '0');
    } catch {}
}

    updateFixedExpensesList() {
        const container = document.getElementById('fixedExpensesList');
        if (!container) return;
        
        if (!this.data.fixedExpenses || this.data.fixedExpenses.length === 0) {
            container.innerHTML = `<p class="chart-note">${this.t('noFixed')}</p>`;
            return;
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const currentOccurrences = Array.isArray(this.getFixedOccurrencesInPeriod?.()) ? this.getFixedOccurrencesInPeriod() : [];
        const expenseById = new Map((Array.isArray(this.data.fixedExpenses) ? this.data.fixedExpenses : []).map(exp => [exp?.id, exp]));

        const periodStartIso = this.normalizeIsoDate(this.data.periodStart || '');
        const periodEndIso = this.normalizeIsoDate(this.data.periodEnd || '');
        const rows = currentOccurrences
        .filter(occ => {
            const dueIso = this.normalizeIsoDate(occ?.dueDate || '');
            if (!dueIso) return false;
            if (periodStartIso && dueIso < periodStartIso) return false;
            if (periodEndIso && dueIso > periodEndIso) return false;
            return true;
        })
        .map(occ => {
            const exp = expenseById.get(occ.expId) || this.data.fixedExpenses.find(item => {
                if (!item) return false;
                const sameName = (item.name || '').toString().trim() === (occ.name || '').toString().trim();
                const sameAmount = Math.abs(Number(item.amount || 0) - Number(occ.amount || 0)) <= 0.01;
                const sameDay = Number(item.day || 0) === Number(occ.sourceDay || 0);
                return sameName && sameAmount && sameDay;
            }) || {
                id: occ.expId ?? null,
                name: occ.name,
                amount: occ.amount,
                day: occ.sourceDay,
                endDate: occ.sourceEndDate || ''
            };

            const dueIso = this.normalizeIsoDate(occ.dueDate || '');
            const dueDate = dueIso ? new Date(dueIso) : null;
            if (dueDate && !isNaN(dueDate.getTime())) dueDate.setHours(0, 0, 0, 0);
            const diffDays = dueDate && !isNaN(dueDate.getTime())
                ? Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))
                : null;

            const liveStatus = {
                paid: !!occ.paid,
                label: occ.paid ? this.t('fixedPaid') : this.t('fixedPlanned'),
                matchText: occ.match
                    ? `${this.t('fixedFound')}: ${occ.match.date} • ${(occ.match.name || '').toString()}`
                    : ''
            };

            let statusClass = '';
            let badgeClass = 'future';
            let daysText = '';

            if (diffDays == null) {
                statusClass = liveStatus.paid ? 'future' : 'future';
            } else if (diffDays < 0) {
                statusClass = liveStatus.paid ? 'future' : 'expired';
                badgeClass = 'future';
                daysText = this.t('daysAgo').replace('{days}', Math.abs(diffDays));
            } else if (diffDays === 0) {
                statusClass = liveStatus.paid ? 'future' : 'warning';
                daysText = this.t('dueToday');
            } else {
                statusClass = liveStatus.paid ? 'future' : (diffDays <= 3 ? 'warning' : 'future');
                daysText = this.fixedDateFormat === 'months'
                    ? this.formatDaysToYearsMonthsDays(diffDays)
                    : this.t('inDays').replace('{days}', diffDays);
            }

            return {
                exp,
                occ,
                liveStatus,
                statusClass,
                badgeClass,
                daysText,
                amount: Number(exp.amount || occ.amount || 0)
            };
        });

        const fixedTabSummary = this.getFixedTabSummary();
        const manualSuggestions = this.getManualFixedMatchSuggestions();
        const totalAll = Number(fixedTabSummary.totalAmount || 0);
        const totalPaid = Number(fixedTabSummary.paidAmount || 0);
        const totalDue = Number(fixedTabSummary.unpaidAmount || 0);
        const countPaid = Number(fixedTabSummary.paidCount || 0);
        const countDue = Number(fixedTabSummary.unpaidCount || 0);
        const totalCount = Number(fixedTabSummary.totalCount || rows.length || 0);

        const futureRows = this.getFutureFixedOccurrences(6);
        const futureTotal = futureRows.reduce((sum, item) => sum + Number(item?.amount || 0), 0);
        const fixedListExpanded = this.getUiToggleState('fixed_list', true);
        const futureFixedExpanded = this.getUiToggleState('future_fixed_list', true);

        const summaryHtml = `
            <div class="panel-section-header compact">
                <div>
                    <div class="panel-section-title">${this.t('fixedSummarySectionTitle')}</div>
                    <div class="panel-section-subtitle">${this.t('fixedSummarySectionSubtitle')}</div>
                </div>
            </div>
            <div class="fixed-expense-summary-grid">
                <div class="fixed-expense-summary-card">
                    <div class="fixed-expense-summary-label">${this.t('fixedSummaryTotalLabel')}</div>
                    <div class="fixed-expense-summary-value sensitive-amount">${this.formatCurrency(totalAll)}</div>
                    <div class="fixed-expense-summary-meta">${this.t('fixedSummaryVoicesMeta').replace('{count}', totalCount)}</div>
                </div>
                <div class="fixed-expense-summary-card paid">
                    <div class="fixed-expense-summary-label">${this.t('fixedSummaryPaidLabel')}</div>
                    <div class="fixed-expense-summary-value sensitive-amount">${this.formatCurrency(totalPaid)}</div>
                    <div class="fixed-expense-summary-meta">${this.t('fixedSummaryRecognizedMeta').replace('{count}', countPaid)}</div>
                </div>
                <div class="fixed-expense-summary-card due">
                    <div class="fixed-expense-summary-label">${this.t('fixedSummaryDueLabel')}</div>
                    <div class="fixed-expense-summary-value sensitive-amount">${this.formatCurrency(totalDue)}</div>
                    <div class="fixed-expense-summary-meta">${this.t('fixedSummaryPlannedMeta').replace('{count}', countDue)}</div>
                </div>
            </div>
        `;

        const listToggleHtml = `
            <div class="panel-section-header split">
                <div>
                    <div class="panel-section-title">${this.t('fixedCurrentSectionTitle')}</div>
                    <div class="panel-section-subtitle">${this.t('fixedCurrentSectionSubtitle')}</div>
                </div>
                <button class="list-toggle-btn" type="button" data-toggle-target="fixed-list">
                    ${fixedListExpanded ? this.t('toggleHideList') : this.t('toggleShowList')}
                </button>
            </div>
        `;

        const listHtml = rows.map(({ exp, occ, liveStatus, statusClass, badgeClass, daysText }) => {
            const livePillClass = liveStatus.paid ? 'fixed-pill paid' : 'fixed-pill due';
            const safeMatch = liveStatus.matchText ? String(liveStatus.matchText).replaceAll('"','&quot;') : '';
            const liveMatch = liveStatus.matchText ? `<div class="fixed-expense-match" title="${safeMatch}">${liveStatus.matchText}</div>` : '';
            const occKey = occ ? this.getFixedOccurrenceUiKey(occ) : Object.keys(manualSuggestions).find(key => key.startsWith(`${exp.id ?? 'x'}|`));
            const suggestionVar = occKey ? manualSuggestions[occKey] : null;
            const suggestionBox = (!liveStatus.paid && suggestionVar) ? `
                <div class="fixed-manual-match-box">
                    <div class="fixed-manual-match-title">${this.t('fixedManualMatchTitle')}</div>
                    <div class="fixed-manual-match-text">${this.t('fixedManualMatchText')}</div>
                    <div class="fixed-manual-match-mov">${suggestionVar.name || ''}</div>
                    <div class="fixed-manual-match-meta">${this.normalizeIsoDate(suggestionVar.date || '')} · ${this.formatCurrency(suggestionVar.amount || 0)}</div>
                    <div class="fixed-manual-match-actions">
                        <button class="fixed-confirm-match-btn" data-exp-id="${exp.id}" data-occ-key="${occKey}" data-var-id="${suggestionVar.id}">${this.t('fixedManualMatchConfirm')}</button>
                        <button class="fixed-reject-match-btn" data-exp-id="${exp.id}" data-occ-key="${occKey}" data-var-id="${suggestionVar.id}">${this.t('fixedManualMatchReject')}</button>
                    </div>
                </div>` : '';
            
            return `
                <div class="expense-item fixed-expense-item ${statusClass}">
                    <div class="expense-info">
                        <span class="expense-name">${exp.name || '?'}</span>
                        <span class="expense-category">
                             ${this.t('dayLabel')} ${occ?.sourceDay || exp.day || '?'} · ${this.t('endDateLabel')}: ${occ?.sourceEndDate || exp.endDate || '?'}
                            ${daysText ? `<span class="days-badge ${badgeClass}">${daysText}</span>` : ''}
                            <span class="fixed-term-badge">${this.t('remainingTermLabel')}: ${this.getRemainingTermCompact(occ?.sourceEndDate || exp.endDate || '')}</span>
                        </span>
                        <div class="fixed-expense-live">
                            <div class="fixed-status-box ${liveStatus.paid ? 'paid' : 'due'}">
                                <span class="${livePillClass}">${liveStatus.label}</span>
                            </div>
                            ${liveMatch}
                            ${suggestionBox}
                        </div>
                    </div>
                    <div class="fixed-expense-right">
                        <span class="expense-amount sensitive-amount">${this.formatCurrency(exp.amount || 0)}</span>
                        <div class="expense-actions">
                            <button class="delete-fixed-btn icon-only-btn" title="${this.t('delete')}" aria-label="${this.t('delete')}" data-id="${exp.id}"></button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const futureHtml = futureRows.length > 0
            ? `
                <div class="future-fixed-section">
                    <div class="future-fixed-header">
                        <div>
                            <div class="future-fixed-kicker">${this.t('futureFixedTitle')}</div>
                            <div class="future-fixed-title">${this.t('futureFixedTitle')}</div>
                            <div class="future-fixed-subtitle">${this.t('futureFixedSubtitle')}</div>
                        </div>
                        <div class="future-fixed-right-header">
                            <div class="future-fixed-total sensitive-amount">${this.formatCurrency(futureTotal)}</div>
                            <button class="list-toggle-btn future" type="button" data-toggle-target="future-fixed-list">
                                ${futureFixedExpanded ? this.t('toggleHideFuture') : this.t('toggleShowFuture')}
                            </button>
                        </div>
                    </div>
                    <div class="future-fixed-meta">${this.t('futureFixedCountMeta').replace('{count}', futureRows.length)}</div>
                    <div class="future-fixed-list ${futureFixedExpanded ? '' : 'collapsed'}">
                        ${futureRows.map(item => `
                            <div class="future-fixed-row">
                                <div class="future-fixed-left">
                                    <div class="future-fixed-name">${item.name || '?'}<\/div>
                                    <div class="future-fixed-date">${this.t('fixedDue')}: ${item.dueDate}<\/div>
                                    <div class="future-fixed-term">${this.t('remainingTermLabel')}: ${this.getRemainingTermCompact(item.endDate || '')}<\/div>
                                <\/div>
                                <div class="future-fixed-right">
                                    <div class="future-fixed-amount sensitive-amount">${this.formatCurrency(item.amount || 0)}<\/div>
                                    <span class="future-fixed-badge">${this.t('futureFixedNotCounted')}<\/span>
                                <\/div>
                            <\/div>
                        `).join('')}
                    </div>
                </div>
            `
            : `
                <div class="future-fixed-section empty">
                    <div class="future-fixed-title">${this.t('futureFixedTitle')}</div>
                    <div class="chart-note">${this.t('futureFixedEmpty')}</div>
                </div>
            `;

        container.innerHTML = summaryHtml + listToggleHtml + `<div class="toggle-list-shell ${fixedListExpanded ? '' : 'collapsed'}">${listHtml}</div>` + futureHtml;

        document.querySelectorAll('.list-toggle-btn[data-toggle-target="fixed-list"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const next = !this.getUiToggleState('fixed_list', true);
                this.setUiToggleState('fixed_list', next);
                this.updateFixedExpensesList();
            });
        });

        document.querySelectorAll('.list-toggle-btn[data-toggle-target="future-fixed-list"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const next = !this.getUiToggleState('future_fixed_list', true);
                this.setUiToggleState('future_fixed_list', next);
                this.updateFixedExpensesList();
            });
        });

        document.querySelectorAll('.delete-fixed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(e.currentTarget.dataset.id);
                this.deleteFixedExpense(id);
            });
        });

        document.querySelectorAll('.fixed-confirm-match-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const occKey = e.currentTarget.dataset.occKey || '';
                const varId = e.currentTarget.dataset.varId || '';
                const occ = fixedTabSummary.occs.find(o => this.getFixedOccurrenceUiKey(o) === occKey);
                const variable = this.getAllVariableExpensesFlat().find(v => String(v.id) === String(varId));
                this.confirmFixedManualMatch({ occ, variable });
            });
        });

        document.querySelectorAll('.fixed-reject-match-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const occKey = e.currentTarget.dataset.occKey || '';
                const varId = e.currentTarget.dataset.varId || '';
                const occ = fixedTabSummary.occs.find(o => this.getFixedOccurrenceUiKey(o) === occKey);
                const variable = this.getAllVariableExpensesFlat().find(v => String(v.id) === String(varId));
                this.rejectFixedManualMatch({ occ, variable });
            });
        });
    }
    // ========== FORMATTA GIORNI IN ANNI, MESI E GIORNI ==========
formatDaysToYearsMonthsDays(days) {
    // This formatter is used when fixedDateFormat === 'months'
    // Localized output: "1 year, 3 months and 6 days" / "1 año y 3 meses" / etc.
    if (days < 0) return this.t('daysAgo').replace('{days}', Math.abs(days));
    if (days === 0) return this.t('today');

    const years = Math.floor(days / 365);
    let remainingDays = days % 365;

    const months = Math.floor(remainingDays / 30);
    remainingDays = remainingDays % 30;

    const daysPart = remainingDays;

    const parts = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? this.t('yearSing') : this.t('yearPlur')}`);
    if (months > 0) parts.push(`${months} ${months === 1 ? this.t('monthSing') : this.t('monthPlur')}`);
    if (daysPart > 0) parts.push(`${daysPart} ${daysPart === 1 ? this.t('daySing') : this.t('dayPlur')}`);

    if (parts.length === 0) return this.t('today');
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts.join(` ${this.t('andConj')} `);
    return parts.slice(0, -1).join(', ') + ` ${this.t('andConj')} ` + parts.slice(-1);
}
    updateVariableExpensesList() {
    const container = document.getElementById('variableExpensesList');
    if (!container) return;

    const selectedDateRaw = document.getElementById('expenseDate')?.value || '';
    let selectedDate = this.normalizeIsoDate(selectedDateRaw);
    if (!selectedDate) {
        selectedDate = this.formatLocalDate(new Date());
        const dateInput = document.getElementById('expenseDate');
        if (dateInput) dateInput.value = selectedDate;
    }
    const variableTabSummary = this.getVariableTabSummary();
    const variableListExpanded = this.getUiToggleState('variable_list', true);
    const summaryHtml = `
        <div class="fixed-expense-summary-grid variable-expense-summary-grid variable-summary-home-like">
            <div class="fixed-expense-summary-card variable-summary-card primary">
                <div class="variable-summary-kicker">${this.t('variableSectionTitle')}</div>
                <div class="fixed-expense-summary-label">${this.t('variableSummaryTotalLabel')}</div>
                <div class="fixed-expense-summary-value sensitive-amount">${this.formatCurrency(variableTabSummary.totalAmount || 0)}</div>
                <div class="fixed-expense-summary-meta">${this.t('variableSummaryCountMeta').replace('{count}', variableTabSummary.totalCount || 0)}</div>
            </div>
            <div class="fixed-expense-summary-card variable-summary-card paid">
                <div class="fixed-expense-summary-label">${this.t('variableSummaryCountLabel')}</div>
                <div class="fixed-expense-summary-value">${Number(variableTabSummary.totalCount || 0)}</div>
                <div class="fixed-expense-summary-meta">${this.showAllExpenses ? this.t('variableSectionSubtitle') : (selectedDate ? selectedDate : this.t('variableSummaryAverageMeta'))}</div>
            </div>
            <div class="fixed-expense-summary-card variable-summary-card due">
                <div class="fixed-expense-summary-label">${this.t('variableSummaryAverageLabel')}</div>
                <div class="fixed-expense-summary-value sensitive-amount">${this.formatCurrency(variableTabSummary.averageAmount || 0)}</div>
                <div class="fixed-expense-summary-meta">${this.t('variableSummaryAverageMeta')}</div>
            </div>
        </div>
    `;

    const listToggleHtml = `
        <div class="panel-section-header split variable">
            <div>
                <div class="panel-section-title">${this.t('variableSectionTitle')}</div>
                <div class="panel-section-subtitle">${this.t('variableSectionSubtitle')}</div>
            </div>
            <button class="list-toggle-btn" type="button" data-toggle-target="variable-list">
                ${variableListExpanded ? this.t('toggleHideList') : this.t('toggleShowList')}
            </button>
        </div>
    `;

    let view = [];
    if (this.showAllExpenses) {
        const entries = (this.data.variableExpenses && typeof this.data.variableExpenses === 'object')
            ? Object.entries(this.data.variableExpenses)
            : [];

        for (const [d, dayExpenses] of entries) {
            const normalizedDate = this.normalizeIsoDate(d);
            if (!normalizedDate || !this.isDateInPeriod(normalizedDate)) continue;
            if (!Array.isArray(dayExpenses)) continue;
            for (const exp of dayExpenses) view.push({ date: normalizedDate, exp });
        }

        view.sort((a, b) => {
            const da = new Date(a.date);
            const db = new Date(b.date);
            if (db - da !== 0) return db - da;
            return (b.exp?.id || 0) - (a.exp?.id || 0);
        });
    } else {
        const expenses = (selectedDate && this.isDateInPeriod(selectedDate) && this.data.variableExpenses && this.data.variableExpenses[selectedDate]) || [];
        if (Array.isArray(expenses)) view = expenses.map(exp => ({ date: selectedDate, exp }));
    }

    // APPLICA FILTRO DI RICERCA
    const totalCount = view.length;
    let filteredView = view;
    
    if (this.searchTerm || this.searchCategoryFilter !== 'all') {
        filteredView = this.filterExpenses(view);
    }
    
    // Aggiorna contatore
    this.updateSearchResultsCount(filteredView.length, totalCount);

    if (!filteredView || filteredView.length === 0) {
        if (totalCount > 0 && filteredView.length === 0) {
            container.innerHTML = summaryHtml + listToggleHtml + `<p class="chart-note">${this.t('noMatchingExpenses') || 'Nessuna spesa corrisponde ai filtri selezionati'}</p>`;
        } else {
            container.innerHTML = summaryHtml + listToggleHtml + `<p class="chart-note">${this.t('noVariable')}</p>`;
        }
        return;
    }

    container.innerHTML = summaryHtml + listToggleHtml + `<div class="toggle-list-shell ${variableListExpanded ? '' : 'collapsed'}">` + filteredView.map(({ date, exp }) => {
        const cat = exp.category || 'Altro';
        const catDisplay = this.getAllCategories().includes(cat) ? cat : 'Altro';
        const subCategoryDisplay = this.getExpenseSubcategory(exp);
        const categoryLabel = this.renderCategoryLabel(catDisplay);
        const metaLabel = subCategoryDisplay ? `${categoryLabel} / ${subCategoryDisplay}` : categoryLabel;
        const dateBadge = this.showAllExpenses ? `<span class="expense-category"> ${date}</span>` : '';
        const linkedBadge = exp.bankLinked
            ? `<span class="expense-link-badge" title="${String(this.t('variableLinkedMeta')).replaceAll('"','&quot;')}">${this.t('variableLinkedBadge')}</span>`
            : '';
        return `
            <div class="expense-item variable-home-card ${exp.bankLinked ? 'linked' : ''}">
                <div class="expense-main-row">
                    <div class="expense-info">
                        <span class="expense-name">${exp.name || '?'}</span>
                        <span class="expense-category">${metaLabel}</span>
                        <div class="variable-card-meta-row">
                            ${dateBadge}
                            ${linkedBadge}
                        </div>
                    </div>
                    <div class="expense-side-block">
                        <span class="expense-amount sensitive-amount">${this.formatCurrency(exp.amount || 0)}</span>
                        <div class="expense-actions variable-card-actions">
                            <button class="edit-variable-btn icon-only-btn" title="${this.t('edit')}" aria-label="${this.t('edit')}" data-id="${exp.id}" data-date="${date}"></button>
                            <button class="delete-variable-btn icon-only-btn" title="${this.t('delete')}" aria-label="${this.t('delete')}" data-id="${exp.id}" data-date="${date}"></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.list-toggle-btn[data-toggle-target="variable-list"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const next = !this.getUiToggleState('variable_list', true);
            this.setUiToggleState('variable_list', next);
            this.updateVariableExpensesList();
        });
    });

    // Riapplica gli event listener
    document.querySelectorAll('.edit-variable-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(e.currentTarget.dataset.id);
            const date = e.currentTarget.dataset.date;
            this.editVariableExpense(date, id);
        });
    });

    document.querySelectorAll('.delete-variable-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(e.currentTarget.dataset.id);
            const date = e.currentTarget.dataset.date;
            this.deleteVariableExpense(date, id);
        });
    });
}
    // ========== FUNZIONI DI RICERCA ==========

    // Filtra le spese in base ai criteri di ricerca
    filterExpenses(expenses) {
        if (!expenses || expenses.length === 0) return [];
        
        const term = this.searchTerm.toLowerCase().trim();
        const categoryFilter = this.searchCategoryFilter;
        
        return expenses.filter(item => {
            const exp = item.exp || item; // Supporta sia formato {date, exp} che {name, category, amount}
            const name = (exp.name || '').toLowerCase();
            const category = String(exp.category || '').toLowerCase();
            const subCategory = this.getExpenseSubcategory(exp).toLowerCase();
            const amount = exp.amount || 0;
            const categoryPath = this.getExpenseCategoryPath(exp).toLowerCase();
            
            // Filtro per categoria
            if (!this.matchesCategoryFilter(exp, categoryFilter)) {
                return false;
            }
            
            // Filtro per termine di ricerca
            if (term === '') return true;
            
            // Cerca in descrizione
            if (name.includes(term)) return true;
            
            // Cerca in categoria
            if (category.includes(term)) return true;
            
            // Cerca in sottocategoria
            if (subCategory.includes(term)) return true;

            // Cerca nel percorso categoria/sottocategoria
            if (categoryPath.includes(term)) return true;
            
            // Cerca in importo (conversione a stringa)
            if (amount.toString().includes(term)) return true;
            
            return false;
        });
    }

    // Aggiorna il contatore dei risultati
    updateSearchResultsCount(filteredCount, totalCount) {
    const countEl = document.getElementById('searchResultsCount');
    if (!countEl) return;
    
    if (this.searchTerm || this.searchCategoryFilter !== 'all') {
        const lang = resolveRuntimeLang(this);
        if (lang === 'it') {
            countEl.textContent = `📊 Mostrando ${filteredCount} di ${totalCount} spese`;
        } else if (lang === 'en') {
            countEl.textContent = `📊 Showing ${filteredCount} of ${totalCount} expenses`;
        } else if (lang === 'es') {
            countEl.textContent = `📊 Mostrando ${filteredCount} de ${totalCount} gastos`;
        } else if (lang === 'fr') {
            countEl.textContent = `📊 Affichage ${filteredCount} sur ${totalCount} dépenses`;
        }
    } else {
        countEl.textContent = '';
    }
}
    // Popola il select delle categorie
    populateCategoryFilter() {
        const select = document.getElementById('searchCategory');
        if (!select) return;
        
        const options = this.getCategoryFilterOptions();
        select.innerHTML = options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
        const availableValues = options.map(opt => opt.value);
        select.value = availableValues.includes(this.searchCategoryFilter) ? this.searchCategoryFilter : 'all';
    }

    // Resetta tutti i filtri
    resetSearch() {
        this.searchTerm = '';
        this.searchCategoryFilter = 'all';
        
        const searchInput = document.getElementById('searchExpenses');
        const categorySelect = document.getElementById('searchCategory');
        
        if (searchInput) searchInput.value = '';
        if (categorySelect) categorySelect.value = 'all';
        
        this.updateVariableExpensesList();
    }
    async editVariableExpense(date, id) {
        date = this.normalizeIsoDate(date);
        if (!this.data.variableExpenses || !this.data.variableExpenses[date]) return;
        const idx = this.data.variableExpenses[date].findIndex(e => e.id === id);
        if (idx === -1) return;

        const exp = this.data.variableExpenses[date][idx];
        const copy = this.getPopupUiCopy();

        const newName = await this.showAppPrompt(copy.expenseDescriptionPrompt, exp.name || '', { title: copy.promptTitle, placeholder: copy.expenseDescriptionPrompt });
        if (newName === null) return;

        const newAmountStr = await this.showAppPrompt(copy.expenseAmountPrompt, String(exp.amount ?? ''), { title: copy.promptTitle, placeholder: copy.expenseAmountPrompt });
        if (newAmountStr === null) return;
        const newAmount = parseFloat(String(newAmountStr).replace(',', '.'));
        if (!isFinite(newAmount) || newAmount <= 0) {
            this.showToast(this.t('fillFields'), 'error');
            return;
        }

        const cats = this.getAllCategories();
        const catHint = cats.join(', ');
        const newCategory = await this.showAppPrompt(`${copy.expenseCategoryPrompt} (${catHint})`, exp.category || 'Altro', { title: copy.promptTitle, placeholder: copy.expenseCategoryPrompt });
        if (newCategory === null) return;
        const trimmedCat = String(newCategory).trim() || 'Altro';

        const newSubCategory = await this.showAppPrompt(this.t('expenseSubCategory'), exp.subCategory || '', { title: copy.promptTitle, placeholder: this.t('expenseSubCategory') });
        if (newSubCategory === null) return;
        const trimmedSubCategory = String(newSubCategory).trim();

        if (!this.getAllCategories().includes(trimmedCat)) {
            this.customCategories.push(trimmedCat);
            this.saveCustomCategories();
            this.updateAllCategorySelects();
        }

        exp.name = String(newName).trim() || exp.name;
        exp.amount = newAmount;
        exp.category = trimmedCat;
        exp.subCategory = trimmedSubCategory;

        this.learnCategory(exp.name, trimmedCat, trimmedSubCategory);

        this.data.variableExpenses[date][idx] = exp;
        this.saveData();
        this.updateUI();
        this.updateChart();
        this.showToast(this.t('expenseUpdated'), 'success');
    }

    updateChart() {
        const categories = {};
        const categoryExpenses = {};

        if (this.data.variableExpenses && typeof this.data.variableExpenses === 'object') {
            Object.entries(this.data.variableExpenses).forEach(([date, dayExpenses]) => {
                const normalizedDate = this.normalizeIsoDate(date);
                if (!normalizedDate || !this.isDateInPeriod(normalizedDate)) return;
                if (!Array.isArray(dayExpenses)) return;
                dayExpenses.forEach(expense => {
                    const label = this.getExpenseCategoryPath(expense) || this.getCategoryDisplay('Altro');
                    const amt = Number(expense.amount || 0) || 0;
                    categories[label] = (categories[label] || 0) + amt;

                    if (!categoryExpenses[label]) categoryExpenses[label] = [];
                    categoryExpenses[label].push({
                        name: expense.name || '?',
                        amount: amt,
                        date: date,
                        category: expense.category || 'Altro',
                        subCategory: this.getExpenseSubcategory(expense)
                    });
                });
            });
        }

        const chartNote = document.getElementById('chartNote');
        const canvas = document.getElementById('expenseChart');
        const chartContainer = canvas ? canvas.closest('.chart-container') : null;
        const legendEl = document.getElementById('chartLegend');
        const legendToggleBtn = document.getElementById('chartLegendToggleBtn');

        if (Object.keys(categories).length === 0) {
            if (chartNote) chartNote.style.display = 'block';
            if (chartContainer) chartContainer.style.display = 'none';
            if (legendEl) { legendEl.innerHTML = ''; legendEl.style.display = 'none'; }
            if (legendToggleBtn) legendToggleBtn.style.display = 'none';
            this.hideCategoryPrintPanel();
            if (this.chart) this.chart.destroy();
            this.chart = null;
            this.categoryExpenses = {};
            this.updateBalanceChart();
            return;
        }

        if (chartNote) chartNote.style.display = 'none';
        if (chartContainer) chartContainer.style.display = '';
        if (legendToggleBtn) legendToggleBtn.style.display = 'inline-flex';

        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }

        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const labels = Object.keys(categories);
        const values = Object.values(categories);
        const totalExpenses = values.reduce((a, b) => a + b, 0);
        const colors = ['#3B82F6', '#60A5FA', '#22C55E', '#A78BFA', '#F59E0B', '#EF4444', '#14B8A6', '#F472B6'];
        const textPrimary = (getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#f8fafc').trim();
        const textSecondary = (getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') || '#94a3b8').trim();
        const cardBg = (getComputedStyle(document.documentElement).getPropertyValue('--card-bg') || '#0f172a').trim();

        const bw = this;
        const centerTextPlugin = {
            id: 'centerText',
            afterDraw: (chart) => {
                const { ctx, chartArea } = chart;
                if (!chartArea || chart.config.type !== 'doughnut') return;
                const centerX = (chartArea.left + chartArea.right) / 2;
                const centerY = (chartArea.top + chartArea.bottom) / 2;
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = textSecondary;
                ctx.font = '600 11px Inter, system-ui, sans-serif';
                ctx.fillText(bw.t('totalExpensesLabel'), centerX, centerY - 14);
                ctx.fillStyle = textPrimary;
                ctx.font = '700 18px Inter, system-ui, sans-serif';
                ctx.fillText(bw.formatCurrency(totalExpenses), centerX, centerY + 4);
                ctx.restore();
            }
        };

        const openCategorySelection = (categoryName) => {
            this.showCategoryDetail(categoryName, categoryExpenses[categoryName] || []);
        };

        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: labels.map((_, i) => colors[i % colors.length]),
                    borderColor: cardBg,
                    borderWidth: 2,
                    borderRadius: 8,
                    spacing: 2,
                    hoverOffset: 5,
                    hoverBorderWidth: 2
                }]
            },
            options: {
                cutout: '78%',
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 220 },
                layout: { padding: { top: 2, right: 2, bottom: 2, left: 2 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        displayColors: false,
                        backgroundColor: 'rgba(8, 15, 30, 0.94)',
                        borderColor: 'rgba(56, 189, 248, 0.25)',
                        borderWidth: 1,
                        padding: 12,
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        callbacks: {
                            title: (items) => items[0]?.label || '',
                            label: (context) => {
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                                const catName = labels[context.dataIndex];
                                const count = (categoryExpenses[catName] || []).length;
                                const nTrans = bw.t('transactionsLabel');
                                return [
                                    bw.formatCurrency(value),
                                    `${percentage}%`,
                                    `${count} ${nTrans}`
                                ];
                            }
                        }
                    }
                },
                onClick: (event, items) => {
                    if (items && items.length > 0) {
                        const index = items[0].index;
                        const categoryName = bw.chart.data.labels[index];
                        openCategorySelection(categoryName);
                    }
                }
            },
            plugins: [centerTextPlugin]
        });

        if (legendEl) {
            legendEl.innerHTML = labels.map((label, i) => {
                const amt = values[i] || 0;
                const pct = totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(0) : '0';
                const col = colors[i % colors.length];
                return `<div class="chart-legend-item" data-index="${i}" role="button" tabindex="0" aria-label="${label}">
                    <span class="chart-legend-dot" style="background:${col}"></span>
                    <span class="chart-legend-label">${label}</span>
                    <span class="chart-legend-value">${pct}% · ${this.formatCurrency(amt)}</span>
                </div>`;
            }).join('');
            legendEl.querySelectorAll('.chart-legend-item').forEach((el, i) => {
                const openCategory = () => {
                    const catName = labels[i];
                    openCategorySelection(catName);
                };
                el.addEventListener('click', openCategory);
                el.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openCategory();
                    }
                });
            });
        }

        this.categoryExpenses = categoryExpenses;
        this.setChartLegendCollapsed(this.chartLegendCollapsed !== false);
        this.updateBalanceChart();
    }

    updateBalanceChart() {
        const canvas = document.getElementById('balanceChart');
        const noteEl = document.getElementById('balanceChartNote');
        const card = document.getElementById('balanceChartCard');
        if (!canvas || !card) return;

        const income = Number(this.calculateTotalIncome() || 0);
        const fixed = Number(this.calculateTotalFixedExpensesUnpaid() || 0);
        const variable = Number(this.calculateTotalVariableExpenses() || 0);
        const remaining = Number(this.calculateRemaining() || 0);

        const hasData = income > 0 || fixed > 0 || variable > 0 || Math.abs(remaining) > 0.009;
        const wrapper = canvas.closest('.chart-container');

        if (!hasData) {
            if (noteEl) noteEl.style.display = 'block';
            if (wrapper) wrapper.style.display = 'none';
            if (this.balanceChart) this.balanceChart.destroy();
            this.balanceChart = null;
            return;
        }

        if (noteEl) noteEl.style.display = 'none';
        if (wrapper) wrapper.style.display = '';

        if (this.balanceChart) {
            this.balanceChart.destroy();
            this.balanceChart = null;
        }

        const labels = [
            this.t('balanceChartIncome'),
            this.t('balanceChartFixed'),
            this.t('balanceChartVariable'),
            this.t('balanceChartRemaining')
        ];
        const values = [income, fixed, variable, remaining];

        const textSecondary = (getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') || '#94a3b8').trim();
        const borderColor = (getComputedStyle(document.documentElement).getPropertyValue('--border') || '#1e293b').trim();
        const successColor = (getComputedStyle(document.documentElement).getPropertyValue('--success') || '#22c55e').trim();
        const warningColor = (getComputedStyle(document.documentElement).getPropertyValue('--warning') || '#f59e0b').trim();
        const dangerColor = (getComputedStyle(document.documentElement).getPropertyValue('--danger') || '#ef4444').trim();
        const accentColor = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#0ea5e9').trim();
        const colors = [successColor, warningColor, dangerColor, accentColor];
        const minValue = Math.min(...values, 0);
        const maxValue = Math.max(...values, 0);
        const rangePadding = Math.max(Math.abs(minValue), Math.abs(maxValue)) * 0.18 || 50;

        this.balanceChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors.map((color) => {
                        const gradient = canvas.getContext('2d').createLinearGradient(0, 0, 0, canvas.height || 220);
                        gradient.addColorStop(0, color);
                        gradient.addColorStop(1, 'rgba(15, 23, 42, 0.35)');
                        return gradient;
                    }),
                    borderColor: colors,
                    borderWidth: 1.25,
                    borderRadius: 10,
                    borderSkipped: false,
                    maxBarThickness: 26,
                    categoryPercentage: 0.56,
                    barPercentage: 0.78
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 220 },
                layout: {
                    padding: { top: 4, right: 4, bottom: 4, left: 2 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        displayColors: false,
                        backgroundColor: 'rgba(8, 15, 30, 0.94)',
                        borderColor: 'rgba(56, 189, 248, 0.25)',
                        borderWidth: 1,
                        padding: 12,
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        callbacks: {
                            label: (context) => `${context.label}: ${this.formatCurrency(context.raw || 0)}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        border: { display: false },
                        ticks: {
                            color: textSecondary,
                            font: { size: 10, weight: '600' },
                            maxRotation: 0,
                            minRotation: 0
                        }
                    },
                    y: {
                        min: minValue - rangePadding,
                        max: maxValue + rangePadding,
                        grid: {
                            color: 'rgba(148, 163, 184, 0.12)',
                            drawBorder: false
                        },
                        border: { display: false },
                        ticks: {
                            color: textSecondary,
                            padding: 8,
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                }
            }
        });
    }

    setChartLegendCollapsed(collapsed) {
        this.chartLegendCollapsed = !!collapsed;
        const legendEl = document.getElementById('chartLegend');
        const toggleBtn = document.getElementById('chartLegendToggleBtn');
        if (legendEl) {
            legendEl.hidden = this.chartLegendCollapsed;
            legendEl.classList.toggle('is-collapsed', this.chartLegendCollapsed);
            legendEl.style.setProperty('display', this.chartLegendCollapsed ? 'none' : 'grid', 'important');
            legendEl.setAttribute('aria-hidden', this.chartLegendCollapsed ? 'true' : 'false');
        }
        if (toggleBtn) {
            toggleBtn.textContent = this.chartLegendCollapsed ? this.t('showCategories') : this.t('hideCategories');
            toggleBtn.setAttribute('aria-expanded', this.chartLegendCollapsed ? 'false' : 'true');
        }
    }

    hideCategoryPrintPanel() {
        const panel = document.getElementById('categoryPrintPanel');
        if (panel) panel.style.display = 'none';
        this.selectedCategoryForPrint = null;
        this.selectedCategoryExpenses = [];
    }

    showCategoryDetail(categoryName, expenses) {
        const panel = document.getElementById('categoryPrintPanel');
        const titleEl = document.getElementById('categoryPrintTitle');
        const totalEl = document.getElementById('categoryPrintTotal');
        const countEl = document.getElementById('categoryPrintCount');
        const hintEl = document.getElementById('categoryPrintHint');
        if (!panel) return;

        const safeExpenses = Array.isArray(expenses) ? expenses.slice() : [];
        const total = safeExpenses.reduce((sum, exp) => sum + (Number(exp.amount || 0) || 0), 0);

        this.selectedCategoryForPrint = categoryName;
        this.selectedCategoryExpenses = safeExpenses;

        if (titleEl) titleEl.textContent = categoryName || '—';
        if (totalEl) totalEl.textContent = this.formatCurrency(total);
        if (countEl) countEl.textContent = String(safeExpenses.length);
        if (hintEl) {
            hintEl.textContent = safeExpenses.length > 0
                ? this.t('categoryPrintHintReady')
                : this.t('categoryPrintHintEmpty');
        }
        const closeBtn = document.getElementById('closeCategoryPrintBtn');
        if (closeBtn) closeBtn.textContent = this.t('close');
        const eyebrowEl = panel.querySelector('.category-print-panel__eyebrow');
        if (eyebrowEl) eyebrowEl.textContent = this.t('categoryPrintSelectedLabel');

        panel.style.display = 'block';
        this.applyPrivacyState();
    }

    formatPrintDate(iso) {
        try {
            const d = new Date(this.normalizeIsoDate(iso));
            if (Number.isNaN(d.getTime())) return iso || this.uiText('unknownDate');
            return d.toLocaleDateString(LOCALE_MAP[this.data.language] || 'it-IT');
        } catch {
            return iso || this.uiText('unknownDate');
        }
    }

    escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    buildCategoryPrintHTML(categoryName, expenses) {
        const locale = LOCALE_MAP[this.data.language] || 'it-IT';
        const labels = this.getPrintTemplateLabels();
        const generatedAt = new Date();
        const generatedAtLabel = generatedAt.toLocaleDateString(locale) + ' ' + generatedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        const safeCategory = this.escapeHTML(categoryName || 'Categoria');
        const safeExpenses = (Array.isArray(expenses) ? expenses : []).slice().sort((a, b) => {
            return String(a.date || '').localeCompare(String(b.date || ''));
        });
        const total = safeExpenses.reduce((sum, item) => sum + (Number(item.amount || 0) || 0), 0);
        const rows = safeExpenses.length
            ? safeExpenses.map((item) => `
                <tr>
                    <td>${this.escapeHTML(this.formatPrintDate(item.date))}</td>
                    <td>${this.escapeHTML(item.name || '—')}</td>
                    <td class="amount-cell">${this.escapeHTML(this.formatCurrency(item.amount || 0))}</td>
                </tr>
            `).join('')
            : `<tr><td colspan="3" class="empty-row">Nessun movimento disponibile per questa categoria.</td></tr>`;

        const coverHtml = this.buildFlagshipCoverHTML({
            reportType: 'categories',
            language: this.data.language || 'it'
        });

        return `<!DOCTYPE html>
<html lang="${this.data.language || 'it'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kedrix_Categoria_${safeCategory}</title>
<style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #0f172a; font-family: Inter, Arial, Helvetica, sans-serif; }
    body { padding: 0; }
    .print-shell { max-width: 190mm; margin: 0 auto; }
    .cover-page, .detail-page { page-break-after: always; }
    .cover-page--svg { break-after: page; }
    .pdf-svg-cover-wrap { min-height: 277mm; border-radius: 24px; overflow: hidden; background: #050A16; }
    .pdf-svg-cover { display:block; width:100%; height:277mm; object-fit:cover; }
    .detail-page:last-child { page-break-after: auto; }
    .bw-flagship-cover { position: relative; min-height: 277mm; overflow: hidden; border-radius: 24px; background: #050A16; color: #fff; padding: 24mm 16mm 16mm; box-shadow: 0 8px 28px rgba(5, 10, 22, 0.18); }
    .bw-cover-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(22,32,64,0.75) 1px, transparent 1px), linear-gradient(90deg, rgba(22,32,64,0.75) 1px, transparent 1px); background-size: 34px 34px; opacity: 0.42; }
    .bw-cover-orb { position: absolute; border-radius: 999px; }
    .bw-cover-orb--one { width: 270px; height: 270px; right: -70px; top: -30px; background: radial-gradient(circle at 30% 30%, rgba(37,99,235,0.96), rgba(30,58,138,0.96)); }
    .bw-cover-orb--two { width: 220px; height: 220px; left: -60px; bottom: -40px; background: radial-gradient(circle at 40% 40%, rgba(37,99,235,0.86), rgba(14,165,233,0.65)); }
    .bw-cover-watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 180px; font-weight: 800; letter-spacing: 0.06em; color: rgba(20,32,74,0.88); user-select: none; }
    .bw-cover-content { position: relative; z-index: 4; display: flex; min-height: 100%; flex-direction: column; justify-content: center; }
    .bw-cover-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.28em; text-transform: uppercase; color: #93c5fd; }
    .bw-cover-title { margin: 14px 0 28px; font-size: 56px; line-height: 0.95; letter-spacing: 0.03em; color: #C8A75B; }
    .bw-cover-subtitle { max-width: 108mm; margin: 0 0 24px; font-size: 18px; line-height: 1.5; color: rgba(255,255,255,0.92); }
    .bw-cover-meta { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; max-width: 145mm; }
    .bw-cover-meta-card { padding: 12px 14px; border: 1px solid rgba(191,219,254,0.2); border-radius: 16px; background: rgba(11,18,32,0.44); font-size: 12px; color: rgba(255,255,255,0.92); }
    .bw-cover-brand { margin-top: 28px; font-size: 13px; letter-spacing: 0.08em; color: rgba(255,255,255,0.82); }
    .bw-cover-network, .bw-cover-chart { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
    .bw-cover-network .node { position: absolute; width: 8px; height: 8px; border: 1px solid #C8A75B; border-radius: 999px; }
    .bw-cover-network .link { position: absolute; display: block; height: 2px; background: linear-gradient(90deg, rgba(200,167,91,0.95), rgba(200,167,91,0.35)); transform-origin: left center; }
    .bw-cover-network .n1 { left: 28mm; top: 86mm; } .bw-cover-network .n2 { left: 48mm; top: 74mm; } .bw-cover-network .n3 { left: 68mm; top: 84mm; } .bw-cover-network .n4 { left: 88mm; top: 68mm; } .bw-cover-network .n5 { left: 108mm; top: 78mm; } .bw-cover-network .n6 { left: 128mm; top: 64mm; }
    .bw-cover-network .l1 { left: 31mm; top: 89mm; width: 24mm; transform: rotate(-24deg); } .bw-cover-network .l2 { left: 51mm; top: 77mm; width: 23mm; transform: rotate(23deg); } .bw-cover-network .l3 { left: 71mm; top: 87mm; width: 24mm; transform: rotate(-34deg); } .bw-cover-network .l4 { left: 91mm; top: 71mm; width: 24mm; transform: rotate(18deg); } .bw-cover-network .l5 { left: 111mm; top: 80mm; width: 24mm; transform: rotate(-28deg); }
    .bw-cover-chart .chart-dot { position: absolute; width: 8px; height: 8px; border-radius: 999px; border: 1px solid currentColor; background: transparent; }
    .bw-cover-chart .chart-line { position: absolute; display: block; height: 3px; transform-origin: left center; border-radius: 999px; }
    .bw-cover-chart .chart-bar { position: absolute; width: 12px; border-radius: 12px 12px 0 0; background: linear-gradient(180deg, rgba(37,99,235,0.92), rgba(37,99,235,0.32)); }
    .bw-cover-chart .d1 { left: 26mm; bottom: 37mm; color: #22C55E; } .bw-cover-chart .d2 { left: 48mm; bottom: 42mm; color: #34D399; } .bw-cover-chart .d3 { left: 70mm; bottom: 49mm; color: #2563EB; } .bw-cover-chart .d4 { left: 92mm; bottom: 55mm; color: #22C55E; } .bw-cover-chart .d5 { left: 114mm; bottom: 64mm; color: #34D399; } .bw-cover-chart .d6 { left: 136mm; bottom: 77mm; color: #2563EB; }
    .bw-cover-chart .s1 { left: 28mm; bottom: 40mm; width: 23mm; background: linear-gradient(90deg,#22C55E,#34D399); transform: rotate(12deg); } .bw-cover-chart .s2 { left: 50mm; bottom: 45mm; width: 23mm; background: linear-gradient(90deg,#34D399,#2563EB); transform: rotate(17deg); } .bw-cover-chart .s3 { left: 72mm; bottom: 52mm; width: 23mm; background: linear-gradient(90deg,#2563EB,#22C55E); transform: rotate(14deg); } .bw-cover-chart .s4 { left: 94mm; bottom: 59mm; width: 23mm; background: linear-gradient(90deg,#22C55E,#34D399); transform: rotate(21deg); } .bw-cover-chart .s5 { left: 116mm; bottom: 69mm; width: 23mm; background: linear-gradient(90deg,#34D399,#2563EB); transform: rotate(28deg); }
    .bw-cover-chart .b1 { right: 44mm; bottom: 24mm; height: 28mm; } .bw-cover-chart .b2 { right: 36mm; bottom: 24mm; height: 34mm; } .bw-cover-chart .b3 { right: 28mm; bottom: 24mm; height: 41mm; } .bw-cover-chart .b4 { right: 20mm; bottom: 24mm; height: 48mm; }
    .report-sheet { background: #ffffff; border: 1px solid #d7e0ea; border-radius: 18px; padding: 14px; box-shadow: 0 3px 10px rgba(15, 23, 42, 0.04); }
    .detail-head { margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid #dbe4f0; }
    .detail-head h2 { margin: 0 0 6px 0; font-size: 22px; }
    .detail-head p { margin: 0; font-size: 12px; color: #475569; }
    .detail-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 14px 0; }
    .detail-kpi { border: 1px solid #dbeafe; border-radius: 12px; padding: 10px; background: #f8fbff; }
    .detail-kpi span { display: block; margin-bottom: 4px; font-size: 11px; color: #475569; }
    .detail-kpi strong { display: block; font-size: 18px; }
    .category-table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
    .category-table th, .category-table td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; vertical-align: top; }
    .category-table th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
    .category-table th:first-child, .category-table td:first-child { width: 24mm; }
    .category-table th:nth-child(2), .category-table td:nth-child(2) { width: auto; white-space: normal; word-break: normal; overflow-wrap: anywhere; }
    .category-table th:last-child, .category-table td:last-child { width: 28mm; }
    .amount-cell { text-align: right; white-space: nowrap; }
    .empty-row { text-align: center; color: #64748b; padding: 22px 8px; }
    .total-row td { border-top: 2px solid #cbd5e1; font-weight: 700; }
    .print-footer { margin-top: 10px; font-size: 11px; text-align: center; color: #475569; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print-shell { max-width: none; } }
</style>
</head>
<body>
    <div class="print-shell">
        ${coverHtml}
        <section class="detail-page">
            <div class="report-sheet">
                <div class="detail-head">
                    <h2>${this.escapeHTML(labels.categoryDetailTitle)} · ${safeCategory}</h2>
                    <p>${this.t('categoryPrintListSubtitle')}</p>
                </div>
                <div class="detail-meta">
                    <div class="detail-kpi"><span>${this.t('categoryPrintMovements')}</span><strong>${safeExpenses.length}</strong></div>
                    <div class="detail-kpi"><span>${this.t('categoryPrintTotalCategory')}</span><strong>${this.escapeHTML(this.formatCurrency(total))}</strong></div>
                </div>
                <table class="category-table">
                    <thead>
                        <tr>
                            <th>${this.t('categoryPrintDate')}</th>
                            <th>${this.t('categoryPrintItem')}</th>
                            <th class="amount-cell">${this.t('categoryPrintAmount')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                        <tr class="total-row">
                            <td colspan="2">${this.t('categoryPrintTotalCategory')}</td>
                            <td class="amount-cell">${this.escapeHTML(this.formatCurrency(total))}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="print-footer">${this.t('categoryPrintFooter')}</div>
            </div>
        </section>
    </div>
</body>
</html>`;
    }

    async exportCategoryPDF(categoryName) {
        const expenses = Array.isArray(this.selectedCategoryExpenses) ? this.selectedCategoryExpenses : [];
        const html = this.buildCategoryPrintHTML(categoryName, expenses);
        const safeTitle = String(categoryName || 'Categoria').replace(/[^a-z0-9-_]+/gi, '_');
        try {
            await this.printHTMLInHiddenFrame(html, `Kedrix_Categoria_${safeTitle}`);
        } catch (err) {
            console.warn('Export PDF categoria non riuscito:', err);
        }
    }

    formatCurrency(amount) {
        const value = Number(amount || 0);
        const lang = resolveRuntimeLang(this);
        const localeMap = { it: 'it-IT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR' };
        const locale = localeMap[lang] || 'it-IT';
        try {
            return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value);
        } catch {
            return `${value.toFixed(2)} €`;
        }
    }

    highlightField(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        field.style.transition = 'background-color 0.3s ease';
        field.style.backgroundColor = '#d4edda';
        field.style.borderColor = '#28a745';
        setTimeout(() => {
            field.style.backgroundColor = '';
            field.style.borderColor = '';
        }, 800);
    }

    showToast(message, type = 'success') {
        message = this.stripDecorativeText(message);
        const toast = document.getElementById('toast');
        if (!toast) return;

        const toastColors = {
            success: '#2dc653',
            error: '#ef233c',
            info: '#ef233c'
        };

        if (this._toastTimer) {
            clearTimeout(this._toastTimer);
            this._toastTimer = null;
        }

        toast.textContent = message;
        toast.style.background = toastColors[type] || toastColors.success;
        toast.classList.remove('show');
        void toast.offsetWidth;
        toast.classList.add('show');

        this._toastTimer = setTimeout(() => {
            toast.classList.remove('show');
            this._toastTimer = null;
        }, 2600);
    }


    getPopupUiCopy() {
        const lang = this.data?.language || 'it';
        const map = {
            it: {
                ok: 'OK',
                cancel: 'Annulla',
                confirm: 'Conferma',
                confirmTitle: 'Conferma operazione',
                promptTitle: 'Inserisci valore',
                expenseDescriptionPrompt: 'Descrizione',
                expenseAmountPrompt: 'Importo (€)',
                expenseCategoryPrompt: 'Categoria',
                newCategoryPrompt: 'Inserisci il nome della nuova categoria:'
            },
            en: {
                ok: 'OK',
                cancel: 'Cancel',
                confirm: 'Confirm',
                confirmTitle: 'Confirm action',
                promptTitle: 'Enter value',
                expenseDescriptionPrompt: 'Description',
                expenseAmountPrompt: 'Amount (€)',
                expenseCategoryPrompt: 'Category',
                newCategoryPrompt: 'Enter the name of the new category:'
            },
            es: {
                ok: 'OK',
                cancel: 'Cancelar',
                confirm: 'Confirmar',
                confirmTitle: 'Confirmar acción',
                promptTitle: 'Introduce un valor',
                expenseDescriptionPrompt: 'Descripción',
                expenseAmountPrompt: 'Importe (€)',
                expenseCategoryPrompt: 'Categoría',
                newCategoryPrompt: 'Introduce el nombre de la nueva categoría:'
            },
            fr: {
                ok: 'OK',
                cancel: 'Annuler',
                confirm: 'Confirmer',
                confirmTitle: 'Confirmer l’action',
                promptTitle: 'Saisir une valeur',
                expenseDescriptionPrompt: 'Description',
                expenseAmountPrompt: 'Montant (€)',
                expenseCategoryPrompt: 'Catégorie',
                newCategoryPrompt: 'Saisissez le nom de la nouvelle catégorie :' 
            }
        };
        return map[lang] || map.it;
    }

    ensureAppDialog() {
        let overlay = document.getElementById('bwAppDialog');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'bwAppDialog';
        overlay.className = 'modal-overlay modal-overlay-upgraded';
        overlay.style.display = 'none';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.72)';
        overlay.style.backdropFilter = 'blur(4px)';
        overlay.style.zIndex = '10050';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.innerHTML = `
            <div class="modal-content license-modal-card" style="background: var(--card-bg); padding: 24px; border-radius: 22px; max-width: 420px; width: min(92vw, 420px); box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 1px solid rgba(148,163,184,0.18);">
                <div id="bwAppDialogTitle" style="font-size: 1.05rem; font-weight: 800; margin-bottom: 10px;"></div>
                <div id="bwAppDialogMessage" style="color: var(--text-secondary); line-height: 1.5; white-space: pre-wrap;"></div>
                <input id="bwAppDialogInput" type="text" style="display:none; width:100%; margin-top:16px; padding:12px 14px; border-radius:14px; border:1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary);" />
                <div id="bwAppDialogActions" style="display:flex; gap:10px; justify-content:flex-end; margin-top:18px; flex-wrap:wrap;">
                    <button id="bwAppDialogCancel" class="btn-secondary" type="button"></button>
                    <button id="bwAppDialogConfirm" class="premium-btn premium-btn--fintech" type="button"></button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.bindOverlayEscape(overlay, () => {
            if (typeof overlay._bwClose === 'function') overlay._bwClose(false, true);
        });
        return overlay;
    }

    showAppConfirm(message, options = {}) {
        return new Promise((resolve) => {
            const overlay = this.ensureAppDialog();
            const copy = this.getPopupUiCopy();
            const titleEl = document.getElementById('bwAppDialogTitle');
            const messageEl = document.getElementById('bwAppDialogMessage');
            const inputEl = document.getElementById('bwAppDialogInput');
            const cancelBtn = document.getElementById('bwAppDialogCancel');
            const confirmBtn = document.getElementById('bwAppDialogConfirm');

            if (!overlay || !titleEl || !messageEl || !cancelBtn || !confirmBtn || !inputEl) {
                resolve(false);
                return;
            }

            titleEl.textContent = options.title || copy.confirmTitle;
            messageEl.textContent = this.stripDecorativeText(message);
            inputEl.style.display = 'none';
            inputEl.value = '';
            cancelBtn.style.display = '';
            cancelBtn.textContent = options.cancelText || copy.cancel;
            confirmBtn.textContent = options.confirmText || copy.confirm;

            const finish = (result) => {
                overlay.style.display = 'none';
                this.setOverlayState(false);
                overlay._bwClose = null;
                resolve(result);
            };

            overlay._bwClose = (result, dismissed = false) => finish(dismissed ? false : result);
            cancelBtn.onclick = () => finish(false);
            confirmBtn.onclick = () => finish(true);
            overlay.style.display = 'flex';
            if (typeof overlay._bwApplyLayout === 'function') overlay._bwApplyLayout();
            this.setOverlayState(true);
            setTimeout(() => confirmBtn.focus(), 0);
        });
    }

    showAppPrompt(message, defaultValue = '', options = {}) {
        return new Promise((resolve) => {
            const overlay = this.ensureAppDialog();
            const copy = this.getPopupUiCopy();
            const titleEl = document.getElementById('bwAppDialogTitle');
            const messageEl = document.getElementById('bwAppDialogMessage');
            const inputEl = document.getElementById('bwAppDialogInput');
            const cancelBtn = document.getElementById('bwAppDialogCancel');
            const confirmBtn = document.getElementById('bwAppDialogConfirm');

            if (!overlay || !titleEl || !messageEl || !cancelBtn || !confirmBtn || !inputEl) {
                resolve(null);
                return;
            }

            titleEl.textContent = options.title || copy.promptTitle;
            messageEl.textContent = this.stripDecorativeText(message);
            inputEl.style.display = '';
            inputEl.value = defaultValue == null ? '' : String(defaultValue);
            inputEl.placeholder = options.placeholder || '';
            cancelBtn.style.display = '';
            cancelBtn.textContent = options.cancelText || copy.cancel;
            confirmBtn.textContent = options.confirmText || copy.confirm;

            const finish = (result, dismissed = false) => {
                overlay.style.display = 'none';
                this.setOverlayState(false);
                overlay._bwClose = null;
                resolve(dismissed ? null : result);
            };

            overlay._bwClose = (_result, dismissed = false) => finish(null, dismissed);
            cancelBtn.onclick = () => finish(null, true);
            confirmBtn.onclick = () => finish(inputEl.value);
            inputEl.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    finish(inputEl.value);
                }
            };
            overlay.style.display = 'flex';
            if (typeof overlay._bwApplyLayout === 'function') overlay._bwApplyLayout();
            this.setOverlayState(true);
            setTimeout(() => {
                inputEl.focus();
                inputEl.select();
            }, 0);
        });
    }

    handleChatInput() {
        const input = document.getElementById('chatInput');
        const question = input.value.trim();
        if (!question) return;
        this.addChatMessage('user', question);
        input.value = '';
        setTimeout(() => {
            const answer = this.generateAnswer(question);
            this.addChatMessage('bot', answer);
        }, 500);
    }

    addChatMessage(sender, text) {
        const container = document.getElementById('chatMessages');
        const div = document.createElement('div');
        div.className = `chat-message ${sender}`;
        div.innerHTML = `<span class="message-sender">${sender === 'bot' ? '🤖 ' + this.t('assistantName') : '👤 ' + this.t('youLabel')}:</span> <span class="message-text">${text}</span>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    generateAnswer(question) {
        const q = (question || '').toLowerCase();
        const remaining = this.calculateRemaining();
        const dailyBudget = this.calculateDailyBudget();
        const totalSpent = this.calculateTotalVariableExpenses();
        const totalFixed = this.calculateTotalFixedExpensesUnpaid();
        const daysLeft = Math.max(1, this.getDaysLeft() || 0);
        const lang = (this.data && this.data.language) || document.documentElement.lang || 'it';
        const aiCopy = {
            it: {
                yesSave: 'Sì! Puoi risparmiare',
                needSave: 'Ti basterebbe risparmiare',
                perDay: 'al giorno',
                currentBudget: "Con l'attuale budget",
                in: 'in',
                daysYouWillHave: 'giorni avrai',
                topCategory: 'La categoria in cui spendi di più è',
                with: 'con',
                goalIn: "Raggiungerai l'obiettivo in",
                months: 'mesi'
            },
            en: {
                yesSave: 'Yes! You can save',
                needSave: 'You would need to save',
                perDay: 'per day',
                currentBudget: 'With your current budget',
                in: 'in',
                daysYouWillHave: "days you'll have",
                topCategory: 'The category where you spend the most is',
                with: 'with',
                goalIn: "You'll reach your goal in",
                months: 'months'
            },
            es: {
                yesSave: '¡Sí! Puedes ahorrar',
                needSave: 'Solo tendrías que ahorrar',
                perDay: 'al día',
                currentBudget: 'Con el presupuesto actual',
                in: 'en',
                daysYouWillHave: 'días tendrás',
                topCategory: 'La categoría en la que más gastas es',
                with: 'con',
                goalIn: 'Alcanzarás tu objetivo en',
                months: 'meses'
            },
            fr: {
                yesSave: 'Oui ! Tu peux économiser',
                needSave: 'Il te suffirait d’économiser',
                perDay: 'par jour',
                currentBudget: 'Avec le budget actuel',
                in: 'dans',
                daysYouWillHave: 'jours tu auras',
                topCategory: 'La catégorie où tu dépenses le plus est',
                with: 'avec',
                goalIn: 'Tu atteindras ton objectif dans',
                months: 'mois'
            }
        };
        const copy = aiCopy[lang] || aiCopy.it;

        if (q.includes('risparmi') || q.includes('risparmiare') || q.includes('save') || q.includes('ahorrar') || q.includes('économ')) {
            const match = q.match(/(\d+)/);
            if (match) {
                const target = parseInt(match[0], 10);
                const daily = dailyBudget;
                if (daily * daysLeft >= target) {
                    return `✅ ${copy.yesSave} ${target}€. ${copy.needSave} ${(target / daysLeft).toFixed(2)}€ ${copy.perDay}.`;
                }
                return `⚠️ ${copy.currentBudget} ${this.formatCurrency(daily)} ${copy.perDay}, ${copy.in} ${daysLeft} ${copy.daysYouWillHave} ${this.formatCurrency(daily * daysLeft)}.`;
            }
        }

        if (q.includes('categoria') || q.includes('category') || q.includes('spendo di più') || q.includes('spend most') || q.includes('categoría') || q.includes('catégorie')) {
            const categories = {};
            if (this.data.variableExpenses && typeof this.data.variableExpenses === 'object') {
                Object.values(this.data.variableExpenses).forEach(day => {
                    if (Array.isArray(day)) {
                        day.forEach(exp => {
                            const catName = exp.category || 'Altro';
                            categories[catName] = (categories[catName] || 0) + (exp.amount || 0);
                        });
                    }
                });
            }
            if (Object.keys(categories).length === 0) return this.t('noExpenses');
            const top = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
            return `📊 ${copy.topCategory} "${top[0]}" ${copy.with} ${this.formatCurrency(top[1])}.`;
        }

        if (q.includes('obiettivo') || q.includes('goal') || q.includes('objetivo') || q.includes('objectif')) {
            const goal = this.data.savingsGoal;
            const percent = this.data.savingsPercent;
            const income = this.calculateTotalIncome();
            if (!goal || !percent) return this.t('noGoal');
            const savedPerMonth = (income * percent) / 100;
            const monthsNeeded = Math.ceil(goal / savedPerMonth);
            return `🎯 ${copy.goalIn} ${monthsNeeded} ${copy.months}.`;
        }
        return this.getContextualAdvice();
    }

    getContextualAdvice() {
        const remaining = this.calculateRemaining();
        const dailyBudget = this.calculateDailyBudget();
        if (remaining < 0) {
            return this.t("adviceRed");
        } else if (remaining < dailyBudget * 7) {
            return this.t("adviceLowRemaining", { remaining: this.formatCurrency(remaining) });
        } else {
            return this.t("adviceGood", { remaining: this.formatCurrency(remaining) });
        }
    }

    toggleTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
        document.getElementById('themeToggle').textContent = isDark ? 'Dark' : 'Light';
        this.writeStorage('kedrix-theme', isDark ? 'light' : 'dark');
        const nowTheme = isDark ? 'light' : 'dark';
        if (nowTheme === 'dark') {
            // Ensure dark mode is not overridden by inline custom colors
            this.clearThemeInlineOverrides();
        }
        // Riapplica eventuali colori custom (senza bloccare la dark mode)
        if (this.readStorage('kedrix-custom-colors')) {
            if (nowTheme === 'dark') {
                this.applyAccentOnlyFromCustomColors();
            } else {
                this.applyCustomColors();
            }
        } else {
            this.clearThemeInlineOverrides();
        }
        this.updateChart();
    }

    applyTheme() {
        if (this.readStorage('kedrix-theme') === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            const t = document.getElementById('themeToggle');
            if (t) t.textContent = 'Light';
            // Avoid inline overrides freezing light colors in dark mode
            this.clearThemeInlineOverrides();
            if (this.readStorage('kedrix-custom-colors')) {
                this.applyAccentOnlyFromCustomColors();
            }
        }
    }

    getCurrentTheme() {
        // Source of truth: data-theme attribute (html), fallback to localStorage
        const attr = document.documentElement.getAttribute('data-theme');
        if (attr === 'dark') return 'dark';
        const saved = this.readStorage('kedrix-theme');
        return saved === 'dark' ? 'dark' : 'light';
    }
getCurrentThemeColors() {
        const style = getComputedStyle(document.documentElement);
        return {
            accent: style.getPropertyValue('--accent').trim() || '#0ea5e9',
            accentLight: style.getPropertyValue('--accent-light').trim() || '#38bdf8',
            cardBg: style.getPropertyValue('--card-bg').trim() || '#ffffff',
            textPrimary: style.getPropertyValue('--text-primary').trim() || '#0f172a',
            textSecondary: style.getPropertyValue('--text-secondary').trim() || '#334155',
            bg: style.getPropertyValue('--bg-color').trim() || '#f8fafc',
            success: style.getPropertyValue('--success').trim() || '#10b981',
            danger: style.getPropertyValue('--danger').trim() || '#ef4444',
            warning: style.getPropertyValue('--warning').trim() || '#f59e0b',
            border: style.getPropertyValue('--border').trim() || '#e2e8f0'
        };
    }

    applyCustomColors() {
        // Apply ONLY if user has custom colors saved.
        if (!this.customColors) return;
        const currentTheme = this.getCurrentTheme ? this.getCurrentTheme() : (this.readStorage('kedrix-theme') === 'dark' ? 'dark' : 'light');
        const savedTheme = this.customColorsTheme || this.readStorage('kedrix-custom-colors-theme') || 'light';
        const crossTheme = savedTheme !== currentTheme;
        // Se i colori sono stati salvati in LIGHT, non devono bloccare la DARK mode.
        const lockSensitive = crossTheme && currentTheme === 'dark';
        document.documentElement.style.setProperty('--accent', this.customColors.accent);
        document.documentElement.style.setProperty('--accent-light', this.customColors.accentLight);
        if (!lockSensitive) document.documentElement.style.setProperty('--card-bg', this.customColors.cardBg);
        if (!lockSensitive) document.documentElement.style.setProperty('--text-primary', this.customColors.textPrimary);
        if (!lockSensitive) document.documentElement.style.setProperty('--text-secondary', this.customColors.textSecondary);
        if (!lockSensitive) document.documentElement.style.setProperty('--bg-color', this.customColors.bg);
document.documentElement.style.setProperty('--success', this.customColors.success);
        document.documentElement.style.setProperty('--danger', this.customColors.danger);
        document.documentElement.style.setProperty('--warning', this.customColors.warning);
        if (!lockSensitive) document.documentElement.style.setProperty('--border', this.customColors.border);
document.documentElement.style.setProperty('--accent-gradient', 
            `linear-gradient(135deg, ${this.customColors.accent}, ${this.customColors.accentLight})`);
        
        this.syncColorPickers();
    }

    
    applyAccentOnlyFromCustomColors() {
        if (!this.customColors) return;
        document.documentElement.style.setProperty('--accent', this.customColors.accent);
        document.documentElement.style.setProperty('--accent-light', this.customColors.accentLight);
        document.documentElement.style.setProperty('--success', this.customColors.success);
        document.documentElement.style.setProperty('--danger', this.customColors.danger);
        document.documentElement.style.setProperty('--warning', this.customColors.warning);
        document.documentElement.style.setProperty('--accent-gradient',
            `linear-gradient(135deg, ${this.customColors.accent}, ${this.customColors.accentLight})`);
    }


    clearThemeInlineOverrides() {
        const props = [
            '--accent', '--accent-light', '--card-bg', '--text-primary', '--text-secondary',
            '--bg-color', '--success', '--danger', '--warning', '--border', '--accent-gradient'
        ];
        props.forEach(p => document.documentElement.style.removeProperty(p));
    }

    syncColorPickers() {
        const setField = (id, value) => {
            const input = document.getElementById(id);
            if (!input) return;

            // <input type="color"> accetta solo #RRGGBB. Se troviamo valori tipo rgb/rgba li normalizziamo.
            const normalizeToHex = (v) => {
                if (!v) return '';
                v = String(v).trim();

                // già #RRGGBB
                if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;

                // #RGB -> #RRGGBB
                const short = v.match(/^#([0-9a-fA-F]{3})$/);
                if (short) {
                    const s = short[1];
                    return '#' + s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
                }

                // rgb()/rgba() -> #RRGGBB (ignora alpha)
                const rgb = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i);
                if (rgb) {
                    const r = Math.max(0, Math.min(255, parseInt(rgb[1], 10)));
                    const g = Math.max(0, Math.min(255, parseInt(rgb[2], 10)));
                    const b = Math.max(0, Math.min(255, parseInt(rgb[3], 10)));
                    const toHex = (n) => n.toString(16).padStart(2, '0');
                    return '#' + toHex(r) + toHex(g) + toHex(b);
                }

                return '';
            };

            // Se il campo è un color picker, settiamo solo valori validi
            if (input.type === 'color') {
                const hex = normalizeToHex(value);
                if (hex) input.value = hex;
                return;
            }

            // altrimenti set normale
            input.value = value ?? '';
        };
        setField('colorAccent', this.customColors.accent);
        setField('colorAccentLight', this.customColors.accentLight);
        setField('colorCardBg', this.customColors.cardBg);
        setField('colorTextPrimary', this.customColors.textPrimary);
        setField('colorTextSecondary', this.customColors.textSecondary);
        setField('colorBg', this.customColors.bg);
        setField('colorSuccess', this.customColors.success);
        setField('colorDanger', this.customColors.danger);
        setField('colorWarning', this.customColors.warning);
        setField('colorBorder', this.customColors.border);
    }

    saveCustomColors() {
        this.writeStorage('kedrix-custom-colors', JSON.stringify(this.customColors));
        const currentTheme = this.getCurrentTheme ? this.getCurrentTheme() : (this.readStorage('kedrix-theme') === 'dark' ? 'dark' : 'light');
        this.writeStorage('kedrix-custom-colors-theme', currentTheme);
        this.customColorsTheme = currentTheme;
    }

    setupColorPickers() {
        const colorInputs = [
            'colorAccent', 'colorAccentLight', 'colorCardBg', 
            'colorTextPrimary', 'colorTextSecondary', 'colorBg',
            'colorSuccess', 'colorDanger', 'colorWarning', 'colorBorder'
        ];
        
        colorInputs.forEach(id => {
            const picker = document.getElementById(id);
            if (picker) {
                picker.addEventListener('input', (e) => {
                    const value = e.target.value;
                    // First time the user touches a picker, initialize from current theme defaults.
                    if (!this.customColors) {
                        this.customColors = this.getCurrentThemeColors();
                    }
                    const propName = id.replace('color', '').charAt(0).toLowerCase() + id.replace('color', '').slice(1);
                    this.customColors[propName] = value;
                    this.applyCustomColors();
                    this.saveCustomColors();
                });
            }
        });
        
        const resetBtn = document.getElementById('resetColorsBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                // Reset to theme defaults and remove inline overrides.
                this.customColors = null;
                this.removeStorage('kedrix-custom-colors');
                this.removeStorage('kedrix-custom-colors-theme');
                this.customColorsTheme = null;
                this.clearThemeInlineOverrides();
                this.syncColorPickers();
                this.showToast(this.t('resetColors') || 'Colori ripristinati', 'success');
            });
        }
    }

    saveData() {
        this.writeStorage('kedrix-data', JSON.stringify(this.data));
    }

    loadData() {
        const saved = this.readStorage('kedrix-data');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                
                if (parsed.incomes && parsed.incomes.length > 0 && !parsed.periodStart) {
                    const firstIncome = parsed.incomes.sort((a, b) => 
                        new Date(a.date) - new Date(b.date)
                    )[0];
                    
                    const startDate = new Date(firstIncome.date);
                    const endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 30);
                    
                    parsed.periodStart = startDate.toISOString().split('T')[0];
                    parsed.periodEnd = endDate.toISOString().split('T')[0];
                }
                
                if (parsed.income !== undefined && !parsed.incomes) {
                    parsed.incomes = [{
                        desc: this.getRuntimeLanguage() === 'it' ? 'Stipendio' : 'Salary',
                        amount: parsed.income,
                        date: this.formatLocalDate(new Date()),
                        id: Date.now()
                    }];
                    delete parsed.income;
                }
                
                this.data = parsed;
                if (this.data.savingsPot === undefined) this.data.savingsPot = 0;
                if (!this.data.fixedMatchAliases || typeof this.data.fixedMatchAliases !== 'object') this.data.fixedMatchAliases = {};
                if (!this.data.fixedMatchDismissed || typeof this.data.fixedMatchDismissed !== 'object') this.data.fixedMatchDismissed = {};
            } catch (e) {
                console.warn('Errore nel caricamento dati, reset automatico');
                this.resetAll();
            }
        }
    }

    backupData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = `budgetkedrix-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        this.showToast(this.t('backupDownloaded'), 'success');
    }

    restoreData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.data = JSON.parse(e.target.result);
                this.saveData();
                this.updateUI();
                this.updateChart();
                this.applyLanguage();
                this.showToast(this.t('dataRestored'), 'success');
            } catch {
                this.showToast(this.t('invalidFile'), 'error');
            }
        };
        reader.readAsText(file);
    }

    
    async resetAll() {
        if (!await this.showAppConfirm(this.t('confirmReset'))) return;

        const raw = this.readStorage('kedrix-data');
        let fixed = [];
        let language = this.data.language || 'it';
        let threshold = Number(this.data.threshold || 50);
        let fixedMatchAliases = this.data.fixedMatchAliases || {};
        let fixedMatchDismissed = this.data.fixedMatchDismissed || {};
        try {
            if (raw) {
                const parsed = JSON.parse(raw);
                fixed = parsed.fixedExpenses || [];
                language = parsed.language || language;
                threshold = Number(parsed.threshold || threshold);
                fixedMatchAliases = parsed.fixedMatchAliases || fixedMatchAliases;
                fixedMatchDismissed = parsed.fixedMatchDismissed || fixedMatchDismissed;
            }
        } catch (e) {}

        const start = this.getDefaultPeriodStart();
        const end = this.getDefaultPeriodEnd();

        this.data = {
            incomes: [],
            fixedExpenses: fixed,
            variableExpenses: {},
            savingsPercent: 0,
            savingsGoal: 0,
            savingsPot: 0,
            threshold,
            language,
            fixedMatchAliases,
            fixedMatchDismissed,
            periodStart: start,
            periodEnd: end
        };

        localStorage.removeItem('bw_planned_savings_period');
        localStorage.removeItem('bw_saving_rate');
        localStorage.removeItem('bw_accumulated_savings');

        this.saveData();
        this.customColors = this.getCurrentThemeColors();

        const goalInput = document.getElementById('saveGoal');
        if (goalInput) goalInput.value = '0';
        const percentInput = document.getElementById('savePercent');
        if (percentInput) percentInput.value = '0';

        this.updateUI();
        this.applyLanguage();
        this.showToast(this.t('resetCompleted'), 'success');
    }


    async resetFixedExpenses() {
        if (!await this.showAppConfirm(this.t('confirmResetFixed'))) return;

        this.data.fixedExpenses = [];
        this.saveData();
        this.updateUI();
        this.applyLanguage();
        this.showToast(this.t('resetFixedCompleted'), 'success');
    }

    exportToCalendar() {
        let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Kedrix//IT\n";
        if (Array.isArray(this.data.fixedExpenses)) {
            this.data.fixedExpenses.forEach(exp => {
                if (exp && exp.endDate && new Date(exp.endDate) >= new Date()) {
                    ics += "BEGIN:VEVENT\n";
                    ics += `SUMMARY:💰 ${exp.name || 'Spesa'}\n`;
                    ics += `DESCRIPTION:${this.t('fixedExpense')} ${this.formatCurrency(exp.amount || 0)} - ${this.t('everyMonthOnDay')} ${exp.day || '?'}\n`;
                    const nextDate = this.getNextPaymentDate(exp.day || 1);
                    ics += `DTSTART;VALUE=DATE:${nextDate.replace(/-/g, '')}\n`;
                    ics += `RRULE:FREQ=MONTHLY;UNTIL=${(exp.endDate || '').replace(/-/g, '')}\n`;
                    ics += "END:VEVENT\n";
                }
            });
        }
        if (this.data.variableExpenses && typeof this.data.variableExpenses === 'object') {
            Object.entries(this.data.variableExpenses).forEach(([date, expenses]) => {
                if (Array.isArray(expenses)) {
                    expenses.forEach(exp => {
                        ics += "BEGIN:VEVENT\n";
                        ics += `SUMMARY:🛒 ${exp.name || 'Spesa'}\n`;
                        ics += `DESCRIPTION:${exp.category || 'Altro'} - ${this.formatCurrency(exp.amount || 0)}\n`;
                        ics += `DTSTART;VALUE=DATE:${date.replace(/-/g, '')}\n`;
                        ics += "END:VEVENT\n";
                    });
                }
            });
        }
        ics += "END:VCALENDAR";
        const blob = new Blob([ics], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budgetkedrix-${this.data.periodStart}.ics`;
        a.click();
        this.showToast(this.t('calendarExported'), 'success');
    }

    // ========== IMPARARE CATEGORIE (AI locale) ==========
    /** Migra regole legacy su storage unico bw_category_learning */
    migrateCategoryRules(raw) {
        const migrated = {};
        for (const [key, val] of Object.entries(raw || {})) {
            const normalizedKey = String(key || '').trim().toLowerCase();
            if (!normalizedKey) continue;
            if (typeof val === 'string') {
                migrated[normalizedKey] = { category: val, subCategory: '', confidence: 1 };
            } else if (val && typeof val.category === 'string') {
                migrated[normalizedKey] = {
                    category: val.category,
                    subCategory: (val.subCategory || '').toString().trim(),
                    confidence: Math.max(1, val.confidence || val.hits || 1)
                };
            }
        }
        return migrated;
    }

    saveCategoryLearning() {
        localStorage.setItem('bw_category_learning', JSON.stringify(this.categoryRules || {}));
    }

    normalizeLearningText(description) {
        return String(description || '')
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/\d+/g, ' ')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    getLearningStopwords() {
        return new Set([
            'pagamento', 'payment', 'acquisto', 'purchase', 'transazione', 'transaction', 'addebito', 'charge',
            'carta', 'card', 'visa', 'mastercard', 'debit', 'credito', 'credit', 'pos', 'saldo', 'sepa', 'iban',
            'sdd', 'trx', 'txn', 'web', 'online', 'shop', 'store', 'spa', 'srl', 'sas', 'srls', 'ltd', 'inc',
            'the', 'for', 'con', 'per', 'via', 'del', 'della', 'dei', 'degli', 'delle', 'presso', 'su', 'da'
        ]);
    }

    /** Normalizza descrizione e restituisce token utili per il learning, evitando falsi positivi */
    normalizeDescriptionForLearning(description) {
        const normalized = this.normalizeLearningText(description);
        if (!normalized) return [];
        const stopwords = this.getLearningStopwords();
        const rawTokens = normalized.split(' ').filter(Boolean);
        const filtered = rawTokens.filter(token => token.length >= 3 && !stopwords.has(token));
        const finalTokens = filtered.length ? filtered : rawTokens.filter(token => token.length >= 3);
        const seen = new Set();
        const out = [];
        for (const token of finalTokens) {
            if (!seen.has(token)) {
                seen.add(token);
                out.push(token);
            }
        }
        if (/iban|rid|sepa|sdd|abbonamento|subscription/i.test(description || '')) {
            if (!seen.has('ricorrente')) out.push('ricorrente');
        }
        return out;
    }

    learnCategory(description, category, subCategory = '') {
        if (!description || !category) return;
        const tokens = this.normalizeDescriptionForLearning(description);
        const normalizedSub = (subCategory || '').toString().trim();
        for (const keyword of tokens) {
            if (keyword.length < 3) continue;
            const existing = this.categoryRules[keyword];
            const sameMapping = existing && existing.category === category && ((existing.subCategory || '') === normalizedSub);
            if (sameMapping) {
                existing.confidence = Math.min(10, (existing.confidence || 1) + 1);
            } else {
                this.categoryRules[keyword] = {
                    category,
                    subCategory: normalizedSub,
                    confidence: Math.min(10, Math.max(1, (existing?.confidence || 0) + 1))
                };
            }
        }
        this.saveCategoryLearning();
        console.log(`📌 Appreso: "${tokens.slice(0, 3).join(', ')}" → ${category}${normalizedSub ? ' / ' + normalizedSub : ''}`);
    }

    /**
     * Suggerisce categoria da descrizione.
     * Matching token-based: evita BAR vs BARBIERE ma consente AMAZON EU / AMAZON MKTPLACE.
     * @returns {{ category: string, subCategory: string, confidence: number }}
     */
    suggestCategory(description) {
        const tokens = this.normalizeDescriptionForLearning(description);
        if (!tokens.length) return { category: 'Altro', subCategory: '', confidence: 0 };
        const buckets = new Map();
        for (const token of tokens) {
            const rule = this.categoryRules[token];
            if (!rule || !rule.category) continue;
            const key = `${rule.category}__${rule.subCategory || ''}`;
            if (!buckets.has(key)) {
                buckets.set(key, { category: rule.category, subCategory: rule.subCategory || '', confidence: 0, matches: 0 });
            }
            const bucket = buckets.get(key);
            bucket.confidence += Math.max(1, rule.confidence || 1);
            bucket.matches += 1;
        }
        if (!buckets.size) return { category: 'Altro', subCategory: '', confidence: 0 };
        const ranked = Array.from(buckets.values()).sort((a, b) => {
            if (b.confidence !== a.confidence) return b.confidence - a.confidence;
            if (b.matches !== a.matches) return b.matches - a.matches;
            return (b.subCategory ? 1 : 0) - (a.subCategory ? 1 : 0);
        });
        return ranked[0];
    }

    /** Per retrocompatibilità: restituisce solo la stringa categoria (come prima) */
    suggestCategoryString(description) {
        return this.suggestCategory(description).category;
    }


    getDefaultCategoryTree() {
        return [
            { id: 'alimentari', label: 'Alimentari', isDefault: true, subcategories: [
                { id: 'supermercato', label: 'Supermercato' },
                { id: 'ristorante', label: 'Ristorante' },
                { id: 'bar', label: 'Bar' }
            ]},
            { id: 'trasporti', label: 'Trasporti', isDefault: true, subcategories: [
                { id: 'carburante', label: 'Carburante' },
                { id: 'pedaggi', label: 'Pedaggi' },
                { id: 'taxi', label: 'Taxi' },
                { id: 'trasporto-pubblico', label: 'Trasporto pubblico' }
            ]},
            { id: 'svago', label: 'Svago', isDefault: true, subcategories: [] },
            { id: 'salute', label: 'Salute', isDefault: true, subcategories: [] },
            { id: 'abbigliamento', label: 'Abbigliamento', isDefault: true, subcategories: [] },
            { id: 'altro', label: 'Altro', isDefault: true, subcategories: [] }
        ];
    }

    slugifyCategoryLabel(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || `cat-${Date.now()}`;
    }

    normalizeCategoryTree(rawTree) {
        if (!Array.isArray(rawTree)) return [];
        return rawTree
            .filter(item => item && typeof item.label === 'string' && item.label.trim())
            .map(item => ({
                id: item.id || this.slugifyCategoryLabel(item.label),
                label: item.label.trim(),
                isDefault: !!item.isDefault,
                subcategories: Array.isArray(item.subcategories)
                    ? item.subcategories
                        .filter(sub => sub && typeof sub.label === 'string' && sub.label.trim())
                        .map(sub => ({ id: sub.id || this.slugifyCategoryLabel(sub.label), label: sub.label.trim() }))
                    : []
            }));
    }

    loadCategoryTree() {
        const stored = this.normalizeCategoryTree(JSON.parse(localStorage.getItem('bw_categories')) || []);
        const defaultTree = this.getDefaultCategoryTree();
        const defaultMap = new Map(defaultTree.map(cat => [cat.label, cat]));
        let tree = stored.length ? stored : defaultTree;
        const legacyCustom = JSON.parse(this.readStorage('kedrix-custom-categories')) || [];
        legacyCustom.forEach(cat => {
            const label = String(cat || '').trim();
            if (!label) return;
            if (!tree.some(item => item.label === label)) {
                tree.push({ id: this.slugifyCategoryLabel(label), label, isDefault: false, subcategories: [] });
            }
        });
        tree = this.normalizeCategoryTree(tree);
        defaultTree.forEach(defaultCat => {
            const existing = tree.find(item => item.label === defaultCat.label);
            if (!existing) {
                tree.push(defaultCat);
                return;
            }
            existing.isDefault = true;
            const subMap = new Map(existing.subcategories.map(sub => [sub.label, sub]));
            defaultCat.subcategories.forEach(sub => {
                if (!subMap.has(sub.label)) existing.subcategories.push(sub);
            });
        });
        this.categoryTree = tree;
        this.saveCategoryTree();
        return tree;
    }

    saveCategoryTree() {
        const normalized = this.normalizeCategoryTree(this.categoryTree || []);
        this.categoryTree = normalized;
        this.defaultCategories = normalized.filter(cat => !!cat.isDefault).map(cat => cat.label);
        this.customCategories = normalized.filter(cat => !cat.isDefault).map(cat => cat.label);
        localStorage.setItem('bw_categories', JSON.stringify(normalized));
        this.writeStorage('kedrix-custom-categories', JSON.stringify(this.customCategories));
    }

    getCategoryTree() {
        if (!Array.isArray(this.categoryTree) || !this.categoryTree.length) this.loadCategoryTree();
        return this.categoryTree || [];
    }

    getAllCategories() {
        return this.getCategoryTree().map(cat => cat.label);
    }

    getSubcategoriesForCategory(category) {
        const found = this.getCategoryTree().find(cat => cat.label === category);
        return found?.subcategories || [];
    }

    ensureCategoryExists(category, subCategory = '') {
        const catLabel = String(category || '').trim() || 'Altro';
        let tree = this.getCategoryTree();
        let cat = tree.find(item => item.label === catLabel);
        if (!cat) {
            cat = { id: this.slugifyCategoryLabel(catLabel), label: catLabel, isDefault: false, subcategories: [] };
            tree.push(cat);
        }
        const subLabel = String(subCategory || '').trim();
        if (subLabel && !cat.subcategories.some(sub => sub.label === subLabel)) {
            cat.subcategories.push({ id: this.slugifyCategoryLabel(subLabel), label: subLabel });
        }
        this.saveCategoryTree();
    }

    updateSubcategorySelect(category = null, selectedSubCategory = '') {
        const subSelect = document.getElementById('expenseSubCategory');
        const parent = category || document.getElementById('expenseCategory')?.value || 'Altro';
        if (!subSelect) return;
        const subs = this.getSubcategoriesForCategory(parent);
        let options = `<option value="">${this.t('expenseSubCategory')}</option>`;
        options += subs.map(sub => `<option value="${sub.label}" ${sub.label === selectedSubCategory ? 'selected' : ''}>${sub.label}</option>`).join('');
        subSelect.innerHTML = options;
        subSelect.value = selectedSubCategory || '';
    }

    // ========== GESTIONE CATEGORIE PERSONALIZZATE ==========
    saveCustomCategories() {
        this.saveCategoryTree();
    }

    setOverlayState(isOpen) {
        document.body.classList.toggle('bw-overlay-open', !!isOpen);
    }

    bindOverlayEscape(overlay, onClose) {
        if (!overlay || overlay.dataset.bwEscapeBound === '1') return;
        overlay.dataset.bwEscapeBound = '1';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) onClose?.();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.style.display !== 'none' && overlay.style.display !== '') {
                onClose?.();
            }
        });
    }
    
    showCategoryManager() {
        const overlay = document.getElementById('categoryManagerOverlay');
        if (!overlay) return;
        this.refreshCategoryList();
        this.bindOverlayEscape(overlay, () => this.hideCategoryManager());
        this.setOverlayState(true);
        overlay.style.display = 'flex';
    }
    
    hideCategoryManager() {
        const overlay = document.getElementById('categoryManagerOverlay');
        if (overlay) overlay.style.display = 'none';
        this.setOverlayState(false);
    }
    
    refreshCategoryList() {
        const defaultList = document.getElementById('defaultCategoriesList');
        const customList = document.getElementById('customCategoriesList');
        const renderBlock = (cat, isCustom = false, customIndex = -1) => {
            const subs = (cat.subcategories || []).map(sub => `<span class="subcategory-chip">${sub.label}</span>`).join('');
            const actions = isCustom ? `<div><button class="edit-category-btn icon-only-btn" title="${this.t('edit')}" aria-label="${this.t('edit')}" data-index="${customIndex}"></button><button class="delete-category-btn icon-only-btn" title="${this.t('delete')}" aria-label="${this.t('delete')}" data-index="${customIndex}"></button></div>` : '';
            return `<div class="category-item ${isCustom ? 'custom' : 'default'}"><div class="category-tree-block"><div>${this.renderCategoryLabel(cat.label, { className: 'manager' })}</div>${subs ? `<div class="subcategory-chips">${subs}</div>` : ''}</div>${actions}</div>`;
        };
        const tree = this.getCategoryTree();
        const defaultCats = tree.filter(cat => !!cat.isDefault);
        const customCats = tree.filter(cat => !cat.isDefault);
        if (defaultList) defaultList.innerHTML = defaultCats.map(cat => renderBlock(cat, false)).join('');
        if (customList) {
            if (customCats.length === 0) {
                customList.innerHTML = `<p class="empty-message">${this.t('noCustomCategories')}</p>`;
            } else {
                customList.innerHTML = customCats.map((cat, index) => renderBlock(cat, true, index)).join('');
                document.querySelectorAll('.edit-category-btn').forEach(btn => btn.addEventListener('click', (e) => this.editCategory(parseInt(e.currentTarget.dataset.index, 10))));
                document.querySelectorAll('.delete-category-btn').forEach(btn => btn.addEventListener('click', (e) => this.deleteCategory(parseInt(e.currentTarget.dataset.index, 10))));
            }
        }
        const subParent = document.getElementById('newSubcategoryParent');
        if (subParent) {
            const previousParent = subParent.value;
            subParent.innerHTML = this.getAllCategories().map(cat => `<option value="${cat}">${this.getCategoryDisplay(cat)}</option>`).join('');
            const fallbackParent = this.getAllCategories()[0] || 'Altro';
            subParent.value = this.getAllCategories().includes(previousParent) ? previousParent : fallbackParent;
        }
    }
    
    async editCategory(index) {
        const customCats = this.getCategoryTree().filter(cat => !cat.isDefault);
        const target = customCats[index];
        if (!target) return;
        const oldName = target.label;
        const newName = await this.showAppPrompt(this.t('categoryName'), oldName, { title: this.getPopupUiCopy().promptTitle, placeholder: this.t('categoryName') });
        if (!newName || newName.trim() === '') return;
        const trimmed = newName.trim();
        if (this.getAllCategories().includes(trimmed) && trimmed !== oldName) {
            this.showToast(this.t('categoryAlreadyExists'), 'error');
            return;
        }
        const cat = this.getCategoryTree().find(item => item.label === oldName);
        if (!cat) return;
        cat.label = trimmed;
        this.saveCategoryTree();
        this.refreshCategoryList();
        this.updateAllCategorySelects();
        this.showToast(this.t('categoryUpdated'), 'success');
    }
    
    async deleteCategory(index) {
        const customCats = this.getCategoryTree().filter(cat => !cat.isDefault);
        const target = customCats[index];
        if (!target) return;
        const cat = target.label;
        if (!await this.showAppConfirm(this.t('confirmDeleteCategory').replace('{name}', cat))) return;
        this.categoryTree = this.getCategoryTree().filter(item => item.label !== cat);
        this.saveCategoryTree();
        this.refreshCategoryList();
        this.updateAllCategorySelects();
        this.showToast(this.t('categoryDeleted'), 'success');
    }
    
    saveCategory() {
        const input = document.getElementById('newCategoryName');
        if (!input) return;
        const newCat = input.value.trim();
        if (!newCat) return;
        if (this.getAllCategories().includes(newCat)) {
            this.showToast(this.t('categoryAlreadyExists'), 'error');
            return;
        }
        this.ensureCategoryExists(newCat, '');
        input.value = '';
        this.refreshCategoryList();
        this.updateAllCategorySelects();
        this.showToast(this.t('categoryAdded'), 'success');
    }

    saveSubcategory() {
        const parentSelect = document.getElementById('newSubcategoryParent');
        const input = document.getElementById('newSubcategoryName');
        if (!parentSelect || !input) return;
        const parent = parentSelect.value;
        const sub = input.value.trim();
        if (!parent || !sub) return;
        const existing = this.getSubcategoriesForCategory(parent).some(item => item.label === sub);
        if (existing) {
            this.showToast(this.t('categoryAlreadyExists'), 'error');
            return;
        }
        this.ensureCategoryExists(parent, sub);
        input.value = '';
        this.refreshCategoryList();
        this.updateAllCategorySelects();
        this.updateSubcategorySelect(parent, sub);
        this.showToast(this.t('categoryAdded'), 'success');
    }
    
    updateAllCategorySelects() {
        const categories = this.getAllCategories();
        const optionsHtml = categories.map(cat => `<option value="${cat}">${this.getCategoryDisplay(cat)}</option>`).join('');
        const mainSelect = document.getElementById('expenseCategory');
        const subSelect = document.getElementById('expenseSubCategory');
        const previousSub = subSelect?.value || '';
        if (mainSelect) {
            const previous = mainSelect.value;
            mainSelect.innerHTML = optionsHtml;
            mainSelect.value = categories.includes(previous) ? previous : (categories[0] || 'Altro');
        }
        const searchSelect = document.getElementById('searchCategory');
        if (searchSelect) {
            const previous = this.searchCategoryFilter || 'all';
            const filterOptions = this.getCategoryFilterOptions();
            searchSelect.innerHTML = filterOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
            const availableValues = filterOptions.map(opt => opt.value);
            searchSelect.value = availableValues.includes(previous) ? previous : 'all';
        }
        this.updateSubcategorySelect(mainSelect?.value || categories[0] || 'Altro', previousSub);
    }
    
    getCategoryEmoji(category) {
        return '';
    }

    getCategoryIconClass(category) {
        const normalized = String(category || '').trim().toLowerCase();
        const map = {
            'alimentari': 'category-icon-groceries',
            'groceries': 'category-icon-groceries',
            'alimentación': 'category-icon-groceries',
            'alimentation': 'category-icon-groceries',
            'trasporti': 'category-icon-transport',
            'transport': 'category-icon-transport',
            'transporte': 'category-icon-transport',
            'svago': 'category-icon-leisure',
            'leisure': 'category-icon-leisure',
            'ocio': 'category-icon-leisure',
            'loisirs': 'category-icon-leisure',
            'salute': 'category-icon-health',
            'health': 'category-icon-health',
            'salud': 'category-icon-health',
            'santé': 'category-icon-health',
            'abbigliamento': 'category-icon-clothing',
            'clothing': 'category-icon-clothing',
            'ropa': 'category-icon-clothing',
            'vêtements': 'category-icon-clothing',
            'altro': 'category-icon-other',
            'other': 'category-icon-other',
            'otros': 'category-icon-other',
            'autre': 'category-icon-other'
        };
        return map[normalized] || 'category-icon-custom';
    }

    renderCategoryLabel(category, options = {}) {
        const safeCategory = String(category || 'Altro');
        const display = this.getCategoryDisplay(safeCategory);
        const className = options.className ? ` ${options.className}` : '';
        return `<span class="category-inline${className}"><span class="category-inline-icon ${this.getCategoryIconClass(safeCategory)}" aria-hidden="true"></span><span class="category-inline-text">${display}</span></span>`;
    }

    getCategoryDisplay(category) {
        const map = {
            'Alimentari': 'categoryAlimentari',
            'Trasporti': 'categoryTrasporti',
            'Svago': 'categorySvago',
            'Salute': 'categorySalute',
            'Abbigliamento': 'categoryAbbigliamento',
            'Altro': 'categoryAltro'
        };

        const key = map[category];
        if (key) return this.t(key);

        // Se è una categoria personalizzata, mantieni emoji + testo
        return `${category}`;
    }


    formatCategoryPath(category, subCategory = '') {
        const parent = this.getCategoryDisplay(category || 'Altro');
        const child = String(subCategory || '').trim();
        return child ? `${parent} / ${child}` : parent;
    }

    getExpenseSubcategory(expense) {
        return String(expense?.subCategory || expense?.subcategory || '').trim();
    }

    getExpenseCategoryPath(expense) {
        const category = String(expense?.category || 'Altro').trim() || 'Altro';
        return this.formatCategoryPath(category, this.getExpenseSubcategory(expense));
    }

    getCategoryFilterOptions() {
        const categories = this.getAllCategories();
        const options = [{ value: 'all', label: this.t('allCategories') }];
        categories.forEach(cat => {
            options.push({ value: cat, label: this.getCategoryDisplay(cat) });
            const subs = this.getSubcategoriesForCategory(cat);
            subs.forEach(sub => {
                const subLabel = String(sub?.label || '').trim();
                if (subLabel) {
                    options.push({ value: `${cat}:::${subLabel}`, label: this.formatCategoryPath(cat, subLabel) });
                }
            });
        });
        return options;
    }

    matchesCategoryFilter(expense, categoryFilter) {
        if (!categoryFilter || categoryFilter === 'all') return true;
        const category = String(expense?.category || '').trim();
        const subCategory = this.getExpenseSubcategory(expense);
        if (categoryFilter.includes(':::')) {
            const [parent, child] = categoryFilter.split(':::');
            return category === parent && subCategory === child;
        }
        return category === categoryFilter;
    }

// ========== REVISIONE IMPORT CSV CON CREAZIONE CATEGORIE E AUTO-COMPLETAMENTO ==========
showImportReview(importedExpenses) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('importReviewOverlay');
        const listEl = document.getElementById('importReviewList');
        if (!overlay || !listEl) {
            resolve(importedExpenses);
            return;
        }

        const buildCategoryOptions = (selectedCat) => {
            const allCats = this.getAllCategories();
            return allCats.map(cat => `<option value="${cat}" ${cat === selectedCat ? 'selected' : ''}>${this.getCategoryDisplay(cat)}</option>`).join('') + `<option value="__NEW__" style="color: var(--accent); font-weight: bold;">➕ Nuova categoria...</option>`;
        };
        const buildSubcategoryOptions = (category, selectedSub = '') => {
            const subs = this.getSubcategoriesForCategory(category || 'Altro');
            return `<option value="">${this.t('expenseSubCategory')}</option>` + subs.map(sub => `<option value="${sub.label}" ${sub.label === selectedSub ? 'selected' : ''}>${sub.label}</option>`).join('') + `<option value="__NEW_SUB__" style="color: var(--accent); font-weight: bold;">➕ ${this.t('expenseSubCategory')}</option>`;
        };
        const syncSubSelect = (index) => {
            const catSelect = listEl.querySelector(`.review-select[data-index="${index}"]`);
            const subSelect = listEl.querySelector(`.review-subselect[data-index="${index}"]`);
            if (!catSelect || !subSelect) return;
            subSelect.innerHTML = buildSubcategoryOptions(catSelect.value, importedExpenses[index].subCategory || '');
            subSelect.value = importedExpenses[index].subCategory || '';
        };
        const refreshReview = () => {
            listEl.innerHTML = importedExpenses.map((exp, index) => {
                const suggestionPath = this.formatCategoryPath(exp._suggested || exp.category || 'Altro', exp._suggested ? '' : (exp.subCategory || ''));
                const hint = exp._suggested ? this.t('importSuggested').replace('{cat}', suggestionPath) : this.t('importLearn');
                const activePath = this.formatCategoryPath(exp.category || 'Altro', exp.subCategory || '');
                return `
                    <div class="review-item" data-index="${index}">
                        <div class="review-info">
                            <span class="review-date">${exp.date}</span>
                            <span class="review-name">${exp.name}</span>
                            <span class="review-amount">${this.formatCurrency(exp.amount)}</span>
                        </div>
                        <div class="review-category review-category-stack">
                            <div class="review-current-path">
                                <span class="review-current-label">${activePath}</span>
                                ${exp._suggested ? `<span class="review-suggestion-badge">Suggerita</span>` : ''}
                            </div>
                            <select class="review-select" data-index="${index}" data-description="${String(exp.name || '').replace(/"/g, '&quot;')}">
                                ${buildCategoryOptions(exp.category || 'Altro')}
                            </select>
                            <select class="review-subselect" data-index="${index}">
                                ${buildSubcategoryOptions(exp.category || 'Altro', exp.subCategory || '')}
                            </select>
                            <small class="review-hint">${hint}</small>
                        </div>
                    </div>
                `;
            }).join('');

            listEl.querySelectorAll('.review-select').forEach(select => {
                select.addEventListener('change', (e) => {
                    const index = parseInt(e.currentTarget.dataset.index, 10);
                    const description = e.currentTarget.dataset.description || '';
                    if (e.currentTarget.value === '__NEW__') {
                        this.showAppPrompt(this.getPopupUiCopy().newCategoryPrompt, '', { title: this.getPopupUiCopy().promptTitle, placeholder: this.t('categoryName') }).then((newCategory) => {
                        if (newCategory && newCategory.trim()) {
                            importedExpenses[index].category = newCategory.trim();
                            importedExpenses[index].subCategory = '';
                            this.ensureCategoryExists(importedExpenses[index].category, '');
                            this.learnCategory(description, importedExpenses[index].category, '');
                            refreshReview();
                        } else {
                            refreshReview();
                        }
                        });
                        return;
                    }
                    importedExpenses[index].category = e.currentTarget.value;
                    importedExpenses[index].subCategory = '';
                    syncSubSelect(index);
                    this.learnCategory(description, importedExpenses[index].category, '');
                });
            });

            listEl.querySelectorAll('.review-subselect').forEach(select => {
                select.addEventListener('change', (e) => {
                    const index = parseInt(e.currentTarget.dataset.index, 10);
                    const parent = importedExpenses[index].category || 'Altro';
                    if (e.currentTarget.value === '__NEW_SUB__') {
                        this.showAppPrompt(this.t('expenseSubCategory'), '', { title: this.getPopupUiCopy().promptTitle, placeholder: this.t('expenseSubCategory') }).then((newSub) => {
                        if (newSub && newSub.trim()) {
                            importedExpenses[index].subCategory = newSub.trim();
                            this.ensureCategoryExists(parent, importedExpenses[index].subCategory);
                            this.learnCategory(importedExpenses[index].name, parent, importedExpenses[index].subCategory);
                            refreshReview();
                        } else {
                            refreshReview();
                        }
                        });
                        return;
                    }
                    importedExpenses[index].subCategory = e.currentTarget.value || '';
                    this.learnCategory(importedExpenses[index].name, parent, importedExpenses[index].subCategory);
                });
            });
        };

        refreshReview();
        this.bindOverlayEscape(overlay, () => { cleanup(); resolve([]); });
        this.setOverlayState(true);
        overlay.style.display = 'flex';
        const confirmBtn = document.getElementById('confirmImportBtn');
        const cancelBtn = document.getElementById('cancelImportBtn');
        const onConfirm = () => {
            importedExpenses.forEach(exp => {
                this.ensureCategoryExists(exp.category || 'Altro', exp.subCategory || '');
                this.learnCategory(exp.name, exp.category || 'Altro', exp.subCategory || '');
            });
            cleanup();
            resolve(importedExpenses);
        };
        const onCancel = () => {
            cleanup();
            resolve([]);
        };
        const cleanup = () => {
            overlay.style.display = 'none';
            this.setOverlayState(false);
            confirmBtn?.removeEventListener('click', onConfirm);
            cancelBtn?.removeEventListener('click', onCancel);
        };
        confirmBtn?.addEventListener('click', onConfirm);
        cancelBtn?.addEventListener('click', onCancel);
    });
}

    summarizeImportedExpensesVisibility(expenses = []) {
        const imported = Array.isArray(expenses) ? expenses : [];
        const normalizedDates = imported
            .map(exp => this.normalizeIsoDate(exp?.date || ''))
            .filter(Boolean);
        const inPeriodCount = normalizedDates.filter(date => this.isDateInPeriod(date)).length;
        const outOfPeriodCount = Math.max(0, normalizedDates.length - inPeriodCount);
        return {
            total: normalizedDates.length,
            inPeriodCount,
            outOfPeriodCount,
            allOutOfPeriod: normalizedDates.length > 0 && inPeriodCount === 0
        };
    }

    notifyImportVisibility(expenses = []) {
        const summary = this.summarizeImportedExpensesVisibility(expenses);
        if (!summary.total || !summary.outOfPeriodCount) return summary;
        const start = this.normalizeIsoDate(this.data?.periodStart || '') || '—';
        const end = this.normalizeIsoDate(this.data?.periodEnd || '') || '—';
        const message = this.data.language === 'it'
            ? `ℹ️ ${summary.outOfPeriodCount} movimenti importati sono fuori dal periodo attivo ${start} → ${end}: restano archiviati ma non entrano nei calcoli del periodo.`
            : `${summary.outOfPeriodCount} imported transactions are outside the active period ${start} → ${end}, so they remain stored but are not counted in the current period.`;
        this.showToast(message, 'info');
        return summary;
    }

    async parseCSV(file, delimiter, dateFormat, skipRows = 0, headerRow = 1) {
        console.log('📥 Inizio import CSV:', file.name, 'delimiter:', delimiter, 'dateFormat:', dateFormat, 'skipRows:', skipRows, 'headerRow:', headerRow);

        const mapping = await this.showMappingDialog(file, delimiter, skipRows, headerRow);
        if (!mapping) {
            this.showToast(this.t('importCancelled'), 'info');
            return { cancelled: true, added: 0, incomes: 0 };
        }

        return await new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const text = this.sanitizeDelimitedText(e.target.result);
                    const effectiveDelimiter = this.detectCsvDelimiter(text, delimiter);
                    const allLines = text.split('\n').filter(line => line.trim() !== '');

                    // Salta le righe iniziali
                    const startLine = Math.min(skipRows, allLines.length - 1);

                    // Determina dove iniziano i dati (dopo l'intestazione)
                    let dataStartLine = startLine;
                    if (headerRow > 0) {
                        dataStartLine = startLine + headerRow; // Salta anche l'intestazione
                    }

                    const lines = allLines.slice(dataStartLine);
                    const importedExpenses = [];
                    const tempIncomes = [];

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;

                        const parts = this.splitDelimitedLine(line, effectiveDelimiter);
                        if (parts.length <= Math.max(mapping.dateCol, mapping.descCol, mapping.amountCol)) continue;

                        let dateStr = parts[mapping.dateCol] ? parts[mapping.dateCol].trim() : '';
                        let description = parts[mapping.descCol] ? parts[mapping.descCol].trim() : '';
                        let amountStr = parts[mapping.amountCol] ? parts[mapping.amountCol].trim() : '';
                        let category = mapping.categoryCol !== -1 && parts[mapping.categoryCol] ? parts[mapping.categoryCol].trim() : '';

                        if (!dateStr || !description || !amountStr) continue;

                        if (dateFormat === 'DD/MM/YYYY') {
                            const m = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                            if (m) dateStr = `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
                        } else if (dateFormat === 'MM/DD/YYYY') {
                            const m = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                            if (m) dateStr = `${m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
                        }

                        dateStr = this.normalizeIsoDate(dateStr);
                        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

                        let amount = parseFloat(String(amountStr).replace(',', '.').replace(/[^0-9.-]/g, ''));
                        if (isNaN(amount)) continue;

                        let _suggested = null;
                        let suggestedSubCategory = '';
                        if (!category) {
                            const sug = this.suggestCategory(description);
                            category = sug.confidence >= this.CATEGORY_CONFIDENCE_THRESHOLD ? sug.category : 'Altro';
                            suggestedSubCategory = sug.confidence >= this.CATEGORY_CONFIDENCE_THRESHOLD ? (sug.subCategory || '') : '';
                            if (sug.confidence > 0 && sug.confidence < this.CATEGORY_CONFIDENCE_THRESHOLD) {
                                _suggested = sug.category;
                            }
                        }

                        if (amount > 0) {
                            tempIncomes.push({
                                desc: description,
                                amount: amount,
                                date: dateStr,
                                id: Date.now() + i
                            });
                        } else {
                            amount = Math.abs(amount);
                            const exp = { name: description, amount: amount, date: dateStr, category: category || 'Altro', subCategory: suggestedSubCategory || '', id: Date.now() + i };
                            if (_suggested) exp._suggested = _suggested;
                            importedExpenses.push(exp);
                        }
                    }

                    let addedExpenses = 0;
                    let addedIncomes = 0;

                    if (importedExpenses.length > 0) {
                        const reviewed = await this.showImportReview(importedExpenses);

                        if (reviewed.length > 0) {
                            let skippedDuplicates = 0;
                            for (const exp of reviewed) {
                                const duplicateDecision = await this.resolveImportedExpenseDuplicate(exp);
                                if (duplicateDecision.action === 'skip') {
                                    skippedDuplicates++;
                                    continue;
                                }
                                this.upsertVariableExpense({
                                    name: exp.name,
                                    amount: exp.amount,
                                    category: exp.category,
                                    subCategory: exp.subCategory || '',
                                    date: exp.date,
                                    id: exp.id,
                                    source: 'import'
                                }, { sourceType: 'import', allowDuplicate: duplicateDecision.allowDuplicate });
                                addedExpenses++;
                            }

                            if (tempIncomes.length > 0) {
                                if (!this.data.incomes) this.data.incomes = [];
                                this.data.incomes.push(...tempIncomes);
                                addedIncomes = tempIncomes.length;
                            }

                            this.saveData();
                            this.updateUI();
                            this.updateChart();

                            const mostRecent = reviewed
                                .map(e => this.normalizeIsoDate(e.date))
                                .sort()
                                .slice(-1)[0];
                            const dateInput = document.getElementById('expenseDate');
                            if (dateInput && mostRecent) dateInput.value = mostRecent;
                            this.updateVariableExpensesList();

                            const dupLine = skippedDuplicates > 0 ? `
${this.t('duplicatesSkipped', { dup: skippedDuplicates })}` : '';
                            this.showToast(
                                this.data.language === 'it'
                                    ? `✅ Importate ${addedExpenses} spese${addedIncomes ? ` e ${addedIncomes} entrate` : ''}!${dupLine}`
                                    : `✅ Imported ${addedExpenses} expenses${addedIncomes ? ` and ${addedIncomes} incomes` : ''}!${dupLine}`,
                                'success'
                            );
                            this.notifyImportVisibility(reviewed);

                            resolve({ cancelled: false, added: addedExpenses, incomes: addedIncomes });
                            return;
                        } else {
                            this.showToast(this.t('importCancelled'), 'info');
                            resolve({ cancelled: true, added: 0, incomes: 0 });
                            return;
                        }
                    } else if (tempIncomes.length > 0) {
                        if (!this.data.incomes) this.data.incomes = [];
                        this.data.incomes.push(...tempIncomes);
                        addedIncomes = tempIncomes.length;
                        this.saveData();
                        this.updateUI();
                        this.updateChart();

                        this.showToast(
                            this.data.language === 'it'
                                ? `✅ Importate ${addedIncomes} entrate!`
                                : `✅ Imported ${addedIncomes} incomes!`,
                            'success'
                        );

                        resolve({ cancelled: false, added: 0, incomes: addedIncomes });
                        return;
                    } else {
                        this.showToast(
                            this.data.language === 'it'
                                ? '⚠️ Nessun movimento valido trovato nel file'
                                : '⚠️ No valid transactions found in the file',
                            'info'
                        );
                        resolve({ cancelled: false, added: 0, incomes: 0 });
                        return;
                    }
                } catch (err) {
                    console.error('❌ Errore durante import CSV:', err);
                    this.showToast(this.t('csvImportError'), 'error');
                    reject(err);
                }
            };

            reader.onerror = () => {
                console.error('❌ Errore lettura file');
                this.showToast(this.t('fileReadError'), 'error');
                reject(new Error('File read error'));
            };

            reader.readAsText(file);
        });
    }
// ========== MAPPATURA CAMPI CSV ==========
async showMappingDialog(file, delimiter, skipRows = 0, headerRow = 1) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('csvMappingOverlay');
        const headersRow = document.getElementById('csvMappingHeaders');
        const previewBody = document.getElementById('csvMappingPreview');
        const fieldsDiv = document.getElementById('csvMappingFields');
        
        if (!overlay || !headersRow || !previewBody || !fieldsDiv) {
            console.error('Elementi mappatura non trovati');
            resolve(null);
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = this.sanitizeDelimitedText(e.target.result);
            const effectiveDelimiter = this.detectCsvDelimiter(text, delimiter);
            const lines = text.split('\n').filter(line => line.trim() !== '');
            
            if (lines.length === 0) {
                resolve(null);
                return;
            }
            
            // Salta le righe iniziali
            const startLine = Math.min(skipRows, lines.length - 1);
            let headerLine = startLine;
            
            // Se headerRow è > 0, la riga di intestazione è startLine + (headerRow - 1)
            if (headerRow > 0) {
                headerLine = startLine + (headerRow - 1);
                if (headerLine >= lines.length) {
                    this.showToast(this.t('headerRowFallback', { row: headerRow }), 'info');
                    headerLine = startLine;
                }
            }
            
            // Estrai intestazione
            let headers = [];
            if (headerRow > 0) {
                headers = this.splitDelimitedLine(lines[headerLine], effectiveDelimiter).map(h => h.trim());
            } else {
                // Nessuna intestazione: crea colonne fittizie
                const sampleLine = lines[startLine] || '';
                headers = this.splitDelimitedLine(sampleLine, effectiveDelimiter).map((_, i) => `Colonna ${i+1}`);
            }
            
            // Prepara dati per anteprima (dopo l'intestazione)
            const previewData = [];
            const dataStartLine = headerLine + 1;
            for (let i = dataStartLine; i < Math.min(dataStartLine + 5, lines.length); i++) {
                previewData.push(this.splitDelimitedLine(lines[i], effectiveDelimiter).map(cell => cell.trim()));
            }
            
            overlay.style.display = 'flex';
            
            headersRow.innerHTML = headers.map(h => `<th>${h || '?'}</th>`).join('');
            
            previewBody.innerHTML = previewData.map(row => 
                `<tr>${row.map(cell => `<td class="preview-cell">${cell || ''}</td>`).join('')}</tr>`
            ).join('');
            
            const fieldOptions = [
                { value: 'date', label: this.t('csvFieldDate') },
                { value: 'description', label: this.t('csvFieldDescription') },
                { value: 'amount', label: this.t('csvFieldAmount') },
                { value: 'category', label: this.t('csvFieldCategory') },
                { value: 'ignore', label: this.t('csvFieldIgnore') }
            ];
            
            fieldsDiv.innerHTML = headers.map((header, index) => `
                <div style="display: flex; align-items: center; gap: 15px; background: var(--bg-color); padding: 12px; border-radius: 16px;">
                    <span style="min-width: 150px; font-weight: 600; color: var(--accent);">${this.t("csvColumnN", { n: (index + 1) })}: "${header || this.t("empty")}"</span>
                    <select id="mapping-${index}" class="csv-mapping-select" style="flex: 1;">
                        ${fieldOptions.map(opt => {
                            let selected = '';
                            if (opt.value === 'date' && index === 0) selected = 'selected';
                            else if (opt.value === 'description' && index === 1) selected = 'selected';
                            else if (opt.value === 'amount' && index === 2) selected = 'selected';
                            return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
                        }).join('')}
                    </select>
                </div>
            `).join('');
            
            const confirmBtn = document.getElementById('confirmMappingBtn');
            const cancelBtn = document.getElementById('cancelMappingBtn');
            
            const onConfirm = () => {
                const mapping = {
                    dateCol: -1,
                    descCol: -1,
                    amountCol: -1,
                    categoryCol: -1
                };
                
                headers.forEach((_, index) => {
                    const select = document.getElementById(`mapping-${index}`);
                    if (select) {
                        const value = select.value;
                        if (value === 'date') mapping.dateCol = index;
                        else if (value === 'description') mapping.descCol = index;
                        else if (value === 'amount') mapping.amountCol = index;
                        else if (value === 'category') mapping.categoryCol = index;
                    }
                });
                
                if (mapping.dateCol === -1 || mapping.descCol === -1 || mapping.amountCol === -1) {
                    this.showToast(this.t('csvMappingRequired'), 'error');
                    return;
                }
                
                overlay.style.display = 'none';
            this.setOverlayState(false);
                resolve(mapping);
            };
            
            const onCancel = () => {
                overlay.style.display = 'none';
            this.setOverlayState(false);
                resolve(null);
            };
            
            // Clona per evitare listener duplicati
            const newConfirm = confirmBtn.cloneNode(true);
            const newCancel = cancelBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
            cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
            
            newConfirm.addEventListener('click', onConfirm);
            newCancel.addEventListener('click', onCancel);
        };
        
        reader.onerror = () => {
            resolve(null);
        };
        
        reader.readAsText(file);
    });
}
    // ========== IMPORT EXCEL CON AUTO-RICONOSCIMENTO INTELLIGENTE ==========
async parseExcel(file, sheetIndex = 0, headerRow = -1) {
        const self = this; // 
    console.log('📥 Inizio import Excel con auto-riconoscimento:', file.name, 'foglio:', sheetIndex);

    // Legge Excel
    const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Errore durante la lettura del file'));
        reader.readAsArrayBuffer(file);
    });

    const data = new Uint8Array(arrayBuffer);
    
    // Leggi il file con cellDates: false per avere i valori originali
    const workbook = XLSX.read(data, { 
        type: 'array', 
        cellDates: false,
        raw: true
    });

    const safeSheetIndex = (sheetIndex >= 0 && sheetIndex < workbook.SheetNames.length) ? sheetIndex : 0;
    const sheetName = workbook.SheetNames[safeSheetIndex];
    const worksheet = workbook.Sheets[sheetName];

    // Converte il foglio in un array di array (righe x colonne)
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (!rows || rows.length === 0) throw new Error('Il file Excel è vuoto');

   // Funzione per convertire un numero seriale Excel in data ISO
const excelSerialToDate = (serial) => {
    // Excel considera il 1900-01-01 come giorno 1
    const excelEpoch = new Date(1900, 0, 1); // 1 gennaio 1900
    const date = new Date(excelEpoch.getTime() + (serial - 1) * 24 * 60 * 60 * 1000);
    
    // Gestione del bug Excel (considera il 1900 come anno bisestile)
    if (serial > 60) {
        date.setDate(date.getDate() - 1);
    }
    
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

    // Funzione per convertire una cella in stringa
const cellToString = (cell, isDateColumn = false, isAmountColumn = false) => {
    if (cell === null || cell === undefined) return '';
    
    // Se è un numero e dovrebbe essere una data (colonna Data)
    if (typeof cell === 'number' && isFinite(cell) && isDateColumn) {
        // Se il numero è nell'intervallo di date Excel (40000-50000 sono anni 2009-2036)
        if (cell > 40000 && cell < 50000) {
            return excelSerialToDate(cell);
        }
        // Se è un numero piccolo, probabilmente è un importo
        return cell.toString();
    }
    
    // Se è un numero e siamo in una colonna importo
    if (typeof cell === 'number' && isFinite(cell) && isAmountColumn) {
        // Mantieni il numero così com'è (con virgola come separatore decimale)
        return cell.toString().replace('.', ',');
    }
    
    // Se è un numero ma non sappiamo cosa sia
    if (typeof cell === 'number' && isFinite(cell)) {
        return cell.toString();
    }
    
    // Stringa normale
    return String(cell).replace(/[\t ]+/g, ' ').trim();
};

    // ===== AUTO-RICONOSCIMENTO RIGA INTESTAZIONE =====
    let headerRowIndex = -1;
    let headerRowContent = [];

    // Parole chiave per riconoscere l'intestazione (in diverse lingue)
    const headerKeywords = [
        'data', 'date', 'fecha', 'datum',
        'descrizione', 'description', 'descripción', 'descrição',
        'importo', 'amount', 'importe', 'montant',
        'entrate', 'entradas', 'income', 'revenue',
        'uscite', 'spese', 'expenses', 'gastos',
        'categoria', 'category', 'categoría', 'catégorie'
    ];

    // Scansiona le prime 20 righe per trovare l'intestazione
    for (let i = 0; i < Math.min(20, rows.length); i++) {
        const row = rows[i] || [];
        const rowText = row.map(cell => String(cell || '').toLowerCase()).join(' ');
        
        let keywordCount = 0;
        for (const keyword of headerKeywords) {
            if (rowText.includes(keyword)) {
                keywordCount++;
            }
        }
        
        if (keywordCount >= 2) {
            headerRowIndex = i;
            headerRowContent = row;
            console.log(`✅ Riga intestazione auto-riconosciuta alla riga ${i + 1}:`, headerRowContent);
            break;
        }
    }

    if (headerRowIndex === -1) {
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].some(cell => String(cell || '').trim() !== '')) {
                headerRowIndex = i;
                headerRowContent = rows[i];
                console.log(`⚠️ Nessuna intestazione riconosciuta, uso riga ${i + 1} come intestazione`);
                break;
            }
        }
    }

    if (headerRowIndex === -1) {
        this.showToast('Impossibile trovare riga di intestazione nel file', 'error');
        return { cancelled: true, added: 0, incomes: 0 };
    }

    // Identifichiamo quali colonne sono date e quali sono importi
const headerNames = headerRowContent.map(cell => String(cell || '').toLowerCase());
const dateColumnIndices = [];
const amountColumnIndices = [];

headerNames.forEach((name, index) => {
    const lowerName = name.toLowerCase();
    
    // Colonne data
    if (lowerName.includes('data') || lowerName.includes('date') || 
        lowerName.includes('fecha') || lowerName.includes('datum') ||
        lowerName.includes('data_operazione') || lowerName.includes('data_valuta')) {
        dateColumnIndices.push(index);
    }
    
    // Colonne importo (entrate/uscite)
    if (lowerName.includes('entrate') || lowerName.includes('uscite') ||
        lowerName.includes('importo') || lowerName.includes('amount') ||
        lowerName.includes('income') || lowerName.includes('revenue') ||
        lowerName.includes('expense') || lowerName.includes('gastos') ||
        lowerName.includes('entradas') || lowerName.includes('debit') ||
        lowerName.includes('credit') || lowerName.includes('accrediti') ||
        lowerName.includes('addebiti')) {
        amountColumnIndices.push(index);
    }
});

console.log(' Colonne data:', dateColumnIndices);
console.log('💰 Colonne importo:', amountColumnIndices);

   // Crea un CSV virtuale con le righe dall'intestazione in poi
const relevantRows = rows.slice(headerRowIndex);
const allLines = relevantRows.map((row, rowIndex) => 
    row.map((cell, colIndex) => {
        const isDateCol = dateColumnIndices.includes(colIndex);
        const isAmountCol = amountColumnIndices.includes(colIndex);
        return cellToString(cell, isDateCol, isAmountCol);
    }).join('\t')
).join('\n');
    
    const virtualFile = new File(
        [allLines],
        file.name.replace(/\.[^/.]+$/, '') + '_converted.tsv',
        { type: 'text/tab-separated-values' }
    );

    // Mostra il dialogo di mappatura (l'utente può ancora correggere se necessario)
    const mapping = await self.showMappingDialog(virtualFile, '\t', 0, 1); 
    if (!mapping) {
        this.showToast(this.t('importCancelled'), 'info');
        return { cancelled: true, added: 0, incomes: 0 };
    }

    // --- Processa i dati ---
    const lines = allLines.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
        this.showToast(this.t('csvEmpty'), 'error');
        return { cancelled: true, added: 0, incomes: 0 };
    }

    const dataStartLine = 1;
    
    const importedExpenses = [];
    const tempIncomes = [];

    for (let i = dataStartLine; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split('\t');

        let dateStr = (mapping.dateCol !== -1 && parts[mapping.dateCol]) ? parts[mapping.dateCol].trim() : '';
        const description = (mapping.descCol !== -1 && parts[mapping.descCol]) ? parts[mapping.descCol].trim() : '';
        let amountStr = (mapping.amountCol !== -1 && parts[mapping.amountCol]) ? parts[mapping.amountCol].trim() : '';
        let category = (mapping.categoryCol !== -1 && parts[mapping.categoryCol]) ? parts[mapping.categoryCol].trim() : '';

        dateStr = this.normalizeIsoDate(dateStr);
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !description || !amountStr) continue;

        // Pulisci l'importo
        amountStr = amountStr.replace(/,/g, '.').replace(/[^0-9.-]/g, '');
        if (!amountStr) continue;
        
        let amount = parseFloat(amountStr);
        if (isNaN(amount)) continue;

        // Suggerisci categoria se mancante
        let _suggested = null;
        let suggestedSubCategory = '';
        if (!category) {
            const sug = this.suggestCategory(description);
            category = sug.confidence >= this.CATEGORY_CONFIDENCE_THRESHOLD ? sug.category : 'Altro';
            suggestedSubCategory = sug.confidence >= this.CATEGORY_CONFIDENCE_THRESHOLD ? (sug.subCategory || '') : '';
            if (sug.confidence > 0 && sug.confidence < this.CATEGORY_CONFIDENCE_THRESHOLD) {
                _suggested = sug.category;
            }
        }

        if (amount > 0) {
            tempIncomes.push({
                desc: description,
                amount: amount,
                date: dateStr,
                id: Date.now() + i
            });
        } else {
            amount = Math.abs(amount);
            const exp = { 
                name: description, 
                amount: amount, 
                date: dateStr, 
                category: category || 'Altro', 
                subCategory: suggestedSubCategory || '',
                id: Date.now() + i 
            };
            if (_suggested) exp._suggested = _suggested;
            importedExpenses.push(exp);
        }
    }

    // Revisione e salvataggio
    let addedExpenses = 0;
    let addedIncomes = 0;

    if (importedExpenses.length > 0) {
        const reviewed = await this.showImportReview(importedExpenses);

        if (reviewed.length > 0) {
            let skippedDuplicates = 0;
            for (const exp of reviewed) {
                const duplicateDecision = await this.resolveImportedExpenseDuplicate(exp);
                if (duplicateDecision.action === 'skip') {
                    skippedDuplicates++;
                    continue;
                }
                this.upsertVariableExpense({
                    name: exp.name,
                    amount: exp.amount,
                    category: exp.category,
                    subCategory: exp.subCategory || '',
                    date: exp.date,
                    id: exp.id,
                    source: 'import'
                }, { sourceType: 'import', allowDuplicate: duplicateDecision.allowDuplicate });
                addedExpenses++;
            }
            var _excelSkippedDuplicates = skippedDuplicates;
        } else {
            this.showToast(this.t('importCancelled'), 'info');
            return { cancelled: true, added: 0, incomes: 0 };
        }
    }

    if (tempIncomes.length > 0) {
        if (!this.data.incomes) this.data.incomes = [];
        this.data.incomes.push(...tempIncomes);
        addedIncomes = tempIncomes.length;
    }

    if (addedExpenses === 0 && addedIncomes === 0) {
        this.showToast('⚠️ Nessun movimento valido trovato nel file', 'info');
        return { cancelled: false, added: 0, incomes: 0 };
    }

    this.saveData();

// Forza l'aggiornamento del periodo
if (tempIncomes.length > 0) {
    const salaryIncome = tempIncomes.find(inc => this.isSalaryIncome(inc));
    if (salaryIncome) {
        this.data.periodStart = this.normalizeIsoDate(salaryIncome.date);
        this.data.periodEnd = this.addMonthsClamp(this.data.periodStart, 1);
    } else {
        const dates = tempIncomes.map(inc => new Date(inc.date));
        const minDate = new Date(Math.min(...dates));
        this.data.periodStart = minDate.toISOString().split('T')[0];
        this.data.periodEnd = this.addMonthsClamp(this.data.periodStart, 1);
    }
    this.saveData();
}

this.updateUI();
this.updateChart();

    this.updateUI();
    this.updateChart();

    if (addedExpenses > 0) {
        const mostRecent = importedExpenses
            .map(e => this.normalizeIsoDate(e.date))
            .sort()
            .slice(-1)[0];
        const dateInput = document.getElementById('expenseDate');
        if (dateInput && mostRecent) dateInput.value = mostRecent;
        this.updateVariableExpensesList();
    }

    const dupLine = (typeof _excelSkippedDuplicates === 'number' && _excelSkippedDuplicates > 0)
        ? `
${this.t('duplicatesSkipped', { dup: _excelSkippedDuplicates })}`
        : '';
    this.showToast(
        this.data.language === 'it'
            ? `✅ Importate ${addedExpenses} spese${addedIncomes ? ` e ${addedIncomes} entrate` : ''}!${dupLine}`
            : `✅ Imported ${addedExpenses} expenses${addedIncomes ? ` and ${addedIncomes} incomes` : ''}!${dupLine}`,
        'success'
    );
    this.notifyImportVisibility(importedExpenses);

    return { cancelled: false, added: addedExpenses, incomes: addedIncomes };
}

    // ========== ONBOARDING GUIDATO ==========
    startOnboarding() {
        if (this.readStorage('kedrix-onboarding-completed') === 'true') return;
        if (!this.isFirstRun()) return;

        const steps = [
            { text: this.t('onboardingStep1'), highlight: "#addIncomeBtn" },
            { text: this.t('onboardingStep2'), highlight: "#addFixedBtn" },
            { text: this.t('onboardingStep3'), highlight: "#addExpenseBtn" },
            { text: this.t('onboardingStep4'), highlight: ".summary-card" },
            { text: this.t('onboardingStep5'), highlight: "#chatInput" },
            { text: this.t('onboardingStep6'), highlight: "#importCsvBtn" }
        ];

        let stepIndex = 0;

        const overlay = document.createElement('div');
        overlay.id = 'onboarding-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(5px);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
            pointer-events: auto;
        `;

        const card = document.createElement('div');
        card.style.cssText = `
            background: var(--card-bg, #ffffff);
            padding: 30px 25px;
            border-radius: 28px;
            max-width: 450px;
            width: 100%;
            text-align: center;
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
            animation: onboardingSlideUp 0.5s ease;
            border: 2px solid var(--accent);
            margin-bottom: 30px;
            box-sizing: border-box;
            pointer-events: auto;
        `;

        card.innerHTML = `
            <div style="font-size: 3.5rem; margin-bottom: 10px;">✨</div>
            <h3 style="margin: 0 0 5px; color: var(--accent); font-size: 2rem; font-weight: 800;">${this.t('onboardingWelcome')}</h3>
            <p style="color: var(--text-secondary); font-size: 1rem; margin-bottom: 25px; opacity: 0.9;">${this.t('onboardingSubtitle')}</p>

            <div style="background: var(--bg-color); padding: 15px; border-radius: 16px; margin-bottom: 25px; border-left: 4px solid var(--accent); text-align: left;">
                <p id="onboarding-description" style="margin: 0; color: var(--text-primary); font-size: 1.1rem; font-weight: 500;"></p>
            </div>

            <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-bottom: 14px;">
                <button id="onboarding-next" class="btn-primary" style="padding: 14px 32px; font-size: 1.1rem; border-radius: 50px; min-width: 140px; font-weight: 700;">
                    ${this.t('onboardingNext')}
                </button>
                <button id="onboarding-demo" class="btn-secondary" style="padding: 12px 20px; border-radius: 50px; min-width: 180px;">
                    ${this.t('onboardingDemo')}
                </button>
                <button id="onboarding-empty" class="btn-text" style="padding: 12px 14px;">
                    ${this.t('onboardingEmpty')}
                </button>
                <button id="onboarding-skip" class="btn-secondary" style="padding: 14px 32px; font-size: 1.1rem; border-radius: 50px; min-width: 140px; background: transparent; border: 2px solid var(--border);">
                    ✕ ${this.t('onboardingSkip')}
                </button>
            </div>

            <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                <span style="font-size: 0.9rem; color: var(--text-secondary); min-width: 40px;"><span id="onboarding-counter" style="font-weight: 700; color: var(--accent);">1</span>/${steps.length}</span>
                <div style="flex: 1; height: 6px; background: var(--border); border-radius: 6px; overflow: hidden;">
                    <div id="onboarding-progress" style="width: ${(1/steps.length)*100}%; height: 100%; background: linear-gradient(90deg, var(--accent-light), var(--accent)); transition: width 0.4s ease;"></div>
                </div>
            </div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        if (!document.getElementById('onboarding-style')) {
            const style = document.createElement('style');
            style.id = 'onboarding-style';
            style.textContent = `
                @keyframes onboardingSlideUp {
                    from { transform: translateY(40px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .onboarding-highlight {
                    animation: targetGlow 2s infinite !important;
                    box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.8), 0 0 30px rgba(124, 58, 237, 0.6) !important;
                }
                @keyframes targetGlow {
                    0% { box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.8), 0 0 30px rgba(124, 58, 237, 0.6); }
                    50% { box-shadow: 0 0 0 8px rgba(124, 58, 237, 1), 0 0 50px rgba(124, 58, 237, 0.9); }
                    100% { box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.8), 0 0 30px rgba(124, 58, 237, 0.6); }
                }
            `;
            document.head.appendChild(style);
        }

        const closeOnboarding = () => {
            this.writeStorage('kedrix-onboarding-completed', 'true');
            this.markFirstRunSeen();
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 250);
            document.querySelectorAll('.onboarding-highlight').forEach(el => el.classList.remove('onboarding-highlight'));
        };

        const showStep = () => {
            const step = steps[stepIndex];
            const descEl = document.getElementById('onboarding-description');
            if (descEl) descEl.textContent = step.text;

            const counterEl = document.getElementById('onboarding-counter');
            if (counterEl) counterEl.innerText = String(stepIndex + 1);

            const progress = ((stepIndex + 1) / steps.length) * 100;
            const progressBar = document.getElementById('onboarding-progress');
            if (progressBar) progressBar.style.width = progress + '%';

            document.querySelectorAll('.onboarding-highlight').forEach(el => el.classList.remove('onboarding-highlight'));

            const target = document.querySelector(step.highlight);
            if (target) {
                target.classList.add('onboarding-highlight');
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        };

        const nextBtn = document.getElementById('onboarding-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                stepIndex++;
                if (stepIndex < steps.length) showStep();
                else closeOnboarding();
            });
        }

        const skipBtn = document.getElementById('onboarding-skip');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => closeOnboarding());
        }

        const demoBtn = document.getElementById('onboarding-demo');
        if (demoBtn) {
            demoBtn.addEventListener('click', () => {
                this.loadDemoData();
                closeOnboarding();
            });
        }

        const emptyBtn = document.getElementById('onboarding-empty');
        if (emptyBtn) {
            emptyBtn.addEventListener('click', () => closeOnboarding());
        }

        showStep();
    }

    setupVoice() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Riconoscimento vocale non supportato');
            const voiceBtn = document.getElementById('voiceBtn');
            if (voiceBtn) {
                voiceBtn.disabled = true;
                voiceBtn.innerHTML = (this.data.language === 'it' ? 'Non supportato' : 'Not supported');
            }
            const homeVoiceBtn = document.getElementById('homeVoiceBtn');
            if (homeVoiceBtn) {
                homeVoiceBtn.disabled = true;
                homeVoiceBtn.innerHTML = (this.data.language === 'it' ? 'Non supportato' : 'Not supported');
            }
            return;
        }
        const micFixed = document.getElementById('micFixedBtn');
        if (micFixed) micFixed.addEventListener('click', () => this.startVoiceInput('fixed'));
        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn) voiceBtn.addEventListener('click', () => this.startVoiceInput('variable'));
        const homeVoiceBtn = document.getElementById('homeVoiceBtn');
        if (homeVoiceBtn) homeVoiceBtn.addEventListener('click', () => this.startVoiceInput('homeVariable'));
        const chatVoice = document.getElementById('chatVoiceBtn');
        if (chatVoice) chatVoice.addEventListener('click', () => this.startVoiceInput('chat'));
    }

    startVoiceInput(type = 'variable') {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        const localeMap = { it: 'it-IT', en: 'en-US', es: 'es-ES', fr: 'fr-FR' };
        recognition.lang = localeMap[this.data.language] || 'it-IT';
        recognition.interimResults = true;

        let button, statusElement;
        let timeoutDuration = 8000;

        if (type === 'fixed') {
            button = document.getElementById('micFixedBtn');
            statusElement = document.getElementById('fixedVoiceStatus');
            timeoutDuration = 15000;
        } else if (type === 'homeVariable') {
            button = document.getElementById('homeVoiceBtn');
            statusElement = document.getElementById('homeVoiceStatus');
            timeoutDuration = 6500;
        } else {
            button = document.getElementById('voiceBtn');
            statusElement = document.getElementById('voiceStatus');
        }

        if (!button) return;

        button.classList.add('listening');
        statusElement.textContent = this.t('voiceSpeak');

        recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            const transcript = result[0].transcript.trim();
            if (result.isFinal) {
                if (type === 'fixed') this.processFixedVoiceCommand(transcript);
                else this.processVoiceCommand(transcript, { directSave: type === 'homeVariable', fromHome: type === 'homeVariable' });
                statusElement.textContent = this.t('voiceTap');
            } else {
                statusElement.textContent = `🔊 ${transcript}...`;
            }
        };

        recognition.onerror = () => {
            button.classList.remove('listening');
            statusElement.textContent = this.t('error');
            setTimeout(() => {
                statusElement.textContent = this.t('voiceTap');
            }, 2000);
        };

        recognition.onend = () => {
            button.classList.remove('listening');
        };

        recognition.start();

        setTimeout(() => {
            recognition.stop();
            button.classList.remove('listening');
            statusElement.textContent = this.t('voiceTap');
        }, timeoutDuration);
    }

    async processVoiceCommand(transcript, options = {}) {
        const amountMatch = transcript.match(/(\d+[.,]?\d*)/);
        if (!amountMatch) return;

        const amount = parseFloat(amountMatch[0].replace(',', '.'));
        let description = transcript.replace(amountMatch[0], '').replace(/euro|€|euros/gi, '').trim();
        description = description || this.t('genericExpense');
        const suggestion = this.suggestCategory(description);
        const category = suggestion?.category || 'Altro';
        const subCategory = suggestion?.confidence >= this.CATEGORY_CONFIDENCE_THRESHOLD ? (suggestion?.subCategory || '') : '';

        if (options.directSave) {
            const record = {
                name: description,
                amount,
                category,
                subCategory,
                date: this.formatLocalDate(new Date()),
                id: Date.now(),
                source: 'voice-home'
            };
            const duplicateDecision = await this.resolveManualExpenseDuplicate(record);
            if (duplicateDecision.action === 'cancel') {
                this.showToast('⚠️ Inserimento vocale annullato: possibile duplicato', 'info');
                return;
            }
            const result = this.upsertVariableExpense(record, {
                sourceType: 'manual',
                allowDuplicate: duplicateDecision.allowDuplicate
            });
            this.learnCategory(description, category, subCategory);
            this.saveData();
            this.updateUI();
            this.updateChart();
            this.checkThreshold(record.date);
            if (duplicateDecision.allowDuplicate) {
                this.showToast(`🎤 ${description} ${this.formatCurrency(amount)} salvato comunque`, 'success');
            } else {
                this.showToast(result.matched ? '🔗 Spesa collegata a un movimento già presente' : `🎤 ${description} ${this.formatCurrency(amount)} salvato`, result.matched ? 'info' : 'success');
            }
            return;
        }

        const expenseNameField = document.getElementById('expenseName');
        const expenseAmountField = document.getElementById('expenseAmount');
        if (expenseNameField) expenseNameField.value = description;
        if (expenseAmountField) expenseAmountField.value = amount;
        const expenseCategory = document.getElementById('expenseCategory');
        if (expenseCategory && category) expenseCategory.value = category;
        const expenseSubCategory = document.getElementById('expenseSubCategory');
        if (expenseSubCategory) {
            this.updateSubcategorySelect(category, suggestion?.subCategory || '');
            expenseSubCategory.value = suggestion?.subCategory || '';
        }

        const draftDate = this.normalizeIsoDate(document.getElementById('expenseDate')?.value) || this.formatLocalDate(new Date());
        const draftRecord = {
            name: description,
            amount,
            category,
            subCategory: expenseSubCategory?.value.trim() || '',
            date: draftDate,
            id: Date.now(),
            source: 'voice-variable'
        };

        const duplicateDecision = await this.resolveManualExpenseDuplicate(draftRecord);
        if (duplicateDecision.action === 'cancel') {
            if (expenseNameField) expenseNameField.value = '';
            if (expenseAmountField) expenseAmountField.value = '';
            if (expenseSubCategory) expenseSubCategory.value = '';
            this.showToast('⚠️ Inserimento vocale annullato: possibile duplicato', 'info');
            return;
        }

        if (duplicateDecision.allowDuplicate) {
            this.upsertVariableExpense(draftRecord, {
                sourceType: 'manual',
                allowDuplicate: true
            });
            this.learnCategory(description, category, draftRecord.subCategory || '');
            this.saveData();
            this.updateUI();
            this.updateChart();
            this.checkThreshold(draftRecord.date);
            this.showToast(`🎤 ${description} ${this.formatCurrency(amount)} salvato comunque`, 'success');
            if (expenseNameField) expenseNameField.value = '';
            if (expenseAmountField) expenseAmountField.value = '';
            if (expenseSubCategory) expenseSubCategory.value = '';
            return;
        }

        this.showToast(this.t('voiceDetected', { desc: description, amount: amount }), 'info');
    }

    processFixedVoiceCommand(transcript) {
        const words = transcript.split(' ');
        let name = words[0] || (this.data.language === 'it' ? 'Spesa' : 'Expense');
        if (name.length > 20) name = name.substring(0, 20);
        const amountMatch = transcript.match(/(\d+[.,]?\d*)/);
        const amount = amountMatch ? parseFloat(amountMatch[0].replace(',', '.')) : 0;
        const dayMatch = transcript.match(/(\d{1,2})/g);
        let day = 1;
        if (dayMatch && dayMatch.length > 0) {
            for (let d of dayMatch) {
                const candidate = parseInt(d);
                if (candidate >= 1 && candidate <= 31 && candidate !== Math.round(amount)) {
                    day = candidate;
                    break;
                }
            }
        }
        const dateMatch = transcript.match(/(\d{1,2})[\/\s](\d{1,2})[\/\s](\d{4})/);
        let endDate = '';
        if (dateMatch) {
            endDate = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
        } else {
            const d = new Date();
            d.setFullYear(d.getFullYear() + 10);
            endDate = this.formatLocalDate(d);
        }
        document.getElementById('fixedName').value = name;
        document.getElementById('fixedAmount').value = amount;
        document.getElementById('fixedDay').value = day;
        document.getElementById('fixedEndDate').value = endDate;
        this.showToast(this.t('voiceFixedDetected', { name, amount: amount, day }), 'success');
    }

    // ========== AI WIDGET ==========
    generateAiSuggestion() {
        const suggestions = [];

        const categoryTotals = {};
        if (this.data.variableExpenses && typeof this.data.variableExpenses === 'object') {
            Object.values(this.data.variableExpenses).forEach(day => {
                if (Array.isArray(day)) {
                    day.forEach(exp => {
                        const cat = exp.category || 'Altro';
                        categoryTotals[cat] = (categoryTotals[cat] || 0) + (exp.amount || 0);
                    });
                }
            });
        }

        if (Object.keys(categoryTotals).length === 0) {
            const aiWidget = document.getElementById('aiWidget');
            if (aiWidget) aiWidget.style.display = 'none';
            return;
        }

        const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
        const topCatName = topCategory[0];

        if (topCategory[1] > 100) {
            const reduction = Math.round(topCategory[1] * 0.1);
            suggestions.push({
                message: this.t('aiTopCategoryMessage')
                    .replace('{amount}', this.formatCurrency(topCategory[1]))
                    .replace('{category}', topCatName)
                    .replace('{reduction}', this.formatCurrency(reduction)),
                action: this.t('aiTopCategoryAction'),
                actionType: 'reduce',
                category: topCategory[0],
                amount: reduction
            });
        }

        if (categoryTotals.Trasporti && categoryTotals.Trasporti > 50) {
            const potentialSave = Math.round(categoryTotals.Trasporti * 0.2);
            suggestions.push({
                message: this.t('aiTransportMessage')
                    .replace('{amount}', this.formatCurrency(categoryTotals.Trasporti))
                    .replace('{saving}', this.formatCurrency(potentialSave)),
                action: this.t('aiTransportAction'),
                actionType: 'transport',
                amount: potentialSave
            });
        }

        if (categoryTotals.Svago && categoryTotals.Svago > 80) {
            const potentialSave = Math.round(categoryTotals.Svago * 0.15);
            suggestions.push({
                message: this.t('aiLeisureMessage')
                    .replace('{amount}', this.formatCurrency(categoryTotals.Svago))
                    .replace('{saving}', this.formatCurrency(potentialSave)),
                action: this.t('aiLeisureAction'),
                actionType: 'leisure',
                amount: potentialSave
            });
        }

        if (suggestions.length > 0) {
            const randomIndex = Math.floor(Math.random() * suggestions.length);
            this.showAiSuggestion(suggestions[randomIndex]);
        } else if (topCategory && Number.isFinite(topCategory[1]) && topCategory[1] > 0) {
            this.showAiSuggestion({
                message: this.t('aiTopCategoryMessage')
                    .replace('{amount}', this.formatCurrency(topCategory[1]))
                    .replace('{category}', topCatName)
                    .replace('{reduction}', this.formatCurrency(Math.max(1, Math.round(topCategory[1] * 0.1)))),
                action: this.t('aiTopCategoryAction'),
                actionType: 'reduce',
                category: topCategory[0],
                amount: Math.max(1, Math.round(topCategory[1] * 0.1))
            });
        } else {
            const aiWidget = document.getElementById('aiWidget');
            if (aiWidget) aiWidget.style.display = 'none';
        }
    }

    showAiSuggestion(suggestion) {
        const widget = document.getElementById('aiWidget');
        const messageEl = document.getElementById('aiMessage');
        const actionEl = document.getElementById('aiAction');
        const actionBtn = document.getElementById('applyAiSuggestion');
        const dismissBtn = document.getElementById('dismissAiSuggestion');
        if (dismissBtn) dismissBtn.textContent = this.t('close');

        if (!widget || !messageEl || !actionEl || !actionBtn) return;

        const safeMessage = suggestion && typeof suggestion.message === 'string' ? suggestion.message.trim() : '';
        const safeAction = suggestion && typeof suggestion.action === 'string' ? suggestion.action.trim() : '';

        if (!safeMessage) {
            widget.style.display = 'none';
            actionEl.style.display = 'none';
            return;
        }

        messageEl.textContent = safeMessage;

        if (safeAction) {
            actionBtn.textContent = safeAction;
            actionBtn.dataset.type = suggestion.actionType || '';
            actionBtn.dataset.amount = suggestion.amount || 0;
            actionBtn.dataset.category = suggestion.category || '';
            actionEl.style.display = 'flex';
        } else {
            actionEl.style.display = 'none';
        }

        widget.style.display = 'block';
    }

    setupAiActions() {
        const applyBtn = document.getElementById('applyAiSuggestion');
        const dismissBtn = document.getElementById('dismissAiSuggestion');
        const aiAction = document.getElementById('aiAction');
        const aiWidget = document.getElementById('aiWidget');
        const aiMessage = document.getElementById('aiMessage');

        if (aiWidget && (!aiMessage || !String(aiMessage.textContent || '').trim())) {
            aiWidget.style.display = 'none';
            if (aiAction) aiAction.style.display = 'none';
        }

        if (!applyBtn) return;

        const cleanApplyBtn = applyBtn.cloneNode(true);
        applyBtn.parentNode.replaceChild(cleanApplyBtn, applyBtn);

        if (dismissBtn) {
            const cleanDismissBtn = dismissBtn.cloneNode(true);
            dismissBtn.parentNode.replaceChild(cleanDismissBtn, dismissBtn);
            cleanDismissBtn.addEventListener('click', () => {
                if (aiWidget) aiWidget.style.display = 'none';
            });
        }

        cleanApplyBtn.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.type || '';
            const amount = parseFloat(e.currentTarget.dataset.amount || '0');

            const bumpGoal = (extra) => {
                const currentGoal = this.data.savingsGoal || 0;
                const newGoal = currentGoal + (extra || 0);
                const goalInput = document.getElementById('saveGoal');
                if (goalInput) goalInput.value = newGoal;

                this.showToast(
                    this.t('goalRaisedToast', { amount: this.formatCurrency(newGoal) }),
                    'success'
                );
            };

            if (type === 'reduce' && amount > 0) {
                bumpGoal(amount);
            } else if (type === 'transport' && amount > 0) {
                const message = this.t('aiTransportConfirm', { amount: this.formatCurrency(amount) });

                this.showAppConfirm(message).then((confirmed) => { if (confirmed) bumpGoal(amount); });
            } else if (type === 'leisure' && amount > 0) {
                const message = this.t('aiLeisureConfirm', { amount: this.formatCurrency(amount) });

                this.showAppConfirm(message).then((confirmed) => { if (confirmed) bumpGoal(amount); });
            } else {
                this.showToast(this.t('featureInDev'), 'info');
            }

            if (aiAction) aiAction.style.display = 'none';
            setTimeout(() => {
                if (aiWidget) aiWidget.style.display = 'none';
            }, 2000);
        });
    }
}

// ============================================
// INIZIALIZZAZIONE - UNA SOLA VOLTA
// ============================================

// Rendi l'app accessibile globalmente
window.KedrixApp = null;


Kedrix.prototype.stripDecorativeText = function(value) {
    if (typeof value !== 'string') return value;
    return value
        .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
        .replace(/<strong>\s*Istruzioni\s*:\s*<\/strong>/gi, '<strong>Istruzioni:</strong>')
        .replace(/<strong>\s*Instructions\s*:\s*<\/strong>/gi, '<strong>Instructions:</strong>')
        .replace(/<strong>\s*Instrucciones\s*:\s*<\/strong>/gi, '<strong>Instrucciones:</strong>')
        .replace(/<strong>\s*Instructions\s*:\s*<\/strong>/gi, '<strong>Instructions :</strong>')
        .replace(/\s{2,}/g, ' ')
        .replace(/^\s+|\s+$/g, '')
        .replace(/(^|>)\s*[•·\-–—:]+\s*/g, '$1')
        .trim();
};

Kedrix.prototype.sanitizeTranslationMap = function(node) {
    if (typeof node === 'string') return this.stripDecorativeText(node);
    if (Array.isArray(node)) return node.map(item => this.sanitizeTranslationMap(item));
    if (node && typeof node === 'object') {
        return Object.fromEntries(Object.entries(node).map(([key, val]) => [key, this.sanitizeTranslationMap(val)]));
    }
    return node;
};

Kedrix.prototype.cleanupDecorativeUI = function() {
    const directMap = {
        themeToggle: document.documentElement.getAttribute('data-theme') === 'dark' ? 'Light' : 'Dark',
        wiseScoreHomeTitle: 'WiseScore™'
    };
    Object.entries(directMap).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    });

    const selectors = [
        '#toast',
        '#periodInfo',
        '#privacyToggle',
        '#wiseForecastStatus',
        '#footerFeatures',
        '#openReportBtn',
        '#refreshReportBtn',
        '#exportReportPdfBtn',
        '#dismissAiSuggestion',
        '#refreshReportModalBtn',
        '#printCategoryPdfBtn'
    ];

    selectors.forEach(selector => {
        const el = document.querySelector(selector);
        if (!el) return;
        if (el.children.length === 0) {
            el.textContent = this.stripDecorativeText(el.textContent);
        }
    });

    const remainingStatus = document.getElementById('remainingStatus');
    if (remainingStatus) remainingStatus.textContent = '';

    document.querySelectorAll('.tab-btn, .premium-badge, .license-badge, .help-text, .btn-link, .btn-primary, .btn-secondary, .btn-danger, .btn-text, option').forEach(el => {
        if (el.id === 'themeToggle') return;
        if (el.children.length === 0) {
            el.textContent = this.stripDecorativeText(el.textContent);
        }
    });
};


function applyFinalI18nOverrides(app) {
    if (!app || !app.translations) return;

    const overrides = {
        it: {
            csvImportBtn: '📥 Importa CSV / Excel',
            premiumSubtitle: 'Più funzioni, meno limiti, stessa esperienza Kedrix.',
            currentChip: 'Attuale',
            recommendedChip: 'Consigliato',
            csvImport: 'Importazione CSV/Excel',
            aiAssistant: 'Assistente AI',
            cloudSync: 'Sincronizzazione cloud',
            unlimitedTransactions: 'Transazioni illimitate',
            customCategories: 'Categorie personalizzate',
            excelImport: 'Importazione CSV/Excel',
            advancedAI: 'Assistente AI avanzato',
            detailedReports: 'Report dettagliati',
            voiceRecognition: 'Riconoscimento vocale',
            freeTrial: 'Prova gratuita',
            freeTrialText: '7 giorni di Premium, zero rischi!',
            startTrial: 'Avvia prova gratuita',
            activateLicense: 'Attiva licenza',
            loading: 'Caricamento...',
            loadExcelFile: 'Carica un file Excel',
            importing: 'Importazione...',
            excelReadError: '❌ Errore nella lettura del file Excel: {message}',
            importErrorGeneric: '❌ Errore durante l\'import: {message}',
            trialActivatedToast: '🎁 Prova Premium attivata! 7 giorni gratuiti',
            trialUsedToast: '⚠️ Prova già utilizzata',
            licenseActivatedToast: '✅ Licenza Premium attivata!',
            licenseInvalidToast: '❌ Licenza non valida',
            freeLimitToast: '⚠️ Hai raggiunto il limite di {count} transazioni (versione Free)',
            upgradeToUnlock: 'Upgrade a Premium per sbloccare questa funzionalità!',
            upgradeNow: 'Upgrade ora',
            expenseUpdated: '✅ Spesa aggiornata',
            externalUpdateSynced: 'Dati sincronizzati da un altro tab',
            headerRowFallback: 'Riga intestazione {row} non trovata. Uso la prima riga disponibile.'
        },
        en: {
            csvImportBtn: '📥 Import CSV / Excel',
            premiumSubtitle: 'More features, fewer limits, same Kedrix experience.',
            currentChip: 'Current',
            recommendedChip: 'Recommended',
            transactionsLimit: '50 transactions/month',
            categoriesLimit: '3 basic categories',
            csvImport: 'CSV/Excel import',
            aiAssistant: 'AI assistant',
            cloudSync: 'Cloud sync',
            unlimitedTransactions: 'Unlimited transactions',
            customCategories: 'Custom categories',
            excelImport: 'CSV/Excel import',
            advancedAI: 'Advanced AI assistant',
            detailedReports: 'Detailed reports',
            voiceRecognition: 'Voice recognition',
            freeTrial: 'Free Trial',
            freeTrialText: '7 days of Premium, zero risk!',
            startTrial: 'Start Free Trial',
            activateLicense: 'Activate License',
            currentPlan: 'Current plan',
            savingsPotInputLabel: 'Initial fund (€)',
            currentPlanMessage: 'With these settings you will not reach the goal',
            loading: 'Loading...',
            loadExcelFile: 'Load an Excel file',
            importing: 'Importing...',
            excelReadError: '❌ Error reading the Excel file: {message}',
            importErrorGeneric: '❌ Error during import: {message}',
            trialActivatedToast: '🎁 Premium trial activated! 7 free days',
            trialUsedToast: '⚠️ Trial already used',
            licenseActivatedToast: '✅ Premium license activated!',
            licenseInvalidToast: '❌ Invalid license',
            freeLimitToast: '⚠️ You reached the limit of {count} transactions (Free version)',
            upgradeToUnlock: 'Upgrade to Premium to unlock this feature!',
            upgradeNow: 'Upgrade now',
            expenseUpdated: '✅ Expense updated',
            externalUpdateSynced: 'Data synced from another tab',
            headerRowFallback: 'Header row {row} not found. Using the first available row.'
        },
        es: {
            csvImportBtn: '📥 Importar CSV / Excel',
            premiumSubtitle: 'Más funciones, menos límites, la misma experiencia Kedrix.',
            currentChip: 'Actual',
            recommendedChip: 'Recomendado',
            transactionsLimit: '50 transacciones/mes',
            categoriesLimit: '3 categorías base',
            csvImport: 'Importación CSV/Excel',
            aiAssistant: 'Asistente IA',
            cloudSync: 'Sincronización en la nube',
            unlimitedTransactions: 'Transacciones ilimitadas',
            customCategories: 'Categorías personalizadas',
            excelImport: 'Importación CSV/Excel',
            advancedAI: 'Asistente IA avanzado',
            detailedReports: 'Informes detallados',
            voiceRecognition: 'Reconocimiento por voz',
            freeTrial: 'Prueba gratuita',
            freeTrialText: '7 días de Premium, ¡sin riesgos!',
            startTrial: 'Iniciar prueba gratuita',
            activateLicense: 'Activar licencia',
            loading: 'Cargando...',
            loadExcelFile: 'Carga un archivo Excel',
            importing: 'Importando...',
            excelReadError: '❌ Error al leer el archivo Excel: {message}',
            importErrorGeneric: '❌ Error durante la importación: {message}',
            trialActivatedToast: '🎁 ¡Prueba Premium activada! 7 días gratis',
            trialUsedToast: '⚠️ La prueba ya se ha utilizado',
            licenseActivatedToast: '✅ ¡Licencia Premium activada!',
            licenseInvalidToast: '❌ Licencia no válida',
            freeLimitToast: '⚠️ Has alcanzado el límite de {count} transacciones (versión Free)',
            upgradeToUnlock: '¡Pasa a Premium para desbloquear esta función!',
            upgradeNow: 'Mejorar ahora',
            expenseUpdated: '✅ Gasto actualizado',
            externalUpdateSynced: 'Datos sincronizados desde otra pestaña',
            headerRowFallback: 'Fila de encabezado {row} no encontrada. Se usa la primera fila disponible.'
        },
        fr: {
            csvImportBtn: '📥 Importer CSV / Excel',
            premiumSubtitle: 'Plus de fonctions, moins de limites, la même expérience Kedrix.',
            currentChip: 'Actuel',
            recommendedChip: 'Recommandé',
            transactionsLimit: '50 transactions/mois',
            categoriesLimit: '3 catégories de base',
            csvImport: 'Import CSV/Excel',
            aiAssistant: 'Assistant IA',
            cloudSync: 'Synchronisation cloud',
            unlimitedTransactions: 'Transactions illimitées',
            customCategories: 'Catégories personnalisées',
            excelImport: 'Import CSV/Excel',
            advancedAI: 'Assistant IA avancé',
            detailedReports: 'Rapports détaillés',
            voiceRecognition: 'Reconnaissance vocale',
            freeTrial: 'Essai gratuit',
            freeTrialText: '7 jours de Premium, zéro risque !',
            startTrial: 'Démarrer l\'essai gratuit',
            activateLicense: 'Activer la licence',
            loading: 'Chargement...',
            loadExcelFile: 'Chargez un fichier Excel',
            importing: 'Importation...',
            excelReadError: '❌ Erreur lors de la lecture du fichier Excel : {message}',
            importErrorGeneric: '❌ Erreur pendant l\'import : {message}',
            trialActivatedToast: '🎁 Essai Premium activé ! 7 jours gratuits',
            trialUsedToast: '⚠️ Essai déjà utilisé',
            licenseActivatedToast: '✅ Licence Premium activée !',
            licenseInvalidToast: '❌ Licence non valide',
            freeLimitToast: '⚠️ Vous avez atteint la limite de {count} transactions (version Free)',
            upgradeToUnlock: 'Passez à Premium pour débloquer cette fonctionnalité !',
            upgradeNow: 'Passer maintenant',
            expenseUpdated: '✅ Dépense mise à jour',
            externalUpdateSynced: 'Données synchronisées depuis un autre onglet',
            headerRowFallback: 'Ligne d\'en-tête {row} introuvable. Utilisation de la première ligne disponible.'
        }
    };

    Object.entries(overrides).forEach(([lang, map]) => {
        app.translations[lang] = Object.assign({}, app.translations[lang] || {}, map);
        if (app.translations[lang] && app.translations[lang].features) {
            app.translations[lang].features = Object.assign({}, app.translations[lang].features, {
                csvImport: app.translations[lang].csvImport,
                aiAssistant: app.translations[lang].aiAssistant,
                cloudSync: app.translations[lang].cloudSync,
                unlimitedTransactions: app.translations[lang].unlimitedTransactions,
                customCategories: app.translations[lang].customCategories,
                excelImport: app.translations[lang].excelImport,
                advancedAI: app.translations[lang].advancedAI,
                detailedReports: app.translations[lang].detailedReports,
                voiceRecognition: app.translations[lang].voiceRecognition
            });
        }
    });
}



(function(){
    const ACTIVATION_STORAGE_KEY = 'kedrix-activation-v6';
    const ACTIVATION_SESSION_KEY = 'kedrix-activation-session-v6';
    const ACTIVATION_EXIT_MS = 45000;
    const ACTIVATION_COPY = {
        it: {
            cardEyebrow: 'ATTIVAZIONE GUIDATA',
            cardTitleStart: 'Porta Kedrix al primo valore',
            cardTitleActive: 'Ottimo: Kedrix sta già lavorando per te',
            cardTextStart: 'Per capire Kedrix in meno di 60 secondi fai una di queste azioni: aggiungi un\'entrata, registra una spesa o carica la demo.',
            cardTextIncome: 'Hai impostato il periodo. Ora registra una prima spesa variabile per vedere ritmo, forecast e stato reale del periodo.',
            cardTextComplete: 'Hai già sbloccato il valore iniziale. Continua con analisi, forecast e ottimizzazione del periodo.',
            ctaIncome: 'Aggiungi entrata',
            ctaExpense: 'Registra spesa',
            ctaDemo: 'Carica demo',
            ctaAnalysis: 'Apri analisi',
            ctaDismiss: 'Nascondi',
            modalKicker: 'Benvenuto in Kedrix',
            modalTitle: 'Ti porto al primo valore rapidamente',
            modalText: 'Nessun giro lungo: fai una prima azione e Kedrix inizia subito a leggere il tuo periodo.',
            modalPrimary: 'Inizia da entrate',
            modalSecondary: 'Usa la demo',
            modalGhost: 'Dopo',
            firstValueToast: '✅ Primo valore raggiunto: Kedrix ora ha abbastanza dati per guidarti meglio.',
            sessionRecovered: 'Accesso ripristinato. Riprendi da dove eri rimasto.',
            checklistIncome: '1. Inserisci entrata',
            checklistExpense: '2. Registra una spesa',
            checklistInsight: '3. Leggi forecast e ritmo',
            statusStart: 'Step consigliato: definisci il periodo',
            statusIncome: 'Step consigliato: registra la prima spesa',
            statusComplete: 'Primo valore sbloccato'
        },
        en: {
            cardEyebrow: 'GUIDED ACTIVATION',
            cardTitleStart: 'Bring Kedrix to first value',
            cardTitleActive: 'Great: Kedrix is already working for you',
            cardTextStart: 'To understand Kedrix in under 60 seconds, do one of these: add income, log an expense, or load the demo.',
            cardTextIncome: 'Your period is set. Now log a first variable expense to unlock pace, forecast, and real period status.',
            cardTextComplete: 'You already unlocked initial value. Continue with analysis, forecast, and period optimization.',
            ctaIncome: 'Add income',
            ctaExpense: 'Log expense',
            ctaDemo: 'Load demo',
            ctaAnalysis: 'Open analysis',
            ctaDismiss: 'Hide',
            modalKicker: 'Welcome to Kedrix',
            modalTitle: 'Let’s get to first value fast',
            modalText: 'No long setup: do one first action and Kedrix starts reading your period immediately.',
            modalPrimary: 'Start with income',
            modalSecondary: 'Use demo',
            modalGhost: 'Later',
            firstValueToast: '✅ First value reached: Kedrix now has enough data to guide you better.',
            sessionRecovered: 'Access restored. Continue where you left off.',
            checklistIncome: '1. Add income',
            checklistExpense: '2. Log an expense',
            checklistInsight: '3. Read forecast and pace',
            statusStart: 'Recommended step: define the period',
            statusIncome: 'Recommended step: log your first expense',
            statusComplete: 'First value unlocked',
            expenseModalTitle: 'Add your first expense',
            expenseModalText: 'You already added income. Now enter a first expense to see Kedrix really in action.'
        },
        es: {
            cardEyebrow: 'ACTIVACIÓN GUIADA',
            cardTitleStart: 'Lleva Kedrix a su primer valor',
            cardTitleActive: 'Perfecto: Kedrix ya está trabajando para ti',
            cardTextStart: 'Para entender Kedrix en menos de 60 segundos, haz una de estas acciones: añade un ingreso, registra un gasto o carga la demo.',
            cardTextIncome: 'Tu período ya está definido. Ahora registra un primer gasto variable para desbloquear ritmo, forecast y estado real del período.',
            cardTextComplete: 'Ya has desbloqueado el valor inicial. Continúa con análisis, forecast y optimización del período.',
            ctaIncome: 'Añadir ingreso',
            ctaExpense: 'Registrar gasto',
            ctaDemo: 'Cargar demo',
            ctaAnalysis: 'Abrir análisis',
            ctaDismiss: 'Ocultar',
            modalKicker: 'Bienvenido a Kedrix',
            modalTitle: 'Te llevo al primer valor rápidamente',
            modalText: 'Sin rodeos: haz una primera acción y Kedrix empezará a leer tu período enseguida.',
            modalPrimary: 'Empezar con ingresos',
            modalSecondary: 'Usar demo',
            modalGhost: 'Después',
            firstValueToast: '✅ Primer valor alcanzado: Kedrix ahora tiene suficientes datos para guiarte mejor.',
            sessionRecovered: 'Acceso restaurado. Continúa donde lo dejaste.',
            checklistIncome: '1. Añadir ingreso',
            checklistExpense: '2. Registrar un gasto',
            checklistInsight: '3. Leer forecast y ritmo',
            statusStart: 'Paso recomendado: define el período',
            statusIncome: 'Paso recomendado: registra tu primer gasto',
            statusComplete: 'Primer valor desbloqueado',
            expenseModalTitle: 'Añade tu primer gasto',
            expenseModalText: 'Ya has registrado un ingreso. Ahora introduce un primer gasto para ver Kedrix realmente en acción.'
        },
        fr: {
            cardEyebrow: 'ACTIVATION GUIDÉE',
            cardTitleStart: 'Amenez Kedrix à sa première valeur',
            cardTitleActive: 'Parfait : Kedrix travaille déjà pour vous',
            cardTextStart: 'Pour comprendre Kedrix en moins de 60 secondes, faites l’une de ces actions : ajoutez un revenu, enregistrez une dépense ou chargez la démo.',
            cardTextIncome: 'Votre période est définie. Enregistrez maintenant une première dépense variable pour débloquer le rythme, le forecast et l’état réel de la période.',
            cardTextComplete: 'Vous avez déjà débloqué la valeur initiale. Continuez avec l’analyse, le forecast et l’optimisation de la période.',
            ctaIncome: 'Ajouter un revenu',
            ctaExpense: 'Enregistrer une dépense',
            ctaDemo: 'Charger la démo',
            ctaAnalysis: 'Ouvrir l’analyse',
            ctaDismiss: 'Masquer',
            modalKicker: 'Bienvenue sur Kedrix',
            modalTitle: 'Je vous mène rapidement à la première valeur',
            modalText: 'Pas de long détour : faites une première action et Kedrix commence immédiatement à lire votre période.',
            modalPrimary: 'Commencer par les revenus',
            modalSecondary: 'Utiliser la démo',
            modalGhost: 'Plus tard',
            firstValueToast: '✅ Première valeur atteinte : Kedrix a maintenant assez de données pour mieux vous guider.',
            sessionRecovered: 'Accès rétabli. Reprenez où vous en étiez.',
            checklistIncome: '1. Ajouter un revenu',
            checklistExpense: '2. Enregistrer une dépense',
            checklistInsight: '3. Lire le forecast et le rythme',
            statusStart: 'Étape recommandée : définissez la période',
            statusIncome: 'Étape recommandée : enregistrez votre première dépense',
            statusComplete: 'Première valeur débloquée',
            expenseModalTitle: 'Ajoutez votre première dépense',
            expenseModalText: 'Vous avez déjà enregistré un revenu. Saisissez maintenant une première dépense pour voir Kedrix réellement en action.'
        }
    };

    function resolveRuntimeLang(app) {
        if (window.KedrixI18n && typeof window.KedrixI18n.resolveRuntimeLanguage === 'function') {
            return window.KedrixI18n.resolveRuntimeLanguage(app);
        }
        const htmlLang = String(document.documentElement?.lang || '').trim().toLowerCase();
        return htmlLang || 'it';
    }

    function getCopy(lang, key) {
        const bucket = ACTIVATION_COPY[lang] || ACTIVATION_COPY.it;
        return bucket[key] || ACTIVATION_COPY.it[key] || '';
    }

    function safeParse(raw, fallback) {
        if (raw == null || raw === '') return fallback;
        try {
            const parsed = JSON.parse(raw);
            return parsed == null ? fallback : parsed;
        } catch (_e) {
            return fallback;
        }
    }

    function countVariableExpenses(app) {
        const store = app?.data?.variableExpenses;
        if (!store || typeof store !== 'object') return 0;
        return Object.values(store).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
    }

    function readActivationState() {
  const state = safeParse(localStorage.getItem(ACTIVATION_STORAGE_KEY), {});
  return state && typeof state === 'object' ? state : {};
}

    function writeActivationState(next) {
        localStorage.setItem(ACTIVATION_STORAGE_KEY, JSON.stringify(next || {}));
        return next;
    }

    function ensureActivationStyles() {
        if (document.getElementById('kedrix-activation-style')) return;
        const style = document.createElement('style');
        style.id = 'kedrix-activation-style';
        style.textContent = `
            .activation-card {
                margin-top: 18px;
                padding: 18px;
                border-radius: 24px;
                background: linear-gradient(180deg, rgba(56, 189, 248, 0.12), rgba(124, 58, 237, 0.08));
                border: 1px solid rgba(56, 189, 248, 0.24);
                box-shadow: 0 14px 38px rgba(15, 23, 42, 0.16);
            }
            .activation-card[hidden] { display:none !important; }
            .activation-eyebrow {
                font-size: 0.75rem;
                font-weight: 800;
                letter-spacing: 0.14em;
                color: var(--accent, #38bdf8);
                margin-bottom: 8px;
            }
            .activation-title {
                margin: 0;
                font-size: 1.2rem;
                line-height: 1.2;
            }
            .activation-text {
                margin: 10px 0 0;
                color: var(--text-secondary);
                line-height: 1.55;
            }
            .activation-status {
                margin-top: 14px;
                padding: 10px 12px;
                border-radius: 14px;
                background: rgba(15, 23, 42, 0.06);
                font-size: 0.94rem;
                font-weight: 600;
            }
            .activation-checklist {
                margin: 14px 0 0;
                padding: 0;
                list-style: none;
                display: grid;
                gap: 8px;
            }
            .activation-checklist li {
                display: flex;
                align-items: center;
                gap: 10px;
                color: var(--text-primary);
                font-size: 0.95rem;
            }
            .activation-checklist .done {
                color: var(--success, #16a34a);
                font-weight: 700;
            }
            .activation-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 16px;
            }
            .activation-btn-secondary {
                background: transparent;
                border: 1px solid var(--border);
                color: var(--text-primary);
            }
            .activation-dismiss {
                margin-left: auto;
                background: transparent;
                border: none;
                color: var(--text-secondary);
                cursor: pointer;
                font-weight: 600;
            }
            .activation-modal {
                position: fixed;
                inset: 0;
                z-index: 10020;
                background: rgba(2, 6, 23, 0.6);
                backdrop-filter: blur(10px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 18px;
            }
            .activation-modal[hidden] { display:none !important; }
            .activation-modal-card {
                width: min(480px, 100%);
                border-radius: 28px;
                padding: 26px;
                background: var(--card-bg, #111827);
                border: 1px solid rgba(56, 189, 248, 0.24);
                box-shadow: 0 28px 80px rgba(2, 6, 23, 0.5);
            }
            .activation-modal-kicker {
                font-size: 0.76rem;
                font-weight: 800;
                letter-spacing: 0.14em;
                color: var(--accent, #38bdf8);
                text-transform: uppercase;
            }
            .activation-modal-title {
                margin: 10px 0 6px;
                font-size: 1.5rem;
                line-height: 1.15;
            }
            .activation-modal-text {
                margin: 0;
                color: var(--text-secondary);
                line-height: 1.6;
            }
            .activation-modal-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 20px;
            }
            @media (max-width: 640px) {
                .activation-actions,
                .activation-modal-actions { flex-direction: column; }
                .activation-dismiss { margin-left: 0; text-align: left; padding: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    Kedrix.prototype.getActivationMetrics = function() {
        return {
            incomes: Array.isArray(this.data?.incomes) ? this.data.incomes.length : 0,
            fixed: Array.isArray(this.data?.fixedExpenses) ? this.data.fixedExpenses.length : 0,
            variable: countVariableExpenses(this)
        };
    };

    Kedrix.prototype.getActivationStage = function() {
        const metrics = this.getActivationMetrics();
        if (metrics.incomes === 0) return 'needs_income';
        if (metrics.variable === 0 && metrics.fixed === 0) return 'needs_first_expense';
        return 'first_value';
    };

    Kedrix.prototype.trackActivationEvent = function(name, payload) {
        const basePayload = Object.assign({ stage: this.getActivationStage() }, payload || {});
        try {
            window.KedrixTrackingHooks?.mark?.(name, basePayload);
            if (name === 'first_value') {
                window.KedrixTrackingHooks?.markFirstValue?.(basePayload);
            }
        } catch (_e) {}
    };

    Kedrix.prototype.persistActivationState = function(patch) {
        const next = Object.assign({}, readActivationState(), patch || {});
        writeActivationState(next);
        return next;
    };

    Kedrix.prototype.focusTabTarget = function(tab, focusSelector) {
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
        if (tabBtn) tabBtn.click();
        if (focusSelector) {
            setTimeout(() => {
                const target = document.querySelector(focusSelector);
                if (target) {
                    target.focus();
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 80);
        }
    };

    Kedrix.prototype.dismissActivationPrompt = function(source) {
        this.persistActivationState({ dismissedAt: Date.now(), dismissedSource: source || 'manual' });
        const card = document.getElementById('kedrixActivationCard');
        if (card) card.hidden = true;
        const modal = document.getElementById('kedrixActivationModal');
        if (modal) modal.hidden = true;
        this.trackActivationEvent('activation_dismissed', { source: source || 'manual' });
    };

    Kedrix.prototype.completeActivation = function(source) {
        const state = this.persistActivationState({
            firstValueAt: readActivationState().firstValueAt || Date.now(),
            completedAt: Date.now(),
            completedSource: source || 'unknown'
        });
        this.trackActivationEvent('first_value', { source: source || 'unknown', elapsedMs: state.firstValueAt - (state.startedAt || Date.now()) });
        const modal = document.getElementById('kedrixActivationModal');
        if (modal) modal.hidden = true;
        this.renderActivationCard(true);
        this.showToast(getCopy(resolveRuntimeLang(this), 'firstValueToast'), 'success');
    };

    Kedrix.prototype.renderActivationCard = function(force) {
        ensureActivationStyles();
        const host = document.getElementById('homeQuickAddCard');
        if (!host) return;
        let card = document.getElementById('kedrixActivationCard');
        if (!card) {
            card = document.createElement('div');
            card.id = 'kedrixActivationCard';
            card.className = 'section-card activation-card';
            host.insertAdjacentElement('afterend', card);
        }
        const state = readActivationState();
        const stage = this.getActivationStage();
        const metrics = this.getActivationMetrics();
        const completed = stage === 'first_value' || !!state.completedAt;
        if (state.dismissedAt && !force && !completed) {
            card.hidden = true;
            return;
        }
        const lang = resolveRuntimeLang(this);
        const title = completed ? getCopy(lang, 'cardTitleActive') : getCopy(lang, 'cardTitleStart');
        const text = stage === 'needs_income'
            ? getCopy(lang, 'cardTextStart')
            : completed
                ? getCopy(lang, 'cardTextComplete')
                : getCopy(lang, 'cardTextIncome');
        const status = stage === 'needs_income'
            ? getCopy(lang, 'statusStart')
            : completed
                ? getCopy(lang, 'statusComplete')
                : getCopy(lang, 'statusIncome');
        const doneIncome = metrics.incomes > 0;
        const doneExpense = (metrics.variable + metrics.fixed) > 0;
        const doneInsight = completed;
        card.hidden = false;
        card.innerHTML = `
            <div class="activation-eyebrow">${getCopy(lang, 'cardEyebrow')}</div>
            <h3 class="activation-title">${title}</h3>
            <p class="activation-text">${text}</p>
            <div class="activation-status">${status}</div>
            <ul class="activation-checklist">
                <li><span class="${doneIncome ? 'done' : ''}">${doneIncome ? '✓' : '•'}</span><span>${getCopy(lang, 'checklistIncome')}</span></li>
                <li><span class="${doneExpense ? 'done' : ''}">${doneExpense ? '✓' : '•'}</span><span>${getCopy(lang, 'checklistExpense')}</span></li>
                <li><span class="${doneInsight ? 'done' : ''}">${doneInsight ? '✓' : '•'}</span><span>${getCopy(lang, 'checklistInsight')}</span></li>
            </ul>
            <div class="activation-actions">
                ${!doneIncome ? `<button type="button" class="btn-primary" data-activation-action="income">${getCopy(lang, 'ctaIncome')}</button>` : ''}
                ${!doneExpense ? `<button type="button" class="btn-secondary activation-btn-secondary" data-activation-action="expense">${getCopy(lang, 'ctaExpense')}</button>` : ''}
                ${!completed ? `<button type="button" class="btn-secondary activation-btn-secondary" data-activation-action="demo">${getCopy(lang, 'ctaDemo')}</button>` : `<button type="button" class="btn-secondary activation-btn-secondary" data-activation-action="analysis">${getCopy(lang, 'ctaAnalysis')}</button>`}
                <button type="button" class="activation-dismiss" data-activation-action="dismiss">${getCopy(lang, 'ctaDismiss')}</button>
            </div>
        `;
        card.querySelectorAll('[data-activation-action]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-activation-action');
                if (action === 'income') {
                    this.trackActivationEvent('activation_cta_click', { action });
                    this.focusTabTarget('incomes', '#incomeDesc');
                } else if (action === 'expense') {
                    this.trackActivationEvent('activation_cta_click', { action });
                    this.focusTabTarget('variable', '#expenseName');
                } else if (action === 'analysis') {
                    this.trackActivationEvent('activation_cta_click', { action });
                    this.focusTabTarget('analysis');
                } else if (action === 'demo') {
                    this.trackActivationEvent('activation_cta_click', { action });
                    this.loadDemoData();
                } else if (action === 'dismiss') {
                    this.dismissActivationPrompt('card');
                }
            });
        });
    };

    Kedrix.prototype.showActivationModal = function(force) {
        ensureActivationStyles();
        const state = readActivationState();
        const stage = this.getActivationStage();
        const completed = stage === 'first_value' || !!state.completedAt || !!state.firstValueAt;
        if (completed) return;
        if (!force && state.modalSeenAt) return;

        let modal = document.getElementById('kedrixActivationModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'kedrixActivationModal';
            modal.className = 'activation-modal';
            document.body.appendChild(modal);
        }

        const lang = resolveRuntimeLang(this);
        const needsIncome = stage === 'needs_income';
        const primaryLabel = needsIncome ? getCopy(lang, 'modalPrimary') : getCopy(lang, 'ctaExpense');
        const title = needsIncome ? getCopy(lang, 'modalTitle') : getCopy(lang, 'expenseModalTitle');
        const text = needsIncome
            ? getCopy(lang, 'modalText')
            : getCopy(lang, 'expenseModalText');

        modal.hidden = false;
        modal.innerHTML = `
            <div class="activation-modal-card">
                <div class="activation-modal-kicker">${getCopy(lang, 'modalKicker')}</div>
                <h3 class="activation-modal-title">${title}</h3>
                <p class="activation-modal-text">${text}</p>
                <div class="activation-modal-actions">
                    <button type="button" class="btn-primary" data-modal-action="primary">${primaryLabel}</button>
                    <button type="button" class="btn-secondary activation-btn-secondary" data-modal-action="demo">${getCopy(lang, 'modalSecondary')}</button>
                    <button type="button" class="btn-text" data-modal-action="later">${getCopy(lang, 'modalGhost')}</button>
                </div>
            </div>
        `;

        this.persistActivationState({ modalSeenAt: Date.now() });
        this.trackActivationEvent('activation_modal_shown', { forced: !!force, stage });
        modal.querySelectorAll('[data-modal-action]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-modal-action');
                modal.hidden = true;
                if (action === 'primary') {
                    this.trackActivationEvent('activation_modal_click', { action: needsIncome ? 'income' : 'expense' });
                    if (needsIncome) this.focusTabTarget('incomes', '#incomeDesc');
                    else this.focusTabTarget('variable', '#expenseName');
                } else if (action === 'demo') {
                    this.trackActivationEvent('activation_modal_click', { action });
                    this.loadDemoData();
                } else {
                    this.trackActivationEvent('activation_modal_click', { action });
                }
            });
        });
    };

    Kedrix.prototype.bootstrapActivationSystem = function() {
        let state = readActivationState() || {};
        const stage = this.getActivationStage();
        const completed = stage === 'first_value' || !!state.completedAt || !!state.firstValueAt;

        if (!state.startedAt) {
            state = this.persistActivationState({ startedAt: Date.now() });
            this.trackActivationEvent('activation_started');
        }

        if (!sessionStorage.getItem(ACTIVATION_SESSION_KEY)) {
            sessionStorage.setItem(ACTIVATION_SESSION_KEY, String(Date.now()));
            if (completed) {
                this.showToast(getCopy(resolveRuntimeLang(this), 'sessionRecovered'), 'info');
                this.trackActivationEvent('activation_session_recovered');
            }
        }

        if (!completed) {
            state = this.persistActivationState({ dismissedAt: '', dismissedSource: '', modalSeenAt: '' });
        }

        this.renderActivationCard(true);

        if (!completed) {
            setTimeout(() => {
                try {
                    this.showActivationModal(true);
                } catch (_e) {}
            }, 250);
        }

        if (!window.__kedrixActivationUnloadBound) {
            window.__kedrixActivationUnloadBound = true;
            window.addEventListener('beforeunload', () => {
                const runtime = Date.now() - (readActivationState().startedAt || Date.now());
                if (runtime >= ACTIVATION_EXIT_MS && !readActivationState().completedAt) {
                    try { window.KedrixTrackingHooks?.mark?.('early_exit', { runtimeMs: runtime, stage: this.getActivationStage() }); } catch (_e) {}
                }
            });
        }
    };

    const originalStartOnboarding = Kedrix.prototype.startOnboarding;
    Kedrix.prototype.startOnboarding = function(...args) {
        this.bootstrapActivationSystem();
        return originalStartOnboarding ? originalStartOnboarding.apply(this, args) : undefined;
    };

    function patchMutation(methodName, sourceName) {
        const original = Kedrix.prototype[methodName];
        if (typeof original !== 'function') return;
        Kedrix.prototype[methodName] = async function(...args) {
            const beforeStage = this.getActivationStage();
            const result = await original.apply(this, args);
            const afterStage = this.getActivationStage();
            if (afterStage === 'first_value' && beforeStage !== 'first_value') {
                this.completeActivation(sourceName);
            } else {
                this.renderActivationCard();
            }
            return result;
        };
    }

    ['addIncome', 'addFixedExpense', 'addVariableExpense', 'loadDemoData', 'parseCSV', 'parseExcel'].forEach((method) => {
        patchMutation(method, method);
    });
})();

function initApp() {
    try {
        window.KedrixApp = new Kedrix();
        window.appInitialized = true;
        // Rende disponibile anche 'app' per comodità
        window.app = window.KedrixApp;
        window.BudgetWiseApp = window.KedrixApp;
        applyFinalI18nOverrides(window.app);
    } catch (error) {
        console.error('❌ Errore inizializzazione:', error);
    }
}

// Assicuriamoci che l'app venga inizializzata una sola volta
if (!window.appInitialized) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        // Piccolo ritardo per garantire che tutto sia caricato
        setTimeout(initApp, 100);
    }
}

// ============================================
// GESTIONE IMPORT CSV/EXCEL (UNA SOLA VOLTA)
// ============================================
function setupImportHandlers() {
    const btn = document.getElementById('importCsvBtn');
    const fileInput = document.getElementById('csvFile');
    const fileNameSpan = document.getElementById('csvFileName');
    const skipRowsInput = document.getElementById('skipRows');
    const headerRowInput = document.getElementById('headerRowManual');
    const sheetSelect = document.getElementById('excelSheet');
    const excelHeaderSelect = document.getElementById('excelHeaderRow');
    const advancedToggle = document.getElementById('importAdvancedToggle');
    const advancedWrap = document.getElementById('importAdvanced');
    
    if (!btn || !fileInput || !window.app) {
        // Alcuni layout non espongono subito i controlli import: evita rumore in console.
        return;
    }

    // Variabile per tenere traccia del file Excel in attesa
    window._pendingExcelFile = null;

            // Toggle opzioni avanzate (default: nascoste)
    if (advancedToggle && advancedWrap) {
        // Rimuovi eventuali listener precedenti
        advancedToggle.replaceWith(advancedToggle.cloneNode(true));
        const newAdvancedToggle = document.getElementById('importAdvancedToggle');
        
        // Imposta il testo iniziale in base alla lingua corrente
        newAdvancedToggle.textContent = window.app ? window.app.t('advancedOptions') : 'Opzioni avanzate';
        
        newAdvancedToggle.addEventListener('click', () => {
            const isOpen = advancedWrap.style.display !== 'none';
            advancedWrap.style.display = isOpen ? 'none' : 'block';
            // Usa la traduzione corretta in base allo stato
            newAdvancedToggle.textContent = isOpen 
                ? (window.app ? window.app.t('advancedOptions') : 'Opzioni avanzate')
                : (window.app ? window.app.t('hideOptions') : 'Nascondi opzioni');
        });
    }
    
    // Gestione cambio file
    fileInput.replaceWith(fileInput.cloneNode(true));
    const newFileInput = document.getElementById('csvFile');
    
    newFileInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        fileNameSpan.textContent = file.name;
        
        const fileExt = file.name.split('.').pop().toLowerCase();
        const isExcel = ['xls', 'xlsx'].includes(fileExt);
        
        if (isExcel) {
            if (sheetSelect) {
                sheetSelect.innerHTML = '<option value="">Caricamento...</option>';
                sheetSelect.disabled = true;
            }
            
            try {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        
                        if (sheetSelect) {
                            sheetSelect.innerHTML = workbook.SheetNames.map((name, index) => 
                                `<option value="${index}">${index+1}. ${name}</option>`
                            ).join('');
                            sheetSelect.disabled = false;
                            sheetSelect.value = '0';
                        }
                        
                        window._pendingExcelFile = file;
                        
                    } catch (err) {
                        window.app?.showToast(window.app?.t ? window.app.t('excelReadError', { message: err.message }) : ('❌ Error reading the Excel file: ' + err.message), 'error');
                    }
                };
                reader.readAsArrayBuffer(file);
                
            } catch (error) {
                window.app?.showToast(window.app?.t ? window.app.t('excelReadError', { message: error.message }) : ('❌ Error reading the Excel file: ' + error.message), 'error');
            }
        } else {
            if (sheetSelect) {
                sheetSelect.innerHTML = '<option value="">Carica un file Excel</option>';
                sheetSelect.disabled = true;
            }
            window._pendingExcelFile = null;
        }
    });

    // Gestione click pulsante Importa
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', async function() {
        const file = newFileInput.files[0];
        const pendingFile = window._pendingExcelFile;
        
        if (!file && !pendingFile) {
            // Apri il file picker se non è stato selezionato niente
            newFileInput.click();
            return;
        }
        
        const fileToImport = pendingFile || file;
        const fileExt = fileToImport.name.split('.').pop().toLowerCase();
        const isExcel = ['xls', 'xlsx'].includes(fileExt);
        
        try {
            if (isExcel) {
                const sheetIndex = (sheetSelect && !sheetSelect.disabled && sheetSelect.value !== '')
                    ? parseInt(sheetSelect.value)
                    : 0;
                const headerRow = excelHeaderSelect
                    ? parseInt(excelHeaderSelect.value || '-1')
                    : -1;
                
                newBtn.textContent = ` ${window.app?.t ? window.app.t('importing') : 'Importing...'}`;
                newBtn.disabled = true;
                
                await window.app.parseExcel(fileToImport, sheetIndex, headerRow);
                
                window._pendingExcelFile = null;
                newFileInput.value = '';
                fileNameSpan.textContent = window.app?.t ? window.app.t('csvNoFile') : 'No file selected';
                if (sheetSelect) {
                    sheetSelect.innerHTML = '<option value="">Carica un file Excel</option>';
                    sheetSelect.disabled = true;
                }
                
            } else {
                const delimiter = document.getElementById('csvSeparator').value;
                const dateFormat = document.getElementById('csvDelimiter').value;
                const skipRows = parseInt(skipRowsInput?.value || '0');
                const headerRow = parseInt(headerRowInput?.value || '1');
                
                newBtn.textContent = ` ${window.app?.t ? window.app.t('importing') : 'Importing...'}`;
                newBtn.disabled = true;
                
                await window.app.parseCSV(fileToImport, delimiter, dateFormat, skipRows, headerRow);
                
                newFileInput.value = '';
                fileNameSpan.textContent = window.app?.t ? window.app.t('csvNoFile') : 'No file selected';
            }
            
        } catch (error) {
            window.app?.showToast(window.app?.t ? window.app.t('importErrorGeneric', { message: (error?.message || String(error)) }) : ('❌ Error during import: ' + (error?.message || String(error))), 'error');
            console.error(error);
        } finally {
            try {
                newBtn.innerHTML = window.app?.t ? window.app.t('csvImportBtn') : '📥 Importa CSV / Excel';
            } catch {
                newBtn.textContent = 'Importa CSV / Excel';
            }
            newBtn.disabled = false;
        }
    });
    
    // ========== METODI PREMIUM ==========
    if (window.app && !window.app.premiumSetupDone) {
        window.app.updateLicenseStatus = () => {
            if (!window.app.license) {
                console.warn('⚠️ License system non disponibile');
                return;
            }

            const licenseStatus = document.getElementById('licenseStatus');
            if (!licenseStatus) return;

            const planInfo = window.app.license.getPlanInfo();
            const status = String(window.app.license.getStatus ? window.app.license.getStatus() : '').toLowerCase();
            const accessAllowed = !!(window.app.license.hasFullPremiumAccess && window.app.license.hasFullPremiumAccess());
            const badge = licenseStatus.querySelector('.license-badge, .badge');

            const classMap = {
                active: 'premium',
                pending: 'free',
                expired: 'free',
                revoked: 'free',
                suspended: 'free',
                missing: 'free',
                error: 'free'
            };

            licenseStatus.className = `license-status ${classMap[status] || (accessAllowed ? 'premium' : 'free')} beta-combo-status`;

            if (badge) {
                badge.className = `badge ${accessAllowed ? 'premium' : 'free'} beta-combo`;
                badge.textContent = accessAllowed
                    ? `${(planInfo.name || 'Beta').toUpperCase()}${planInfo.status ? ' • ' + String(planInfo.status).toUpperCase() : ''}`
                    : `BETA • ${String(planInfo.status || 'NON ATTIVO').toUpperCase()}`;
            }

            licenseStatus.title = [planInfo.status, planInfo.remaining].filter(Boolean).join(' — ');
        };


        window.app.normalizePremiumModalUI = () => {
            const modal = document.getElementById('premiumModal');
            if (!modal) return;

            modal.querySelectorAll('[data-i18n]').forEach((el) => {
                const key = el.getAttribute('data-i18n');
                if (!key || !window.app?.t) return;
                const value = window.app.t(key);
                if (typeof value === 'string') {
                    const isSubtitle = el.classList.contains('premium-modal-subtitle');
                    el.textContent = isSubtitle ? value : value.replace(/^[^\p{L}\p{N}]+/u, '').trim();
                }
            });

            const setText = (selector, value) => {
                const el = modal.querySelector(selector);
                if (el && typeof value === 'string') el.textContent = value;
            };

            setText('.premium-modal-subtitle', window.app.t ? window.app.t('premiumSubtitle') : '');
            setText('.premium-plan-card--free .premium-plan-chip', window.app.t ? window.app.t('currentChip') : 'Current');
            setText('.premium-plan-card--premium .premium-plan-chip--accent', window.app.t ? window.app.t('recommendedChip') : 'Recommended');
            setText('#startTrialBtn', window.app.t ? window.app.t('startTrial').replace(/^[^\p{L}\p{N}]+/u, '').trim() : 'Start Free Trial');
            setText('#activateLicenseBtn', window.app.t ? window.app.t('activateLicense').replace(/^[^\p{L}\p{N}]+/u, '').trim() : 'Activate License');
            setText('#closePremiumBtn', window.app.t ? window.app.t('maybeLater').replace(/^[^\p{L}\p{N}]+/u, '').trim() : 'Maybe later');
            const closeAiBtn = document.getElementById('dismissAiSuggestion');
            if (closeAiBtn && window.app.t) closeAiBtn.textContent = window.app.t('close');
        };

        window.app.showPremiumModal = () => {
            const modal = document.getElementById('premiumModal');
            if (modal) {
                if (typeof window.app.normalizePremiumModalUI === 'function') {
                    window.app.normalizePremiumModalUI();
                }
                modal.style.display = 'flex';
                modal.classList.add('active');
            }
        };

        window.app.hidePremiumModal = () => {
            const modal = document.getElementById('premiumModal');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
            }
        };

        window.app.showLicenseModal = () => {
            window.app.hidePremiumModal();
            const modal = document.getElementById('licenseModal');
            if (modal) {
                modal.style.display = 'flex';
                modal.classList.add('active');
            }
        };

        window.app.hideLicenseModal = () => {
            const modal = document.getElementById('licenseModal');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
            }
        };

        window.app.startTrial = async () => {
            if (window.app.license.startTrial()) {
                window.app.showToast(window.app.t ? window.app.t('trialActivatedToast') : '🎁 Premium trial activated! 7 free days');
                window.app.updateLicenseStatus();
                window.app.hidePremiumModal();
                window.app.enablePremiumFeatures();
            } else {
                window.app.showToast(window.app.t ? window.app.t('trialUsedToast') : '⚠️ Trial already used');
            }
        };

        window.app.activateLicense = async () => {
            const email = document.getElementById('licenseEmail').value;
            const key = document.getElementById('licenseKey').value;
            
            if (!email || !key) {
                window.app.showToast(window.app.t ? window.app.t('fillFields') : '⚠️ Fill all fields');
                return;
            }
            
            if (await window.app.license.activateLicense(email, key)) {
                window.app.showToast(window.app.t ? window.app.t('licenseActivatedToast') : '✅ Premium license activated!');
                window.app.updateLicenseStatus();
                window.app.hideLicenseModal();
                window.app.enablePremiumFeatures();
            } else {
                window.app.showToast(window.app.t ? window.app.t('licenseInvalidToast') : '❌ Invalid license');
            }
        };

        window.app.enablePremiumFeatures = () => {
            document.querySelectorAll('.feature-locked').forEach(el => {
                el.classList.remove('feature-locked');
            });
            
            const banner = document.getElementById('premiumBanner');
            if (banner) {
                banner.style.display = 'none';
            }
        };

        window.app.showPremiumBannerIfNeeded = () => {
            if (!window.app.license) {
                console.warn('⚠️ License system non disponibile - banner non mostrato');
                return;
            }
            
            const banner = document.getElementById('premiumBanner');
            if (banner && !window.app.license.hasFullPremiumAccess()) {
                banner.style.display = 'block';
            }
        };

        window.app.checkFeatureLimit = (feature, currentCount = 0) => {
            if (!window.app.license) {
                console.warn('⚠️ License system non disponibile - feature check fallback');
                return true;
            }
            
            if (!window.app.license.canUseFeature(feature)) {
                window.app.showUpgradePrompt(feature);
                return false;
            }
            
            if (feature === 'transactions' && !window.app.license.canAddTransaction(currentCount)) {
                window.app.showToast(window.app.t ? window.app.t('freeLimitToast', { count: window.app.license.getCurrentLimits().maxTransactions }) : `⚠️ You reached the limit of ${window.app.license.getCurrentLimits().maxTransactions} transactions (Free version)`);
                window.app.showUpgradePrompt('transactions');
                return false;
            }
            
            return true;
        };

        window.app.showUpgradePrompt = (feature) => {
            const message = window.app.license.getUpgradeMessage(feature);
            const prompt = document.createElement('div');
            prompt.className = 'upgrade-prompt';
            prompt.innerHTML = `
                <h4>🔒 ${message}</h4>
                <p>${window.app.t ? window.app.t('upgradeToUnlock') : 'Upgrade to Premium to unlock this feature!'}</p>
                <button onclick="window.app.showPremiumModal()">💎 ${window.app.t ? window.app.t('upgradeNow') : 'Upgrade now'}</button>
            `;
            
            const container = document.querySelector('.container');
            if (container) {
                container.appendChild(prompt);
                
                setTimeout(() => {
                    if (prompt.parentNode) {
                        prompt.parentNode.removeChild(prompt);
                    }
                }, 5000);
            }
        };

        window.app.setupPremiumEventListeners = () => {
            // Upgrade button
            const upgradeBtn = document.getElementById('upgradeBtn');
            if (upgradeBtn) {
                upgradeBtn.replaceWith(upgradeBtn.cloneNode(true));
                const newUpgradeBtn = document.getElementById('upgradeBtn');
                newUpgradeBtn.addEventListener('click', () => window.app.showPremiumModal());
            }
            
            // Premium modal buttons
            const startTrialBtn = document.getElementById('startTrialBtn');
            if (startTrialBtn) {
                startTrialBtn.replaceWith(startTrialBtn.cloneNode(true));
                const newStartTrialBtn = document.getElementById('startTrialBtn');
                newStartTrialBtn.addEventListener('click', () => window.app.startTrial());
            }
            
            const activateLicenseBtn = document.getElementById('activateLicenseBtn');
            if (activateLicenseBtn) {
                activateLicenseBtn.replaceWith(activateLicenseBtn.cloneNode(true));
                const newActivateLicenseBtn = document.getElementById('activateLicenseBtn');
                newActivateLicenseBtn.addEventListener('click', () => window.app.showLicenseModal());
            }
            
            const closePremiumBtn = document.getElementById('closePremiumBtn');
            if (closePremiumBtn) {
                closePremiumBtn.replaceWith(closePremiumBtn.cloneNode(true));
                const newClosePremiumBtn = document.getElementById('closePremiumBtn');
                newClosePremiumBtn.addEventListener('click', () => window.app.hidePremiumModal());
            }
            
            // License modal buttons
            const confirmLicenseBtn = document.getElementById('confirmLicenseBtn');
            if (confirmLicenseBtn) {
                confirmLicenseBtn.replaceWith(confirmLicenseBtn.cloneNode(true));
                const newConfirmLicenseBtn = document.getElementById('confirmLicenseBtn');
                newConfirmLicenseBtn.addEventListener('click', () => window.app.activateLicense());
            }
            
            const cancelLicenseBtn = document.getElementById('cancelLicenseBtn');
            if (cancelLicenseBtn) {
                cancelLicenseBtn.replaceWith(cancelLicenseBtn.cloneNode(true));
                const newCancelLicenseBtn = document.getElementById('cancelLicenseBtn');
                newCancelLicenseBtn.addEventListener('click', () => window.app.hideLicenseModal());
            }
        };

        window.app.setupPremiumSystem = () => {
            window.app.updateLicenseStatus();
            window.app.setupPremiumEventListeners();
            window.app.showPremiumBannerIfNeeded();
            window.app.premiumSetupDone = true;
        };

        // Avvia Premium system
        setTimeout(() => {
            if (window.app && typeof window.app.setupPremiumSystem === "function") {
                window.app.setupPremiumSystem();
            }
        }, 150);
    }
}

// Esegui setup dopo l'inizializzazione dell'app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupImportHandlers);
} else {
    setTimeout(setupImportHandlers, 100);
}



// ===== STEP 6.3.8 Monthly Balance Trend integrated stable patch =====


// ======== WiseForecast Advanced Module (v142) ========
Kedrix.prototype.calculateWiseForecastAdvanced = function(){
    try{

        const incomes = this.data.incomes || [];
        const fixed = this.data.fixedExpenses || [];
        const vars = Object.values(this.data.variableExpenses || {}).flat ? Object.values(this.data.variableExpenses || {}).flat() : [];

        const totalIncome = incomes.reduce((a,b)=>a+(Number(b.amount)||0),0);

        const totalVar = vars.reduce((a,b)=>a+(Number(b.amount)||0),0);

        const today = new Date();
        today.setHours(0,0,0,0);
        const start = new Date(this.normalizeIsoDate(this.data.periodStart));
        const end = new Date(this.normalizeIsoDate(this.data.periodEnd));
        if (!isNaN(start.getTime())) start.setHours(0,0,0,0);
        if (!isNaN(end.getTime())) end.setHours(0,0,0,0);

        const msPerDay = 86400000;
        const daysPassed = !isNaN(start.getTime()) ? Math.max(0, Math.floor((today - start) / msPerDay)) : 0;
        const daysRemaining = !isNaN(end.getTime()) ? Math.max(0, Math.floor((end - today) / msPerDay) + 1) : 0;

        const avgDaily = daysPassed > 0 ? totalVar / daysPassed : 0;

        const predictedFixed = fixed
            .filter(f => !f.paid)
            .reduce((a,b)=>a+(Number(b.amount)||0),0);

        const currentBalance = totalIncome - totalVar;

        const predictedEnd =
            currentBalance - (avgDaily * daysRemaining) - predictedFixed;

        let risk = "green";
        let riskLabel = this.t('wiseForecastAdvancedRiskGreen');

        if(predictedEnd < 0){
            risk = "danger";
            riskLabel = this.t('wiseForecastAdvancedRiskDanger');
        }else if(predictedEnd < totalIncome*0.1){
            risk = "warning";
            riskLabel = this.t('wiseForecastAdvancedRiskWarning');
        }

        return {
            currentBalance,
            avgDaily,
            daysRemaining,
            predictedFixed,
            predictedEnd,
            risk,
            riskLabel
        };

    }catch(e){
        console.warn("WiseForecast error",e);
        return null;
    }
};

Kedrix.prototype.renderWiseForecastCard = function(){

    const el = document.getElementById("wiseForecastCard");
    if(!el) return;

    const data = this.calculateWiseForecastAdvanced();
    if(!data) return;

    el.innerHTML = `
        <div class="bw-card">
            <h3>${this.t('wiseForecastTitle')}</h3>

            <div class="bw-forecast-main">
                <div class="bw-forecast-value">€ ${data.predictedEnd.toFixed(2)}</div>
                <div class="bw-forecast-risk ${data.risk}">${data.riskLabel}</div>
            </div>

            <div class="bw-forecast-grid">
                <div>${this.t('wiseForecastAdvancedDailyAverage')}</div>
                <div>€ ${data.avgDaily.toFixed(2)}</div>

                <div>${this.t('wiseForecastAdvancedDaysRemaining')}</div>
                <div>${data.daysRemaining}</div>

                <div>${this.t('wiseForecastAdvancedFixedPlanned')}</div>
                <div>€ ${data.predictedFixed.toFixed(2)}</div>
            </div>

            <div class="bw-forecast-sim">
                <label>${this.t('wiseForecastAdvancedSimulateReduction')}</label>
                <input type="range" id="wfSlider" min="0" max="10" step="1" value="0">
                <div id="wfSimResult"></div>
            </div>
        </div>
    `;

    const slider = el.querySelector("#wfSlider");
    const sim = el.querySelector("#wfSimResult");

    const renderSimulation = () => {
        const reduce = Number(slider.value);
        const newAvg = Math.max(0,data.avgDaily - reduce);
        const newPred = data.currentBalance - (newAvg * data.daysRemaining) - data.predictedFixed;
        sim.innerHTML = `${this.t('wiseForecastAdvancedNewForecast')}: € ${newPred.toFixed(2)}`;
    };

    slider.addEventListener("input", renderSimulation);
    renderSimulation();

};

// Hook render
document.addEventListener("DOMContentLoaded", ()=>{
    setTimeout(()=>{
        if(window.app && window.app.renderWiseForecastCard){
            window.app.renderWiseForecastCard();
        }
    },1200);
});


/* ===== Monthly Balance Trend hotfix ===== */
(function(){
    function toMonthKey(value){
        if(!value) return null;
        const d = new Date(value);
        if(Number.isNaN(d.getTime())) return null;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    }

    function monthLabelFromKey(key){
        if(!key || typeof key !== 'string' || !key.includes('-')) return key || '';
        const [y, m] = key.split('-');
        const d = new Date(Number(y), Number(m) - 1, 1);
        try {
            return d.toLocaleDateString((document.documentElement.lang || 'it-IT'), { month: 'short', year: 'numeric' });
        } catch (_) {
            return key;
        }
    }

    Kedrix.prototype.getMonthlyBalanceSeries = function(){
        const monthlyMap = {};
        const addValue = (dateValue, amount) => {
            const monthKey = toMonthKey(dateValue);
            const numeric = Number(amount || 0);
            if(!monthKey || !Number.isFinite(numeric)) return;
            monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + numeric;
        };

        const incomes = Array.isArray(this.data && this.data.incomes) ? this.data.incomes : [];
        incomes.forEach((income) => addValue(income && income.date, income && income.amount));

        const variableExpenses = this.data && this.data.variableExpenses && typeof this.data.variableExpenses === 'object'
            ? this.data.variableExpenses
            : {};
        Object.entries(variableExpenses).forEach(([dateKey, dayExpenses]) => {
            if(!Array.isArray(dayExpenses)) return;
            dayExpenses.forEach((expense) => addValue((expense && expense.date) || dateKey, -Math.abs(Number(expense && expense.amount || 0))));
        });

        const keys = Object.keys(monthlyMap).sort();
        return {
            keys,
            labels: keys.map(monthLabelFromKey),
            values: keys.map((key) => Number(monthlyMap[key] || 0))
        };
    };

    Kedrix.prototype.updateMonthlyBalanceChart = function(){
        const canvas = document.getElementById('monthlyBalanceChart');
        const noteEl = document.getElementById('monthlyBalanceChartNote');
        const emptyEl = document.getElementById('monthlyBalanceEmpty');
        const card = document.getElementById('monthlyBalanceChartCard');
        if(!canvas || !card) return;

        const wrapper = canvas.closest('.chart-container');
        const series = this.getMonthlyBalanceSeries();
        const hasData = Array.isArray(series.values) && series.values.some((value) => Number.isFinite(value) && Math.abs(value) > 0.009);

        if(this.monthlyBalanceChart){
            this.monthlyBalanceChart.destroy();
            this.monthlyBalanceChart = null;
        }

        if(!hasData){
            if(wrapper) wrapper.style.display = 'none';
            if(noteEl) noteEl.style.display = 'none';
            if(emptyEl) emptyEl.style.display = 'block';
            return;
        }

        if(wrapper) wrapper.style.display = '';
        if(noteEl) noteEl.style.display = 'block';
        if(emptyEl) emptyEl.style.display = 'none';

        const rootStyles = getComputedStyle(document.documentElement);
        const accentColor = (rootStyles.getPropertyValue('--accent') || '#38bdf8').trim();
        const textSecondary = (rootStyles.getPropertyValue('--text-secondary') || '#94a3b8').trim();
        const borderColor = (rootStyles.getPropertyValue('--border') || 'rgba(148,163,184,0.18)').trim();
        const successColor = (rootStyles.getPropertyValue('--success') || '#22c55e').trim();
        const dangerColor = (rootStyles.getPropertyValue('--danger') || '#ef4444').trim();
        const ctx = canvas.getContext('2d');
        const positiveColor = successColor;
        const negativeColor = dangerColor;
        const baseColor = accentColor;
        const datasetColor = series.values.length === 1 ? baseColor : baseColor;

        this.monthlyBalanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: series.labels,
                datasets: [{
                    label: this.t ? this.t('monthlyBalanceDataset') : 'Monthly balance',
                    data: series.values,
                    borderColor: datasetColor,
                    backgroundColor: 'rgba(56, 189, 248, 0.16)',
                    fill: true,
                    tension: 0.32,
                    borderWidth: 2.4,
                    pointRadius: series.values.length === 1 ? 4 : 2.5,
                    pointHoverRadius: series.values.length === 1 ? 5 : 4,
                    pointBackgroundColor: series.values.map((value) => value >= 0 ? positiveColor : negativeColor),
                    pointBorderColor: series.values.map((value) => value >= 0 ? positiveColor : negativeColor),
                    pointBorderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 220 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        displayColors: false,
                        backgroundColor: 'rgba(8, 15, 30, 0.94)',
                        borderColor: 'rgba(56, 189, 248, 0.25)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: (context) => `${context.label}: ${this.formatCurrency(context.raw || 0)}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textSecondary, maxRotation: 0, autoSkip: true },
                        grid: { display: false },
                        border: { color: borderColor }
                    },
                    y: {
                        ticks: {
                            color: textSecondary,
                            callback: (value) => this.formatCurrency(value)
                        },
                        grid: { color: 'rgba(148, 163, 184, 0.12)' },
                        border: { color: borderColor }
                    }
                }
            }
        });
    };

    const originalUpdateChart = Kedrix.prototype.updateChart;
    Kedrix.prototype.updateChart = function(){
        const result = originalUpdateChart.apply(this, arguments);
        try {
            this.updateMonthlyBalanceChart();
        } catch (error) {
            console.warn('Monthly trend render error', error);
        }
        return result;
    };

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if(window.app && typeof window.app.updateMonthlyBalanceChart === 'function') {
                try {
                    window.app.updateMonthlyBalanceChart();
                } catch (error) {
                    console.warn('Monthly trend delayed render error', error);
                }
            }
        }, 900);
    });
})();

// ===============================
// Kedrix Multi-Tab Sync Guard
// Soft UI sync on external data updates
// ===============================
(function KedrixMultiTabSync(){
    try {
        let syncTimer = null;
        let lastPayload = null;

        window.addEventListener('storage', function(e){
            try {
                if (!e) return;
                if (e.storageArea !== localStorage) return;
                if (e.key !== 'kedrix-data') return;
                if (e.newValue === e.oldValue) return;
                if (!window.app || typeof window.app.loadData !== 'function') return;
                if (e.newValue && e.newValue === lastPayload) return;

                lastPayload = e.newValue || null;
                if (syncTimer) clearTimeout(syncTimer);

                syncTimer = setTimeout(function(){
                    try {
                        window.app.loadData();
                        if (typeof window.app.updateUI === 'function') window.app.updateUI();
                        if (typeof window.app.updateChart === 'function') window.app.updateChart();
                        if (typeof window.app.applyLanguage === 'function') window.app.applyLanguage();
                        if (typeof window.app.showToast === 'function') {
                            window.app.showToast(window.app.t ? (window.app.t('externalUpdateSynced') || 'Dati sincronizzati da un altro tab') : 'Dati sincronizzati da un altro tab', 'info');
                        }
                    } catch (err) {
                        console.warn('Kedrix multi-tab soft sync failed', err);
                    }
                }, 120);
            } catch (err) {
                console.warn('Kedrix storage event handling error', err);
            }
        });
    } catch (err) {
        console.warn('Kedrix multi-tab listener init error', err);
    }
})();



/* === KEDRIX BETA ANALYTICS CLEANUP PATCH (DEDUP + SESSION + DEVICE NORMALIZATION) === */
(function () {
  const REGISTRY_KEY = 'kedrix-beta-registry';
  const SESSION_KEY = 'kedrix-beta-session-id';
  const LAST_EVENT_KEY = 'kedrix-beta-last-event';
  const LAST_HIDDEN_SYNC_KEY = 'kedrix-beta-last-hidden-sync';
  const LAST_BEFOREUNLOAD_SYNC_KEY = 'kedrix-beta-last-beforeunload-sync';

  function nowIso() {
    try { return new Date().toISOString(); } catch (e) { return ''; }
  }

  function nowMs() {
    try { return Date.now(); } catch (e) { return 0; }
  }

  function safeParse(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (_) {
    return fallback;
  }
}

  function inferDevice(ua, maxTouch) {
    const lower = String(ua || '').toLowerCase();
    const isIPhone = /iphone/.test(lower);
    const isIPad = /ipad/.test(lower) || (/macintosh/.test(lower) && Number(maxTouch || 0) > 1);
    const isAndroid = /android/.test(lower);
    const isWindows = /windows/.test(lower);
    const isMac = /mac os x|macintosh/.test(lower) && !isIPhone && !isIPad;
    return {
      deviceFamily: isIPhone ? 'iphone' : isIPad ? 'ipad' : isAndroid ? 'android' : isWindows ? 'windows-desktop' : isMac ? 'mac-desktop' : 'unknown',
      osFamily: isIPhone || isIPad ? 'ios' : isAndroid ? 'android' : isWindows ? 'windows' : isMac ? 'macos' : 'unknown'
    };
  }

  function inferBrowser(ua) {
    const lower = String(ua || '').toLowerCase();
    if (lower.includes('edg/')) return 'edge';
    if (lower.includes('chrome/') && !lower.includes('edg/')) return 'chrome';
    if (lower.includes('safari/') && !lower.includes('chrome/')) return 'safari';
    if (lower.includes('firefox/')) return 'firefox';
    return 'unknown';
  }

  function normalizePlatform(rawPlatform, ua, maxTouch) {
    const inferred = inferDevice(ua, maxTouch);
    const p = String(rawPlatform || '').trim();
    if (inferred.osFamily === 'ios') return 'iOS';
    if (inferred.osFamily === 'android') return 'Android';
    if (p) return p;
    if (inferred.osFamily === 'windows') return 'Windows';
    if (inferred.osFamily === 'macos') return 'macOS';
    return 'unknown';
  }

  function isStandalone() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    } catch (e) {
      return false;
    }
  }

  function getDeviceInfoNormalized() {
    const ua = navigator.userAgent || '';
    const rawPlatform = navigator.platform || '';
    const maxTouch = navigator.maxTouchPoints || 0;
    const inferred = inferDevice(ua, maxTouch);
    return {
      ua,
      platform: normalizePlatform(rawPlatform, ua, maxTouch),
      rawPlatform,
      maxTouch,
      standalone: isStandalone(),
      screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
      deviceFamily: inferred.deviceFamily,
      osFamily: inferred.osFamily,
      browserFamily: inferBrowser(ua)
    };
  }

  function getLangSafe() {
    try {
      return window.KedrixI18n
             ? window.KedrixI18n.resolveRuntimeLanguage(window.app || window.KedrixApp || null)
             : ((window.app && window.app.data && window.app.data.language) ||
                (window.KedrixApp && window.KedrixApp.data && window.KedrixApp.data.language) ||
                document.getElementById('languageSelect')?.value ||
                localStorage.getItem('bw-language') ||
                'it');
    } catch (e) {
      return 'it';
    }
  }

  function getBuildSafe() {
    try {
      if (typeof KEDRIX_BUILD !== 'undefined') return KEDRIX_BUILD;
    } catch (e) {}
    return 'unknown';
  }

  function getChannelSafe() {
    try {
      if (typeof KEDRIX_RELEASE_CHANNEL !== 'undefined') return KEDRIX_RELEASE_CHANNEL;
    } catch (e) {}
    return 'beta';
  }

  function loadRegistry() {
    const fallback = {
      sessionId: getSessionId(),
      eventVersion: 2,
      lastSeenAt: nowIso(),
      language: getLangSafe(),
      build: getBuildSafe(),
      channel: getChannelSafe(),
      device: getDeviceInfoNormalized(),
      eventLog: []
    };
    const current = safeParse(localStorage.getItem(REGISTRY_KEY), fallback) || fallback;
    current.sessionId = getSessionId();
    current.eventVersion = 2;
    current.device = getDeviceInfoNormalized();
    current.language = getLangSafe();
    current.build = getBuildSafe();
    current.channel = getChannelSafe();
    if (!Array.isArray(current.eventLog)) current.eventLog = [];
    return current;
  }

  function saveRegistry(registry) {
    try {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    } catch (e) {}
  }

  function shouldTrackEvent(type, extra) {
    const stamp = nowMs();
    const last = safeParse(sessionStorage.getItem(LAST_EVENT_KEY), null);
    const key = JSON.stringify({
      type,
      path: window.location.pathname,
      standalone: isStandalone(),
      language: getLangSafe(),
      extra: extra || {}
    });

    // hard dedupe exact same event within 4 seconds
    if (last && last.key === key && (stamp - Number(last.at || 0)) < 4000) {
      return false;
    }

    sessionStorage.setItem(LAST_EVENT_KEY, JSON.stringify({ key, at: stamp }));
    return true;
  }

  function appendCleanEvent(type, extra) {
    if (!shouldTrackEvent(type, extra)) return null;
    const registry = loadRegistry();
    registry.lastSeenAt = nowIso();
    registry.device = getDeviceInfoNormalized();
    registry.eventLog.push({
      type,
      at: nowIso(),
      sessionId: getSessionId(),
      path: window.location.pathname,
      standalone: registry.device.standalone,
      language: registry.language,
      extra: extra || {}
    });
    if (registry.eventLog.length > 30) registry.eventLog = registry.eventLog.slice(-30);
    saveRegistry(registry);
    return registry;
  }

  function shouldAllowSync(kind, minGapMs) {
    const key = kind === 'visibility_hidden' ? LAST_HIDDEN_SYNC_KEY : LAST_BEFOREUNLOAD_SYNC_KEY;
    const last = Number(sessionStorage.getItem(key) || 0);
    const now = nowMs();
    if (now - last < minGapMs) return false;
    sessionStorage.setItem(key, String(now));
    return true;
  }

  function patchCentralSync() {
    if (!window.KedrixCentralBetaRegistry || window.KedrixCentralBetaRegistry.__analyticsCleanupPatched) return;

    const originalSync = window.KedrixCentralBetaRegistry.sync?.bind(window.KedrixCentralBetaRegistry);
    if (typeof originalSync !== 'function') return;

    window.KedrixCentralBetaRegistry.sync = async function(reason) {
      const cleanReason = reason || 'manual';
      if (cleanReason === 'visibility_hidden' && !shouldAllowSync(cleanReason, 20000)) return false;
      if (cleanReason === 'beforeunload' && !shouldAllowSync(cleanReason, 15000)) return false;

      const registry = appendCleanEvent(
        cleanReason === 'manual-test' ? 'manual_sync' :
        cleanReason === 'visibility_hidden' ? 'app_background' :
        cleanReason === 'beforeunload' ? 'app_exit' :
        cleanReason === 'boot' ? 'app_boot_sync' : cleanReason,
        { syncReason: cleanReason }
      );

      return originalSync(cleanReason);
    };

    window.KedrixCentralBetaRegistry.__analyticsCleanupPatched = true;
  }

  function patchLocalTrackers() {
    // mark launch session cleanly once per boot without touching existing logic
    appendCleanEvent('session_start', {
      standalone: isStandalone(),
      browserFamily: getDeviceInfoNormalized().browserFamily,
      deviceFamily: getDeviceInfoNormalized().deviceFamily
    });
  }

  function bootstrapCleanup() {
    patchLocalTrackers();

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      patchCentralSync();
      if (window.KedrixCentralBetaRegistry || attempts > 30) clearInterval(timer);
    }, 500);
  }

  bootstrapCleanup();
})();



/* ===== KEDRIX TRACKING INTELLIGENCE PATCH ===== */
(function () {
  if (window.__KEDRIX_TRACKING_PATCH_APPLIED__) return;
  window.__KEDRIX_TRACKING_PATCH_APPLIED__ = true;

  const KEDRIX_TRACKING_ENDPOINT = (window.KedrixRuntimeConfig && typeof window.KedrixRuntimeConfig.getEndpoint === 'function')
    ? window.KedrixRuntimeConfig.getEndpoint('tracking')
    : 'https://script.google.com/macros/s/AKfycbxNM0y7ohRqW3r5c4rUP3chtvf-e-0fe3KHuZ04nLmmQzCxz4WaYy1OmATcHw08CWqG/exec';

  const normalizeEndpoint = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/\/exec(?:\?|#|$)/.test(raw)) return raw;
    if (/script\.google\.com\/macros\/s\//.test(raw)) return raw.replace(/\/?$/, '/exec');
    return raw;
  };

  const getEndpoint = () => {
    const candidates = [
      window.KEDRIX_REGISTRY_ENDPOINT,
      window.KEDRIX_TRACKING_ENDPOINT,
      localStorage.getItem('kedrix_registry_endpoint'),
      localStorage.getItem('kedrix_tracking_endpoint'),
      document.documentElement && document.documentElement.getAttribute('data-kedrix-endpoint'),
      KEDRIX_TRACKING_ENDPOINT
    ];

    for (const candidate of candidates) {
      const normalized = normalizeEndpoint(candidate);
      if (normalized) {
        try {
          localStorage.setItem('kedrix_registry_endpoint', normalized);
          localStorage.setItem('kedrix_tracking_endpoint', normalized);
        } catch (_err) {}
        return normalized;
      }
    }

    return '';
  };

  const getAppRef = () => window.app || window.KedrixApp || null;

  const ensureFirstSeen = () => {
    if (!localStorage.getItem('first_seen_at')) {
      localStorage.setItem('first_seen_at', new Date().toISOString());
    }
  };

  const incrementCounter = (key) => {
    const next = Number(localStorage.getItem(key) || 0) + 1;
    localStorage.setItem(key, String(next));
    return next;
  };

  const safeFetch = async (url, payload) => {
    if (!url) return { ok: false, skipped: true, reason: 'missing-endpoint' };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        keepalive: true,
        mode: 'cors',
        credentials: 'omit'
      });

      const rawText = await response.text().catch(() => '');
      let parsed = null;
      if (rawText) {
        try {
          parsed = JSON.parse(rawText);
        } catch (_err) {
          parsed = null;
        }
      }

      return {
        ok: response.ok,
        status: response.status,
        data: parsed,
        rawText
      };
    } catch (err) {
      console.warn('Kedrix tracking fetch failed', err);
      return null;
    }
  };

  async function trackEvent(eventName, extra = {}) {
    try {
      ensureFirstSeen();
      const app = getAppRef();
      const endpoint = getEndpoint();
      const language = (app && app.data && app.data.language) || document.documentElement.lang || 'it';
      const build = (typeof KEDRIX_BUILD !== 'undefined' && KEDRIX_BUILD) || (app && app.build) || 'unknown';
      const channel = (typeof KEDRIX_RELEASE_CHANNEL !== 'undefined' && KEDRIX_RELEASE_CHANNEL) || 'beta';
      const testerId = localStorage.getItem('tester_id') || '';
      const sessionId = getSessionId() || localStorage.getItem('tester_id') || ''; // unified via KedrixSessionManager
      const licenseEmail = localStorage.getItem('license_email') || '';

      const payload = {
        source: 'kedrix_app',
        reason: eventName,
        syncedAt: new Date().toISOString(),
        record: {
          testerId,
          sessionId,
          licenseEmail,
          build,
          channel,
          language,
          firstSeenAt: localStorage.getItem('first_seen_at') || '',
          lastSeenAt: new Date().toISOString(),
          launchCount: Number(localStorage.getItem('launch_count') || 0),
          feedbackCount: Number(localStorage.getItem('feedback_count') || 0),
          device: {
            standalone: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
            screen: `${window.screen.width}x${window.screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            platform: navigator.platform || '',
            deviceFamily: /mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            osFamily: navigator.userAgent || '',
            browserFamily: navigator.userAgent || '',
            ua: navigator.userAgent || ''
          },
          primaAzioneCompletata: localStorage.getItem('prima_azione') || 'no',
          tempoPrimoValore: localStorage.getItem('tempo_primo_valore') || '',
          tipoFeedback: extra.tipoFeedback || '',
          qualitaFeedback: extra.qualitaFeedback || '',
          categoriaFeedback: extra.categoriaFeedback || '',
          messaggioFeedback: extra.messaggioFeedback || '',
          attritoRilevato: extra.attritoRilevato || ''
        }
      };

      return await safeFetch(endpoint, payload);
    } catch (e) {
      console.warn('Tracking error', e);
      return null;
    }
  }

  function ensureSessionId() {
    const existing = getSessionId();
    if (existing) return existing;

    try {
      if (window.KedrixSessionManager && typeof window.KedrixSessionManager.getSessionId === 'function') {
        return window.KedrixSessionManager.getSessionId();
      }
    } catch (_e) {}

    return '';
  }

  function markFirstActionCompleted() {
    if (localStorage.getItem('prima_azione') === 'si') return;
    localStorage.setItem('prima_azione', 'si');
    const startedAt = Number(localStorage.getItem('kedrix_start_time') || Date.now());
    const delta = Date.now() - startedAt;
    let tempo = '3+ min';
    if (delta < 60000) tempo = '<1 min';
    else if (delta < 180000) tempo = '1-3 min';
    localStorage.setItem('tempo_primo_valore', tempo);
    trackEvent('prima_azione_completata');
  }

  ensureSessionId();
  ensureFirstSeen();
  localStorage.setItem('kedrix_start_time', String(Date.now()));
  incrementCounter('launch_count');
  trackEvent('app_aperta');

  window.addEventListener('appinstalled', function () {
    trackEvent('app_installata');
  });

  window.addEventListener('error', function () {
    trackEvent('errore', { attritoRilevato: 'tecnico' });
  });

  window.addEventListener('beforeunload', function () {
    const launches = Number(localStorage.getItem('launch_count') || 0);
    if (launches <= 2 && localStorage.getItem('prima_azione') !== 'si') {
      trackEvent('uscita_precoce', { attritoRilevato: 'comprensione' });
    }
  });

  document.addEventListener('submit', function (ev) {
    const form = ev.target;
    if (form && (form.id === 'incomeForm' || form.id === 'fixedExpenseForm' || form.id === 'expenseForm')) {
      markFirstActionCompleted();
    }
  }, true);

  window.KedrixTracking = {
    trackEvent,
    markFirstActionCompleted,
    incrementCounter
  };
})();
/* ===== /KEDRIX TRACKING INTELLIGENCE PATCH ===== */
