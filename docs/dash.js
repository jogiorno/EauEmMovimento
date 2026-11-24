const { DEFAULTS, week, complete, validate, delivery, CATS, ALERT, MIN_N, composition, mean, median, quantile, regress, hm, fmt } = Model;
const $ = s => document.querySelector(s);
const A = JSON.parse(JSON.stringify(DEFAULTS));
try { Object.assign(A, JSON.parse(localStorage.getItem('eau-assump-v4') || '{}')); } catch {}
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const avg = a => a.length ? mean(a) : 0;
let entries = [], charts = {}, lastRows = [], mode1 = 'mean', mode4 = 'band', f2 = 0, discarded = 0;

const small = () => innerWidth < 720;
Chart.defaults.aspectRatio = small() ? 1.1 : 2;
function mk(id, cfg) {
  charts[id]?.destroy();
  Chart.defaults.font.family = "'Geist Mono', monospace"; Chart.defaults.color = css('--mute'); Chart.defaults.borderColor = css('--line');
  charts[id] = new Chart($(id), cfg);
}

// ---------- apoio ----------
const TERMS = Array.from({ length: 10 }, (_, i) => i + 1);
const byTermOf = rows => TERMS.map(t => rows.filter(r => r.e.semester === t));
const shown = g => g.length >= MIN_N; // privacidade: períodos com poucas respostas não mostram resultados agregados
const nTxt = g => `n=${g.length}${g.length && !shown(g) ? ', oculto' : ''}`;
const jit = i => ((((i + 1) * 2654435761) >>> 0) % 1000) / 1000 - 0.5; // espalhamento vertical estável: pontos não se sobrepõem
const termAxis = (by, lo, hi) => ({ reverse: true, min: lo, max: hi, grid: { display: false }, ticks: { stepSize: 1, callback: v => Number.isInteger(v) && v >= 1 && v <= 10 ? `${v}º (n=${by[v - 1].length})` : '' } });
const lineGrid = (at, color) => ({ color: c => c.tick.value === at ? css('--fg') : color || css('--line'), lineWidth: c => c.tick.value === at ? 2 : 1 });
const vline = (x, lo, hi, dash, w) => ({ type: 'line', data: [{ x, y: lo }, { x, y: hi }], borderColor: css('--fg'), borderDash: dash, borderWidth: w, pointRadius: 0, label: 'ref' });
const GREEN = '#7a9a8a', GRAY = '#8d98a8', TERRA = '#c0653f', BLUE = '#5b7a99', LIGHT_RED = '#e0a58f';
const ramp = t => { const a = [199, 212, 224], b = [31, 58, 86], f = (t - 1) / 9; return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * f).toString(16).padStart(2, '0')).join(''); };

