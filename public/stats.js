// Statistiques de fréquentation calculées à partir de tout l'historique de réservations.

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d) => { const x = startOfDay(d); return addDays(x, -((x.getDay() + 6) % 7)); };
const dayKey = (d) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthKey = (d) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const fmt = (d, o) => new Date(d).toLocaleDateString('fr-FR', o);
const num = (n, digits = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const plural = (n, word) => `${num(n)} ${word}${n > 1 ? 's' : ''}`;
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// Une séance « faite » = réservation passée qui n'a été ni annulée, ni marquée absente,
// ni restée en liste d'attente. Les résas non confirmées sur place (PENDING) comptent.
const isDone = (r, now) => (r.status === 'PENDING' || r.status === 'VALIDATED') && new Date(r.slot.start) < now;

export function computeStats(reservations, { frequency, noPenaltyMinutes, paid } = {}) {
  const now = new Date();
  const done = reservations.filter((r) => isDone(r, now)).sort((a, b) => new Date(a.slot.start) - new Date(b.slot.start));
  if (!done.length) return null;

  // --- semaines
  const perWeek = new Map();
  for (const r of done) {
    const k = dayKey(startOfWeek(r.slot.start));
    perWeek.set(k, (perWeek.get(k) || 0) + 1);
  }
  const firstWeek = startOfWeek(done[0].slot.start);
  const thisWeek = startOfWeek(now);
  const weeks = [];
  for (let w = firstWeek; w <= thisWeek; w = addDays(w, 7)) weeks.push({ start: w, count: perWeek.get(dayKey(w)) || 0 });

  const active = weeks.filter((w) => w.count > 0).length;
  let best = 0; let run = 0; let bestEnd = null;
  for (const w of weeks) {
    run = w.count ? run + 1 : 0;
    if (run > best) { best = run; bestEnd = w.start; }
  }
  // Série en cours : la semaine courante ne casse pas la série tant qu'elle n'est pas finie.
  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].count) streak++;
    else if (i === weeks.length - 1) continue;
    else break;
  }

  // --- mois
  const perMonth = new Map();
  for (const r of done) perMonth.set(monthKey(r.slot.start), (perMonth.get(monthKey(r.slot.start)) || 0) + 1);
  const months = [];
  for (let d = new Date(done[0].slot.start); ; d.setMonth(d.getMonth() + 1)) {
    d.setDate(1);
    months.push({ key: monthKey(d), date: new Date(d), count: perMonth.get(monthKey(d)) || 0 });
    if (monthKey(d) === monthKey(now)) break;
  }

  // --- jours, heures, types, créneau favori
  const byDay = Array(7).fill(0);
  const byHour = new Map();
  const byType = new Map();
  const bySlot = new Map();
  for (const r of done) {
    const d = new Date(r.slot.start);
    const wd = (d.getDay() + 6) % 7;
    byDay[wd]++;
    byHour.set(d.getHours(), (byHour.get(d.getHours()) || 0) + 1);
    const t = (r.slot.slotType?.name || 'Autre').trim();
    const cur = byType.get(t.toUpperCase()) || { name: t, color: r.slot.slotType?.color, count: 0 };
    cur.count++;
    byType.set(t.toUpperCase(), cur);
    const sk = `${wd}|${pad(d.getHours())}:${pad(d.getMinutes())}|${t.toUpperCase()}`;
    bySlot.set(sk, { wd, time: `${pad(d.getHours())}:${pad(d.getMinutes())}`, type: t, count: (bySlot.get(sk)?.count || 0) + 1 });
  }
  const hours = [...byHour.keys()].sort((a, b) => a - b);
  const hourRange = hours.length ? [...Array(hours.at(-1) - hours[0] + 1)].map((_, i) => ({ h: hours[0] + i, count: byHour.get(hours[0] + i) || 0 })) : [];
  const types = [...byType.values()].sort((a, b) => b.count - a.count);
  const favorite = [...bySlot.values()].sort((a, b) => b.count - a.count)[0];

  // --- cette année vs l'an dernier à la même date
  const y = now.getFullYear();
  const sameDayLastYear = new Date(now); sameDayLastYear.setFullYear(y - 1);
  const thisYear = done.filter((r) => new Date(r.slot.start).getFullYear() === y).length;
  const lastYearToDate = done.filter((r) => { const d = new Date(r.slot.start); return d.getFullYear() === y - 1 && d <= sameDayLastYear; }).length;
  const hasLastYear = done.some((r) => new Date(r.slot.start).getFullYear() === y - 1);

  // --- annulations & listes d'attente
  const cancelled = reservations.filter((r) => r.status === 'CANCELLED');
  const leads = cancelled.map((r) => (new Date(r.slot.start) - new Date(r.updatedAt)) / 3600e3).filter((h) => h > -24);
  const late = noPenaltyMinutes ? leads.filter((h) => h < noPenaltyMinutes / 60).length : null;
  const medianLead = leads.length ? [...leads].sort((a, b) => a - b)[Math.floor(leads.length / 2)] : null;
  const missedWaitlist = reservations.filter((r) => r.status === 'WAITING' && new Date(r.slot.start) < now).length;
  const absent = reservations.filter((r) => r.status === 'ABSENT').length;
  const confirmed = done.filter((r) => r.status === 'VALIDATED').length;

  // --- volume, records, anticipation, coût
  const minutesTotal = done.reduce((a, r) => a + (new Date(r.slot.end) - new Date(r.slot.start)) / 60000, 0);
  const bestMonth = months.reduce((a, m) => (m.count > a.count ? m : a), months[0]);
  const bestWeek = weeks.reduce((a, w) => (w.count > a.count ? w : a), weeks[0]);
  const booked = done.filter((r) => r.createdAt && new Date(r.createdAt) <= new Date(r.slot.start));
  const bookLeads = booked.map((r) => (new Date(r.slot.start) - new Date(r.createdAt)) / 3600e3).sort((a, b) => a - b);
  const medianBook = bookLeads.length ? bookLeads[Math.floor(bookLeads.length / 2)] : null;
  const sameDayBook = booked.length ? booked.filter((r) => dayKey(r.createdAt) === dayKey(r.slot.start)).length / booked.length : null;

  return {
    minutesTotal, bestMonth, bestWeek, medianBook, sameDayBook,
    paid, costPerSession: paid ? paid / done.length : null,
    total: done.length, since: done[0].slot.start, weeks, active, best, bestEnd, streak, frequency,
    atQuota: frequency ? weeks.filter((w) => w.count >= frequency).length : null,
    avgActive: done.length / Math.max(1, active),
    avgAll: done.length / Math.max(1, weeks.length),
    months, byDay, hourRange, types, favorite,
    thisYear, lastYearToDate, hasLastYear,
    cancelled: cancelled.length, late, medianLead, missedWaitlist, absent, confirmed,
  };
}

