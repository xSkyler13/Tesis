<?php
// Registra un intento de acceso de una persona no reconocida (lo llama Flask).
// La foto queda en statics/img/no_reconocidos/, visible solo con sesión, para
// revisarla desde la página de Incidencias.

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_interno();

$foto_base64 = $_POST['foto_base64'] ?? '';

if (empty($foto_base64)) {
    echo json_encode(["success" => false, "message" => "Sin imagen"]);
    exit;
}

$data = decodificar_imagen($foto_base64);
if ($data === null) {
    echo json_encode(["success" => false, "message" => "Imagen inválida"]);
    exit;
}

$carpeta = __DIR__ . '/../../statics/img/no_reconocidos';
if (!is_dir($carpeta)) {
    mkdir($carpeta, 0755, true);
}
$nombre_archivo = 'desconocido_' . date('Y-m-d_H-i-s') . '_' . uniqid() . '.jpg';
file_put_contents($carpeta . '/' . $nombre_archivo, $data);

$stmt = $conexion->prepare("INSERT INTO intentos_no_reconocidos (foto_path, fecha_hora) VALUES (?, NOW())");
$stmt->execute(['statics/img/no_reconocidos/' . $nombre_archivo]);

echo json_encode(["success" => true, "id" => $conexion->lastInsertId()]);
