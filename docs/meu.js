const { UFF, week, complete, split, CATS, hm, fractionBelow } = Model;
const $ = s => document.querySelector(s);
const fmt = (n, d = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: d });

let mine = null;
try { mine = JSON.parse(localStorage.getItem('eau-meu-trajeto')); } catch {}
const e = mine && mine.body;

// 168 células, uma por hora, distribuídas pelo método do maior resto (se a semana estoura, escala proporcionalmente).
function cellCounts(w) {
  const v = CATS.map(([k]) => Math.max(0, w[k])), tot = v.reduce((a, b) => a + b, 0), raw = v.map(x => x * (tot > 168 ? 168 / tot : 1));
  const base = raw.map(Math.floor); let rest = 168 - base.reduce((a, b) => a + b, 0);
  raw.map((x, i) => [x - base[i], i]).sort((a, b) => b[0] - a[0]).slice(0, Math.max(0, rest)).forEach(([, i]) => base[i]++);
  return base;
}

if (!e || !complete(e)) $('#empty').hidden = false;
else {
  $('#mine').hidden = false;
  const A = Model.loadAssump(); // mesmas premissas editadas em Dados
  const w = week(e, A), h = m => fmt(m / 60) + ' h';

  $('#kpis').innerHTML = [
    [hm(w.sleepAvail), 'sono possível por noite (semana média)'],
    [hm(w.sleepWorst), 'sono possível no seu dia mais pesado'],
    [hm(w.free), 'tempo livre por semana'],
    [hm(w.commute), 'deslocamento por semana'],
    [fmt(e.distKm) + ' km', 'distância em linha reta até a EAU'],
  ].map(([b, s]) => `<div class="card kpi"><b>${b}</b><span>${s}</span></div>`).join('');

  // comparação com o coletivo (mesmas premissas); se o banco falhar, o parágrafo simplesmente não aparece
  DB.list().then(es => {
    const rows = es.filter(complete).map(x => week(x, A)); if (rows.length < 2) return;
    const p = Math.round(100 * fractionBelow(rows.map(r => r.sleepWorst), w.sleepWorst));
    $('#cmp').textContent = `No dia mais pesado, ${p}% dos ${rows.length} estudantes que responderam têm menos sono possível que você.`;
    $('#cmp').hidden = false;
  }).catch(() => {});

  const render168 = (ww, el) => {
    const c = cellCounts(ww);
    $('#cells').innerHTML = CATS.map(([, l, col], i) => `<i style="background:${col}" title="${l}"></i>`.repeat(c[i])).join('');
    $('#leg').innerHTML = CATS.map(([k, l, col]) => `<li><i style="background:${col}"></i>${l}<b>${hm(Math.max(0, ww[k]))}</b></li>`).join('');
  };
  render168(w);
  $('#over').innerHTML = w.free < 0 ? `<span class="alert">Sua semana não fecha: as atividades somam ${hm(-w.free)} a mais do que as 168 h disponíveis, já contando o sono de referência. As células abaixo estão em proporção.</span>` : '';
  const sp = split(w, A);
  $('#split').textContent = `Informado por você: ${hm(sp.declared)} · presumido pelo site (alimentação e higiene, lazer mínimo): ${hm(sp.presumed)} · sobra para dormir: ${hm(sp.residual)} por semana. O deslocamento semanal usa a premissa de ${fmt(A.campusDays)} dias na EAU. O sono "de referência" nas células é ${fmt(A.sleepPerDay)} h por dia.`;

  $('#tbl').innerHTML = [
    ['Período do curso', e.semester + 'º'],
    ['Deslocamento por dia na EAU (ida + volta)', `${e.commuteMin} min (${h(e.commuteMin)})`],
    ['Aulas por semana', h(e.classWeekMin)], ['Maior dia de aula', h(e.classMaxDayMin)],
    ['Trabalho/estágio por semana', h(e.workMin)], ['Trabalho doméstico por semana', h(e.domesticMin)],
    ['Leitura por semana', h(e.readingMin)], ['Estudos extraclasse e trabalhos por semana', h(e.studyMin)],
    ['Autocuidado por semana', h(e.selfcareMin)],
  ].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');

  // Simulador "E se…": opera sobre uma cópia; não grava em lugar nenhum.
  const SIM = [['workMin', 'Trabalho/estágio', 'h/sem', 0, 60, .5, 60], ['studyMin', 'Estudo extraclasse e trabalhos', 'h/sem', 0, 60, .5, 60],
    ['domesticMin', 'Trabalho doméstico', 'h/sem', 0, 40, .5, 60], ['selfcareMin', 'Autocuidado', 'h/sem', 0, 20, .5, 60],
    ['commuteMin', 'Deslocamento por dia (ida + volta)', 'min/dia', 0, 300, 5, 1]];
  $('#sim').innerHTML = SIM.map(([k, l, u, mn, mx, st, f]) =>
    `<div><label for="s_${k}">${l}<span id="o_${k}"></span></label><input id="s_${k}" type="range" min="${mn}" max="${Math.max(mx, Math.ceil(e[k] / f))}" step="${st}" data-k="${k}" data-f="${f}"></div>`).join('');
  const sliders = [...document.querySelectorAll('#sim input')];
  function simulate() {
    const s = { ...e };
    sliders.forEach(i => { s[i.dataset.k] = Math.round(+i.value * +i.dataset.f); $('#o_' + i.dataset.k).textContent = `${fmt(+i.value)} ${SIM.find(x => x[0] === i.dataset.k)[2]}`; });
    const t = week(s, A), d = (a, b) => { const x = a - b; return Math.abs(x) < 0.01 ? 'igual ao seu' : (x > 0 ? '+' : '') + hm(x) + ' em relação a você'; };
    $('#res').innerHTML = [[hm(t.sleepAvail), 'sono possível por noite', d(t.sleepAvail, w.sleepAvail)],
      [hm(t.sleepWorst), 'no dia mais pesado', d(t.sleepWorst, w.sleepWorst)], [hm(t.free), 'tempo livre por semana', d(t.free, w.free)]]
      .map(([b, a, c]) => `<div><b>${b}</b><span>${a}<br>${c}</span></div>`).join('');
  }
  const reset = () => { sliders.forEach(i => i.value = e[i.dataset.k] / +i.dataset.f); simulate(); };
  sliders.forEach(i => i.oninput = simulate); $('#simReset').onclick = reset; reset();

  const map = L.map('map', { zoomControl: false, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19, opacity: 0.8 }).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);
  const U = [UFF.lat, UFF.lng];
  L.polyline([e.home, U], { color: '#d6001c', weight: 4 }).addTo(map);
  L.circleMarker(e.home, { radius: 7, color: '#000', weight: 1, fillColor: '#5fd4e6', fillOpacity: 1 }).bindTooltip('Moradia').addTo(map);
  L.circleMarker(U, { radius: 9, color: '#fff', weight: 2, fillColor: '#d6001c', fillOpacity: 1 }).bindTooltip('EAU').addTo(map);
  map.fitBounds([e.home, U], { padding: [40, 40] });
}