// ---------------------------------------------------------------- rendu

const tile = (value, label, sub = '') => `<div class="stat"><b>${value}</b><small>${label}</small>${sub ? `<small class="sub">${sub}</small>` : ''}</div>`;

function weeksHeatmap(s) {
  const per = new Map(s.weeks.map((w) => [dayKey(w.start), w.count]));
  const first = s.weeks[0].start;
  const last = s.weeks.at(-1).start;
  const level = (n) => (n <= 0 ? 0 : Math.min(3, n));
  const rows = [];
  for (let y = first.getFullYear(); y <= last.getFullYear(); y++) {
    let w = startOfWeek(new Date(y, 0, 1));
    if (w.getFullYear() < y) w = addDays(w, 7); // première semaine dont le lundi tombe dans l'année
    const cells = [];
    for (; w.getFullYear() === y; w = addDays(w, 7)) {
      const out = w < first || w > last;
      const n = per.get(dayKey(w)) || 0;
      const tip = `Semaine du ${fmt(w, { day: 'numeric', month: 'short', year: 'numeric' })} : ${out ? '—' : plural(n, 'séance')}`;
      cells.push(`<i class="hm l${out ? 'x' : level(n)}" ${out ? '' : `data-tip="${esc(tip)}"`}></i>`);
    }
    rows.push(`<div class="hm-row"><span class="hm-y">${y}</span><div class="hm-cells">${cells.join('')}</div></div>`);
  }
  const top = s.frequency && s.frequency !== 3 ? `${s.frequency}+` : '3+';
  return `<div class="hm-wrap">${rows.join('')}</div>
    <div class="hm-legend"><span>0</span><i class="hm l0"></i><i class="hm l1"></i><i class="hm l2"></i><i class="hm l3"></i><span>${top} séances / semaine</span></div>`;
}

