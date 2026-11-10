<?php
// Cierra el vínculo activo de un residente con un departamento (deja de residir
// ahí). El historial se conserva con su fecha_fin.

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_ADMIN);

$residente_id    = $_POST['residente_id'] ?? '';
$departamento_id = $_POST['departamento_id'] ?? '';

if (empty($residente_id) || empty($departamento_id)) {
    echo json_encode(["success" => false, "message" => "Datos inválidos"]);
    exit;
}

$stmt = $conexion->prepare("
    UPDATE residente_departamento
    SET activo = 0, fecha_fin = CURDATE(), cerrado_por_desactivacion = 0
    WHERE residente_id = ? AND departamento_id = ? AND activo = 1
");
$stmt->execute([$residente_id, $departamento_id]);

if ($stmt->rowCount() === 0) {
    echo json_encode(["success" => false, "message" => "El residente no está asignado a ese departamento"]);
    exit;
}

auditar('quitar_departamento', 'residente', $residente_id, "departamento $departamento_id");
echo json_encode(["success" => true]);
