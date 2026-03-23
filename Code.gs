const RAW_SHEET_NAME = 'REGISTRO';
const LEGACY_RAW_SHEET_NAME = 'Registry';
const CRM_SHEET_NAME = 'TESTER_CRM';
const KPI_SHEET_NAME = 'KPI';
const EVENTS_SHEET_NAME = 'EVENTI_TRACKING';
const FEEDBACK_SHEET_NAME = 'FEEDBACK';
const LICENSES_SHEET_NAME = 'LICENSES';
const BETA_REQUESTS_SHEET_NAME = 'BETA_REQUESTS';
const SPREADSHEET_ID = '1-dCY39nipXvI8E9ujnwnGTyy_2Oo0cncwatB3gDJGOk';

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = normalizeAction_(params.action || 'health');

    if (action === 'check_license') {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      return jsonResponse_(checkLicenseAction_({
        email: params.email || params.user_email || '',
        testerId: params.testerId || params.tester_id || '',
        licenseKey: params.licenseKey || params.license_key || '',
        source: params.source || 'web'
      }, ss));
    }

    return jsonResponse_({
      ok: true,
      endpoint: 'active',
      method: 'GET',
      message: 'Kedrix tracking endpoint attivo'
    });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const action = normalizeAction_(payload.action || payload.type || payload.event || '');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (action === 'register_beta_request') {
      return jsonResponse_(registerBetaRequestAction_(payload, ss));
    }

    if (action === 'check_license') {
      return jsonResponse_(checkLicenseAction_(payload, ss));
    }

    return jsonResponse_(handleTrackingAction_(payload, ss));
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}

function handleTrackingAction_(payload, ss) {
  const rawSheet = getOrCreateSheet_(ss, RAW_SHEET_NAME, LEGACY_RAW_SHEET_NAME);
  ensureRegistroHeader_(rawSheet);

  const eventsSheet = getOrCreateSheet_(ss, EVENTS_SHEET_NAME);
  ensureEventsHeader_(eventsSheet);

  const feedbackSheet = getOrCreateSheet_(ss, FEEDBACK_SHEET_NAME);
  ensureFeedbackHeader_(feedbackSheet);

  const licensesSheet = getOrCreateSheet_(ss, LICENSES_SHEET_NAME);
  ensureLicensesHeader_(licensesSheet);

  const record = normalizeRecord_(payload);
  const device = normalizeDevicePayload_(record.device || {});

  const testerId = safeStr_(record.testerId);
  const reason = safeStr_(record.reason || payload.reason || payload.event || 'app_aperta');
  const syncedAt = safeStr_(record.syncedAt || payload.syncedAt || payload.timestamp);
  const sessionId = safeStr_(record.sessionId);
  const licenseEmail = normalizeEmail_(record.licenseEmail);
  const now = new Date();
  const eventName = mapEventName_(reason);

  if (isDuplicateRecent_(rawSheet, testerId, reason, syncedAt, sessionId)) {
    return { ok: true, skipped: true, duplicate: true };
  }

  rawSheet.appendRow([
    now,
    safeStr_(payload.source || record.source || 'kedrix-pwa'),
    reason,
    testerId,
    sessionId,
    licenseEmail,
    safeStr_(record.build),
    safeStr_(record.channel),
    safeStr_(record.language),
    safeStr_(record.firstSeenAt),
    safeStr_(record.lastSeenAt),
    toInt_(record.launchCount),
    toInt_(record.feedbackCount),
    truthyToSiNo_(device.standalone),
    safeStr_(device.screen),
    safeStr_(device.viewport),
    safeStr_(device.platform),
    safeStr_(device.deviceFamily),
    safeStr_(device.osFamily),
    safeStr_(device.browserFamily),
    safeStr_(device.ua),
    JSON.stringify(payload)
  ]);

  eventsSheet.appendRow([
    now,
    testerId,
    eventName,
    eventValueFromRecord_(record, reason),
    safeStr_(record.build),
    safeStr_(device.platform),
    safeStr_(device.deviceFamily),
    safeStr_(device.osFamily),
    safeStr_(device.browserFamily),
    safeStr_(device.ua),
    sessionId,
    safeStr_(payload.source || record.source || 'kedrix-pwa')
  ]);

  if (isFeedbackReason_(reason)) {
    feedbackSheet.appendRow([
      now,
      testerId,
      safeStr_(record.tipoFeedback) || 'feedback_app',
      safeStr_(record.messaggioFeedback),
      safeStr_(record.qualitaFeedback) || inferFeedbackQuality_(record),
      safeStr_(record.categoriaFeedback) || 'valore'
    ]);
  }

  if (licenseEmail || testerId) {
    touchLicenseAccess_(licensesSheet, {
      email: licenseEmail,
      testerId: testerId,
      lastAccessAt: now,
      note: reason
    });
  }

  syncTesterCrmFromRegistro_(ss);
  syncKpiFromCrm_(ss);
  SpreadsheetApp.flush();

  return {
    ok: true,
    written: true,
    raw_sheet: RAW_SHEET_NAME,
    crm_sheet: CRM_SHEET_NAME,
    kpi_sheet: KPI_SHEET_NAME,
    event_sheet: EVENTS_SHEET_NAME,
    feedback_sheet: FEEDBACK_SHEET_NAME,
    licenses_sheet: LICENSES_SHEET_NAME
  };
}

