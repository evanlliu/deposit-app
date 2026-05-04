// Cloudflare Worker for Deposit Manager
// Routes:
//   GET  /bootstrap -> read cloud syncSettings without APP_PASSWORD, used for new-device auto sync
//   GET  /data  -> read data.json from GitHub
//   PUT  /data  -> update data.json in GitHub
//   POST /send-test-email    -> send one test email with current cloud email settings
//   POST /run-reminders      -> manually trigger reminder check
//   POST /send-reminder-test -> backward-compatible alias of /run-reminders
//   POST /refresh-rates       -> refresh active/history rates with exchangerate.host yearly cache and save data.json
//   POST /auth                -> verify APP_PASSWORD for page unlock
//
// Required environment variables / secrets:
//   GITHUB_TOKEN      Fine-grained GitHub token with Contents: Read and write permission
//   GITHUB_OWNER      Your GitHub username or organization
//   GITHUB_REPO       Repository name that stores data.json
//   GITHUB_BRANCH     Branch name, usually main
//   GITHUB_PATH       File path, usually data.json
//   APP_PASSWORD      Password used by the frontend to call this Worker
//
// Optional email variables / secrets:
//   RESEND_API_KEY    Resend email API key
//   MAIL_FROM         Sender, e.g. "Deposit Reminder <onboarding@resend.dev>"
//   EXCHANGE_RATE_HOST_API_KEY  Optional. Used by cloud email reminders to refresh rates before sending.
// v51: Adds configurable page lock timeout; each device keeps its own local unlock timer.
// v50: Adds /auth endpoint so the page lock screen can verify APP_PASSWORD before loading data.
// v44: Email template variables now support active table column codes and keep legacy aliases.
// v42: Email reminder supports push windows and config-fingerprint based duplicate reset.
// v34: Explicitly preserves/saves new UI settings in data.json, including timeZone and columnWidths.
// v31: PUT uses GitHub sha optimistic locking; timezone-aware reminders/rate refresh; keeps Worker-owned fields safe.
// v29: Cron duplicate prevention only uses cron-sent records. Manual cloud tests do not block scheduled sending.
// v26: Before sending reminder emails, refresh target records with exchangerate.host yearly cache stored in data.json.
// Cloudflare Cron Trigger examples:
//   0 * * * *     // every hour, required if you use dueTodayIntervalHours and push windows such as 09:00-18:00
//   0 6 * * *     // every day 06:00 UTC, enough if you only use advanceDays

const DEFAULT_EMAIL_REMINDER = {
  enabled: false,
  mailTo: '',
  advanceDays: [],
  dueTodayIntervalHours: '',
  pushStartTime: '',
  pushEndTime: '',
  onlyEnabledRecords: true,
  fields: [],
  subjectTemplate: '定存到期提醒：{{bank}} {{principalTry}} TRY',
  bodyTemplate: '你的定期存款即将到期：\n\n银行：{{bank}}\n本金：{{principalTry}} TRY\n本金+利息：{{principalPlusInterestTry}} TRY\n到期日：{{endDate}}\n剩余天数：{{remainingDays}} 天\n\n请及时处理。'
};


const MAIL_TEMPLATE_VARIABLES = [
  // Active table column codes, excluding the UI-only actions column.
  'seq', 'remainingDays', 'bank', 'openDate', 'usdCnyOpen', 'tryCnyOpen',
  'startDate', 'endDate', 'usdCnyNow', 'tryCnyNow', 'principalTry',
  'interestTry', 'principalPlusInterestTry', 'depositDays', 'annualRateTry',
  'annualRateCny', 'principalCny', 'principalUsd', 'principalPlusInterestCny',
  'principalPlusInterestUsd', 'gainTry', 'gainCny', 'gainUsd', 'reminderEnabled',
  // Backward-compatible aliases used by older templates.
  'usdCnyEnd', 'tryCnyEnd', 'interestCny', 'remark'
];

const DEFAULT_DATA = {
  activeRecords: [],
  historyRecords: [],
  editLogs: [],
  settings: {
    currentUsdCny: 6.8375,
    currentTryCny: 0.1517,
    defaultTaxRate: 17.5,
    rateProvider: 'TCMB',
    rateFallbackEnabled: 'YES',
    tcmbRateType: 'ForexBuying',
    exchangeRateHostRefreshLatestApi: 'NO',
    exchangeRateHostBatchWindowDays: 365,
    rateApiKeys: {},
    exchangeRateHostYearCache: null,
    lastRateFetchDate: '',
    language: 'zh',
    timeZone: 'UTC',
    lockTimeoutMinutes: 2,
    syncSettings: { apiUrl: '', apiPassword: '' },
    columnVisibility: { active: {}, history: {} },
    columnLabels: { active: {}, history: {} },
    columnWidths: { active: {}, history: {} },
    emailReminder: DEFAULT_EMAIL_REMINDER,
    sentReminders: {},
    recordTombstones: {}
  }
};

