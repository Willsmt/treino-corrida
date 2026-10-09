'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { JSDOM, requestInterceptor } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' };

/* Serve os arquivos do projeto em http://localhost/ (localStorage exige origem real).
   Qualquer URL externa, como as fontes, recebe resposta vazia. */
const resources = () => ({
  interceptors: [
    requestInterceptor((request) => {
      const url = new URL(request.url);
      if (url.hostname !== 'localhost') return new Response('', { status: 204 });
      const file = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
      return new Response(fs.readFileSync(file), { headers: { 'Content-Type': TYPES[path.extname(file)] || 'text/plain' } });
    }),
  ],
});

async function openPage(extra = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    resources: resources(),
    pretendToBeVisual: true,
    ...extra,
  });
  await new Promise((resolve) => dom.window.addEventListener('load', resolve));
  return dom;
}

test('renderiza a pista (2 raias x 12 semanas) e 3 sessões na semana atual', async () => {
  const { window } = await openPage();
  const { document } = window;
  assert.equal(document.querySelectorAll('.cell').length, 24);
  assert.equal(document.querySelectorAll('.cell .bar').length, 72);
  assert.equal(document.querySelectorAll('.session').length, 3);
  assert.match(document.getElementById('week').textContent, /Semana 1/);
  assert.match(document.getElementById('status-line').textContent, /Começa na/);
  assert.equal(document.getElementById('banner').hidden, false, 'modo local deve avisar');
  window.close();
});

test('trocar de atleta mostra a trilha dele (B/C diferentes, A igual)', async () => {
  const { window } = await openPage();
  const { document } = window;
  const mainsOf = () => [...document.querySelectorAll('.session__main')].map((n) => n.textContent);
  const willians = mainsOf();
  [...document.querySelectorAll('.who button')].find((b) => b.textContent === 'Suellen').click();
  const suellen = mainsOf();
  assert.equal(document.body.dataset.me, 'suellen');
  assert.equal(willians[0], suellen[0]);
  assert.notEqual(willians[1], suellen[1]);
  window.close();
});

test('marcar treino como feito preenche a barra e persiste no navegador', async () => {
  const { window } = await openPage();
  const { document } = window;
  const form = document.querySelector('.session form');
  form.querySelector('input[type=checkbox]').checked = true;
  const [dur, dist] = form.querySelectorAll('.log__fields input');
  dur.value = '27';
  dist.value = '3,2';
  form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));

  assert.equal(form.querySelector('.feedback').textContent, 'Salvo neste aparelho.');
  assert.equal(document.querySelectorAll('.cell[data-athlete="willians"] .bar.is-done').length, 1);
  const saved = JSON.parse(window.localStorage.getItem('treino.records.v1'));
  assert.equal(saved.length, 1);
  assert.deepEqual(
    { id: saved[0].session_id, done: saved[0].done, dur: saved[0].duration_min, dist: saved[0].distance_km },
    { id: '01-A-J', done: true, dur: 27, dist: 3.2 }
  );
  window.close();
});

test('valor inválido não salva e explica o problema', async () => {
  const { window } = await openPage();
  const { document } = window;
  const form = document.querySelector('.session form');
  form.querySelectorAll('.log__fields input')[2].value = '15';
  form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
  await new Promise((r) => setTimeout(r, 20));
  assert.match(form.querySelector('.feedback').textContent, /Esforço deve estar entre 1 e 10/);
  assert.equal(window.localStorage.getItem('treino.records.v1'), null);
  window.close();
});

test('observação vinda da planilha é exibida como texto, nunca como HTML', async () => {
  const payload = '<img src=x onerror="window.__xss=1">';
  const dom = await openPage({
    beforeParse(window) {
      window.localStorage.setItem(
        'treino.records.v1',
        JSON.stringify([{ athlete_id: 'willians', session_id: '01-A-J', done: true, note: payload, updated_at: '2026-10-12T10:00:00Z' }])
      );
    },
  });
  const { document } = dom.window;
  assert.equal(document.querySelectorAll('.session img').length, 0);
  assert.equal(dom.window.__xss, undefined);
  assert.equal(document.querySelectorAll('.log__fields input')[3].value, payload);
  dom.window.close();
});
