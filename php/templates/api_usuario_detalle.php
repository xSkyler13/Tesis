<?php

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_propio_o_admin($_GET['id'] ?? 0);

$id = $_GET['id'] ?? '';

if (empty($id)) {
    echo json_encode(["success" => false, "message" => "Id no proporcionado"]);
    exit;
}

$stmt = $conexion->prepare("SELECT id, usuario, correo, foto_perfil, rol_id FROM usuarios WHERE id = ? AND activo = 1");
$stmt->execute([$id]);
$usuario = $stmt->fetch();

if (!$usuario) {
    echo json_encode(["success" => false, "message" => "Usuario no encontrado"]);
    exit;
}

echo json_encode(["success" => true, "usuario" => $usuario]);
