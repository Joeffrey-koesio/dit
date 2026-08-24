# DIT Analytics

Dashboard React/TypeScript pour analyser localement les exports DIT.

## Fonctions

- Import Excel, XLS ou CSV.
- Consolidation par `DIT no interne`.
- KPI de prise en charge, réponse et résolution.
- Filtres collaborateur, UO (`DIT Domaine lib`), agence et état.
- Graphiques par UO, agence, état et collaborateur.
- Export Excel des données filtrées.
- Traitement local dans le navigateur.

## Démarrage local

```bash
npm install
npm run dev
```

## Tester la version de production

```bash
npm run build
npm run preview
```

Ne pas tester `dist/index.html` par double-clic. Il faut utiliser `npm run preview`.

## Déploiement GitHub Pages

Le workflow `.github/workflows/deploy.yml` compile et publie automatiquement à chaque envoi sur `main`.

Dans le dépôt GitHub :

1. Ouvrir `Settings`.
2. Ouvrir `Pages`.
3. Dans `Source`, sélectionner `GitHub Actions`.
4. Envoyer tout ce projet sur la branche `main`.

Le chemin Vite est déjà configuré pour le dépôt `dit` avec `base: '/dit/'`.