function columns(items, { label, tip, height = 120, mark, partial }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return `<div class="cols" style="--h:${height}px">${items.map((i) => `
    <div class="col" data-tip="${esc(tip(i))}">
      ${mark?.(i) ? `<span class="col-val">${num(i.count)}</span>` : ''}
      <span class="col-bar ${i.count ? '' : 'zero'} ${partial?.(i) ? 'partial' : ''}" style="height:${Math.max(i.count ? 3 : 0, (i.count / max) * height)}px"></span>
      <span class="col-lbl">${esc(label(i))}</span>
    </div>`).join('')}</div>`;
}

function hbars(items, total) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return `<div class="hbars">${items.map((i) => `
    <div class="hbar" data-tip="${esc(`${i.name} : ${plural(i.count, 'séance')} (${num((i.count / total) * 100)} %)`)}">
      <span class="hbar-lbl"><i style="background:${esc(i.color || 'var(--muted)')}"></i>${esc(i.name)}</span>
      <span class="hbar-track"><span class="hbar-fill" style="width:${(i.count / max) * 100}%"></span></span>
      <span class="hbar-val">${num(i.count)}</span>
    </div>`).join('')}</div>`;
}

const hoursAgo = (h) => (h >= 48 ? `${num(h / 24)} j` : h >= 1 ? `${num(h)} h` : `${num(h * 60)} min`);
const euros = (v) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: v < 100 ? 2 : 0 });

