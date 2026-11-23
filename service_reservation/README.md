# Service Réservation – PARC AUTO

Responsable : Maryam OUBLAL (groupe G9). Fonctionnalités F001 → F004 du dossier de spécifications, en version « site de réservation » :

- **Site client** (type Goride) : le client choisit ses dates, compare les véhicules du **service Véhicule**, réserve, paie (paiement simulé) et suit ses réservations.
- **Espace agence** (`/admin`) : l'administrateur **consulte et gère** les réservations faites sur le site (confirmation d'un paiement au comptoir, annulation, export CSV). Il ne crée ni ne modifie de réservation.
- **Une seule base** : `db_location_voitures` (dump `Base_de_données/db_location_voitures.sql`), partagée par tous les services.

```text
Navigateur ─► frontend_reservation (nginx, port 3002)
               ├─ /api/reservation/* ─► service_reservation (8002) ─┐
               ├─ /api/auth/*        ─► service_auth (8004)         │  GET /vehicules (HTTP)
               └─ /api/vehicule/*    ─► service_vehicule (8005) ◄───┘  photos /uploads/…
                                              │
                         MySQL : db_location_voitures (base UNIQUE)
```

| Données | Propriétaire | Accès du service Réservation |
|---|---|---|
| `vehicules` (catalogue, prix, statut, photo) | Véhicule | **API** `GET /vehicules`, jamais la table |
| `utilisateurs`, `clients` | Auth | lecture seule des noms/e-mails (`CLIENT_PROVIDER=db`) en attendant `GET /clients` côté Auth |
| `reservations` | Réservation | lecture/écriture (schéma du dump **inchangé**) |
| `reservation_*` (numéros, détails, historique, e-mails, verrous, prolongations) | Réservation | `migrations/006_service_reservation.sql` |

## Parcours

| Écran | Adresse | Accès |
|---|---|---|
| Accueil + recherche par dates | `/` | public |
| Catalogue (disponibilité et prix total sur la période, filtres, tri) | `/vehicules?date_debut=…&date_fin=…` | public |
| Fiche véhicule (dates déjà réservées, devis en direct) | `/vehicules/:id` | public |
| Connexion / création de compte (service Auth) | `/connexion`, `/inscription` | public |
| Vérification (F003) → création `EN_ATTENTE` | `/reserver/:id` | client |
| Paiement simulé ou à l'agence → confirmation (F004) | `/mes-reservations/:id/paiement` | client |
| Mes réservations, détail, annulation, impression | `/mes-reservations[/:id]` | client |
| Gestion des réservations (F001), détail (F003), clients | `/admin/reservations[/:id]`, `/admin/clients[/:id]` | administrateur |

## API

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| GET | `/catalogue/vehicules?date_debut&date_fin&recherche&marque&prix_max&tri&disponibles` | public | Véhicules du service Véhicule (hors `MAINTENANCE`) + `disponible`, `duree_jours`, `prix_estime` |
| GET | `/catalogue/vehicules/{id}?date_debut&date_fin` | public | Fiche + `periodes_reservees` (aucune donnée client) |
| POST | `/reservations/devis` | public | Détail du montant calculé par le serveur, sans enregistrer |
| POST | `/reservations` | **client** | Réservation en ligne → `{"message", "reservation"}` (201, `EN_ATTENTE`). Client = celui du jeton ; un administrateur reçoit 403 |
| POST | `/reservations/{id}/paiement` | propriétaire ou admin | `{"paiement_reussi": true}` → `CONFIRMEE` + e-mail ; `false` → reste `EN_ATTENTE` |
| PUT | `/reservations/{id}/annulation` | propriétaire ou admin | Annulation avant le départ, `{"motif"?}` |
| GET | `/reservations` | lecture* | Tableau JSON (forme historique) ; paginé si `?page=` ; filtres `search, statut, mois, client_id, vehicule_id`. Un client ne voit que les siennes |
| GET | `/reservations/{id}`, `/reservations/numero/{numero}` | lecture* | Lecture canonique (utilisée par Contrat) |
| PATCH | `/reservations/{id}/statut` | admin | `{"statut": "CONFIRMEE" \| "ANNULEE", "motif"?}` (paiement au comptoir, annulation) |
| GET | `/reservations/stats?mois=AAAA-MM`, `/reservations/confirmees` | lecture* | Indicateurs F001, liste F006 de Contrat |
| GET | `/reservations/export.csv?statut&mois&search` | admin | Export Excel (UTF-8 BOM, `;`) |
| POST | `/reservations/{id}/prolongations` | admin ou clé API | Contrat : en-tête `Idempotency-Key`, `{"nouvelle_date_fin"}` |
| GET | `/disponibilites/vehicules[/{id}]`, `/clients[/{id}]` | lecture* / admin | Disponibilités, clients (lecture seule) |

