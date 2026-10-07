// Peppy+ — interface alternative pour réserver ses cours via l'API Peppy.
import { computeStats, viewStats } from './stats.js';
import { viewPerfs, viewExercise, viewWod as viewWodScores, viewAdd, viewResults, calcGrid, groupRankings, roundKg, norm } from './perfs.js';

// ---------------------------------------------------------------- utils
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

const pad = (n) => String(n).padStart(2, '0');
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d) => { const x = startOfDay(d); return addDays(x, -((x.getDay() + 6) % 7)); };
const dayKey = (d) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const sameDay = (a, b) => dayKey(a) === dayKey(b);
const fmtTime = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (d, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => new Date(d).toLocaleDateString('fr-FR', opts);
const minutes = (a, b) => Math.round((new Date(b) - new Date(a)) / 60000);
const cap = (v) => (v ? v[0].toUpperCase() + v.slice(1) : '');
const initials = (u) => `${u?.firstname?.[0] ?? ''}${u?.lastname?.[0] ?? ''}`.toUpperCase() || '?';

function relative(d) {
  d = new Date(d);
  const diff = d - Date.now();
  const mins = Math.round(diff / 60000);
  if (mins < 0) return 'en cours';
  if (mins < 60) return `dans ${mins} min`;
  if (sameDay(d, new Date()) ) return `dans ${Math.floor(mins / 60)} h ${pad(mins % 60)}`;
  if (sameDay(d, addDays(new Date(), 1))) return `demain à ${fmtTime(d)}`;
  return `dans ${Math.round((startOfDay(d) - startOfDay(new Date())) / 864e5)} jours`;
}

// Les descriptions Peppy peuvent contenir du HTML : on n'en garde que le texte.
function richText(html) {
  if (!html) return '';
  if (!/<[a-z][\s\S]*>/i.test(html)) return esc(html);
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n'), 'text/html');
  doc.querySelectorAll('li').forEach((li) => li.prepend('• '));
  return esc(doc.body.textContent.replace(/\n{3,}/g, '\n\n').trim());
}

const ICONS = {
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6z"/><path d="M14 5v14" stroke-dasharray="2 3"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  hourglass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12M6 21h12M7 3v3a5 5 0 0 0 10 0V3M7 21v-3a5 5 0 0 1 10 0v3"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/></svg>',
  chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
};

// ---------------------------------------------------------------- API
const Q = {
  login: `query loginPeppy($data: UserLoginInput!) {
    loginPeppy(data: $data) { accessToken expiresIn user { id firstname lastname avatar email } }
  }`,
  refresh: `mutation refreshPeppyToken { refreshPeppyToken { accessToken expiresIn } }`,
  logout: `mutation logoutPeppy { logoutPeppy }`,
  params: `query getBox($where: ID!) {
    getBox(where: $where) { id parameters {
      slotPublicationInterval slotClosingReservationInterval
      slotNoPenaltyCancellationInterval slotClosingConfirmationInterval slotClosingWaitingListUpdateInterval
      allowLateReservationCancelling maxPendingReservations allowNoShow automaticNoShowOnPendingReservations
    } }
  }`,
  me: `query me { me { user { id firstname lastname avatar email } boxes { id name logo address } } }`,
  boxes: `query getMyBoxes($page: Int, $pageSize: Int) {
    getMyBoxes(page: $page, pageSize: $pageSize) { edges { node { id name logo address } } }
  }`,
  slots: `query getSlots($where: SlotSearchInput, $orderBy: SlotOrderBy, $page: Int, $pageSize: Int) {
    getSlots(where: $where, orderBy: $orderBy, page: $page, pageSize: $pageSize) {
      pageInfo { hasNextPage }
      edges { node {
        id start end listSize numberOfReservation numberOfWaiting alternativeTitle description isEvent isActive
        slotType { id name color }
        workoutType { name }
        coaches { id firstname lastname avatar }
      } }
    }
  }`,
  // getSlots ignore les créneaux déjà commencés : on passe par getSlot pour les inscrits.
  participants: `query getSlot($where: ID!) {
    getSlot(where: $where) { id reservation { id status waitlistPosition user { id firstname lastname avatar } } }
  }`,
  myReservations: `query getMyReservations($range: DateRangeInput, $statuses: [ReservationStatus!], $page: Int, $pageSize: Int) {
    getMyReservations(range: $range, statuses: $statuses, page: $page, pageSize: $pageSize) {
      edges { node {
        id status waitlistPosition
        slot { id start end alternativeTitle box { id name } slotType { id name color } coaches { firstname lastname } }
      } }
    }
  }`,
  wods: `query getRestrictedWorkouts($where: WorkoutSearchInput, $page: Int, $pageSize: Int) {
    getRestrictedWorkouts(where: $where, page: $page, pageSize: $pageSize) {
      edges { node {
        id name wodDate advice
        slotType { id name color }
        blocks { id title description position color }
        session { difficulty description }
      } }
    }
  }`,
  enrollments: `query getMyEnrollments($statuses: [EnrollmentStatus!], $page: Int, $pageSize: Int) {
    getMyEnrollments(statuses: $statuses, page: $page, pageSize: $pageSize) {
      edges { node {
        id status startDate endDate creditBalance nextCreditRechargeDate lastUse
        contract { name url }
        offer { id title type price currency box { id name } entries { frequency maxPerDay maxPerMonth max } contract { name url } }
        counters { totalCount weekCount lateCancellationCount noShowCount }
      } }
    }
  }`,
  quotas: `query getEnrollmentReservationQuotas($enrollmentId: ID!, $boxId: ID!) {
    getEnrollmentReservationQuotas(enrollmentId: $enrollmentId, boxId: $boxId) {
      pendingReservations { max used }
      slotTypes { slotTypeName maxPerDay usedPerDay maxPerWeek usedPerWeek maxPerMonth usedPerMonth maxPerBillingCycle usedPerBillingCycle }
    }
  }`,
  allReservations: `query getMyReservations($range: DateRangeInput, $statuses: [ReservationStatus!], $page: Int, $pageSize: Int) {
    getMyReservations(range: $range, statuses: $statuses, page: $page, pageSize: $pageSize) {
      pageInfo { hasNextPage }
      edges { node { id status createdAt updatedAt slot { id start end slotType { id name color } } } }
    }
  }`,
  invoices: `query getMyInvoices($page: Int, $pageSize: Int) {
    getMyInvoices(page: $page, pageSize: $pageSize) {
      pageInfo { hasNextPage }
      edges { node { id status description total currency dueDate paymentDate createdAt enrollment { id } lines { description quantity } } }
    }
  }`,
  exercises: `query getExercises { getExercises(page: 1, pageSize: 500) { edges { node { id name performanceType performanceOrder } } } }`,
  // Les records ne se lisent qu'exercice par exercice (exerciseId obligatoire).
  myPerfs: `query getMyPerformances($id: ID!) { getMyPerformances(exerciseId: $id, page: 1, pageSize: 200) { edges { node { id value range createdAt } } } }`,
  rankings: `query getRankings($w: RankingWhereInput) {
    getRankings(where: $w, orderBy: date_DESC, page: 1, pageSize: 200) { edges { node { id performance date difficulty workout { id name performanceType } } } }
  }`,
  workout: `query getRestrictedWorkout($id: ID!) { getRestrictedWorkout(where: $id) { id advice session { difficulty description } } }`,
  searchWods: `query getRestrictedWorkouts($w: WorkoutSearchInput) { getRestrictedWorkouts(where: $w, page: 1, pageSize: 12) { edges { node { id name performanceType } } } }`,
  savePerf: `mutation savePerformanceForRange($d: CreatePerformanceForRangeInput!) { savePerformanceForRange(data: $d) { id } }`,
  saveRanking: `mutation createRanking($w: ID!, $d: CreateRankingInput!) {
    createRanking(where: $w, data: $d) { id performance date difficulty workout { id name performanceType } }
  }`,
  confirm: `mutation confirmReservation($where: ID!, $data: ConfirmReservationInput) { confirmReservation(where: $where, data: $data) { id status } }`,
  book: `mutation makeReservation($where: ID!) { makeReservation(where: $where) { id status waitlistPosition } }`,
  cancel: `mutation cancelReservation($where: ID!) { cancelReservation(where: $where) { id status } }`,
};

const isAuthError = (e) => e?.extensions?.code === 'UNAUTHENTICATED' || /unauthori[sz]ed|not authenticated|jwt|invalid token|token expired/i.test(e?.message || '');

// Le jeton d'accès (JWT) dure 1 h ; le relais (server.mjs ou worker.mjs) transmet le cookie de rafraîchissement
// posé par Peppy, ce qui permet d'en obtenir un nouveau sans redemander le mot de passe.
const jwtExp = (t) => { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000; } catch { return 0; } };

// Incrémenté à chaque déconnexion : une réponse arrivée après coup appartient à l'ancien compte
// et ne doit rien écrire dans l'état (ni faire revivre la session).
let session = 0;
const STALE = 'session terminée';
const staleError = () => new Error(STALE);

