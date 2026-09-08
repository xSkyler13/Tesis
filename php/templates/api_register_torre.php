<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . "/../includes/config/database.php";

$nombre               = trim($_POST['nombre'] ?? '');
$codigo               = trim($_POST['codigo'] ?? '');
$direccion            = trim($_POST['direccion'] ?? '');
$numero_pisos         = $_POST['numero_pisos'] ?? null;
$numero_departamentos = $_POST['numero_departamentos'] ?? null;
$descripcion          = trim($_POST['descripcion'] ?? '');
$administrador_id     = $_POST['administrador_id'] ?? null;
$observaciones        = trim($_POST['observaciones'] ?? '');
$estado               = $_POST['estado'] ?? 'Activo';
$imagen_base64        = $_POST['imagen_base64'] ?? '';

if (empty($nombre) || empty($direccion) || empty($codigo) || empty($numero_pisos)) {
    echo json_encode([
        "success" => false,
        "message" => "Campos obligatorios incompletos"
    ]);
    exit;
}

$activo = ($estado === 'Activo') ? 1 : 0;
$administrador_id = !empty($administrador_id) ? $administrador_id : null;

$imagen_path = null;
if (!empty($imagen_base64)) {
    $data = preg_replace('#^data:image/\w+;base64,#i', '', $imagen_base64);
    $data = base64_decode($data);
    $nombre_archivo = preg_replace('/[^a-z0-9_]/', '_', strtolower($codigo)) . '_' . time() . '.jpg';
    $dir_disco = __DIR__ . '/../../statics/img/torres/';
    if (!is_dir($dir_disco)) {
        mkdir($dir_disco, 0755, true);
    }
    file_put_contents($dir_disco . $nombre_archivo, $data);
    $imagen_path = 'statics/img/torres/' . $nombre_archivo;
}

try {
    $stmt = $conexion->prepare("
        INSERT INTO torres
        (nombre, codigo, direccion, numero_pisos, numero_departamentos, descripcion, imagen, administrador_id, observaciones, activo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $nombre,
        $codigo,
        $direccion,
        $numero_pisos,
        $numero_departamentos ?: null,
        $descripcion ?: null,
        $imagen_path,
        $administrador_id,
        $observaciones ?: null,
        $activo
    ]);

    echo json_encode(["success" => true, "torre_id" => $conexion->lastInsertId()]);

} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        echo json_encode(["success" => false, "message" => "El nombre o código de torre ya existe."]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al registrar la torre."]);
    }
}
