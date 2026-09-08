<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . "/../includes/config/database.php";

$id                  = $_POST['id'] ?? '';
$usuario             = trim($_POST['usuario'] ?? '');
$correo              = trim($_POST['correo'] ?? '');
$password_actual     = $_POST['password_actual'] ?? '';
$password_nueva      = $_POST['password_nueva'] ?? '';
$foto_base64         = $_POST['foto_base64'] ?? '';

if (empty($id) || empty($usuario)) {
    echo json_encode(["success" => false, "message" => "Campos obligatorios incompletos"]);
    exit;
}

$foto_perfil = null;
if (!empty($foto_base64)) {
    $data = preg_replace('#^data:image/\w+;base64,#i', '', $foto_base64);
    $data = base64_decode($data);
    $carpeta = __DIR__ . '/../../statics/img/usuarios';
    if (!is_dir($carpeta)) {
        mkdir($carpeta, 0755, true);
    }
    $nombre_archivo = 'usuario_' . $id . '_' . uniqid() . '.jpg';
    file_put_contents($carpeta . '/' . $nombre_archivo, $data);
    $foto_perfil = 'statics/img/usuarios/' . $nombre_archivo;
}

$stmt = $conexion->prepare("SELECT id, password_hash FROM usuarios WHERE id = ? AND activo = 1");
$stmt->execute([$id]);
$actual = $stmt->fetch();

if (!$actual) {
    echo json_encode(["success" => false, "message" => "Usuario no encontrado"]);
    exit;
}

// Cambiar contraseña es opcional, pero si se pide, hay que validar la actual primero
$nuevoHash = null;
if (!empty($password_nueva)) {
    if (empty($password_actual) || !password_verify($password_actual, $actual['password_hash'])) {
        echo json_encode(["success" => false, "message" => "La contraseña actual no es correcta"]);
        exit;
    }
    if (strlen($password_nueva) < 6) {
        echo json_encode(["success" => false, "message" => "La nueva contraseña debe tener al menos 6 caracteres"]);
        exit;
    }
    $nuevoHash = password_hash($password_nueva, PASSWORD_DEFAULT);
}

try {
    $campos = "usuario = ?, correo = ?";
    $params = [$usuario, $correo ?: null];

    if ($foto_perfil) {
        $campos .= ", foto_perfil = ?";
        $params[] = $foto_perfil;
    }
    if ($nuevoHash) {
        $campos .= ", password_hash = ?";
        $params[] = $nuevoHash;
    }
    $params[] = $id;

    $stmt = $conexion->prepare("UPDATE usuarios SET $campos WHERE id = ?");
    $stmt->execute($params);

    $stmt = $conexion->prepare("SELECT foto_perfil FROM usuarios WHERE id = ?");
    $stmt->execute([$id]);
    $fotoActual = $stmt->fetch()['foto_perfil'];

    echo json_encode(["success" => true, "usuario" => $usuario, "foto_perfil" => $fotoActual]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        echo json_encode(["success" => false, "message" => "Ese nombre de usuario ya está en uso."]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al actualizar la cuenta."]);
    }
}
