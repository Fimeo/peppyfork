// Performances : records par mouvement, scores sur les WOD, formulaire d'ajout et calcul des charges.

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const num = (n, digits = 1) => n.toLocaleString('fr-FR', { maximumFractionDigits: digits });
const fmtDate = (d, o = { day: 'numeric', month: 'short', year: 'numeric' }) => new Date(d).toLocaleDateString('fr-FR', o);
export const norm = (s) => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export const LEVELS = { SCALE: 'Scale', BEGIN: 'Débutant', INTER: 'Inter', RX: 'RX' };
const TYPE_LABEL = { WEIGHT: 'Charge', REPETITION: 'Reps', TIME: 'Temps', ROUNDS: 'Tours', DISTANCE: 'Distance', CALORIE: 'Calories', WATTS: 'Watts', UNIT: 'Valeur' };
export const PRESETS = [50, 60, 65, 70, 75, 80, 85, 90, 95];
const REPS = [1, 2, 3, 5, 10];

// ---------------------------------------------------------------- valeurs
export function fmtPerf(v, type) {
  if (v == null) return '—';
  switch (type) {
    case 'WEIGHT': return `${num(v)} kg`;
    case 'TIME': {
      const t = Math.round(v);
      const h = Math.floor(t / 3600);
      return h ? `${h}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}` : `${Math.floor(t / 60)}:${pad(t % 60)}`;
    }
    case 'REPETITION': return `${num(v, 0)} reps`;
    case 'ROUNDS': return `${num(v)} tours`;
    case 'DISTANCE': return `${num(v, 0)} m`;
    case 'CALORIE': return `${num(v, 0)} cal`;
    case 'WATTS': return `${num(v, 0)} W`;
    default: return num(v);
  }
}

// Plus petit = meilleur pour un temps (ou un exercice classé ASC), plus grand sinon.
export const lowerIsBetter = (type, order) => (order ? order === 'ASC' : type === 'TIME');
const better = (a, b, low) => (low ? a < b : a > b);

// 1RM estimé (formule d'Epley) à partir d'une série de `reps` répétitions.
const epley = (w, reps) => (reps > 1 ? w * (1 + reps / 30) : w);
export const roundKg = (kg) => Math.round(kg * 2) / 2;

// Résumé d'un mouvement : meilleure valeur, meilleures par nombre de reps, progression.
export function summarize(ex, perfs) {
  const sorted = [...perfs].sort((a, b) => new Date(a.date) - new Date(b.date));
  const last = sorted.at(-1);
  if (ex.performanceType === 'WEIGHT') {
    const byRange = new Map();
    for (const p of sorted) {
      const r = p.range || 1;
      if (!byRange.has(r) || p.value > byRange.get(r).value) byRange.set(r, p);
    }
    const oneRM = byRange.get(1);
    const est = Math.max(...sorted.filter((p) => (p.range || 1) <= 10).map((p) => epley(p.value, p.range || 1)), 0);
    const points = sorted.map((p) => ({ date: p.date, value: epley(p.value, p.range || 1) }));
    return {
      main: oneRM ? oneRM.value : null, mainLabel: oneRM ? '1RM' : null,
      est: est || null, estimated: !oneRM,
      ranges: [...byRange.entries()].sort(([a], [b]) => a - b).map(([range, p]) => ({ range, ...p })),
      points, last, first: sorted[0], count: sorted.length,
    };
  }
  const low = lowerIsBetter(ex.performanceType, ex.performanceOrder);
  const best = sorted.reduce((a, p) => (!a || better(p.value, a.value, low) ? p : a), null);
  return { main: best?.value, mainLabel: 'record', points: sorted.map((p) => ({ date: p.date, value: p.value })), low, last, first: sorted[0], count: sorted.length };
}

