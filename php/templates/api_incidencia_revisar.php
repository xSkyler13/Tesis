<?php
// Marca un intento no reconocido como Revisado (con una nota opcional del
// vigilante) o lo devuelve a Pendiente. Guarda quién y cuándo lo revisó.

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_PERSONAL);

$id     = $_POST['id'] ?? '';
$estado = $_POST['estado'] ?? '';
$nota   = trim($_POST['nota'] ?? '');

if (empty($id) || !in_array($estado, ['Pendiente', 'Revisado'], true)) {
    echo json_encode(["success" => false, "message" => "Datos inválidos"]);
    exit;
}

if (strlen($nota) > 255) {
    echo json_encode(["success" => false, "message" => "La nota no puede superar los 255 caracteres"]);
    exit;
}

if ($estado === 'Revisado') {
    $stmt = $conexion->prepare("
        UPDATE intentos_no_reconocidos
        SET estado = 'Revisado', nota = ?, revisado_por = ?, fecha_revision = NOW()
        WHERE id = ?
    ");
    $stmt->execute([$nota ?: null, $AUTH['id'], $id]);
} else {
    $stmt = $conexion->prepare("
        UPDATE intentos_no_reconocidos
        SET estado = 'Pendiente', nota = ?, revisado_por = NULL, fecha_revision = NULL
        WHERE id = ?
    ");
    $stmt->execute([$nota ?: null, $id]);
}

$stmt = $conexion->prepare("SELECT id FROM intentos_no_reconocidos WHERE id = ?");
$stmt->execute([$id]);
if (!$stmt->fetch()) {
    echo json_encode(["success" => false, "message" => "La incidencia no existe"]);
    exit;
}

auditar('revisar', 'incidencia', $id, $estado);
echo json_encode(["success" => true, "estado" => $estado]);
