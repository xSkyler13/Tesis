-- Registro de auditoría: quién hizo qué, cuándo y desde qué IP.
CREATE TABLE IF NOT EXISTS auditoria (
    id INT NOT NULL AUTO_INCREMENT,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT NULL,
    usuario VARCHAR(100) NULL,
    accion VARCHAR(50) NOT NULL,
    entidad VARCHAR(50) NOT NULL,
    entidad_id INT NULL,
    detalle VARCHAR(500) NULL,
    ip VARCHAR(45) NULL,
    PRIMARY KEY (id),
    INDEX idx_auditoria_fecha (fecha),
    INDEX idx_auditoria_entidad (entidad, entidad_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- La app puede escribir auditoría pero NO modificarla ni borrarla: un usuario
-- (o un atacante con acceso a la app) no puede borrar sus huellas.
-- Por eso UPDATE/DELETE se otorgan tabla por tabla, sin incluir auditoria.
-- Si se crea una tabla nueva, hay que darle UPDATE/DELETE explícitamente.
REVOKE ALL PRIVILEGES ON control_acceso.* FROM 'app_acceso'@'%';
GRANT SELECT, INSERT ON control_acceso.* TO 'app_acceso'@'%';
GRANT UPDATE, DELETE ON control_acceso.accesos TO 'app_acceso'@'%';
GRANT UPDATE, DELETE ON control_acceso.departamentos TO 'app_acceso'@'%';
GRANT UPDATE, DELETE ON control_acceso.intentos_no_reconocidos TO 'app_acceso'@'%';
GRANT UPDATE, DELETE ON control_acceso.residente_departamento TO 'app_acceso'@'%';
GRANT UPDATE, DELETE ON control_acceso.residentes TO 'app_acceso'@'%';
GRANT UPDATE, DELETE ON control_acceso.roles TO 'app_acceso'@'%';
GRANT UPDATE, DELETE ON control_acceso.tipo_residentes TO 'app_acceso'@'%';
GRANT UPDATE, DELETE ON control_acceso.torres TO 'app_acceso'@'%';
GRANT UPDATE, DELETE ON control_acceso.usuarios TO 'app_acceso'@'%';
GRANT UPDATE, DELETE ON control_acceso.visitas TO 'app_acceso'@'%';
FLUSH PRIVILEGES;