// Petite courbe de progression (SVG), en ordre chronologique.
function sparkline(points, { low = false, w = 120, h = 34 } = {}) {
  if (points.length < 2) return '';
  const xs = points.map((p) => new Date(p.date).getTime());
  const ys = points.map((p) => p.value);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const X = (x) => (x1 === x0 ? w / 2 : 3 + ((x - x0) / (x1 - x0)) * (w - 6));
  const Y = (y) => { const t = y1 === y0 ? 0.5 : (y - y0) / (y1 - y0); return 3 + (low ? t : 1 - t) * (h - 6); };
  const pts = points.map((p) => `${X(new Date(p.date).getTime()).toFixed(1)},${Y(p.value).toFixed(1)}`);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <polyline points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${pts.at(-1).split(',')[0]}" cy="${pts.at(-1).split(',')[1]}" r="3" fill="currentColor"/>
  </svg>`;
}

function progress(ex, s) {
  if (s.count < 2) return `le ${fmtDate(s.last.date)}`;
  const from = s.points[0].value;
  const to = ex.performanceType === 'WEIGHT' ? s.est : s.main;
  const diff = to - from;
  const good = s.low ? diff < 0 : diff > 0;
  if (!diff) return `${s.count} perfs depuis ${fmtDate(s.first.date, { month: 'short', year: 'numeric' })}`;
  // Les 1RM estimés tombent sur des décimales : on arrondit au demi-kilo.
  const val = fmtPerf(ex.performanceType === 'WEIGHT' ? roundKg(Math.abs(diff)) : Math.abs(diff), ex.performanceType);
  return `<span class="${good ? 'up' : ''}">${diff > 0 ? '+' : '−'}${val}</span> depuis ${fmtDate(s.first.date, { month: 'short', year: 'numeric' })}`;
}

// ---------------------------------------------------------------- page
export function viewPerfs({ exercises, perfs, scan, rankings }) {
  const head = `<div class="perf-head"><h2>Mes perfs</h2><button class="btn primary sm" data-action="add-perf">+ Ajouter</button></div>`;
  if (!perfs) {
    return `${head}<p class="muted perf-scan">Recherche de tes records parmi tous les mouvements…</p>
      <div class="perf-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;
  }
  const done = exercises.filter((e) => perfs.get(e.id)?.length)
    .map((ex) => ({ ex, s: summarize(ex, perfs.get(ex.id)) }))
    .sort((a, b) => new Date(b.s.last.date) - new Date(a.s.last.date));

  const cards = done.map(({ ex, s }) => {
    const value = s.main != null ? fmtPerf(s.main, ex.performanceType) : `≈ ${fmtPerf(roundKg(s.est), 'WEIGHT')}`;
    return `<article class="card perf" data-action="open-ex" data-id="${ex.id}">
      <div class="perf-body">
        <b class="perf-name">${esc(ex.name)}</b>
        <div class="perf-val">${value}<small>${s.main != null ? s.mainLabel : '1RM estimé'}</small></div>
        ${s.ranges?.length > 1 ? `<div class="perf-ranges">${s.ranges.filter((r) => r.range > 1).map((r) => `<span>${r.range}RM <b>${num(r.value)}</b></span>`).join('')}</div>` : ''}
        <div class="perf-meta">${progress(ex, s)}</div>
      </div>
      ${sparkline(s.points, { low: s.low, w: 96, h: 40 })}
    </article>`;
  }).join('');

  const wods = viewWods(rankings);
  const scanning = scan ? '<p class="muted perf-scan">Vérification des autres mouvements…</p>' : '';
  return `${head}
    <div class="section-title">Records</div>
    ${cards ? `<div class="perf-grid">${cards}</div>` : '<div class="empty"><b>Aucun record</b>Ajoute ta première perf avec le bouton ci-dessus.</div>'}
    ${scanning}
    ${wods}`;
}

// Scores sur les WOD, regroupés par WOD.
export function groupRankings(rankings) {
  const map = new Map();
  for (const r of rankings || []) {
    if (!r.workout || r.performance == null) continue;
    const g = map.get(r.workout.id) || { workout: r.workout, items: [] };
    g.items.push(r);
    map.set(r.workout.id, g);
  }
  for (const g of map.values()) {
    g.items.sort((a, b) => new Date(b.date) - new Date(a.date));
    const low = lowerIsBetter(g.workout.performanceType);
    g.best = g.items.reduce((a, r) => (!a || better(r.performance, a.performance, low) ? r : a), null);
    g.low = low;
  }
  return [...map.values()].sort((a, b) => new Date(b.items[0].date) - new Date(a.items[0].date));
}

function viewWods(rankings) {
  if (rankings === undefined) return '<div class="section-title">WOD</div><div class="skeleton" style="height:80px"></div>';
  const groups = groupRankings(rankings);
  if (!groups.length) return '';
  return `<div class="section-title">WOD</div>
    <section class="card wod-list">${groups.map((g) => {
      const last = g.items[0];
      const t = g.workout.performanceType;
      return `<div class="wod-row" data-action="open-wod" data-id="${g.workout.id}">
        <b class="wod-name">${esc(g.workout.name.trim())}</b>
        <span class="wod-score">${fmtPerf(last.performance, t)}<small>${LEVELS[last.difficulty] || ''} · ${fmtDate(last.date)}</small></span>
        ${g.items.length > 1 ? `<span class="wod-best">record ${fmtPerf(g.best.performance, t)}<small>${g.items.length} fois</small></span>` : '<span class="wod-best"></span>'}
      </div>`;
    }).join('')}</section>`;
}

