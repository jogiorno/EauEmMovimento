const { DEFAULTS, week, complete, CATS, ALERT, MIN_N, composition, mean, median, quantile, regress, hm, fmt } = Model;
const $ = s => document.querySelector(s);
const A = JSON.parse(JSON.stringify(DEFAULTS));
try { Object.assign(A, JSON.parse(localStorage.getItem('eau-assump-v4') || '{}')); } catch {}
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const avg = a => a.length ? mean(a) : 0;
let entries = [], charts = {}, lastRows = [], mode1 = 'mean', mode3 = 'full', f2 = 0;

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
  const rows = entries.filter(complete).map(e => ({ e, w: week(e, A), hrs: e.commuteMin / 60 }));
  const n = rows.length;
  const weekCommute = avg(rows.map(r => r.w.commute));
  const neg = rows.filter(r => r.w.free < 0).length;
  $('#headline').innerHTML = n ? `<b>${hm(avg(rows.map(r => r.w.sleepWorst)))}</b><span>de sono possível, em média, no dia mais pesado, depois de aulas, trabalho, estudo, casa, autocuidado e deslocamento.</span><small>Média de ${n} trajeto${n > 1 ? 's' : ''} completo${n > 1 ? 's' : ''}. Veja as premissas no fim da página.</small>` : '';
  $('#kpis').innerHTML = [
    [n ? fmt(avg(rows.map(r => r.w.sleepAvail))) + ' h' : '–', 'sono possível por noite (média)'],
    [n ? fmt(100 * rows.filter(r => r.w.sleepWorst < 6).length / n, 0) + '%' : '–', 'podem dormir <strong>menos de 6 h</strong> no dia mais pesado', 1],
    [n ? fmt(100 * rows.filter(r => r.w.sleepWorst < 4).length / n, 0) + '%' : '–', 'podem dormir <strong>menos de 4 h</strong> no dia mais pesado', 1],
    [n ? fmt(avg(rows.map(r => r.w.sleepWorst))) + ' h' : '–', 'sono possível no dia mais pesado (média)'],
    [n ? fmt(avg(rows.map(r => r.e.classWeekMin / 60))) + ' h' : '–', 'horas de aula por semana (média)'],
    [n ? fmt(avg(rows.map(r => r.e.classMaxDayMin / 60))) + ' h' : '–', 'maior dia de aula (média)'],
    [n ? fmt(100 * rows.filter(r => r.e.workMin > 0).length / n, 0) + '%' : '–', 'trabalham ou estagiam'],
    [n, 'trajetos completos (de ' + entries.length + ' registrados)'],
    [fmt(avg(rows.map(r => r.hrs))) + ' h', 'deslocamento médio por dia (ida + volta)'],
    [fmt(avg(rows.map(r => r.e.distKm))) + ' km', 'distância média em linha reta'],
    [fmt(weekCommute) + ' h', 'deslocamento por semana'],
    [fmt(weekCommute * 18, 0) + ' h', 'deslocamento por semestre (≈18 sem.)'],
    [n ? fmt(100 * neg / n, 0) + '%' : '–', 'com semana que não fecha (saldo < 0)'],
  ].map(([b, s, alert]) => `<div class="card kpi${alert ? ' alert' : ''}"><b>${b}</b><span>${s}</span></div>`).join('');

  lastRows = rows; graph1(rows); graph2(rows); graph3(rows); graph4(rows); graph5(rows); method(rows);
}

