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
    const sleepWorst = 24 - H(e.commuteMin) - H(e.classMaxDayMin) - (work + study) / a.campusDays - (dom + read + self) / 7 - a.essentialsPerDay;
    return { sleepAvail, sleepWorst, commute, class: cls, intern: work, domestic: dom, reading: read, study, selfcare: self, sleep, essentials: ess, free: 168 - used };
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

  return { UFF, DEFAULTS, FIELDS, ALERT, GROUPS, CATS, MIN_N, straightKm, complete, week, composition, mean, median, quantile, regress, hm, fmt };
})();