// ---------------------------------------------------------------- fiche d'un mouvement
export function viewExercise(ex, perfs, favs) {
  const s = summarize(ex, perfs);
  const t = ex.performanceType;
  const history = [...perfs].sort((a, b) => new Date(b.date) - new Date(a.date));
  return `<div class="sheet-body">
    <div class="row" style="justify-content:space-between"><h3>${esc(ex.name)}</h3><span class="tag neutral">${TYPE_LABEL[t] || t}</span></div>
    <div class="ex-hero">
      <div><b>${s.main != null ? fmtPerf(s.main, t) : `≈ ${fmtPerf(roundKg(s.est), 'WEIGHT')}`}</b><small>${s.main != null ? s.mainLabel : '1RM estimé'}</small></div>
      ${sparkline(s.points, { low: s.low, w: 160, h: 46 })}
    </div>
    ${t === 'WEIGHT' ? viewCalc(roundKg(s.main ?? s.est), favs, s.main == null) : ''}
    <div class="section-title">Historique · ${history.length}</div>
    <ul class="invoices">${history.map((p) => `<li><span class="grow">${fmtDate(p.date, { day: 'numeric', month: 'long', year: 'numeric' })}</span><b>${fmtPerf(p.value, t)}</b>${p.range && t === 'WEIGHT' ? `<span class="tag neutral">${p.range} rep${p.range > 1 ? 's' : ''}</span>` : ''}</li>`).join('')}</ul>
    <div class="sheet-actions">
      <button class="btn block primary" data-action="add-perf" data-kind="ex" data-id="${ex.id}">+ Nouvelle perf</button>
      <button class="btn block ghost" data-action="close">Fermer</button>
    </div>
  </div>`;
}

// Description du WOD pour un niveau (RX, Inter…), et conseils repliables. `info` arrive après coup.
function wodDescription(g, info, level) {
  if (!info) return '<p class="muted wod-desc">Chargement de la description…</p>';
  const sessions = [...(info.session || [])].sort((a, b) => Object.keys(LEVELS).indexOf(b.difficulty) - Object.keys(LEVELS).indexOf(a.difficulty));
  if (!sessions.length && !info.advice) return '';
  const cur = sessions.find((x) => x.difficulty === level) || sessions[0];
  return `<div class="wod-desc">
    ${sessions.length > 1 ? `<div class="chips">${sessions.map((x) => `<button class="chip-btn ${x === cur ? 'on' : ''}" data-action="wod-level" data-id="${g.workout.id}" data-level="${x.difficulty}">${LEVELS[x.difficulty] || x.difficulty}</button>`).join('')}</div>` : ''}
    ${cur ? `<div class="rich">${esc(cur.description.trim())}</div>` : ''}
    ${info.advice ? `<details class="table-view"><summary>Conseils</summary><div class="rich" style="margin-top:8px">${esc(info.advice.trim())}</div></details>` : ''}
  </div>`;
}

