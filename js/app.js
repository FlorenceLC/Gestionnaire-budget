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
  setupVirementFilter();
  setupStats();
  setupParams();
  setupCouple();
  setupSync();

  // Render initial — support du hash URL (raccourcis PWA)
  const hashSection = window.location.hash.replace('#', '') || 'dashboard';
  const validSections = ['dashboard','revenus','depenses-fixes','depenses-variables','abonnements','couple','statistiques','parametres'];
  navigateTo(validSections.includes(hashSection) ? hashSection : 'dashboard');

  // Charger depuis le Gist au démarrage si configuré
  if (AppState.settings.githubToken && AppState.settings.gistId) {
    autoLoadFromGist();
  }

  // PWA install
  setupPWA();
}

// ===== NAVIGATION =====
function setupNavigation() {
  // Délégation globale : capture les nav-items statiques ET les btn-link dynamiques
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-section]');
    if (el) {
      e.preventDefault();
      navigateTo(el.dataset.section);
    }
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


// ===== VIREMENT FILTER =====
function setupVirementFilter() {
  document.getElementById('virementFilter').addEventListener('click', e => {
    const btn = e.target.closest('.cat-filter-btn');
    if (btn) {
      AppState.ui.virementFilter = btn.dataset.vtype;
      renderVirements();
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
    if (!validateNom(nom)) { showToast('Entrez un nom valide', 'error'); document.getElementById('revenuNom').focus(); return; }
    if (!validateMontant(montant)) { showToast('Entrez un montant valide (> 0)', 'error'); document.getElementById('revenuMontant').focus(); return; }

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
    if (!validateNom(nom)) { showToast('Entrez un nom valide', 'error'); document.getElementById('fixeNom').focus(); return; }
    if (!validateMontant(montant)) { showToast('Entrez un montant valide (> 0)', 'error'); document.getElementById('fixeMontant').focus(); return; }

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
    if (!validateMontant(montant)) { showToast('Entrez un montant valide (> 0)', 'error'); document.getElementById('variableMontant').focus(); return; }

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
    if (!validateNom(nom)) { showToast('Entrez un nom valide', 'error'); document.getElementById('aboNom').focus(); return; }
    if (!validateMontant(montant)) { showToast('Entrez un montant valide (> 0)', 'error'); document.getElementById('aboMontant').focus(); return; }

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

  // Effacer les identifiants GitHub
  document.getElementById('clearCredentials').addEventListener('click', () => {
    if (!confirm('Effacer le token et l\'ID Gist sauvegardés sur cet appareil ?')) return;
    clearSettings();
    document.getElementById('githubToken').value = '';
    document.getElementById('gistId').value = '';
    const status = document.getElementById('connectionStatus');
    status.textContent = 'Identifiants effacés.';
    status.className = 'connection-status ok';
    showToast('Identifiants effacés', 'success');
  });

  // Vider le cache Service Worker et recharger
  document.getElementById('clearCache').addEventListener('click', async () => {
    if (!confirm('Vider le cache et recharger l\'application ?')) return;
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.unregister();
    }
    showToast('Cache vidé — rechargement…', 'success');
    setTimeout(() => window.location.reload(true), 800);
  });

  // Export JSON
  document.getElementById('exportJSON').addEventListener('click', () => {
    exportJSON();
    showToast('Export téléchargé', 'success');
  });

  // Import JSON
  document.getElementById('importJSON').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = importJSON(text);
      if (!confirm('Remplacer toutes les données actuelles par ce fichier ?')) return;
      AppState.data = deepMergeData(JSON.parse(JSON.stringify(DEFAULT_DATA)), data);
      showToast('Données importées avec succès', 'success');
      navigateTo('dashboard');
    } catch (err) {
      showToast(err.message, 'error');
    }
    e.target.value = '';
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
    AppState.data = deepMergeData(JSON.parse(JSON.stringify(DEFAULT_DATA)), data);
    showToast('Données récupérées depuis le Gist', 'success');
    updateLastSync();
    navigateTo('dashboard');
  } catch (e) {
    showToast(`Erreur : ${e.message}`, 'error');
  }
}

