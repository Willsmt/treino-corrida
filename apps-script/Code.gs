/**
 * Backend do acompanhamento de treino (Google Apps Script, ligado à planilha).
 *
 * Deploy: Implantar > Nova implantação > App da Web
 *   Executar como: Eu | Quem pode acessar: Qualquer pessoa
 * Chave de acesso: Configurações do projeto > Propriedades do script > ACCESS_KEY
 * (nunca escreva a chave neste arquivo).
 */

const SHEET_LOG = 'Registro';
const HEADERS = ['atualizado_em', 'atleta_id', 'sessao_id', 'feito', 'duracao_min', 'distancia_km', 'rpe', 'observacao'];
const COL_NOTE = 8;
const ATHLETES = ['willians', 'suellen'];
const SESSION_RE = /^(0[1-9]|1[0-2])-[ABC]-[JIR]$/;
const MAX_BODY = 4000;

function doGet() {
  return json_({ ok: true, service: 'treino-corrida' });
}

function doPost(e) {
  try {
    const req = parse_(e);
    authorize_(req.key);
    if (req.action === 'list') return json_({ ok: true, records: list_() });
    if (req.action === 'upsert') return json_({ ok: true, record: upsert_(req.record) });
    fail_('Ação inválida.');
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: err && err.publicMessage ? err.publicMessage : 'Erro interno.' });
  }
}

/** Execute uma vez no editor para criar a aba Registro. */
function setup() {
  sheet_();
}

function parse_(e) {
  const raw = e && e.postData ? e.postData.contents : '';
  if (!raw || raw.length > MAX_BODY) fail_('Requisição inválida.');
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fail_('Requisição inválida.');
  }
}

function authorize_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('ACCESS_KEY');
  if (!expected) fail_('Servidor sem chave configurada.');
  if (!safeEqual_(String(key || ''), expected)) fail_('Chave de acesso incorreta.');
}

function safeEqual_(a, b) {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_LOG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_LOG);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(2, COL_NOTE, sh.getMaxRows() - 1, 1).setNumberFormat('@');
  }
  return sh;
}

function list_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh
    .getRange(2, 1, last - 1, HEADERS.length)
    .getValues()
    .map((row) => ({
      updated_at: String(row[0]),
      athlete_id: row[1],
      session_id: row[2],
      done: row[3] === true,
      duration_min: row[4] === '' ? null : Number(row[4]),
      distance_km: row[5] === '' ? null : Number(row[5]),
      rpe: row[6] === '' ? null : Number(row[6]),
      note: String(row[7] || ''),
    }));
}

function upsert_(input) {
  const rec = validate_(input);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    const last = sh.getLastRow();
    let target = last + 1;
    if (last >= 2) {
      const keys = sh.getRange(2, 2, last - 1, 2).getValues();
      for (let i = 0; i < keys.length; i += 1) {
        if (keys[i][0] === rec.athlete_id && keys[i][1] === rec.session_id) {
          target = i + 2;
          break;
        }
      }
    }
    const updatedAt = new Date().toISOString();
    sh.getRange(target, COL_NOTE).setNumberFormat('@');
    sh.getRange(target, 1, 1, HEADERS.length).setValues([
      [updatedAt, rec.athlete_id, rec.session_id, rec.done, rec.duration_min, rec.distance_km, rec.rpe, rec.note],
    ]);
    return {
      updated_at: updatedAt,
      athlete_id: rec.athlete_id,
      session_id: rec.session_id,
      done: rec.done,
      duration_min: rec.duration_min === '' ? null : rec.duration_min,
      distance_km: rec.distance_km === '' ? null : rec.distance_km,
      rpe: rec.rpe === '' ? null : rec.rpe,
      note: rec.note,
    };
  } finally {
    lock.releaseLock();
  }
}

function validate_(r) {
  if (!r || typeof r !== 'object') fail_('Registro inválido.');
  if (ATHLETES.indexOf(r.athlete_id) < 0) fail_('Atleta inválido.');
  if (typeof r.session_id !== 'string' || !SESSION_RE.test(r.session_id)) fail_('Sessão inválida.');
  return {
    athlete_id: r.athlete_id,
    session_id: r.session_id,
    done: r.done === true,
    duration_min: num_(r.duration_min, 0, 300, 'Duração'),
    distance_km: num_(r.distance_km, 0, 60, 'Distância'),
    rpe: num_(r.rpe, 1, 10, 'Esforço'),
    note: String(r.note == null ? '' : r.note).trim().slice(0, 280),
  };
}

function num_(value, min, max, label) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!isFinite(n) || n < min || n > max) fail_(label + ' fora do intervalo permitido.');
  return n;
}

function fail_(message) {
  const err = new Error(message);
  err.publicMessage = message;
  throw err;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
