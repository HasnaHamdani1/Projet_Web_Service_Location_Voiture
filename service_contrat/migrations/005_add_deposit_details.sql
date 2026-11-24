ALTER TABLE contrats
    ADD COLUMN modeEncaissement VARCHAR(20) NULL,
    ADD COLUMN statutCaution VARCHAR(20) NULL,
    ADD COLUMN conditionsParticulieres VARCHAR(1000) NULL;
