// Acesso ao Supabase via REST (sem SDK).
window.DB = (() => {
  const C = window.CONFIG || {};
  const ok = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
  // Chaves novas (sb_publishable_...) não são JWT: só o cabeçalho apikey; chaves antigas (eyJ...) também aceitam Bearer.
  const H = { apikey: C.SUPABASE_ANON_KEY };
  if (/^eyJ/.test(C.SUPABASE_ANON_KEY || '')) H.Authorization = 'Bearer ' + C.SUPABASE_ANON_KEY;
  const url = p => C.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/entries' + p;
  const COLS = {commuteMin: 'commute_min', classWeekMin: 'class_min_week', classMaxDayMin: 'class_min_max_day', workMin: 'work_min', domesticMin: 'domestic_min', readingMin: 'reading_min', studyMin: 'study_min', selfcareMin: 'selfcare_min'};
  const fromRow = r => { const e = { id: r.id, home: r.home, semester: r.semester, distKm: +r.dist_km };
    for (const [k, c] of Object.entries(COLS)) e[k] = r[c] == null ? null : +r[c];
    return e; };

  // Lê em páginas de 500 (o limite padrão do Supabase é 1000 por requisição).
  async function list() {
    if (!ok) throw new Error('Banco não configurado (docs/config.js).');
    const cols = ['id', 'home', 'semester', 'dist_km', ...Object.values(COLS)].join(',');
    const out = [];
    for (let off = 0; ; off += 500) {
      const r = await fetch(url(`?select=${cols}&order=created_at&limit=500&offset=${off}`), { headers: H });
      if (!r.ok) throw new Error('Falha ao ler trajetos (' + r.status + ')');
      const rows = await r.json(); out.push(...rows.map(fromRow));
      if (rows.length < 500) return out;
    }
  }

  async function add(b) {
    if (!ok) throw new Error('Banco não configurado (docs/config.js).');
    const row = { home: b.home, semester: b.semester, dist_km: b.distKm };
    for (const [k, c] of Object.entries(COLS)) row[c] = b[k];
    const r = await fetch(url(''), { method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row) });
    if (!r.ok) throw new Error('Falha ao enviar (' + r.status + ')');
  }
  return { list, add, ok };
})();
