-- Ley 29733 (Protección de Datos Personales, Perú): el rostro es un dato sensible
-- y su tratamiento requiere consentimiento expreso. Se registra si se otorgó y cuándo.
ALTER TABLE residentes
    ADD COLUMN consentimiento_biometrico TINYINT(1) NOT NULL DEFAULT 0 AFTER ruta_rostro,
    ADD COLUMN fecha_consentimiento DATETIME NULL AFTER consentimiento_biometrico;