let refreshing = null;
function refreshToken() {
  const sid = session;
  refreshing ||= (async () => {
    const res = await fetch('/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: Q.refresh }) });
    const token = (await res.json().catch(() => ({}))).data?.refreshPeppyToken?.accessToken;
    if (sid !== session) throw staleError();
    if (!token) throw new Error('refresh impossible');
    state.token = token;
    store.set('peppy.token', token);
  })().finally(() => { refreshing = null; });
  return refreshing;
}

async function gql(query, variables = {}, { retry = true } = {}) {
  const sid = session;
  if (state.token && retry) {
    const exp = jwtExp(state.token);
    if (exp && exp - 30000 < Date.now()) await refreshToken().catch(() => {});
  }
  const headers = { 'content-type': 'application/json' };
  if (state.token) headers.authorization = `JWT ${state.token}`;
  const res = await fetch('/graphql', { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  let json;
  try { json = await res.json(); } catch { throw new Error(`Erreur réseau (${res.status})`); }
  if (sid !== session) throw staleError();
  const errors = json.errors || [];
  const empty = !json.data || Object.values(json.data).every((v) => v == null);
  if (empty) {
    if (state.token && (res.status === 401 || errors.some(isAuthError))) {
      if (retry) {
        try { await refreshToken(); return gql(query, variables, { retry: false }); } catch {}
      }
      logout('Session expirée, reconnecte-toi.');
    }
    throw new Error(errors[0]?.message || `Erreur ${res.status}`);
  }
  if (errors.length) console.warn('GraphQL (partiel)', errors);
  return json.data;
}

const nodes = (conn) => (conn?.edges || []).map((e) => e?.node).filter(Boolean);

// ---------------------------------------------------------------- state
// Tout ce qui appartient au compte connecté : remis à zéro à la déconnexion.
const accountState = () => ({
  user: null,
  boxes: [],
  boxId: null,
  slots: [],
  slotsWeek: null,
  nextSlots: null,
  wods: [],
  upcoming: [],
  history: null,
  enrollments: null,
  invoices: [],
  quotas: {},
  params: {},
  stats: undefined,
  exercises: null,
  perfs: null, // Map exerciceId → performances
  scan: null,
  rankings: undefined,
  wodSearch: new Map(),
  workouts: new Map(), // descriptions des WOD, par id
  addSel: null,
  skipped: new Set(),
  loading: false,
  pending: new Set(),
});
// Clés du navigateur propres au compte ; les préférences de l'appareil (filtre, % favoris) restent.
const ACCOUNT_KEYS = ['peppy.token', 'peppy.user', 'peppy.box', 'peppy.skipped', 'peppy.perfEx'];
store.del('peppy.filters'); // ancien filtre par type de cours, retiré

const state = {
  ...accountState(),
  token: store.get('peppy.token'),
  user: store.get('peppy.user'),
  boxId: store.get('peppy.box'),
  skipped: new Set(store.get('peppy.skipped') || []),
  tab: ['planning', 'resas', 'perfs', 'stats', 'abo'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'planning',
  day: startOfDay(new Date()),
  weekStart: startOfWeek(new Date()),
  pctFav: new Set(store.get('peppy.pctFav') || [70, 80, 90]),
  onlyFree: !!store.get('peppy.onlyFree'),
};

function logout(message) {
  if (state.token && !message) fetch('/graphql', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `JWT ${state.token}` }, body: JSON.stringify({ query: Q.logout }) }).catch(() => {});
  session++; // les réponses encore en route pour ce compte seront ignorées
  ACCOUNT_KEYS.forEach(store.del);
  Object.assign(state, accountState(), { token: null });
  perfsLoading = false;
  lastResults = new Map();
  closeSheet();
  render();
  if (message) toast(message, true);
}

// ---------------------------------------------------------------- data
const ACTIVE = ['VALIDATED', 'PENDING', 'WAITING'];
const ALL_STATUSES = ['VALIDATED', 'PENDING', 'WAITING', 'CANCELLED', 'ABSENT'];

async function loadBoxes() {
  try {
    const { me } = await gql(Q.me);
    state.boxes = me.boxes || [];
    if (me.user) { state.user = me.user; store.set('peppy.user', me.user); }
  } catch (e) { console.warn('me', e); }
  if (!state.boxes.length) state.boxes = nodes((await gql(Q.boxes, { page: 1, pageSize: 50 })).getMyBoxes);
  if (!state.boxes.some((b) => b.id === state.boxId)) state.boxId = state.boxes[0]?.id || null;
  store.set('peppy.box', state.boxId);
  loadParams();
}

// Règles de la salle (délais d'annulation, limite de réservations…) : facultatif.
async function loadParams() {
  const id = state.boxId;
  if (!id || state.params[id]) return;
  try {
    state.params[id] = (await gql(Q.params, { where: id })).getBox?.parameters || {};
    render();
  } catch (e) { console.warn('params', e); }
}
const params = () => state.params[state.boxId] || {};

async function fetchAll(query, key, variables, pageSize = 200, maxPages = 10) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await gql(query, { ...variables, page, pageSize });
    out.push(...nodes(data[key]));
    if (!data[key]?.pageInfo?.hasNextPage) break;
  }
  return out;
}

async function loadWeek({ silent = false } = {}) {
  if (!state.boxId) return;
  const ws = state.weekStart;
  const we = addDays(ws, 7);
  const weekId = `${state.boxId}:${dayKey(ws)}`;
  if (!silent) { state.loading = state.slotsWeek !== weekId; render(); }

  const now = new Date();
  const thisWeek = startOfWeek(now);
  const resStart = ws < thisWeek ? ws : thisWeek;
  const resEnd = addDays(we > now ? we : now, 45);

  const [slots, resas, wods] = await Promise.allSettled([
    fetchAll(Q.slots, 'getSlots', { where: { boxId: [state.boxId], start: ws.toISOString(), end: we.toISOString() }, orderBy: 'start_ASC' }),
    gql(Q.myReservations, { range: { start: resStart.toISOString(), end: resEnd.toISOString() }, statuses: ACTIVE, page: 1, pageSize: 100 }),
    gql(Q.wods, { where: { boxId: state.boxId, wodDateFrom: ws.toISOString(), wodDateTo: we.toISOString() }, page: 1, pageSize: 50 }),
  ]);

  if (`${state.boxId}:${dayKey(state.weekStart)}` !== weekId) return; // l'utilisateur a changé de semaine entre-temps

  if (slots.status === 'fulfilled') {
    state.slots = slots.value.filter((s) => s.isActive !== false).sort((a, b) => new Date(a.start) - new Date(b.start));
    state.slotsWeek = weekId;
  } else if (!silent) toast(slots.reason.message, true);
  if (resas.status === 'fulfilled') {
    state.upcoming = nodes(resas.value.getMyReservations).sort((a, b) => new Date(a.slot.start) - new Date(b.slot.start));
  }
  state.wods = wods.status === 'fulfilled' ? nodes(wods.value.getRestrictedWorkouts) : [];
  state.loading = false;
  render();
}

async function loadHistory() {
  const now = new Date();
  const data = await gql(Q.myReservations, { range: { start: addDays(now, -90).toISOString(), end: now.toISOString() }, statuses: ALL_STATUSES, page: 1, pageSize: 200 });
  state.history = nodes(data.getMyReservations)
    .filter((r) => new Date(r.slot.start) < now)
    .sort((a, b) => new Date(b.slot.start) - new Date(a.slot.start));
  render();
}

async function loadStats() {
  const all = await fetchAll(Q.allReservations, 'getMyReservations', { range: { start: '2010-01-01T00:00:00Z', end: addDays(new Date(), 60).toISOString() }, statuses: ALL_STATUSES }, 100, 50);
  if (state.enrollments == null) await loadEnrollments().catch(() => {});
  if (!state.invoices.length) state.invoices = await fetchAll(Q.invoices, 'getMyInvoices', {}, 50, 10).catch(() => []);
  // Coût : tout ce qui a été payé pour des abonnements et cartes (hors achats en caisse).
  const paid = state.invoices.filter((i) => i.enrollment && i.status === 'PAID').reduce((a, i) => a + i.total, 0) / 100;
  state.stats = computeStats(all, { frequency: activeEntries()?.frequency, noPenaltyMinutes: params().slotNoPenaltyCancellationInterval, paid });
  render();
}

// ---------------------------------------------------------------- perfs
// L'API ne donne les records qu'exercice par exercice (exerciseId obligatoire, aucun endpoint global).
// On pose donc la même question pour chaque mouvement dans UNE seule requête, grâce aux alias GraphQL
// (e0: getMyPerformances(…), e1: …) : 95 mouvements en environ 2,5 s.
// Les mouvements où tu as des records sont retenus dans le navigateur : on les charge d'abord
// (réponse quasi immédiate), et on ne revérifie les autres qu'une fois par jour.
const perfList = (conn) => nodes(conn).map((p) => ({ ...p, date: p.createdAt }));

async function fetchPerfs(map, ids) {
  if (!ids.length) return;
  const fields = ids.map((id, i) => `e${i}: getMyPerformances(exerciseId: "${id}", page: 1, pageSize: 200) { edges { node { id value range createdAt } } }`);
  const data = await gql(`query getMyPerformancesBatch { ${fields.join('\n')} }`);
  ids.forEach((id, i) => { if (data[`e${i}`]) map.set(id, perfList(data[`e${i}`])); });
}

// Liste rattachée à l'utilisateur : un autre compte sur le même navigateur repart de zéro.
const rememberPerfExercises = (map) => store.set('peppy.perfEx', { user: state.user?.id, ids: [...map].filter(([, l]) => l.length).map(([id]) => id), at: Date.now() });

let perfsLoading = false;
async function loadPerfs() {
  if (perfsLoading || state.perfs) return;
  perfsLoading = true;
  try {
    if (!state.exercises) state.exercises = nodes((await gql(Q.exercises)).getExercises);
    if (state.rankings === undefined) loadRankings();
    const all = state.exercises.map((e) => e.id);
    const saved = store.get('peppy.perfEx');
    const known = saved?.user && saved.user === state.user?.id ? saved : { ids: [], at: 0 };
    const knownIds = known.ids.filter((id) => all.includes(id));
    const map = new Map();
    const show = () => { state.perfs = map; if (state.tab === 'perfs') render(); };
    if (knownIds.length) { await fetchPerfs(map, knownIds); show(); }
    if (!knownIds.length || Date.now() - known.at > 864e5) {
      state.scan = true;
      if (state.tab === 'perfs') render();
      await fetchPerfs(map, all.filter((id) => !knownIds.includes(id)));
      state.scan = null;
      rememberPerfExercises(map);
    }
    show();
  } catch (e) {
    state.scan = null;
    toast(e.message, true);
  } finally {
    perfsLoading = false;
  }
}

async function loadRankings() {
  try {
    state.rankings = nodes((await gql(Q.rankings, { w: { user: state.user?.id } })).getRankings);
  } catch (e) {
    console.warn('rankings', e);
    state.rankings = [];
  }
  if (state.tab === 'perfs') render();
}

