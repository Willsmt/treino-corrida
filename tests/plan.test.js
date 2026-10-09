'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const PLAN = require('../js/plan.js');

const IDS = PLAN.ATHLETES.map((a) => a.id);
const KIND = (week) => PLAN.WEEKS[week - 1].kind;

/* Última semana de carga anterior à semana dada. */
function previousLoadWeek(week) {
  for (let w = week - 1; w >= 1; w -= 1) if (KIND(w) === 'carga') return w;
  return null;
}

test('12 semanas e 3 sessões por semana por atleta', () => {
  assert.equal(PLAN.WEEK_COUNT, 12);
  for (const id of IDS) {
    assert.equal(PLAN.sessionsFor(id).length, 36);
    for (let w = 1; w <= 12; w += 1) {
      assert.deepEqual(PLAN.weekSessions(w, id).map((s) => s.slot), ['A', 'B', 'C']);
    }
  }
});

test('ids são únicos por atleta e seguem o padrão', () => {
  for (const id of IDS) {
    const ids = PLAN.sessionsFor(id).map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
    ids.forEach((x) => assert.match(x, PLAN.SESSION_ID_RE));
  }
});

test('sessão de segunda é a mesma (mesmo id e conteúdo) para os dois', () => {
  for (let w = 1; w <= 12; w += 1) {
    const [a1] = PLAN.weekSessions(w, 'willians');
    const [a2] = PLAN.weekSessions(w, 'suellen');
    assert.equal(a1.id, a2.id);
    assert.equal(a1.main, a2.main);
    assert.equal(a1.joint, true);
  }
});

test('progressão: tempo correndo sobe no máximo 15% entre semanas de carga', () => {
  for (const id of IDS) {
    for (let w = 2; w <= 10; w += 1) {
      if (KIND(w) !== 'carga') continue;
      const prev = previousLoadWeek(w);
      if (prev === null) continue;
      const growth = PLAN.weeklyRunMinutes(w, id) / PLAN.weeklyRunMinutes(prev, id) - 1;
      assert.ok(growth <= 0.15, `${id} semana ${w}: +${(growth * 100).toFixed(1)}%`);
    }
  }
});

test('descarga e polimento reduzem 20–40% do volume da última semana de carga', () => {
  for (const id of IDS) {
    for (const w of [4, 8, 11]) {
      const prev = previousLoadWeek(w);
      const drop = 1 - PLAN.weeklyRunMinutes(w, id) / PLAN.weeklyRunMinutes(prev, id);
      assert.ok(drop >= 0.2 && drop <= 0.4, `${id} semana ${w}: -${(drop * 100).toFixed(1)}%`);
    }
  }
});

test('semana 12: segunda é o teste de 5 km', () => {
  const [a] = PLAN.weekSessions(12, 'suellen');
  assert.equal(a.type, 'Teste 5K');
  assert.equal(KIND(12), 'teste');
});

test('trilha de retorno corre mais que a iniciante em B+C em toda semana', () => {
  for (let w = 1; w <= 12; w += 1) {
    const sum = (id) => PLAN.weekSessions(w, id).filter((s) => s.slot !== 'A').reduce((t, s) => t + s.runMin, 0);
    assert.ok(sum('willians') > sum('suellen'), `semana ${w}`);
  }
});

test('nenhuma sessão passa de 60 min no total e todas começam com aquecimento', () => {
  for (const id of IDS) {
    for (const s of PLAN.sessionsFor(id)) {
      assert.ok(s.totalMin <= 60, `${s.id}: ${s.totalMin} min`);
      assert.equal(s.warmMin, 5);
      assert.equal(s.coolMin, 5);
      assert.equal(s.totalMin, s.warmMin + s.mainMin + s.coolMin);
    }
  }
});

test('mesociclos cobrem as 12 semanas sem buracos', () => {
  const covered = PLAN.MESOS.flatMap((m) => {
    const out = [];
    for (let w = m.weeks[0]; w <= m.weeks[1]; w += 1) out.push(w);
    return out;
  });
  assert.deepEqual(covered, Array.from({ length: 12 }, (_, i) => i + 1));
});

test('CSV: cabeçalho + 60 linhas, 15 colunas, ids únicos', () => {
  const lines = PLAN.toCsv().trimEnd().split('\n');
  assert.equal(lines.length, 61);
  const cols = lines[0].split(',').length;
  assert.equal(cols, 15);
  const ids = lines.slice(1).map((l) => l.split(',')[0]);
  assert.equal(new Set(ids).size, 60);
});
