/**
 * gist.js — Synchronisation avec GitHub Gist
 * Aucun backend, uniquement l'API GitHub REST
 */

const GIST_FILENAME = 'monbudget-data.json';

async function gistFetch(data) {
  return saveToGist(data);
}

async function saveToGist(data) {
  const { githubToken, gistId } = AppState.settings;
  if (!githubToken) throw new Error('Token GitHub non configuré');

  const payload = {
    description: 'MonBudget - Données personnelles',
    public: false,
    files: {
      [GIST_FILENAME]: {
        content: JSON.stringify(data, null, 2)
      }
    }
  };

  let url, method;
  if (gistId) {
    url = `https://api.github.com/gists/${gistId}`;
    method = 'PATCH';
  } else {
    url = 'https://api.github.com/gists';
    method = 'POST';
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erreur HTTP ${res.status}`);
  }

  const result = await res.json();

  // Sauvegarder le nouvel ID Gist si création
  if (!gistId) {
    AppState.settings.gistId = result.id;
    saveSettings(githubToken, result.id);
    // Mettre à jour le champ dans les paramètres
    const el = document.getElementById('gistId');
    if (el) el.value = result.id;
  }

  data.meta = data.meta || {};
  data.meta.lastSync = new Date().toISOString();

  return result;
}

async function loadFromGist() {
  const { githubToken, gistId } = AppState.settings;
  if (!githubToken) throw new Error('Token GitHub non configuré');
  if (!gistId) throw new Error('ID du Gist non configuré');

  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erreur HTTP ${res.status}`);
  }

  const gist = await res.json();
  const file = gist.files?.[GIST_FILENAME];
  if (!file) throw new Error(`Fichier "${GIST_FILENAME}" introuvable dans le Gist`);

  // Récupérer le contenu (peut être tronqué pour les gros fichiers)
  let content = file.content;
  if (file.truncated) {
    const rawRes = await fetch(file.raw_url, {
      headers: { 'Authorization': `Bearer ${githubToken}` }
    });
    content = await rawRes.text();
  }

  return JSON.parse(content);
}

async function testConnection() {
  const { githubToken } = AppState.settings;
  if (!githubToken) throw new Error('Token GitHub non configuré');

  const res = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!res.ok) throw new Error('Token invalide ou expiré');
  const user = await res.json();
  return user.login;
}

// Sync automatique après chaque modification
let syncTimeout = null;
function scheduleSync() {
  if (!AppState.settings.githubToken) return;
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      await saveToGist(AppState.data);
      updateLastSync();
    } catch (e) {
      // Silencieux en auto-sync
    }
  }, 2000); // Délai de 2s pour grouper les modifications
}

function updateLastSync() {
  const el = document.getElementById('lastSyncTime');
  if (el && AppState.data.meta?.lastSync) {
    el.textContent = new Date(AppState.data.meta.lastSync).toLocaleString('fr-FR');
  }
}