async function loadEnrollments() {
  const data = await gql(Q.enrollments, { statuses: ['VALIDATED', 'FUTURE', 'PENDING', 'SUSPENDED', 'CANCELLING', 'EXPIRED'], page: 1, pageSize: 50 });
  // Les abonnements expirés de moins d'un jour sont des erreurs de saisie remplacées aussitôt.
  state.enrollments = nodes(data.getMyEnrollments)
    .filter((e) => e.status !== 'EXPIRED' || e.counters?.totalCount || new Date(e.endDate) - new Date(e.startDate) > 864e5)
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  render();
  await Promise.allSettled([
    ...state.enrollments.filter((e) => e.status !== 'EXPIRED').map(async (e) => {
      const q = await gql(Q.quotas, { enrollmentId: e.id, boxId: e.offer.box.id });
      state.quotas[e.id] = q.getEnrollmentReservationQuotas;
    }),
    fetchAll(Q.invoices, 'getMyInvoices', {}, 50, 10).then((list) => { state.invoices = list; }),
  ]);
  render();
}

async function loadNextSlots() {
  if (!state.boxId) return;
  const now = new Date();
  const boxId = state.boxId;
  const [slots] = await Promise.all([
    fetchAll(Q.slots, 'getSlots', { where: { boxId: [boxId], start: now.toISOString(), end: addDays(startOfWeek(now), 14).toISOString() }, orderBy: 'start_ASC' }),
    state.history ? null : loadHistory(),
  ]);
  if (boxId !== state.boxId) return;
  state.nextSlots = slots.filter((s) => s.isActive !== false);
  render();
}

const findSlot = (id) => state.slots.find((s) => s.id === id) || state.nextSlots?.find((s) => s.id === id);

function myReservationFor(slotId) {
  return state.upcoming.find((r) => r.slot.id === slotId && ACTIVE.includes(r.status));
}

// ---------------------------------------------------------------- actions
async function book(slotId) {
  const slot = findSlot(slotId);
  await withPending(slotId, async () => {
    const { makeReservation: r } = await gql(Q.book, { where: slotId });
    toast(r.status === 'WAITING'
      ? `Ajouté à la liste d'attente${r.waitlistPosition ? ` (position ${r.waitlistPosition})` : ''}`
      : `Réservé ✓ ${slot ? `${fmtDay(slot.start, { weekday: 'long' })} ${fmtTime(slot.start)}` : ''}`);
  });
}

async function cancel(resId, slotId) {
  await withPending(slotId || resId, async () => {
    await gql(Q.cancel, { where: resId });
    toast('Réservation annulée');
  });
}

async function confirmPresence(resId, slotId) {
  const pos = await new Promise((ok, ko) => {
    if (!navigator.geolocation) return ko(new Error('Géolocalisation indisponible sur cet appareil.'));
    navigator.geolocation.getCurrentPosition(ok, () => ko(new Error('Position refusée : impossible de confirmer ta présence.')), { enableHighAccuracy: true, timeout: 15000 });
  }).catch((e) => { toast(e.message, true); });
  if (!pos) return;
  await withPending(slotId || resId, async () => {
    await gql(Q.confirm, { where: resId, data: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } });
    toast('Présence confirmée ✓');
  });
}

async function withPending(id, fn) {
  state.pending.add(id);
  render();
  try {
    await fn();
    closeSheet();
    await Promise.all([loadWeek({ silent: true }), loadNextSlots().catch(() => {})]);
  } catch (e) {
    toast(e.message, true);
  } finally {
    state.pending.delete(id);
    render();
  }
}

// ---------------------------------------------------------------- UI helpers
let toastTimer;
function toast(msg, isError = false) {
  if (msg === STALE) return;
  const el = $('#toast');
  el.textContent = msg;
  el.className = `show${isError ? ' err' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ''), isError ? 5000 : 2600);
}

// Les images du CDN Peppy passent par le relais, qui les met en cache (voir server.mjs et worker.mjs).
const img = (u) => (/^https:\/\/peppy-prod-cdn\.s3\./.test(u || '') ? `/img?u=${encodeURIComponent(u)}` : u);

function avatar(u) {
  return `<span class="av" data-name="${esc(`${u?.firstname ?? ''} ${u?.lastname ?? ''}`)}">${esc(initials(u))}${u?.avatar ? `<img src="${esc(img(u.avatar))}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
}

const isBooked = (r) => r?.status === 'VALIDATED' || r?.status === 'PENDING';
const parseWodDate = (v) => (/^\d{10,}$/.test(v) ? new Date(Number(v)) : /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00`) : new Date(v));

// « cette semaine », « semaine prochaine », « semaine dernière » ou « semaine du 12 oct. ».
function weekName(ws) {
  const diff = Math.round((startOfWeek(ws) - startOfWeek(new Date())) / (7 * 864e5));
  return { 0: 'cette semaine', 1: 'semaine prochaine', [-1]: 'semaine dernière' }[diff] ?? `semaine du ${fmtDay(ws, { day: 'numeric', month: 'short' })}`;
}

// Résumé de la semaine affichée : séances réservées vs abonnement, résas en cours vs limite de la salle.
function weekSummary() {
  const ws = state.weekStart;
  const we = addDays(ws, 7);
  const now = new Date();
  const inWeek = state.upcoming.filter((r) => isBooked(r) && new Date(r.slot.start) >= ws && new Date(r.slot.start) < we).length;
  const freq = (state.enrollments || []).find((e) => e.status === 'VALIDATED')?.offer?.entries?.frequency;
  const active = state.upcoming.filter((r) => ACTIVE.includes(r.status) && new Date(r.slot.start) > now).length;
  const max = params().maxPendingReservations;
  const chip = (label, n, m) => `<span class="sum ${m && n >= m ? 'full' : ''}">${label} <b>${n}${m ? `/${m}` : ''}</b></span>`;
  const upcoming = state.upcoming.filter((r) => new Date(r.slot.end) > now).length;
  return `<div class="summary">${chip(`Séances ${weekName(ws)}`, inWeek, freq)}${max ? chip('Résas en cours', active, max) : ''}
    <button class="sum link" data-action="tab" data-tab="resas">${ICONS.ticket}Mes résas${upcoming ? `<span class="badge">${upcoming}</span>` : ''}<span class="arrow">›</span></button></div>`;
}

const activeEntries = () => (state.enrollments || []).find((e) => e.status === 'VALIDATED')?.offer?.entries;
const fmtDuration = (min) => {
  min = Math.max(0, Math.round(min));
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) return `${Math.floor(min / 60)} h${min % 60 ? ` ${pad(min % 60)}` : ''}`;
  return `${Math.round(min / 1440)} j`;
};

// Fenêtre de confirmation sur place : à partir d'1 h avant le cours jusqu'à la fermeture
// définie par la salle (slotClosingConfirmationInterval, en minutes après le début).
function canConfirm(s, r) {
  if (r?.status !== 'PENDING') return false;
  const start = new Date(s.start).getTime();
  const close = start + (params().slotClosingConfirmationInterval ?? 180) * 60000;
  return Date.now() >= start - 3600e3 && Date.now() <= close;
}

// Heure limite d'annulation (slotNoPenaltyCancellationInterval, en minutes avant le début).
// Au-delà, la salle refuse l'annulation ou la compte comme tardive.
function cancelDeadline(r) {
  const limit = params().slotNoPenaltyCancellationInterval;
  return isBooked(r) && limit != null ? new Date(r.slot.start).getTime() - limit * 60000 : null;
}
const lateRefused = () => params().allowLateReservationCancelling === false;

const fmtCountdown = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  return `${h ? `${h}:` : ''}${h ? pad(Math.floor((t % 3600) / 60)) : Math.floor((t % 3600) / 60)}:${pad(t % 60)}`;
};
// Compte à rebours mis à jour chaque seconde (voir tickCountdowns) ; `over` remplace le contenu à l'échéance.
const countdown = (deadline, over) => `<span class="cd-v" data-deadline="${deadline}" data-over="${esc(over)}">${fmtCountdown(deadline - Date.now())}</span>`;

// Rappel discret sur les cartes : seulement le jour J (avant, c'est sans enjeu).
function cancelInfo(r) {
  if (!r || new Date(r.slot.start) < new Date()) return '';
  if (r.status === 'WAITING') return `<span class="hint">${r.waitlistPosition ? `#${r.waitlistPosition} sur la liste d'attente` : 'Sur liste d\'attente'}</span>`;
  const deadline = cancelDeadline(r);
  if (!deadline || deadline - Date.now() > 24 * 3600e3) return '';
  return deadline > Date.now()
    ? `<span class="hint">Annulable jusqu'à ${fmtTime(deadline)}</span>`
    : `<span class="hint warn">${lateRefused() ? 'Annulation fermée' : 'Annulation tardive'}</span>`;
}

// Bloc détaillé de la fiche d'un cours réservé.
function cancelTimer(r) {
  const deadline = cancelDeadline(r);
  if (!deadline || new Date(r.slot.start) < new Date()) return '';
  if (deadline <= Date.now()) {
    return `<div class="cd-box over">${ICONS.hourglass}<div><b>${lateRefused() ? 'Annulation fermée' : 'Annulation tardive'}</b><small>Le délai était ${fmtTime(deadline)}${lateRefused() ? ' : ta salle n\'accepte plus d\'annulation.' : ' : elle sera comptée comme tardive.'}</small></div></div>`;
  }
  const soon = deadline - Date.now() < 24 * 3600e3;
  return `<div class="cd-box">${ICONS.hourglass}<div>
      <small>Temps restant pour annuler</small>
      <b>${soon ? countdown(deadline, 'Fermé') : fmtDuration((deadline - Date.now()) / 60000)}</b>
      <small>Jusqu'à ${soon ? '' : `${fmtDay(deadline, { weekday: 'long', day: 'numeric', month: 'long' })} `}${fmtTime(deadline)}, soit ${fmtDuration(params().slotNoPenaltyCancellationInterval)} avant le cours</small>
    </div></div>`;
}

// Ce qui empêcherait de réserver ce créneau (quota hebdo, max par jour, résas en cours).
// Déjà une séance réservée ce jour-là (la liste d'attente ne compte pas : on peut viser un autre cours).
const bookedOnDay = (s) => state.upcoming.some((r) => isBooked(r) && r.slot.id !== s.id && sameDay(r.slot.start, s.start));

