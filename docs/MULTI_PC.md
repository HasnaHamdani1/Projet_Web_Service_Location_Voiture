# PARC AUTO – un service par PC

Chaque membre lance **son** service sur **son** PC. Les services communiquent uniquement par leurs API REST et utilisent **une seule base MySQL**, hébergée sur le PC de Hasna.

| PC | Fichier à lancer | Ce qui tourne | Ports à ouvrir |
|---|---|---|---|
| Hasna | `compose.hasna.yaml` | base MySQL commune, API Retour, interface Retours | 3306, 8006, 5173 |
| Leila | `compose.leila.yaml` | API Véhicule, API Auth, frontend commun (accueil, espace client, administration, pages Contrat) | 8005, 8004, 3000 |
| Maryam | `compose.maryam.yaml` | API Réservation | 8002 |
| Sara | `compose.sara.yaml` | API Contrat | 8003 |

Pour tout lancer sur un seul PC, utiliser `compose.yaml` (branche `main`) : rien de ce guide n'est nécessaire.

## Les trois conditions

1. **Une seule base.** Elle tourne chez Hasna, port 3306 ouvert. Tous les services s'y connectent, donc les clés étrangères entre tables (réservation → véhicule, contrat → réservation…) fonctionnent.
2. **Le même fichier `.env` chez les quatre.** Mêmes mots de passe MySQL, même `JWT_SECRET`, mêmes clés d'API, mêmes adresses IP. Sinon les jetons de connexion ou les clés sont refusés.
3. **Chacune lance seulement son fichier compose.** Les adresses des autres PC sont lues dans `.env`, jamais écrites dans le code.

Les PC doivent pouvoir se joindre : même réseau (Wi-Fi de la fac, partage de connexion…). Les variables `IP_…` acceptent n'importe quelle adresse joignable.

## Étape 1 – Récupérer la même version (les 4 PC)

```powershell
git checkout main
git pull
```

Tout le monde lance depuis `main`, pour avoir le même code partout. Les branches personnelles servent à développer chaque service.

## Étape 2 – Noter les adresses IP (les 4 PC)

Sur chaque PC, dans PowerShell :

```powershell
ipconfig
```

Relever l'« Adresse IPv4 » de la carte réseau utilisée (Wi-Fi ou Ethernet), par exemple `192.168.1.13`. Envoyer les 4 adresses dans le groupe.

## Étape 3 – Créer le même `.env` (une personne le fait, les autres le copient)

```powershell
copy .env.example .env
notepad .env
```

À remplir :

```
MYSQL_PASSWORD=...            # lettres et chiffres uniquement
MYSQL_ROOT_PASSWORD=...
JWT_SECRET=...                # longue chaîne aléatoire
RESERVATION_SERVICE_API_KEYS=contrats:<clé 1>
CONTRAT_RESERVATION_API_KEY=<clé 1>
VEHICULE_SERVICE_API_KEYS=retours:<clé 2>
RETOUR_VEHICULE_API_KEY=<clé 2>
CONTRAT_SERVICE_API_KEYS=retours:<clé 3>
RETOUR_CONTRAT_API_KEY=<clé 3>
IP_LEILA=192.168.1.10
IP_MARYAM=192.168.1.11
IP_SARA=192.168.1.12
IP_HASNA=192.168.1.13
```

