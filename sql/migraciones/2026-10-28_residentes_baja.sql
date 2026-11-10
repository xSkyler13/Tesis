-- Distingue a un residente dado de baja definitivamente (se mudó) de uno
-- desactivado temporalmente. Al reactivarlo se vuelve a NULL.
ALTER TABLE residentes
    ADD COLUMN fecha_baja DATE NULL AFTER activo;