function registerBetaRequestAction_(payload, ss) {
  const requestsSheet = getOrCreateSheet_(ss, BETA_REQUESTS_SHEET_NAME);
  ensureBetaRequestsHeader_(requestsSheet);

  const licensesSheet = getOrCreateSheet_(ss, LICENSES_SHEET_NAME);
  ensureLicensesHeader_(licensesSheet);

  const email = normalizeEmail_(payload.email);
  const name = safeStr_(payload.name);
  const reason = safeStr_(payload.reason);
  const commitment = safeStr_(payload.commitment);
  const source = safeStr_(payload.source || 'kedrix-site');

  if (!email) {
    return { ok: false, error: 'email_required' };
  }

  const existingRequest = findRowByValue_(requestsSheet, 3, email);
  const now = new Date();

  if (existingRequest.rowIndex) {
    requestsSheet.getRange(existingRequest.rowIndex, 1, 1, 10).setValues([[
      existingRequest.values[0] || now,
      now,
      email,
      name || existingRequest.values[3] || '',
      reason || existingRequest.values[4] || '',
      commitment || existingRequest.values[5] || '',
      safeStr_(payload.status || existingRequest.values[6] || 'pending'),
      safeStr_(payload.batch || existingRequest.values[7] || ''),
      source,
      safeStr_(payload.note || existingRequest.values[9] || '')
    ]]);
  } else {
    requestsSheet.appendRow([
      now,
      now,
      email,
      name,
      reason,
      commitment,
      'pending',
      '',
      source,
      ''
    ]);
  }

  const existingLicense = findLicenseRow_(licensesSheet, { email: email, testerId: payload.testerId || '' });
  let testerId = existingLicense.license.tester_id || safeStr_(payload.testerId) || generateTesterId_();

  if (!existingLicense.rowIndex) {
    licensesSheet.appendRow([
      testerId,
      email,
      'pending',
      'beta',
      '',
      '',
      '',
      'no',
      '',
      now,
      '',
      source,
      '',
      now,
      now
    ]);
  } else {
    const rowIndex = existingLicense.rowIndex;
    const current = existingLicense.license;
    licensesSheet.getRange(rowIndex, 1, 1, 15).setValues([[
      current.tester_id || testerId,
      email || current.email,
      current.stato || 'pending',
      current.tipo_licenza || 'beta',
      current.data_attivazione || '',
      current.data_scadenza || '',
      current.batch || '',
      current.revocata_si_no || 'no',
      current.ultimo_accesso || '',
      current.ultimo_check || now,
      current.note || '',
      source || current.source || '',
      current.grace_days || '',
      current.created_at || now,
      now
    ]]);
    testerId = current.tester_id || testerId;
  }

  return {
    ok: true,
    action: 'register_beta_request',
    status: 'pending',
    tester_id: testerId,
    email: email,
    message: 'Richiesta beta registrata correttamente'
  };
}

function checkLicenseAction_(payload, ss) {
  const licensesSheet = getOrCreateSheet_(ss, LICENSES_SHEET_NAME);
  ensureLicensesHeader_(licensesSheet);

  const email = normalizeEmail_(payload.email || payload.licenseEmail || '');
  const testerId = safeStr_(payload.testerId || payload.licenseKey || '');

  const found = findLicenseRow_(licensesSheet, { email: email, testerId: testerId });
  const now = new Date();

  if (!found.rowIndex) {
    return {
      ok: false,
      action: 'check_license',
      license_status: 'missing',
      reason: 'license_not_found',
      access_allowed: false
    };
  }

  const rowIndex = found.rowIndex;
  const license = found.license;
  const status = resolveLicenseStatus_(license, now);
  const allowed = status === 'active';

  licensesSheet.getRange(rowIndex, 10).setValue(now);
  licensesSheet.getRange(rowIndex, 15).setValue(now);
  if (allowed) licensesSheet.getRange(rowIndex, 9).setValue(now);

  return {
    ok: allowed,
    action: 'check_license',
    access_allowed: allowed,
    license_status: status,
    tester_id: safeStr_(license.tester_id),
    email: safeStr_(license.email),
    license_type: safeStr_(license.tipo_licenza || 'beta'),
    batch: safeStr_(license.batch),
    expires_at: normalizeDateOutput_(license.data_scadenza),
    activated_at: normalizeDateOutput_(license.data_attivazione),
    role: mapRoleFromLicenseType_(license.tipo_licenza),
    message: licenseMessage_(status)
  };
}


function normalizeAction_(value) {
  const action = safeStr_(value).toLowerCase();
  const aliases = {
    license: 'check_license',
    activate_license: 'check_license',
    beta_request: 'register_beta_request',
    track: 'tracking',
    track_event: 'tracking',
    feedback: 'tracking'
  };
  return aliases[action] || action;
}

function getOrCreateSheet_(ss, primaryName, legacyName) {
  let sheet = ss.getSheetByName(primaryName);
  if (sheet) return sheet;

  if (legacyName) {
    sheet = ss.getSheetByName(legacyName);
    if (sheet) {
      sheet.setName(primaryName);
      return sheet;
    }
  }

  return ss.insertSheet(primaryName);
}

