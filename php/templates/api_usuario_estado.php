<?php
// Activa o desactiva un usuario del sistema. Un usuario desactivado no puede
// iniciar sesión y, si tenía una sesión abierta, se cierra en su próxima acción.

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_ADMIN);

$id     = (int) ($_POST['id'] ?? 0);
$activo = $_POST['activo'] ?? '';

if (!$id || !in_array($activo, ['0', '1'], true)) {
    echo json_encode(["success" => false, "message" => "Datos inválidos"]);
    exit;
}

$stmt = $conexion->prepare("SELECT usuario, rol_id FROM usuarios WHERE id = ?");
$stmt->execute([$id]);
$usuario = $stmt->fetch();
if (!$usuario) {
    echo json_encode(["success" => false, "message" => "Usuario no encontrado"]);
    exit;
}

if ($activo === '0') {
    if ($id === $AUTH['id']) {
        echo json_encode(["success" => false, "message" => "No puedes desactivar tu propia cuenta"]);
        exit;
    }
    if ((int) $usuario['rol_id'] === ROL_ADMINISTRADOR && admins_activos($id) === 0) {
        echo json_encode(["success" => false, "message" => "Debe quedar al menos un administrador activo"]);
        exit;
    }
}

$stmt = $conexion->prepare("UPDATE usuarios SET activo = ? WHERE id = ?");
$stmt->execute([$activo, $id]);

auditar($activo === '1' ? 'reactivar' : 'desactivar', 'usuario', $id, $usuario['usuario']);
echo json_encode(["success" => true]);
