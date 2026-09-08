<?php
// Devuelve los usuarios con rol Administrador, activos, para asignarlos como
// administrador de una torre.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . "/../includes/config/database.php";

$sql = "
SELECT u.id, u.usuario
FROM usuarios u
INNER JOIN roles r ON r.id = u.rol_id
WHERE r.nombre = 'Administrador' AND u.activo = 1
ORDER BY u.usuario
";

$resultado = $conexion->query($sql);

$datos = [];

while ($fila = $resultado->fetch()) {
    $datos[] = $fila;
}

echo json_encode($datos);