class CloudConflictError extends Error {
  constructor(message, current) {
    super(message);
    this.name = 'CloudConflictError';
    this.currentSha = current && current.sha ? current.sha : '';
    this.currentData = current && current.data ? current.data : null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // v24: Bootstrap endpoint intentionally does not require APP_PASSWORD.
    // It lets new browsers/devices fetch cloud sync settings first, then use /data normally.
    // Only enable this if you accept storing syncSettings.apiPassword in data.json.
    if (url.pathname === '/bootstrap' && request.method === 'GET') {
      try {
        const result = await readGithubFile(env);
        const data = normalizeData(result.data);
        return jsonResponse({
          ok: true,
          syncSettings: data.settings && data.settings.syncSettings ? data.settings.syncSettings : {}
        });
      } catch (error) {
        return jsonResponse({ ok: false, error: error.message || String(error) }, 500);
      }
    }

    const authError = checkPassword(request, env);
    if (authError) return authError;

    try {
      if (url.pathname === '/auth' && (request.method === 'GET' || request.method === 'POST')) {
        return jsonResponse({ ok: true, authenticated: true, checkedAt: new Date().toISOString() });
      }

      if (url.pathname === '/data') {
        if (request.method === 'GET') {
          const result = await readGithubFile(env);
          return jsonResponse({ ok: true, data: result.data, sha: result.sha });
        }

        if (request.method === 'PUT') {
          const body = await request.json();
          const incomingData = normalizeData(body.data || body);
          const current = await readGithubFile(env).catch(() => ({ data: null, sha: null }));
          const expectedSha = Object.prototype.hasOwnProperty.call(body, 'baseSha') ? (body.baseSha || null) : undefined;
          if (expectedSha !== undefined && (expectedSha || current.sha) && expectedSha !== current.sha) {
            throw new CloudConflictError('云端 data.json 已被其他设备或 Worker 更新，已阻止旧数据覆盖。请先从云端刷新或选择合并。', current);
          }
          const data = mergeWorkerOwnedFields(incomingData, current.data);
          const result = await writeGithubFile(env, data, expectedSha);
          return jsonResponse({ ok: true, sha: result.sha, data });
        }

        return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
      }

      if (url.pathname === '/send-test-email' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const result = await sendCloudTestEmail(env, body || {});
        return jsonResponse({ ok: true, result });
      }

      if ((url.pathname === '/run-reminders' || url.pathname === '/send-reminder-test') && request.method === 'POST') {
        const result = await processEmailReminders(env, { force: true, recordSent: false, triggerSource: 'manual-test' });
        return jsonResponse({ ok: true, result });
      }

      if (url.pathname === '/refresh-rates' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const result = await refreshRatesFromWorker(env, body || {});
        return jsonResponse({ ok: true, ...result });
      }

      return jsonResponse({ ok: false, error: 'Not found' }, 404);
    } catch (error) {
      if (error && error.name === 'CloudConflictError') {
        return jsonResponse({
          ok: false,
          conflict: true,
          error: error.message || 'Cloud data conflict',
          currentSha: error.currentSha || '',
          currentData: error.currentData || null
        }, 409);
      }
      return jsonResponse({ ok: false, error: error.message || String(error) }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(processEmailReminders(env, { force: false, recordSent: true, triggerSource: 'cron' }));
  }
};

function checkPassword(request, env) {
  const expected = env.APP_PASSWORD;
  if (!expected) return jsonResponse({ ok: false, error: 'APP_PASSWORD is not configured in Worker.' }, 500);

  const supplied = request.headers.get('x-app-password') || '';
  if (supplied !== expected) {
    return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
  }
  return null;
}

function githubConfig(env) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || 'main';
  const path = env.GITHUB_PATH || 'data.json';
  const token = env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    throw new Error('Missing GitHub config. Please set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO.');
  }

  return { owner, repo, branch, path, token };
}

async function readGithubFile(env) {
  const { owner, repo, branch, path, token } = githubConfig(env);
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponentPath(path)}?ref=${encodeURIComponent(branch)}`;

  const res = await fetch(apiUrl, {
    method: 'GET',
    headers: githubHeaders(token)
  });

  if (res.status === 404) {
    return { data: DEFAULT_DATA, sha: null };
  }

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || `GitHub read failed: ${res.status}`);
  }

  const content = base64DecodeUnicode((payload.content || '').replace(/\n/g, ''));
  let data;
  try {
    data = JSON.parse(content || '{}');
  } catch {
    data = DEFAULT_DATA;
  }

  return { data: normalizeData(data), sha: payload.sha };
}

async function writeGithubFile(env, data, expectedSha) {
  const { owner, repo, branch, path, token } = githubConfig(env);
  const current = await readGithubFile(env);
  if (expectedSha !== undefined && (expectedSha || current.sha) && expectedSha !== current.sha) {
    throw new CloudConflictError('云端 data.json 已被其他设备或 Worker 更新，已阻止旧数据覆盖。请先从云端刷新或选择合并。', current);
  }
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponentPath(path)}`;

  const content = JSON.stringify(normalizeData(data), null, 2);
  const body = {
    message: `Update deposit data ${new Date().toISOString()}`,
    content: base64EncodeUnicode(content),
    branch
  };
  if (current.sha) body.sha = current.sha;

  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers: githubHeaders(token),
    body: JSON.stringify(body)
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.message || `GitHub write failed: ${res.status}`);
  }

  return { sha: payload.content && payload.content.sha };
}

