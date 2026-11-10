<?php
// Crea un usuario del sistema (personal con acceso web). Solo administradores.

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_ADMIN);

$usuario  = trim($_POST['usuario'] ?? '');
$correo   = trim($_POST['correo'] ?? '');
$password = $_POST['password'] ?? '';
$rol      = (int) ($_POST['rol_id'] ?? 0);

$error = validar_datos_usuario($usuario, $correo, $rol);
if ($error === null && strlen($password) < 8) {
    $error = "La contraseña debe tener al menos 8 caracteres";
}
if ($error !== null) {
    echo json_encode(["success" => false, "message" => $error]);
    exit;
}

try {
    $stmt = $conexion->prepare("INSERT INTO usuarios (usuario, correo, password_hash, rol_id) VALUES (?, ?, ?, ?)");
    $stmt->execute([$usuario, $correo, password_hash($password, PASSWORD_DEFAULT), $rol]);
    $nuevoId = $conexion->lastInsertId();

    auditar('crear', 'usuario', $nuevoId, "usuario: $usuario, rol: $rol");
    echo json_encode(["success" => true, "id" => $nuevoId]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        echo json_encode(["success" => false, "message" => "El usuario o el correo ya existe."]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al registrar el usuario."]);
    }
}