async function autoLoadFromGist() {
  // Afficher un indicateur discret
  const syncBtn = document.getElementById('syncBtn');
  const syncMobile = document.getElementById('syncMobile');
  syncBtn?.classList.add('syncing');
  syncMobile?.classList.add('syncing');
  try {
    const data = await loadFromGist();
    // Fusion sécurisée avec les valeurs par défaut
    AppState.data = deepMergeData(JSON.parse(JSON.stringify(DEFAULT_DATA)), data);
    updateLastSync();
    renderDashboard();
    showToast('Données chargées depuis le Gist', 'success');
  } catch (e) {
    // Silencieux au démarrage si le Gist est vide ou inaccessible
    console.warn('[MonBudget] Auto-sync au démarrage échoué :', e.message);
  } finally {
    syncBtn?.classList.remove('syncing');
    syncMobile?.classList.remove('syncing');
  }
}

// Fusion profonde pour préserver les tableaux
function deepMergeData(defaults, remote) {
  const result = { ...defaults };
  for (const key of Object.keys(remote)) {
    if (Array.isArray(remote[key])) {
      result[key] = remote[key];
    } else if (remote[key] && typeof remote[key] === 'object') {
      result[key] = { ...(defaults[key] || {}), ...remote[key] };
    } else if (remote[key] !== undefined) {
      result[key] = remote[key];
    }
  }
  return result;
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
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => {
        console.log('[MonBudget] SW enregistré, scope :', reg.scope);

        // Détecter une mise à jour disponible
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Un nouveau SW est prêt — proposer de recharger
              showUpdateBanner();
            }
          });
        });
      })
      .catch(err => console.warn('[MonBudget] SW non enregistré :', err));

    // Écouter les messages du SW (notification de mise à jour)
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'SW_UPDATED') {
        showUpdateBanner();
      }
    });
  }

  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

