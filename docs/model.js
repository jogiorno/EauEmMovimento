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

  return { UFF, DEFAULTS, FIELDS, straightKm, complete, week };
})();
