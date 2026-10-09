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
    { id: 'suellen', name: 'Suellen', track: 'I', label: 'Iniciante: corre até ~1 km' },
  ]);

  const SLOTS = Object.freeze({
    A: { title: 'Juntos', when: 'Segunda-feira', joint: true, rpe: '3–5' },
    B: { title: 'Leve', when: 'Quarta ou quinta', joint: false, rpe: '3–4' },
    C: { title: 'Intermediário', when: 'Sexta a domingo', joint: false, rpe: '3–5' },
  });

  const MESOS = Object.freeze([
    { id: 1, name: 'Adaptação', weeks: [1, 4], goal: 'Criar o hábito: 3 sessões por semana, sempre em ritmo de conversa.' },
    { id: 2, name: 'Base', weeks: [5, 8], goal: 'Aumentar o tempo correndo e reduzir as pausas de caminhada.' },
    { id: 3, name: 'Contínuo', weeks: [9, 12], goal: 'Consolidar blocos longos e fechar com o teste de 5 km juntos.' },
  ]);

  const WEEK_KIND = { 4: 'descarga', 8: 'descarga', 11: 'polimento', 12: 'teste' };
  const KIND_NOTE = {
    carga: 'Semana de progressão.',
    descarga: 'Descarga: menos volume para o corpo assimilar o treino. Não compense depois.',
    polimento: 'Polimento: volume menor para chegar descansado ao teste.',
    teste: 'Semana do teste: 5 km juntos na segunda; depois, duas corridas leves de recuperação.',
  };

  /* [corrida min, caminhada min, repetições]. Caminhada 0 = corrida contínua. */
  const BLOCKS = {
    I: {
      1: { A: [3, 2, 5], B: [3, 2, 4], C: [3, 2, 4] },
      2: { A: [4, 2, 4], B: [3, 2, 4], C: [4, 2, 4] },
      3: { A: [5, 2, 4], B: [3, 2, 4], C: [5, 2, 3] },
      4: { A: [4, 2, 3], B: [3, 2, 3], C: [4, 2, 3] },
      5: { A: [6, 2, 4], B: [4, 2, 3], C: [5, 2, 3] },
      6: { A: [8, 2, 3], B: [5, 2, 3], C: [6, 2, 3] },
      7: { A: [10, 2, 3], B: [5, 2, 3], C: [6, 2, 3] },
      8: { A: [8, 2, 3], B: [5, 2, 2], C: [6, 2, 2] },
      9: { A: [10, 2, 3], B: [6, 2, 3], C: [7, 2, 3] },
      10: { A: [12, 2, 3], B: [8, 2, 2], C: [10, 2, 2] },
      11: { A: [10, 2, 2], B: [8, 2, 2], C: [6, 2, 2] },
      12: { B: [5, 2, 3], C: [5, 2, 2] },
    },
    R: {
      1: { B: [4, 1, 5], C: [5, 1, 4] },
      2: { B: [5, 1, 4], C: [6, 1, 4] },
      3: { B: [6, 1, 4], C: [8, 1, 3] },
      4: { B: [5, 1, 4], C: [6, 1, 3] },
      5: { B: [6, 1, 4], C: [8, 1, 3] },
      6: { B: [8, 1, 3], C: [10, 1, 3] },
      7: { B: [10, 1, 2], C: [12, 1, 3] },
      8: { B: [8, 1, 2], C: [10, 1, 2] },
      9: { B: [15, 1, 2] },
      10: { B: [25, 0, 1] },
      11: { B: [20, 0, 1], C: [10, 1, 2] },
      12: { B: [8, 1, 2], C: [10, 1, 2] },
    },
  };

  /* Fartlek leve só na trilha de retorno (C), semanas 9 e 10. */
  const FARTLEK = {
    9: { lead: 8, reps: 6, hard: 1, easy: 2 },
    10: { lead: 8, reps: 8, hard: 1, easy: 2 },
  };

  const TEST = {
    main: '5 km juntos no ritmo da Suellen. Corram enquanto der para conversar; caminhem 1 min sempre que precisar e retomem.',
    mainMin: 40,
    runMin: 30,
  };

  const TIPS = {
    A: 'O ritmo de quem está começando manda: se precisar de pausa, vocês pausam juntos.',
    B: 'Pode ser na esteira: inclinação 1% e ritmo pelo esforço (dá para conversar), não pelo número.',
    C: 'Pode ser na esteira: inclinação 1% e ritmo pelo esforço (dá para conversar), não pelo número.',
  };

  const TRACK_LABEL = { J: 'Juntos', I: 'Iniciante', R: 'Retorno' };
  const SESSION_ID_RE = /^(0[1-9]|1[0-2])-[ABC]-[JIR]$/;

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

  function core(week, slot, track) {
    if (slot === 'A' && week === WEEK_COUNT) return { type: 'Teste 5K', ...TEST };
    if (slot === 'A') return fromBlock(BLOCKS.I[week].A);
    if (slot === 'C' && track === 'R' && FARTLEK[week]) return fromFartlek(FARTLEK[week]);
    return fromBlock(BLOCKS[track][week][slot]);
  }

  function build(week, slot, track) {
    const meso = mesoOf(week);
    const c = core(week, slot, track);
    const isTest = c.type === 'Teste 5K';
    return Object.freeze({
      id: `${pad(week)}-${slot}-${track}`,
      week,
      slot,
      track,
      meso: meso.id,
      mesoName: meso.name,
      kind: WEEK_KIND[week] || 'carga',
      joint: SLOTS[slot].joint,
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
    return ['A', 'B', 'C'].map((slot) => build(week, slot, slot === 'A' ? 'J' : track));
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
      out.push(build(w, 'A', 'J'));
      for (const track of ['I', 'R']) out.push(build(w, 'B', track), build(w, 'C', track));
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
    ['trilha', (s) => TRACK_LABEL[s.track]],
    ['juntos', (s) => (s.joint ? 'sim' : 'nao')],
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
    TRACK_LABEL,
    sessionsFor,
    weekSessions,
    weeklyRunMinutes,
    distinctSessions,
    toCsv,
  });
});
