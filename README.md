# Timmo

Plateforme immobilière (location, vente, bureaux) pour le Sénégal —
bilingue français/anglais, double devise FCFA/EUR, avec espaces
dédiés pour les clients, les agences et l'administration.

## 1. Tester le site immédiatement (aucune installation)

1. Dézippez le dossier `timmo`.
2. Ouvrez `index.html` dans votre navigateur (double-clic, ou
   glisser-déposer dans Chrome/Firefox/Safari).
3. Tout fonctionne hors-ligne, sauf : les polices Google Fonts, les
   photos (Unsplash) et la carte (OpenStreetMap/Leaflet), qui ont
   besoin d'une connexion internet pour s'afficher.

> Pour une meilleure expérience (notamment le routage des pages),
> vous pouvez aussi servir le dossier avec un petit serveur local :
> `npx serve timmo` puis ouvrir l'URL affichée.

### Comptes de démonstration

| Rôle       | Email              | Mot de passe |
|------------|---------------------|--------------|
| Client     | client@demo.sn      | demo1234     |
| Agence     | agence@demo.sn      | demo1234     |
| Admin      | admin@demo.sn       | demo1234     |

Vous pouvez aussi créer un nouveau compte client ou agence depuis
`register.html`.

## 2. Structure du projet

```
timmo/
├── index.html              Accueil (recherche, catégories, quartiers, biens en vedette)
├── listings.html           Liste des biens avec filtres et tri
├── property.html           Détail d'un bien : galerie, visite 3D, carte, avis, réservation, paiement
├── login.html / register.html
├── dashboard-client.html   Réservations, favoris, messages, paiements
├── dashboard-agency.html   Annonces (CRUD), demandes de réservation, messages, avis, stats
├── dashboard-admin.html    Vue d'ensemble, utilisateurs, agences, annonces, paiements, modération
├── css/style.css
├── js/
│   ├── i18n.js              Dictionnaire FR/EN
│   ├── currency.js          Conversion FCFA (XOF) / EUR
│   ├── data.js               Données de démonstration (biens, agences, quartiers, photos)
│   ├── db.js                  ⭐ Couche d'accès aux données (voir section 3)
│   ├── firebase-config.js    Adaptateur Firebase (désactivé par défaut)
│   ├── auth.js                Connexion / inscription / session
│   ├── main.js                 En-tête, pied de page, cartes de biens, favoris
│   ├── property.js             Logique de la page détail (visite 3D, carte, formulaires)
│   ├── dashboard-client.js
│   ├── dashboard-agency.js
│   └── dashboard-admin.js
└── server/                  Backend Node.js/Express + MongoDB (optionnel)
    ├── server.js
    ├── routes/properties.js, routes/misc.js
    ├── models/models.js
    └── .env.example
```

## 3. Brancher une vraie base de données

Toute la lecture/écriture de données passe par l'objet `TiDB` défini
dans `js/db.js` (propriétés, utilisateurs, réservations, messages,
avis, paiements, favoris). Cela veut dire que vous pouvez changer de
base de données **sans toucher à aucune page HTML**.

### Option A — Firebase (Firestore + Authentication)

1. Créez un projet sur https://console.firebase.google.com
2. Activez **Firestore Database** et **Authentication** (méthode
   Email/Mot de passe).
3. Dans chaque page HTML, ajoutez avant `js/firebase-config.js` :
   ```html
   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
   ```
4. Collez vos identifiants de projet dans `js/firebase-config.js`
   (`TI_FIREBASE_CONFIG`).
5. Dans `js/db.js`, changez `const TI_BACKEND = "local"` en
   `"firebase"`.

### Option B — Node.js / Express + MongoDB (fourni dans /server)

1. Installez [Node.js](https://nodejs.org) et
   [MongoDB](https://www.mongodb.com/try/download/community) (ou
   utilisez un cluster gratuit [MongoDB Atlas](https://www.mongodb.com/atlas)).
2. Dans le dossier `server/` :
   ```bash
   cp .env.example .env
   # éditez .env avec votre MONGODB_URI et un JWT_SECRET
   npm install
   npm start
   ```
   Le serveur démarre sur `http://localhost:4000`.
3. Dans `js/db.js`, changez `const TI_BACKEND = "local"` en `"api"`
   (et ajustez `TI_API_BASE` si besoin).

Les routes disponibles : `GET/POST /api/properties`,
`DELETE /api/properties/:id`, `GET/POST /api/bookings`,
`PATCH /api/bookings/:id`, `GET/POST /api/messages`,
`GET/POST /api/reviews`, `PATCH /api/reviews/:id`,
`GET/POST /api/payments`, `GET /api/favorites`,
`POST /api/favorites/toggle`, `POST /api/auth/register`,
`POST /api/auth/login`.

## 4. Fonctionnalités incluses

- **Bilingue** FR (par défaut) / EN, bascule instantanée sans recharger la page.
- **Double devise** FCFA (par défaut) / EUR, taux fixe BCEAO (1 € = 655,957 FCFA).
- **Recherche et filtres** : quartier, type de bien, budget, chambres, tri.
- **Galeries photo dédiées par type** de bien (appartement / maison / bureau).
- **Visite virtuelle 3D** : pièce en cube 3D pivotable à la souris/au doigt (CSS 3D, fonctionne hors-ligne).
- **Carte de localisation** interactive (Leaflet + OpenStreetMap).
- **Messagerie** client ↔ agence par bien.
- **Réservation** avec formulaire complet (dates, coordonnées, message).
- **Paiement simulé** (Wave, Orange Money, carte bancaire).
- **Avis et notes** (étoiles), avec modération côté admin.
- **Favoris** sauvegardés par utilisateur.
- **Trois tableaux de bord séparés** : client, agence, administrateur — chacun sur ses propres pages.

## 5. Notes de conception

- Les photos utilisent Unsplash (`images.unsplash.com`) : gratuites,
  libres d'usage, chargées à la demande. Remplacez les URLs dans
  `js/data.js` par vos propres photos de biens quand vous serez en
  production.
- Le mode démo stocke tout dans `localStorage` du navigateur — donc
  chaque navigateur/appareil a ses propres données tant qu'aucun
  backend réel n'est branché.
