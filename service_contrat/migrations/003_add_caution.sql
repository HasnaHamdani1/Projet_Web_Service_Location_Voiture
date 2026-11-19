-- Apply once to the shared MySQL database after migrations 002.
ALTER TABLE `contrats`
  ADD COLUMN `montant_caution` DOUBLE NULL AFTER `date_validation`,
  ADD COLUMN `date_enregistrement_caution` DATETIME NULL AFTER `montant_caution`;
