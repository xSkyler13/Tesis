<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . "/../includes/config/database.php";

$id = $_GET['id'] ?? '';

if (empty($id)) {
    echo json_encode(["success" => false, "message" => "Id no proporcionado"]);
    exit;
}

$stmt = $conexion->prepare("
    SELECT r.*, t.nombre AS torre_nombre, d.numero AS depto_numero
    FROM residentes r
    LEFT JOIN residente_departamento rd ON rd.id = (
        SELECT rd2.id FROM residente_departamento rd2
        WHERE rd2.residente_id = r.id AND rd2.activo = 1
        ORDER BY rd2.id LIMIT 1
    )
    LEFT JOIN departamentos d ON d.id = rd.departamento_id
    LEFT JOIN torres t ON t.id = d.torre_id
    WHERE r.id = ?
");
$stmt->execute([$id]);
$residente = $stmt->fetch();

if (!$residente) {
    echo json_encode(["success" => false, "message" => "Residente no encontrado"]);
    exit;
}

echo json_encode(["success" => true, "residente" => $residente]);
