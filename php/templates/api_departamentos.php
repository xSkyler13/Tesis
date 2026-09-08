<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . "/../includes/config/database.php";

$torre_id = $_GET['torre_id'] ?? '';

if (empty($torre_id)) {
    echo json_encode([]);
    exit;
}

$stmt = $conexion->prepare(
    "SELECT * FROM departamentos WHERE torre_id = ? AND estado = 'Activo' ORDER BY numero"
);
$stmt->execute([$torre_id]);

$datos = [];

while ($fila = $stmt->fetch()) {
    $datos[] = $fila;
}

echo json_encode($datos);
