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

  // Categorias da semana (ordem de empilhamento), cor e tipo de tempo.
  const CATS = [
    ['class', 'Aulas', '#ffc857', 'institucional'],
    ['intern', 'Trabalho/estágio', '#ff9f5a', 'produtivo'],
    ['study', 'Estudo extraclasse', '#c792ea', 'produtivo'],
    ['reading', 'Leitura', '#7ddc8b', 'produtivo'],
    ['essentials', 'Alimentação e higiene', '#8d98a8', 'reprodutivo'],
    ['domestic', 'Trabalho doméstico', '#b08968', 'reprodutivo'],
    ['commute', 'Deslocamento', '#ff5c7a', 'reprodutivo'],
    ['selfcare', 'Autocuidado', '#4fb0ae', 'recuperacao'],
    ['sleep', 'Sono (referência)', '#6c7ae0', 'recuperacao'],
    ['free', 'Tempo livre', '#5fd4e6', 'recuperacao'],
  ];
  const GROUPS = [['institucional', 'Institucional', '#ffc857'], ['produtivo', 'Produtivo', '#c792ea'],
    ['reprodutivo', 'Reprodutivo', '#ff5c7a'], ['recuperacao', 'Recuperação', '#5fd4e6']];
  const GROUP_NOTE = 'Institucional: aulas. Produtivo: trabalho/estágio, estudo extraclasse e leitura. Reprodutivo: alimentação e higiene, trabalho doméstico e deslocamento. Recuperação: sono (de referência), tempo livre e autocuidado.';

  // Divide as 168 h em: informado pelo estudante, presumido pelo site e o que sobra para dormir.
  // Atenção: o deslocamento semanal usa "dias na EAU", que é premissa (minutos informados × dias).
  function split(w, a) {
    const declared = w.commute + w.class + w.intern + w.domestic + w.reading + w.study + w.selfcare;
    const presumed = w.essentials + a.freeMin;
    return { declared, presumed, residual: 168 - declared - presumed }; // residual = sono possível por semana (7 × sleepAvail)
  }

  // Premissas editáveis (compartilhadas entre Dados e Meu trajeto).
  const ASSUMP_KEY = 'eau-assump-v4';
  function loadAssump() {
    const A = JSON.parse(JSON.stringify(DEFAULTS));
    try { Object.assign(A, JSON.parse(localStorage.getItem(ASSUMP_KEY) || '{}')); } catch {}
    return A;
  }
  const saveAssump = A => { try { localStorage.setItem(ASSUMP_KEY, JSON.stringify(A)); } catch {} };

  const hm = h => { const m = Math.round(Math.abs(h) * 60), a = Math.floor(m / 60), b = m % 60;
    return (h < 0 && m ? '−' : '') + (a ? a + ' h' + (b ? ' ' + b + ' min' : '') : b + ' min'); }; // 5.2 → "5 h 12 min"
  const fractionBelow = (vals, x) => vals.length ? vals.filter(v => v < x).length / vals.length : 0;

  return { UFF, DEFAULTS, FIELDS, CATS, GROUPS, GROUP_NOTE, straightKm, complete, week, split, loadAssump, saveAssump, hm, fractionBelow };
})();
