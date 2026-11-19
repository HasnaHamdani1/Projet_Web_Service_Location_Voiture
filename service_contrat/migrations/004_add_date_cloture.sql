-- Apply once to the shared MySQL database after migrations 002 and 003.
ALTER TABLE `contrats`
  ADD COLUMN `date_cloture` DATETIME NULL AFTER `date_enregistrement_caution`;
