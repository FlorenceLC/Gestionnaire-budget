/**
 * data.js — Gestion de l'état et des données
 * Structure JSON centralisée, aucun localStorage permanent
 */

const DEFAULT_DATA = {
  revenus: [],
  depenses_fixes: [],
  depenses_variables: [],
  abonnements: [],
  virements: [],          // { id, type: 'epargne'|'retrait'|'tiers', montant, date, destination?, beneficiaire?, frequence, commentaire }
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

// --- SETTINGS (localStorage avec obfuscation légère) ---
// Le token est stocké obfusqué (base64 inversé) — pas du vrai chiffrement,
// mais le token n'apparaît pas en clair dans les DevTools.
// L'utilisateur NE doit PAS mettre son token en dur dans le code.
const STORAGE_KEY = 'mb_cfg';

function _obfuscate(str) {
  try { return btoa(unescape(encodeURIComponent(str))).split('').reverse().join(''); }
  catch (e) { return str; }
}
function _deobfuscate(str) {
  try { return decodeURIComponent(escape(atob(str.split('').reverse().join('')))); }
  catch (e) { return str; }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    AppState.settings.githubToken = parsed.t ? _deobfuscate(parsed.t) : '';
    AppState.settings.gistId      = parsed.g ? _deobfuscate(parsed.g) : '';
  } catch (e) { /* ignore */ }
}

function saveSettings(token, gistId) {
  AppState.settings.githubToken = token;
  AppState.settings.gistId      = gistId;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      t: token  ? _obfuscate(token)  : '',
      g: gistId ? _obfuscate(gistId) : ''
    }));
  } catch (e) { /* ignore */ }
}

function clearSettings() {
  localStorage.removeItem(STORAGE_KEY);
  AppState.settings = { githubToken: '', gistId: '' };
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

// --- CALCULS VIREMENTS ---

function getVirementsMois(data, mois, annee) {
  return (data.virements || []).filter(v => {
    if (!v.date) return false;
    const d = new Date(v.date);
    return d.getMonth() === mois && d.getFullYear() === annee;
  });
}

// Virements récurrents mensuels (fréquence = mensuel) : toujours comptés
function getVirementsRecurrents(data) {
  return (data.virements || []).filter(v => v.frequence === 'mensuel');
}

// Total épargne versée ce mois (virements type epargne)
function getTotalEpargneMois(data, mois, annee) {
  const ponctuels = getVirementsMois(data, mois, annee).filter(v => v.type === 'epargne');
  const recurrents = getVirementsRecurrents(data).filter(v => v.type === 'epargne');
  // Éviter les doublons : si un récurrent a une date ce mois, il est dans ponctuels
  const recIds = new Set(ponctuels.map(v => v.id));
  const extraRec = recurrents.filter(v => !recIds.has(v.id));
  return [...ponctuels, ...extraRec].reduce((s, v) => s + parseFloat(v.montant || 0), 0);
}

// Total retraits ce mois
function getTotalRetraitMois(data, mois, annee) {
  return getVirementsMois(data, mois, annee)
    .filter(v => v.type === 'retrait')
    .reduce((s, v) => s + parseFloat(v.montant || 0), 0);
}

// Solde livret estimé (cumulé toute l'année en cours)
function getSoldeLivretAnnee(data, annee) {
  let solde = 0;
  for (let m = 0; m <= 11; m++) {
    const items = getVirementsMois(data, m, annee);
    items.forEach(v => {
      if (v.type === 'epargne') solde += parseFloat(v.montant || 0);
      if (v.type === 'retrait') solde -= parseFloat(v.montant || 0);
    });
  }
  // Ajouter les récurrents sans date précise (comptés chaque mois jusqu'au mois courant)
  const now = new Date();
  const currentM = annee === now.getFullYear() ? now.getMonth() : 11;
  getVirementsRecurrents(data).forEach(v => {
    // Vérifier qu'ils n'ont pas déjà de date dans l'année (sinon double compte)
    const hasDateInYear = (data.virements || []).some(
      u => u.id === v.id && u.date && new Date(u.date).getFullYear() === annee
    );
    if (!hasDateInYear) {
      const months = currentM + 1;
      const montant = parseFloat(v.montant || 0) * months;
      if (v.type === 'epargne') solde += montant;
      if (v.type === 'retrait') solde -= montant;
    }
  });
  return Math.max(0, solde);
}

// --- VALIDATION ---
function validateMontant(val) {
  const n = parseFloat(val);
  return !isNaN(n) && n > 0 && n < 1_000_000;
}

function validateNom(val) {
  return val && val.trim().length >= 1 && val.trim().length <= 100;
}

// --- EXPORT JSON (pour backup manuel) ---
function exportJSON() {
  const blob = new Blob([JSON.stringify(AppState.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `monbudget-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- IMPORT JSON ---
function importJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.revenus || !data.depenses_fixes) throw new Error('Format invalide');
    return data;
  } catch (e) {
    throw new Error('Fichier JSON invalide : ' + e.message);
  }
}

// Cat icon map
const CAT_ICONS = {
  Courses: 'fa-basket-shopping', Essence: 'fa-gas-pump', Restaurant: 'fa-utensils',
  Loisirs: 'fa-gamepad', Shopping: 'fa-bag-shopping', Santé: 'fa-heart-pulse',
  Vacances: 'fa-plane', Cadeaux: 'fa-gift', Famille: 'fa-people-roof', Divers: 'fa-ellipsis',
  logement: 'fa-house', energie: 'fa-bolt', transports: 'fa-car',
  assurances: 'fa-shield-halved', sante: 'fa-heart-pulse', education: 'fa-graduation-cap',
  famille: 'fa-people-roof', autre: 'fa-ellipsis'
};

const CAT_LABELS = {
  logement: 'Logement', energie: 'Énergie', transports: 'Transports',
  assurances: 'Assurances', sante: 'Santé', education: 'Éducation',
  famille: 'Famille', autre: 'Autre'
};

const VTYPE_LABELS = {
  epargne: 'Épargne', retrait: 'Retrait', tiers: 'Tiers'
};
const VTYPE_ICONS = {
  epargne: 'fa-piggy-bank', retrait: 'fa-hand-holding-dollar', tiers: 'fa-people-roof'
};
