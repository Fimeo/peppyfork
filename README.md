# Peppy+

Interface alternative pour réserver ses cours via l'API [Peppy](https://peppy.cool) : planning, suggestions de cours, réservations, statistiques et abonnements.

Le détail des ajouts par rapport à l'application Peppy est dans [AMELIORATIONS.md](AMELIORATIONS.md).

## Lancer

Aucune dépendance, Node 18+ suffit :

```bash
node server.mjs
```

Puis ouvrir http://localhost:5173 et se connecter avec son compte Peppy.

## Données personnelles

Peppy+ n'a ni base de données, ni compte, ni outil de suivi. Tout transite par l'API Peppy :

- **Identifiants** : envoyés uniquement à `api.peppy.cool`, via le petit serveur local qui relaie les requêtes sans rien enregistrer.
- **Dans ton navigateur** (`localStorage`) : le jeton de session Peppy, ton prénom, la salle choisie, les filtres et les suggestions écartées. La déconnexion efface la session.
- **Sur le disque du serveur** : seulement les photos et logos publics du CDN Peppy, mis en cache dans `.cache/img` pour ne pas les retélécharger. Ce dossier peut être supprimé à tout moment.

Les données (planning, réservations, inscrits, factures) sont redemandées à l'API à chaque fois et restent en mémoire le temps de la session.

## Structure

| Fichier | Rôle |
| --- | --- |
| `server.mjs` | Sert l'interface, relaie `/graphql` vers l'API Peppy (avec le cookie de renouvellement du jeton) et met en cache les images (`/img`). |
| `public/app.js` | Application : requêtes GraphQL, état, vues (planning, résas, abonnement, fiche cours). |
| `public/stats.js` | Calcul et rendu des statistiques. |
| `public/styles.css` | Styles. |

## Héberger en ligne

L'API Peppy n'accepte les appels directs que depuis ses propres domaines et `localhost` (CORS). Une page statique sur GitHub Pages ne peut donc pas l'appeler toute seule : il faut garder un relais comme `server.mjs`, par exemple sur un Cloudflare Worker ou tout petit hébergement Node.
