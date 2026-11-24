const { UFF } = Model;
const $ = s => document.querySelector(s);
const map = L.map('map', { preferCanvas: true, zoomControl: false }).setView([UFF.lat, UFF.lng], 11);
// Tiles sem chave de API. O OSM é escurecido por filtro CSS (classe .dark-tiles).
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  { attribution: '© OpenStreetMap contributors', maxZoom: 19, className: 'dark-tiles', opacity: 0.7 });
const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  { attribution: 'Tiles © Esri', maxZoom: 16, opacity: 0.7 });
osm.addTo(map);
L.control.zoom({ position: 'topright' }).addTo(map);
// se o OSM falhar repetidamente, troca sozinho para Esri
let tileErrors = 0;
osm.on('tileerror', () => { if (++tileErrors === 6 && map.hasLayer(osm)) { map.removeLayer(osm); esri.addTo(map); } });
const lines = L.layerGroup().addTo(map);
// Tons de vermelho: cada trajeto recebe um matiz/luminosidade próprio (estável, derivado do id).
// Sobreposições clareiam via mix-blend-mode.
const redShade = seed => {
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = (354 + (h % 14)) % 360, light = 40 + ((h >> 5) % 16), sat = 100;
  return `hsl(${hue},${sat}%,${light}%)`;
};
// Espessura da linha cresce com o tempo de deslocamento diário (ida + volta): 0,8 px (rápido) até 2,4 px (4 h ou mais).
const lineW = min => min == null ? 1.2 : +(0.8 + 1.6 * Math.min(min, 240) / 240).toFixed(2);
const eauDot = L.circleMarker([UFF.lat, UFF.lng], { radius: 9, stroke: false, fillColor: '#e60023', fillOpacity: 1 })
  .bindTooltip(UFF.name, { permanent: false }).addTo(map);
// O raio do ponto da escola acompanha o zoom: 2 px com o mapa muito afastado, 9 px a partir do zoom 12 (não cobre mais a cidade).
const eauR = () => Math.max(2, Math.min(9, (map.getZoom() - 7) * 1.5));
eauDot.setRadius(eauR()); map.on('zoomend', () => eauDot.setRadius(eauR()));

$('#toggle').onclick = () => $('#panel').classList.toggle('collapsed');
const msg = t => $('#msg').textContent = t || '';
const f = $('#form');
// Mostra, abaixo de cada campo em minutos, o equivalente em horas.
const hh = m => { const h = Math.floor(m / 60), r = Math.round(m % 60); return h ? `${h} h${r ? ' ' + r + ' min' : ''}` : `${r} min`; };
f.querySelectorAll('input[data-min]').forEach(i => { const s = document.createElement('small'); s.style.cssText = 'color:var(--acc);display:block;min-height:20px';
  i.after(s); i.oninput = () => s.textContent = i.value !== '' && +i.value >= 0 ? '= ' + hh(+i.value) : ''; });
for (let i = 1; i <= 10; i++) f.semester.add(new Option(i + 'º período', i));

DB.list().then(es => {
  $('#n').textContent = es.length;
  for (const e of es)
    L.polyline([e.home, [UFF.lat, UFF.lng]], { color: redShade(e.id), weight: lineW(e.commuteMin), opacity: 0.85, interactive: false }).addTo(lines);
}).catch(e => msg(e.message));

let home = null, marker = null;
// Um trajeto por dispositivo: o envio fica guardado no navegador (página "Meu trajeto") e trava novos envios.
const KEY = 'eau-meu-trajeto';
let mine = null;
try { mine = JSON.parse(localStorage.getItem(KEY)); } catch {}
function lock() {
  mine = true;
  for (const q of ['.step', '.row', '#q', '#results', '#form']) document.querySelectorAll('#panel ' + q).forEach(x => x.style.display = 'none');
  $('#panel h2').textContent = 'Trajeto registrado ✓'; $('#done').hidden = false;
  document.querySelector('#panel > p:not(#done)').style.display = 'none';
}