function limitNote(s) {
  if (bookedOnDay(s)) return '';
  const e = activeEntries() || {};
  const p = params();
  const booked = state.upcoming.filter((r) => isBooked(r));
  const ws = startOfWeek(s.start);
  const notes = [];
  const week = booked.filter((r) => startOfWeek(r.slot.start).getTime() === ws.getTime()).length;
  if (e.frequency && week >= e.frequency) notes.push(`Quota semaine atteint (${week}/${e.frequency})`);
  const pending = state.upcoming.filter((r) => ACTIVE.includes(r.status) && new Date(r.slot.start) > new Date()).length;
  if (p.maxPendingReservations && pending >= p.maxPendingReservations) notes.push(`${pending}/${p.maxPendingReservations} résas en cours`);
  return notes.length ? `<span class="hint warn">${esc(notes.join(' · '))}</span>` : '';
}

const slotTitle = (s) => s.alternativeTitle || s.slotType?.name || s.workoutType?.name || 'Cours';

// PENDING = réservé, présence à confirmer sur place ; VALIDATED = présence confirmée.
function statusTag(r, past = false) {
  switch (r?.status) {
    case 'PENDING': return past ? '' : '<span class="tag ok">Réservé</span>';
    case 'VALIDATED': return '<span class="tag ok">Confirmé</span>';
    case 'WAITING': return `<span class="tag warn">Attente${r.waitlistPosition ? ` #${r.waitlistPosition}` : ''}</span>`;
    case 'CANCELLED': return '<span class="tag neutral">Annulé</span>';
    case 'ABSENT': return '<span class="tag danger">Absent</span>';
    default: return '';
  }
}

function fillBar(s) {
  const n = s.numberOfReservation ?? 0;
  const max = s.listSize || 0;
  const full = n >= max;
  const left = Math.max(0, max - n);
  // La salle peut ajouter des personnes au-delà de la limite (surbooking).
  const over = n > max ? ` · ${n - max} en surnombre` : '';
  const label = full
    ? `Complet${over}${s.numberOfWaiting ? ` · ${s.numberOfWaiting} en attente` : ''}`
    : `${left} place${left > 1 ? 's' : ''}`;
  // Une graduation par place quand c'est lisible, sinon une jauge continue.
  const gauge = max && max <= 30
    ? `<div class="ticks ${full ? 'full' : n / max >= 0.8 ? 'almost' : ''}">${[...Array(max)].map((_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`
    : `<div class="bar ${full ? 'full' : ''}"><span style="width:${max ? Math.min(100, (n / max) * 100) : 0}%"></span></div>`;
  return `<div class="fill">${gauge}<span class="fill-lbl"><b>${n}/${max}</b> ${label}</span></div>`;
}

function slotAction(s, r) {
  const busy = state.pending.has(s.id) ? ' busy' : '';
  if (new Date(s.end) < new Date()) return '';
  if (canConfirm(s, r)) return `<button class="btn primary${busy}" data-action="confirm" data-res="${r.id}" data-slot="${s.id}">Je suis là</button>`;
  if (r) return `<button class="btn cancel${busy}" data-action="ask-cancel" data-res="${r.id}" data-slot="${s.id}">${r.status === 'WAITING' ? 'Quitter' : 'Annuler'}</button>`;
  const closing = (params().slotClosingReservationInterval || 0) * 60000;
  if (new Date(s.start) - closing < new Date()) return '<span class="muted" style="font-size:13px">Fermé</span>';
  if (bookedOnDay(s)) return '<span class="muted" style="font-size:13px">Tu as déjà une séance ce jour-là</span>';
  const full = (s.numberOfReservation ?? 0) >= s.listSize;
  return full
    ? `<button class="btn join-wait${busy}" data-action="book" data-slot="${s.id}" title="M'inscrire sur la liste d'attente"><i>+</i> Liste d'attente</button>`
    : `<button class="btn primary${busy}" data-action="book" data-slot="${s.id}">Réserver</button>`;
}

// ---------------------------------------------------------------- views
function viewLogin() {
  return `<main class="login">
    <form id="login-form" autocomplete="on">
      <div class="logo">P+</div>
      <h1>Peppy+</h1>
      <p>Connecte-toi avec ton compte Peppy.</p>
      <label class="field">Email<input name="email" type="email" autocomplete="username" required autofocus></label>
      <label class="field">Mot de passe<input name="password" type="password" autocomplete="current-password" required></label>
      <div class="error" id="login-error"></div>
      <button class="btn primary block" type="submit">Se connecter</button>
      <p class="muted" style="font-size:12px;margin-top:4px">Tes identifiants sont envoyés uniquement à l'API Peppy, via le relais Peppy+, qui ne les enregistre pas.</p>
    </form>
  </main>`;
}

