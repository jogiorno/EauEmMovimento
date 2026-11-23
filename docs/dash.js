const { DEFAULTS, week, complete } = Model;
const $ = s => document.querySelector(s);
const A = JSON.parse(JSON.stringify(DEFAULTS));
try { Object.assign(A, JSON.parse(localStorage.getItem('eau-assump-v3') || '{}')); } catch {}
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const fmt = (n, d = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: d });
let entries = [], charts = {};

const CATS = [['sleep', 'Sono', '#6c7ae0'], ['essentials', 'Atividades essenciais', '#8d98a8'], ['class', 'Aulas', '#ffc857'],
  ['intern', 'Estágio', '#ff9f5a'], ['study', 'Estudo extraclasse', '#c792ea'], ['commute', 'Deslocamento', '#ff5c7a'], ['free', 'Tempo livre', '#5fd4e6']];

const small = () => innerWidth < 720;
Chart.defaults.aspectRatio = small() ? 1.1 : 2;
function mk(id, cfg) {
  charts[id]?.destroy();
  Chart.defaults.font.family = "'Geist Mono', monospace"; Chart.defaults.color = css('--mute'); Chart.defaults.borderColor = css('--line');
  charts[id] = new Chart($(id), cfg);
}

function render() {
  const rows = entries.filter(complete).map(e => ({ e, w: week(e, A), hrs: e.commuteH }));
  const n = rows.length;
  const weekCommute = avg(rows.map(r => r.w.commute));
  const neg = rows.filter(r => r.w.free < 0).length;
  $('#kpis').innerHTML = [
    [n ? fmt(avg(rows.map(r => r.w.sleepAvail))) + ' h' : '–', 'sono possível por noite (média)'],
    [n ? fmt(100 * rows.filter(r => r.w.sleepAvail < 6).length / n, 0) + '%' : '–', 'podem dormir menos de 6 h por noite'],
    [n ? fmt(100 * rows.filter(r => r.w.sleepAvail < 4).length / n, 0) + '%' : '–', 'podem dormir menos de 4 h por noite'],
    [n ? fmt(avg(rows.map(r => r.w.sleepWorst))) + ' h' : '–', 'sono possível no dia mais pesado (média)'],
    [n ? fmt(avg(rows.map(r => r.e.classWeek))) + ' h' : '–', 'horas de aula por semana (média)'],
    [n ? fmt(avg(rows.map(r => r.e.classMaxDay))) + ' h' : '–', 'maior dia de aula (média)'],
    [n ? fmt(100 * rows.filter(r => r.e.workH > 0).length / n, 0) + '%' : '–', 'trabalham ou estagiam'],
    [n, 'trajetos completos (de ' + entries.length + ' registrados)'],
    [fmt(avg(rows.map(r => r.hrs))) + ' h', 'deslocamento médio por dia (ida + volta)'],
    [fmt(avg(rows.map(r => r.e.distKm))) + ' km', 'distância média em linha reta'],
    [fmt(weekCommute) + ' h', 'deslocamento por semana'],
    [fmt(weekCommute * 18, 0) + ' h', 'deslocamento por semestre (≈18 sem.)'],
    [n ? fmt(100 * neg / n, 0) + '%' : '–', 'com semana que não fecha (tempo livre < 0)'],
  ].map(([b, s]) => `<div class="card kpi"><b>${b}</b><span>${s}</span></div>`).join('');

  const byTerm = Array.from({ length: 10 }, (_, i) => rows.filter(r => r.e.semester === i + 1));
  mk('#c1', { type: 'bar', data: { labels: byTerm.map((_, i) => (i + 1) + 'º'),
    datasets: CATS.map(([k, l, c]) => ({ label: l, backgroundColor: c,
      data: byTerm.map((g, i) => g.length ? avg(g.map(r => r.w[k])) : null) })) },
    options: { scales: { x: { stacked: true, title: { display: true, text: 'Período' } }, y: { stacked: true, max: 168, title: { display: true, text: 'horas/semana' } } },
      plugins: { legend: { position: 'bottom' } } } });

  const sl = g => g.length ? +avg(g.map(r => r.w.sleepAvail)).toFixed(1) : null;
  mk('#c5', { type: 'bar', data: { labels: byTerm.map((_, i) => (i + 1) + 'º'), datasets: [
    { label: 'sono possível (média)', data: byTerm.map(sl), backgroundColor: byTerm.map(g => (sl(g) ?? 8) < 6 ? '#ff5c7a' : '#6c7ae0') },
    { label: 'dia mais pesado (média)', data: byTerm.map(g => g.length ? +avg(g.map(r => r.w.sleepWorst)).toFixed(1) : null), backgroundColor: '#ff9f5a' },
    { label: 'pior caso', data: byTerm.map(g => g.length ? +Math.min(...g.map(r => r.w.sleepAvail)).toFixed(1) : null), backgroundColor: '#ffc857' },
    { type: 'line', label: 'recomendado (8 h)', data: byTerm.map(() => 8), borderColor: '#7ddc8b', borderDash: [6, 4], pointRadius: 0 }] },
    options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { title: { display: true, text: 'horas por noite' } } } } });

  mk('#c6', { type: 'bar', data: { labels: byTerm.map((_, i) => (i + 1) + 'º'), datasets: [
    { label: '% que estagia', data: byTerm.map(g => g.length ? +(100 * g.filter(r => r.e.workH > 0).length / g.length).toFixed(0) : null), backgroundColor: '#ff9f5a' }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { max: 100, title: { display: true, text: '% dos estudantes do período' } } } } });

  const lab = Array.from({ length: 7 }, (_, i) => i === 6 ? '6+' : `${i}–${i + 1}`);
  const cnt = lab.map(() => 0); rows.forEach(r => cnt[Math.min(6, Math.floor(r.hrs))]++);
  mk('#c2', { type: 'bar', data: { labels: lab, datasets: [{ label: 'estudantes', data: cnt, backgroundColor: '#ff5c7a' }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: 'estudantes' }, ticks: { precision: 0 } } } } });

  mk('#c3', { type: 'bar', data: { labels: byTerm.map((_, i) => (i + 1) + 'º'),
    datasets: [{ label: 'média', data: byTerm.map(g => g.length ? +avg(g.map(r => r.w.free)).toFixed(1) : null), backgroundColor: '#5fd4e6' },
      { label: 'mínimo', data: byTerm.map(g => g.length ? +Math.min(...g.map(r => r.w.free)).toFixed(1) : null), backgroundColor: '#ff5c7a' }] },
    options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { title: { display: true, text: 'horas livres/semana' } } } } });

  const dl = Array.from({ length: 13 }, (_, i) => i === 12 ? '12+' : i + ''), dc = dl.map(() => 0);
  rows.forEach(r => dc[Math.min(12, Math.floor(r.e.classMaxDay))]++);
  mk('#c4', { type: 'bar', data: { labels: dl, datasets: [{ label: 'estudantes', data: dc, backgroundColor: '#ffc857' }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'horas de aula no dia mais cheio' } }, y: { title: { display: true, text: 'estudantes' }, ticks: { precision: 0 } } } } });
}

function buildAssump() {
  const fields = [['sleepPerDay', 'Sono (h/dia)', .5], ['essentialsPerDay', 'Essenciais (h/dia)', .5], ['studyExtra', 'Extraclasse (h/sem)', 1], ['campusDays', 'Dias na UFF/sem', 1], ['freeMin', 'Lazer mínimo (h/sem)', 1]];
  $('#assump').innerHTML = fields.map(([k, l, s]) => `<div><label>${l}</label><input type="number" step="${s}" min="0" data-k="${k}" value="${A[k]}"></div>`).join('');
  document.querySelectorAll('[data-k]').forEach(i => i.oninput = () => { A[i.dataset.k] = +i.value; save(); });
}
function save() { try { localStorage.setItem('eau-assump-v3', JSON.stringify(A)); } catch {} render(); }

buildAssump();
DB.list().then(es => { entries = es; render(); }).catch(e => { $('#kpis').innerHTML = `<div class="card">${e.message}</div>`; });