function ensureRegistroHeader_(sheet) {
  const expected = [
    'ricevuto_il', 'origine', 'motivo', 'tester_id', 'session_id', 'email_licenza',
    'versione_build', 'canale', 'lingua', 'primo_accesso_il', 'ultimo_accesso_il',
    'numero_aperture', 'numero_feedback', 'installato_app', 'schermo', 'viewport',
    'piattaforma', 'famiglia_dispositivo', 'famiglia_os', 'famiglia_browser',
    'user_agent', 'payload_json'
  ];

  const legacy = [
    'received_at', 'source', 'reason', 'tester_id', 'session_id', 'license_email',
    'build', 'channel', 'language', 'first_seen_at', 'last_seen_at', 'launch_count',
    'feedback_count', 'standalone', 'screen', 'viewport', 'platform', 'device_family',
    'os_family', 'browser_family', 'user_agent', 'payload_json'
  ];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    return;
  }

  const width = expected.length;
  const firstRow = sheet.getRange(1, 1, 1, width).getValues()[0].map(v => String(v || '').trim());
  const isExpected = expected.every((h, i) => firstRow[i] === h);
  if (isExpected) return;

  const isLegacy = legacy.every((h, i) => firstRow[i] === h);
  if (isLegacy) {
    sheet.getRange(1, 1, 1, width).setValues([expected]);
    return;
  }

  sheet.insertRowBefore(1);
  sheet.getRange(1, 1, 1, width).setValues([expected]);
}

function ensureCrmHeader_(sheet) {
  const expected = [
    'tester_id', 'nome', 'stato', 'tipo_tester', 'punteggio', 'priorità', 'segmento',
    'installato_app', 'numero_aperture', 'ritorno_giorno_1', 'ritorno_giorno_3',
    'ritorno_giorno_7', 'profondità_utilizzo', 'prima_azione_completata',
    'tempo_primo_valore', 'feedback_inviato', 'qualità_feedback', 'attrito_rilevato',
    'note_interne', 'lingua', 'dispositivo', 'browser', 'piattaforma', 'versione_build',
    'data_primo_accesso', 'ultima_attività'
  ];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    return;
  }

  const firstRow = sheet.getRange(1, 1, 1, expected.length).getValues()[0].map(v => String(v || '').trim());
  const mismatch = expected.some((h, i) => firstRow[i] !== h);
  if (mismatch) {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
  }
}

function ensureKpiHeader_(sheet) {
  const expected = ['metrica', 'valore'];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    return;
  }

  const firstRow = sheet.getRange(1, 1, 1, expected.length).getValues()[0].map(v => String(v || '').trim());
  const mismatch = expected.some((h, i) => firstRow[i] !== h);
  if (mismatch) {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
  }
}

function ensureEventsHeader_(sheet) {
  const expected = [
    'timestamp',
    'tester_id',
    'event_name',
    'event_value',
    'versione_build',
    'platform',
    'device_family',
    'os_family',
    'browser_family',
    'raw_user_agent',
    'session_id',
    'source'
  ];

  const legacy = ['timestamp', 'tester_id', 'evento', 'valore', 'versione_build', 'piattaforma'];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    return;
  }

  const width = Math.max(expected.length, legacy.length);
  const firstRow = sheet.getRange(1, 1, 1, width).getValues()[0].map(v => String(v || '').trim());
  const isExpected = expected.every((h, i) => firstRow[i] === h);
  if (isExpected) return;

  const isLegacy = legacy.every((h, i) => firstRow[i] === h);
  if (isLegacy) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    return;
  }

  sheet.insertRowBefore(1);
  sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
}

function ensureFeedbackHeader_(sheet) {
  const expected = ['timestamp', 'tester_id', 'tipo_feedback', 'messaggio', 'qualità_feedback', 'categoria'];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    return;
  }

  const firstRow = sheet.getRange(1, 1, 1, expected.length).getValues()[0].map(v => String(v || '').trim());
  const mismatch = expected.some((h, i) => firstRow[i] !== h);
  if (mismatch) {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
  }
}

function ensureLicensesHeader_(sheet) {
  const expected = [
    'tester_id',
    'email',
    'stato',
    'tipo_licenza',
    'data_attivazione',
    'data_scadenza',
    'batch',
    'revocata_si_no',
    'ultimo_accesso',
    'ultimo_check',
    'note',
    'source',
    'grace_days',
    'created_at',
    'updated_at'
  ];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    return;
  }

  const firstRow = sheet.getRange(1, 1, 1, expected.length).getValues()[0].map(v => String(v || '').trim());
  const mismatch = expected.some((h, i) => firstRow[i] !== h);
  if (mismatch) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
  }
}

function ensureBetaRequestsHeader_(sheet) {
  const expected = [
    'created_at',
    'updated_at',
    'email',
    'nome',
    'reason',
    'commitment',
    'status',
    'batch',
    'source',
    'note'
  ];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    return;
  }

  const firstRow = sheet.getRange(1, 1, 1, expected.length).getValues()[0].map(v => String(v || '').trim());
  const mismatch = expected.some((h, i) => firstRow[i] !== h);
  if (mismatch) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
  }
}

function isDuplicateRecent_(sheet, testerId, reason, syncedAt, sessionId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const startRow = Math.max(2, lastRow - 20);
  const values = sheet.getRange(startRow, 1, lastRow - startRow + 1, 22).getValues();

  for (let i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    const rowReason = String(row[2] || '');
    const rowTester = String(row[3] || '');
    const rowSession = String(row[4] || '');
    const rowPayload = String(row[21] || '');

    if (rowReason === String(reason || '') && rowTester === String(testerId || '') && rowSession === String(sessionId || '')) {
      if (syncedAt && rowPayload.indexOf(String(syncedAt)) !== -1) return true;
    }
  }
  return false;
}

