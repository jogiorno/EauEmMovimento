const { DEFAULTS, week, complete, validate, delivery, REFS, refStudy, CATS, ALERT, MIN_N, composition, mean, median, quantile, regress, hm, fmt } = Model;
const $ = s => document.querySelector(s);
const A = JSON.parse(JSON.stringify(DEFAULTS));
try { Object.assign(A, JSON.parse(localStorage.getItem('eau-assump-v4') || '{}')); } catch {}
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const avg = a => a.length ? mean(a) : 0;
let entries = [], charts = {}, lastRows = [], mode1 = 'mean', mode4 = 'band', discarded = 0;

const small = () => innerWidth < 720;
Chart.defaults.aspectRatio = small() ? 1.1 : 2;
function mk(id, cfg) {
  charts[id]?.destroy();
  Chart.defaults.font.family = "'Geist Mono', monospace"; Chart.defaults.font.size = small() ? 11 : 12; Chart.defaults.color = css('--mute'); Chart.defaults.borderColor = css('--line');
  charts[id] = new Chart($(id), cfg);
}

// ---------- apoio ----------
const TERMS = Array.from({ length: 10 }, (_, i) => i + 1);
const byTermOf = rows => TERMS.map(t => rows.filter(r => r.e.semester === t));
const shown = g => g.length >= MIN_N; // privacidade: períodos com poucas respostas não mostram resultados agregados
const lab = (g, i) => `${i + 1}º${shown(g) ? '' : '*'}`; // asterisco = período com poucas respostas (oculto)
const PRIV = '* Períodos com poucas respostas não são exibidos, para preservar a privacidade.';
const T = (long, short) => small() ? short : long; // título de eixo mais curto no celular, para não cortar
// Valor escrito na ponta de cada barra horizontal (em vez de espremê-lo no rótulo do eixo).
Chart.register({ id: 'vlabel', afterDatasetsDraw(ch) {
  const o = ch.options.plugins.vlabel; if (!o || !o.kind) return; const f = v => o.kind === 'pct' ? v + '%' : hm(v); // (função em opção do Chart.js vira 'scriptable'; por isso um texto)
  const c = ch.ctx; c.save(); c.fillStyle = css('--fg'); c.font = `600 ${small() ? 11 : 12}px 'Geist Mono', monospace`; c.textBaseline = 'middle'; c.textAlign = 'left';
  ch.data.datasets.forEach((ds, di) => ch.getDatasetMeta(di).data.forEach((el, i) => { const v = ds.data[i]; if (v == null) return; c.fillText(f(v), Math.max(el.x, el.base) + 5, el.y); }));
  c.restore(); } });
