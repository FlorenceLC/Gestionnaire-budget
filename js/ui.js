/**
 * ui.js — Rendu de l'interface utilisateur
 */

// ===== TOAST =====
function showToast(msg, type = 'info') {
  const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i>${msg}`;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ===== NAVIGATION =====
function navigateTo(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById(`section-${section}`);
  if (target) target.classList.add('active');

  document.querySelectorAll(`[data-section="${section}"]`).forEach(el => el.classList.add('active'));

  const titles = {
    'dashboard': 'Dashboard', 'revenus': 'Revenus', 'depenses-fixes': 'Charges fixes',
    'depenses-variables': 'Dépenses', 'abonnements': 'Abonnements',
    'virements': 'Virements', 'couple': 'Mode Couple',
    'statistiques': 'Statistiques', 'parametres': 'Paramètres'
  };
  const mt = document.getElementById('mobileTitle');
  if (mt) mt.textContent = titles[section] || section;

  // Fermer le menu mobile
  closeMobileNav();

  // Render la section
  renderSection(section);
  window.scrollTo(0, 0);
}

function renderSection(section) {
  switch (section) {
    case 'dashboard':          renderDashboard(); break;
    case 'revenus':            renderRevenus(); break;
    case 'depenses-fixes':     renderFixes(); break;
    case 'depenses-variables': renderVariables(); break;
    case 'abonnements':        renderAbonnements(); break;
    case 'virements':          renderVirements(); break;
    case 'couple':             renderCouple(); break;
    case 'statistiques':       renderStats(); break;
    case 'parametres':         renderParams(); break;
  }
}

// ===== MOBILE NAV =====
function openMobileNav() {
  document.getElementById('mobileNavOverlay').classList.add('open');
  document.getElementById('hamburger').classList.add('open');
}
function closeMobileNav() {
  document.getElementById('mobileNavOverlay').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
}

// ===== MODALS =====
function openModal(id) {
  document.getElementById(id).classList.add('open');
  // Focus premier champ
  setTimeout(() => {
    const first = document.querySelector(`#${id} .input`);
    if (first) first.focus();
  }, 100);
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  AppState.ui.editingId = null;
  AppState.ui.editingType = null;
}

// ===== MONTH LABEL =====
function getMonthLabel(m, y) {
  return new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}
function capitalizeFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ===== DASHBOARD =====
function renderDashboard() {
  const { currentMonth: m, currentYear: y } = AppState.ui;
  const data = AppState.data;

  // État vide guidé : si aucune donnée du tout
  const hasAnyData = data.revenus.length || data.depenses_fixes.length || data.abonnements.length || data.depenses_variables.length;
  const welcomeBanner = document.getElementById('welcomeBanner');
  if (!hasAnyData && !welcomeBanner) {
    const banner = document.createElement('div');
    banner.id = 'welcomeBanner';
    banner.style.cssText = `
      background: linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(59,130,246,0.08) 100%);
      border: 1px solid rgba(16,185,129,0.3); border-radius: 14px;
      padding: 1.5rem; margin-bottom: 1.5rem; text-align: center;
    `;
    banner.innerHTML = `
      <div style="font-size:2rem; margin-bottom:0.5rem">👋</div>
      <h2 style="font-size:1.1rem; font-weight:700; margin-bottom:0.35rem">Bienvenue sur MonBudget</h2>
      <p style="font-size:0.85rem; color:var(--text-2); margin-bottom:1rem; line-height:1.5">
        Commencez par ajouter vos revenus et charges fixes pour calculer votre reste à vivre.
      </p>
      <div style="display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;">
        <button class="btn-primary" style="font-size:0.8rem; padding:0.5rem 1rem;" data-section="revenus">
          <i class="fa-solid fa-arrow-trend-up"></i> Ajouter un revenu
        </button>
        <button class="btn-outline" style="font-size:0.8rem; padding:0.5rem 1rem;" data-section="depenses-fixes">
          <i class="fa-solid fa-lock"></i> Ajouter une charge
        </button>
        <button class="btn-outline" style="font-size:0.8rem; padding:0.5rem 1rem;" data-section="parametres">
          <i class="fa-brands fa-github"></i> Configurer Gist
        </button>
      </div>
    `;
    const hero = document.querySelector('.hero-card');
    if (hero) hero.parentNode.insertBefore(banner, hero);
  } else if (hasAnyData && welcomeBanner) {
    welcomeBanner.remove();
  }

  document.getElementById('currentMonthLabel').textContent =
    capitalizeFirst(getMonthLabel(m, y));

  const revenus   = getRevenusMensuels(data, m, y);
  const fixes     = getDepensesFixes(data);
  const abos      = getAbonnementsMensuels(data);
  const variables = getDepensesVariablesMois(data, m, y);
  const total     = fixes + abos + variables;
  const reste     = revenus - total;

  document.getElementById('summaryRevenus').textContent     = formatMoney(revenus);
  document.getElementById('summaryFixes').textContent       = formatMoney(fixes);
  document.getElementById('summaryVariables').textContent   = formatMoney(variables);
  document.getElementById('summaryAbonnements').textContent = formatMoney(abos);
  const epNet = getTotalEpargneMois(data, m, y) - getTotalRetraitMois(data, m, y);
  const epEl  = document.getElementById('summaryEpargne');
  if (epEl) {
    epEl.textContent = formatMoney(epNet);
    epEl.className = 'card-value' + (epNet >= 0 ? '' : ' negative');
  }

  // Hero
  const heroEl = document.getElementById('heroAmount');
  heroEl.textContent = formatMoney(reste);
  heroEl.className = 'hero-amount' + (reste < 0 ? ' negative' : '');

  // Par jour / semaine
  const joursRestants = getJoursRestantsMois(m, y);
  document.getElementById('heroJour').textContent =
    formatMoney(reste > 0 ? reste / joursRestants : 0) + '/jour';
  document.getElementById('heroSemaine').textContent =
    formatMoney(reste > 0 ? reste / 7 : 0) + '/sem.';

  // Barre de progression
  const pct = revenus > 0 ? Math.min(100, (total / revenus) * 100) : 0;
  const bar = document.getElementById('heroBarFill');
  bar.style.width = pct + '%';
  bar.className = 'hero-bar-fill' + (pct > 90 ? ' danger' : pct > 70 ? ' warning' : '');
  document.getElementById('heroPercent').textContent = Math.round(pct) + '%';

  // Dernières dépenses
  const lastEl = document.getElementById('lastDepenses');
  const recent = [...data.depenses_variables]
    .filter(d => { const dt = new Date(d.date); return dt.getMonth() === m && dt.getFullYear() === y; })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  if (recent.length === 0) {
    lastEl.innerHTML = '<div class="empty-state"><i class="fa-solid fa-receipt"></i><p>Aucune dépense ce mois</p></div>';
  } else {
    lastEl.innerHTML = recent.map(d => renderVariableItem(d, false)).join('');
  }

  // Graphiques dashboard
  renderDashboardCharts(data, m, y);
}

