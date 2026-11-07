-- Apply once to the shared MySQL database if the central schema does not
-- already create `contrat`. No schema changes are applied automatically.
CREATE TABLE IF NOT EXISTS `contrat` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `numero_contrat` VARCHAR(100) NOT NULL,
  `date_generation` DATE NOT NULL,
  `statut` ENUM('EN_ATTENTE', 'VALIDE', 'CLOTURE') NOT NULL DEFAULT 'EN_ATTENTE',
  `periode_prise` DATE NOT NULL,
  `periode_fin` DATE NOT NULL,
  `montant_total` DOUBLE NOT NULL,
  `reservation_id` BIGINT DEFAULT NULL,
  `client_id` BIGINT NOT NULL,
  `vehicule_id` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_contrat_numero_contrat` (`numero_contrat`),
  UNIQUE KEY `uq_contrat_reservation_id` (`reservation_id`),
  KEY `ix_contrat_client_id` (`client_id`),
  KEY `ix_contrat_vehicule_id` (`vehicule_id`),
  CONSTRAINT `fk_contrat_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservation` (`id`),
  CONSTRAINT `fk_contrat_client` FOREIGN KEY (`client_id`) REFERENCES `client` (`id`),
  CONSTRAINT `fk_contrat_vehicule` FOREIGN KEY (`vehicule_id`) REFERENCES `vehicule` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
