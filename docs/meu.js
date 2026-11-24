const { UFF, DEFAULTS, week, complete, hm } = Model;
const $ = s => document.querySelector(s);
const fmt = (n, d = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: d });
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

let mine = null;
try { mine = JSON.parse(localStorage.getItem('eau-meu-trajeto')); } catch {}
const e = mine && mine.body;

if (!e || !complete(e)) $('#empty').hidden = false;
else {
  $('#mine').hidden = false;
  // mesmas premissas editadas no dashboard (se houver)
  const A = JSON.parse(JSON.stringify(DEFAULTS));
  try { Object.assign(A, JSON.parse(localStorage.getItem('eau-assump-v4') || '{}')); } catch {}
  const w = week(e, A), h = m => hm(m / 60);

  $('#kpis').innerHTML = [
    [hm(w.sleepAvail), 'sono possível por noite (média)'],
    [hm(w.sleepWorst), 'sono possível no seu dia mais pesado'],
    [hm(w.free), 'tempo livre por semana'],
    [hm(w.commute), 'deslocamento por semana'],
    [fmt(e.distKm) + ' km', 'distância em linha reta até a EAU'],
  ].map(([b, s]) => `<div class="card kpi"><b>${b}</b><span>${s}</span></div>`).join('');

  const CATS = [['sleep', 'Sono', '#6c7ae0'], ['essentials', 'Alimentação e higiene', '#8d98a8'], ['class', 'Aulas', '#ffc857'],
    ['intern', 'Trabalho/estágio', '#ff9f5a'], ['domestic', 'Trabalho doméstico', '#b08968'], ['reading', 'Leitura', '#7ddc8b'],
    ['study', 'Estudo extraclasse', '#c792ea'], ['selfcare', 'Autocuidado', '#4fb0ae'], ['commute', 'Deslocamento', '#ff5c7a'], ['free', 'Tempo livre', '#5fd4e6']];
  Chart.defaults.font.family = "'Geist Mono', monospace"; Chart.defaults.color = css('--mute');
  new Chart($('#c1'), { type: 'doughnut', data: { labels: CATS.map(c => c[1]),
    datasets: [{ data: CATS.map(([k]) => +Math.max(0, w[k]).toFixed(1)), backgroundColor: CATS.map(c => c[2]), borderWidth: 0 }] },
    options: { aspectRatio: innerWidth < 720 ? 1 : 1.4, plugins: { legend: { position: innerWidth < 720 ? 'bottom' : 'right' },
      tooltip: { callbacks: { label: c => ` ${c.label}: ${hm(c.parsed)}` } } } } });

  $('#tbl').innerHTML = [
    ['Período do curso', e.semester + 'º'],
    ['Deslocamento por dia na EAU (ida + volta)', h(e.commuteMin)],
    ['Aulas por semana', h(e.classWeekMin)], ['Maior dia de aula', h(e.classMaxDayMin)],
    ['Trabalho/estágio por semana', h(e.workMin)], ['Trabalho doméstico por semana', h(e.domesticMin)],
    ['Leitura por semana', h(e.readingMin)], ['Estudos extraclasse e trabalhos por semana', h(e.studyMin)],
    ['Autocuidado por semana', h(e.selfcareMin)],
  ].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');

  const map = L.map('map', { zoomControl: false, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19, opacity: 0.8 }).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);
  const U = [UFF.lat, UFF.lng];
  L.polyline([e.home, U], { color: '#d6001c', weight: 4 }).addTo(map);
  L.circleMarker(e.home, { radius: 7, color: '#000', weight: 1, fillColor: '#5fd4e6', fillOpacity: 1 }).bindTooltip('Moradia').addTo(map);
  L.circleMarker(U, { radius: 9, color: '#fff', weight: 2, fillColor: '#d6001c', fillOpacity: 1 }).bindTooltip('EAU').addTo(map);
  map.fitBounds([e.home, U], { padding: [40, 40] });
}