export function viewStats(s) {
  if (!s) return '<div class="empty"><b>Pas encore de séance</b>Les statistiques apparaîtront après ton premier cours.</div>';
  const pct = Math.round((s.active / s.weeks.length) * 100);
  const yearDelta = s.hasLastYear ? s.thisYear - s.lastYearToDate : null;
  const monthsShown = s.months.slice(-24);
  const maxMonth = Math.max(...monthsShown.map((m) => m.count));
  const typesTop = s.types.length > 8
    ? [...s.types.slice(0, 7), { name: 'Autres', count: s.types.slice(7).reduce((a, t) => a + t.count, 0) }]
    : s.types;

  return `
    <section class="card stats-hero">
      <div><div class="hero-num">${num(s.total)}</div><div class="muted">séances depuis ${fmt(s.since, { month: 'long', year: 'numeric' })}, tous abonnements confondus</div></div>
      <div class="hero-side">
        <div><b>${num(s.thisYear)}</b> en ${new Date().getFullYear()}</div>
        ${yearDelta != null ? `<div class="muted">${yearDelta >= 0 ? '▲' : '▼'} ${num(Math.abs(yearDelta))} vs ${new Date().getFullYear() - 1} à la même date</div>` : ''}
      </div>
    </section>

    <div class="stats">
      ${tile(`${num(s.active)}<span class="of">/${num(s.weeks.length)}</span>`, 'semaines actives', `${pct} % des semaines`)}
      ${tile(`${num(s.streak)}<span class="of"> sem.</span>`, 'série en cours', s.streak ? 'sans semaine blanche' : 'reprends cette semaine !')}
      ${tile(`${num(s.best)}<span class="of"> sem.</span>`, 'meilleure série', s.bestEnd ? `jusqu'au ${fmt(addDays(s.bestEnd, 6), { day: 'numeric', month: 'short', year: 'numeric' })}` : '')}
      ${tile(num(s.avgActive, 1), 'séances / semaine active', `${num(s.avgAll, 1)} en moyenne sur toutes les semaines`)}
      ${s.atQuota != null ? tile(num(s.atQuota), `semaines à ${s.frequency}/${s.frequency}`, 'quota de l\'abonnement atteint') : ''}
    </div>

    <div class="section-title">Bilan</div>
    <div class="stats">
      ${tile(`${num(s.minutesTotal / 60)}<span class="of"> h</span>`, 'd\'entraînement', `soit ${num(s.minutesTotal / 1440, 1)} jours pleins`)}
      ${tile(num(s.bestMonth.count), 'meilleur mois', fmt(s.bestMonth.date, { month: 'long', year: 'numeric' }))}
      ${tile(num(s.bestWeek.count), 'meilleure semaine', `du ${fmt(s.bestWeek.start, { day: 'numeric', month: 'short', year: 'numeric' })}`)}
      ${s.costPerSession ? tile(euros(s.costPerSession), 'par séance', `${euros(s.paid)} payés en abonnements et cartes`) : ''}
    </div>

    <div class="section-title">Semaines actives</div>
    <section class="card chart">${weeksHeatmap(s)}</section>

    <div class="section-title">Séances par mois</div>
    <section class="card chart">
      ${columns(monthsShown, {
        label: (m) => (m.date.getMonth() === 0 || m === monthsShown[0] ? fmt(m.date, { month: 'short', year: '2-digit' }) : fmt(m.date, { month: 'narrow' })),
        tip: (m) => `${fmt(m.date, { month: 'long', year: 'numeric' })} : ${plural(m.count, 'séance')}${m === monthsShown.at(-1) ? ' (en cours)' : ''}`,
        mark: (m) => m.count === maxMonth || m === monthsShown.at(-1),
        partial: (m) => m === monthsShown.at(-1),
      })}
      <details class="table-view"><summary>Voir les données</summary>
        <table><thead><tr><th>Mois</th><th>Séances</th></tr></thead><tbody>
          ${[...s.months].reverse().map((m) => `<tr><td>${fmt(m.date, { month: 'long', year: 'numeric' })}</td><td>${m.count}</td></tr>`).join('')}
        </tbody></table>
      </details>
    </section>

    <div class="two">
      <div>
        <div class="section-title">Jours</div>
        <section class="card chart">${columns(s.byDay.map((count, i) => ({ i, count })), {
          label: (d) => DAYS[d.i], tip: (d) => `${DAYS_LONG[d.i]} : ${plural(d.count, 'séance')}`, height: 90, mark: () => true,
        })}</section>
      </div>
      <div>
        <div class="section-title">Heures</div>
        <section class="card chart">${columns(s.hourRange, {
          label: (h) => (h.h % 3 === 0 || s.hourRange.length < 9 ? `${h.h}h` : ''), tip: (h) => `${h.h}h–${h.h + 1}h : ${plural(h.count, 'séance')}`, height: 90,
        })}</section>
      </div>
    </div>

    <div class="section-title">Types de cours</div>
    <section class="card chart">${hbars(typesTop, s.total)}</section>

    <div class="section-title">Habitudes</div>
    <div class="stats">
      ${s.favorite ? tile(`${DAYS[s.favorite.wd]} ${s.favorite.time}`, 'créneau favori', `${esc(s.favorite.type)} · ${plural(s.favorite.count, 'fois')}`) : ''}
      ${s.medianBook != null ? tile(hoursAgo(s.medianBook), 'd\'avance pour réserver', `en général · ${num(s.sameDayBook * 100)} % le jour même`) : ''}
      ${tile(num(s.cancelled), 'annulations', s.medianLead != null ? `en général ${s.medianLead >= 48 ? `${num(s.medianLead / 24)} j` : `${num(s.medianLead)} h`} avant` : '')}
      ${s.late != null ? tile(num(s.late), 'annulations tardives', 'dans le délai de pénalité') : ''}
      ${tile(num(s.missedWaitlist), 'listes d\'attente ratées', 'jamais passé en inscrit')}
      ${tile(`${num(s.confirmed)}<span class="of">/${num(s.total)}</span>`, 'présences confirmées', s.absent ? `${plural(s.absent, 'absence')} notée${s.absent > 1 ? 's' : ''}` : 'sur place')}
    </div>
    <p class="muted foot">Une séance compte dès qu'elle est passée sans être annulée, même si la présence n'a pas été confirmée sur place.</p>`;
}
