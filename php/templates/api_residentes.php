<?php
// Devuelve residentes activos, para asignarlos como propietario/responsable
// de un departamento.

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_ADMIN);

$sql = "
SELECT id, CONCAT(nombres, ' ', apellidos) AS nombre
FROM residentes
WHERE activo = 1
ORDER BY nombre
";

$resultado = $conexion->query($sql);

$datos = [];

while ($fila = $resultado->fetch()) {
    $datos[] = $fila;
}

echo json_encode($datos);
