-- Apply once to the shared MySQL database after migration 001.
ALTER TABLE `contrat`
  ADD COLUMN `date_validation` DATETIME NULL AFTER `statut`;