function showUpdateBanner() {
  // Éviter d'afficher deux fois
  if (document.getElementById('updateBanner')) return;
  const banner = document.createElement('div');
  banner.id = 'updateBanner';
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 999;
    background: var(--green); color: #fff;
    padding: 0.75rem 1rem;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 0.875rem; font-weight: 600;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  `;
  banner.innerHTML = `
    <span><i class="fa-solid fa-circle-up" style="margin-right:0.5rem"></i>Une mise à jour est disponible !</span>
    <button onclick="window.location.reload(true)" style="
      background: rgba(255,255,255,0.25); border: none; color: #fff;
      padding: 0.35rem 0.9rem; border-radius: 6px; font-weight: 700;
      cursor: pointer; font-size: 0.8rem;
    ">Recharger</button>
  `;
  document.body.prepend(banner);
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', e => {
  // Escape : fermer la modal ouverte
  if (e.key === 'Escape') {
    const open = document.querySelector('.modal-overlay.open');
    if (open) { closeModal(open.id); return; }
    // Fermer le menu mobile
    if (document.getElementById('mobileNavOverlay').classList.contains('open')) {
      closeMobileNav();
    }
  }
  // Ctrl/Cmd+S : synchroniser
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    doSync();
  }
  // N : nouvelle dépense rapide (si aucun input actif)
  if (e.key === 'n' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
    const activeSection = document.querySelector('.section.active')?.id;
    if (activeSection === 'section-depenses-variables') {
      document.getElementById('addVariableBtn')?.click();
    } else if (activeSection === 'section-revenus') {
      document.getElementById('addRevenuBtn')?.click();
    }
  }
});

// ===== INDICATEUR SYNC =====
let pendingSync = false;
const _origScheduleSync = scheduleSync;
// Wrapper pour indiquer les données non sauvegardées
function markDirty() {
  pendingSync = true;
  document.title = '• MonBudget';
}
function markClean() {
  pendingSync = false;
  document.title = 'MonBudget';
}

// Avertir si fermeture avec données non syncées
window.addEventListener('beforeunload', e => {
  if (pendingSync && AppState.settings.githubToken) {
    e.preventDefault();
    e.returnValue = 'Des données ne sont pas encore synchronisées. Quitter ?';
  }
});

// ===== QUICK-ADD DEPUIS LE DASHBOARD =====
// Bouton flottant rapide sur mobile (ajout dépense en 1 tap)
function injectFAB() {
  if (document.getElementById('fab')) return;
  const fab = document.createElement('button');
  fab.id = 'fab';
  fab.title = 'Ajouter une dépense';
  fab.innerHTML = '<i class="fa-solid fa-plus"></i>';
  fab.style.cssText = `
    position:fixed; bottom:1.5rem; right:1.5rem; z-index:90;
    width:56px; height:56px; border-radius:50%;
    background:var(--green); color:#fff; font-size:1.4rem;
    box-shadow:0 4px 20px rgba(16,185,129,0.4);
    display:flex; align-items:center; justify-content:center;
    border:none; cursor:pointer;
    transition:transform 0.2s, box-shadow 0.2s;
  `;
  fab.addEventListener('click', () => {
    // Naviguer vers dépenses variables et ouvrir le modal
    navigateTo('depenses-variables');
    setTimeout(() => document.getElementById('addVariableBtn')?.click(), 100);
  });
  fab.addEventListener('mouseenter', () => {
    fab.style.transform = 'scale(1.1)';
    fab.style.boxShadow = '0 6px 24px rgba(16,185,129,0.5)';
  });
  fab.addEventListener('mouseleave', () => {
    fab.style.transform = 'scale(1)';
    fab.style.boxShadow = '0 4px 20px rgba(16,185,129,0.4)';
  });
  document.body.appendChild(fab);
}

// Injecter le FAB au démarrage
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(injectFAB, 500);
});

// ===== VIREMENTS FORM =====
function setupVirementsForm() {
  // Bouton ajouter
  document.getElementById('addVirementBtn').addEventListener('click', () => {
    AppState.ui.editingId = null;
    document.getElementById('modalVirementTitle').textContent = 'Ajouter un virement';
    // Reset
    document.querySelectorAll('.vtype-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    updateVirementFormFields('epargne');
    document.getElementById('virementMontant').value = '';
    document.getElementById('virementDate').value = today();
    document.getElementById('virementFrequence').value = 'ponctuel';
    document.getElementById('virementComment').value = '';
    document.getElementById('virementBeneficiaire').value = '';
    document.getElementById('virementDestination').value = 'livret-a';
    openModal('modalVirement');
  });

  // Type picker
  document.getElementById('virementTypePicker').addEventListener('click', e => {
    const btn = e.target.closest('.vtype-btn');
    if (btn) {
      document.querySelectorAll('.vtype-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateVirementFormFields(btn.dataset.vtype);
    }
  });

  // Sauvegarder
  document.getElementById('saveVirement').addEventListener('click', () => {
    const montant = parseFloat(document.getElementById('virementMontant').value);
    const activeType = document.querySelector('.vtype-btn.active');
    const type = activeType?.dataset.vtype || 'epargne';
    if (!validateMontant(montant)) {
      showToast('Entrez un montant valide (> 0)', 'error');
      document.getElementById('virementMontant').focus();
      return;
    }

    const obj = {
      type,
      montant,
      date: document.getElementById('virementDate').value || today(),
      frequence: document.getElementById('virementFrequence').value,
      commentaire: document.getElementById('virementComment').value.trim(),
      beneficiaire: type === 'tiers' ? document.getElementById('virementBeneficiaire').value.trim() : '',
      destination: (type === 'epargne' || type === 'retrait') ? document.getElementById('virementDestination').value : ''
    };

    if (AppState.ui.editingId) {
      updateItem('virements', AppState.ui.editingId, obj);
      showToast('Virement modifié', 'success');
    } else {
      addItem('virements', obj);
      const msgs = {
        epargne: '💰 Épargne enregistrée !',
        retrait: '🔙 Retrait enregistré',
        tiers: `💸 Virement vers ${obj.beneficiaire || 'tiers'} enregistré`
      };
      showToast(msgs[type] || 'Virement ajouté', 'success');
    }
    closeModal('modalVirement');
    scheduleSync();
    renderVirements();
    renderDashboard();
  });
}

// Appel au démarrage (après DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
  setupVirementsForm();
});
