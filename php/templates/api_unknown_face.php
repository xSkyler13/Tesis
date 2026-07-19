<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . "/../includes/config/database.php";

$foto_base64 = $_POST['foto_base64'] ?? '';

if (empty($foto_base64)) {
    echo json_encode(["success" => false, "message" => "Sin imagen"]);
    exit;
}

$fecha = date('Y-m-d_H-i-s');
$nombre_archivo = "desconocido_" . $fecha . ".jpg";
$ruta_disco = __DIR__ . "/../unknown_faces/" . $nombre_archivo;

$data = preg_replace('#^data:image/\w+;base64,#i', '', $foto_base64);
$data = base64_decode($data);
file_put_contents($ruta_disco, $data);

$ruta_db = "unknown_faces/" . $nombre_archivo;

$stmt = $conexion->prepare("INSERT INTO intentos_no_reconocidos (foto_path, fecha_hora) VALUES (?, NOW())");
$stmt->execute([$ruta_db]);

echo json_encode(["success" => true]);
