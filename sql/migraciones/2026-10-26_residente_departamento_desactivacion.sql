-- Marca los vínculos residente-departamento que se cerraron al desactivar al
-- residente, para poder restaurarlos cuando se lo reactive.
ALTER TABLE residente_departamento
    ADD COLUMN cerrado_por_desactivacion TINYINT(1) NOT NULL DEFAULT 0 AFTER activo;
