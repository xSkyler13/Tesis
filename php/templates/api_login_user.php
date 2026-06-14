<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . "/../includes/config/database.php";

$usuario     = $_POST['usuario'] ?? '';
$password    = $_POST['password'] ?? '';

if (
    empty($usuario) ||
    empty($password)
) {
    echo json_encode([
        "success" => false,
        "message" => "Campos obligatorios"
    ]);
    exit;
}

$sql = "
SELECT
    id,
    usuario,
    password_hash,
    rol_id
FROM
    usuarios
WHERE
    usuario = ?
";
try {
    $stmt = $conexion->prepare($sql);
    $stmt->execute([$usuario]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || !password_verify($password, $user['password_hash'])) {
        echo json_encode([
            "success" => false,
            "message" => "Credenciales inválidas"
        ]);
        exit;
    }

    echo json_encode([
        "success" => true,
        "message" => "Login exitoso",
        "data" => [
            "id" => $user['id'],
            "usuario" => $user['usuario'],
            "rol_id" => $user['rol_id']
        ]
    ]);
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => "Error en la consulta: " . $e->getMessage()
    ]);
}
?>  