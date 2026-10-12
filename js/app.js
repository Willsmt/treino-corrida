/* Página de acompanhamento: render, estado e sincronização com a planilha. */
(function () {
  'use strict';

  const { PLAN, LOGIC, Api } = window;
  const CFG = window.TREINO_CONFIG;

  const LS = {
    athlete: 'treino.athlete',
    key: 'treino.key',
    records: 'treino.records.v1',
    queue: 'treino.queue.v1',
  };

  const store = {
    get(name, fallback) {
      try {
        const raw = localStorage.getItem(name);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (_) {
        return fallback;
      }
    },
    set(name, value) {
      try {
        localStorage.setItem(name, JSON.stringify(value));
      } catch (_) {
        /* armazenamento indisponível: segue só em memória */
      }
    },
  };

  const keyOf = (r) => LOGIC.recordKey(r.athlete_id, r.session_id);
  const isAthlete = (id) => PLAN.ATHLETES.some((a) => a.id === id);

  const state = {
    athleteId: isAthlete(store.get(LS.athlete, '')) ? store.get(LS.athlete, '') : PLAN.ATHLETES[0].id,
    position: LOGIC.planPosition(CFG.START_DATE, new Date(), PLAN.WEEK_COUNT),
    week: 1,
    key: String(store.get(LS.key, '')),
    records: new Map(store.get(LS.records, []).filter((r) => r && isAthlete(r.athlete_id)).map((r) => [keyOf(r), r])),
    queue: new Set(store.get(LS.queue, [])),
    flushing: null,
  };
  state.week = state.position.week;

  const $ = (id) => document.getElementById(id);
  const els = {
    status: $('status-line'),
    who: $('who'),
    banner: $('banner'),
    track: $('track'),
    week: $('week'),
    keyDialog: $('key-dialog'),
    keyForm: $('key-form'),
    keyInput: $('key-input'),
    keyError: $('key-error'),
  };

  const dayLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dayShort = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });

  /* Monta elementos sem innerHTML: texto vindo da planilha nunca vira HTML. */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style') Object.assign(el.style, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }

  function persist() {
    store.set(LS.records, [...state.records.values()]);
    store.set(LS.queue, [...state.queue]);
  }

  /* ---------- sincronização ---------- */

  function setBanner(text, kind) {
    els.banner.hidden = !text;
    els.banner.textContent = text || '';
    if (kind) els.banner.dataset.kind = kind;
    else delete els.banner.dataset.kind;
  }

  function openKeyDialog(message) {
    els.keyError.hidden = !message;
    els.keyError.textContent = message || '';
    if (!els.keyDialog.open) els.keyDialog.showModal();
    els.keyInput.focus();
  }

  function flush() {
    if (state.flushing) return state.flushing;
    state.flushing = (async () => {
      try {
        for (const key of [...state.queue]) {
          const rec = state.records.get(key);
          if (rec) state.records.set(key, await Api.save(state.key, rec));
          state.queue.delete(key);
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err.message, isAuth: Boolean(err.isAuth) };
      } finally {
        persist();
        state.flushing = null;
      }
    })();
    return state.flushing;
  }

  async function refresh() {
    if (!Api.isRemote()) return;
    if (!state.key) return openKeyDialog();
    try {
      const sent = await flush();
      if (!sent.ok) throw Object.assign(new Error(sent.error), { isAuth: sent.isAuth });
      const remote = await Api.list(state.key);
      const merged = LOGIC.mergeRecords([...state.records.values()], remote);
      state.records = new Map(merged.map((r) => [keyOf(r), r]));
      persist();
      setBanner('');
      renderTrack();
      if (!els.week.contains(document.activeElement)) renderWeek();
    } catch (err) {
      if (err.isAuth) {
        state.key = '';
        store.set(LS.key, '');
        openKeyDialog(err.message);
      } else {
        setBanner(`${err.message} Seus registros ficam neste aparelho e seguem para a planilha na próxima atualização.`, 'error');
      }
    }
  }

  async function commit(athleteId, sessionId, value) {
    const rec = { athlete_id: athleteId, session_id: sessionId, ...value, updated_at: new Date().toISOString() };
    state.records.set(keyOf(rec), rec);
    if (!Api.isRemote()) {
      persist();
      return { ok: true, local: true };
    }
    state.queue.add(keyOf(rec));
    persist();
    if (!state.key) {
      openKeyDialog();
      return { ok: false, error: 'Informe a chave de acesso para enviar à planilha.' };
    }
    let result = await flush();
    if (result.ok && state.queue.size) result = await flush();
    if (!result.ok && result.isAuth) {
      state.key = '';
      store.set(LS.key, '');
      openKeyDialog(result.error);
    }
    return result;
  }

  /* ---------- render ---------- */

  function renderStatus() {
    const p = state.position;
    const start = LOGIC.weekStartDate(CFG.START_DATE, 1);
    let text;
    if (p.state === 'before') {
      const falta = p.daysToStart === 1 ? 'falta 1 dia' : `faltam ${p.daysToStart} dias`;
      text = `Começa na ${dayLong.format(start)} (${falta}).`;
    } else if (p.state === 'after') {
      text = 'Plano concluído. Hora de escolher o próximo objetivo.';
    } else {
      const meso = PLAN.MESOS.find((m) => p.week >= m.weeks[0] && p.week <= m.weeks[1]);
      text = `Semana ${p.week} de ${PLAN.WEEK_COUNT}, fase ${meso.name}. ${meso.goal}`;
    }
    els.status.textContent = text;
  }

  function renderWho() {
    document.body.dataset.me = state.athleteId;
    els.who.replaceChildren(
      ...PLAN.ATHLETES.map((a) =>
        h('button', { type: 'button', 'aria-pressed': String(a.id === state.athleteId), onclick: () => selectAthlete(a.id) }, a.name)
      )
    );
  }

  function renderTrack() {
    const current = state.position.state === 'running' ? state.position.week : null;
    const kids = [h('span')];
    for (const m of PLAN.MESOS) {
      kids.push(h('div', { class: 'track__meso', style: { gridColumn: `span ${m.weeks[1] - m.weeks[0] + 1}` }, text: m.name }));
    }
    kids.push(h('span'));
    for (let w = 1; w <= PLAN.WEEK_COUNT; w += 1) {
      kids.push(h('div', { class: 'track__num', 'aria-current': w === current ? 'date' : null }, h('span', { text: String(w) })));
    }

    PLAN.ATHLETES.forEach((a, i) => {
      if (i > 0) kids.push(h('div', { class: 'track__divider', 'aria-hidden': 'true' }));
      kids.push(h('div', { class: 'track__lane-label', 'data-athlete': a.id, text: a.name }));
      const sessions = PLAN.sessionsFor(a.id);
      for (const wk of LOGIC.summarize(state.records, sessions, a.id).byWeek) {
        const inWeek = sessions.filter((s) => s.week === wk.week);
        const kind = PLAN.WEEKS[wk.week - 1].kind;
        kids.push(
          h(
            'button',
            {
              type: 'button',
              class: 'cell',
              'data-athlete': a.id,
              'data-kind': kind,
              'aria-pressed': String(wk.week === state.week),
              'aria-label': `${a.name}, semana ${wk.week}: ${wk.done} de ${wk.total} treinos feitos`,
              onclick: () => selectWeek(wk.week),
            },
            inWeek.map((s) => {
              const rec = state.records.get(LOGIC.recordKey(a.id, s.id));
              return h('span', { class: `bar${s.joint ? ' bar--joint' : ''}${rec && rec.done ? ' is-done' : ''}` });
            })
          )
        );
      }
    });
    els.track.replaceChildren(...kids);
  }

  function field(label, value, { wide, ...attrs }) {
    const input = h('input', { type: 'text', autocomplete: 'off', ...attrs });
    input.value = value == null ? '' : String(value);
    return { input, el: h('label', { class: `field${wide ? ' field--wide' : ''}` }, h('span', { text: label }), input) };
  }

  function showFeedback(el, kind, text) {
    el.dataset.kind = kind;
    el.textContent = text;
  }

  function sessionView(s, weekStart) {
    const athleteId = state.athleteId;
    const rec = state.records.get(LOGIC.recordKey(athleteId, s.id));
    const partner = PLAN.ATHLETES.find((a) => a.id !== athleteId);
    const partnerRec = s.joint ? state.records.get(LOGIC.recordKey(partner.id, s.id)) : null;

    const done = h('input', { type: 'checkbox', id: `done-${s.id}` });
    done.checked = Boolean(rec && rec.done);
    const dur = field('Duração (min)', rec && rec.duration_min, { inputmode: 'decimal', maxlength: '5' });
    const dist = field('Distância (km)', rec && rec.distance_km, { inputmode: 'decimal', maxlength: '5' });
    const rpe = field('Esforço (1–10)', rec && rec.rpe, { inputmode: 'numeric', maxlength: '2' });
    const note = field('Como foi?', rec && rec.note, { maxlength: '280', wide: true });
    const feedback = h('p', { class: 'feedback' });
    const button = h('button', { type: 'submit', class: 'btn', text: 'Salvar' });

    const form = h(
      'form',
      {
        class: 'log',
        novalidate: true,
        onsubmit: async (ev) => {
          ev.preventDefault();
          const checked = LOGIC.validateEntry({
            done: done.checked,
            duration_min: dur.input.value,
            distance_km: dist.input.value,
            rpe: rpe.input.value,
            note: note.input.value,
          });
          if (!checked.ok) return showFeedback(feedback, 'error', checked.errors.join(' '));
          button.disabled = true;
          showFeedback(feedback, 'saving', 'Salvando…');
          const result = await commit(athleteId, s.id, checked.value);
          button.disabled = false;
          if (result.ok) showFeedback(feedback, 'saved', result.local ? 'Salvo neste aparelho.' : 'Salvo na planilha.');
          else showFeedback(feedback, 'error', `${result.error} Vai tentar de novo na próxima atualização.`);
          renderTrack();
          form.closest('.session').classList.toggle('is-done', checked.value.done);
        },
      },
      h('label', { class: 'done-toggle' }, done, 'Fiz este treino'),
      h('div', { class: 'log__fields' }, dur.el, dist.el, rpe.el, note.el),
      h('div', { class: 'log__row' }, button, feedback)
    );

    const title = s.type === 'Teste 5K' ? 'Teste de 5 km' : `Treino ${s.title.toLowerCase()}`;
    const when = s.joint ? `${dayLong.format(weekStart)}, juntos` : s.when;

    return h(
      'article',
      { class: `session${rec && rec.done ? ' is-done' : ''}`, 'data-joint': String(s.joint) },
      h(
        'div',
        { class: 'session__body' },
        h('p', { class: 'session__when', text: when }),
        h('h3', { class: 'session__title', text: title }),
        h('p', { class: 'session__main', text: s.main }),
        h(
          'ul',
          { class: 'session__facts' },
          h('li', { text: `${s.totalMin} min no total` }),
          h('li', { text: `${s.warmMin} min caminhando antes e ${s.coolMin} depois` }),
          h('li', { text: `Esforço ${s.rpe} de 10` })
        ),
        h('p', { class: 'session__tip', text: s.tip }),
        partnerRec && partnerRec.done ? h('p', { class: 'session__partner', text: `${partner.name} já marcou este treino como feito.` }) : null
      ),
      form
    );
  }

  function renderWeek() {
    const info = PLAN.WEEKS[state.week - 1];
    const meso = PLAN.MESOS.find((m) => m.id === info.meso);
    const start = LOGIC.weekStartDate(CFG.START_DATE, state.week);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    els.week.replaceChildren(
      h(
        'div',
        { class: 'week__head' },
        h('h2', { text: `Semana ${state.week}` }),
        h('p', { class: 'week__dates', text: `${dayShort.format(start)} a ${dayShort.format(end)}, fase ${meso.name}` })
      ),
      h('p', { class: 'week__note', text: `${info.note} Esforço é uma nota de 1 a 10: de 3 a 4 você ainda consegue conversar.` }),
      ...PLAN.weekSessions(state.week, state.athleteId).map((s) => sessionView(s, start))
    );
  }

  function renderAll() {
    renderStatus();
    renderWho();
    renderTrack();
    renderWeek();
  }

  function selectAthlete(id) {
    state.athleteId = id;
    store.set(LS.athlete, id);
    renderAll();
  }

  function selectWeek(week) {
    state.week = week;
    renderTrack();
    renderWeek();
  }

  /* ---------- eventos ---------- */

  els.keyForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const key = els.keyInput.value.trim();
    if (!key) return;
    state.key = key;
    store.set(LS.key, key);
    els.keyInput.value = '';
    els.keyDialog.close();
    refresh();
  });
  $('key-cancel').addEventListener('click', () => els.keyDialog.close());
  $('key-btn').addEventListener('click', () => (Api.isRemote() ? openKeyDialog() : setBanner('Modo local: ainda não há planilha configurada.')));
  $('refresh-btn').addEventListener('click', refresh);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });

  renderAll();
  if (Api.isRemote()) refresh();
  else setBanner('Modo local: os registros ficam só neste navegador. Configure a planilha (veja o README) para compartilhar com a Suellen.');
})();
