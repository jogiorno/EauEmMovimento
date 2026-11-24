// Modelo compartilhado entre mapa e dashboard.
window.Model = (() => {
  // Escola de Arquitetura e Urbanismo da UFF, Rua Passo da Pátria, 156 – São Domingos, Niterói (coordenada do OSM/Nominatim).
  const UFF = { lat: -22.90464, lng: -43.13083, name: 'Escola de Arquitetura e Urbanismo – UFF (Praia Vermelha)' };

  const DEFAULTS = {
    sleepPerDay: 7,        // h de sono por dia
    essentialsPerDay: 2.5, // alimentação e higiene (tarefas domésticas, estudo, leitura e autocuidado vêm do estudante)
    campusDays: 5,         // dias por semana na EAU
    freeMin: 10,           // h/semana de lazer/vida social que se quer preservar
  };

  // Distância em linha reta (km) entre dois pontos [lat, lng].
  function straightKm(a, b) {
    const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  }

  // Tudo é informado pelo estudante em MINUTOS (commuteMin: por dia na EAU, ida + volta; classMaxDayMin: dia mais cheio de
  // aula; o resto: por semana). O modelo e o site trabalham em horas.
  const FIELDS = ['commuteMin', 'classWeekMin', 'classMaxDayMin', 'workMin', 'domesticMin', 'readingMin', 'studyMin', 'selfcareMin'];
  const complete = e => FIELDS.every(k => e[k] != null);
  const H = m => m / 60;

  function week(e, a) {
    const commute = H(e.commuteMin) * a.campusDays, cls = H(e.classWeekMin), work = H(e.workMin), dom = H(e.domesticMin),
      read = H(e.readingMin), study = H(e.studyMin), self = H(e.selfcareMin);
    const sleep = a.sleepPerDay * 7, ess = a.essentialsPerDay * 7;
    const used = commute + cls + work + dom + read + study + self + sleep + ess;
    const sleepAvail = (168 - used + sleep - a.freeMin) / 7; // h/noite, semana média
    // Dia mais pesado: maior dia de aula + deslocamento + parcela diária das demais atividades.
    const rawWorst = 24 - H(e.commuteMin) - H(e.classMaxDayMin) - (work + study) / a.campusDays - (dom + read + self) / 7 - a.essentialsPerDay;
    // Nunca abaixo de zero (só exibição; o banco não é alterado). over = a rotina declarada não cabe em 24 h.
    const sleepWorst = Math.max(0, rawWorst), over = rawWorst < 0;
    return { sleepAvail, sleepWorst, over, commute, class: cls, intern: work, domestic: dom, reading: read, study, selfcare: self, sleep, essentials: ess, free: 168 - used };
  }

  // ---------- Validação: limites físicos e de bom senso (valores em MINUTOS, distKm em km) ----------
  // Usada pelo formulário (rejeita o envio) e pelos gráficos (ignora registros antigos que não passam).
  // Os limites não dependem das premissas editáveis: usam DEFAULTS.campusDays.
  const LIMITS = { maxKm: 100, commuteMaxMin: 360, classWeekH: 60, classDayH: 14, workH: 60, domesticH: 60, readingH: 40, studyH: 60,
    selfcareH: 40, declaredWeekH: 140, declaredDayH: 22, minMinPerKm: 1.5 };
  function validate(e) {
    const L = LIMITS, h = k => H(e[k]), d = DEFAULTS.campusDays;
    if (!Number.isInteger(e.semester) || e.semester < 1 || e.semester > 10) return 'O período do curso deve ser de 1º a 10º.';
    if (!Number.isFinite(e.distKm) || e.distKm <= 0) return 'A moradia não tem distância válida até a EAU.';
    if (e.distKm > L.maxKm) return `A moradia fica a mais de ${L.maxKm} km da EAU, longe demais para ir e voltar no mesmo dia.`;
    if (FIELDS.some(k => !Number.isFinite(e[k]) || e[k] < 0)) return 'Há campos vazios ou negativos.';
    if (e.commuteMin < 1) return 'O deslocamento diário deve ser de pelo menos 1 minuto.';
    if (e.commuteMin > L.commuteMaxMin) return `Deslocamento de mais de ${L.commuteMaxMin / 60} h por dia (ida + volta) não é viável como rotina.`;
    if (e.commuteMin < e.distKm * L.minMinPerKm) return `Ir e voltar em ${e.commuteMin} min é rápido demais para ${e.distKm.toFixed(1)} km em linha reta (ida + volta ≈ ${(2 * e.distKm).toFixed(1)} km).`;
    if (h('classWeekMin') > L.classWeekH) return `Mais de ${L.classWeekH} h de aula por semana não é possível.`;
    if (h('classMaxDayMin') > L.classDayH) return `Mais de ${L.classDayH} h de aula em um único dia não é possível.`;
    if (e.classMaxDayMin > e.classWeekMin) return 'O dia mais cheio de aula não pode ter mais tempo que a semana inteira.';
    if (e.classWeekMin > 7 * e.classMaxDayMin) return 'As horas de aula da semana não cabem em 7 dias com esse máximo por dia.';
    for (const [k, lim, nome] of [['workMin', L.workH, 'trabalho/estágio'], ['domesticMin', L.domesticH, 'trabalho doméstico'], ['readingMin', L.readingH, 'leitura'],
      ['studyMin', L.studyH, 'estudo extraclasse'], ['selfcareMin', L.selfcareH, 'autocuidado']])
      if (h(k) > lim) return `Mais de ${lim} h semanais de ${nome} não é plausível.`;
    const weekly = H(e.commuteMin) * d + h('classWeekMin') + h('workMin') + h('domesticMin') + h('readingMin') + h('studyMin') + h('selfcareMin');
    if (weekly > L.declaredWeekH) return `As atividades informadas somam ${weekly.toFixed(0)} h por semana; sobrariam menos de ${168 - L.declaredWeekH} h para dormir e comer. Isso contradiz a física.`;
    const day = H(e.commuteMin) + h('classMaxDayMin') + (h('workMin') + h('studyMin')) / d + (h('domesticMin') + h('readingMin') + h('selfcareMin')) / 7;
    if (day > L.declaredDayH) return `O dia mais pesado somaria ${day.toFixed(0)} h de atividades; um dia só tem 24 h e é preciso dormir e comer.`;
    return null;
  }

  // Referências do gráfico 2 (pisos mínimos): OMS 2020 = 150 min/sem de atividade física moderada; ECTS = 1.500 a 1.800 h/ano de trabalho do estudante em tempo integral ÷ 40 semanas letivas (LDB: 200 dias) ≈ 38 a 45 h/sem; adotamos 40 h, aulas incluídas.
  const REFS = { selfcareH: 2.5, totalWorkloadH: 40 };
  const refStudy = w => Math.max(0, REFS.totalWorkloadH - w.class); // leitura + estudo extraclasse de referência para quem tem w.class h de aula

  // ---------- Simulação de semana de entrega: N horas por dia de aulas + trabalhos, somadas ao resto declarado ----------
  // Sono possível numa noite de entrega = 24 − deslocamento − horas de entrega − estágio/trabalho (por dia na EAU) − casa e autocuidado (por dia) − alimentação/higiene.
  // Leitura e estudo extraclasse ficam dentro das horas de entrega (não são somados de novo). Nunca abaixo de zero.
  function delivery(e, a, hours) {
    const raw = 24 - H(e.commuteMin) - hours - H(e.workMin) / a.campusDays - (H(e.domesticMin) + H(e.selfcareMin)) / 7 - a.essentialsPerDay;
    return Math.max(0, raw);
  }

  // ---------- Categorias, grupos e cores: ÚNICA fonte para todos os gráficos ----------
  // Grupos e paleta semântica: azul acinzentado = formação; terracota = trabalho; cinza = vida cotidiana;
  // verde acinzentado = recuperação. O vermelho (#d6001c) é reservado para déficit e situações críticas.
  const ALERT = '#d6001c';
  const GROUPS = [['formacao', 'Formação', '#5b7a99'], ['trabalho', 'Trabalho', '#c0653f'],
    ['reproducao', 'Reprodução cotidiana', '#8d98a8'], ['recuperacao', 'Recuperação', '#7a9a8a']];
  // [chave em week(), rótulo, cor, grupo, origem]. Origem: declarado pelo estudante, presumido pelo site (premissa) ou residual.
  const CATS = [
    ['class', 'Aulas', '#5b7a99', 'formacao', 'declarado'],
    ['study', 'Estudo extraclasse', '#7f9bb5', 'formacao', 'declarado'],
    ['reading', 'Leitura', '#a3b8cc', 'formacao', 'declarado'],
    ['intern', 'Trabalho/estágio', '#c0653f', 'trabalho', 'declarado'],
    ['commute', 'Deslocamento', '#6f7782', 'reproducao', 'declarado'],
    ['domestic', 'Trabalho doméstico', '#8d98a8', 'reproducao', 'declarado'],
    ['essentials', 'Alimentação e higiene (presumido)', '#c3c9d2', 'reproducao', 'presumido'],
    ['selfcare', 'Autocuidado', '#5f8a78', 'recuperacao', 'declarado'],
    ['sleep', 'Sono de referência (presumido)', '#a9c4b6', 'recuperacao', 'presumido'],
    ['free', 'Tempo livre residual', '#d3e3da', 'recuperacao', 'residual'],
  ];
  const MIN_N = 3; // privacidade: resultados agregados de períodos com menos respostas que isso são ocultados

  // Composição das 168 h de uma semana (w = week(e, A)). O tempo livre residual nunca é negativo: se as horas ocupadas
  // passam de 168, a barra passa de 168 (nada é cortado nem contado duas vezes) e `total` mostra o excedente.
  function composition(w) {
    const c = {}; let total = 0;
    for (const [k] of CATS) { c[k] = k === 'free' ? Math.max(0, w.free) : w[k]; total += c[k]; }
    c.total = total; return c;
  }

  // ---------- Estatística (sem ruído: tudo recebe só valores válidos) ----------
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
  const quantile = (a, q) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), p = (s.length - 1) * q, i = Math.floor(p);
    return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (p - i); };
  const median = a => quantile(a, 0.5);
  // Correlação de Pearson e reta de mínimos quadrados; null quando não há variação suficiente.
  function regress(xs, ys) {
    const n = xs.length; if (n < 3) return null;
    const mx = mean(xs), my = mean(ys); let sxx = 0, syy = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
    if (!sxx || !syy) return null;
    const slope = sxy / sxx; return { n, r: sxy / Math.sqrt(sxx * syy), slope, intercept: my - slope * mx };
  }
  const hm = h => { const m = Math.round(Math.abs(h) * 60), a = Math.floor(m / 60), b = m % 60;
    return (Number.isFinite(h) && h < 0 && m ? '−' : '') + (a ? a + ' h' + (b ? ' ' + b + ' min' : '') : b + ' min'); }; // 5.2 → "5 h 12 min"
  const fmt = (n, d = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: d });

  return { UFF, DEFAULTS, FIELDS, LIMITS, REFS, refStudy, validate, delivery, ALERT, GROUPS, CATS, MIN_N, straightKm, complete, week, composition, mean, median, quantile, regress, hm, fmt };
})();
