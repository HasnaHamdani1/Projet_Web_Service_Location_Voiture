-- Apply once to the shared MySQL database after the base schema import.
ALTER TABLE `contrats`
  ADD COLUMN `date_validation` DATETIME NULL AFTER `statut`;