function syncTesterCrmFromRegistro_(ss) {
  const rawSheet = ss.getSheetByName(RAW_SHEET_NAME);
  if (!rawSheet || rawSheet.getLastRow() < 2) return;

  const crmSheet = getOrCreateSheet_(ss, CRM_SHEET_NAME);
  ensureCrmHeader_(crmSheet);

  const rawData = rawSheet.getDataRange().getValues();
  const headers = rawData[0];
  const rows = rawData.slice(1);
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  const byTester = {};

  rows.forEach(row => {
    const testerId = safeStr_(row[col['tester_id']]).trim();
    if (!testerId) return;
    if (testerId === 'tester_id') return;
    if (testerId.toLowerCase() === 'null' || testerId.toLowerCase() === 'undefined') return;

    const linguaValue = safeStr_(row[col['lingua']]);
    const buildValue = safeStr_(row[col['versione_build']]);
    if (linguaValue === 'lingua' || buildValue === 'versione_build') return;

    const ricevutoIl = row[col['ricevuto_il']];
    const origine = safeStr_(row[col['origine']]);
    const versioneBuild = buildValue;
    const canale = safeStr_(row[col['canale']]);
    const lingua = linguaValue;
    const primoAccesso = parseDate_(row[col['primo_accesso_il']]);
    const ultimoAccesso = parseDate_(row[col['ultimo_accesso_il']]);
    const numeroAperture = toInt_(row[col['numero_aperture']]);
    const numeroFeedback = toInt_(row[col['numero_feedback']]);
    const installatoApp = truthyToSiNo_(row[col['installato_app']]);
    const piattaforma = safeStr_(row[col['piattaforma']]);
    const famigliaDispositivo = safeStr_(row[col['famiglia_dispositivo']]);
    const famigliaBrowser = safeStr_(row[col['famiglia_browser']]);

    if (!byTester[testerId]) {
      byTester[testerId] = {
        tester_id: testerId,
        nome: '',
        stato: numeroAperture > 0 ? 'attivo' : 'nuovo',
        tipo_tester: canale || origine || 'beta',
        installato_app: installatoApp,
        numero_aperture: numeroAperture,
        lingua,
        dispositivo: famigliaDispositivo,
        browser: famigliaBrowser,
        piattaforma,
        versione_build: versioneBuild,
        data_primo_accesso: primoAccesso || parseDate_(ricevutoIl),
        ultima_attività: ultimoAccesso || parseDate_(ricevutoIl),
        feedback_count: numeroFeedback
      };
      return;
    }

    const current = byTester[testerId];
    current.tipo_tester = canale || current.tipo_tester || origine || 'beta';
    current.installato_app = current.installato_app === 'si' || installatoApp === 'si' ? 'si' : 'no';
    current.numero_aperture = Math.max(toInt_(current.numero_aperture), numeroAperture);
    current.lingua = lingua || current.lingua;
    current.dispositivo = famigliaDispositivo || current.dispositivo;
    current.browser = famigliaBrowser || current.browser;
    current.piattaforma = piattaforma || current.piattaforma;
    current.versione_build = versioneBuild || current.versione_build;
    current.feedback_count = Math.max(toInt_(current.feedback_count), numeroFeedback);

    const firstDate = primoAccesso || parseDate_(ricevutoIl);
    const lastDate = ultimoAccesso || parseDate_(ricevutoIl);

    if (!current.data_primo_accesso || (firstDate && firstDate < current.data_primo_accesso)) {
      current.data_primo_accesso = firstDate;
    }
    if (!current.ultima_attività || (lastDate && lastDate > current.ultima_attività)) {
      current.ultima_attività = lastDate;
    }
  });

  const records = Object.keys(byTester).map(key => {
    const t = byTester[key];
    const aperture = toInt_(t.numero_aperture);
    const feedbackCount = toInt_(t.feedback_count);
    const diffDays = daysBetween_(t.data_primo_accesso, t.ultima_attività);
    const ritorno1 = diffDays >= 1 ? 'si' : 'no';
    const ritorno3 = diffDays >= 3 ? 'si' : 'no';
    const ritorno7 = diffDays >= 7 ? 'si' : 'no';
    const profondita = aperture >= 6 ? 'alta' : (aperture >= 3 ? 'media' : 'bassa');
    const primaAzione = (aperture >= 2 || feedbackCount >= 1) ? 'si' : 'no';
    const tempoPrimoValore = primaAzione === 'si' ? (aperture >= 6 ? '<1 min' : '1-3 min') : 'non raggiunto';
    const feedbackInviato = feedbackCount > 0 ? 'si' : 'no';
    const qualitaFeedback = feedbackCount >= 2 ? 'alta' : (feedbackCount === 1 ? 'media' : 'bassa');
    const attrito = 'nessuno';

    const score = calculateScore_({
      installato_app: t.installato_app,
      numero_aperture: aperture,
      ritorno_giorno_1: ritorno1,
      ritorno_giorno_3: ritorno3,
      ritorno_giorno_7: ritorno7,
      profondità_utilizzo: profondita,
      prima_azione_completata: primaAzione,
      feedback_inviato: feedbackInviato,
      qualità_feedback: qualitaFeedback,
      attrito_rilevato: attrito
    });

    const segmento = calculateSegment_({
      numero_aperture: aperture,
      ritorno_giorno_1: ritorno1,
      ritorno_giorno_3: ritorno3,
      ritorno_giorno_7: ritorno7,
      profondità_utilizzo: profondita,
      prima_azione_completata: primaAzione,
      feedback_inviato: feedbackInviato,
      qualità_feedback: qualitaFeedback,
      attrito_rilevato: attrito
    });

    return [
      t.tester_id,
      t.nome,
      aperture > 0 ? 'attivo' : 'nuovo',
      t.tipo_tester,
      score,
      calculatePriority_(segmento),
      segmento,
      t.installato_app,
      aperture,
      ritorno1,
      ritorno3,
      ritorno7,
      profondita,
      primaAzione,
      tempoPrimoValore,
      feedbackInviato,
      qualitaFeedback,
      attrito,
      '',
      t.lingua,
      t.dispositivo,
      t.browser,
      t.piattaforma,
      t.versione_build,
      formatDateTime_(t.data_primo_accesso),
      formatDateTime_(t.ultima_attività)
    ];
  });

  records.sort((a, b) => new Date(b[25] || 0).getTime() - new Date(a[25] || 0).getTime());

  crmSheet.clearContents();
  ensureCrmHeader_(crmSheet);
  if (records.length > 0) crmSheet.getRange(2, 1, records.length, records[0].length).setValues(records);
}

