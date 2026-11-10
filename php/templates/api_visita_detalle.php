<?php
// Devuelve una visita por id (con torre_id del departamento) para editarla.

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_PERSONAL);

$id = $_GET['id'] ?? '';

if (empty($id)) {
    echo json_encode(["success" => false, "message" => "Id no proporcionado"]);
    exit;
}

$stmt = $conexion->prepare("
    SELECT v.*, d.torre_id, d.numero AS depto_numero,
        CONCAT(r.nombres, ' ', r.apellidos) AS anfitrion
    FROM visitas v
    INNER JOIN departamentos d ON d.id = v.departamento_id
    INNER JOIN residentes r ON r.id = v.residente_id
    WHERE v.id = ?
");
$stmt->execute([$id]);
$visita = $stmt->fetch();

if (!$visita) {
    echo json_encode(["success" => false, "message" => "Visita no encontrada"]);
    exit;
}

echo json_encode(["success" => true, "visita" => $visita]);
