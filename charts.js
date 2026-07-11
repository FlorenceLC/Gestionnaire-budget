/**
 * charts.js — Graphiques avec Chart.js
 */

// Registre des instances Chart pour pouvoir les détruire avant recréation
const CHARTS = {};

const CHART_COLORS = [
  '#10B981','#F43F5E','#F97316','#8B5CF6','#3B82F6',
  '#EC4899','#06B6D4','#F59E0B','#64748B','#84CC16'
];

function destroyChart(id) {
  if (CHARTS[id]) { CHARTS[id].destroy(); delete CHARTS[id]; }
}

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#94A3B8', font: { family: 'Inter', size: 12 }, boxWidth: 12 } },
    tooltip: {
      backgroundColor: '#1E293B',
      titleColor: '#F8FAFC',
      bodyColor: '#94A3B8',
      borderColor: '#334155',
      borderWidth: 1,
      callbacks: {
        label: ctx => ` ${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(ctx.raw)} €`
      }
    }
  },
  scales: {
    x: { ticks: { color: '#64748B', font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(51,65,85,0.5)' }, border: { color: 'transparent' } },
    y: { ticks: { color: '#64748B', font: { family: 'Inter', size: 11 }, callback: v => v.toLocaleString('fr-FR') + ' €' }, grid: { color: 'rgba(51,65,85,0.5)' }, border: { color: 'transparent' } }
  }
};

function chartOpts(overrides = {}) {
  return deepMerge(JSON.parse(JSON.stringify(CHART_DEFAULTS)), overrides);
}

function deepMerge(target, source) {
  for (const k in source) {
    if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      target[k] = target[k] || {};
      deepMerge(target[k], source[k]);
    } else {
      target[k] = source[k];
    }
  }
  return target;
}

// ===== DASHBOARD CHARTS =====
function renderDashboardCharts(data, mois, annee) {
  // Donut — répartition dépenses
  const catMap = getDepensesParCategorie(data, mois, annee);
  const fixes = getDepensesFixes(data);
  const abos  = getAbonnementsMensuels(data);

  destroyChart('chartCategories');
  const ctxCat = document.getElementById('chartCategories');
  if (!ctxCat) return;

  const labels = ['Charges fixes', 'Abonnements', ...Object.keys(catMap)];
  const values = [fixes, abos, ...Object.values(catMap)];

  if (values.every(v => v === 0)) {
    ctxCat.getContext('2d').clearRect(0, 0, ctxCat.width, ctxCat.height);
  } else {
    CHARTS['chartCategories'] = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: CHART_COLORS, borderWidth: 0, hoverOffset: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94A3B8', font: { family: 'Inter', size: 11 }, boxWidth: 10, padding: 12 } },
          tooltip: CHART_DEFAULTS.plugins.tooltip
        }
      }
    });
  }

  // Line — évolution 6 mois
  destroyChart('chartEvolution');
  const ctxEvo = document.getElementById('chartEvolution');
  if (!ctxEvo) return;

  const hist = getHistoriqueN(data, 6);
  CHARTS['chartEvolution'] = new Chart(ctxEvo, {
    type: 'line',
    data: {
      labels: hist.map(h => h.label),
      datasets: [
        {
          label: 'Revenus',
          data: hist.map(h => h.revenus),
          borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)',
          borderWidth: 2, fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#10B981'
        },
        {
          label: 'Dépenses',
          data: hist.map(h => h.depenses),
          borderColor: '#F43F5E', backgroundColor: 'rgba(244,63,94,0.08)',
          borderWidth: 2, fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#F43F5E'
        }
      ]
    },
    options: chartOpts()
  });
}

// ===== STATS CHARTS =====
function renderStatsCharts(data, n) {
  const hist = getHistoriqueN(data, n);

  // Évolution revenus/dépenses
  destroyChart('chartStatsEvolution');
  const ctxEvo = document.getElementById('chartStatsEvolution');
  if (ctxEvo) {
    CHARTS['chartStatsEvolution'] = new Chart(ctxEvo, {
      type: 'bar',
      data: {
        labels: hist.map(h => h.label),
        datasets: [
          { label: 'Revenus', data: hist.map(h => h.revenus), backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 6, borderSkipped: false },
          { label: 'Dépenses', data: hist.map(h => h.depenses), backgroundColor: 'rgba(244,63,94,0.7)', borderRadius: 6, borderSkipped: false }
        ]
      },
      options: chartOpts()
    });
  }

  // Reste à vivre
  destroyChart('chartStatsReste');
  const ctxReste = document.getElementById('chartStatsReste');
  if (ctxReste) {
    CHARTS['chartStatsReste'] = new Chart(ctxReste, {
      type: 'line',
      data: {
        labels: hist.map(h => h.label),
        datasets: [{
          label: 'Reste à vivre',
          data: hist.map(h => h.reste),
          borderColor: '#8B5CF6',
          backgroundColor: 'rgba(139,92,246,0.12)',
          borderWidth: 2, fill: true, tension: 0.4, pointRadius: 5,
          pointBackgroundColor: hist.map(h => h.reste >= 0 ? '#8B5CF6' : '#F43F5E')
        }]
      },
      options: chartOpts()
    });
  }

  // Dépenses par catégorie (cumulé)
  destroyChart('chartStatsCat');
  const ctxCat = document.getElementById('chartStatsCat');
  if (ctxCat) {
    const catTotals = {};
    hist.forEach(h => {
      const cats = getDepensesParCategorie(data, h.mois, h.annee);
      Object.entries(cats).forEach(([cat, val]) => {
        catTotals[cat] = (catTotals[cat] || 0) + val;
      });
    });
    const labels = Object.keys(catTotals);
    const values = Object.values(catTotals);
    CHARTS['chartStatsCat'] = new Chart(ctxCat, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total',
          data: values,
          backgroundColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length] + 'B3'),
          borderRadius: 6, borderSkipped: false
        }]
      },
      options: chartOpts({ plugins: { legend: { display: false } } })
    });
  }
}
