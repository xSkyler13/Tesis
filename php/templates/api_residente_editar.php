<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . "/../includes/config/database.php";

$id                 = $_POST['id'] ?? '';
$tipo_residente_id  = $_POST['tipo_residente_id'] ?? '';
$nombres            = trim($_POST['nombres'] ?? '');
$apellidos          = trim($_POST['apellidos'] ?? '');
$dni                = trim($_POST['dni'] ?? '');
$fecha_nacimiento   = $_POST['fecha_nacimiento'] ?? null;
$sexo               = $_POST['sexo'] ?? null;
$estado_civil       = $_POST['estado_civil'] ?? null;
$correo             = trim($_POST['correo'] ?? '');
$celular            = trim($_POST['celular'] ?? '');
$telefono           = trim($_POST['telefono'] ?? '');
$direccion          = trim($_POST['direccion'] ?? '');

if (empty($id) || empty($tipo_residente_id) || empty($nombres) || empty($apellidos) || empty($dni)) {
    echo json_encode(["success" => false, "message" => "Campos obligatorios incompletos"]);
    exit;
}

try {
    $stmt = $conexion->prepare("SELECT id FROM tipo_residentes WHERE id = ?");
    $stmt->execute([$tipo_residente_id]);
    if (!$stmt->fetch()) {
        throw new Exception("Tipo de residente inválido");
    }

    $stmt = $conexion->prepare("
        UPDATE residentes
        SET tipo_residente_id = ?, nombres = ?, apellidos = ?, dni = ?, fecha_nacimiento = ?,
            sexo = ?, estado_civil = ?, correo = ?, celular = ?, telefono = ?, direccion = ?
        WHERE id = ?
    ");
    $stmt->execute([
        $tipo_residente_id,
        $nombres,
        $apellidos,
        $dni,
        $fecha_nacimiento ?: null,
        $sexo ?: null,
        $estado_civil ?: null,
        $correo ?: null,
        $celular ?: null,
        $telefono ?: null,
        $direccion ?: null,
        $id
    ]);

    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        echo json_encode(["success" => false, "message" => "Ese DNI ya está registrado en otro residente."]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al actualizar el residente."]);
    }
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
