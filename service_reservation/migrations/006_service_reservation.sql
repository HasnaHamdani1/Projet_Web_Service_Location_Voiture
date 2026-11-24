-- Service Réservation : tables propres au service (la table partagée `reservations` n'est pas modifiée).
-- Appliquée par Compose à la création du volume MySQL ; le service crée aussi ces tables au démarrage
-- si elles manquent (volume existant). Généré depuis service_reservation/models.py.
USE db_location_voitures;

CREATE TABLE IF NOT EXISTS reservation_details (
	reservation_id BIGINT NOT NULL, 
	numero VARCHAR(20) NOT NULL, 
	`heureDebut` TIME NOT NULL, 
	`heureFin` TIME NOT NULL, 
	`dureeJours` INTEGER NOT NULL, 
	assistance BOOL NOT NULL, 
	`tarifJournalier` NUMERIC(10, 2) NOT NULL, 
	`tarifAssistance` NUMERIC(10, 2) NOT NULL, 
	`montantLocation` NUMERIC(10, 2) NOT NULL, 
	`montantAssistance` NUMERIC(10, 2) NOT NULL, 
	`montantProlongations` NUMERIC(10, 2) NOT NULL, 
	`montantTva` NUMERIC(10, 2) NOT NULL, 
	`depotGarantie` NUMERIC(10, 2) NOT NULL, 
	devise VARCHAR(10) NOT NULL, 
	`vehiculeMarque` VARCHAR(100) NOT NULL, 
	`vehiculeModele` VARCHAR(100) NOT NULL, 
	`vehiculeImmatriculation` VARCHAR(50) NOT NULL, 
	`vehiculeCategorie` VARCHAR(50), 
	`vehiculeBoite` VARCHAR(30), 
	`vehiculeCarburant` VARCHAR(30), 
	`clientNom` VARCHAR(100), 
	`clientEmail` VARCHAR(150), 
	`clientTelephone` VARCHAR(20), 
	`motifAnnulation` VARCHAR(500), 
	`creePar` VARCHAR(120), 
	`dateCreation` DATETIME NOT NULL, 
	`dateModification` DATETIME NOT NULL, 
	`dateConfirmation` DATETIME, 
	`dateAnnulation` DATETIME, 
	PRIMARY KEY (reservation_id), 
	FOREIGN KEY(reservation_id) REFERENCES reservations (id) ON DELETE CASCADE, 
	UNIQUE (numero)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS reservation_evenements (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	reservation_id BIGINT NOT NULL, 
	type VARCHAR(30) NOT NULL, 
	message VARCHAR(255) NOT NULL, 
	auteur VARCHAR(120), 
	`dateEvenement` DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(reservation_id) REFERENCES reservations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS reservation_compteurs (
	annee INTEGER NOT NULL, 
	`dernierNumero` INTEGER NOT NULL, 
	PRIMARY KEY (annee)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS reservation_verrous (
	vehicule_id BIGINT NOT NULL, 
	PRIMARY KEY (vehicule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS reservation_prolongations (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	reservation_id BIGINT NOT NULL, 
	`cleIdempotence` VARCHAR(100) NOT NULL, 
	`dateFinPrecedente` DATE NOT NULL, 
	`dateFin` DATE NOT NULL, 
	`joursSupplementaires` INTEGER NOT NULL, 
	`montantSupplementaire` NUMERIC(10, 2) NOT NULL, 
	`demandePar` VARCHAR(120), 
	`dateCreation` DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(reservation_id) REFERENCES reservations (id) ON DELETE CASCADE, 
	UNIQUE (`cleIdempotence`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS reservation_emails (
	id BIGINT NOT NULL AUTO_INCREMENT, 
	reservation_id BIGINT, 
	destinataire VARCHAR(150) NOT NULL, 
	sujet VARCHAR(255) NOT NULL, 
	statut VARCHAR(20) NOT NULL, 
	erreur TEXT, 
	`dateEnvoi` DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(reservation_id) REFERENCES reservations (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
