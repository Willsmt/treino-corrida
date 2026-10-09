'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const LOGIC = require('../js/logic.js');
const PLAN = require('../js/plan.js');

const START = '2026-10-12'; // segunda-feira
const at = (y, m, d) => new Date(y, m - 1, d, 15, 30);

test('antes do início: conta os dias que faltam', () => {
  const p = LOGIC.planPosition(START, at(2026, 10, 9), 12);
  assert.deepEqual(p, { state: 'before', week: 1, daysToStart: 3 });
});

test('semana 1 vai de segunda a domingo', () => {
  assert.equal(LOGIC.planPosition(START, at(2026, 10, 12), 12).week, 1);
  assert.equal(LOGIC.planPosition(START, at(2026, 10, 18), 12).week, 1);
  assert.equal(LOGIC.planPosition(START, at(2026, 10, 19), 12).week, 2);
});

test('depois da semana 12 o plano é dado como concluído', () => {
  const p = LOGIC.planPosition(START, at(2027, 1, 20), 12);
  assert.equal(p.state, 'after');
  assert.equal(p.week, 12);
  assert.equal(LOGIC.planPosition(START, at(2027, 1, 4), 12).week, 12);
});

test('weekStartDate soma 7 dias por semana', () => {
  const d = LOGIC.weekStartDate(START, 12);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 11);
  assert.equal(d.getDate(), 28);
});

test('data inválida lança erro', () => {
  assert.throws(() => LOGIC.parseLocalDate('12/10/2026'));
});

test('validateEntry aceita campos vazios e vírgula decimal', () => {
  const r = LOGIC.validateEntry({ done: true, duration_min: '32', distance_km: '3,5', rpe: '', note: ' ok ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { done: true, duration_min: 32, distance_km: 3.5, rpe: null, note: 'ok' });
});

test('validateEntry rejeita valores fora do intervalo e texto longo', () => {
  const r = LOGIC.validateEntry({ done: true, duration_min: '400', distance_km: 'abc', rpe: '11', note: 'x'.repeat(281) });
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 4);
});

test('mergeRecords mantém o registro mais recente por atleta+sessão', () => {
  const a = { athlete_id: 'suellen', session_id: '01-A-J', done: false, updated_at: '2026-10-12T10:00:00Z' };
  const b = { athlete_id: 'suellen', session_id: '01-A-J', done: true, updated_at: '2026-10-12T11:00:00Z' };
  const c = { athlete_id: 'willians', session_id: '01-A-J', done: true, updated_at: '2026-10-12T09:00:00Z' };
  const merged = LOGIC.mergeRecords([b, c], [a]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((r) => r.athlete_id === 'suellen').done, true);
});

test('summarize conta sessões feitas por semana', () => {
  const sessions = PLAN.sessionsFor('suellen');
  const map = new Map();
  for (const id of ['01-A-J', '01-B-I', '02-A-J']) {
    map.set(LOGIC.recordKey('suellen', id), { done: true });
  }
  map.set(LOGIC.recordKey('suellen', '02-B-I'), { done: false });
  map.set(LOGIC.recordKey('willians', '03-A-J'), { done: true }); // outro atleta não conta
  const s = LOGIC.summarize(map, sessions, 'suellen');
  assert.equal(s.done, 3);
  assert.equal(s.total, 36);
  assert.deepEqual(s.byWeek[0], { week: 1, done: 2, total: 3 });
  assert.deepEqual(s.byWeek[1], { week: 2, done: 1, total: 3 });
  assert.equal(s.byWeek[2].done, 0);
});
