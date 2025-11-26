# Quickstart: Système de Visualisation des Dons

## Prérequis

- Node.js 18+ (LTS recommandé)
- npm ou pnpm

## Installation

```bash
# Cloner le projet
git clone <repo-url>
cd ohel-yeochoua

# Installer les dépendances backend
cd backend
npm install

# Installer les dépendances frontend
cd ../frontend
npm install
```

## Lancement (Développement)

### Terminal 1 - Backend

```bash
cd backend
npm run dev
```

Le serveur démarre sur `http://localhost:3000`

### Terminal 2 - Frontend

```bash
cd frontend
npm run dev
```

L'application démarre sur `http://localhost:5173`

## Accès

| URL | Description |
|-----|-------------|
| `http://localhost:5173/admin` | Panel administrateur |
| `http://localhost:5173/display` | Visualisation (plein écran) |
| `http://localhost:3000/api/donations` | API REST |

## Premier don

1. Ouvrir le panel admin (`/admin`)
2. Remplir le formulaire:
   - Prénom: `David`
   - Nom: `Cohen`
   - Montant: Sélectionner `180€` ou saisir un montant
3. Cliquer sur "Enregistrer le don"
4. Observer les animations sur `/display`

## Configuration

### Modifier l'objectif

Dans le panel admin, onglet "Configuration":
- Changer l'objectif total (ex: 100 000€)
- Sauvegarder

### Configurer la Menorah

1. Préparer un fichier SVG avec des groupes nommés:
   ```svg
   <svg>
     <g id="segment-1">...</g>
     <g id="segment-2">...</g>
     <!-- etc. -->
   </svg>
   ```

2. Dans la config, définir les seuils:
   ```json
   [
     { "id": "segment-1", "thresholdPercent": 10, "order": 1 },
     { "id": "segment-2", "thresholdPercent": 25, "order": 2 },
     { "id": "segment-3", "thresholdPercent": 50, "order": 3 }
   ]
   ```

## Structure des fichiers

```
backend/
├── src/
│   ├── index.ts         # Point d'entrée
│   ├── routes/          # API endpoints
│   ├── services/        # Logique métier
│   └── models/          # Types TypeScript
├── db/
│   └── donations.db     # Base SQLite (créée au 1er lancement)
└── package.json

frontend/
├── src/
│   ├── components/
│   │   ├── admin/       # Formulaires admin
│   │   └── display/     # Visualisations
│   ├── composables/     # useSocket, useDonations
│   └── App.vue
└── package.json
```

## Commandes utiles

```bash
# Backend
npm run dev          # Démarrer en mode dev (hot reload)
npm run build        # Compiler TypeScript
npm start            # Démarrer en production

# Frontend
npm run dev          # Démarrer Vite dev server
npm run build        # Build production
npm run preview      # Prévisualiser le build
```

## Dépannage

### La base de données n'existe pas

Elle est créée automatiquement au premier lancement du backend.
Vérifier que le dossier `backend/db/` existe et est accessible en écriture.

### Les animations ne se mettent pas à jour

1. Vérifier la connexion WebSocket (console du navigateur)
2. Recharger la page `/display`
3. Vérifier que le backend est bien lancé

### Le SVG Menorah ne s'affiche pas

1. Vérifier que le fichier est dans `frontend/public/assets/menorah.svg`
2. Vérifier que les IDs des segments correspondent à la configuration

## Production

```bash
# Build frontend
cd frontend
npm run build

# Le dossier dist/ contient les fichiers statiques
# Les servir avec le backend ou un serveur nginx

# Lancer le backend
cd backend
npm run build
NODE_ENV=production npm start
```