export function viewWod(g, info, level) {
  const t = g.workout.performanceType;
  return `<div class="sheet-body" data-wod="${g.workout.id}">
    <div class="row" style="justify-content:space-between"><h3>${esc(g.workout.name.trim())}</h3><span class="tag neutral">${TYPE_LABEL[t] || t}</span></div>
    <div class="ex-hero"><div><b>${fmtPerf(g.best.performance, t)}</b><small>record · ${LEVELS[g.best.difficulty] || ''}</small></div></div>
    ${wodDescription(g, info, level)}
    <div class="section-title">Historique · ${g.items.length}</div>
    <ul class="invoices">${g.items.map((r) => `<li><span class="grow">${fmtDate(r.date, { day: 'numeric', month: 'long', year: 'numeric' })}</span><b>${fmtPerf(r.performance, t)}</b><span class="tag neutral">${LEVELS[r.difficulty] || r.difficulty || ''}</span></li>`).join('')}</ul>
    <div class="sheet-actions">
      <button class="btn block primary" data-action="add-perf" data-kind="wod" data-id="${g.workout.id}">+ Nouveau score</button>
      <button class="btn block ghost" data-action="close">Fermer</button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- calcul des charges
export function viewCalc(base, favs, estimated = false) {
  return `<div class="calc">
    <div class="calc-head">
      <span class="section-title" style="margin:0">Calcul des charges</span>
      <label class="calc-base">${estimated ? '1RM estimé' : '1RM'} <input id="calc-base" type="number" inputmode="decimal" step="0.5" min="1" value="${base}"> kg</label>
    </div>
    <div id="calc-out">${calcGrid(base, favs)}</div>
    <div class="calc-custom">
      <input id="calc-pct" type="number" inputmode="numeric" min="1" max="120" placeholder="%" aria-label="Pourcentage personnalisé">
      <span>% =</span><b id="calc-custom-val">—</b>
      <button class="btn ghost sm" data-action="fav-custom">★ Favori</button>
    </div>
  </div>`;
}

// Favoris en premier, puis les préréglages. ★ pour ajouter ou retirer des favoris.
export function calcGrid(base, favs) {
  const all = [...new Set([...favs].sort((a, b) => a - b).concat(PRESETS))];
  return `<div class="calc-grid">${all.map((p) => `<button class="pct ${favs.has(p) ? 'fav' : ''}" data-action="fav" data-pct="${p}" title="${favs.has(p) ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
      <small>${favs.has(p) ? '★' : '☆'} ${p} %</small><b>${base > 0 ? num(roundKg((base * p) / 100)) : '—'}</b>
    </button>`).join('')}</div>`;
}

// ---------------------------------------------------------------- formulaire d'ajout
export function viewAdd(sel) {
  return `<form class="sheet-body" id="perf-form" autocomplete="off">
    <h3>Ajouter une perf</h3>
    ${sel ? viewSelected(sel) : `<input id="perf-search" class="perf-search" type="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" placeholder="Mouvement ou WOD : squat, Helen, 5 km…" autofocus>
      <div id="perf-results" class="perf-results"></div>`}
    <div class="sheet-actions">
      ${sel ? '<button class="btn block primary" type="submit">Enregistrer</button>' : ''}
      <button class="btn block ghost" type="button" data-action="close">Annuler</button>
    </div>
  </form>`;
}

export function viewResults(items, query) {
  if (!query) return '<p class="muted perf-hint">Tape quelques lettres pour chercher dans les mouvements et les WOD.</p>';
  if (!items.length) return '<p class="muted perf-hint">Aucun résultat.</p>';
  return items.map((i) => `<button type="button" class="perf-result" data-action="pick" data-kind="${i.kind}" data-id="${i.id}">
      <span>${esc(i.name.trim())}${i.mine ? ' <em>déjà fait</em>' : ''}</span><small>${i.kind === 'wod' ? 'WOD · ' : ''}${TYPE_LABEL[i.type] || i.type}</small>
    </button>`).join('');
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

function viewSelected(sel) {
  const t = sel.type;
  const value = t === 'TIME'
    ? `<div class="time-in"><input name="min" type="number" inputmode="numeric" min="0" placeholder="min" required autofocus><span>:</span><input name="sec" type="number" inputmode="numeric" min="0" max="59" placeholder="sec"></div>`
    : `<div class="value-in"><input name="value" type="number" inputmode="decimal" step="any" min="0" required autofocus placeholder="0"><span>${{ WEIGHT: 'kg', REPETITION: 'reps', ROUNDS: 'tours', DISTANCE: 'm', CALORIE: 'cal', WATTS: 'W' }[t] || ''}</span></div>`;
  return `<div class="picked"><span><b>${esc(sel.name.trim())}</b><small>${sel.kind === 'wod' ? 'WOD · ' : ''}${TYPE_LABEL[t] || t}</small></span><button type="button" class="btn ghost sm" data-action="unpick">Changer</button></div>
    <label class="field">${sel.kind === 'wod' ? 'Score' : TYPE_LABEL[t]}${value}</label>
    ${sel.kind === 'ex' && t === 'WEIGHT' ? `<div class="field">Répétitions
      <div class="chips">${REPS.map((r) => `<label class="chip"><input type="radio" name="range" value="${r}" ${r === 1 ? 'checked' : ''}><span>${r}</span></label>`).join('')}
      <input class="chip-in" name="rangeOther" type="number" inputmode="numeric" min="1" placeholder="autre"></div></div>` : ''}
    ${sel.kind === 'wod' ? `<div class="field">Niveau
      <div class="chips">${Object.entries(LEVELS).map(([k, l]) => `<label class="chip"><input type="radio" name="level" value="${k}" ${k === 'RX' ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>` : ''}
    <label class="field">Date<input name="date" type="date" value="${today()}" max="${today()}" required></label>`;
}
