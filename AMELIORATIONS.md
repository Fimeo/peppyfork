# Améliorations de Peppy+

Ce que Peppy+ ajoute à l'application Peppy, et les problèmes rencontrés en route avec l'API.

## Interface

### Planning (accueil)

- **Prochaine séance en tête de page** : jour, heure, type de cours et délai (« dans 4 jours »). Un clic ouvre la fiche du cours.
- **Minuteur d'annulation** : le jour de la séance, un sablier affiche le temps restant pour annuler (« 1:19 pour annuler »), seconde par seconde, puis « Annulation fermée ». L'heure limite vient des règles de la salle (2 h avant le cours chez Primal Athletic).
- **Compteurs de la semaine affichée** : séances réservées par rapport au quota de l'abonnement (« Séances semaine prochaine 0/3 ») et réservations en cours par rapport à la limite de la salle (« Résas en cours 1/4 »).
- **Jauge de remplissage** : une case par place, qui change de couleur quand le cours se remplit. Elle indique les places restantes, la liste d'attente et le surbooking (« Complet · 1 en surnombre »).
- **Filtres** par type de cours et « Places dispo », mémorisés d'une visite à l'autre.
- **Journée déjà prise** : si tu as déjà une séance réservée ce jour-là, les autres cours sont atténués et sans bouton Réserver.
- **Boutons clairs** : Réserver, « + Liste d'attente » (action) distinct du statut « Attente #2 », et Annuler en rouge.
- **WOD du jour** affiché au-dessus des cours, en blocs repliables.
- Navigation au clavier (← →) entre les jours, rafraîchissement automatique des places toutes les 60 s.

### Suggestions de cours pour s'inscrire en un clic

- Peppy+ repère tes habitudes sur les 8 dernières semaines : même jour, même type de cours, à 1 h près, au moins 2 semaines sur 8.
- Il propose **2 cours à la fois** sur les 2 semaines à venir, avec un bouton Réserver ou « + Attente » direct.
- Les suggestions se renouvellent au fil de l'eau : dès que tu réserves ou que tu passes une suggestion (×), la suivante prend la place.
- Elles respectent le quota de l'abonnement : une semaine déjà pleine (3/3) n'est plus proposée, ni un jour où tu as déjà une séance. Les cours avec des places libres passent avant les cours complets.

### Fiche d'un cours

- **Minuteur détaillé** : temps restant pour annuler et heure limite.
- **Inscrits avec leur photo**, présence confirmée (✓), liste d'attente dans l'ordre, et ta propre place mise en avant.
- **Invités** : les drop-in et séances d'essai, comptés par la salle mais invisibles pour les membres, apparaissent en « +1 invité · drop-in / essai ».
- **Photo agrandie au survol** d'un avatar, avec le nom complet.
- Bouton « Je suis là » pour confirmer sa présence sur place (géolocalisation), dans la fenêtre prévue par la salle.

### Mes réservations

- Séances à venir avec le délai (« dans 4 jours ») et le bouton Annuler.
- Historique des 90 derniers jours, groupé par mois, avec la date complète (jour, mois, année).

### Statistiques

Calculées sur **toutes les séances, tous abonnements confondus** :

- Total, séances de l'année et comparaison avec l'an dernier à la même date.
- Semaines actives, série en cours, meilleure série, moyenne par semaine, semaines au quota.
- **Bilan** : heures d'entraînement, meilleur mois, meilleure semaine, **coût moyen par séance** (total payé en abonnements et cartes ÷ séances).
- Carte des semaines actives (façon GitHub), séances par mois, par jour, par heure, par type de cours.
- Habitudes : créneau favori, **délai moyen de réservation** et part réservée le jour même, annulations (dont tardives), listes d'attente ratées, présences confirmées.
- **Partenaires d'entraînement** : les personnes croisées le plus souvent sur tes 30 dernières séances. Calcul à la demande seulement (bouton), car il faut une requête par séance.

### Abonnement

- Abonnement en cours : séances de la semaine, quotas, séances faites avec cet abonnement.
- **Documents** : contrat adhérent (PDF) et historique des paiements de chaque abonnement, avec le total payé.
- **Règles de la salle** en clair : quotas, délai d'annulation, fin des inscriptions, ouverture du planning, confirmation sur place, liste d'attente.
- **Anciens abonnements** (expirés) dans un bloc repliable.
- **Autres achats** (caisse) repliables, avec le total et le nom des produits.

## Technique

- **Aucune dépendance** : un serveur Node de 80 lignes et du JavaScript natif.
- **Cache des images** : le CDN Peppy n'envoie aucun `Cache-Control`. Le serveur local garde photos et logos sur disque et les renvoie avec un cache d'un an (`immutable`). Après le premier affichage, plus rien n'est retéléchargé.
- **Session longue** : le jeton d'accès dure 1 h. Le serveur relaie le cookie de renouvellement de Peppy, ce qui permet de le renouveler sans redemander le mot de passe.
- **Économie de requêtes** : les inscrits des séances passées sont gardés en mémoire pendant la session (ils ne changent plus).
- Aucune donnée personnelle stockée côté serveur (voir le [README](README.md#données-personnelles)).

## Problèmes rencontrés avec l'API Peppy

| Problème | Conséquence | Solution |
| --- | --- | --- |
| Le champ `createdAt` d'une réservation fait échouer `getSlots` en entier. | La liste des inscrits était toujours vide (« Liste non visible »). | Champ retiré de la requête. |
| `getSlots` ne renvoie plus un cours une fois qu'il a commencé. | Plus d'inscrits sur le cours en cours ou passé. | Passage par `getSlot(id)`, qui fonctionne pour tous les cours. |
| Deux adresses de CDN coexistent (`peppy-prod-cdn.s3.eu-west-3.amazonaws.com` et `peppy-prod-cdn.s3.amazonaws.com`). | Certaines photos refusées par le cache (erreur 400). | Les deux formes sont acceptées, avec repli sur les initiales si une photo ne charge pas. |
| Le CDN n'envoie ni `Cache-Control` ni bon type de fichier (`application/octet-stream`). | Photos revérifiées à chaque affichage. | Cache disque et détection du format (JPEG, PNG, WebP…) dans le serveur local. |
| Les drop-in ne sont pas lisibles par les membres (`Slot.dropin` fait échouer la requête). | Le compteur dit 14/14 mais seuls 13 noms sont visibles. | Écart affiché comme « +1 invité · drop-in / essai ». |
| L'API n'autorise que ses propres domaines et `localhost` (CORS). | Impossible d'héberger l'interface seule sur GitHub Pages. | Le relais `server.mjs` reste nécessaire. |
| Le logo de la salle est blanc sur fond transparent. | Invisible sur le fond blanc prévu. | Fond sombre derrière le logo. |
| Un abonnement « expiré » de 3 minutes, sans séance (erreur de saisie de la salle). | Bruit dans la liste des abonnements. | Les abonnements expirés de moins d'un jour sans séance sont masqués. |
| Les classements (`getMyRankingStats`) et les coachs des cours sont vides pour cette salle. | Pas de stats de performance ni de coach préféré. | Non exploités. |
