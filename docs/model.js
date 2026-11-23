// Modelo compartilhado entre mapa e dashboard.
window.Model = (() => {
  // Escola de Arquitetura e Urbanismo da UFF, Rua Passo da Pátria, 156 – São Domingos, Niterói (coordenada do OSM/Nominatim).
  const UFF = { lat: -22.90464, lng: -43.13083, name: 'Escola de Arquitetura e Urbanismo – UFF (Praia Vermelha)' };

  const DEFAULTS = {
    sleepPerDay: 7,        // h de sono por dia
    essentialsPerDay: 3.5, // alimentação, higiene, tarefas domésticas
    studyExtra: 10,        // h/semana de trabalho extraclasse (ateliê, projetos)
    campusDays: 5,         // dias por semana na universidade
    freeMin: 10,           // h/semana de lazer/vida social que se quer preservar
  };

  // Distância em linha reta (km) entre dois pontos [lat, lng].
  function straightKm(a, b) {
    const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  }

    const complete = e => e.commuteH != null && e.classWeek != null && e.classMaxDay != null;

  // e.commuteH = horas de deslocamento por dia na UFF (ida + volta, transporte + caminhada);
  // e.classWeek = h de aula por semana; e.classMaxDay = h de aula no dia mais cheio; e.workH = h/semana de trabalho/estágio.
  function week(e, a) {
    const commute = e.commuteH * a.campusDays;
    const sleep = a.sleepPerDay * 7, ess = a.essentialsPerDay * 7;
    const used = commute + e.classWeek + e.workH + sleep + ess + a.studyExtra;
    const sleepAvail = (168 - commute - e.classWeek - e.workH - ess - a.studyExtra - a.freeMin) / 7; // h/noite, semana média
    // Dia mais pesado: o maior dia de aula + deslocamento + parcela diária de trabalho/estudo.
    const sleepWorst = 24 - e.commuteH - e.classMaxDay - e.workH / a.campusDays - a.essentialsPerDay - a.studyExtra / a.campusDays;
    return { sleepAvail, sleepWorst, commute, class: e.classWeek, intern: e.workH, sleep, essentials: ess, study: a.studyExtra, free: 168 - used };
  }

  return { UFF, DEFAULTS, straightKm, complete, week };
})();
