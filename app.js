/**
 * app.js — Point d'entrée, gestion des événements
 */

document.addEventListener('DOMContentLoaded', () => {
  init();
});

function init() {
  loadSettings();
  setupNavigation();
  setupMobileNav();
  setupSidebar();
  setupModals();
  setupForms();
  setupMonthNav();
  setupCategoryFilter();
  setupStats();
  setupParams();
  setupCouple();
  setupSync();

  // Render initial
  navigateTo('dashboard');

  // Charger depuis le Gist au démarrage si configuré
  if (AppState.settings.githubToken && AppState.settings.gistId) {
    autoLoadFromGist();
  }

  // PWA install
  setupPWA();
}

// ===== NAVIGATION =====
function setupNavigation() {
  document.querySelectorAll('[data-section]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(el.dataset.section);
    });
  });
}

// ===== MOBILE NAV =====
function setupMobileNav() {
  document.getElementById('hamburger').addEventListener('click', () => {
    const overlay = document.getElementById('mobileNavOverlay');
    overlay.classList.contains('open') ? closeMobileNav() : openMobileNav();
  });
  document.getElementById('mobileNavOverlay').addEventListener('click', e => {
    if (!e.target.closest('.mobile-nav')) closeMobileNav();
  });
}

// ===== SIDEBAR TOGGLE (desktop) =====
function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.getElementById('main');
  const btn     = document.getElementById('sidebarToggle');
  btn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('sidebar-collapsed');
  });
}

// ===== MODALS =====
function setupModals() {
  // Fermer via bouton X ou annuler
  document.querySelectorAll('.modal-close, [data-modal]').forEach(el => {
    el.addEventListener('click', () => closeModal(el.dataset.modal || el.closest('.modal-overlay')?.id));
  });
  // Fermer en cliquant l'overlay
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
  // Confirm delete
  document.getElementById('confirmDelete').addEventListener('click', () => {
    if (AppState.ui.deleteCallback) AppState.ui.deleteCallback();
  });
  // Toggle visibilité token
  document.getElementById('toggleTokenVis').addEventListener('click', () => {
    const inp = document.getElementById('githubToken');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    document.querySelector('#toggleTokenVis i').className =
      `fa-solid fa-eye${inp.type === 'password' ? '' : '-slash'}`;
  });
}

// ===== MONTH NAVIGATION =====
function setupMonthNav() {
  document.getElementById('prevMonth').addEventListener('click', () => {
    let { currentMonth: m, currentYear: y } = AppState.ui;
    m--; if (m < 0) { m = 11; y--; }
    AppState.ui.currentMonth = m;
    AppState.ui.currentYear = y;
    renderDashboard();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    let { currentMonth: m, currentYear: y } = AppState.ui;
    m++; if (m > 11) { m = 0; y++; }
    AppState.ui.currentMonth = m;
    AppState.ui.currentYear = y;
    renderDashboard();
  });
}

// ===== CATEGORY FILTER =====
function setupCategoryFilter() {
  document.getElementById('categoryFilter').addEventListener('click', e => {
    const btn = e.target.closest('.cat-filter-btn');
    if (btn) {
      AppState.ui.catFilter = btn.dataset.cat;
      renderVariables();
    }
  });
}

// ===== STATS PERIOD =====
function setupStats() {
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.ui.statsPeriod = parseInt(btn.dataset.months);
      renderStats();
    });
  });
}

