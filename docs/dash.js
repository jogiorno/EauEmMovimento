const { week, complete, split, CATS, GROUPS, hm } = Model;
const $ = s => document.querySelector(s);
const A = Model.loadAssump();
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const fmt = (n, d = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: d });
let entries = [], charts = {};

const small = () => innerWidth < 720;
Chart.defaults.aspectRatio = small() ? 1.1 : 2;
function mk(id, cfg) {
  charts[id]?.destroy();
  Chart.defaults.font.family = "'Geist Mono', monospace"; Chart.defaults.color = css('--mute'); Chart.defaults.borderColor = css('--line');
  charts[id] = new Chart($(id), cfg);
}

function render() {
  const rows = entries.filter(complete).map(e => ({ e, w: week(e, A), hrs: e.commuteMin / 60 }));
  const n = rows.length;
  const weekCommute = avg(rows.map(r => r.w.commute));
  const neg = rows.filter(r => r.w.free < 0).length;
  $('#kpis').innerHTML = [
    [n ? fmt(avg(rows.map(r => r.w.sleepAvail))) + ' h' : '–', 'sono possível por noite (média)'],
    [n ? fmt(100 * rows.filter(r => r.w.sleepWorst < 6).length / n, 0) + '%' : '–', 'podem dormir menos de 6 h no dia mais pesado'],
    [n ? fmt(100 * rows.filter(r => r.w.sleepWorst < 4).length / n, 0) + '%' : '–', 'podem dormir menos de 4 h no dia mais pesado'],
    [n ? fmt(100 * rows.filter(r => r.w.sleepWorst < 7).length / n, 0) + '%' : '–', 'podem dormir menos de 7 h no dia mais pesado'],
    [n ? fmt(100 * rows.filter(r => r.w.sleepWorst < 8).length / n, 0) + '%' : '–', 'podem dormir menos de 8 h no dia mais pesado'],
    [n ? fmt(avg(rows.map(r => r.w.sleepWorst))) + ' h' : '–', 'sono possível no dia mais pesado (média)'],
    [n ? fmt(avg(rows.map(r => r.e.classWeekMin / 60))) + ' h' : '–', 'horas de aula por semana (média)'],
    [n ? fmt(avg(rows.map(r => r.e.classMaxDayMin / 60))) + ' h' : '–', 'maior dia de aula (média)'],
    [n ? fmt(100 * rows.filter(r => r.e.workMin > 0).length / n, 0) + '%' : '–', 'trabalham ou estagiam'],
    [n, 'trajetos completos (de ' + entries.length + ' registrados)'],
    [fmt(avg(rows.map(r => r.hrs))) + ' h', 'deslocamento médio por dia (ida + volta)'],
    [fmt(avg(rows.map(r => r.e.distKm))) + ' km', 'distância média em linha reta'],
    [fmt(weekCommute) + ' h', 'deslocamento por semana'],
    [fmt(weekCommute * 18, 0) + ' h', 'deslocamento por semestre (≈18 sem.)'],
    [n ? fmt(100 * neg / n, 0) + '%' : '–', 'com semana que não fecha (tempo livre < 0)'],
  ].map(([b, s]) => `<div class="card kpi"><b>${b}</b><span>${s}</span></div>`).join('');

  const sA = rows.map(r => r.w.sleepAvail), sW = rows.map(r => r.w.sleepWorst);
  $('#headline').innerHTML = n ? [
    [hm(avg(sW)), 'de sono possível, em média, no dia mais pesado, depois de aulas, trabalho, estudo, casa, autocuidado e deslocamento'],
    [hm(avg(sA)), 'por noite na semana média'],
    [hm(avg(rows.map(r => r.e.classWeekMin / 60))), 'de aula por semana'],
    [hm(weekCommute), 'de deslocamento por semana'],
  ].map(([b, s]) => `<div class="card kpi"><b>${b}</b><span>${s}</span></div>`).join('') : '';
  $('#story').textContent = n ? `Com o que ${n} estudante${n > 1 ? 's declararam' : ' declarou'}, sobram em média ${hm(avg(sW))} para dormir no dia mais pesado (e ${hm(avg(sA))} por noite na semana média). ${fmt(100 * rows.filter(r => r.w.sleepWorst < 6).length / n, 0)}% ficariam abaixo de 6 h nesse dia.` : 'Ainda não há trajetos completos.';

  const byTerm = Array.from({ length: 10 }, (_, i) => rows.filter(r => r.e.semester === i + 1));
  mk('#c1', { type: 'bar', data: { labels: byTerm.map((_, i) => (i + 1) + 'º'),
    datasets: CATS.map(([k, l, c]) => ({ label: l, backgroundColor: c, borderColor: '#fff', borderWidth: 1,
      data: byTerm.map((g, i) => g.length ? avg(g.map(r => r.w[k])) : null) })) },
    options: { scales: { x: { stacked: true, title: { display: true, text: 'Período' } }, y: { stacked: true, max: 168, title: { display: true, text: 'horas/semana' } } },
      plugins: { legend: { position: 'bottom' } } } });

  const dim = '#6c7ae0', hot = '#ff9f5a', dot = '#d6001ccc';
  const sc = (xl, yl, fx, fy, tip) => ({ type: 'scatter',
    data: { datasets: [{ data: rows.map(r => ({ x: +fx(r).toFixed(2), y: +fy(r).toFixed(2) })), backgroundColor: dot, pointRadius: 4, pointHoverRadius: 7 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => tip(c.parsed) } } },
      scales: { x: { title: { display: true, text: xl } }, y: { title: { display: true, text: yl } } } } });
  mk('#c8', sc('deslocamento por dia, ida + volta (h)', 'sono possível por noite (h)', r => r.hrs, r => r.w.sleepAvail,
    p => `${hm(p.x)} de deslocamento por dia · ${hm(p.y)} de sono possível`));
  mk('#c9', sc('trabalho/estágio por semana (h)', 'tempo livre por semana (h)', r => r.w.intern, r => r.w.free,
    p => `${hm(p.x)} de trabalho/estágio · ${hm(p.y)} de tempo livre`));

  const sbin = h => Math.max(0, Math.min(8, Math.floor(h) - 1)), sl2 = ['<2', '2–3', '3–4', '4–5', '5–6', '6–7', '7–8', '8–9', '9+'];
  const hist = vals => { const c = sl2.map(() => 0); vals.forEach(v => c[sbin(v)]++); return c; };
  mk('#c7', { type: 'bar', data: { labels: sl2, datasets: [
    { label: 'semana média', data: hist(sA), backgroundColor: dim }, { label: 'dia mais pesado', data: hist(sW), backgroundColor: hot }] },
    options: { plugins: { legend: { position: 'bottom' } }, scales: { x: { title: { display: true, text: 'horas de sono possível' } }, y: { title: { display: true, text: 'estudantes' }, ticks: { precision: 0 } } } } });

  $('#gnote').textContent = Model.GROUP_NOTE;
  mk('#c10', { type: 'bar', data: { labels: byTerm.map((_, i) => (i + 1) + 'º'), datasets: GROUPS.map(([g, l, c]) => ({ label: l, backgroundColor: c, borderColor: '#fff', borderWidth: 1,
    data: byTerm.map(t => t.length ? avg(t.map(r => CATS.filter(x => x[3] === g).reduce((s, x) => s + Math.max(0, r.w[x[0]]), 0))) : null) })) },
    options: { scales: { x: { stacked: true, title: { display: true, text: 'Período' } }, y: { stacked: true, max: 168, title: { display: true, text: 'horas/semana' } } }, plugins: { legend: { position: 'bottom' } } } });

  const sp = rows.map(r => split(r.w, A));
  const part = [['Informado pelos estudantes', '#ff5c7a', sp.map(x => x.declared)], ['Presumido (alimentação, higiene, lazer mínimo)', '#8d98a8', sp.map(x => x.presumed)], ['Sobra para dormir', '#6c7ae0', sp.map(x => x.residual)]];
  mk('#c11', { type: 'bar', data: { labels: ['168 h'], datasets: part.map(([l, c, v]) => ({ label: l, backgroundColor: c, borderColor: '#fff', borderWidth: 1, data: [n ? +avg(v).toFixed(1) : null] })) },
    options: { indexAxis: 'y', aspectRatio: small() ? 2.5 : 8, scales: { x: { stacked: true, max: 168, title: { display: true, text: 'horas/semana' } }, y: { stacked: true } },
      plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${hm(c.parsed.x)}` } } } } });
  document.querySelectorAll('.prem').forEach(p => p.textContent = `Premissas: sono de referência ${fmt(A.sleepPerDay)} h/dia · alimentação e higiene ${fmt(A.essentialsPerDay)} h/dia · lazer mínimo ${fmt(A.freeMin)} h/sem · ${fmt(A.campusDays)} dias na EAU (deslocamento semanal = minutos informados × dias na EAU, então depende dessa premissa).`);

  const sl = g.length ? +avg(g.map(r => r.w.sleepAvail)).toFixed(1) : null;
  mk('#c5', { type: 'bar', data: { labels: byTerm.map((_, i) => (i + 1) + 'º'), datasets: [
    { label: 'sono possível (média)', data: byTerm.map(sl), backgroundColor: byTerm.map(g => (sl(g) ?? 8) < 6 ? '#ff5c7a' : '#6c7ae0') },
    { label: 'dia mais pesado (média)', data: byTerm.map(g => g.length ? +avg(g.map(r => r.w.sleepWorst)).toFixed(1) : null), backgroundColor: '#ff9f5a' },
    { label: 'pior caso', data: byTerm.map(g => g.length ? +Math.min(...g.map(r => r.w.sleepAvail)).toFixed(1) : null), backgroundColor: '#ffc857' },
    { type: 'line', label: 'recomendado (8 h)', data: byTerm.map(() => 8), borderColor: '#7ddc8b', borderDash: [6, 4], pointRadius: 0 }] },
    options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { title: { display: true, text: 'horas por noite' } } } } });

  mk('#c6', { type: 'bar', data: { labels: byTerm.map((_, i) => (i + 1) + 'º'), datasets: [
    { label: '% que trabalha/estagia', data: byTerm.map(g => g.length ? +(100 * g.filter(r => r.e.workMin > 0).length / g.length).toFixed(0) : null), backgroundColor: '#ff9f5a' }] },
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
  rows.forEach(r => dc[Math.min(12, Math.floor(r.e.classMaxDayMin / 60))]++);
  mk('#c4', { type: 'bar', data: { labels: dl, datasets: [{ label: 'estudantes', data: dc, backgroundColor: '#ffc857' }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'horas de aula no dia mais cheio' } }, y: { title: { display: true, text: 'estudantes' }, ticks: { precision: 0 } } } } });
}

function buildAssump() {
  const fields = [['sleepPerDay', 'Sono (h/dia)', .5], ['essentialsPerDay', 'Alimentação e higiene (h/dia)', .5], ['campusDays', 'Dias na EAU/sem', 1], ['freeMin', 'Lazer mínimo (h/sem)', 1]];
  $('#assump').innerHTML = fields.map(([k, l, s]) => `<div><label>${l}</label><input type="number" step="${s}" min="0" data-k="${k}" value="${A[k]}"></div>`).join('');
  document.querySelectorAll('[data-k]').forEach(i => i.oninput = () => { A[i.dataset.k] = +i.value; save(); });
}
function save() { Model.saveAssump(A); render(); }

buildAssump();
document.querySelectorAll('.grid canvas:not([data-noprem])').forEach(c => { const p = document.createElement('p'); p.className = 'note prem'; c.after(p); });
DB.list().then(es => { entries = es; render(); }).catch(e => { $('#kpis').innerHTML = `<div class="card">${e.message}</div>`; });