async function processEmailReminders(env, options = {}) {
  const read = await readGithubFile(env);
  const data = normalizeData(read.data);
  const cfg = normalizeEmailReminder(data.settings && data.settings.emailReminder);
  const timeZone = normalizeTimeZone(data.settings && data.settings.timeZone);
  if (!cfg.enabled) return { sent: 0, skipped: 'email reminder disabled', timeZone };

  const hasAdvanceRule = cfg.advanceDays.length > 0;
  const hasDueHourlyRule = Boolean(cfg.dueTodayIntervalHours);
  if (!hasAdvanceRule && !hasDueHourlyRule) return { sent: 0, skipped: 'no reminder rules configured' };
  if (!cfg.mailTo) return { sent: 0, skipped: 'mailTo is empty' };

  const now = new Date();
  const configFingerprint = emailReminderFingerprint(cfg, timeZone);
  const windowInfo = getReminderWindowInfo(cfg, now, timeZone);
  if (!options.force && !windowInfo.allowed) {
    return {
      sent: 0,
      matched: 0,
      skipped: `outside push window ${windowInfo.windowLabel}`,
      triggerSource: options.triggerSource || 'cron',
      rules: {
        advanceDays: cfg.advanceDays,
        dueTodayIntervalHours: cfg.dueTodayIntervalHours || '',
        pushStartTime: cfg.pushStartTime || '',
        pushEndTime: cfg.pushEndTime || '',
        timeZone,
        currentTime: windowInfo.currentTime
      }
    };
  }

  const active = Array.isArray(data.activeRecords) ? data.activeRecords : [];
  const sentReminders = data.settings.sentReminders && typeof data.settings.sentReminders === 'object'
    ? data.settings.sentReminders
    : {};

  const candidates = [];

  for (const [index, r] of active.entries()) {
    const c = getCalc(r, timeZone);
    if (cfg.onlyEnabledRecords && !r.reminderEnabled) continue;

    if (hasAdvanceRule && cfg.advanceDays.includes(c.remainingDays)) {
      const key = `${r.id || r.bank}:${r.endDate}:advance:${c.remainingDays}`;
      const previous = sentReminders[key];
      // Only a real Cloudflare Cron send should block the next Cron send.
      // Old/manual test records must not block scheduled reminders.
      if (options.force || !isBlockingCronReminder(previous, configFingerprint)) {
        candidates.push({ r, c, index, key, triggerLabel: `提前 ${c.remainingDays} 天推送`, previousReminder: previous || null });
      }
    }

    if (hasDueHourlyRule && c.remainingDays === 0) {
      const key = `${r.id || r.bank}:${r.endDate}:due-hourly`;
      const previous = sentReminders[key];
      const lastSentAt = isBlockingCronReminder(previous, configFingerprint) && previous.sentAt ? new Date(previous.sentAt) : null;
      const elapsedMs = lastSentAt && !Number.isNaN(lastSentAt.getTime()) ? (now - lastSentAt) : Infinity;
      // Cron usually runs on an hourly boundary, but seconds can drift. Give it a small tolerance so
      // a 10:00 run is not blocked by a previous 09:00:30 send when the interval is 1 hour.
      const intervalMs = Number(cfg.dueTodayIntervalHours) * 3600000;
      const clockToleranceMs = 70000;
      if (options.force || elapsedMs >= Math.max(0, intervalMs - clockToleranceMs)) {
        candidates.push({ r, c, index, key, triggerLabel: `到期当天每 ${cfg.dueTodayIntervalHours} 小时推送`, previousReminder: previous || null });
      }
    }
  }

  let rateRefresh = { attempted: false, skipped: 'no candidates' };
  if (candidates.length > 0) {
    try {
      rateRefresh = await refreshRatesBeforeEmail(env, data, candidates, timeZone);
    } catch (e) {
      rateRefresh = { attempted: true, ok: false, error: e.message || String(e) };
    }
  }

  let sent = 0;
  const errors = [];
  const shouldRecordSent = options.recordSent !== false;
  const triggerSource = options.triggerSource || (shouldRecordSent ? 'cron' : 'manual-test');

  for (const item of candidates) {
    try {
      const subject = renderTemplate(cfg.subjectTemplate, item.r, item.c, item.index);
      const text = renderTemplate(cfg.bodyTemplate, item.r, item.c, item.index);
      await sendEmailWithResend(env, cfg.mailTo, subject, text);
      if (shouldRecordSent) {
        sentReminders[item.key] = {
          sentAt: new Date().toISOString(),
          bank: item.r.bank,
          endDate: item.r.endDate,
          remainingDays: item.c.remainingDays,
          triggerLabel: item.triggerLabel,
          triggerSource,
          emailReminderFingerprint: configFingerprint,
          emailReminderWindow: windowInfo.windowLabel,
          rateRefresh
        };
      }
      sent++;
    } catch (e) {
      errors.push(`${item.r.bank || item.r.id || 'record'}: ${e.message || String(e)}`);
    }
  }

  const result = {
    sent,
    matched: candidates.length,
    errors,
    rateRefresh,
    triggerSource,
    recordSent: shouldRecordSent,
    note: shouldRecordSent ? '正式执行：只会被 Cloudflare Cron 的发送记录拦截重复推送；页面手动测试不会拦截。' : '手动测试：不会写入防重复发送记录，后续 Cloudflare Cron 仍会按规则正式推送。',
    rules: { advanceDays: cfg.advanceDays, dueTodayIntervalHours: cfg.dueTodayIntervalHours || '', pushStartTime: cfg.pushStartTime || '', pushEndTime: cfg.pushEndTime || '', timeZone, currentTime: windowInfo.currentTime },
    matchedRecords: candidates.map(item => ({
      key: item.key,
      bank: item.r.bank || '',
      endDate: item.r.endDate || '',
      remainingDays: item.c.remainingDays,
      triggerLabel: item.triggerLabel,
      previousTriggerSource: item.previousReminder && item.previousReminder.triggerSource ? item.previousReminder.triggerSource : '',
      previousFingerprint: item.previousReminder && item.previousReminder.emailReminderFingerprint ? item.previousReminder.emailReminderFingerprint : ''
    }))
  };

  const shouldWriteExecutionLog = shouldRecordSent && (sent > 0 || errors.length > 0 || candidates.length > 0);
  if (shouldWriteExecutionLog) {
    data.settings.mailLastExecution = {
      at: new Date().toISOString(),
      triggerSource,
      sent,
      matched: candidates.length,
      errors,
      rules: result.rules,
      matchedRecords: result.matchedRecords,
      timeZone,
      rateRefreshSummary: rateRefresh && typeof rateRefresh === 'object' ? {
        attempted: rateRefresh.attempted,
        ok: rateRefresh.ok,
        provider: rateRefresh.provider,
        cacheFetchedOn: rateRefresh.cacheFetchedOn,
        cacheDateCount: rateRefresh.cacheDateCount,
        refreshedRecords: rateRefresh.refreshedRecords,
        error: rateRefresh.error || ''
      } : rateRefresh
    };
  }

  if (rateRefresh.dataChanged || (sent > 0 && shouldRecordSent) || shouldWriteExecutionLog) {
    if (shouldRecordSent) data.settings.sentReminders = sentReminders;
    const writeResult = await writeGithubFile(env, data, read.sha || null);
    result.sha = writeResult.sha || '';
  }

  return result;
}

