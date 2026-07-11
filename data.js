/**
 * data.js — Gestion de l'état et des données
 * Structure JSON centralisée, aucun localStorage permanent
 */

const DEFAULT_DATA = {
  revenus: [],
  depenses_fixes: [],
  depenses_variables: [],
  abonnements: [],
  couple: {
    active: false,
    personne1: { nom: 'Personne 1' },
    personne2: { nom: 'Personne 2' },
    repartition: '50-50'
  },
  meta: {
    version: 1,
    lastSync: null
  }
};

// État global de l'application (en mémoire)
let AppState = {
  data: JSON.parse(JSON.stringify(DEFAULT_DATA)),
  settings: {
    githubToken: '',
    gistId: ''
  },
  ui: {
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    editingId: null,
    editingType: null,
    deleteCallback: null,
    statsPeriod: 3,
    catFilter: 'all'
  }
};

// --- SETTINGS (session uniquement via sessionStorage pour sécurité) ---
function loadSettings() {
  try {
    const raw = sessionStorage.getItem('monbudget_settings');
    if (raw) {
      const s = JSON.parse(raw);
      AppState.settings = { ...AppState.settings, ...s };
    }
  } catch (e) { /* ignore */ }
}

function saveSettings(token, gistId) {
  AppState.settings.githubToken = token;
  AppState.settings.gistId = gistId;
  try {
    sessionStorage.setItem('monbudget_settings', JSON.stringify(AppState.settings));
  } catch (e) { /* ignore */ }
}

// --- HELPERS ID ---
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// --- CALCULS FINANCIERS ---
function getRevenusMensuels(data, mois, annee) {
  return data.revenus
    .filter(r => {
      if (r.frequence === 'mensuel') return true;
      if (r.frequence === 'ponctuel' && r.date) {
        const d = new Date(r.date);
        return d.getMonth() === mois && d.getFullYear() === annee;
      }
      return false;
    })
    .reduce((sum, r) => sum + parseFloat(r.montant || 0), 0);
}

function getDepensesFixes(data) {
  return data.depenses_fixes.reduce((sum, d) => {
    const m = parseFloat(d.montant || 0);
    if (d.frequence === 'annuel') return sum + m / 12;
    if (d.frequence === 'trimestriel') return sum + m / 3;
    return sum + m;
  }, 0);
}

function getAbonnementsMensuels(data) {
  return data.abonnements
    .filter(a => a.actif !== false)
    .reduce((sum, a) => {
      const m = parseFloat(a.montant || 0);
      return sum + (a.frequence === 'annuel' ? m / 12 : m);
    }, 0);
}

function getDepensesVariablesMois(data, mois, annee) {
  return data.depenses_variables
    .filter(d => {
      const dt = new Date(d.date);
      return dt.getMonth() === mois && dt.getFullYear() === annee;
    })
    .reduce((sum, d) => sum + parseFloat(d.montant || 0), 0);
}

function getResteAVivre(data, mois, annee) {
  const rev = getRevenusMensuels(data, mois, annee);
  const fixes = getDepensesFixes(data);
  const abos = getAbonnementsMensuels(data);
  const variables = getDepensesVariablesMois(data, mois, annee);
  return rev - fixes - abos - variables;
}

function getJoursRestantsMois(mois, annee) {
  const now = new Date();
  const fin = new Date(annee, mois + 1, 0);
  if (now.getMonth() === mois && now.getFullYear() === annee) {
    return Math.max(1, fin.getDate() - now.getDate() + 1);
  }
  return fin.getDate();
}

function getDaysInMonth(mois, annee) {
  return new Date(annee, mois + 1, 0).getDate();
}

// Données couple
function getCoupleStats(data, mois, annee) {
  const isCouple = data.couple?.active;
  const p1Rev = isCouple
    ? data.revenus.filter(r => r.personne === 'personne1')
        .filter(r => r.frequence === 'mensuel' || (r.date && new Date(r.date).getMonth() === mois))
        .reduce((s, r) => s + parseFloat(r.montant || 0), 0)
    : 0;
  const p2Rev = isCouple
    ? data.revenus.filter(r => r.personne === 'personne2')
        .filter(r => r.frequence === 'mensuel' || (r.date && new Date(r.date).getMonth() === mois))
        .reduce((s, r) => s + parseFloat(r.montant || 0), 0)
    : 0;
  const p1Dep = isCouple
    ? data.depenses_variables.filter(d => d.personne === 'personne1' && new Date(d.date).getMonth() === mois).reduce((s, d) => s + parseFloat(d.montant || 0), 0)
    : 0;
  const p2Dep = isCouple
    ? data.depenses_variables.filter(d => d.personne === 'personne2' && new Date(d.date).getMonth() === mois).reduce((s, d) => s + parseFloat(d.montant || 0), 0)
    : 0;
  return { p1Rev, p2Rev, p1Dep, p2Dep };
}

// Historique mensuel (N derniers mois)
function getHistoriqueN(data, n) {
  const result = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth(), y = d.getFullYear();
    result.push({
      label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      mois: m, annee: y,
      revenus:   getRevenusMensuels(data, m, y),
      fixes:     getDepensesFixes(data),
      abos:      getAbonnementsMensuels(data),
      variables: getDepensesVariablesMois(data, m, y),
      get depenses() { return this.fixes + this.abos + this.variables; },
      get reste()    { return this.revenus - this.depenses; }
    });
  }
  return result;
}

// Dépenses par catégorie (mois courant)
function getDepensesParCategorie(data, mois, annee) {
  const map = {};
  data.depenses_variables
    .filter(d => { const dt = new Date(d.date); return dt.getMonth() === mois && dt.getFullYear() === annee; })
    .forEach(d => {
      map[d.categorie] = (map[d.categorie] || 0) + parseFloat(d.montant || 0);
    });
  return map;
}

// --- CRUD HELPERS ---
function addItem(type, item) {
  item.id = genId();
  AppState.data[type].push(item);
}

function updateItem(type, id, updates) {
  const idx = AppState.data[type].findIndex(i => i.id === id);
  if (idx !== -1) AppState.data[type][idx] = { ...AppState.data[type][idx], ...updates };
}

function deleteItem(type, id) {
  AppState.data[type] = AppState.data[type].filter(i => i.id !== id);
}

function getItem(type, id) {
  return AppState.data[type].find(i => i.id === id);
}

// --- FORMAT ---
function formatMoney(n) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' €';
}

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Cat icon map
const CAT_ICONS = {
  Courses: 'fa-basket-shopping', Essence: 'fa-gas-pump', Restaurant: 'fa-utensils',
  Loisirs: 'fa-gamepad', Shopping: 'fa-bag-shopping', Santé: 'fa-heart-pulse',
  Vacances: 'fa-plane', Cadeaux: 'fa-gift', Divers: 'fa-ellipsis',
  logement: 'fa-house', energie: 'fa-bolt', transports: 'fa-car',
  assurances: 'fa-shield-halved', sante: 'fa-heart-pulse', education: 'fa-graduation-cap', autre: 'fa-ellipsis'
};

const CAT_LABELS = {
  logement: 'Logement', energie: 'Énergie', transports: 'Transports',
  assurances: 'Assurances', sante: 'Santé', education: 'Éducation', autre: 'Autre'
};
