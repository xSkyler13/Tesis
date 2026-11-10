<?php

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_interno();

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
    rol_id,
    activo
FROM
    usuarios
WHERE
    usuario = ?
";
try {
    $stmt = $conexion->prepare($sql);
    $stmt->execute([$usuario]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Un usuario desactivado recibe el mismo mensaje: no se revela que la cuenta existe
    if (!$user || !password_verify($password, $user['password_hash']) || !$user['activo']) {
        $motivo = ($user && !$user['activo']) ? ' (cuenta desactivada)' : '';
        auditar('login_fallido', 'usuario', $user['id'] ?? null, "usuario: $usuario$motivo", $user['id'] ?? null);
        echo json_encode([
            "success" => false,
            "message" => "Credenciales inválidas"
        ]);
        exit;
    }

    auditar('login', 'usuario', $user['id'], null, $user['id']);
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
        "message" => "Error al iniciar sesión."
    ]);
}
?>  