function isCronSentReminder(entry) {
  return Boolean(entry && entry.triggerSource === 'cron' && entry.sentAt);
}

function isBlockingCronReminder(entry, currentFingerprint) {
  if (!isCronSentReminder(entry)) return false;
  // If the user changes any email reminder configuration, the current fingerprint changes.
  // Then old cron records should not block the new schedule. Entries from older app versions
  // may not have a fingerprint; keep them blocking only by elapsed time for backward compatibility.
  if (entry.emailReminderFingerprint && currentFingerprint && entry.emailReminderFingerprint !== currentFingerprint) return false;
  return true;
}

function emailReminderFingerprint(cfg, timeZone) {
  const payload = {
    enabled: Boolean(cfg.enabled),
    mailTo: String(cfg.mailTo || '').trim(),
    advanceDays: normalizeAdvanceDays(cfg.advanceDays),
    dueTodayIntervalHours: normalizeDueTodayIntervalHours(cfg.dueTodayIntervalHours) || '',
    pushStartTime: normalizeTimeOfDay(cfg.pushStartTime) || '',
    pushEndTime: normalizeTimeOfDay(cfg.pushEndTime) || '',
    onlyEnabledRecords: cfg.onlyEnabledRecords !== false,
    subjectTemplate: cfg.subjectTemplate || '',
    bodyTemplate: cfg.bodyTemplate || '',
    timeZone: normalizeTimeZone(timeZone)
  };
  return simpleHash(stableStringify(payload));
}

function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function simpleHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'r' + (h >>> 0).toString(36);
}

function getReminderWindowInfo(cfg, date, timeZone) {
  const start = normalizeTimeOfDay(cfg.pushStartTime);
  const end = normalizeTimeOfDay(cfg.pushEndTime);
  const startMin = parseTimeOfDayToMinutes(start || '00:00');
  const endMin = parseTimeOfDayToMinutes(end || '23:59');
  const nowParts = getTimePartsInTimeZone(date, timeZone);
  const nowMin = nowParts.hour * 60 + nowParts.minute;
  const allowed = startMin <= endMin
    ? nowMin >= startMin && nowMin <= endMin
    : nowMin >= startMin || nowMin <= endMin;
  return {
    allowed,
    currentTime: `${String(nowParts.hour).padStart(2, '0')}:${String(nowParts.minute).padStart(2, '0')}`,
    windowLabel: `${start || '00:00'}-${end || '23:59'}`
  };
}

function getTimePartsInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeTimeZone(timeZone),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  let hour = parseInt(parts.hour, 10);
  const minute = parseInt(parts.minute, 10);
  if (hour === 24) hour = 0;
  return { hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 };
}

