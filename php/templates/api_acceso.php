<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . "/../includes/config/database.php";

$usuario  = $_POST['usuario'] ?? '';
$resultado = $_POST['resultado'] ?? '';

if (empty($usuario) || !in_array($resultado, ['APROBADO', 'DENEGADO'])) {
    echo json_encode(["success" => false, "message" => "Datos inválidos"]);
    exit;
}

// Buscar usuario_id por nombre
$stmt = $conexion->prepare("SELECT id FROM usuarios WHERE usuario = ?");
$stmt->execute([$usuario]);
$user = $stmt->fetch();

$usuario_id = $user ? $user['id'] : null;

$nombre_display = ($usuario === 'desconocido') ? 'Desconocido' : $usuario;

$stmt = $conexion->prepare("INSERT INTO accesos (usuario_id, nombre_usuario, fecha_hora, resultado) VALUES (?, ?, NOW(), ?)");
$stmt->execute([$usuario_id, $nombre_display, $resultado]);

echo json_encode(["success" => true]);