function render() {
  const full = entries.filter(complete), good = full.filter(e => !validate(e));
  discarded = full.length - good.length;
  const rows = good.map(e => ({ e, w: week(e, A), hrs: e.commuteMin / 60 }));
  const n = rows.length;
  const weekCommute = avg(rows.map(r => r.w.commute));
  const neg = rows.filter(r => r.w.free < 0).length;
  $('#headline').innerHTML = n ? `<b>${hm(avg(rows.map(r => r.w.sleepWorst)))}</b><span>de sono possível, em média, no dia mais pesado, depois de aulas, trabalho, estudo, casa, autocuidado e deslocamento.</span><small>Média de ${n} trajeto${n > 1 ? 's' : ''} válido${n > 1 ? 's' : ''}. Veja as premissas no fim da página.</small>` : '';
  $('#kpis').innerHTML = [
    [n ? fmt(avg(rows.map(r => r.w.sleepAvail))) + ' h' : '–', 'sono possível por noite (média)'],
    [n ? fmt(100 * rows.filter(r => r.w.sleepWorst < 6).length / n, 0) + '%' : '–', 'podem dormir <strong>menos de 6 h</strong> no dia mais pesado', 1],
    [n ? fmt(100 * rows.filter(r => r.w.sleepWorst < 4).length / n, 0) + '%' : '–', 'podem dormir <strong>menos de 4 h</strong> no dia mais pesado', 1],
    [n ? fmt(avg(rows.map(r => r.w.sleepWorst))) + ' h' : '–', 'sono possível no dia mais pesado (média)'],
    [n ? fmt(avg(rows.map(r => r.e.classWeekMin / 60))) + ' h' : '–', 'horas de aula por semana (média)'],
    [n ? fmt(avg(rows.map(r => r.e.classMaxDayMin / 60))) + ' h' : '–', 'maior dia de aula (média)'],
    [n ? fmt(100 * rows.filter(r => r.e.workMin > 0).length / n, 0) + '%' : '–', 'trabalham ou estagiam'],
    [n, 'trajetos válidos (de ' + entries.length + ' registrados)'],
    [fmt(avg(rows.map(r => r.hrs))) + ' h', 'deslocamento médio por dia (ida + volta)'],
    [fmt(avg(rows.map(r => r.e.distKm))) + ' km', 'distância média em linha reta'],
    [fmt(weekCommute) + ' h', 'deslocamento por semana'],
    [fmt(weekCommute * 18, 0) + ' h', 'deslocamento por semestre (≈18 sem.)'],
    [n ? fmt(100 * neg / n, 0) + '%' : '–', 'com semana que não fecha (saldo < 0)'],
  ].map(([b, s, alert]) => `<div class="card kpi${alert ? ' alert' : ''}"><b>${b}</b><span>${s}</span></div>`).join('');

  lastRows = rows; graph1(rows); graph2(rows); graph3(rows); graph4(rows); graph5(rows); method(rows);
}

