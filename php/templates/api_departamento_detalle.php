<?php
// Devuelve un departamento por id, con propietario/responsable activo (si tiene).

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . "/../includes/config/database.php";

$id = $_GET['id'] ?? '';

if (empty($id)) {
    echo json_encode(["success" => false, "message" => "Id no proporcionado"]);
    exit;
}

$stmt = $conexion->prepare("
    SELECT d.*, rd.residente_id AS propietario_id
    FROM departamentos d
    LEFT JOIN residente_departamento rd ON rd.departamento_id = d.id AND rd.activo = 1 AND rd.tipo_relacion = 'Titular'
    WHERE d.id = ?
");
$stmt->execute([$id]);
$departamento = $stmt->fetch();

if (!$departamento) {
    echo json_encode(["success" => false, "message" => "Departamento no encontrado"]);
    exit;
}

echo json_encode(["success" => true, "departamento" => $departamento]);
