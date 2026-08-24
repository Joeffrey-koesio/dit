# DIT Analytics

Application React/TypeScript d'analyse locale des exports d'interventions.

## Démarrage

```bash
npm install
npm run dev
```

## Production

```bash
npm run build
npm run preview
```

## Règles principales

- Regroupement en `O(n)` par `DIT no interne`.
- Un ticket est compté une seule fois dans les indicateurs globaux.
- Les durées de prise en charge, réponse et résolution ne sont jamais additionnées.
- `IT Durée` est cumulée entre les lignes d'un même DIT.
- Les opérateurs et intervenants sont conservés sous forme de listes uniques.
- Les traitements restent dans le navigateur.

## Prudence d'interprétation

Les vues par personne décrivent les volumes et délais présents dans le fichier. Elles ne mesurent pas la qualité du travail, la difficulté des tickets ou la satisfaction client.