// ===== FORMS =====
function setupForms() {
  // --- Revenus ---
  document.getElementById('addRevenuBtn').addEventListener('click', () => {
    AppState.ui.editingId = null;
    document.getElementById('modalRevenuTitle').textContent = 'Ajouter un revenu';
    clearForm('revenu');
    document.getElementById('revenuDate').value = today();
    openModal('modalRevenu');
  });

  document.getElementById('saveRevenu').addEventListener('click', () => {
    const nom = document.getElementById('revenuNom').value.trim();
    const montant = parseFloat(document.getElementById('revenuMontant').value);
    if (!nom || isNaN(montant) || montant <= 0) { showToast('Remplissez le nom et le montant', 'error'); return; }

    const obj = {
      nom,
      montant,
      date: document.getElementById('revenuDate').value,
      frequence: document.getElementById('revenuFrequence').value,
      personne: document.getElementById('revenuPersonne').value
    };

    if (AppState.ui.editingId) {
      updateItem('revenus', AppState.ui.editingId, obj);
      showToast('Revenu modifié', 'success');
    } else {
      addItem('revenus', obj);
      showToast('Revenu ajouté', 'success');
    }
    closeModal('modalRevenu');
    scheduleSync();
    renderRevenus();
    renderDashboard();
  });

  // --- Dépenses fixes ---
  document.getElementById('addFixeBtn').addEventListener('click', () => {
    AppState.ui.editingId = null;
    document.getElementById('modalFixeTitle').textContent = 'Ajouter une charge';
    clearForm('fixe');
    openModal('modalFixe');
  });

  document.getElementById('saveFixe').addEventListener('click', () => {
    const nom = document.getElementById('fixeNom').value.trim();
    const montant = parseFloat(document.getElementById('fixeMontant').value);
    if (!nom || isNaN(montant) || montant <= 0) { showToast('Remplissez le nom et le montant', 'error'); return; }

    const obj = {
      nom, montant,
      categorie: document.getElementById('fixeCategorie').value,
      frequence: document.getElementById('fixeFrequence').value
    };

    if (AppState.ui.editingId) {
      updateItem('depenses_fixes', AppState.ui.editingId, obj);
      showToast('Charge modifiée', 'success');
    } else {
      addItem('depenses_fixes', obj);
      showToast('Charge ajoutée', 'success');
    }
    closeModal('modalFixe');
    scheduleSync();
    renderFixes();
    renderDashboard();
  });

  // --- Dépenses variables ---
  document.getElementById('addVariableBtn').addEventListener('click', () => {
    AppState.ui.editingId = null;
    document.getElementById('modalVariableTitle').textContent = 'Ajouter une dépense';
    clearForm('variable');
    document.getElementById('variableDate').value = today();
    // Reset cat picker
    document.querySelectorAll('.cat-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    openModal('modalVariable');
  });

  // Cat picker selection
  document.getElementById('catPicker').addEventListener('click', e => {
    const btn = e.target.closest('.cat-btn');
    if (btn) {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  });

  document.getElementById('saveVariable').addEventListener('click', () => {
    const montant = parseFloat(document.getElementById('variableMontant').value);
    const activeCat = document.querySelector('.cat-btn.active');
    if (isNaN(montant) || montant <= 0) { showToast('Entrez un montant valide', 'error'); return; }

    const obj = {
      montant,
      categorie: activeCat?.dataset.cat || 'Divers',
      date: document.getElementById('variableDate').value || today(),
      commentaire: document.getElementById('variableComment').value.trim(),
      personne: document.getElementById('variablePersonne').value
    };

    if (AppState.ui.editingId) {
      updateItem('depenses_variables', AppState.ui.editingId, obj);
      showToast('Dépense modifiée', 'success');
    } else {
      addItem('depenses_variables', obj);
      showToast('Dépense ajoutée', 'success');
    }
    closeModal('modalVariable');
    scheduleSync();
    AppState.ui.catFilter = 'all';
    renderVariables();
    renderDashboard();
  });

  // --- Abonnements ---
  document.getElementById('addAbonnementBtn').addEventListener('click', () => {
    AppState.ui.editingId = null;
    document.getElementById('modalAbonnementTitle').textContent = 'Ajouter un abonnement';
    clearForm('abonnement');
    document.getElementById('aboActif').checked = true;
    openModal('modalAbonnement');
  });

  document.getElementById('saveAbonnement').addEventListener('click', () => {
    const nom = document.getElementById('aboNom').value.trim();
    const montant = parseFloat(document.getElementById('aboMontant').value);
    if (!nom || isNaN(montant) || montant <= 0) { showToast('Remplissez le nom et le montant', 'error'); return; }

    const obj = {
      nom, montant,
      frequence: document.getElementById('aboFrequence').value,
      actif: document.getElementById('aboActif').checked
    };

    if (AppState.ui.editingId) {
      updateItem('abonnements', AppState.ui.editingId, obj);
      showToast('Abonnement modifié', 'success');
    } else {
      addItem('abonnements', obj);
      showToast('Abonnement ajouté', 'success');
    }
    closeModal('modalAbonnement');
    scheduleSync();
    renderAbonnements();
    renderDashboard();
  });
}

// ===== COUPLE =====
function setupCouple() {
  document.getElementById('coupleToggle').addEventListener('change', e => {
    AppState.data.couple = AppState.data.couple || {};
    AppState.data.couple.active = e.target.checked;
    document.getElementById('coupleContent').classList.toggle('hidden', !e.target.checked);
    scheduleSync();
    renderCouple();
  });

  document.getElementById('saveCouple').addEventListener('click', () => {
    const p1 = document.getElementById('inputP1Name').value.trim() || 'Personne 1';
    const p2 = document.getElementById('inputP2Name').value.trim() || 'Personne 2';
    AppState.data.couple.personne1 = { ...AppState.data.couple.personne1, nom: p1 };
    AppState.data.couple.personne2 = { ...AppState.data.couple.personne2, nom: p2 };
    scheduleSync();
    showToast('Configuration couple sauvegardée', 'success');
    renderCouple();
  });

  document.querySelectorAll('.btn-repartition').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-repartition').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.data.couple.repartition = btn.dataset.mode;
      scheduleSync();
    });
  });
}