function viewHeader() {
  const box = state.boxes.find((b) => b.id === state.boxId);
  const boxName = state.boxes.length > 1
    ? `<select data-action="box" aria-label="Salle">${state.boxes.map((b) => `<option value="${b.id}" ${b.id === state.boxId ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>`
    : `<b>${esc(box?.name || 'Peppy+')}</b>`;
  return `<header class="top"><div class="top-inner">
    <div class="logo">${box?.logo ? `<img src="${esc(img(box.logo))}" alt="">` : 'P+'}</div>
    <div class="top-title">${boxName}<small>Salut ${esc(cap(state.user?.firstname?.trim()))} 👋</small></div>
    <button class="icon-btn" data-action="refresh" title="Rafraîchir">${ICONS.refresh}</button>
    <button class="icon-btn" data-action="logout" title="Se déconnecter">${ICONS.logout}</button>
  </div></header>`;
}

function viewTabs() {
  // « Mes résas » s'ouvre depuis le planning, qui reste l'onglet actif.
  const current = state.tab === 'resas' ? 'planning' : state.tab;
  const tab = (id, icon, label) => `<button data-action="tab" data-tab="${id}" ${current === id ? 'aria-current="page"' : ''}>${icon}<span>${label}</span></button>`;
  return `<nav class="tabs">
    ${tab('planning', ICONS.calendar, 'Planning')}
    ${tab('perfs', ICONS.dumbbell, 'Perfs')}
    ${tab('stats', ICONS.chart, 'Stats')}
    ${tab('abo', ICONS.card, 'Abonnement')}
  </nav>`;
}

function viewHero() {
  const next = state.upcoming.find((r) => new Date(r.slot.end) > new Date() && r.status !== 'CANCELLED');
  if (!next) return '';
  const d = new Date(next.slot.start);
  return `<div class="hero" data-action="goto-slot" data-slot="${next.slot.id}" data-start="${next.slot.start}">
    <div class="hero-k">${next.status === 'WAITING' ? 'Liste d\'attente' : 'Prochaine séance'}</div>
    <div class="hero-when"><span>${fmtDay(d, { weekday: 'short' }).replace('.', '')} ${d.getDate()}</span><span>${fmtTime(d)}</span></div>
    <div class="hero-row">
      <span class="hero-type">${esc(slotTitle(next.slot))}</span>
      <span class="hero-rel">${esc(relative(d))}</span>
    </div>
    ${heroTimer(next)}
    ${canConfirm(next.slot, next) ? `<button class="btn dark block" data-action="confirm" data-res="${next.id}" data-slot="${next.slot.id}">Je suis à la salle — confirmer</button>` : ''}
  </div>`;
}

function heroTimer(r) {
  const deadline = cancelDeadline(r);
  if (!deadline || !sameDay(r.slot.start, new Date()) || new Date(r.slot.start) < new Date()) return '';
  return deadline > Date.now()
    ? `<div class="hero-cd">${ICONS.hourglass}${countdown(deadline, 'annulation fermée')}<span>pour annuler</span></div>`
    : `<div class="hero-cd over">${ICONS.hourglass}<span>${lateRefused() ? 'Annulation fermée' : 'Annulation tardive'}</span></div>`;
}

// ---------------------------------------------------------------- suggestions
// Une habitude = même jour, même type de cours, à ±1 h, sur au moins 2 des 8 dernières semaines.
const HABIT_WEEKS = 8;
const typeKey = (s) => (s.slotType?.name || slotTitle(s)).trim().toUpperCase();
const minOfDay = (d) => { d = new Date(d); return d.getHours() * 60 + d.getMinutes(); };

function suggestions() {
  if (!state.nextSlots || !state.history) return [];
  const now = new Date();
  const thisWeek = startOfWeek(now);
  const from = addDays(thisWeek, -7 * HABIT_WEEKS);
  const done = state.history.filter((r) => isBooked(r) && (!r.slot.box || r.slot.box.id === state.boxId))
    .filter((r) => new Date(r.slot.start) >= from && new Date(r.slot.start) < thisWeek);
  const e = activeEntries() || {};
  const booked = state.upcoming.filter((r) => ACTIVE.includes(r.status));
  const closing = (params().slotClosingReservationInterval || 0) * 60000;

  const scored = state.nextSlots
    .filter((s) => new Date(s.start) - closing > now && !myReservationFor(s.id))
    .filter((s) => !booked.some((r) => sameDay(r.slot.start, s.start))) // déjà une séance ce jour-là
    .map((s) => {
      const wd = new Date(s.start).getDay();
      const matches = done.filter((r) => new Date(r.slot.start).getDay() === wd && typeKey(r.slot) === typeKey(s) && Math.abs(minOfDay(r.slot.start) - minOfDay(s.start)) <= 60);
      const weeks = new Set(matches.map((r) => dayKey(startOfWeek(r.slot.start)))).size;
      const gap = matches.length ? Math.min(...matches.map((r) => Math.abs(minOfDay(r.slot.start) - minOfDay(s.start)))) : 99;
      return { s, weeks, gap };
    })
    .filter((x) => x.weeks >= 2);

  // Un seul cours proposé par jour : le plus habituel, puis le plus proche de l'heure habituelle.
  const best = new Map();
  for (const x of scored) {
    const k = dayKey(x.s.start);
    const cur = best.get(k);
    if (!cur || x.weeks > cur.weeks || (x.weeks === cur.weeks && x.gap < cur.gap)) best.set(k, x);
  }

  // Semaine par semaine, dans la limite du quota : les cours libres d'abord, puis les plus habituels.
  // On n'en montre que 2 ; dès qu'on réserve ou qu'on passe, la suivante prend la place.
  const weeks = new Map();
  for (const x of best.values()) {
    if (state.skipped.has(x.s.id)) continue;
    const k = startOfWeek(x.s.start).getTime();
    (weeks.get(k) || weeks.set(k, []).get(k)).push(x);
  }
  const isFull = (s) => (s.numberOfReservation ?? 0) >= s.listSize;
  return [...weeks.entries()].sort(([a], [b]) => a - b).flatMap(([ws, items]) => {
    const used = booked.filter((r) => isBooked(r) && startOfWeek(r.slot.start).getTime() === ws).length;
    const left = e.frequency ? Math.max(0, e.frequency - used) : items.length;
    return items.sort((a, b) => isFull(a.s) - isFull(b.s) || b.weeks - a.weeks || new Date(a.s.start) - new Date(b.s.start)).slice(0, left);
  }).slice(0, 2);
}

function viewSuggestions() {
  const list = suggestions();
  if (!list.length) return '';
  return `<section class="card sugg-box">
    <div class="sugg-top">${ICONS.spark}<b>Suggestions</b><small>d'après tes ${HABIT_WEEKS} dernières semaines</small></div>
    ${list.map(({ s, weeks }) => {
      const n = s.numberOfReservation ?? 0;
      const full = n >= s.listSize;
      const busy = state.pending.has(s.id) ? ' busy' : '';
      return `<div class="sugg-row" data-action="open-slot" data-slot="${s.id}">
        <span class="sugg-when">${fmtDay(s.start, { weekday: 'short' }).replace('.', '')} ${new Date(s.start).getDate()}<b>${fmtTime(s.start)}</b></span>
        <span class="sugg-info"><b>${esc(slotTitle(s))}</b><small>${weeks >= HABIT_WEEKS ? 'chaque semaine' : `${weeks} sem. sur ${HABIT_WEEKS}`} · ${full ? 'complet' : `${s.listSize - n} place${s.listSize - n > 1 ? 's' : ''}`}</small></span>
        <button class="btn sm ${full ? 'join-wait' : 'primary'}${busy}" data-action="book" data-slot="${s.id}" ${full ? 'title="M\'inscrire sur la liste d\'attente"' : ''}>${full ? '+ Attente' : 'Réserver'}</button>
        <button class="sugg-skip" data-action="skip-sugg" data-slot="${s.id}" title="Passer cette suggestion" aria-label="Passer">×</button>
      </div>`;
    }).join('')}
  </section>`;
}

function viewPlanning() {
  const today = startOfDay(new Date());
  const days = [...Array(7)].map((_, i) => addDays(state.weekStart, i));
  const resByDay = {};
  for (const r of state.upcoming) (resByDay[dayKey(r.slot.start)] ||= []).push(r);

  const daySlots = state.slots
    .filter((s) => sameDay(s.start, state.day))
    .filter((s) => !state.onlyFree || myReservationFor(s.id) || (s.numberOfReservation ?? 0) < s.listSize);

  const dayWods = state.wods
    .filter((w) => w.wodDate && sameDay(parseWodDate(w.wodDate), state.day));

  const weekLabel = cap(weekName(state.weekStart));

  let list;
  if (state.loading || !state.slotsWeek) list = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  else if (!daySlots.length) list = `<div class="empty"><b>Aucun cours</b>${state.slots.length ? 'Rien ce jour-là avec ce filtre.' : `Le planning n'est pas encore publié${params().slotPublicationInterval ? ` (ouverture ${params().slotPublicationInterval} jours à l'avance)` : ''}.`}</div>`;
  else list = daySlots.map(viewSlot).join('');

  return `${viewHero()}
    ${viewSuggestions()}
    <div class="week-nav">
      <h2>${weekLabel}</h2>
      <div class="nav">
        <button class="chip-btn" data-action="week" data-dir="-1" aria-label="Semaine précédente">←</button>
        <button class="chip-btn" data-action="today">Aujourd'hui</button>
        <button class="chip-btn" data-action="week" data-dir="1" aria-label="Semaine suivante">→</button>
      </div>
    </div>
    ${weekSummary()}
    <div class="days">
      ${days.map((d) => {
        const res = resByDay[dayKey(d)] || [];
        return `<button class="day ${d < today ? 'past' : ''} ${sameDay(d, today) ? 'today' : ''}" data-action="day" data-day="${dayKey(d)}" aria-pressed="${sameDay(d, state.day)}">
          <small>${fmtDay(d, { weekday: 'short' }).replace('.', '')}</small><b>${d.getDate()}</b>
          <span class="dots">${res.slice(0, 3).map((r) => `<i class="${r.status === 'WAITING' ? 'wait' : ''}"></i>`).join('')}</span>
        </button>`;
      }).join('')}
    </div>
    <div class="filters">
      <button class="filter toggle" data-action="only-free" aria-pressed="${state.onlyFree}">Places dispo</button>
    </div>
    <div class="section-title">${fmtDay(state.day)}</div>
    <div class="list">
      ${dayWods.map(viewWod).join('')}
      ${list}
    </div>`;
}

function viewWod(w) {
  const blocks = [...(w.blocks || [])].sort((a, b) => a.position - b.position);
  const body = blocks.length
    ? blocks.map((b) => `<div class="block"><h4><i style="background:${esc(b.color || 'var(--accent)')}"></i>${esc(b.title)}</h4><div class="rich">${richText(b.description)}</div></div>`).join('')
    : (w.session || []).map((s) => `<div class="block"><h4><i></i>${esc(s.difficulty)}</h4><div class="rich">${richText(s.description)}</div></div>`).join('');
  return `<details class="card wod" ${blocks.length + (w.session?.length || 0) <= 3 ? 'open' : ''}>
    <summary>🏋️ WOD · ${esc(w.name)} ${w.slotType ? `<span class="tag neutral">${esc(w.slotType.name)}</span>` : ''}<span class="chev">${ICONS.chev}</span></summary>
    <div class="body">${body || '<p class="muted" style="margin-top:12px">Pas de détail.</p>'}${w.advice ? `<div class="block"><h4><i></i>Conseils</h4><div class="rich">${richText(w.advice)}</div></div>` : ''}</div>
  </details>`;
}

function viewSlot(s) {
  const r = myReservationFor(s.id);
  const past = new Date(s.end) < new Date();
  const coaches = s.coaches || [];
  const taken = !r && !past && bookedOnDay(s); // journée déjà prise : cours atténué, sans bouton
  return `<article class="card slot ${past ? 'is-past' : ''} ${taken ? 'taken' : ''} ${isBooked(r) ? 'mine' : ''} ${r?.status === 'WAITING' ? 'waiting' : ''}" data-action="open-slot" data-slot="${s.id}">
    <div class="time"><b>${fmtTime(s.start)}</b><small>${minutes(s.start, s.end)}′</small></div>
    <div class="info">
      <div class="name">${esc(slotTitle(s))} ${statusTag(r)}</div>
      ${coaches.length ? `<div class="meta"><span class="avatars">${coaches.map(avatar).join('')}</span> ${esc(coaches.map((c) => c.firstname).join(', '))}</div>` : ''}
      ${fillBar(s)}
      ${past ? '' : r ? cancelInfo({ ...r, slot: s }) : limitNote(s)}
    </div>
    <div class="act">${taken ? '' : slotAction(s, r)}</div>
  </article>`;
}

function viewResas() {
  const now = new Date();
  const upcoming = state.upcoming.filter((r) => new Date(r.slot.end) > now);
  const item = (r, actions = true) => `<article class="card resa">
    <div class="datebox"><small>${fmtDay(r.slot.start, { weekday: 'short' }).replace('.', '')}</small><b>${new Date(r.slot.start).getDate()}</b><small class="my">${fmtDay(r.slot.start, { month: 'short' }).replace('.', '')} ${new Date(r.slot.start).getFullYear()}</small></div>
    <div class="grow">
      <div class="row"><b>${esc(slotTitle(r.slot))}</b>${statusTag(r, !actions)}</div>
      <div class="meta">${fmtTime(r.slot.start)} – ${fmtTime(r.slot.end)} · ${esc(r.slot.box?.name || '')}${r.slot.coaches?.length ? ` · ${esc(r.slot.coaches.map((c) => c.firstname).join(', '))}` : ''}</div>
      ${actions ? `<div class="meta">${esc(relative(r.slot.start))}</div>${cancelInfo(r)}` : ''}
    </div>
    ${actions ? slotAction(r.slot, r) : ''}
  </article>`;

  const hist = state.history;
  const done = hist?.filter(isBooked).length ?? 0;
  return `<button class="back" data-action="tab" data-tab="planning">‹ Planning</button>
    <h2 class="page-title">Mes réservations</h2>
    <div class="section-title">À venir</div>
    <div class="list">${upcoming.length ? upcoming.map((r) => item(r)).join('') : '<div class="empty"><b>Aucune réservation</b>Va dans le planning pour réserver un cours.</div>'}</div>
    <div class="section-title">Historique (90 jours)${hist ? ` · ${done} séance${done > 1 ? 's' : ''}` : ''}</div>
    <div class="list">${hist == null ? '<div class="skeleton"></div>' : hist.length ? hist.map((r, i) => {
      // Les dates seules (« mar 29 ») sont ambiguës sur 90 jours : un séparateur par mois.
      const m = fmtDay(r.slot.start, { month: 'long', year: 'numeric' });
      const sep = i && m !== fmtDay(hist[i - 1].slot.start, { month: 'long', year: 'numeric' }) ? `<div class="month-sep">${m}</div>` : '';
      return sep + item(r, false);
    }).join('') : '<div class="empty">Rien sur les 90 derniers jours.</div>'}</div>`;
}

function bookedThisWeek() {
  const ws = startOfWeek(new Date());
  const we = addDays(ws, 7);
  return state.upcoming.filter((r) => isBooked(r) && new Date(r.slot.start) >= ws && new Date(r.slot.start) < we).length;
}

function viewRules() {
  const p = params();
  const e = activeEntries() || {};
  const pending = state.upcoming.filter((r) => ACTIVE.includes(r.status) && new Date(r.slot.start) > new Date()).length;
  const rows = [
    e.frequency && ['Séances par semaine', `${e.frequency} max`, `${bookedThisWeek()} réservée${bookedThisWeek() > 1 ? 's' : ''} cette semaine`],
    e.maxPerDay && ['Séances par jour', `${e.maxPerDay} max`],
    e.maxPerMonth && ['Séances par mois', `${e.maxPerMonth} max`],
    p.maxPendingReservations && ['Réservations à venir', `${p.maxPendingReservations} max`, `${pending} en cours`],
    p.slotNoPenaltyCancellationInterval != null && ['Annulation', `jusqu'à ${fmtDuration(p.slotNoPenaltyCancellationInterval)} avant`, p.allowLateReservationCancelling === false ? 'ensuite impossible' : 'ensuite comptée comme tardive'],
    p.slotClosingReservationInterval != null && ['Fin des inscriptions', `${fmtDuration(p.slotClosingReservationInterval)} avant le cours`],
    p.slotPublicationInterval && ['Ouverture du planning', `${p.slotPublicationInterval} jours à l'avance`],
    p.slotClosingConfirmationInterval != null && ['Confirmation sur place', `jusqu'à ${fmtDuration(p.slotClosingConfirmationInterval)} après le début`, p.automaticNoShowOnPendingReservations ? 'sinon : absence notée' : 'non bloquant'],
    p.slotClosingWaitingListUpdateInterval != null && ['Liste d\'attente', `mise à jour jusqu'à ${fmtDuration(p.slotClosingWaitingListUpdateInterval)} avant`],
  ].filter(Boolean);
  if (!rows.length) return '';
  return `<div class="section-title">Règles de ta salle</div>
    <section class="card rules">${rows.map(([k, v, sub]) => `<div class="rule"><span>${esc(k)}</span><b>${esc(v)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`).join('')}</section>`;
}

const money = (cents, currency = 'EUR') => (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: currency || 'EUR' });
const fmtDate = (d) => fmtDay(d, { day: 'numeric', month: 'long', year: 'numeric' });
const INVOICE_ST = { PAID: ['ok', 'Payée'], WAITING: ['neutral', 'À venir'], DRAFT: ['neutral', 'À venir'], OPEN: ['warn', 'À payer'], PROCESSING: ['warn', 'En cours'], UNPAID: ['danger', 'Impayée'], VOID: ['neutral', 'Annulée'] };
const invoiceDate = (i) => i.paymentDate || i.dueDate || i.createdAt;

function invoiceList(list) {
  return `<ul class="invoices">${[...list].sort((a, b) => new Date(invoiceDate(b)) - new Date(invoiceDate(a))).map((i) => {
    const [cls, label] = INVOICE_ST[i.status] || ['neutral', i.status];
    // Pour un achat en caisse, le détail est dans les lignes (« Fit aid ») plutôt que la description.
    const what = i.enrollment ? (i.description || '').replace(/^Facture de l'offre\s*/i, '') : (i.lines || []).map((l) => `${l.quantity > 1 ? `${l.quantity} × ` : ''}${l.description?.trim()}`).join(', ') || i.description;
    return `<li><span class="grow">${fmtDate(invoiceDate(i))}<small>${esc(what)}</small></span><b>${money(i.total, i.currency)}</b><span class="tag ${cls}">${label}</span></li>`;
  }).join('')}</ul>`;
}

// Contrat (PDF) et paiements rattachés à un abonnement.
function enrollDocs(e) {
  const contract = e.contract?.url ? e.contract : e.offer?.contract;
  const invoices = state.invoices.filter((i) => i.enrollment?.id === e.id);
  if (!contract?.url && !invoices.length) return '';
  const paid = invoices.filter((i) => i.status === 'PAID').reduce((a, i) => a + i.total, 0);
  return `<div class="docs">
    ${contract?.url ? `<a class="doc" href="${esc(contract.url)}" target="_blank" rel="noopener">${ICONS.doc}<span>${esc(contract.name?.trim() || 'Contrat')}</span><small>PDF</small></a>` : ''}
    ${invoices.length ? `<details class="pay"><summary>${ICONS.card}<span>Paiements · ${invoices.length}</span><small>${money(paid, invoices[0].currency)} payés</small><span class="chev">${ICONS.chev}</span></summary>${invoiceList(invoices)}</details>` : ''}
  </div>`;
}

function viewAbo() {
  if (state.enrollments == null) return '<div class="section-title">Abonnements</div><div class="skeleton" style="height:180px"></div>';
  const current = state.enrollments.filter((e) => e.status !== 'EXPIRED');
  const expired = state.enrollments.filter((e) => e.status === 'EXPIRED');
  const others = state.invoices.filter((i) => !i.enrollment);
  const ST = { VALIDATED: ['ok', 'Actif'], FUTURE: ['neutral', 'À venir'], PENDING: ['warn', 'En attente'], SUSPENDED: ['danger', 'Suspendu'], CANCELLING: ['warn', 'Résiliation en cours'] };
  const cards = current.map((e) => {
    const [cls, label] = ST[e.status] || ['neutral', e.status];
    const q = state.quotas[e.id];
    const rows = [];
    if (q?.pendingReservations?.max) rows.push(['Réservations en cours', q.pendingReservations.used, q.pendingReservations.max]);
    for (const t of q?.slotTypes || []) {
      if (t.maxPerDay != null) rows.push([`${t.slotTypeName} · aujourd'hui`, t.usedPerDay ?? 0, t.maxPerDay]);
      if (t.maxPerWeek != null) rows.push([`${t.slotTypeName} · semaine`, t.usedPerWeek ?? 0, t.maxPerWeek]);
      if (t.maxPerMonth != null) rows.push([`${t.slotTypeName} · mois`, t.usedPerMonth ?? 0, t.maxPerMonth]);
      if (t.maxPerBillingCycle != null) rows.push([`${t.slotTypeName} · période`, t.usedPerBillingCycle ?? 0, t.maxPerBillingCycle]);
    }
    const c = e.counters || {};
    return `<article class="card enroll">
      <div class="row" style="justify-content:space-between"><h3>${esc(e.offer?.title)}</h3><span class="tag ${cls}">${label}</span></div>
      <div class="muted" style="font-size:13px">${esc(e.offer?.box?.name || '')} · depuis le ${fmtDate(e.startDate)}${e.endDate ? ` · jusqu'au ${fmtDate(e.endDate)}` : ''}</div>
      <div class="stats">
        ${e.creditBalance != null ? `<div class="stat"><b>${e.creditBalance}</b><small>crédits restants</small></div>` : ''}
        <div class="stat"><b>${bookedThisWeek()}${e.offer?.entries?.frequency ? `/${e.offer.entries.frequency}` : ''}</b><small>réservées cette semaine</small></div>
        ${e.offer?.entries?.maxPerDay ? `<div class="stat"><b>${e.offer.entries.maxPerDay}</b><small>max par jour</small></div>` : ''}
        <div class="stat"><b>${c.totalCount ?? 0}</b><small>séances avec cet abo</small></div>
        ${c.lateCancellationCount ? `<div class="stat"><b>${c.lateCancellationCount}</b><small>annul. tardives</small></div>` : ''}
        ${c.noShowCount ? `<div class="stat"><b>${c.noShowCount}</b><small>absences</small></div>` : ''}
      </div>
      ${rows.length ? `<div class="quota">${rows.map(([lbl, used, max]) => {
        const ratio = max ? Math.min(1, used / max) : 0;
        return `<div class="quota-row"><span class="lbl">${esc(lbl)}</span><div class="bar ${used >= max ? 'full' : ratio >= .8 ? 'almost' : ''}"><span style="width:${ratio * 100}%"></span></div><b>${used}/${max}</b></div>`;
      }).join('')}</div>` : ''}
      ${e.nextCreditRechargeDate ? `<p class="muted" style="font-size:13px;margin:12px 0 0">Prochaine recharge : ${fmtDay(e.nextCreditRechargeDate)}</p>` : ''}
      ${enrollDocs(e)}
    </article>`;
  }).join('');
  const old = expired.map((e) => `<article class="card enroll old">
      <div class="row" style="justify-content:space-between"><h4>${esc(e.offer?.title)}</h4><span class="tag neutral">Expiré</span></div>
      <div class="muted" style="font-size:13px">${fmtDate(e.startDate)} → ${fmtDate(e.endDate)} · ${e.counters?.totalCount ?? 0} séance${e.counters?.totalCount > 1 ? 's' : ''}${e.offer?.price ? ` · ${money(e.offer.price * 100, e.offer.currency)}${e.offer.type === 'MEMBERSHIP' ? '/mois' : ''}` : ''}</div>
      ${enrollDocs(e)}
    </article>`).join('');
  const othersPaid = others.filter((i) => i.status === 'PAID').reduce((a, i) => a + i.total, 0);
  return `<div class="section-title">Abonnements</div>
    <div class="list">${cards || '<div class="empty"><b>Aucun abonnement actif</b></div>'}</div>
    ${viewRules()}
    ${old ? `<details class="archive"><summary class="section-title">Anciens abonnements · ${expired.length}<span class="chev">${ICONS.chev}</span></summary><div class="list">${old}</div></details>` : ''}
    ${others.length ? `<div class="section-title">Autres achats</div><details class="card pay solo"><summary>${ICONS.card}<span>${others.length} achat${others.length > 1 ? 's' : ''}</span><b>${money(othersPaid, others[0].currency)}</b><span class="chev">${ICONS.chev}</span></summary>${invoiceList(others)}</details>` : ''}`;
}

// ---------------------------------------------------------------- sheet (détail cours)
const sheet = $('#sheet');
function closeSheet() { if (sheet.open) sheet.close(); }
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

async function openSlot(slotId) {
  const s = findSlot(slotId);
  if (!s) return;
  const r = myReservationFor(s.id);
  const coaches = s.coaches || [];
  sheet.innerHTML = `<div class="sheet-body">
    <div class="row" style="justify-content:space-between"><h3>${esc(slotTitle(s))}</h3>${statusTag(r)}</div>
    <div class="muted cap">${fmtDay(s.start)} · ${fmtTime(s.start)} – ${fmtTime(s.end)}</div>
    ${fillBar(s)}
    <dl class="kv">
      ${coaches.length ? `<dt>Coach</dt><dd>${esc(coaches.map((c) => `${c.firstname} ${c.lastname ?? ''}`.trim()).join(', '))}</dd>` : ''}
      ${s.slotType && slotTitle(s) !== s.slotType.name ? `<dt>Type</dt><dd>${esc(s.slotType.name)}</dd>` : ''}
      ${r?.status === 'WAITING' && r.waitlistPosition ? `<dt>Attente</dt><dd>Position ${r.waitlistPosition}</dd>` : ''}
    </dl>
    ${r ? (r.status === 'WAITING' ? cancelInfo({ ...r, slot: s }) : cancelTimer({ ...r, slot: s })) : limitNote(s)}
    ${s.description ? `<div class="rich" style="margin-top:12px">${richText(s.description)}</div>` : ''}
    <div class="section-title" style="margin-top:18px">Inscrits · ${s.numberOfReservation ?? 0}/${s.listSize}</div>
    <div id="people" class="muted" style="font-size:14px">Chargement…</div>
    <div class="sheet-actions" id="sheet-actions">${sheetActions(s, r)}</div>
  </div>`;
  sheet.showModal();
  loadParticipants(s);
}

function sheetActions(s, r) {
  const main = slotAction(s, r).replace('class="btn ', 'class="btn block ');
  return `${main}<button class="btn block ghost" data-action="close" autofocus>Fermer</button>`;
}

async function loadParticipants(s) {
  const el = $('#people');
  try {
    const node = (await gql(Q.participants, { where: s.id })).getSlot;
    const people = (node?.reservation || []).filter((x) => x && x.user && x.status !== 'CANCELLED');
    if (!el.isConnected) return;
    const inList = people.filter((p) => p.status !== 'WAITING');
    const guests = Math.max(0, (s.numberOfReservation ?? 0) - inList.length);
    if (!people.length && !guests) { el.textContent = node ? 'Personne pour l\'instant.' : 'Liste non visible.'; return; }
    const me = state.user?.id;
    const chip = (p, extra = '') => `<span class="person ${p.user.id === me ? 'me' : ''}">${avatar(p.user)}${esc(cap(p.user.firstname?.trim()))} ${esc(p.user.lastname?.[0] ? `${p.user.lastname[0].toUpperCase()}.` : '')}${extra}</span>`;
    const waiting = people.filter((p) => p.status === 'WAITING')
      .sort((a, b) => (a.waitlistPosition ?? 1e9) - (b.waitlistPosition ?? 1e9));
    el.className = '';
    const guestChip = guests ? `<span class="person guest" title="Personnes extérieures : drop-in ou séance d'essai. Peppy ne montre pas leur nom aux membres."><span class="av">+${guests}</span>${guests > 1 ? 'invités' : 'invité'} · drop-in / essai</span>` : '';
    el.innerHTML = `<div class="people">${inList.map((p) => chip(p, p.status === 'VALIDATED' ? ' <em>✓</em>' : '')).join('')}${guestChip}</div>
      ${waiting.length ? `<div class="section-title">Liste d'attente · ${waiting.length}</div><ol class="waitlist">${waiting.map((p, i) => `<li><span class="pos">${p.waitlistPosition ?? i + 1}</span>${chip(p)}</li>`).join('')}</ol>` : ''}`;
  } catch {
    if (el.isConnected) el.textContent = 'Liste non visible pour les membres dans cette salle.';
  }
}

function lateCancelWarning(r) {
  const limit = params().slotNoPenaltyCancellationInterval;
  if (!r || !isBooked(r) || !limit) return '';
  const left = (new Date(r.slot.start) - Date.now()) / 60000;
  if (left >= limit) return `<p class="muted" style="font-size:13px">Annulation possible jusqu'à ${fmtTime(new Date(r.slot.start) - limit * 60000)}.</p>`;
  return `<p class="tag warn" style="display:inline-block;text-transform:none;font-size:13px;line-height:1.4">Moins de ${fmtDuration(limit)} avant le cours : ${lateRefused() ? 'ta salle risque de refuser l\'annulation' : 'elle sera comptée comme tardive'}.</p>`;
}

function askCancel(resId, slotId) {
  const r = state.upcoming.find((x) => x.id === resId);
  const s = r?.slot;
  sheet.innerHTML = `<div class="sheet-body">
    <h3>${r?.status === 'WAITING' ? 'Quitter la liste d\'attente ?' : 'Annuler la réservation ?'}</h3>
    ${s ? `<p class="muted cap">${esc(slotTitle(s))} · ${fmtDay(s.start)} à ${fmtTime(s.start)}</p>` : ''}
    ${lateCancelWarning(r)}
    <div class="sheet-actions">
      <button class="btn block danger ${state.pending.has(slotId) ? 'busy' : ''}" data-action="cancel" data-res="${resId}" data-slot="${slotId}">Oui, annuler</button>
      <button class="btn block ghost" data-action="close" autofocus>Non, garder</button>
    </div>
  </div>`;
  if (!sheet.open) sheet.showModal();
}

// ---------------------------------------------------------------- perfs : fiches, ajout, calcul
const findExercise = (id) => state.exercises?.find((e) => e.id === id);
const showSheet = (html) => { sheet.innerHTML = html; if (!sheet.open) sheet.showModal(); };

function openExercise(id) {
  const ex = findExercise(id);
  if (ex && state.perfs?.get(id)?.length) showSheet(viewExercise(ex, state.perfs.get(id), state.pctFav));
}

// Fiche d'un WOD : scores, puis description (chargée à part, une fois par WOD) pour le niveau choisi.
async function openWodScores(id, level) {
  const g = groupRankings(state.rankings).find((x) => x.workout.id === id);
  if (!g) return;
  const lvl = level || g.items[0].difficulty;
  showSheet(viewWodScores(g, state.workouts.get(id), lvl));
  if (state.workouts.has(id)) return;
  try {
    state.workouts.set(id, (await gql(Q.workout, { id })).getRestrictedWorkout || {});
  } catch {
    state.workouts.set(id, {});
  }
  if (sheet.open && sheet.querySelector(`[data-wod="${id}"]`)) showSheet(viewWodScores(g, state.workouts.get(id), lvl));
}

// Formulaire d'ajout : recherche libre parmi les mouvements et les WOD (les miens, puis l'API).
let lastResults = new Map();
function openAdd(kind, id) {
  state.addSel = null;
  if (kind === 'ex') { const e = findExercise(id); if (e) state.addSel = { kind, id, name: e.name, type: e.performanceType }; }
  if (kind === 'wod') { const g = groupRankings(state.rankings).find((x) => x.workout.id === id); if (g) state.addSel = { kind, id, name: g.workout.name, type: g.workout.performanceType }; }
  renderAdd();
}

function renderAdd() {
  showSheet(viewAdd(state.addSel));
  const input = $('#perf-search');
  if (input) { input.focus(); updateResults(''); } else sheet.querySelector('[autofocus]')?.focus();
}

let searchTimer;
function updateResults(q) {
  const el = $('#perf-results');
  if (!el) return;
  const nq = norm(q);
  const myEx = new Set([...(state.perfs || [])].filter(([, l]) => l.length).map(([id]) => id));
  const myWods = groupRankings(state.rankings).map((g) => g.workout);
  const show = (server = []) => {
    if (!nq) { el.innerHTML = viewResults([], ''); return; }
    const items = [
      ...(state.exercises || []).filter((e) => norm(e.name).includes(nq)).map((e) => ({ kind: 'ex', id: e.id, name: e.name, type: e.performanceType, mine: myEx.has(e.id) })),
      ...[...myWods, ...server].filter((w) => w.performanceType && norm(w.name).includes(nq)).map((w) => ({ kind: 'wod', id: w.id, name: w.name, type: w.performanceType, mine: myWods.some((m) => m.id === w.id) })),
    ];
    const seen = new Set();
    const uniq = items.filter((i) => !seen.has(i.kind + i.id) && seen.add(i.kind + i.id))
      // Déjà faits d'abord, puis ceux qui commencent par la recherche.
      .sort((a, b) => b.mine - a.mine || (norm(a.name).startsWith(nq) ? 0 : 1) - (norm(b.name).startsWith(nq) ? 0 : 1) || a.name.localeCompare(b.name))
      .slice(0, 10);
    lastResults = new Map(uniq.map((i) => [i.kind + i.id, i]));
    el.innerHTML = viewResults(uniq, nq);
  };
  show(state.wodSearch.get(nq));
  clearTimeout(searchTimer);
  if (nq.length >= 2 && !state.wodSearch.has(nq)) {
    searchTimer = setTimeout(async () => {
      try {
        state.wodSearch.set(nq, nodes((await gql(Q.searchWods, { w: { search: q.trim() } })).getRestrictedWorkouts));
        if (norm($('#perf-search')?.value) === nq) show(state.wodSearch.get(nq));
      } catch (e) { console.warn('recherche WOD', e); }
    }, 250);
  }
}

async function submitPerf(form) {
  const sel = state.addSel;
  // Entrée dans la recherche : on prend le premier résultat.
  if (!sel) { const first = lastResults.values().next().value; if (first) { state.addSel = first; renderAdd(); } return; }
  const f = new FormData(form);
  const value = sel.type === 'TIME'
    ? Number(f.get('min') || 0) * 60 + Number(f.get('sec') || 0)
    : Number(String(f.get('value') || '').replace(',', '.'));
  if (!(value > 0)) return toast('Indique une valeur.', true);
  const date = new Date(`${f.get('date')}T12:00`).toISOString();
  const btn = form.querySelector('[type=submit]');
  btn.classList.add('busy');
  try {
    if (sel.kind === 'ex') {
      const range = sel.type === 'WEIGHT' ? Number(f.get('rangeOther') || f.get('range') || 1) : undefined;
      await gql(Q.savePerf, { d: { exerciseId: sel.id, value, date, ...(range ? { range } : {}) } });
      if (state.perfs) {
        state.perfs.set(sel.id, perfList((await gql(Q.myPerfs, { id: sel.id })).getMyPerformances));
        rememberPerfExercises(state.perfs);
      }
    } else {
      const { createRanking } = await gql(Q.saveRanking, { w: sel.id, d: { performance: value, date, difficulty: f.get('level') || 'RX' } });
      state.rankings = [createRanking, ...(state.rankings || [])];
    }
    toast('Perf enregistrée ✓');
    render();
    if (sel.kind === 'ex') openExercise(sel.id); else openWodScores(sel.id);
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.classList.remove('busy');
  }
}

// Calcul des charges : base modifiable, préréglages, pourcentage libre, favoris retenus dans le navigateur.
function updateCalc() {
  const base = Number($('#calc-base')?.value) || 0;
  const out = $('#calc-out');
  if (out) out.innerHTML = calcGrid(base, state.pctFav);
  const pct = Number($('#calc-pct')?.value);
  const val = $('#calc-custom-val');
  if (val) val.textContent = base > 0 && pct > 0 ? `${roundKg((base * pct) / 100).toLocaleString('fr-FR')} kg` : '—';
}

function toggleFav(pct) {
  if (!(pct > 0)) return;
  state.pctFav.has(pct) ? state.pctFav.delete(pct) : state.pctFav.add(pct);
  store.set('peppy.pctFav', [...state.pctFav]);
  updateCalc();
}

// ---------------------------------------------------------------- render
function render() {
  const app = $('#app');
  if (!state.token) {
    if (!$('#login-form')) app.innerHTML = viewLogin();
    return;
  }
  const scroll = window.scrollY;
  const body = state.tab === 'resas' ? viewResas() : state.tab === 'perfs' ? viewPerfs(state) : state.tab === 'abo' ? viewAbo() : state.tab === 'stats' ? (state.stats === undefined ? '<div class="skeleton" style="height:140px;margin-top:16px"></div><div class="skeleton" style="height:220px;margin-top:10px"></div>' : viewStats(state.stats)) : viewPlanning();
  app.innerHTML = `${viewHeader()}<main class="wrap">${body}</main>${viewTabs()}`;
  window.scrollTo(0, scroll);
  // Garde les boutons de la feuille ouverte synchronisés (spinner).
  const acts = $('#sheet-actions');
  if (acts && sheet.open) {
    const id = sheet.querySelector('[data-slot]')?.dataset.slot;
    const s = findSlot(id);
    if (s) acts.innerHTML = sheetActions(s, myReservationFor(s.id));
  }
}

function setTab(tab) {
  state.tab = tab;
  history.replaceState(null, '', `#${tab}`);
  window.scrollTo(0, 0);
  render();
  if (tab === 'resas' && state.history == null) loadHistory().catch((e) => toast(e.message, true));
  if (tab === 'perfs') loadPerfs();
  if (tab === 'abo' && state.enrollments == null) loadEnrollments().catch((e) => toast(e.message, true));
  if (tab === 'stats' && state.stats === undefined) loadStats().catch((e) => { state.stats = null; toast(e.message, true); });
}

// Affiche le jour du cours dans le planning puis ouvre sa fiche.
async function gotoSlot(slotId, start) {
  if (state.tab !== 'planning') setTab('planning');
  state.day = startOfDay(start);
  if (startOfWeek(start).getTime() !== state.weekStart.getTime()) {
    state.weekStart = startOfWeek(start);
    await loadWeek();
  } else render();
  openSlot(slotId);
}

function goToDay(d) {
  state.day = startOfDay(d);
  const ws = startOfWeek(d);
  if (ws.getTime() !== state.weekStart.getTime()) {
    state.weekStart = ws;
    loadWeek();
  } else render();
}

// ---------------------------------------------------------------- events
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, slot, res } = el.dataset;
  if (el.tagName === 'SELECT') return;
  if (action !== 'open-slot' && action !== 'goto-slot') e.stopPropagation();
  switch (action) {
    case 'tab': return setTab(el.dataset.tab);
    case 'day': return goToDay(new Date(`${el.dataset.day}T00:00`));
    case 'week': return goToDay(addDays(state.weekStart, 7 * Number(el.dataset.dir)));
    case 'today': return goToDay(new Date());
    case 'open-ex': return openExercise(el.dataset.id);
    case 'open-wod': return openWodScores(el.dataset.id);
    case 'wod-level': return openWodScores(el.dataset.id, el.dataset.level);
    case 'add-perf': return openAdd(el.dataset.kind, el.dataset.id);
    case 'pick': state.addSel = lastResults.get(el.dataset.kind + el.dataset.id) || null; return renderAdd();
    case 'unpick': state.addSel = null; return renderAdd();
    case 'fav': return toggleFav(Number(el.dataset.pct));
    case 'fav-custom': return toggleFav(Number($('#calc-pct')?.value));
    case 'skip-sugg': {
      state.skipped.add(slot);
      // On ne garde que les créneaux encore à venir.
      store.set('peppy.skipped', [...state.skipped].filter((id) => state.nextSlots?.some((x) => x.id === id)));
      return render();
    }
    case 'only-free': state.onlyFree = !state.onlyFree; store.set('peppy.onlyFree', state.onlyFree); return render();
    case 'book': return book(slot);
    case 'ask-cancel': return askCancel(res, slot);
    case 'cancel': return cancel(res, slot);
    case 'confirm': return confirmPresence(res, slot);
    case 'open-slot': return openSlot(slot);
    case 'goto-slot': return gotoSlot(slot, new Date(el.dataset.start));
    case 'close': return closeSheet();
    case 'refresh': if (state.tab === 'perfs' && !perfsLoading) { state.perfs = null; state.rankings = undefined; } state.history = null; state.enrollments = null; state.stats = undefined; Promise.all([loadWeek({ silent: true }), loadNextSlots().catch(() => {})]).then(() => toast('À jour')); if (state.tab !== 'planning') setTab(state.tab); return;
    case 'logout': return logout();
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'perf-search') updateResults(e.target.value);
  if (e.target.id === 'calc-base' || e.target.id === 'calc-pct') updateCalc();
});

document.addEventListener('change', (e) => {
  if (e.target.dataset.action === 'box') {
    state.boxId = e.target.value;
    store.set('peppy.box', state.boxId);
    state.slotsWeek = null;
    state.nextSlots = null;
    loadWeek();
    loadNextSlots().catch(() => {});
  }
});

document.addEventListener('submit', async (e) => {
  if (e.target.id === 'perf-form') { e.preventDefault(); return submitPerf(e.target); }
  if (e.target.id !== 'login-form') return;
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type=submit]');
  const err = $('#login-error');
  btn.classList.add('busy'); btn.disabled = true; err.textContent = '';
  try {
    const { loginPeppy } = await gql(Q.login, { data: { email: form.email.value.trim(), password: form.password.value } });
    if (!loginPeppy?.accessToken) throw new Error('Connexion refusée');
    state.token = loginPeppy.accessToken;
    state.user = loginPeppy.user;
    store.set('peppy.token', state.token);
    store.set('peppy.user', state.user);
    $('#app').innerHTML = '';
    await boot();
  } catch (ex) {
    err.textContent = /^unauthori[sz]ed$|password|credential|not found|invalid/i.test(ex.message) ? 'Email ou mot de passe incorrect.' : ex.message;
  } finally {
    btn.classList.remove('busy'); btn.disabled = false;
  }
});

document.addEventListener('keydown', (e) => {
  if (!state.token || state.tab !== 'planning' || sheet.open || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.key === 'ArrowRight') goToDay(addDays(state.day, 1));
  if (e.key === 'ArrowLeft') goToDay(addDays(state.day, -1));
});

// Infobulles des graphiques (attribut data-tip).
const tip = document.createElement('div');
tip.id = 'tip';
document.body.append(tip);
document.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  const el = e.target.closest?.('[data-tip], .av:has(img)');
  // On garde le style « photo » pendant le fondu de sortie (sinon l'image s'affiche en taille réelle).
  if (!el) { tip.classList.remove('show'); return; }
  if (el.matches('.av')) {
    // Photo agrandie avec le nom (l'image est déjà en cache).
    const src = el.querySelector('img').src;
    if (tip.dataset.src !== src) {
      tip.dataset.src = src;
      tip.innerHTML = `<img src="${esc(src)}" alt=""><span>${esc(el.dataset.name.replace(/\s+/g, ' ').trim())}</span>`;
    }
    tip.classList.add('photo');
  } else {
    tip.textContent = el.dataset.tip;
    delete tip.dataset.src;
    tip.classList.remove('photo');
  }
  // La fiche est une modale (couche supérieure) : l'infobulle doit y vivre pour rester visible.
  const host = sheet.open ? sheet : document.body;
  if (tip.parentElement !== host) host.append(tip);
  tip.classList.add('show');
  const x = Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, e.clientX - tip.offsetWidth / 2));
  tip.style.transform = `translate(${x}px, ${Math.max(8, e.clientY - tip.offsetHeight - 14)}px)`;
});