function parseTimeOfDayToMinutes(value) {
  const normalized = normalizeTimeOfDay(value) || '00:00';
  const [h, m] = normalized.split(':').map(x => parseInt(x, 10));
  return h * 60 + m;
}

function normalizeTimeOfDay(value) {
  if (value === null || value === undefined) return '';
  const s = String(value).trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return '';
  const h = parseInt(m[1], 10);
  const min = m[2] === undefined ? 0 : parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

async function refreshRatesBeforeEmail(env, data, candidates, timeZone) {
  const apiKey = getExchangeRateHostApiKey(env, data);
  if (!apiKey) {
    return { attempted: true, ok: false, skipped: 'missing exchangerate.host API key. Set EXCHANGE_RATE_HOST_API_KEY in Worker Secrets or sync exchangeRateHostApiKey to cloud.' };
  }

  const today = todayString(timeZone);
  const cache = await ensureExchangeRateHostYearCache(env, data, apiKey, today);
  const missingDates = new Set();
  let refreshedRecords = 0;
  let changed = false;

  for (const item of candidates) {
    const r = item.r;
    let recordChanged = false;

    const openRates = getRatesFromExchangeHostYearCache(cache, r.openDate, false, timeZone);
    if (openRates) {
      if (setRateIfDifferent(r, 'usdCnyOpen', openRates.usdCny)) recordChanged = true;
      if (setRateIfDifferent(r, 'tryCnyOpen', openRates.tryCny)) recordChanged = true;
    } else if (r.openDate) {
      missingDates.add(r.openDate);
    }

    const endRates = getRatesFromExchangeHostYearCache(cache, r.endDate, true, timeZone);
    if (endRates) {
      if (setRateIfDifferent(r, 'usdCnyNow', endRates.usdCny)) recordChanged = true;
      if (setRateIfDifferent(r, 'tryCnyNow', endRates.tryCny)) recordChanged = true;
    } else if (r.endDate) {
      missingDates.add(r.endDate);
    }

    if (recordChanged) {
      item.c = getCalc(r, timeZone);
      refreshedRecords++;
      changed = true;
    }
  }

  return {
    attempted: true,
    ok: true,
    provider: 'exchangerate.host timeframe yearly cache',
    cacheFetchedOn: cache.fetchedOn,
    cacheStartDate: cache.startDate,
    cacheEndDate: cache.endDate,
    cacheDateCount: cache.rates ? Object.keys(cache.rates).length : 0,
    refreshedRecords,
    missingDates: Array.from(missingDates).slice(0, 20),
    dataChanged: changed || Boolean(cache._justFetched)
  };
}

function getExchangeRateHostApiKey(env, data) {
  if (env.EXCHANGE_RATE_HOST_API_KEY) return String(env.EXCHANGE_RATE_HOST_API_KEY).trim();
  const settings = data && data.settings ? data.settings : {};
  const keys = settings.rateApiKeys && typeof settings.rateApiKeys === 'object' ? settings.rateApiKeys : {};
  return String(keys.exchangeRateHostApiKey || '').trim();
}

async function ensureExchangeRateHostYearCache(env, data, apiKey, today) {
  const settings = data.settings || (data.settings = {});
  const cache = settings.exchangeRateHostYearCache;
  const forceApi = settings.exchangeRateHostRefreshLatestApi === 'YES';
  if (!forceApi && cache && cache.fetchedOn === today && cache.rates && Object.keys(cache.rates).length > 0) {
    cache._justFetched = false;
    return cache;
  }

  const days = 365;
  const endDate = today;
  const startDate = addDaysString(today, -(days - 1));
  const nextCache = await fetchExchangeRateHostTimeframe(apiKey, startDate, endDate);
  nextCache.fetchedOn = today;
  nextCache._justFetched = true;
  settings.exchangeRateHostYearCache = nextCache;
  settings.lastRateFetchDate = today;
  return nextCache;
}

async function fetchExchangeRateHostTimeframe(apiKey, startDate, endDate) {
  const params = new URLSearchParams({
    access_key: apiKey,
    source: 'USD',
    currencies: 'CNY,TRY',
    start_date: startDate,
    end_date: endDate
  });
  const url = `https://api.exchangerate.host/timeframe?${params.toString()}`;
  const res = await fetch(url, { method: 'GET' });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.success === false) {
    throw new Error(payload.error && (payload.error.info || payload.error.message) || payload.message || `exchangerate.host timeframe failed: ${res.status}`);
  }

  const raw = payload.quotes || payload.rates || {};
  const rates = {};
  const dates = Object.keys(raw).sort();
  for (const date of dates) {
    const daily = raw[date];
    const parsed = parseUsdBasedDailyRates(daily, date);
    if (parsed) rates[date] = parsed;
  }
  const rateDates = Object.keys(rates).sort();
  if (!rateDates.length) throw new Error(`exchangerate.host timeframe returned no usable CNY/TRY rates: ${startDate} ~ ${endDate}`);
  const latestDate = rateDates[rateDates.length - 1];

  return {
    provider: 'ExchangeRateHost',
    source: 'exchangerate.host timeframe',
    fetchedAt: new Date().toISOString(),
    startDate,
    endDate,
    latestDate,
    latest: rates[latestDate],
    rates
  };
}