// ---------- 1. A semana não fecha: saldo = 168 h − horas informadas − sono de referência − alimentação e higiene ----------
function graph1(rows) {
  const by = byTermOf(rows), free = r => r.w.free, n = rows.length, negN = rows.filter(r => free(r) < 0).length;
  let cfg;
  if (mode1 === 'mean') {
    const d = by.map(g => shown(g) ? +mean(g.map(free)).toFixed(1) : null);
    cfg = { type: 'bar', data: { labels: by.map((g, i) => `${i + 1}º (${nTxt(g)})${d[i] == null ? '' : ' · ' + hm(d[i])}`), datasets: [{ label: 'saldo médio', data: d, backgroundColor: d.map(v => v < 0 ? ALERT : GREEN) }] },
      options: { indexAxis: 'y', aspectRatio: small() ? 1.1 : 2, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` saldo médio: ${hm(c.parsed.x)} por semana` } } },
        scales: { x: { grid: lineGrid(0), title: { display: true, text: 'horas por semana: saldo (negativo = déficit)' } }, y: { reverse: true, grid: { display: false } } } } };
  } else if (mode1 === 'dist') {
    cfg = { type: 'scatter', data: { datasets: [{ label: 'estudante', data: rows.map((r, i) => ({ x: +free(r).toFixed(1), y: r.e.semester + jit(i) * 0.7, s: r.e.semester })),
      backgroundColor: rows.map(r => free(r) < 0 ? ALERT : GREEN), pointRadius: 5, pointHoverRadius: 8 }, vline(0, 0.4, 10.6, [], 2)] },
      options: { aspectRatio: small() ? 1 : 1.8, plugins: { legend: { display: false }, tooltip: { filter: i => i.datasetIndex === 0, callbacks: { label: c => ` ${c.raw.s}º período: saldo de ${hm(c.parsed.x)} por semana` } } },
        scales: { x: { grid: lineGrid(0), title: { display: true, text: 'horas por semana: saldo (negativo = déficit)' } }, y: termAxis(by, 0.4, 10.6) } } };
  } else {
    const pct = g => 100 * g.filter(r => free(r) < 0).length / g.length, d = by.map(g => shown(g) ? +pct(g).toFixed(0) : null);
    cfg = { type: 'bar', data: { labels: by.map((g, i) => `${i + 1}º (${nTxt(g)})${d[i] == null ? '' : ` · ${g.filter(r => free(r) < 0).length} de ${g.length}`}`), datasets: [{ label: '% com saldo negativo', data: d, backgroundColor: ALERT }] },
      options: { indexAxis: 'y', aspectRatio: small() ? 1.1 : 2, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.parsed.x}% dos estudantes do período` } } },
        scales: { x: { min: 0, max: 100, title: { display: true, text: '% dos estudantes do período com saldo negativo' } }, y: { reverse: true, grid: { display: false } } } } };
  }
  mk('#g1', cfg);
  $('#n1').textContent = n ? `${n} estudantes com respostas completas; ${negN} (${fmt(100 * negN / n, 0)}%) com saldo semanal negativo. Cada período mostra o número de respostas (n); períodos com menos de ${MIN_N} respostas têm o resultado agregado oculto.` : 'Ainda não há respostas completas.';
  $('#p1').textContent = `Como é calculado: saldo = 168 h − horas informadas (aulas, trabalho/estágio, trabalho doméstico, leitura, estudo extraclasse, autocuidado, deslocamento) − premissas de sono de referência (${fmt(A.sleepPerDay)} h/dia) e de alimentação e higiene (${fmt(A.essentialsPerDay)} h/dia). O lazer mínimo (${fmt(A.freeMin)} h/sem) não entra neste saldo, e o sono não é contado aqui como resultado residual. Deslocamento semanal = minutos por dia × ${fmt(A.campusDays)} dias na EAU.`;
}

// ---------- 2. Quanto conseguimos dormir? sono possível por noite = (168 h − horas informadas − alimentação e higiene − lazer mínimo) ÷ 7 ----------
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
  $('#n2').textContent = 'Cada ponto é um estudante, sem identificação. As linhas em 6 h (tracejada) e 8 h (pontilhada) são referências de interpretação, não diagnóstico individual. Os percentuais usam como denominador só os estudantes com respostas completas no filtro escolhido.';
  $('#p2').textContent = `Importante: é sono possível estimado pelo modelo de ocupação do tempo, não o sono efetivamente dormido. Cálculo: (168 h − horas informadas − alimentação e higiene (${fmt(A.essentialsPerDay)} h/dia) − lazer mínimo (${fmt(A.freeMin)} h/sem)) ÷ 7. O sono não entra como atividade: é o que sobra. Deslocamento semanal = minutos por dia × ${fmt(A.campusDays)} dias na EAU.`;
}

// ---------- 3. Para onde vão as 168 horas? Média por período da composição de cada estudante (cada semana fecha em 168 h) ----------
function graph3(rows) {
  const groups = [['Todos', rows], ...byTermOf(rows).map((g, i) => [`${i + 1}º`, g])];
  const comps = groups.map(([, g]) => g.map(r => composition(r.w))), ok = groups.map(([, g], i) => i === 0 ? g.length >= MIN_N : shown(g));
  const m = (i, k) => ok[i] ? mean(comps[i].map(c => c[k])) : null;
  const declared = CATS.filter(c => c[4] === 'declarado');
  let ds;
  if (mode3 === 'full') ds = CATS.map(([k, l, col]) => ({ label: l, backgroundColor: col, borderColor: '#fff', borderWidth: 1, data: groups.map((_, i) => m(i, k)) }));
  else {
    ds = declared.map(([k, l, col]) => ({ label: l, backgroundColor: col, borderColor: '#fff', borderWidth: 1, data: groups.map((_, i) => m(i, k)) }));
    ds.push({ label: 'Presumido ou não informado', backgroundColor: '#e3e6ea', borderColor: '#fff', borderWidth: 1, data: groups.map((_, i) => ok[i] ? Math.max(0, 168 - declared.reduce((s, c) => s + m(i, c[0]), 0)) : null) });
  }
  const maxTot = Math.max(168, ...groups.map((_, i) => ok[i] ? mean(comps[i].map(c => c.total)) : 0)), xmax = 24 * Math.ceil(maxTot / 24);
  mk('#g3', { type: 'bar', data: { labels: groups.map(([l, g], i) => `${l === 'Todos' ? 'Todos' : l + ' período'} (${i === 0 ? 'n=' + g.length : nTxt(g)})`), datasets: ds },
    options: { indexAxis: 'y', aspectRatio: small() ? 0.8 : 1.6, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${hm(c.parsed.x)} por semana` } } },
      scales: { x: { stacked: true, min: 0, max: xmax, grid: lineGrid(168), ticks: { stepSize: 24 }, title: { display: true, text: 'horas por semana (linha forte = 168 h)' } }, y: { stacked: true, reverse: true, grid: { display: false } } } } });
  const over = groups.map((_, i) => ok[i] ? mean(comps[i].map(c => c.total)) - 168 : 0), anyOver = over.some(x => x > 0.05);
  $('#n3').textContent = `Cada barra é a média, no grupo, da semana de cada estudante (que fecha em 168 h quando as atividades cabem). ${anyOver ? 'Quando a barra passa da linha de 168 h, as atividades informadas somam mais horas do que a semana tem: o excedente aparece, não é cortado. ' : ''}Grupos com menos de ${MIN_N} respostas ficam ocultos.`;
  $('#p3').textContent = mode3 === 'full'
    ? `Formação: aulas, estudo extraclasse, leitura. Trabalho: trabalho/estágio. Reprodução cotidiana: deslocamento, trabalho doméstico, alimentação e higiene. Recuperação: autocuidado, sono e tempo livre. Declarado pelos estudantes: aulas, estudo, leitura, trabalho/estágio, deslocamento, trabalho doméstico, autocuidado. Presumido (premissa): alimentação e higiene (${fmt(A.essentialsPerDay)} h/dia) e sono de referência (${fmt(A.sleepPerDay)} h/dia). Residual: tempo livre = o que sobra.`
    : 'Somente o que os estudantes declararam. O restante da semana (premissas e sobra) aparece em cinza claro, sem atribuir a ele um significado.';
}