// ===== PARAMS =====
function setupParams() {
  document.getElementById('saveSettings').addEventListener('click', () => {
    const token = document.getElementById('githubToken').value.trim();
    const gistId = document.getElementById('gistId').value.trim();
    saveSettings(token, gistId);
    showToast('Paramètres sauvegardés', 'success');
  });

  document.getElementById('testConnection').addEventListener('click', async () => {
    const token = document.getElementById('githubToken').value.trim();
    saveSettings(token, AppState.settings.gistId);
    const status = document.getElementById('connectionStatus');
    status.textContent = 'Test en cours…';
    status.className = 'connection-status';
    status.style.display = 'block';
    try {
      const login = await testConnection();
      status.textContent = `✓ Connecté en tant que @${login}`;
      status.className = 'connection-status ok';
    } catch (e) {
      status.textContent = `✗ Échec : ${e.message}`;
      status.className = 'connection-status error';
    }
  });

  document.getElementById('syncNow').addEventListener('click', async () => {
    const token = document.getElementById('githubToken').value.trim();
    const gistId = document.getElementById('gistId').value.trim();
    saveSettings(token, gistId);
    await doSync();
  });

  document.getElementById('fetchFromGist').addEventListener('click', async () => {
    const token = document.getElementById('githubToken').value.trim();
    const gistId = document.getElementById('gistId').value.trim();
    saveSettings(token, gistId);
    if (!confirm('Récupérer les données depuis le Gist ? Les données actuelles seront remplacées.')) return;
    await doFetchFromGist();
  });

  document.getElementById('resetData').addEventListener('click', () => {
    if (!confirm('Effacer toutes les données locales ? Cette action est irréversible.')) return;
    AppState.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    showToast('Données effacées', 'success');
    navigateTo('dashboard');
  });
}

// ===== SYNC =====
function setupSync() {
  const doSyncAll = () => doSync();
  document.getElementById('syncBtn').addEventListener('click', doSyncAll);
  document.getElementById('syncMobile').addEventListener('click', doSyncAll);
}

async function doSync() {
  if (!AppState.settings.githubToken) {
    showToast('Configurez votre Token GitHub dans les paramètres', 'error');
    navigateTo('parametres');
    return;
  }
  const btn = document.getElementById('syncBtn');
  btn.classList.add('syncing');
  try {
    await saveToGist(AppState.data);
    showToast('Synchronisation réussie', 'success');
    updateLastSync();
    const gistIdEl = document.getElementById('gistId');
    if (gistIdEl && AppState.settings.gistId) gistIdEl.value = AppState.settings.gistId;
  } catch (e) {
    showToast(`Erreur : ${e.message}`, 'error');
  } finally {
    btn.classList.remove('syncing');
  }
}

async function doFetchFromGist() {
  if (!AppState.settings.githubToken || !AppState.settings.gistId) {
    showToast('Configurez Token et ID Gist d\'abord', 'error');
    return;
  }
  try {
    const data = await loadFromGist();
    // Fusionner avec la structure par défaut pour la robustesse
    AppState.data = { ...JSON.parse(JSON.stringify(DEFAULT_DATA)), ...data };
    showToast('Données récupérées depuis le Gist', 'success');
    updateLastSync();
    navigateTo('dashboard');
  } catch (e) {
    showToast(`Erreur : ${e.message}`, 'error');
  }
}

async function autoLoadFromGist() {
  try {
    const data = await loadFromGist();
    AppState.data = { ...JSON.parse(JSON.stringify(DEFAULT_DATA)), ...data };
    updateLastSync();
    renderDashboard();
  } catch (e) {
    // Silencieux au démarrage
  }
}

// ===== CLEAR FORMS =====
function clearForm(type) {
  const fields = {
    revenu: ['revenuNom', 'revenuMontant', 'revenuDate', 'revenuFrequence', 'revenuPersonne'],
    fixe: ['fixeNom', 'fixeMontant', 'fixeCategorie', 'fixeFrequence'],
    variable: ['variableMontant', 'variableDate', 'variableComment', 'variablePersonne'],
    abonnement: ['aboNom', 'aboMontant', 'aboFrequence']
  };
  (fields[type] || []).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = el.tagName === 'SELECT' ? el.options[0]?.value : '';
  });
}

// ===== PWA =====
function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
  });
}
