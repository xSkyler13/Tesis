-- intentos_no_reconocidos.id no tenía AUTO_INCREMENT: todo INSERT fallaba y
-- ningún rostro desconocido llegaba a registrarse.
-- Además se agrega la revisión del intento desde la página de Incidencias.
ALTER TABLE intentos_no_reconocidos
    MODIFY id INT NOT NULL AUTO_INCREMENT,
    ADD COLUMN estado ENUM('Pendiente', 'Revisado') NOT NULL DEFAULT 'Pendiente' AFTER fecha_hora,
    ADD COLUMN nota VARCHAR(255) NULL AFTER estado,
    ADD COLUMN revisado_por INT NULL AFTER nota,
    ADD COLUMN fecha_revision DATETIME NULL AFTER revisado_por,
    ADD INDEX idx_intentos_fecha (fecha_hora),
    ADD CONSTRAINT fk_intentos_revisado_por FOREIGN KEY (revisado_por) REFERENCES usuarios (id);
