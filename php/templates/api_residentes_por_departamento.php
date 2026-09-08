<?php
// Residentes activos de un departamento (para elegir al anfitrión de una visita).

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . "/../includes/config/database.php";

$departamento_id = $_GET['departamento_id'] ?? '';

if (empty($departamento_id)) {
    echo json_encode([]);
    exit;
}

$stmt = $conexion->prepare("
    SELECT r.id, CONCAT(r.nombres, ' ', r.apellidos) AS nombre, r.celular, r.correo
    FROM residentes r
    INNER JOIN residente_departamento rd ON rd.residente_id = r.id
    WHERE rd.departamento_id = ? AND rd.activo = 1 AND r.activo = 1
    ORDER BY nombre
");
$stmt->execute([$departamento_id]);

$datos = [];
while ($fila = $stmt->fetch()) {
    $datos[] = $fila;
}

echo json_encode($datos);