// ---------- 1. O pior dia: sono possível no dia mais pesado = 24 h − deslocamento − maior dia de aula − parcela diária do resto − alimentação e higiene ----------
const sw = r => r.w.sleepWorst, sevColor = v => v < 4 ? ALERT : v < 6 ? LIGHT_RED : GREEN;
function graph1(rows) {
  const by = byTermOf(rows), n = rows.length, lt = (g, x) => g.filter(r => sw(r) < x).length, lo = Math.min(0, Math.floor(Math.min(...rows.map(sw), 0))), xt = { stepSize: 2 };
  let cfg;
  if (mode1 === 'mean') {
    const d = by.map(g => shown(g) ? +mean(g.map(sw)).toFixed(2) : null);
    cfg = { type: 'bar', data: { labels: by.map((g, i) => `${i + 1}º (${nTxt(g)})${d[i] == null ? '' : ' · ' + hm(d[i])}`), datasets: [{ label: 'sono possível no dia mais pesado', data: d, backgroundColor: d.map(v => v == null ? GREEN : sevColor(v)) }] },
      options: { indexAxis: 'y', aspectRatio: small() ? 1.1 : 2, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` média: ${hm(c.parsed.x)} de sono possível no dia mais pesado` } } },
        scales: { x: { min: lo, ticks: xt, grid: lineGrid(6), title: { display: true, text: 'horas de sono possível no dia mais pesado (linha forte = 6 h)' } }, y: { reverse: true, grid: { display: false } } } } };
  } else if (mode1 === 'dist') {
    cfg = { type: 'scatter', data: { datasets: [{ label: 'estudante', data: rows.map((r, i) => ({ x: +sw(r).toFixed(2), y: r.e.semester + jit(i) * 0.7, s: r.e.semester })),
      backgroundColor: rows.map(r => sevColor(sw(r))), pointRadius: 5, pointHoverRadius: 8 }, vline(6, 0.4, 10.6, [6, 4], 1.5), vline(4, 0.4, 10.6, [], 2)] },
      options: { aspectRatio: small() ? 1 : 1.8, plugins: { legend: { display: false }, tooltip: { filter: i => i.datasetIndex === 0, callbacks: { label: c => ` ${c.raw.s}º período: ${hm(c.parsed.x)} de sono possível no dia mais pesado` } } },
        scales: { x: { min: lo, max: Math.max(12, Math.ceil(Math.max(...rows.map(sw), 12))), ticks: xt, title: { display: true, text: 'horas de sono possível no dia mais pesado (tracejada = 6 h, cheia = 4 h)' } }, y: termAxis(by, 0.4, 10.6) } } };
  } else {
    const d = by.map(g => shown(g) ? +(100 * lt(g, 4) / g.length).toFixed(0) : null);
    cfg = { type: 'bar', data: { labels: by.map((g, i) => `${i + 1}º (${nTxt(g)})${d[i] == null ? '' : ` · ${lt(g, 4)} de ${g.length}`}`), datasets: [{ label: '% com menos de 4 h', data: d, backgroundColor: ALERT }] },
      options: { indexAxis: 'y', aspectRatio: small() ? 1.1 : 2, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.parsed.x}% dos estudantes do período` } } },
        scales: { x: { min: 0, max: 100, title: { display: true, text: '% dos estudantes que podem dormir menos de 4 h no dia mais pesado' } }, y: { reverse: true, grid: { display: false } } } } };
  }
  mk('#g1', cfg);
  $('#n1').textContent = n ? `${n} estudantes com respostas válidas; no dia mais pesado, ${lt(rows, 6)} (${fmt(100 * lt(rows, 6) / n, 0)}%) podem dormir menos de 6 h e ${lt(rows, 4)} (${fmt(100 * lt(rows, 4) / n, 0)}%) menos de 4 h. Períodos com menos de ${MIN_N} respostas têm o resultado oculto. Vermelho forte: menos de 4 h; vermelho claro: de 4 a 6 h.` : 'Ainda não há respostas válidas.';
  $('#p1').textContent = `Como é calculado: 24 h − deslocamento diário − maior dia de aula informado − parcela diária do trabalho/estágio e do estudo (dividida pelos ${fmt(A.campusDays)} dias na EAU) − parcela diária de trabalho doméstico, leitura e autocuidado (÷ 7) − alimentação e higiene (${fmt(A.essentialsPerDay)} h/dia). É a combinação mais pesada que o estudante declarou, não necessariamente um dia real.`;
}

// ---------- 2. Quanto conseguimos dormir? (semana média) sono possível por noite = (168 h − horas informadas − alimentação e higiene − lazer mínimo) ÷ 7 ----------
function graph2(rows) {
  const r2 = f2 ? rows.filter(r => r.e.semester === f2) : rows, v = r2.map(r => r.w.sleepAvail), n = v.length, by = byTermOf(rows);
  const pct = x => n ? fmt(100 * v.filter(s => s < x).length / n, 0) + '%' : '–';
  $('#st2').innerHTML = [[n ? hm(mean(v)) : '–', 'média'], [n ? hm(median(v)) : '–', 'mediana'], [n ? `${hm(quantile(v, .25))} a ${hm(quantile(v, .75))}` : '–', 'quartis (25% a 75%)'],
    [pct(6), 'abaixo de 6 h'], [pct(7), 'abaixo de 7 h'], [pct(8), 'abaixo de 8 h'], [n, 'estudantes considerados']]
    .map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
  if (small()) { // celular: histograma, mais legível que dezenas de pontos sobrepostos
    const lab = ['<2', '2–3', '3–4', '4–5', '5–6', '6–7', '7–8', '8–9', '9+'], c = lab.map(() => 0);
    v.forEach(x => c[Math.max(0, Math.min(8, Math.floor(x) - 1))]++);
    mk('#g2', { type: 'bar', data: { labels: lab, datasets: [{ label: 'estudantes', data: c, backgroundColor: lab.map((_, i) => i < 5 ? ALERT : i < 7 ? LIGHT_RED : GREEN) }] },
      options: { aspectRatio: 1.1, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'horas de sono possível por noite' } }, y: { ticks: { precision: 0 }, title: { display: true, text: 'estudantes' } } } } });
  } else {
    const y0 = f2 ? f2 - 0.6 : 0.4, y1 = f2 ? f2 + 0.6 : 10.6;
    mk('#g2', { type: 'scatter', data: { datasets: [{ label: 'estudante', data: r2.map((r, i) => ({ x: +r.w.sleepAvail.toFixed(2), y: r.e.semester + jit(i) * (f2 ? 0.8 : 0.7), s: r.e.semester })),
      backgroundColor: r2.map(r => r.w.sleepAvail < 6 ? ALERT : r.w.sleepAvail < 8 ? LIGHT_RED : GREEN), pointRadius: 5, pointHoverRadius: 8 }, vline(6, y0, y1, [6, 4], 1.5), vline(8, y0, y1, [2, 3], 1.5)] },
      options: { aspectRatio: 1.8, plugins: { legend: { display: false }, tooltip: { filter: i => i.datasetIndex === 0, callbacks: { label: c => ` ${c.raw.s}º período: ${hm(c.parsed.x)} de sono possível por noite` } } },
        scales: { x: { min: Math.min(0, Math.floor(Math.min(...v, 0))), max: Math.max(10, Math.ceil(Math.max(...v, 10))), title: { display: true, text: 'horas de sono possível por noite' } }, y: termAxis(by, y0, y1) } } });
  }
  $('#n2').textContent = 'Cada ponto é um estudante, sem identificação. As linhas em 6 h (tracejada) e 8 h (pontilhada) são referências de interpretação, não diagnóstico individual. Os percentuais usam como denominador só os estudantes com respostas válidas no filtro escolhido.';
  $('#p2').textContent = `Importante: é sono possível estimado pelo modelo de ocupação do tempo, não o sono efetivamente dormido. Cálculo: (168 h − horas informadas − alimentação e higiene (${fmt(A.essentialsPerDay)} h/dia) − lazer mínimo (${fmt(A.freeMin)} h/sem)) ÷ 7. O sono não entra como atividade: é o que sobra. Deslocamento semanal = minutos por dia × ${fmt(A.campusDays)} dias na EAU.`;
}

// ---------- 3. Simulação: semanas de entrega (10 a 16 h por dia de aulas + trabalhos) ----------
const DELIV = [10, 11, 12, 13, 14, 15, 16];
function graph3(rows) {
  const n = rows.length, ok = n >= MIN_N;
  const vals = DELIV.map(h => rows.map(r => delivery(r.e, A, h)));
  const stat = (f) => vals.map(v => ok ? f(v) : null);
  const line = (label, data, color, dash, w) => ({ label, data, borderColor: color, backgroundColor: color, borderDash: dash, borderWidth: w, pointRadius: 3, tension: 0 });
  mk('#g3', { type: 'line', data: { labels: DELIV.map(h => h + ' h'), datasets: [
      line('média', stat(v => +mean(v).toFixed(2)), css('--fg'), [], 3),
      line('25% dos estudantes dormem até', stat(v => +quantile(v, .25).toFixed(2)), ALERT, [], 2),
      line('75% dos estudantes dormem até', stat(v => +quantile(v, .75).toFixed(2)), GREEN, [], 2),
      { ...line('6 h (referência)', DELIV.map(() => 6), GRAY, [6, 4], 1.5), pointRadius: 0 }] },
    options: { aspectRatio: small() ? 1.1 : 2, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => c.dataset.label.startsWith('6 h') ? null : ` ${c.dataset.label}: ${hm(c.parsed.y)}` } } },
      scales: { x: { title: { display: true, text: 'horas por dia de aulas + trabalhos na semana de entrega' } }, y: { min: 0, suggestedMax: 10, ticks: { stepSize: 2 }, title: { display: true, text: 'horas de sono possível por noite' } } } } });
  $('#st3').innerHTML = [10, 12, 14, 16].map(h => { const v = vals[DELIV.indexOf(h)], p = x => fmt(100 * v.filter(s => s < x).length / n, 0) + '%';
    return `<div><b>${ok ? p(6) + ' · ' + p(4) : '–'}</b><span>${h} h/dia: abaixo de 6 h · abaixo de 4 h</span></div>`; }).join('');
  $('#n3').textContent = ok ? `Simulação com ${n} estudantes: cada um mantém o que declarou (deslocamento, trabalho/estágio, casa, autocuidado) e passa de 10 a 16 horas por dia em aulas e trabalhos acadêmicos. Os percentuais são de estudantes que ficariam abaixo de 6 h e de 4 h de sono possível. Nunca abaixo de zero: 0 h significa que o dia não tem horas sobrando.` : `Poucas respostas válidas (n=${n}): resultado oculto.`;
  $('#p3').textContent = `Isto é uma simulação, não um dado coletado. Sono possível na noite de entrega = 24 h − deslocamento diário − horas de entrega − trabalho/estágio (parcela por dia na EAU, ÷ ${fmt(A.campusDays)}) − trabalho doméstico e autocuidado (÷ 7) − alimentação e higiene (${fmt(A.essentialsPerDay)} h/dia). Leitura e estudo extraclasse ficam dentro das horas de entrega.`;
}

// ---------- 4. Efeito do deslocamento no pior dia ----------
const BANDS = [['até 1 h', 0, 60], ['1 a 2 h', 60, 120], ['2 a 3 h', 120, 180], ['mais de 3 h', 180, 1e9]];
function graph4(rows) {
  const n = rows.length;
  if (mode4 === 'band') {
    const gs = BANDS.map(([, a, b]) => rows.filter(r => r.e.commuteMin > a && r.e.commuteMin <= b)), d = gs.map(g => shown(g) ? +mean(g.map(sw)).toFixed(2) : null);
    mk('#g4', { type: 'bar', data: { labels: BANDS.map(([l], i) => `${l} de deslocamento (${nTxt(gs[i])})${d[i] == null ? '' : ' · ' + hm(d[i])}`), datasets: [{ label: 'sono possível no dia mais pesado', data: d, backgroundColor: d.map(v => v == null ? GREEN : sevColor(v)) }] },
      options: { indexAxis: 'y', aspectRatio: small() ? 1.2 : 2.4, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` média: ${hm(c.parsed.x)} de sono possível no dia mais pesado` } } },
        scales: { x: { min: Math.min(0, Math.floor(Math.min(...d.filter(v => v != null), 0))), ticks: { stepSize: 2 }, grid: lineGrid(6), title: { display: true, text: 'horas de sono possível no dia mais pesado (linha forte = 6 h)' } }, y: { grid: { display: false } } } } });
    $('#lg4').innerHTML = '';
    const a = d[0], z = d[3];
    $('#n4').textContent = `Média do sono possível no dia mais pesado por faixa de deslocamento diário (ida + volta). ${a != null && z != null ? `Quem se desloca mais de 3 h tem em média ${hm(a - z)} a menos que quem se desloca até 1 h. ` : ''}Faixas com menos de ${MIN_N} respostas ficam ocultas.`;
  } else {
    const xs = rows.map(r => r.hrs), ys = rows.map(sw), reg = n >= 10 ? regress(xs, ys) : null;
    const ds = [{ label: 'estudante', data: rows.map(r => ({ x: +r.hrs.toFixed(2), y: +sw(r).toFixed(2), s: r.e.semester })), backgroundColor: rows.map(r => ramp(r.e.semester)), pointRadius: 5, pointHoverRadius: 8 }];
    if (reg) { const x0 = Math.min(...xs), x1 = Math.max(...xs); ds.push({ type: 'line', label: 'tendência', data: [{ x: x0, y: reg.intercept + reg.slope * x0 }, { x: x1, y: reg.intercept + reg.slope * x1 }], borderColor: css('--fg'), borderWidth: 2, borderDash: [6, 4], pointRadius: 0 }); }
    mk('#g4', { type: 'scatter', data: { datasets: ds }, options: { aspectRatio: small() ? 1.1 : 2, plugins: { legend: { display: false }, tooltip: { filter: i => i.datasetIndex === 0, callbacks: { label: c => ` ${c.raw.s}º período: ${hm(c.parsed.x)} de deslocamento por dia · ${hm(c.parsed.y)} de sono possível no dia mais pesado` } } },
      scales: { x: { title: { display: true, text: 'deslocamento por dia, ida + volta (h)' } }, y: { ticks: { stepSize: 2 }, grid: lineGrid(6), title: { display: true, text: 'sono possível no dia mais pesado (h; linha forte = 6 h)' } } } } });
    $('#lg4').innerHTML = TERMS.map(t => `<span><i style="background:${ramp(t)}"></i>${t}º</span>`).join('') + '<span style="margin-left:8px">(cor = período do curso)</span>';
    const strength = r => Math.abs(r) < .2 ? 'fraca ou ausente' : Math.abs(r) < .5 ? 'moderada' : 'forte';
    $('#n4').textContent = reg ? `${reg.n} observações · correlação r = ${fmt(reg.r, 2)} (${strength(reg.r)}) · cada hora a mais de deslocamento por dia corresponde, em média, a ${fmt(Math.abs(reg.slope), 1)} h a menos de sono possível no dia mais pesado. Não indica causalidade.`
      : `${n} observações. Amostra insuficiente (mínimo de 10) para exibir linha de tendência e correlação.`;
  }
  $('#p4').textContent = 'Atenção: o sono possível é calculado descontando o deslocamento informado, então a relação é em grande parte mecânica por construção do modelo (1 h a mais de deslocamento é 1 h a menos de sono possível). O gráfico mostra a ordem de grandeza do que o trajeto consome do dia mais pesado, não uma associação independente.';
}

// ---------- 5. Quantos podem dormir menos de 6 h, por período ----------
function graph5(rows) {
  const by = byTermOf(rows), pc = (g, f) => shown(g) ? +(100 * g.filter(r => f(r) < 6).length / g.length).toFixed(0) : null;
  const dW = by.map(g => pc(g, sw)), dA = by.map(g => pc(g, r => r.w.sleepAvail));
  mk('#g5', { type: 'bar', data: { labels: by.map((g, i) => `${i + 1}º (${nTxt(g)})`), datasets: [
      { label: 'no dia mais pesado', data: dW, backgroundColor: ALERT },
      { label: 'em uma noite média da semana', data: dA, backgroundColor: LIGHT_RED }] },
    options: { indexAxis: 'y', aspectRatio: small() ? 0.9 : 1.5, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.x}% dormem menos de 6 h` } } },
      scales: { x: { min: 0, max: 100, title: { display: true, text: '% dos estudantes do período que podem dormir menos de 6 h' } }, y: { reverse: true, grid: { display: false } } } } });
  $('#n5').textContent = `Vermelho forte: sono possível no dia mais pesado abaixo de 6 h. Vermelho claro: sono possível numa noite média da semana abaixo de 6 h, para comparação. Cada barra usa como denominador os estudantes válidos do período (n). Períodos com menos de ${MIN_N} respostas ficam ocultos.`;
}