// ---------- 4. A distância também consome tempo ----------
function graph4(rows) {
  const xs = rows.map(r => r.hrs), ys = rows.map(r => r.w.sleepAvail), reg = rows.length >= 10 ? regress(xs, ys) : null;
  const ds = [{ label: 'estudante', data: rows.map(r => ({ x: +r.hrs.toFixed(2), y: +r.w.sleepAvail.toFixed(2), s: r.e.semester })), backgroundColor: rows.map(r => ramp(r.e.semester)), pointRadius: 5, pointHoverRadius: 8 }];
  if (reg) { const x0 = Math.min(...xs), x1 = Math.max(...xs); ds.push({ type: 'line', label: 'tendência', data: [{ x: x0, y: reg.intercept + reg.slope * x0 }, { x: x1, y: reg.intercept + reg.slope * x1 }], borderColor: css('--fg'), borderWidth: 2, borderDash: [6, 4], pointRadius: 0 }); }
  mk('#g4', { type: 'scatter', data: { datasets: ds }, options: { aspectRatio: small() ? 1.1 : 2, plugins: { legend: { display: false }, tooltip: { filter: i => i.datasetIndex === 0, callbacks: { label: c => ` ${c.raw.s}º período: ${hm(c.parsed.x)} de deslocamento por dia · ${hm(c.parsed.y)} de sono possível` } } },
    scales: { x: { title: { display: true, text: 'deslocamento por dia, ida + volta (h)' } }, y: { grid: lineGrid(0), title: { display: true, text: 'sono possível por noite (h)' } } } } });
  $('#lg4').innerHTML = TERMS.map(t => `<span><i style="background:${ramp(t)}"></i>${t}º</span>`).join('') + '<span style="margin-left:8px">(cor = período do curso)</span>';
  const strength = r => Math.abs(r) < .2 ? 'fraca ou ausente' : Math.abs(r) < .5 ? 'moderada' : 'forte';
  $('#n4').textContent = reg ? `${reg.n} observações · correlação r = ${fmt(reg.r, 2)} (${strength(reg.r)}) · reta de mínimos quadrados tracejada. Não indica causalidade.`
    : `${rows.length} observações. Amostra insuficiente (mínimo de 10) para exibir linha de tendência e correlação.`;
  $('#p4').textContent = 'Atenção: o sono possível é calculado descontando o deslocamento informado, então parte da relação é mecânica por construção do modelo. O gráfico mostra a ordem de grandeza do efeito do deslocamento sobre o tempo restante, não uma associação independente.';
}

