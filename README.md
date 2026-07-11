# MonBudget — Tableau de bord financier personnel

Application web statique PWA pour suivre ses finances au quotidien.
Hébergée sur GitHub Pages, données synchronisées via GitHub Gist.

## 🚀 Déploiement sur GitHub Pages

### 1. Créer un dépôt GitHub

```bash
git init
git add .
git commit -m "Initial MonBudget"
git remote add origin https://github.com/VOTRE_USER/monbudget.git
git push -u origin main
```

### 2. Activer GitHub Pages

- Aller dans **Settings → Pages**
- Source : **Deploy from a branch**
- Branch : **main** / `/ (root)`
- Enregistrer

Votre app sera accessible sur `https://VOTRE_USER.github.io/monbudget/`

---

## ⚙️ Configuration (première utilisation)

### Créer un Token GitHub

1. Aller sur [github.com/settings/tokens](https://github.com/settings/tokens)
2. **Generate new token (classic)**
3. Cocher uniquement le scope **gist**
4. Copier le token (commence par `ghp_`)

### Configurer l'application

1. Ouvrir l'app → **Paramètres**
2. Coller votre **Token GitHub**
3. Laisser l'ID Gist vide (il sera créé automatiquement au premier sync)
4. Cliquer **Tester la connexion**
5. Cliquer **Envoyer vers Gist**

Le Gist sera créé automatiquement. L'ID s'affichera dans le champ prévu.

---

## 📱 Installer comme application mobile

### iPhone / iPad (Safari)
1. Ouvrir l'URL dans Safari
2. Bouton **Partager** → **Sur l'écran d'accueil**

### Android (Chrome)
1. Ouvrir l'URL dans Chrome
2. Menu (⋮) → **Ajouter à l'écran d'accueil**

---

## 📁 Structure des fichiers

```
monbudget/
├── index.html          # Interface principale
├── style.css           # Design system complet
├── manifest.json       # Déclaration PWA
├── service-worker.js   # Cache offline
├── js/
│   ├── data.js         # État, calculs financiers, CRUD
│   ├── gist.js         # API GitHub Gist
│   ├── ui.js           # Rendu de l'interface
│   ├── charts.js       # Graphiques Chart.js
│   └── app.js          # Point d'entrée, événements
└── icons/
    ├── icon-72.png
    ├── icon-96.png
    ├── icon-128.png
    ├── icon-144.png
    ├── icon-152.png
    ├── icon-192.png
    ├── icon-384.png
    └── icon-512.png
```

---

## 🔐 Sécurité

- Le **Token GitHub** est stocké en `sessionStorage` (disparaît à la fermeture du navigateur)
- Les **données financières** ne transitent que vers votre Gist privé
- **Aucun serveur tiers**, aucune base de données externe
- Le Gist est créé en **privé** par défaut

---

## 📊 Fonctionnalités

- **Dashboard** : reste à vivre en temps réel, graphiques interactifs
- **Revenus** : salaire, primes, revenus ponctuels
- **Charges fixes** : loyer, abonnements, assurances
- **Dépenses variables** : ajout rapide par catégorie
- **Abonnements** : suivi mensuel + annuel, activation/désactivation
- **Mode Couple** : vision individuelle et foyer commun
- **Statistiques** : évolution sur 3, 6 ou 12 mois
- **Synchronisation** : multi-appareils via GitHub Gist
- **PWA** : installable, fonctionne hors ligne (données en cache)