// ---------- rodapé metodológico ----------
function method(rows) {
  $('#mUpd').textContent = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  $('#mN').textContent = `${rows.length} respostas válidas (de ${entries.length} registros${discarded ? `; ${discarded} ignorada${discarded > 1 ? 's' : ''} por dados incoerentes` : ''})`;
}

function buildAssump() {
  const fields = [['sleepPerDay', 'Sono de referência (h/dia)', .5], ['essentialsPerDay', 'Alimentação e higiene (h/dia)', .5], ['campusDays', 'Dias na EAU/sem', 1], ['freeMin', 'Lazer mínimo (h/sem)', 1]];
  $('#assump').innerHTML = fields.map(([k, l, s]) => `<div><label>${l}</label><input type="number" step="${s}" min="0" data-k="${k}" value="${A[k]}"></div>`).join('');
  document.querySelectorAll('[data-k]').forEach(i => i.oninput = () => { A[i.dataset.k] = +i.value; save(); });
}
function save() { try { localStorage.setItem('eau-assump-v4', JSON.stringify(A)); } catch {} render(); }

buildAssump();
const f2sel = $('#f2'); f2sel.add(new Option('Todos os períodos', 0)); for (const t of TERMS) f2sel.add(new Option(t + 'º período', t));
f2sel.onchange = () => { f2 = +f2sel.value; graph2(lastRows); };
const seg = (sel, set, draw) => document.querySelectorAll(sel + ' button').forEach(b => b.onclick = () => { set(b.dataset.m); document.querySelectorAll(sel + ' button').forEach(x => x.classList.toggle('on', x === b)); draw(lastRows); });
seg('#seg1', m => mode1 = m, graph1); seg('#seg4', m => mode4 = m, graph4);
DB.list().then(es => { entries = es; render(); }).catch(e => { $('#kpis').innerHTML = `<div class="card">${e.message}</div>`; });