// ===== REVENUS =====
function renderRevenus() {
  const { currentMonth: m, currentYear: y } = AppState.ui;
  const data = AppState.data;
  const total = getRevenusMensuels(data, m, y);
  document.getElementById('totalRevenus').textContent = formatMoney(total);

  const list = document.getElementById('listRevenus');
  if (data.revenus.length === 0) {
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-arrow-trend-up"></i><p>Aucun revenu enregistré</p></div>';
    return;
  }
  list.innerHTML = data.revenus.map(r => `
    <div class="list-item">
      <div class="item-icon cat-courses"><i class="fa-solid fa-arrow-trend-up"></i></div>
      <div class="item-info">
        <div class="item-name">${r.nom}</div>
        <div class="item-meta">${r.frequence === 'mensuel' ? 'Mensuel' : 'Ponctuel — ' + formatDate(r.date)}${r.personne && r.personne !== 'commun' ? ' · ' + getPersonName(r.personne) : ''}</div>
      </div>
      <div class="item-amount" style="color:var(--green)">${formatMoney(r.montant)}</div>
      <div class="item-actions">
        <button onclick="editRevenu('${r.id}')" title="Modifier"><i class="fa-solid fa-pen"></i></button>
        <button class="del-btn" onclick="confirmDelete('revenus','${r.id}')" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join('');
}

// ===== DÉPENSES FIXES =====
function renderFixes() {
  const data = AppState.data;
  const total = getDepensesFixes(data);
  document.getElementById('totalFixes').textContent = formatMoney(total);

  const list = document.getElementById('listFixes');
  if (data.depenses_fixes.length === 0) {
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-lock"></i><p>Aucune charge fixe enregistrée</p></div>';
    return;
  }
  list.innerHTML = data.depenses_fixes.map(f => {
    const icon = CAT_ICONS[f.categorie] || 'fa-tag';
    const catClass = 'cat-' + f.categorie;
    const freqLabel = f.frequence === 'annuel' ? '/an (÷12)' : f.frequence === 'trimestriel' ? '/trim. (÷3)' : '/mois';
    return `<div class="list-item">
      <div class="item-icon ${catClass}"><i class="fa-solid ${icon}"></i></div>
      <div class="item-info">
        <div class="item-name">${f.nom}</div>
        <div class="item-meta">${CAT_LABELS[f.categorie] || f.categorie} · ${freqLabel}</div>
      </div>
      <div class="item-amount" style="color:var(--red)">${formatMoney(f.montant)}</div>
      <div class="item-actions">
        <button onclick="editFixe('${f.id}')" title="Modifier"><i class="fa-solid fa-pen"></i></button>
        <button class="del-btn" onclick="confirmDelete('depenses_fixes','${f.id}')" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

// ===== DÉPENSES VARIABLES =====
function renderVariableItem(d, showActions = true) {
  const icon = CAT_ICONS[d.categorie] || 'fa-receipt';
  const catClass = 'cat-' + d.categorie.toLowerCase();
  const actions = showActions ? `
    <div class="item-actions">
      <button onclick="editVariable('${d.id}')" title="Modifier"><i class="fa-solid fa-pen"></i></button>
      <button class="del-btn" onclick="confirmDelete('depenses_variables','${d.id}')" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
    </div>` : '';
  return `<div class="list-item">
    <div class="item-icon ${catClass}"><i class="fa-solid ${icon}"></i></div>
    <div class="item-info">
      <div class="item-name">${d.categorie}${d.commentaire ? ' — ' + d.commentaire : ''}</div>
      <div class="item-meta">${formatDate(d.date)}${d.personne && d.personne !== 'commun' ? ' · ' + getPersonName(d.personne) : ''}</div>
    </div>
    <div class="item-amount" style="color:var(--red)">${formatMoney(d.montant)}</div>
    ${actions}
  </div>`;
}

function renderVariables() {
  const { currentMonth: m, currentYear: y, catFilter } = AppState.ui;
  const data = AppState.data;

  const monthItems = data.depenses_variables
    .filter(d => { const dt = new Date(d.date); return dt.getMonth() === m && dt.getFullYear() === y; })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  document.getElementById('totalVariables').textContent = formatMoney(
    monthItems.reduce((s, d) => s + parseFloat(d.montant || 0), 0)
  );

  // Filtre catégories
  const cats = ['all', ...new Set(monthItems.map(d => d.categorie))];
  document.getElementById('categoryFilter').innerHTML = cats.map(c =>
    `<button class="cat-filter-btn${catFilter === c ? ' active' : ''}" data-cat="${c}">${c === 'all' ? 'Tout' : c}</button>`
  ).join('');

  const filtered = catFilter === 'all' ? monthItems : monthItems.filter(d => d.categorie === catFilter);
  const list = document.getElementById('listVariables');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-receipt"></i><p>Aucune dépense ce mois</p></div>';
    return;
  }
  list.innerHTML = filtered.map(d => renderVariableItem(d, true)).join('');
}

// ===== ABONNEMENTS =====
function renderAbonnements() {
  const data = AppState.data;
  const mensuel = getAbonnementsMensuels(data);
  document.getElementById('totalAboMensuel').textContent = formatMoney(mensuel);
  document.getElementById('totalAboAnnuel').textContent = formatMoney(mensuel * 12);

  const list = document.getElementById('listAbonnements');
  if (data.abonnements.length === 0) {
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-rotate"></i><p>Aucun abonnement enregistré</p></div>';
    return;
  }
  list.innerHTML = data.abonnements.map(a => {
    const mensuelCost = a.frequence === 'annuel' ? parseFloat(a.montant) / 12 : parseFloat(a.montant);
    return `<div class="list-item${a.actif === false ? ' inactive' : ''}">
      <div class="item-icon cat-loisirs"><i class="fa-solid fa-rotate"></i></div>
      <div class="item-info">
        <div class="item-name">${a.nom}</div>
        <div class="item-meta">${a.frequence === 'annuel' ? a.montant + ' €/an' : a.montant + ' €/mois'} · ${a.actif !== false ? 'Actif' : 'Inactif'}</div>
      </div>
      <div class="item-amount" style="color:var(--purple)">${formatMoney(mensuelCost)}/m</div>
      <div class="item-actions">
        <button onclick="toggleAbonnement('${a.id}')" title="${a.actif !== false ? 'Désactiver' : 'Activer'}">
          <i class="fa-solid fa-toggle-${a.actif !== false ? 'on' : 'off'}"></i>
        </button>
        <button onclick="editAbonnement('${a.id}')" title="Modifier"><i class="fa-solid fa-pen"></i></button>
        <button class="del-btn" onclick="confirmDelete('abonnements','${a.id}')" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

// ===== VIREMENTS =====
function renderVirements() {
  const { currentMonth: m, currentYear: y } = AppState.ui;
  const data = AppState.data;
  const vfilter = AppState.ui.virementFilter || 'all';

  const moisItems = getVirementsMois(data, m, y);

  // Ajouter les récurrents sans date ce mois
  const recurrents = getVirementsRecurrents(data);
  const moisIds = new Set(moisItems.map(v => v.id));
  const extraRec = recurrents.filter(v => !moisIds.has(v.id));
  const allItems = [...moisItems, ...extraRec].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const totalEp = getTotalEpargneMois(data, m, y);
  const totalRet = getTotalRetraitMois(data, m, y);
  const netEpargne = totalEp - totalRet;
  const soldeLivret = getSoldeLivretAnnee(data, y);

  // Hero
  const netEl = document.getElementById('epargneNet');
  netEl.textContent = formatMoney(Math.abs(netEpargne));
  netEl.className = 'epargne-amount ' + (netEpargne >= 0 ? 'green' : 'red');

  const subEl = document.getElementById('epargneSub');
  if (allItems.length === 0) {
    subEl.textContent = 'Aucun mouvement ce mois';
  } else {
    const parts = [];
    if (totalEp > 0) parts.push(`${formatMoney(totalEp)} épargnés`);
    if (totalRet > 0) parts.push(`${formatMoney(totalRet)} repris`);
    subEl.textContent = parts.join(' · ');
  }

  document.getElementById('epargneLivret').textContent = formatMoney(soldeLivret);
  document.getElementById('totalEpargne').textContent = formatMoney(totalEp);
  document.getElementById('totalRepioche').textContent = formatMoney(totalRet);

  // Filtre
  const filtered = vfilter === 'all' ? allItems : allItems.filter(v => v.type === vfilter);

  // Liste
  const list = document.getElementById('listVirements');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><i class="fa-solid fa-right-left"></i><p>Aucun virement ce mois</p></div>';
    return;
  }

  list.innerHTML = filtered.map(v => {
    const icon = VTYPE_ICONS[v.type] || 'fa-right-left';
    const amountClass = `amount-${v.type}`;
    const sign = v.type === 'retrait' ? '+' : '−';
    const badgeClass = `vtype-badge ${v.type}`;
    const label = VTYPE_LABELS[v.type] || v.type;

    let subtitle = '';
    if (v.type === 'epargne' || v.type === 'retrait') {
      subtitle = v.destination ? v.destination.replace('-', ' ').toUpperCase() : 'Livret A';
    } else if (v.type === 'tiers') {
      subtitle = v.beneficiaire || 'Tiers';
    }
    if (v.commentaire) subtitle += (subtitle ? ' — ' : '') + v.commentaire;
    if (v.frequence === 'mensuel') subtitle += ' · Récurrent';

    return `<div class="list-item">
      <div class="item-icon cat-${v.type === 'epargne' ? 'courses' : v.type === 'retrait' ? 'essence' : 'loisirs'}">
        <i class="fa-solid ${icon}"></i>
      </div>
      <div class="item-info">
        <div class="item-name" style="display:flex;align-items:center;gap:0.4rem;">
          <span class="${badgeClass}">${label}</span>
          ${subtitle ? `<span style="font-size:0.82rem;color:var(--text-2)">${subtitle}</span>` : ''}
        </div>
        <div class="item-meta">${v.date ? formatDate(v.date) : 'Récurrent mensuel'}</div>
      </div>
      <div class="item-amount ${amountClass}">${sign} ${formatMoney(v.montant)}</div>
      <div class="item-actions">
        <button onclick="editVirement('${v.id}')" title="Modifier"><i class="fa-solid fa-pen"></i></button>
        <button class="del-btn" onclick="confirmDelete('virements','${v.id}')" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function editVirement(id) {
  const v = getItem('virements', id);
  if (!v) return;
  AppState.ui.editingId = id;
  document.getElementById('modalVirementTitle').textContent = 'Modifier le virement';
  // Type picker
  document.querySelectorAll('.vtype-btn').forEach(b => b.classList.toggle('active', b.dataset.vtype === v.type));
  updateVirementFormFields(v.type);
  document.getElementById('virementMontant').value = v.montant;
  document.getElementById('virementDate').value = v.date || '';
  document.getElementById('virementFrequence').value = v.frequence || 'ponctuel';
  document.getElementById('virementComment').value = v.commentaire || '';
  if (v.type === 'tiers') document.getElementById('virementBeneficiaire').value = v.beneficiaire || '';
  if (v.type === 'epargne' || v.type === 'retrait') document.getElementById('virementDestination').value = v.destination || 'livret-a';
  openModal('modalVirement');
}

function updateVirementFormFields(type) {
  const isTiers = type === 'tiers';
  const isEpargne = type === 'epargne' || type === 'retrait';
  document.getElementById('groupBeneficiaire').style.display = isTiers ? '' : 'none';
  document.getElementById('groupDestination').style.display = isEpargne ? '' : 'none';
}

// ===== COUPLE =====
function renderCouple() {
  const { currentMonth: m, currentYear: y } = AppState.ui;
  const data = AppState.data;
  const couple = data.couple || {};

  document.getElementById('coupleToggle').checked = couple.active || false;
  document.getElementById('coupleContent').classList.toggle('hidden', !couple.active);
  document.getElementById('inputP1Name').value = couple.personne1?.nom || '';
  document.getElementById('inputP2Name').value = couple.personne2?.nom || '';

  if (couple.active) {
    const p1 = couple.personne1?.nom || 'Personne 1';
    const p2 = couple.personne2?.nom || 'Personne 2';
    document.getElementById('person1Name').textContent = p1;
    document.getElementById('person2Name').textContent = p2;

    const stats = getCoupleStats(data, m, y);
    const totalRev = getRevenusMensuels(data, m, y);
    const totalDep = getDepensesFixes(data) + getAbonnementsMensuels(data) + getDepensesVariablesMois(data, m, y);

    document.getElementById('p1Revenus').textContent = formatMoney(stats.p1Rev);
    document.getElementById('p1Depenses').textContent = formatMoney(stats.p1Dep);
    document.getElementById('p1Solde').textContent = formatMoney(stats.p1Rev - stats.p1Dep);
    document.getElementById('p2Revenus').textContent = formatMoney(stats.p2Rev);
    document.getElementById('p2Depenses').textContent = formatMoney(stats.p2Dep);
    document.getElementById('p2Solde').textContent = formatMoney(stats.p2Rev - stats.p2Dep);
    document.getElementById('foyer-revenus').textContent = formatMoney(totalRev);
    document.getElementById('foyer-depenses').textContent = formatMoney(totalDep);
    document.getElementById('foyer-reste').textContent = formatMoney(totalRev - totalDep);

    // Répartition active
    document.querySelectorAll('.btn-repartition').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === (couple.repartition || '50-50'));
    });
  }
}

// ===== STATS =====
function renderStats() {
  renderStatsCharts(AppState.data, AppState.ui.statsPeriod);
}

// ===== PARAMS =====
function renderParams() {
  document.getElementById('githubToken').value = AppState.settings.githubToken || '';
  document.getElementById('gistId').value = AppState.settings.gistId || '';
  updateLastSync();
}

// ===== HELPERS =====
function getPersonName(personne) {
  const couple = AppState.data.couple;
  if (personne === 'personne1') return couple?.personne1?.nom || 'Personne 1';
  if (personne === 'personne2') return couple?.personne2?.nom || 'Personne 2';
  return 'Commun';
}

// ===== CONFIRM DELETE =====
function confirmDelete(type, id) {
  AppState.ui.deleteCallback = () => {
    deleteItem(type, id);
    scheduleSync();
    showToast('Élément supprimé', 'success');
    const section = document.querySelector('.section.active')?.id?.replace('section-', '');
    if (section) renderSection(section);
    closeModal('modalConfirm');
  };
  openModal('modalConfirm');
}

// ===== TOGGLE ABONNEMENT =====
function toggleAbonnement(id) {
  const abo = getItem('abonnements', id);
  if (abo) {
    updateItem('abonnements', id, { actif: !abo.actif });
    scheduleSync();
    renderAbonnements();
  }
}

// ===== EDIT HELPERS =====
function editRevenu(id) {
  const r = getItem('revenus', id);
  if (!r) return;
  AppState.ui.editingId = id;
  AppState.ui.editingType = 'revenus';
  document.getElementById('revenuNom').value = r.nom;
  document.getElementById('revenuMontant').value = r.montant;
  document.getElementById('revenuDate').value = r.date || '';
  document.getElementById('revenuFrequence').value = r.frequence || 'mensuel';
  document.getElementById('revenuPersonne').value = r.personne || 'commun';
  document.getElementById('modalRevenuTitle').textContent = 'Modifier le revenu';
  openModal('modalRevenu');
}

function editFixe(id) {
  const f = getItem('depenses_fixes', id);
  if (!f) return;
  AppState.ui.editingId = id;
  document.getElementById('fixeNom').value = f.nom;
  document.getElementById('fixeMontant').value = f.montant;
  document.getElementById('fixeCategorie').value = f.categorie;
  document.getElementById('fixeFrequence').value = f.frequence || 'mensuel';
  document.getElementById('modalFixeTitle').textContent = 'Modifier la charge';
  openModal('modalFixe');
}

function editVariable(id) {
  const d = getItem('depenses_variables', id);
  if (!d) return;
  AppState.ui.editingId = id;
  document.getElementById('variableMontant').value = d.montant;
  document.getElementById('variableDate').value = d.date || '';
  document.getElementById('variableComment').value = d.commentaire || '';
  document.getElementById('variablePersonne').value = d.personne || 'commun';
  // Reset cat picker
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === d.categorie);
  });
  document.getElementById('modalVariableTitle').textContent = 'Modifier la dépense';
  openModal('modalVariable');
}

function editAbonnement(id) {
  const a = getItem('abonnements', id);
  if (!a) return;
  AppState.ui.editingId = id;
  document.getElementById('aboNom').value = a.nom;
  document.getElementById('aboMontant').value = a.montant;
  document.getElementById('aboFrequence').value = a.frequence || 'mensuel';
  document.getElementById('aboActif').checked = a.actif !== false;
  document.getElementById('modalAbonnementTitle').textContent = 'Modifier l\'abonnement';
  openModal('modalAbonnement');
}
