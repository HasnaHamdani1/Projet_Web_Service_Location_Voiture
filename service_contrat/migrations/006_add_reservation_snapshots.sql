-- Apply once after the shared Base_de_données/db_location_voitures.sql dump.
-- The base contrats table has no client or vehicle snapshot columns, but the
-- Contract API needs them to preserve ownership and the immutable contract terms.
ALTER TABLE `contrats`
  ADD COLUMN `client_id` BIGINT NOT NULL AFTER `reservation_id`,
  ADD COLUMN `vehicule_id` BIGINT NOT NULL AFTER `client_id`;
