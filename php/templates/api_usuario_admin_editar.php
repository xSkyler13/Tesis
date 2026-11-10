<?php
// Un administrador edita a otro usuario: datos, rol y, opcionalmente,
// restablece su contraseña (sin pedir la actual, que solo conoce el usuario).

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_ADMIN);

$id             = (int) ($_POST['id'] ?? 0);
$usuario        = trim($_POST['usuario'] ?? '');
$correo         = trim($_POST['correo'] ?? '');
$rol            = (int) ($_POST['rol_id'] ?? 0);
$password_nueva = $_POST['password_nueva'] ?? '';

$stmt = $conexion->prepare("SELECT id, rol_id, activo FROM usuarios WHERE id = ?");
$stmt->execute([$id]);
$actual = $stmt->fetch();
if (!$actual) {
    echo json_encode(["success" => false, "message" => "Usuario no encontrado"]);
    exit;
}

$error = validar_datos_usuario($usuario, $correo, $rol);
if ($error === null && $password_nueva !== '' && strlen($password_nueva) < 8) {
    $error = "La nueva contraseña debe tener al menos 8 caracteres";
}
// Quitar el rol de administrador: nunca a uno mismo ni al último administrador activo
if ($error === null && (int) $actual['rol_id'] === ROL_ADMINISTRADOR && $rol !== ROL_ADMINISTRADOR) {
    if ($id === $AUTH['id']) {
        $error = "No puedes quitarte tu propio rol de administrador";
    } elseif ($actual['activo'] && admins_activos($id) === 0) {
        $error = "Debe quedar al menos un administrador activo";
    }
}
if ($error !== null) {
    echo json_encode(["success" => false, "message" => $error]);
    exit;
}

try {
    $campos = "usuario = ?, correo = ?, rol_id = ?";
    $params = [$usuario, $correo, $rol];
    if ($password_nueva !== '') {
        $campos .= ", password_hash = ?";
        $params[] = password_hash($password_nueva, PASSWORD_DEFAULT);
    }
    $params[] = $id;
    $stmt = $conexion->prepare("UPDATE usuarios SET $campos WHERE id = ?");
    $stmt->execute($params);

    $detalle = "usuario: $usuario, rol: $rol" . ($password_nueva !== '' ? ', contraseña restablecida' : '');
    auditar('editar', 'usuario', $id, $detalle);
    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        echo json_encode(["success" => false, "message" => "El usuario o el correo ya existe."]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al actualizar el usuario."]);
    }
}
