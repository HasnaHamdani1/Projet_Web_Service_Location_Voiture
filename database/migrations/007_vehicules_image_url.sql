-- Service Véhicule : photo du véhicule dans la table partagée `vehicules`
ALTER TABLE vehicules ADD COLUMN image_url VARCHAR(500) NULL AFTER statut;
