# DIT Analytics v4

Deux dashboards indépendants avec les mêmes filtres :

- **Tickets entrants** : une ligne logique par `DIT no interne`.
- **Interventions** : une ligne logique par `IT N°`.

Les délais et `IT Durée` du dashboard Interventions utilisent une seule valeur par IT. Les valeurs répétées ne sont jamais additionnées. La charge technicien est la somme des durées des IT uniques.

## Commandes
```bash
npm install
npm run dev
npm run build
npm run preview
```

## GitHub Pages
Sélectionner `Settings > Pages > GitHub Actions`, puis envoyer le projet sur `main`.