function syncKpiFromCrm_(ss) {
  const kpiSheet = getOrCreateSheet_(ss, KPI_SHEET_NAME);
  ensureKpiHeader_(kpiSheet);

  const crmSheet = ss.getSheetByName(CRM_SHEET_NAME);
  if (!crmSheet || crmSheet.getLastRow() < 2) {
    kpiSheet.clearContents();
    ensureKpiHeader_(kpiSheet);
    return;
  }

  const data = crmSheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  const total = rows.length;
  const attivi = rows.filter(r => safeStr_(r[col['stato']]) === 'attivo').length;
  const installazioni = rows.filter(r => safeStr_(r[col['installato_app']]) === 'si').length;
  const r1 = rows.filter(r => safeStr_(r[col['ritorno_giorno_1']]) === 'si').length;
  const r3 = rows.filter(r => safeStr_(r[col['ritorno_giorno_3']]) === 'si').length;
  const r7 = rows.filter(r => safeStr_(r[col['ritorno_giorno_7']]) === 'si').length;
  const powerUsers = rows.filter(r => safeStr_(r[col['segmento']]) === 'power_user').length;
  const engagedUsers = rows.filter(r => safeStr_(r[col['segmento']]) === 'engaged_user').length;
  const candidatePaid = rows.filter(r => safeStr_(r[col['segmento']]) === 'candidate_paid').length;
  const ghostTotali = rows.filter(r => {
    const s = safeStr_(r[col['segmento']]);
    return s === 'ghost_tecnico' || s === 'ghost_confuso' || s === 'ghost_freddo';
  }).length;
  const feedbackTotali = rows.filter(r => safeStr_(r[col['feedback_inviato']]) === 'si').length;
  const feedbackAltaQualita = rows.filter(r => safeStr_(r[col['qualità_feedback']]) === 'alta').length;

  const values = [
    ['utenti_totali', total],
    ['utenti_attivi', attivi],
    ['installazioni', installazioni],
    ['tasso_installazione', total ? installazioni / total : 0],
    ['ritorno_giorno_1', r1],
    ['ritorno_giorno_3', r3],
    ['ritorno_giorno_7', r7],
    ['power_user', powerUsers],
    ['engaged_user', engagedUsers],
    ['candidate_paid', candidatePaid],
    ['ghost_totali', ghostTotali],
    ['feedback_totali', feedbackTotali],
    ['feedback_alta_qualità', feedbackAltaQualita]
  ];

  kpiSheet.clearContents();
  ensureKpiHeader_(kpiSheet);
  kpiSheet.getRange(2, 1, values.length, 2).setValues(values);
}

