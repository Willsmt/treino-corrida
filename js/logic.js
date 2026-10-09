/* Regras puras da página (sem DOM): datas, validação e totais. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LOGIC = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY_MS = 86400000;

  const recordKey = (athleteId, sessionId) => `${athleteId}|${sessionId}`;

  function parseLocalDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    if (!m) throw new Error(`Data inválida: ${iso}`);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  /* Estado do plano em relação a hoje: antes, em andamento ou concluído. */
  function planPosition(startIso, now, weekCount) {
    const start = parseLocalDate(startIso);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((today - start) / DAY_MS);
    if (days < 0) return { state: 'before', week: 1, daysToStart: -days };
    const week = Math.floor(days / 7) + 1;
    if (week > weekCount) return { state: 'after', week: weekCount, daysToStart: 0 };
    return { state: 'running', week, daysToStart: 0 };
  }

  function weekStartDate(startIso, week) {
    const d = parseLocalDate(startIso);
    d.setDate(d.getDate() + (week - 1) * 7);
    return d;
  }

  function toNumberOrNull(v) {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }

  /* Valida o formulário e devolve valores normalizados. */
  function validateEntry(input) {
    const errors = [];
    const check = (label, raw, min, max) => {
      const n = toNumberOrNull(raw);
      if (n !== null && (Number.isNaN(n) || n < min || n > max)) errors.push(`${label} deve estar entre ${min} e ${max}.`);
      return n;
    };
    const value = {
      done: input.done === true,
      duration_min: check('Duração', input.duration_min, 0, 300),
      distance_km: check('Distância', input.distance_km, 0, 60),
      rpe: check('Esforço', input.rpe, 1, 10),
      note: String(input.note == null ? '' : input.note).trim(),
    };
    if (value.note.length > 280) errors.push('A observação aceita até 280 caracteres.');
    return { ok: errors.length === 0, errors, value };
  }

  /* Em conflito, vence o registro com updated_at mais recente. */
  function mergeRecords(local, remote) {
    const out = new Map();
    const put = (r) => {
      const k = recordKey(r.athlete_id, r.session_id);
      const cur = out.get(k);
      if (!cur || String(r.updated_at) >= String(cur.updated_at)) out.set(k, r);
    };
    local.forEach(put);
    remote.forEach(put);
    return [...out.values()];
  }

  function summarize(recordsByKey, sessions, athleteId) {
    const byWeek = new Map();
    let done = 0;
    for (const s of sessions) {
      const rec = recordsByKey.get(recordKey(athleteId, s.id));
      const isDone = Boolean(rec && rec.done);
      if (isDone) done += 1;
      const w = byWeek.get(s.week) || { week: s.week, done: 0, total: 0 };
      w.total += 1;
      if (isDone) w.done += 1;
      byWeek.set(s.week, w);
    }
    return { done, total: sessions.length, byWeek: [...byWeek.values()].sort((a, b) => a.week - b.week) };
  }

  return Object.freeze({ recordKey, parseLocalDate, planPosition, weekStartDate, validateEntry, mergeRecords, summarize });
});