// ---------- 5. Como a sobrecarga muda ao longo do curso? Painéis por período, mesma escala (h/semana) ----------
function graph5(rows) {
  const by = byTermOf(rows);
  const vals = g => [['Aulas', mean(g.map(r => r.w.class)), BLUE], ['Trabalho/estágio', mean(g.map(r => r.w.intern)), TERRA], ['Estudo extraclasse', mean(g.map(r => r.w.study)), '#7f9bb5'], ['Sono possível', mean(g.map(r => Math.max(0, r.w.sleepAvail) * 7)), GREEN]];
  const xmax = Math.max(10, 10 * Math.ceil(Math.max(0, ...by.filter(shown).flatMap(g => vals(g).map(v => v[1]))) / 10));
  $('#sm').innerHTML = by.map((g, i) => `<div class="card sm"><h4>${i + 1}º período <small>(${nTxt(g)})</small></h4>${shown(g) ? `<canvas id="sm${i + 1}"></canvas>` : `<p class="note">${g.length ? 'Poucas respostas: resultado oculto para preservar o anonimato.' : 'Sem respostas.'}</p>`}</div>`).join('');
  by.forEach((g, i) => { if (!shown(g)) { charts['#sm' + (i + 1)]?.destroy(); delete charts['#sm' + (i + 1)]; return; }
    const v = vals(g);
    mk('#sm' + (i + 1), { type: 'bar', data: { labels: v.map(([l, h]) => `${l} · ${hm(h)}`), datasets: [{ data: v.map(x => +x[1].toFixed(1)), backgroundColor: v.map(x => x[2]) }] },
      options: { indexAxis: 'y', aspectRatio: 1.7, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${hm(c.parsed.x)} por semana` } } }, scales: { x: { min: 0, max: xmax, ticks: { stepSize: xmax / 2 } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } } } }); });
  $('#n5').textContent = `Todos os painéis usam a mesma escala (0 a ${xmax} h por semana) e mostram médias do período. O sono possível é o valor por noite × 7, para ficar na mesma unidade. Períodos com menos de ${MIN_N} respostas ficam ocultos.`;
}

// ---------- rodapé metodológico ----------
function method(rows) {
  $('#mUpd').textContent = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  $('#mN').textContent = `${rows.length} respostas completas (de ${entries.length} registros)`;
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
seg('#seg1', m => mode1 = m, graph1); seg('#seg3', m => mode3 = m, graph3);
DB.list().then(es => { entries = es; render(); }).catch(e => { $('#kpis').innerHTML = `<div class="card">${e.message}</div>`; });
