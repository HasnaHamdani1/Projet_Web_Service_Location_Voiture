-- Apply once to the shared MySQL database after migrations 001 and 002.
ALTER TABLE `contrat`
  ADD COLUMN `montant_caution` DOUBLE NULL AFTER `date_validation`,
  ADD COLUMN `date_enregistrement_caution` DATETIME NULL AFTER `montant_caution`;
