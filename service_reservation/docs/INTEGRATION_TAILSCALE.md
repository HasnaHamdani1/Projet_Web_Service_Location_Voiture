# Relier le service Réservation aux autres services avec Tailscale

Chacune lance **son** service sur **sa** machine ; les services s'appellent par leurs API REST
avec les adresses Tailscale (`tailscale ip -4`). Toutes utilisent **la même base MySQL**,
hébergée par Hasna : c'est la consigne « une seule base », et c'est indispensable car une réservation
référence un client (`clients`) et un véhicule (`vehicules`) qui doivent exister dans la même base.

| Machine | Ce qu'elle lance | Adresse pour les autres (à vérifier avec `tailscale ip -4`) |
|---|---|---|
| Hasna | MySQL `db_location_voitures` (+ service Retour) | `<IP-Hasna>:3306` |
| Leila | Véhicule, Auth, tableau de bord admin | `100.112.66.13` : Véhicule `:8005`, Auth `:8014`, tableau de bord `:3000` |
| Maryam | Réservation (API + site client + espace agence) | `<IP-Maryam>` : API `:8002`, site `:3002` |
| Sara | Contrat | `<IP-Sara>:8003` |

Une machine éteinte = son service indisponible pour les autres. Pour la démonstration, gardez les quatre machines allumées et connectées à Tailscale.

## 1. Hasna – la base partagée

1. Lancer MySQL avec le port publié (dans sa copie de `compose.yaml`, service `mysql`) :
   ```yaml
   ports:
     - "3306:3306"
   ```
   puis `docker compose up -d mysql`. Au premier démarrage, le dump et les migrations montées sont appliqués.
2. Appliquer la migration du service Réservation si elle n'est pas montée (une seule fois) :
   ```powershell
   Get-Content service_reservation\migrations\006_service_reservation.sql | docker compose exec -T mysql mysql -ulocation_app -p<mot-de-passe> db_location_voitures
   ```
   (le service Réservation crée aussi ses tables `reservation_*` tout seul s'il les trouve absentes).
3. Autoriser le port 3306 dans le pare-feu Windows (réseau Tailscale) et envoyer **en privé** à chacune :
   `DATABASE_URL=mysql+pymysql://location_app:<mot-de-passe>@<IP-Hasna>:3306/db_location_voitures`

## 2. Leila – Véhicule, Auth et tableau de bord

1. **Véhicule et Auth sur la base partagée** (`DATABASE_URL` de Hasna).
2. **Véhicule doit utiliser la table `vehicules` du dump** (aujourd'hui : table `vehicule` créée par `create_all`).
   Sinon un véhicule ajouté dans le tableau de bord ne peut pas être réservé (Réservation répond 422 « véhicule inconnu »).
   Correctif prêt : `service_reservation/docs/correctif-service-vehicule-base-unique.patch` (`git apply --ignore-whitespace …`).
3. Envoyer **en privé** à Maryam le `JWT_SECRET` du service Auth (les jetons sont vérifiés avec ce secret).
4. Menu « Réservations » du tableau de bord : ouvrir l'espace agence de Maryam avec le jeton de l'admin connecté.
   À ajouter à la fin de `frontend/admin/admin.js` et de `frontend/admin/dashboard.js` :
   ```js
   // Menu « Réservations » : espace agence du service Réservation (Maryam), déjà connecté
   const SITE_RESERVATION = "http://<IP-Tailscale-de-Maryam>:3002";
   document.querySelectorAll(".sidebar-link").forEach((lien) => {
       if (!lien.textContent.includes("Réservations")) return;
       lien.addEventListener("click", (evenement) => {
           evenement.preventDefault();
           const jeton = sessionStorage.getItem("adminToken");
           window.open(`${SITE_RESERVATION}/admin/reservations#jeton=${encodeURIComponent(jeton)}`, "_blank");
       });
   });
   ```
   Le jeton passe dans l'ancre (`#…`) : il n'est pas envoyé aux serveurs, et le site l'efface de l'adresse dès qu'il l'a vérifié auprès de `/auth/me`.

## 3. Maryam – le service Réservation

```powershell
cd service_reservation
copy .env.example .env
notepad .env        # DATABASE_URL de Hasna, JWT_SECRET de Leila, clés pour Sara et Hasna
docker compose up --build -d
docker compose ps   # service_reservation « healthy », frontend_reservation « Up »
```

- Générer une clé par service appelant et la mettre dans `SERVICE_API_KEYS=contrats:<clé>,retours:<clé>` :
  ```powershell
  -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | % {[char]$_})
  ```
- Donner à chacune son adresse : API `http://<IP-Maryam>:8002` (documentation : `/docs`), site `http://<IP-Maryam>:3002`.
- Les ports 8002 et 3002 doivent être autorisés dans le pare-feu Windows.

## 4. Sara – Contrat appelle Réservation

- `.env` du service Contrat : `RESERVATION_SERVICE_URL=http://<IP-Maryam>:8002` et la clé reçue en privé.
- Envoyer la clé dans `service_contrat/reservation_client.py` :
  ```python
  def _entetes() -> dict:
      cle = os.getenv("RESERVATION_API_KEY", "").strip()
      return {"X-API-Key": cle} if cle else {}
  # puis : httpx.get(f"{_base_url()}/reservations/{reservation_id}", headers=_entetes(), timeout=timeout)
  ```
- Créer un contrat seulement pour une réservation `CONFIRMEE` (`GET /reservations/{id}` ou `GET /reservations/confirmees`).

## 5. Hasna – Retour (si besoin des informations de réservation)

`GET http://<IP-Maryam>:8002/reservations/{reservation_id}` avec l'en-tête `X-API-Key: <clé retours>`.
Le contrat de Sara contient `reservation_id`.

## API utiles du service Réservation

| Route | Accès | Usage |
|---|---|---|
| `GET /reservations/{id}` | clé ou admin | une réservation : `id, client_id, vehicule_id, date_debut, date_fin, prix_total, statut`, `numero`, `client`, `vehicule` |
| `GET /reservations/confirmees` | clé ou admin | réservations confirmées (création des contrats) |
| `GET /reservations/numero/{numero}` | clé ou admin | recherche par `RES-2026-001` |
| `GET /reservations?client_id=…&vehicule_id=…` | clé ou admin | liste (tableau JSON) |
| `GET /catalogue/vehicules?date_debut&date_fin` | public | véhicules de Leila + disponibilité sur la période |

Tant que `LECTURE_PUBLIQUE=true`, les lectures marchent aussi sans clé ; passer à `false` quand Sara et Hasna envoient leur clé.

## Vérifier que tout est relié

1. `http://100.112.66.13:8005/vehicules` répond depuis la machine de Maryam (Véhicule joignable).
2. Le site `http://<IP-Maryam>:3002/vehicules` affiche les véhicules ajoutés par Leila.
3. Un client crée son compte sur le site (enregistré par Auth dans la base partagée), réserve et paie.
4. L'admin se connecte sur le tableau de bord de Leila, clique « Réservations » : la réservation apparaît.
5. Sara crée le contrat de cette réservation ; le retour de Hasna le clôture.
