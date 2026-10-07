# Peppy+

Interface alternative pour réserver ses cours via l'API [Peppy](https://peppy.cool) : planning, suggestions de cours, réservations, suivi des perfs, statistiques et abonnements.

Le détail des ajouts par rapport à l'application Peppy est dans [AMELIORATIONS.md](AMELIORATIONS.md).

## Lancer

Aucune dépendance, Node 18+ suffit :

```bash
node server.mjs
```

Puis ouvrir http://localhost:5173 et se connecter avec son compte Peppy.

## Données personnelles

Peppy+ n'a ni base de données, ni compte, ni outil de suivi. Tout transite par l'API Peppy :

- **Identifiants** : envoyés uniquement à `api.peppy.cool`, via le petit relais (`server.mjs` en local, `worker.mjs` en ligne) qui transmet les requêtes sans rien enregistrer.
- **Dans ton navigateur** (`localStorage`) : le jeton de session Peppy, ton prénom, la salle choisie, le filtre « Places dispo », les suggestions écartées, tes pourcentages favoris et la liste des mouvements où tu as des records (pour les charger plus vite). La déconnexion efface la session.
- **En cache** : seulement les photos et logos publics du CDN Peppy, pour ne pas les retélécharger. En local, ils sont dans `.cache/img` (supprimable à tout moment) ; en ligne, dans le cache de Cloudflare.

Les données (planning, réservations, inscrits, perfs, factures) sont redemandées à l'API à chaque fois et restent en mémoire le temps de la session.

## Structure

| Fichier | Rôle |
| --- | --- |
| `server.mjs` | En local : sert l'interface, relaie `/graphql` vers l'API Peppy (avec le cookie de renouvellement du jeton) et met en cache les images (`/img`). |
| `worker.mjs`, `wrangler.jsonc` | La même chose en ligne, sur Cloudflare Workers. |
| `public/app.js` | Application : requêtes GraphQL, état, vues (planning, résas, abonnement, fiche cours). |
| `public/stats.js` | Calcul et rendu des statistiques. |
| `public/perfs.js` | Records, scores de WOD, formulaire d'ajout et calcul des charges. |
| `public/styles.css` | Styles. |
| `docs/peppy-schema.graphql` | Schéma de l'API Peppy, lisible (types, requêtes, mutations). |
| `docs/peppy-schema.json` | Le même schéma brut (introspection GraphQL), pour les outils. |

## Héberger en ligne

L'API Peppy n'accepte les appels directs que depuis ses propres domaines et `localhost` (CORS). Une page statique ne peut donc pas l'appeler toute seule : en ligne, c'est un Cloudflare Worker (`worker.mjs`) qui joue le rôle de relais. Il sert `public/` et transmet `/graphql` et `/img`, comme `server.mjs`.

Il faut un compte Cloudflare (l'offre gratuite suffit), puis :

```bash
npx wrangler login
npx wrangler deploy
```

L'app est alors en ligne sur `https://peppy-plus.<ton-sous-domaine>.workers.dev`. Pour tester la version Worker en local avant de la déployer : `npx wrangler dev`.

**Restreindre l'accès (conseillé).** Sinon, n'importe qui peut utiliser l'adresse comme relais vers Peppy. Dans le tableau de bord Cloudflare : *Workers & Pages* → `peppy-plus` → *Settings* → *Domains & Routes*, activer **Cloudflare Access** sur l'URL `workers.dev` et n'autoriser que ton e-mail. Le Worker ne transmet pas à Peppy le cookie `CF_Authorization` posé par Access.