function parseUsdBasedDailyRates(daily, date) {
  if (!daily || typeof daily !== 'object') return null;
  const cny = pickNumeric(daily, ['USDCNY', 'CNY', 'usdCny', 'USD_CNY']);
  const tr = pickNumeric(daily, ['USDTRY', 'TRY', 'usdTry', 'USD_TRY']);
  if (!cny || !tr) return null;
  return {
    usdCny: cny,
    tryCny: cny / tr,
    date,
    source: 'exchangerate.host timeframe'
  };
}

function getRatesFromExchangeHostYearCache(cache, date, useLatestForFuture, timeZone) {
  if (!cache || !cache.rates) return null;
  const today = todayString(timeZone);
  if (!date) return cache.latest || null;
  if (useLatestForFuture && date > today) return cache.latest || null;
  if (cache.rates[date]) return cache.rates[date];
  // For weekends / holidays, use the nearest earlier available day in the yearly cache.
  const dates = Object.keys(cache.rates).sort();
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i] <= date) return cache.rates[dates[i]];
  }
  return null;
}

function pickNumeric(obj, keys) {
  for (const key of keys) {
    const value = Number(obj[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function setRateIfDifferent(record, key, value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return false;
  if (Number(record[key]) === num) return false;
  record[key] = num;
  return true;
}

function addDaysString(dateStr, diff) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

async function refreshRatesFromWorker(env, body = {}) {
  const read = await readGithubFile(env);
  const data = normalizeData(read.data);
  const settings = data.settings || (data.settings = {});
  settings.rateProvider = 'ExchangeRateHost';
  const timeZone = normalizeTimeZone(settings.timeZone);

  const apiKey = getExchangeRateHostApiKey(env, data);
  if (!apiKey) {
    throw new Error('缺少 exchangerate.host API Key。请在 Worker Secret 设置 EXCHANGE_RATE_HOST_API_KEY，或在页面汇率设置里同步 API Key 到云端。');
  }

  const historyDays = Math.max(0, Number(body.historyDays || settings.historyRateRefreshDays || 30) || 30);
  settings.historyRateRefreshDays = historyDays;
  const today = todayString(timeZone);
  const activeRecords = Array.isArray(data.activeRecords) ? data.activeRecords : [];
  const historyRecords = Array.isArray(data.historyRecords) ? data.historyRecords : [];
  const eligibleHistoryRecords = historyRecords.filter(r => isHistoryRateRefreshEligibleWorker(r, historyDays, timeZone));
  const skippedHistoryCount = Math.max(historyRecords.length - eligibleHistoryRecords.length, 0);

  const cache = await ensureExchangeRateHostYearCache(env, data, apiKey, today);
  let activeSuccessCount = 0;
  let historySuccessCount = 0;
  let changed = Boolean(cache._justFetched);
  const missingDates = [];

  function refreshOne(r, type) {
    let recordChanged = false;
    const openRates = getRatesFromExchangeHostYearCache(cache, r.openDate, true, timeZone);
    if (openRates) {
      if (setRateIfDifferent(r, 'usdCnyOpen', openRates.usdCny)) recordChanged = true;
      if (setRateIfDifferent(r, 'tryCnyOpen', openRates.tryCny)) recordChanged = true;
    } else if (r.openDate) {
      missingDates.push(`${type} ${r.bank || r.id || ''} 开户日期 ${r.openDate}`.trim());
    }

    const endRates = getRatesFromExchangeHostYearCache(cache, r.endDate, true, timeZone);
    if (endRates) {
      if (setRateIfDifferent(r, 'usdCnyNow', endRates.usdCny)) recordChanged = true;
      if (setRateIfDifferent(r, 'tryCnyNow', endRates.tryCny)) recordChanged = true;
    } else if (r.endDate) {
      missingDates.push(`${type} ${r.bank || r.id || ''} 结束日期 ${r.endDate}`.trim());
    }

    if (recordChanged) changed = true;
    return Boolean(openRates || endRates);
  }

  for (const r of activeRecords) {
    if (refreshOne(r, '当前')) activeSuccessCount++;
  }
  for (const r of eligibleHistoryRecords) {
    if (refreshOne(r, '历史')) historySuccessCount++;
  }

  settings.lastRateFetchDate = today;
  const writeResult = await writeGithubFile(env, data, read.sha || null);

  return {
    data,
    sha: writeResult.sha || '',
    timeZone,
    summary: {
      provider: 'exchangerate.host yearly GitHub cache',
      cacheFetchedOn: cache.fetchedOn,
      cacheJustFetched: Boolean(cache._justFetched),
      cacheStartDate: cache.startDate,
      cacheEndDate: cache.endDate,
      cacheDateCount: cache.rates ? Object.keys(cache.rates).length : 0,
      activeSuccessCount,
      historySuccessCount,
      skippedHistoryCount,
      missingDates: missingDates.slice(0, 30),
      changed
    }
  };
}

function isHistoryRateRefreshEligibleWorker(record, days, timeZone) {
  if (days < 0) return false;
  const today = todayString(timeZone);
  const refDate = normalizeDateOnlyWorker(record.endDate) || normalizeDateOnlyWorker(record.deletedAt);
  if (!refDate) return false;
  const diffFromRefToToday = dateDiffDays(refDate, today);
  if (diffFromRefToToday >= 0 && diffFromRefToToday <= days) return true;
  const diffFromTodayToRef = dateDiffDays(today, refDate);
  return diffFromTodayToRef >= 0 && diffFromTodayToRef <= days;
}

function normalizeDateOnlyWorker(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

async function sendCloudTestEmail(env, body = {}) {
  const { data } = await readGithubFile(env);
  const cfg = normalizeEmailReminder(data.settings && data.settings.emailReminder);
  const timeZone = normalizeTimeZone(data.settings && data.settings.timeZone);
  const to = body.mailTo || body.to || cfg.mailTo;
  if (!to) throw new Error('mailTo is empty. Please set recipient email first.');

  const fakeRecord = {
    id: 'test-email',
    bank: '测试银行',
    principalTry: 50000,
    principalPlusInterestTry: 52000,
    annualRateTry: 40,
    endDate: todayString(timeZone),
    tryCnyOpen: 0.15,
    tryCnyNow: 0.15,
    usdCnyOpen: 7,
    usdCnyNow: 7,
    reminderEnabled: true,
    remark: '这是一封云端测试邮件，不代表真实定存。'
  };
  const calc = getCalc(fakeRecord, timeZone);
  const subject = '[测试] ' + renderTemplate(cfg.subjectTemplate, fakeRecord, calc, 0);
  const text = renderTemplate(cfg.bodyTemplate, fakeRecord, calc, 0);

  const resendResult = await sendEmailWithResend(env, to, subject, text);
  return { to, subject, timeZone, resendResult };
}

async function sendEmailWithResend(env, to, subject, text) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured.');
  if (!env.MAIL_FROM) throw new Error('MAIL_FROM is not configured.');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [to],
      subject,
      text
    })
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.message || payload.error || `Resend failed: ${res.status}`);
  }

  return payload;
}

function normalizeLockTimeoutMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 2;
  return Math.min(1440, Math.max(0, Math.round(n)));
}

function normalizeData(data) {
  data = data || {};
  const rawSettings = data && data.settings ? data.settings : {};
  const settings = {
    ...DEFAULT_DATA.settings,
    ...rawSettings,
    emailReminder: normalizeEmailReminder(rawSettings.emailReminder),
    sentReminders: rawSettings.sentReminders && typeof rawSettings.sentReminders === 'object' ? rawSettings.sentReminders : {},
    recordTombstones: rawSettings.recordTombstones && typeof rawSettings.recordTombstones === 'object' ? rawSettings.recordTombstones : {},
    timeZone: normalizeTimeZone(rawSettings.timeZone || DEFAULT_DATA.settings.timeZone),
    lockTimeoutMinutes: normalizeLockTimeoutMinutes(rawSettings.lockTimeoutMinutes),
    exchangeRateHostRefreshLatestApi: rawSettings.exchangeRateHostRefreshLatestApi === 'YES' ? 'YES' : 'NO',
    exchangeRateHostBatchWindowDays: 365
  };

  return {
    activeRecords: Array.isArray(data.activeRecords) ? data.activeRecords : [],
    historyRecords: Array.isArray(data.historyRecords) ? data.historyRecords : [],
    editLogs: Array.isArray(data.editLogs) ? data.editLogs : [],
    settings
  };
}

function mergeWorkerOwnedFields(incomingData, currentData) {
  const incoming = normalizeData(incomingData || {});
  if (!currentData || !currentData.settings) return incoming;

  const current = normalizeData(currentData);
  incoming.settings = incoming.settings || {};

  // These fields are written by Worker Cron/manual cloud actions. A browser tab can easily hold
  // stale data, so a normal frontend save must not delete or roll back these server-side fields.
  const workerOwnedKeys = [
    'sentReminders',
    'mailLastExecution',
    'exchangeRateHostYearCache',
    'lastRateFetchDate'
  ];

  workerOwnedKeys.forEach(key => {
    if (current.settings[key] !== undefined && current.settings[key] !== null) {
      incoming.settings[key] = current.settings[key];
    }
  });

  return incoming;
}

function normalizeEmailReminder(value) {
  const raw = value || {};
  return {
    ...DEFAULT_EMAIL_REMINDER,
    ...raw,
    enabled: Boolean(raw.enabled),
    mailTo: raw.mailTo || '',
    advanceDays: normalizeAdvanceDays(raw.advanceDays),
    dueTodayIntervalHours: normalizeDueTodayIntervalHours(raw.dueTodayIntervalHours),
    pushStartTime: normalizeTimeOfDay(raw.pushStartTime),
    pushEndTime: normalizeTimeOfDay(raw.pushEndTime),
    onlyEnabledRecords: raw.onlyEnabledRecords !== false,
    fields: normalizeMailFields(raw.fields),
    subjectTemplate: raw.subjectTemplate || DEFAULT_EMAIL_REMINDER.subjectTemplate,
    bodyTemplate: raw.bodyTemplate || DEFAULT_EMAIL_REMINDER.bodyTemplate
  };
}

