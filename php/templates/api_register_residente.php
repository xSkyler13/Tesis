<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . "/../includes/config/database.php";

$nombres            = $_POST['nombres'] ?? '';
$apellidos          = $_POST['apellidos'] ?? '';
$dni                = $_POST['dni'] ?? '';
$fecha_nacimiento   = $_POST['fecha_nacimiento'] ?? null;
$sexo               = $_POST['sexo'] ?? null;
$estado_civil       = $_POST['estado_civil'] ?? null;
$correo             = $_POST['correo'] ?? null;
$celular            = $_POST['celular'] ?? null;
$telefono           = $_POST['telefono'] ?? null;
$direccion          = $_POST['direccion'] ?? null;
$departamento_id    = $_POST['departamento_id'] ?? '';
$tipo_residente_id  = $_POST['tipo_residente_id'] ?? '';
$tipo_relacion      = 'Titular';
$foto_base64        = $_POST['foto_base64'] ?? '';

if (
    empty($nombres) ||
    empty($apellidos) ||
    empty($dni) ||
    empty($departamento_id) ||
    empty($tipo_residente_id)
) {
    echo json_encode([
        "success" => false,
        "message" => "Campos obligatorios incompletos"
    ]);
    exit;
}

$ruta_rostro = null;
$foto_perfil = null;

if (!empty($foto_base64)) {
    $data = preg_replace('#^data:image/\w+;base64,#i', '', $foto_base64);
    $data = base64_decode($data);
    $nombre_archivo = $nombres . ' ' . $apellidos;
    $nombre_archivo = preg_replace('/\s+/', '_', $nombre_archivo);
    $nombre_archivo = strtolower($nombre_archivo);
    $ruta_disco = __DIR__ . '/../../known_faces/' . $nombre_archivo . '.jpg';
    file_put_contents($ruta_disco, $data);
    $ruta_rostro = 'known_faces/' . $nombre_archivo . '.jpg';
    $foto_perfil = $ruta_rostro;
}

try {
    $conexion->beginTransaction();

    // TIPO_RESIDENTE: validar que exista
    $stmt = $conexion->prepare("SELECT id FROM tipo_residentes WHERE id = ?");
    $stmt->execute([$tipo_residente_id]);
    if (!$stmt->fetch()) {
        throw new Exception("Tipo de residente inválido");
    }

    // DEPARTAMENTO: debe existir (la creación de torres/departamentos es un flujo aparte)
    $stmt = $conexion->prepare("SELECT id FROM departamentos WHERE id = ? AND estado = 'Activo'");
    $stmt->execute([$departamento_id]);
    if (!$stmt->fetch()) {
        throw new Exception("El departamento seleccionado no existe o no está activo");
    }

    // RESIDENTE
    $stmt = $conexion->prepare("
        INSERT INTO residentes
        (tipo_residente_id, nombres, apellidos, dni, fecha_nacimiento, sexo, estado_civil, correo, celular, telefono, direccion, foto_perfil, ruta_rostro)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $tipo_residente_id,
        $nombres,
        $apellidos,
        $dni,
        $fecha_nacimiento ?: null,
        $sexo,
        $estado_civil,
        $correo,
        $celular,
        $telefono,
        $direccion,
        $foto_perfil,
        $ruta_rostro
    ]);
    $residente_id = $conexion->lastInsertId();

    // RESIDENTE <-> DEPARTAMENTO
    $stmt = $conexion->prepare("
        INSERT INTO residente_departamento
        (residente_id, departamento_id, fecha_inicio, tipo_relacion)
        VALUES (?, ?, CURDATE(), ?)
    ");
    $stmt->execute([$residente_id, $departamento_id, $tipo_relacion]);

    $conexion->commit();

    echo json_encode(["success" => true, "residente_id" => $residente_id]);

} catch (PDOException $e) {
    $conexion->rollBack();
    if ($e->getCode() === '23000') {
        echo json_encode(["success" => false, "message" => "El DNI ya está registrado."]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al registrar propietario."]);
    }
} catch (Exception $e) {
    $conexion->rollBack();
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