// Rafraîchit les places quand on revient sur l'onglet, et toutes les 60 s.
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.token) { loadWeek({ silent: true }); loadNextSlots().catch(() => {}); } });

// Comptes à rebours d'annulation ; à l'échéance, on redessine pour basculer l'état.
setInterval(() => {
  let expired = false;
  document.querySelectorAll('[data-deadline]').forEach((el) => {
    const left = Number(el.dataset.deadline) - Date.now();
    if (left > 0) { el.textContent = fmtCountdown(left); return; }
    el.textContent = el.dataset.over;
    el.removeAttribute('data-deadline');
    expired = true;
  });
  if (expired) render();
}, 1000);
setInterval(() => { if (!document.hidden && state.token && state.tab === 'planning') loadWeek({ silent: true }); }, 60000);

// ---------------------------------------------------------------- boot
async function boot() {
  if (!state.token) return render();
  render();
  try {
    await loadBoxes();
    if (!state.boxId) { toast('Aucune salle trouvée sur ton compte.', true); return render(); }
    await loadWeek();
    loadNextSlots().catch((e) => console.warn('suggestions', e));
    if (state.tab !== 'planning') setTab(state.tab);
    if (state.enrollments == null) loadEnrollments().catch((e) => console.warn('enrollments', e));
  } catch (e) {
    if (state.token) toast(e.message, true);
  }
}
boot();