function calculateScore_(data) {
  let score = 0;

  if (data.installato_app === 'si') score += 15;
  if (toInt_(data.numero_aperture) >= 1) score += 5;
  if (toInt_(data.numero_aperture) >= 3) score += 10;
  if (toInt_(data.numero_aperture) >= 6) score += 10;

  if (data.ritorno_giorno_1 === 'si') score += 10;
  if (data.ritorno_giorno_3 === 'si') score += 15;
  if (data.ritorno_giorno_7 === 'si') score += 20;

  if (data.profondità_utilizzo === 'alta') score += 20;
  else if (data.profondità_utilizzo === 'media') score += 10;

  if (data.prima_azione_completata === 'si') score += 10;

  if (data.feedback_inviato === 'si') score += 20;
  if (data.qualità_feedback === 'alta') score += 10;
  else if (data.qualità_feedback === 'media') score += 5;

  if (data.attrito_rilevato === 'tecnico') score -= 20;

  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

function calculateSegment_(data) {
  const aperture = toInt_(data.numero_aperture);

  if (
    data.feedback_inviato === 'si' &&
    data.prima_azione_completata === 'si' &&
    (data.qualità_feedback === 'media' || data.qualità_feedback === 'alta')
  ) {
    return 'candidate_paid';
  }

  if (
    data.ritorno_giorno_3 === 'si' &&
    (data.profondità_utilizzo === 'media' || data.profondità_utilizzo === 'alta') &&
    data.prima_azione_completata === 'si'
  ) {
    return 'power_user';
  }

  if (data.feedback_inviato === 'si') {
    return 'engaged_user';
  }

  if (aperture <= 2 && data.attrito_rilevato === 'tecnico') {
    return 'ghost_tecnico';
  }

  if (data.prima_azione_completata === 'no' && data.attrito_rilevato === 'comprensione') {
    return 'ghost_confuso';
  }

  if (
    aperture <= 2 &&
    data.feedback_inviato === 'no' &&
    data.ritorno_giorno_1 === 'no' &&
    data.ritorno_giorno_3 === 'no' &&
    data.ritorno_giorno_7 === 'no'
  ) {
    return 'ghost_freddo';
  }

  if (
    aperture >= 3 &&
    data.ritorno_giorno_1 === 'si' &&
    data.ritorno_giorno_3 === 'no' &&
    data.ritorno_giorno_7 === 'no'
  ) {
    return 'a_rischio';
  }

  return 'osservazione';
}

function calculatePriority_(segmento) {
  if (segmento === 'candidate_paid' || segmento === 'power_user') return 'alta';
  if (segmento === 'engaged_user' || segmento === 'a_rischio' || segmento === 'ghost_confuso') return 'media';
  return 'bassa';
}

function mapEventName_(reason) {
  const r = String(reason || '').toLowerCase().trim();
  if (!r) return 'app_aperta';
  if (r.indexOf('feedback') !== -1) return 'feedback_inviato';
  if (r.indexOf('install') !== -1 || r.indexOf('standalone') !== -1) return 'app_installata';
  if (r.indexOf('error') !== -1 || r.indexOf('errore') !== -1) return 'errore';
  if (r.indexOf('exit') !== -1 || r.indexOf('uscita') !== -1 || r.indexOf('beforeunload') !== -1) return 'uscita_precoce';
  if (r.indexOf('return') !== -1 || r.indexOf('ritorno') !== -1) return 'ritorno';
  if (r.indexOf('prima_azione') !== -1 || r.indexOf('first_action') !== -1 || r.indexOf('first_value') !== -1) return 'prima_azione_completata';
  if (r === 'boot' || r === 'session_start' || r === 'app_boot_sync') return 'app_aperta';
  if (r === 'early_exit') return 'uscita_precoce';
  return r || 'app_aperta';
}

function isFeedbackReason_(reason) {
  return String(reason || '').toLowerCase().indexOf('feedback') !== -1;
}

function inferFeedbackQuality_(record) {
  const explicit = safeStr_(record.qualitaFeedback).toLowerCase();
  if (explicit) return explicit;
  const message = safeStr_(record.messaggioFeedback);
  const count = toInt_(record.feedbackCount);
  if (message.length >= 80) return 'alta';
  if (message.length >= 20) return 'media';
  if (count >= 2) return 'media';
  return 'bassa';
}

function eventValueFromRecord_(record, reason) {
  const eventName = mapEventName_(reason);
  if (eventName === 'feedback_inviato') return toInt_(record.feedbackCount) || 1;
  if (eventName === 'tempo_primo_valore') return safeStr_(record.tempoPrimoValore) || '';
  return toInt_(record.launchCount);
}

function parsePayload_(e) {
  const raw = (e && e.postData && e.postData.contents) || '{}';
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_err) {
    throw new Error('Payload JSON non valido');
  }
}

function normalizeRecord_(payload) {
  const sourceRecord = payload && payload.record && typeof payload.record === 'object'
    ? payload.record
    : {};

  const sourceDevice = sourceRecord.device && typeof sourceRecord.device === 'object'
    ? sourceRecord.device
    : {};

  return {
    testerId: firstNonEmpty_(sourceRecord.testerId, payload.testerId, payload.user),
    sessionId: firstNonEmpty_(sourceRecord.sessionId, payload.sessionId, payload.session),
    licenseEmail: firstNonEmpty_(sourceRecord.licenseEmail, payload.licenseEmail, payload.email),
    build: firstNonEmpty_(sourceRecord.build, payload.build),
    channel: firstNonEmpty_(sourceRecord.channel, payload.channel),
    language: firstNonEmpty_(sourceRecord.language, payload.language),
    firstSeenAt: firstNonEmpty_(sourceRecord.firstSeenAt, payload.firstSeenAt),
    lastSeenAt: firstNonEmpty_(sourceRecord.lastSeenAt, payload.lastSeenAt, normalizeEventTimestamp_(payload.timestamp)),
    launchCount: firstNonEmpty_(sourceRecord.launchCount, payload.launchCount),
    feedbackCount: firstNonEmpty_(sourceRecord.feedbackCount, payload.feedbackCount),
    tipoFeedback: firstNonEmpty_(sourceRecord.tipoFeedback, payload.tipoFeedback),
    messaggioFeedback: firstNonEmpty_(sourceRecord.messaggioFeedback, payload.messaggioFeedback),
    qualitaFeedback: firstNonEmpty_(sourceRecord.qualitaFeedback, payload.qualitaFeedback),
    categoriaFeedback: firstNonEmpty_(sourceRecord.categoriaFeedback, payload.categoriaFeedback),
    reason: firstNonEmpty_(sourceRecord.reason, payload.reason, payload.event),
    source: firstNonEmpty_(sourceRecord.source, payload.source),
    syncedAt: firstNonEmpty_(sourceRecord.syncedAt, payload.syncedAt, normalizeEventTimestamp_(payload.timestamp)),
    tempoPrimoValore: firstNonEmpty_(sourceRecord.tempoPrimoValore, payload.tempoPrimoValore),
    device: {
      standalone: firstNonEmpty_(sourceDevice.standalone, payload.standalone),
      screen: firstNonEmpty_(sourceDevice.screen, payload.screen),
      viewport: firstNonEmpty_(sourceDevice.viewport, payload.viewport),
      platform: firstNonEmpty_(sourceDevice.platform, payload.platform),
      rawPlatform: firstNonEmpty_(sourceDevice.rawPlatform, payload.rawPlatform),
      maxTouch: firstNonEmpty_(sourceDevice.maxTouch, payload.maxTouch),
      deviceFamily: firstNonEmpty_(sourceDevice.deviceFamily, payload.deviceFamily),
      osFamily: firstNonEmpty_(sourceDevice.osFamily, payload.osFamily),
      browserFamily: firstNonEmpty_(sourceDevice.browserFamily, payload.browserFamily),
      ua: firstNonEmpty_(sourceDevice.ua, payload.ua, payload.userAgent)
    }
  };
}