function refresh() {
  $('#s1').innerHTML = home ? '1. Moradia marcada ✓' : '1. Clique no mapa: <b>moradia</b>';
  f.hidden = !home || !!mine;
}
// Valida o clique: o ponto precisa estar perto de uma via (rejeita mar, baías e oceano) e é ajustado à via mais próxima.
const MAX_FROM_ROAD_M = 100;
async function snap(ll) {
  const r = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${ll[1]},${ll[0]}?number=1`);
  const j = await r.json(), w = j.waypoints && j.waypoints[0];
  if (j.code !== 'Ok' || !w) throw new Error('não foi possível validar o ponto');
  return { dist: /^Ponte Rio-Niter/i.test(w.name || '') ? Math.max(w.distance, 1e4 * (w.distance > 40)) : w.distance, ll: [w.location[1], w.location[0]] };
}
let checking = false, preview = null;
const clear = () => { home = null; marker?.remove(); preview?.remove(); marker = preview = null; };
async function setPoint(raw) {
  if (checking || home || mine) return;
  checking = true; msg('Validando ponto…');
  try {
    const { dist, ll } = await snap(raw);
    if (dist > MAX_FROM_ROAD_M) { msg('Esse ponto está no mar, em baía ou longe de qualquer rua. Marque em terra firme.'); return; }
    const km = Model.straightKm(ll, [UFF.lat, UFF.lng]);
    if (km > Model.LIMITS.maxKm) { msg(`Esse ponto fica a ${km.toFixed(0)} km da EAU. O limite é ${Model.LIMITS.maxKm} km: além disso não é possível ir e voltar no mesmo dia.`); return; }
    msg();
    home = ll;
    marker = L.circleMarker(ll, { radius: 7, color: '#000', weight: 1, fillColor: '#5fd4e6', fillOpacity: 1 }).addTo(map);
    preview = L.polyline([ll, [UFF.lat, UFF.lng]], { color: '#ffc857', weight: 3, dashArray: '6 6', interactive: false }).addTo(map);
    refresh();
  } catch (e) { msg('Erro: ' + e.message); }
  finally { checking = false; }
}
map.on('click', e => setPoint([e.latlng.lat, e.latlng.lng]));
$('#reset').onclick = () => { clear(); msg(); refresh(); };
refresh();

// Busca de endereço (Nominatim, restrita ao RJ)
let t;
$('#q').oninput = ev => {
  clearTimeout(t); const q = ev.target.value.trim(); const box = $('#results');
  if (q.length < 3) { box.innerHTML = ''; return; }
  t = setTimeout(async () => {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=br&viewbox=-43.9,-22.5,-42.7,-23.2&bounded=1&q=' + encodeURIComponent(q));
    const js = await r.json(); box.innerHTML = '';
    js.forEach(x => { const b = document.createElement('button'); b.type = 'button';
      b.style.cssText = 'display:block;width:100%;text-align:left;margin-top:4px;font-size:12px';
      b.textContent = x.display_name; b.onclick = () => { map.setView([x.lat, x.lon], 15); box.innerHTML = ''; $('#q').value = ''; };
      box.appendChild(b); });
  }, 600);
};

const round = p => p.map(v => +v.toFixed(4));

f.onsubmit = async ev => {
  ev.preventDefault();
  const num = n => +f[n].value;
  const H = round(home), U = [UFF.lat, UFF.lng];
  const body = { home: H, semester: num('semester'), distKm: +Math.max(0.01, Model.straightKm(H, U)).toFixed(2) };
  // só o deslocamento é digitado em minutos; os demais campos são digitados em horas e guardados em minutos
  for (const k of Model.FIELDS) body[k] = k === 'commuteMin' ? num(k) : Math.round(num(k) * 60);
  const bad = Model.validate(body);
  if (bad) { msg('Dados recusados: ' + bad + ' Corrija e envie de novo.'); return; }
  $('#send').disabled = true; msg('Enviando…');
  try {
    await DB.add(body);
    try { localStorage.setItem(KEY, JSON.stringify({ body, at: Date.now() })); } catch {}
    L.polyline([H, U], { color: redShade(Math.random()), weight: lineW(body.commuteMin), opacity: 0.85, interactive: false }).addTo(lines);
    $('#n').textContent = +$('#n').textContent + 1;
    const A = Object.assign({}, Model.DEFAULTS); try { Object.assign(A, JSON.parse(localStorage.getItem('eau-assump-v4') || '{}')); } catch {}
    const w = Model.week(body, A), hm = Model.hm;
    msg(`Enviado! ${body.distKm.toFixed(1)} km em linha reta. Numa noite média sobram ~${hm(w.sleepAvail)} de sono; no dia mais pesado, ~${hm(w.sleepWorst)}. Veja a aba Dados.`);
    f.reset(); f.querySelectorAll('small').forEach(x => x.textContent = ''); clear(); refresh(); lock();
  } catch (e) { msg('Erro: ' + e.message); }
  $('#send').disabled = false;
};
if (mine) lock();
