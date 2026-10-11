/* Plano de treino: fonte única da verdade (navegador e Node). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PLAN = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const WEEK_COUNT = 12;
  const WARM_MIN = 5;
  const COOL_MIN = 5;

  const ATHLETES = Object.freeze([
    { id: 'willians', name: 'Willians', track: 'R', label: 'Retorno: já correu 5K' },
  ]);

  const SLOTS = Object.freeze({
    A: { title: 'Base', when: 'Segunda-feira', rpe: '3–5' },
    B: { title: 'Leve', when: 'Quarta ou quinta', rpe: '3–4' },
    C: { title: 'Intermediário', when: 'Sexta a domingo', rpe: '3–5' },
  });

  const MESOS = Object.freeze([
    { id: 1, name: 'Adaptação', weeks: [1, 4], goal: 'Criar o hábito: 3 sessões por semana, sempre em ritmo de conversa.' },
    { id: 2, name: 'Base', weeks: [5, 8], goal: 'Aumentar o tempo correndo e reduzir as pausas de caminhada.' },
    { id: 3, name: 'Contínuo', weeks: [9, 12], goal: 'Consolidar blocos longos e fechar com o teste de 5 km.' },
  ]);

  const WEEK_KIND = { 4: 'descarga', 8: 'descarga', 11: 'polimento', 12: 'teste' };
  const KIND_NOTE = {
    carga: 'Semana de progressão.',
    descarga: 'Descarga: menos volume para o corpo assimilar o treino. Não compense depois.',
    polimento: 'Polimento: volume menor para chegar descansado ao teste.',
    teste: 'Semana do teste: 5 km na segunda; depois, duas corridas leves de recuperação.',
  };

  /* [corrida min, caminhada min, repetições]. Caminhada 0 = corrida contínua. */
  const BLOCKS = {
    1: { A: [4, 1, 5], B: [4, 1, 5], C: [5, 1, 4] },
    2: { A: [5, 1, 4], B: [5, 1, 4], C: [6, 1, 4] },
    3: { A: [6, 1, 4], B: [6, 1, 4], C: [8, 1, 3] },
    4: { A: [4, 1, 3], B: [5, 1, 4], C: [6, 1, 3] },
    5: { A: [6, 1, 4], B: [6, 1, 4], C: [8, 1, 3] },
    6: { A: [8, 1, 3], B: [8, 1, 3], C: [10, 1, 3] },
    7: { A: [8, 1, 3], B: [10, 1, 2], C: [12, 1, 3] },
    8: { A: [6, 1, 3], B: [8, 1, 2], C: [10, 1, 2] },
    9: { A: [10, 1, 2], B: [15, 1, 2] },
    10: { A: [10, 1, 2], B: [25, 0, 1] },
    11: { A: [8, 1, 2], B: [20, 0, 1], C: [10, 1, 2] },
    12: { B: [8, 1, 2], C: [10, 1, 2] },
  };

  /* Fartlek leve na sessão C, semanas 9 e 10. */
  const FARTLEK = {
    9: { lead: 8, reps: 6, hard: 1, easy: 2 },
    10: { lead: 8, reps: 8, hard: 1, easy: 2 },
  };

  const TEST = {
    main: '5 km no ritmo de conversa. Corra enquanto der para conversar; caminhe 1 min sempre que precisar e retome.',
    mainMin: 40,
    runMin: 30,
  };

  const TIPS = {
    A: 'Pode ser na esteira: inclinação 1% e ritmo pelo esforço (dá para conversar), não pelo número.',
    B: 'Pode ser na esteira: inclinação 1% e ritmo pelo esforço (dá para conversar), não pelo número.',
    C: 'Pode ser na esteira: inclinação 1% e ritmo pelo esforço (dá para conversar), não pelo número.',
  };

  const SESSION_ID_RE = /^(0[1-9]|1[0-2])-[ABC]-[JR]$/;

  const pad = (n) => String(n).padStart(2, '0');
  const mesoOf = (week) => MESOS.find((m) => week >= m.weeks[0] && week <= m.weeks[1]);

  function fromBlock([r, w, n]) {
    if (w === 0) return { type: 'Corrida contínua', main: `${r} min de corrida contínua`, mainMin: r, runMin: r };
    return {
      type: 'Corrida/caminhada',
      main: `${n}× (${r} min correndo + ${w} min caminhando)`,
      mainMin: n * (r + w),
      runMin: r * n,
    };
  }

  function fromFartlek({ lead, reps, hard, easy }) {
    const run = lead + reps * (hard + easy);
    return {
      type: 'Fartlek leve',
      main: `${lead} min de trote leve, depois ${reps}× (${hard} min mais forte, RPE 6–7 + ${easy} min de trote leve)`,
      mainMin: run,
      runMin: run,
    };
  }

  function core(week, slot) {
    if (slot === 'A' && week === WEEK_COUNT) return { type: 'Teste 5K', ...TEST };
    if (slot === 'C' && FARTLEK[week]) return fromFartlek(FARTLEK[week]);
    return fromBlock(BLOCKS[week][slot]);
  }

  function build(week, slot, track) {
    const meso = mesoOf(week);
    const c = core(week, slot);
    const isTest = c.type === 'Teste 5K';
    return Object.freeze({
      /* A mantém o sufixo J: o Code.gs já implantado só aceita ids -J e -R. */
      id: `${pad(week)}-${slot}-${slot === 'A' ? 'J' : track}`,
      week,
      slot,
      track,
      meso: meso.id,
      mesoName: meso.name,
      kind: WEEK_KIND[week] || 'carga',
      title: SLOTS[slot].title,
      when: SLOTS[slot].when,
      ...c,
      warmMin: WARM_MIN,
      coolMin: COOL_MIN,
      totalMin: WARM_MIN + c.mainMin + COOL_MIN,
      rpe: isTest ? '4–6' : SLOTS[slot].rpe,
      tip: TIPS[slot],
    });
  }

  const trackFor = (athleteId) => {
    const a = ATHLETES.find((x) => x.id === athleteId);
    if (!a) throw new Error(`Atleta desconhecido: ${athleteId}`);
    return a.track;
  };

  function weekSessions(week, athleteId) {
    const track = trackFor(athleteId);
    return ['A', 'B', 'C'].map((slot) => build(week, slot, track));
  }

  function sessionsFor(athleteId) {
    const out = [];
    for (let w = 1; w <= WEEK_COUNT; w += 1) out.push(...weekSessions(w, athleteId));
    return out;
  }

  const weeklyRunMinutes = (week, athleteId) =>
    weekSessions(week, athleteId).reduce((sum, s) => sum + s.runMin, 0);

  function distinctSessions() {
    const out = [];
    for (let w = 1; w <= WEEK_COUNT; w += 1) {
      for (const slot of ['A', 'B', 'C']) out.push(build(w, slot, 'R'));
    }
    return out;
  }

  const WEEKS = Object.freeze(
    Array.from({ length: WEEK_COUNT }, (_, i) => {
      const week = i + 1;
      const kind = WEEK_KIND[week] || 'carga';
      return Object.freeze({ week, meso: mesoOf(week).id, kind, note: KIND_NOTE[kind] });
    })
  );

  const CSV_COLUMNS = [
    ['sessao_id', (s) => s.id],
    ['semana', (s) => s.week],
    ['mesociclo', (s) => `${s.meso} - ${s.mesoName}`],
    ['tipo_semana', (s) => s.kind],
    ['slot', (s) => s.slot],
    ['dia_sugerido', (s) => s.when],
    ['tipo', (s) => s.type],
    ['treino_principal', (s) => s.main],
    ['aquecimento_min', (s) => s.warmMin],
    ['principal_min', (s) => s.mainMin],
    ['desaquecimento_min', (s) => s.coolMin],
    ['total_min', (s) => s.totalMin],
    ['rpe_alvo', (s) => s.rpe],
  ];

  const csvCell = (v) => {
    const t = String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };

  function toCsv() {
    const header = CSV_COLUMNS.map(([name]) => name).join(',');
    const rows = distinctSessions().map((s) => CSV_COLUMNS.map(([, fn]) => csvCell(fn(s))).join(','));
    return `${[header, ...rows].join('\n')}\n`;
  }

  return Object.freeze({
    WEEK_COUNT,
    ATHLETES,
    SLOTS,
    MESOS,
    WEEKS,
    SESSION_ID_RE,
    sessionsFor,
    weekSessions,
    weeklyRunMinutes,
    distinctSessions,
    toCsv,
  });
});