function normalizeDevicePayload_(device) {
  const ua = safeStr_(device.ua);
  const maxTouch = toInt_(device.maxTouch);
  const inferred = inferDeviceFromUa_(ua, maxTouch);
  const browser = normalizeBrowserFamily_(safeStr_(device.browserFamily), ua);
  const os = normalizeOsFamily_(safeStr_(device.osFamily), ua, maxTouch);

  return {
    standalone: truthyToBoolean_(device.standalone),
    screen: safeStr_(device.screen),
    viewport: safeStr_(device.viewport),
    platform: normalizePlatform_(safeStr_(device.platform), safeStr_(device.rawPlatform), ua, maxTouch),
    deviceFamily: normalizeDeviceFamily_(safeStr_(device.deviceFamily), ua, maxTouch, inferred),
    osFamily: os,
    browserFamily: browser,
    ua: ua
  };
}

function inferDeviceFromUa_(ua, maxTouch) {
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

function normalizeDeviceFamily_(value, ua, maxTouch, inferred) {
  const current = safeStr_(value).toLowerCase();
  if (current && current.indexOf('mozilla/') === -1 && current.indexOf('applewebkit/') === -1) return current;
  return (inferred || inferDeviceFromUa_(ua, maxTouch)).deviceFamily;
}

function normalizeOsFamily_(value, ua, maxTouch) {
  const current = safeStr_(value).toLowerCase();
  if (current && current.indexOf('mozilla/') === -1 && current.indexOf('applewebkit/') === -1) return current;
  return inferDeviceFromUa_(ua, maxTouch).osFamily;
}

function normalizeBrowserFamily_(value, ua) {
  const current = safeStr_(value).toLowerCase();
  if (current && current.indexOf('mozilla/') === -1 && current.indexOf('applewebkit/') === -1) return current;

  const lower = String(ua || '').toLowerCase();
  if (lower.indexOf('edg/') !== -1) return 'edge';
  if (lower.indexOf('chrome/') !== -1 && lower.indexOf('edg/') === -1) return 'chrome';
  if (lower.indexOf('safari/') !== -1 && lower.indexOf('chrome/') === -1) return 'safari';
  if (lower.indexOf('firefox/') !== -1) return 'firefox';
  return 'unknown';
}

function normalizePlatform_(platform, rawPlatform, ua, maxTouch) {
  const inferred = inferDeviceFromUa_(ua, maxTouch);
  const p = safeStr_(platform || rawPlatform);
  if (inferred.osFamily === 'ios') return 'iOS';
  if (inferred.osFamily === 'android') return 'Android';
  if (p) return p;
  if (inferred.osFamily === 'windows') return 'Windows';
  if (inferred.osFamily === 'macos') return 'macOS';
  return 'unknown';
}

function normalizeEventTimestamp_(value) {
  if (value === null || value === undefined || value === '') return '';
  const asNumber = Number(value);
  if (!isNaN(asNumber) && asNumber > 0) return new Date(asNumber).toISOString();
  const parsed = parseDate_(value);
  return parsed ? parsed.toISOString() : '';
}

function findLicenseRow_(sheet, filters) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { rowIndex: 0, license: {} };

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(v => String(v || '').trim());
  const rows = data.slice(1);
  const email = normalizeEmail_(filters.email || '');
  const testerId = safeStr_(filters.testerId || '');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const record = objectFromHeaders_(headers, row);
    const rowEmail = normalizeEmail_(record.email);
    const rowTesterId = safeStr_(record.tester_id);

    if (email && rowEmail && email === rowEmail) {
      return { rowIndex: i + 2, license: record };
    }
    if (testerId && rowTesterId && testerId === rowTesterId) {
      return { rowIndex: i + 2, license: record };
    }
  }

  return { rowIndex: 0, license: {} };
}

