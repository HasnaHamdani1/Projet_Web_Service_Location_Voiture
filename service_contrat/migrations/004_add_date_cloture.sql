-- Apply once to the shared MySQL database after migrations 001 through 003.
ALTER TABLE `contrat`
  ADD COLUMN `date_cloture` DATETIME NULL AFTER `date_enregistrement_caution`;
