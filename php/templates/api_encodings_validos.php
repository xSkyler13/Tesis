<?php
// Devuelve los identificadores validos para reconocimiento facial:
// nombre completo de residentes activos + usuario de cuentas de staff activas.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . "/../includes/config/database.php";

$nombres = [];

$stmt = $conexion->query("SELECT CONCAT(nombres, ' ', apellidos) AS nombre FROM residentes WHERE activo = 1");
while ($fila = $stmt->fetch()) {
    $nombres[] = $fila['nombre'];
}

$stmt = $conexion->query("SELECT usuario AS nombre FROM usuarios WHERE activo = 1");
while ($fila = $stmt->fetch()) {
    $nombres[] = $fila['nombre'];
}

echo json_encode($nombres);