function findRowByValue_(sheet, columnIndex, value) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { rowIndex: 0, values: [] };
  const normalizedTarget = normalizeEmail_(value);
  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (let i = 0; i < values.length; i++) {
    const rowValue = normalizeEmail_(values[i][columnIndex - 1]);
    if (rowValue && rowValue === normalizedTarget) {
      return { rowIndex: i + 2, values: values[i] };
    }
  }
  return { rowIndex: 0, values: [] };
}

function touchLicenseAccess_(sheet, data) {
  const found = findLicenseRow_(sheet, { email: data.email || '', testerId: data.testerId || '' });
  if (!found.rowIndex) return;
  const rowIndex = found.rowIndex;
  if (data.lastAccessAt) sheet.getRange(rowIndex, 9).setValue(data.lastAccessAt);
  sheet.getRange(rowIndex, 10).setValue(new Date());
  sheet.getRange(rowIndex, 15).setValue(new Date());
}

function resolveLicenseStatus_(license, now) {
  const revoked = ['yes', 'si', 'true', '1'].indexOf(safeStr_(license.revocata_si_no).toLowerCase()) !== -1;
  if (revoked) return 'revoked';

  const explicitStatus = safeStr_(license.stato).toLowerCase();
  if (explicitStatus === 'revoked') return 'revoked';
  if (explicitStatus === 'suspended') return 'suspended';
  if (explicitStatus === 'pending') return 'pending';

  const expiryDate = parseDate_(license.data_scadenza);
  const graceDays = toInt_(license.grace_days);
  if (expiryDate) {
    const finalExpiry = new Date(expiryDate.getTime());
    if (graceDays > 0) finalExpiry.setDate(finalExpiry.getDate() + graceDays);
    if (now.getTime() > finalExpiry.getTime()) return 'expired';
  }

  if (explicitStatus === 'active') return 'active';
  if (explicitStatus === 'expired') return 'expired';
  return 'missing';
}

function mapRoleFromLicenseType_(licenseType) {
  const value = safeStr_(licenseType).toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'internal') return 'internal';
  if (value === 'premium_future') return 'premium';
  return 'tester';
}

function licenseMessage_(status) {
  if (status === 'active') return 'Accesso beta attivo';
  if (status === 'pending') return 'Richiesta ricevuta, accesso non ancora attivato';
  if (status === 'expired') return 'Licenza beta scaduta';
  if (status === 'revoked') return 'Accesso revocato';
  if (status === 'suspended') return 'Accesso temporaneamente sospeso';
  return 'Licenza non trovata';
}

function objectFromHeaders_(headers, values) {
  const out = {};
  headers.forEach((header, index) => {
    out[String(header || '').trim()] = values[index];
  });
  return out;
}

function normalizeDateOutput_(value) {
  const d = parseDate_(value);
  return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : '';
}

function generateTesterId_() {
  const part = Math.random().toString(36).slice(2, 8);
  return 'kdx_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMdd') + '_' + part;
}

function normalizeEmail_(value) {
  return safeStr_(value).toLowerCase();
}

function parseDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween_(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  return Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 86400000));
}

function formatDateTime_(date) {
  if (!date) return '';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function toInt_(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = parseInt(String(value).replace(',', '.').trim(), 10);
  return isNaN(n) ? 0 : n;
}

function safeStr_(value) {
  return String(value || '').trim();
}

function truthyToSiNo_(value) {
  const v = String(value || '').toLowerCase().trim();
  return (v === 'true' || v === '1' || v === 'yes' || v === 'si') ? 'si' : 'no';
}

function truthyToBoolean_(value) {
  const v = String(value || '').toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes' || v === 'si';
}

function firstNonEmpty_() {
  for (let i = 0; i < arguments.length; i++) {
    const value = arguments[i];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return '';
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function aggiornaCrmTester() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const rawSheet = getOrCreateSheet_(ss, RAW_SHEET_NAME, LEGACY_RAW_SHEET_NAME);
  ensureRegistroHeader_(rawSheet);
  const eventsSheet = getOrCreateSheet_(ss, EVENTS_SHEET_NAME);
  ensureEventsHeader_(eventsSheet);
  const feedbackSheet = getOrCreateSheet_(ss, FEEDBACK_SHEET_NAME);
  ensureFeedbackHeader_(feedbackSheet);
  const licensesSheet = getOrCreateSheet_(ss, LICENSES_SHEET_NAME);
  ensureLicensesHeader_(licensesSheet);
  const requestsSheet = getOrCreateSheet_(ss, BETA_REQUESTS_SHEET_NAME);
  ensureBetaRequestsHeader_(requestsSheet);
  syncTesterCrmFromRegistro_(ss);
  syncKpiFromCrm_(ss);
}

function inizializzaStrutturaBeta() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureRegistroHeader_(getOrCreateSheet_(ss, RAW_SHEET_NAME, LEGACY_RAW_SHEET_NAME));
  ensureEventsHeader_(getOrCreateSheet_(ss, EVENTS_SHEET_NAME));
  ensureFeedbackHeader_(getOrCreateSheet_(ss, FEEDBACK_SHEET_NAME));
  ensureCrmHeader_(getOrCreateSheet_(ss, CRM_SHEET_NAME));
  ensureKpiHeader_(getOrCreateSheet_(ss, KPI_SHEET_NAME));
  ensureLicensesHeader_(getOrCreateSheet_(ss, LICENSES_SHEET_NAME));
  ensureBetaRequestsHeader_(getOrCreateSheet_(ss, BETA_REQUESTS_SHEET_NAME));
}