const VL = kind => ({ vlabel: { kind } });
const jit = i => ((((i + 1) * 2654435761) >>> 0) % 1000) / 1000 - 0.5; // espalhamento vertical estável: pontos não se sobrepõem
const termAxis = (by, lo, hi) => ({ reverse: true, min: lo, max: hi, grid: { display: false }, ticks: { stepSize: 1, callback: v => Number.isInteger(v) && v >= 1 && v <= 10 ? `${v}º` : '' } });
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
  $('#headline').innerHTML = n ? `<b>${hm(avg(rows.map(r => r.w.sleepWorst)))}</b><span>de sono possível, em média, no dia mais pesado, depois de aulas, trabalho, estudo, casa, autocuidado e deslocamento.</span><small>Média de ${n} trajeto${n > 1 ? 's' : ''} válido${n > 1 ? 's' : ''}. Veja as premissas no fim da página.</small><em class="hint">Clique para ver o que a falta de sono causa na saúde →</em>` : '';
  $('#kpis').innerHTML = [
    [n ? hm(avg(rows.map(r => r.w.sleepAvail))) : '–', 'sono possível por noite (média)'],
    [n ? fmt(100 * rows.filter(r => r.w.sleepWorst < 6).length / n, 0) + '%' : '–', 'podem dormir <strong>menos de 6 h</strong> no dia mais pesado', 1],
    [n ? fmt(100 * rows.filter(r => r.w.sleepWorst < 4).length / n, 0) + '%' : '–', 'podem dormir <strong>menos de 4 h</strong> no dia mais pesado', 1],
    [n ? hm(avg(rows.map(r => r.e.classWeekMin / 60))) : '–', 'horas de aula por semana (média)'],
    [n ? hm(avg(rows.map(r => r.e.classMaxDayMin / 60))) : '–', 'maior dia de aula (média)'],
    [n ? fmt(100 * rows.filter(r => r.e.workMin > 0).length / n, 0) + '%' : '–', 'trabalham ou estagiam'],
    [n, 'trajetos válidos (de ' + entries.length + ' registrados)'],
    [n ? hm(avg(rows.map(r => r.hrs))) : '–', 'deslocamento médio por dia (ida + volta)'],
    [n ? fmt(avg(rows.map(r => r.e.distKm))) + ' km' : '–', 'distância média em linha reta'],
    [n ? hm(weekCommute) : '–', 'deslocamento por semana'],
    [n ? hm(weekCommute * 18) : '–', 'deslocamento por semestre (≈18 sem.)'],
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
    cfg = { type: 'bar', data: { labels: by.map(lab), datasets: [{ label: 'sono possível no dia mais pesado', data: d, backgroundColor: d.map(v => v == null ? GREEN : sevColor(v)) }] },
      options: { indexAxis: 'y', aspectRatio: small() ? 1.1 : 2, layout: { padding: { right: 78 } }, plugins: { ...VL('h'), legend: { display: false }, tooltip: { callbacks: { label: c => ` média: ${hm(c.parsed.x)} de sono possível no dia mais pesado` } } },
        scales: { x: { min: lo, ticks: xt, grid: lineGrid(6), title: { display: true, text: T('horas de sono possível no dia mais pesado (linha forte = 6 h)', 'horas de sono no pior dia (linha = 6 h)') } }, y: { reverse: true, grid: { display: false } } } } };
  } else if (mode1 === 'dist') {
    cfg = { type: 'scatter', data: { datasets: [{ label: 'estudante', data: rows.map((r, i) => ({ x: +sw(r).toFixed(2), y: r.e.semester + jit(i) * 0.7, s: r.e.semester })),
      backgroundColor: rows.map(r => sevColor(sw(r))), pointRadius: 5, pointHoverRadius: 8 }, vline(6, 0.4, 10.6, [6, 4], 1.5), vline(4, 0.4, 10.6, [], 2)] },
      options: { aspectRatio: small() ? 1 : 1.8, plugins: { legend: { display: false }, tooltip: { filter: i => i.datasetIndex === 0, callbacks: { label: c => ` ${c.raw.s}º período: ${hm(c.parsed.x)} de sono possível no dia mais pesado` } } },
        scales: { x: { min: lo, max: Math.max(12, Math.ceil(Math.max(...rows.map(sw), 12))), ticks: xt, title: { display: true, text: T('horas de sono possível no dia mais pesado (tracejada = 6 h, cheia = 4 h)', 'horas de sono no pior dia') } }, y: termAxis(by, 0.4, 10.6) } } };
  } else {
    const d = by.map(g => shown(g) ? +(100 * lt(g, 4) / g.length).toFixed(0) : null);
    cfg = { type: 'bar', data: { labels: by.map(lab), datasets: [{ label: '% com menos de 4 h', data: d, backgroundColor: ALERT }] },
      options: { indexAxis: 'y', aspectRatio: small() ? 1.1 : 2, layout: { padding: { right: 48 } }, plugins: { ...VL('pct'), legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.parsed.x}% dos estudantes do período` } } },
        scales: { x: { min: 0, max: 100, title: { display: true, text: T('% dos estudantes que podem dormir menos de 4 h no dia mais pesado', '% com menos de 4 h no pior dia') } }, y: { reverse: true, grid: { display: false } } } } };
  }
  mk('#g1', cfg);
  $('#n1').innerHTML = (n ? `${n} respostas válidas no total. Vermelho forte: menos de 4 h; vermelho claro: de 4 a 6 h.` : 'Ainda não há respostas válidas.') + (mode1 === 'dist' ? '' : '<br>' + PRIV);
  $('#p1').textContent = `Como é calculado: 24 h − deslocamento diário − maior dia de aula informado − parcela diária do trabalho/estágio e do estudo (dividida pelos ${fmt(A.campusDays)} dias na EAU) − parcela diária de trabalho doméstico, leitura e autocuidado (÷ 7) − alimentação e higiene (${fmt(A.essentialsPerDay)} h/dia). É a combinação mais pesada que o estudante declarou, não necessariamente um dia real.`;
}

const REF_HTML = `<h3>De onde vêm os números de referência</h3>
<p><strong>Estes números são pisos, não metas de excelência.</strong> Não existe uma norma que diga quantas horas por semana um estudante deve dedicar a cuidar de si e a ler. Cada referência abaixo é a melhor âncora pública que encontramos, com o que ela cobre e o que não cobre.</p>
<h3>Autocuidado: 2 h 30 min por semana (piso)</h3>
<ul>
<li><strong>Exercício físico.</strong> A OMS (<a href="https://www.who.int/news/item/25-11-2020-every-move-counts-towards-better-health-says-who" target="_blank" rel="noopener">diretrizes de 2020 sobre atividade física e comportamento sedentário</a>) recomenda que adultos façam de 150 a 300 minutos por semana de atividade aeróbica moderada (ou 75 a 150 minutos de atividade vigorosa). Usamos o mínimo: 150 min = <strong>2 h 30 min</strong>. É a única parte do autocuidado com meta numérica de uma entidade internacional de saúde.</li>
<li><strong>Terapia.</strong> Não há uma quantidade de terapia que valha para todos: ela depende de haver necessidade. Como ordem de grandeza, as diretrizes do <a href="https://www.nice.org.uk/guidance/ng222/chapter/Recommendations" target="_blank" rel="noopener">NICE (Reino Unido) para depressão</a> descrevem terapia cognitivo-comportamental individual em geral com cerca de 8 sessões ou mais, de cerca de 1 hora, semanais ou quinzenais. Para quem está em tratamento, isso soma <strong>cerca de 0,5 a 1 h por semana</strong> durante alguns meses, fora o deslocamento. Esse tempo <strong>não entra</strong> na referência de todos, porque só vale para quem faz terapia.</li>
<li><strong>Consultas médicas, exames e saúde bucal.</strong> Também não há meta semanal: são eventos esporádicos. Uma consulta ou exame de rotina costuma tomar de 1 a 3 h, contando deslocamento e espera; algumas vezes por ano, isso dá <strong>de 1 a 4 minutos por semana</strong> em média (cálculo nosso, como ilustração, não recomendação). Por isso pesam pouco na média, mas podem tomar um dia inteiro quando acontecem, e isso conta no pior dia de quem as faz na semana.</li>
<li>As <a href="https://www.who.int/publications/i/item/9789240052192" target="_blank" rel="noopener">diretrizes de autocuidado da OMS (2022)</a> tratam de intervenções de saúde que as pessoas podem fazer por conta própria, e não fixam uma meta de horas por semana que pudéssemos usar.</li>
</ul>
<p><strong>Conclusão para o gráfico:</strong> a referência de autocuidado é 2 h 30 min, o piso de exercício da OMS. Quem informa menos que isso está abaixo do mínimo recomendado só para atividade física, mesmo antes de contar terapia e consultas, que somariam mais tempo para quem precisa delas.</p>
<h3>Leitura e estudo extraclasse: 40 h de carga total, menos as aulas</h3>
<ul>
<li><strong>Nem a OMS nem o MEC definem horas semanais de leitura.</strong> A <a href="https://www.normasbrasil.com.br/norma/resolucao-3-2007_106888.html" target="_blank" rel="noopener">Resolução CNE/CES nº 3/2007</a> conta o "trabalho discente efetivo" na carga horária dos cursos, mas não fixa quantas horas de estudo fora de sala correspondem a cada hora de aula.</li>
<li><strong>A âncora internacional é a carga total do estudante.</strong> O <a href="https://education.ec.europa.eu/sites/default/files/document-library-docs/ects-users-guide_en.pdf" target="_blank" rel="noopener">Guia do Sistema Europeu de Créditos (ECTS)</a> define 1 crédito como 25 a 30 horas de trabalho do estudante, e um ano em tempo integral como 60 créditos, ou seja, <strong>1.500 a 1.800 horas por ano</strong>. Esse trabalho inclui aulas, estudo, leitura e trabalhos. O ano letivo brasileiro tem no mínimo 200 dias letivos (40 semanas), o que dá <strong>de 37,5 a 45 horas por semana</strong>. Adotamos <strong>40 h por semana</strong>, o meio do intervalo.</li>
<li><strong>A referência de cada estudante</strong> é, portanto, 40 h − as horas de aula que ele informou. Quem tem 22 h de aula teria como referência 18 h de leitura e estudo extraclasse somados. Comparamos com <strong>leitura + estudo extraclasse juntos</strong>, porque a leitura acadêmica e o estudo se misturam no dia a dia e não há referência separada para cada um.</li>
<li>O próprio guia do ECTS ressalta que isso é carga <strong>típica</strong>, e que o tempo real varia de pessoa para pessoa e de disciplina para disciplina.</li>
</ul>
<h3>Limites desta comparação</h3>
<ul>
<li>O trabalho/estágio fica de fora dessa carga de 40 h: o ECTS trata a carga acadêmica. Quem trabalha ou estagia soma mais horas, o que agrava o quadro.</li>
<li>Leitura por prazer não tem referência oficial; tratamos aqui leitura e estudo como carga acadêmica.</li>
<li>As referências são de saúde e educação gerais, não de cursos de Arquitetura e Urbanismo em tempo integral com ateliê, cuja carga costuma ser maior.</li>
</ul>`;

// ---------- 2. Autocuidado e leitura: o que os estudantes gastam × referência ----------
function graph2(rows) {
  const n = rows.length, ok = n >= MIN_N, R = REFS, m = k => ok ? mean(rows.map(r => r.w[k])) : NaN;
  const self = m('selfcare'), read = m('reading'), study = m('study'), refS = ok ? mean(rows.map(r => refStudy(r.w))) : NaN;
  const pie = (id, labels, data, colors, title) => mk(id, { type: 'doughnut', data: { labels, datasets: [{ data: data.map(v => +v.toFixed(2)), backgroundColor: colors, borderColor: '#fff', borderWidth: 2, offset: colors.map((_, i) => i < colors.length - 1 ? 14 : 0) }] },
    options: { aspectRatio: 1, layout: { padding: 14 }, plugins: { title: { display: true, text: title, font: { size: 14 } }, legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: { callbacks: { label: c => ` ${c.label}: ${hm(c.parsed)} por semana (${fmt(100 * c.parsed / 168, 1)}% da semana)` } } } } });
  if (ok) {
    pie('#g2a', ['Autocuidado', 'Leitura', 'Estudo extraclasse', 'Demais atividades e descanso'], [self, read, study, 168 - self - read - study], ['#5f8a78', '#a3b8cc', '#7f9bb5', '#e3e6ea'], 'O que os estudantes informam (média, 168 h)');
    pie('#g2b', ['Autocuidado (referência)', 'Leitura + estudo extraclasse (referência)', 'Demais atividades e descanso'], [R.selfcareH, refS, 168 - R.selfcareH - refS], ['#5f8a78', '#7f9bb5', '#e3e6ea'], 'Referência (168 h)');
  } else { charts['#g2a']?.destroy(); charts['#g2b']?.destroy(); delete charts['#g2a']; delete charts['#g2b']; }
  const below = f => fmt(100 * rows.filter(f).length / n, 0) + '%';
  $('#st2').innerHTML = (ok ? [
    [hm(self), 'autocuidado por semana (média informada)'], [hm(R.selfcareH), 'referência de autocuidado (OMS, só exercício)'],
    [below(r => r.w.selfcare < R.selfcareH), 'abaixo da referência de autocuidado'],
    [hm(read), 'leitura por semana (média informada)'], [hm(read + study), 'leitura + estudo extraclasse (média informada)'], [hm(refS), 'referência de leitura + estudo (40 h de carga total − aulas)'],
    [below(r => r.w.reading + r.w.study < refStudy(r.w)), 'abaixo da referência de leitura + estudo']] : [])
    .map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
  $('#n2').textContent = ok ? `Média de ${n} respostas válidas no total. As fatias de autocuidado e leitura estão destacadas; as referências são pisos mínimos, não metas de excelência. Os percentuais comparam cada estudante com a própria referência (a de leitura + estudo depende das horas de aula dele). Veja abaixo de onde vêm os números.` : `Poucas respostas válidas: resultado oculto para preservar a privacidade.`;
  $('#p2').innerHTML = REF_HTML;
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
      scales: { x: { title: { display: true, text: T('horas por dia de aulas + trabalhos na semana de entrega', 'horas/dia de aulas + trabalhos') } }, y: { min: 0, suggestedMax: 10, ticks: { stepSize: 2 }, title: { display: true, text: T('horas de sono possível por noite', 'horas de sono/noite') } } } } });
  $('#st3').innerHTML = [10, 12, 14, 16].map(h => { const v = vals[DELIV.indexOf(h)], p = x => fmt(100 * v.filter(s => s < x).length / n, 0) + '%';
    return `<div><b>${ok ? p(6) + ' · ' + p(4) : '–'}</b><span>${h} h/dia: abaixo de 6 h · abaixo de 4 h</span></div>`; }).join('');
  $('#n3').textContent = ok ? `Simulação com ${n} respostas válidas no total: cada um mantém o que declarou (deslocamento, trabalho/estágio, casa, autocuidado) e passa de 10 a 16 horas por dia em aulas e trabalhos acadêmicos. Os percentuais são de estudantes que ficariam abaixo de 6 h e de 4 h de sono possível. Nunca abaixo de zero: 0 h significa que o dia não tem horas sobrando.` : `Poucas respostas válidas: resultado oculto para preservar a privacidade.`;
  $('#p3').textContent = `Isto é uma simulação, não um dado coletado. Sono possível na noite de entrega = 24 h − deslocamento diário − horas de entrega − trabalho/estágio (parcela por dia na EAU, ÷ ${fmt(A.campusDays)}) − trabalho doméstico e autocuidado (÷ 7) − alimentação e higiene (${fmt(A.essentialsPerDay)} h/dia). Leitura e estudo extraclasse ficam dentro das horas de entrega.`;
}

// ---------- 4. Efeito do deslocamento no pior dia ----------
const BANDS = [['até 1 h', 0, 60], ['1 a 2 h', 60, 120], ['2 a 3 h', 120, 180], ['mais de 3 h', 180, 1e9]];
function graph4(rows) {
  const n = rows.length;
  if (mode4 === 'band') {
    const gs = BANDS.map(([, a, b]) => rows.filter(r => r.e.commuteMin > a && r.e.commuteMin <= b)), d = gs.map(g => shown(g) ? +mean(g.map(sw)).toFixed(2) : null);
    mk('#g4', { type: 'bar', data: { labels: BANDS.map(([l], i) => `${l}${shown(gs[i]) ? '' : '*'}`), datasets: [{ label: 'sono possível no dia mais pesado', data: d, backgroundColor: d.map(v => v == null ? GREEN : sevColor(v)) }] },
      options: { indexAxis: 'y', aspectRatio: small() ? 1.2 : 2.4, layout: { padding: { right: 78 } }, plugins: { ...VL('h'), legend: { display: false }, tooltip: { callbacks: { label: c => ` média: ${hm(c.parsed.x)} de sono possível no dia mais pesado` } } },
        scales: { x: { min: Math.min(0, Math.floor(Math.min(...d.filter(v => v != null), 0))), ticks: { stepSize: 2 }, grid: lineGrid(6), title: { display: true, text: T('horas de sono possível no dia mais pesado (linha forte = 6 h)', 'horas de sono no pior dia (linha = 6 h)') } }, y: { grid: { display: false } } } } });
    $('#lg4').innerHTML = '';
    const a = d[0], z = d[3];
    $('#n4').innerHTML = `${n} respostas válidas no total. Média do sono possível no dia mais pesado por faixa de deslocamento diário (ida + volta). ${a != null && z != null ? `Quem se desloca mais de 3 h tem em média ${hm(a - z)} a menos que quem se desloca até 1 h.` : ''}<br>* Faixas com poucas respostas não são exibidas, para preservar a privacidade.`;
  } else {
    const xs = rows.map(r => r.hrs), ys = rows.map(sw), reg = n >= 10 ? regress(xs, ys) : null;
    const ds = [{ label: 'estudante', data: rows.map(r => ({ x: +r.hrs.toFixed(2), y: +sw(r).toFixed(2), s: r.e.semester })), backgroundColor: rows.map(r => ramp(r.e.semester)), pointRadius: 5, pointHoverRadius: 8 }];
    if (reg) { const x0 = Math.min(...xs), x1 = Math.max(...xs); ds.push({ type: 'line', label: 'tendência', data: [{ x: x0, y: reg.intercept + reg.slope * x0 }, { x: x1, y: reg.intercept + reg.slope * x1 }], borderColor: css('--fg'), borderWidth: 2, borderDash: [6, 4], pointRadius: 0 }); }
    mk('#g4', { type: 'scatter', data: { datasets: ds }, options: { aspectRatio: small() ? 1.1 : 2, plugins: { legend: { display: false }, tooltip: { filter: i => i.datasetIndex === 0, callbacks: { label: c => ` ${c.raw.s}º período: ${hm(c.parsed.x)} de deslocamento por dia · ${hm(c.parsed.y)} de sono possível no dia mais pesado` } } },
      scales: { x: { title: { display: true, text: T('deslocamento por dia, ida + volta (h)', 'deslocamento por dia (h)') } }, y: { ticks: { stepSize: 2 }, grid: lineGrid(6), title: { display: true, text: T('sono possível no dia mais pesado (h; linha forte = 6 h)', 'sono no pior dia (h)') } } } } });
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
  mk('#g5', { type: 'bar', data: { labels: by.map(lab), datasets: [
      { label: 'no dia mais pesado', data: dW, backgroundColor: ALERT },
      { label: 'em uma noite média da semana', data: dA, backgroundColor: LIGHT_RED }] },
    options: { indexAxis: 'y', aspectRatio: small() ? 0.9 : 1.5, layout: { padding: { right: 48 } }, plugins: { ...VL('pct'), legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.x}% dormem menos de 6 h` } } },
      scales: { x: { min: 0, max: 100, title: { display: true, text: T('% dos estudantes do período que podem dormir menos de 6 h', '% que podem dormir menos de 6 h') } }, y: { reverse: true, grid: { display: false } } } } });
  $('#n5').innerHTML = `${rows.length} respostas válidas no total. Vermelho forte: sono possível no dia mais pesado abaixo de 6 h. Vermelho claro: sono possível numa noite média da semana abaixo de 6 h, para comparação. Cada barra usa como denominador os estudantes válidos do período.<br>${PRIV}`;
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
const seg = (sel, set, draw) => document.querySelectorAll(sel + ' button').forEach(b => b.onclick = () => { set(b.dataset.m); document.querySelectorAll(sel + ' button').forEach(x => x.classList.toggle('on', x === b)); draw(lastRows); });
seg('#seg1', m => mode1 = m, graph1); seg('#seg4', m => mode4 = m, graph4);
DB.list().then(es => { entries = es; render(); }).catch(e => { $('#kpis').innerHTML = `<div class="card">${e.message}</div>`; });

// Página "O que a falta de sono faz": abre ao clicar no número grande (ou em #efeitos na URL), fecha com o botão ou Esc.
const ef = $('#efeitos');
const openEf = () => { ef.hidden = false; ef.scrollTop = 0; if (document.body) document.body.style.overflow = 'hidden'; try { history.replaceState(null, '', '#efeitos'); } catch {} $('#efClose').focus(); };
const closeEf = () => { ef.hidden = true; if (document.body) document.body.style.overflow = ''; try { history.replaceState(null, '', location.pathname + location.search); } catch {} $('#headline').focus(); };
$('#headline').onclick = openEf;
$('#headline').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEf(); } };
$('#efClose').onclick = closeEf;
document.onkeydown = e => { if (e.key === 'Escape' && !ef.hidden) closeEf(); };
if (typeof location !== 'undefined' && location.hash === '#efeitos') openEf();
