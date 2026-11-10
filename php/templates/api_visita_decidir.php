<?php

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_PERSONAL);

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

auditar('decidir', 'visita', $id, $decision);
echo json_encode(["success" => true, "estado" => $decision]);
