<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . "/../includes/config/database.php";

$id       = $_POST['id'] ?? '';
$decision = $_POST['decision'] ?? '';

if (empty($id) || !in_array($decision, ['Permitido', 'Denegado'])) {
    echo json_encode(["success" => false, "message" => "Datos inválidos"]);
    exit;
}

$stmt = $conexion->prepare("SELECT id FROM visitas WHERE id = ? AND estado = 'Pendiente'");
$stmt->execute([$id]);
if (!$stmt->fetch()) {
    echo json_encode(["success" => false, "message" => "La visita no existe o ya fue resuelta"]);
    exit;
}

$stmt = $conexion->prepare("UPDATE visitas SET estado = ? WHERE id = ?");
$stmt->execute([$decision, $id]);

echo json_encode(["success" => true, "estado" => $decision]);