Générer une valeur aléatoire (pour `JWT_SECRET`, puis pour chaque clé) :

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | % {[char]$_})
```

Partager ce `.env` en privé (jamais dans Git) : les quatre doivent avoir exactement le même.

## Étape 4 – Ouvrir les ports (chaque PC, PowerShell **administrateur**)

Hasna :

```powershell
New-NetFirewallRule -DisplayName "PARC AUTO" -Direction Inbound -Protocol TCP -LocalPort 3306,8006,5173 -Action Allow
```

Leila :

```powershell
New-NetFirewallRule -DisplayName "PARC AUTO" -Direction Inbound -Protocol TCP -LocalPort 8004,8005,3000 -Action Allow
```

Maryam :

```powershell
New-NetFirewallRule -DisplayName "PARC AUTO" -Direction Inbound -Protocol TCP -LocalPort 8002 -Action Allow
```

Sara :

```powershell
New-NetFirewallRule -DisplayName "PARC AUTO" -Direction Inbound -Protocol TCP -LocalPort 8003 -Action Allow
```

Pour retirer la règle après la séance : `Remove-NetFirewallRule -DisplayName "PARC AUTO"`.

## Étape 5 – Lancer, dans cet ordre

1. **Hasna** (la base doit démarrer en premier) :
   ```powershell
   docker compose -f compose.hasna.yaml up -d --build
   ```
2. **Leila** :
   ```powershell
   docker compose -f compose.leila.yaml up -d --build
   docker compose -f compose.leila.yaml exec service_auth python -m service_auth.create_admin
   ```
   À lancer 4 fois : un administrateur par service (la commande demande le service : 1 Véhicules, 2 Réservations, 3 Contrats, 4 Retours). Chaque administrateur ne voit et ne gère que son service.
3. **Maryam** :
   ```powershell
   docker compose -f compose.maryam.yaml up -d --build
   ```
4. **Sara** :
   ```powershell
   docker compose -f compose.sara.yaml up -d --build
   ```

Chacune vérifie avec `docker compose -f compose.<prénom>.yaml ps` : tout doit être `healthy`.

Pour arrêter : `docker compose -f compose.<prénom>.yaml down`. Hasna ajoute `-v` seulement pour effacer la base et repartir de zéro.

## Étape 6 – Vérifier que les PC se voient

Depuis n'importe quel PC (remplacer par les vraies adresses) :

```powershell
curl.exe http://192.168.1.10:8005/health   # Véhicule (Leila)
curl.exe http://192.168.1.10:8004/health   # Auth (Leila)
curl.exe http://192.168.1.11:8002/health   # Réservation (Maryam)
curl.exe http://192.168.1.12:8003/health   # Contrat (Sara)
curl.exe http://192.168.1.13:8006/health   # Retour (Hasna, connecté à la base)
```

Chaque commande doit répondre `{"status":"ok"…}`.

## Étape 7 – Utiliser l'application

Depuis n'importe quel PC du réseau, ouvrir le frontend commun chez Leila :

- Accueil et catalogue : `http://<IP_LEILA>:3000`
- Espace client : `http://<IP_LEILA>:3000/client.html`
- Administration : `http://<IP_LEILA>:3000/admin/login.html` (menus Véhicules, Réservations, Contrats, Retours)

Les pages trouvent les API des autres PC grâce à `config.js`, généré au démarrage du frontend à partir de `.env`.

## En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| Un service redémarre en boucle, logs `Can't connect to MySQL server on '192.168…'` | Base de Hasna pas démarrée, mauvaise `IP_HASNA` ou port 3306 fermé | Vérifier `docker compose -f compose.hasna.yaml ps` chez Hasna, l'IP et le pare-feu |
| `Access denied for user 'location_app'` | Mot de passe différent de celui avec lequel la base a été créée | Même `.env` partout ; sinon Hasna relance avec `down -v` puis `up -d` |
| Connexion refusée ou `401` sur des pages qui marchaient | `JWT_SECRET` différent entre Leila et les autres | Même `.env` partout, puis relancer les services |
| Le service Contrat ne lit pas les réservations (401) | Clé `contrats:` différente de `CONTRAT_RESERVATION_API_KEY` | Même clé des deux côtés |
| `curl` vers un autre PC ne répond pas | Pare-feu ou réseau différent | Refaire l'étape 4, vérifier que tout le monde est sur le même réseau |
| Une adresse IP a changé (nouveau Wi-Fi) | `ipconfig` donne une autre adresse | Mettre à jour `.env` chez les quatre, puis relancer chaque compose |

Voir les logs d'un service : `docker compose -f compose.<prénom>.yaml logs --tail 40 <service>`.
