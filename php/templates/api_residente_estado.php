<?php
// Activa/desactiva un residente. Al desactivar, cierra su relación activa con
// el departamento y saca su rostro del reconocimiento facial (se mueve la foto,
// no se borra). Al reactivar, hace lo inverso.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . "/../includes/config/database.php";

$id     = $_POST['id'] ?? '';
$activo = $_POST['activo'] ?? '';

if (empty($id) || !in_array($activo, ['0', '1'], true)) {
    echo json_encode(["success" => false, "message" => "Datos inválidos"]);
    exit;
}

$stmt = $conexion->prepare("SELECT id, nombres, apellidos, activo FROM residentes WHERE id = ?");
$stmt->execute([$id]);
$residente = $stmt->fetch();

if (!$residente) {
    echo json_encode(["success" => false, "message" => "Residente no encontrado"]);
    exit;
}

$nombreCompleto = trim($residente['nombres'] . ' ' . $residente['apellidos']);

try {
    $conexion->beginTransaction();

    $stmt = $conexion->prepare("UPDATE residentes SET activo = ? WHERE id = ?");
    $stmt->execute([$activo, $id]);

    if ($activo === '0') {
        // Cierra la relación activa con su departamento (ya no reside ahí)
        $stmt = $conexion->prepare("
            UPDATE residente_departamento
            SET activo = 0, fecha_fin = CURDATE()
            WHERE residente_id = ? AND activo = 1
        ");
        $stmt->execute([$id]);
    }

    $conexion->commit();
} catch (Exception $e) {
    $conexion->rollBack();
    echo json_encode(["success" => false, "message" => "Error al actualizar el estado del residente."]);
    exit;
}

// Sincroniza el reconocimiento facial (Flask). Si falla, el estado en BD ya
// quedó guardado; se informa igual para que el operador pueda reintentar.
$flaskUrl = ($activo === '0') ? 'http://localhost:5001/delete_face' : 'http://localhost:5001/reactivate_face';
$postData = http_build_query(['name' => $nombreCompleto]);
$contexto = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => $postData,
        'timeout' => 5,
        'ignore_errors' => true,
    ],
]);
$respuestaFlask = @file_get_contents($flaskUrl, false, $contexto);

echo json_encode([
    "success" => true,
    "activo" => $activo,
    "reconocimiento_facial" => $respuestaFlask ? json_decode($respuestaFlask, true) : null,
]);