\* sans jeton tant que `LECTURE_PUBLIQUE=true` (Contrat appelle aujourd'hui sans authentification).

`PUT /reservations/{id}` (modification) n'existe plus : 405. Champs toujours présents (TEAM_SYNC §3.2.1) : `id, client_id, vehicule_id, date_debut, date_fin, prix_total, statut`.
Erreurs : `{"detail", "code", "erreurs": [{"champ", "message"}]}` – 401, 403, 404, 409 `vehicule_indisponible`, 422, 503 si le service Véhicule ne répond pas.

## Règles métier

- Période : départ inclus, retour exclu ; départ ≥ aujourd'hui ; retour > départ. Le jour du retour, le véhicule peut repartir.
- Prix calculé **côté serveur** : jours × prix du service Véhicule (+ 6,00 / jour d'assistance), TVA 20 % incluse, dépôt de garantie 500,00.
- Pas de double réservation (`EN_ATTENTE`, `CONFIRMEE`) : verrou par véhicule (`SELECT … FOR UPDATE`) + READ COMMITTED. Deux clients simultanés → un 201, un 409.
- `EN_ATTENTE → CONFIRMEE` (paiement en ligne ou confirmation agence) ; `→ ANNULEE` avant le départ (client ou agence).
- Numéro `RES-AAAA-NNN`, historique avec le **nom** de l'auteur, e-mail de confirmation (un échec n'annule pas la confirmation).
- Paiement **simulé** : aucun numéro de carte n'est demandé ni stocké.

## Lancer

```powershell
# Depuis la racine du dépôt (copier .env.example en .env et remplir les secrets)
docker compose up --build
# Site : http://localhost:3002   Espace agence : http://localhost:3002/admin   API : http://localhost:8002/docs
docker compose exec service_auth python -m service_auth.create_admin   # premier administrateur
```

Les clients créent leur compte sur le site (`/inscription`). Développement sans Docker :

```powershell
pip install -r service_reservation/requirements-dev.txt
$env:DATABASE_URL="mysql+pymysql://location_app:MDP@127.0.0.1:3306/db_location_voitures"
$env:JWT_SECRET="meme-secret-que-service_auth"; uvicorn service_reservation.main:app --port 8002 --reload
cd service_reservation/frontend; npm install; npm run dev   # http://localhost:5173 (relais 8002, 8004, 8005)
```

## Tests

```powershell
python -m pytest service_reservation/tests     # rapide, SQLite (les 2 tests de concurrence MySQL sont ignorés)
$env:TEST_DATABASE_URL="mysql+pymysql://user:mdp@127.0.0.1:3306/db_reservation_test"
python -m pytest service_reservation/tests     # 46 tests sur le schéma officiel (concurrence, catalogue, parcours client, export)
cd service_reservation/frontend; npm test      # 30 tests d'interface (Vitest)
```

Vérifié de bout en bout avec `service_auth` (branche de Laila) et le service Véhicule corrigé (voir `docs/correctif-service-vehicule-base-unique.patch`) sur une seule base MariaDB.

## Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `DATABASE_URL` | `mysql+pymysql://location_app:location_app@127.0.0.1:3306/db_location_voitures` | Base unique de l'équipe |
| `JWT_SECRET` | – | Même secret que `service_auth` |
| `VEHICLE_SERVICE_URL` | `http://127.0.0.1:8005` | API Véhicule (Compose : `http://service_vehicule:8000`) |
| `SERVICE_API_KEYS` | vide | Clés des services appelants `nom:clé,…` (en-tête `X-API-Key`) |
| `LECTURE_PUBLIQUE` | `true` | À passer à `false` quand Contrat enverra sa clé |
| `CLIENT_PROVIDER` | `db` | `http` quand Auth exposera `GET /clients` |
| `DEVISE`, `ASSISTANCE_DAILY_FEE`, `VAT_RATE`, `SECURITY_DEPOSIT` | `€`, `6.00`, `0.20`, `500.00` | Tarifs |
| `EMAIL_BACKEND`, `SMTP_*` | `console` | E-mail de confirmation |
| Front : `VITE_VEHICLE_ASSETS_URL` | `/api/vehicule` | Préfixe des photos `image_url` du service Véhicule |
