<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . "/../includes/config/database.php";

$usuario     = $_POST['usuario'] ?? '';
$correo      = $_POST['correo'] ?? '';
$password    = $_POST['password'] ?? '';
$rol         = $_POST['rol_id'] ?? '';
$foto_base64 = $_POST['foto_base64'] ?? '';

$ruta_rostro = null;

if (!empty($foto_base64)) {
    $data = preg_replace('#^data:image/\w+;base64,#i', '', $foto_base64);
    $data = base64_decode($data);
    $nombre_archivo = $usuario . '.jpg';
    $ruta_disco = __DIR__ . '/../../known_faces/' . $nombre_archivo;
    file_put_contents($ruta_disco, $data);
    $ruta_rostro = 'known_faces/' . $nombre_archivo;
}

if (
    empty($usuario) ||
    empty($correo) ||
    empty($password) ||
    empty($rol)
) {
    echo json_encode([
        "success" => false,
        "message" => "Campos obligatorios"
    ]);
    exit;
}

$passwordHash = password_hash(
    $password,
    PASSWORD_DEFAULT
);

$sql = "
INSERT INTO usuarios
(
    usuario,
    correo,
    password_hash,
    rol_id,
    ruta_rostro
)
VALUES
(
    ?, ?, ?, ?, ?
)
";

try {

    $stmt = $conexion->prepare($sql);

    $stmt->execute([
        $usuario,
        $correo,
        $passwordHash,
        $rol,
        $ruta_rostro
    ]);

    echo json_encode(["success" => true]);

} catch (PDOException $e) {

    if ($e->getCode() === '23000') {
        echo json_encode(["success" => false, "message" => "El usuario o correo ya existe."]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al registrar usuario."]);
    }

}