function normalizeAdvanceDays(value) {
  if (value === null || value === undefined || String(value).trim() === '') return [];
  let arr = Array.isArray(value) ? value : String(value || '').split(',');
  arr = arr.map(x => parseInt(String(x).trim(), 10)).filter(x => Number.isFinite(x) && x >= 0);
  return Array.from(new Set(arr)).sort((a, b) => b - a);
}

function normalizeDueTodayIntervalHours(value) {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  const n = parseInt(String(value).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : '';
}

function normalizeMailFields(fields) {
  const allowed = MAIL_TEMPLATE_VARIABLES;
  const arr = Array.isArray(fields) ? fields : [];
  const out = arr.filter(x => allowed.includes(x));
  return out;
}

function getCalc(r, timeZone) {
  const depositDays = Math.max(dateDiffDays(r.startDate, r.endDate), 0);
  const remainingDays = dateDiffDays(todayString(timeZone), r.endDate);
  const principalTry = n(r.principalTry);
  const storedTotal = n(r.principalPlusInterestTry);
  const legacyInterest = n(r.interestTry);
  const principalPlusInterestTry = storedTotal > 0 ? storedTotal : principalTry + legacyInterest;
  const interestTry = principalPlusInterestTry - principalTry;
  const principalCny = principalTry * n(r.tryCnyOpen);
  const principalUsd = safeDiv(principalCny, n(r.usdCnyOpen));
  const principalPlusInterestCny = principalPlusInterestTry * n(r.tryCnyNow);
  const principalPlusInterestUsd = safeDiv(principalPlusInterestCny, n(r.usdCnyNow));
  const gainTry = interestTry;
  const gainCny = principalPlusInterestCny - principalCny;
  const gainUsd = principalPlusInterestUsd - principalUsd;
  const interestCny = interestTry * n(r.tryCnyNow);
  const annualRateCny = depositDays > 0 && principalCny > 0 ? gainCny / principalCny / depositDays * 365 * 100 : 0;
  return { depositDays, remainingDays, principalPlusInterestTry, interestTry, principalCny, principalUsd, principalPlusInterestCny, principalPlusInterestUsd, gainTry, gainCny, gainUsd, interestCny, annualRateCny };
}

function renderTemplate(template, r, c, index) {
  const values = mailValueMap(r, c, index);
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? '');
}

function buildSelectedFieldsText(fields, r, c) {
  const values = mailValueMap(r, c);
  return normalizeMailFields(fields).map(k => `${k}：${values[k] ?? ''}`).join('\n');
}

function mailValueMap(r, c, index) {
  return {
    seq: Number.isFinite(index) ? index + 1 : '',
    bank: r.bank || '',
    openDate: r.openDate || '',
    startDate: r.startDate || '',
    endDate: r.endDate || '',
    depositDays: c.depositDays,
    remainingDays: c.remainingDays,
    usdCnyOpen: r.usdCnyOpen ?? '',
    tryCnyOpen: r.tryCnyOpen ?? '',
    usdCnyNow: r.usdCnyNow ?? '',
    tryCnyNow: r.tryCnyNow ?? '',
    usdCnyEnd: r.usdCnyNow ?? '',
    tryCnyEnd: r.tryCnyNow ?? '',
    principalTry: fmt(r.principalTry),
    interestTry: fmt(c.interestTry),
    principalPlusInterestTry: fmt(c.principalPlusInterestTry),
    principalCny: fmt(c.principalCny),
    principalUsd: fmt(c.principalUsd),
    principalPlusInterestCny: fmt(c.principalPlusInterestCny),
    principalPlusInterestUsd: fmt(c.principalPlusInterestUsd),
    interestCny: fmt(c.interestCny),
    gainTry: fmt(c.gainTry),
    gainCny: fmt(c.gainCny),
    gainUsd: fmt(c.gainUsd),
    annualRateTry: fmt(r.annualRateTry, 2) + '%',
    annualRateCny: fmt(c.annualRateCny, 2) + '%',
    reminderEnabled: r.reminderEnabled ? 'YES' : 'NO',
    remark: r.remark || ''
  };
}

function todayString(timeZone = 'UTC') {
  return dateToTimeZoneYmd(new Date(), normalizeTimeZone(timeZone));
}

function normalizeTimeZone(value) {
  const tz = String(value || '').trim() || 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return tz;
  } catch (_) {
    return 'UTC';
  }
}

function dateToTimeZoneYmd(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateDiffDays(a, b) {
  if (!a || !b) return 0;
  const start = new Date(a + 'T00:00:00Z');
  const end = new Date(b + 'T00:00:00Z');
  return Math.round((end - start) / 86400000);
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function safeDiv(a, b) {
  return b ? a / b : 0;
}

function fmt(v, digits = 2) {
  const x = Number(v);
  if (!Number.isFinite(x)) return '0.00';
  return x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function githubHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'deposit-manager-worker',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-app-password',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function base64EncodeUnicode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64DecodeUnicode(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function encodeURIComponentPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}
