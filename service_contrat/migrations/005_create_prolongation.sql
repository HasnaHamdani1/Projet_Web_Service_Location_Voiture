-- Apply once to the shared MySQL database after the base schema and migrations 002-004.
CREATE TABLE `prolongations` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `contrat_id` BIGINT NOT NULL,
  `reservation_prolongation_id` BIGINT NOT NULL,
  `idempotency_key` VARCHAR(36) NOT NULL,
  `date_fin_precedente` DATE NOT NULL,
  `date_fin` DATE NOT NULL,
  `montant_supplementaire` DOUBLE NOT NULL,
  `date_creation` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_prolongation_reservation_id` (`reservation_prolongation_id`),
  UNIQUE KEY `uq_prolongation_idempotency_key` (`idempotency_key`),
  KEY `ix_prolongations_contrat_id` (`contrat_id`),
  CONSTRAINT `fk_prolongations_contrat` FOREIGN KEY (`contrat_id`) REFERENCES `contrats` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
