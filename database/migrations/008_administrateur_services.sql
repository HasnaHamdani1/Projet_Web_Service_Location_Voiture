-- Service Auth : service géré par chaque administrateur (périmètre des droits).
-- VEHICULE (Leila), RESERVATION (Maryam), CONTRAT (Sara), RETOUR (Hasna).
-- Tout administrateur peut consulter ; seul l'administrateur du service peut agir dans ce service.
CREATE TABLE IF NOT EXISTS administrateur_services (
  administrateur_id BIGINT(20) NOT NULL,
  service ENUM('VEHICULE','RESERVATION','CONTRAT','RETOUR') NOT NULL,
  PRIMARY KEY (administrateur_id),
  CONSTRAINT fk_administrateur_service FOREIGN KEY (administrateur_id)
    REFERENCES administrateurs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
