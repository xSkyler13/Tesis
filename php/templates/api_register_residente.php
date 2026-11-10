<?php

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_ADMIN);

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
$foto_base64        = $_POST['foto_base64'] ?? '';
$foto_perfil_base64 = $_POST['foto_perfil_base64'] ?? '';
$consentimiento     = ($_POST['consentimiento_biometrico'] ?? '') === '1';

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

// Ley 29733: sin consentimiento expreso no se guarda el rostro
if (!empty($foto_base64) && !$consentimiento) {
    echo json_encode(["success" => false, "message" => "Falta el consentimiento del residente para usar su rostro"]);
    exit;
}

$ruta_rostro = null;
$foto_perfil = null;

if (!empty($foto_base64)) {
    $data = decodificar_imagen($foto_base64);
    if ($data === null) {
        echo json_encode(["success" => false, "message" => "La foto no es una imagen válida"]);
        exit;
    }
    $nombre_archivo = strtolower(nombre_archivo_seguro($nombres . ' ' . $apellidos));
    $ruta_disco = __DIR__ . '/../../known_faces/' . $nombre_archivo . '.jpg';
    file_put_contents($ruta_disco, $data);
    $ruta_rostro = 'known_faces/' . $nombre_archivo . '.jpg';
    $foto_perfil = $ruta_rostro;
}

// Foto de perfil subida: solo se muestra en el sistema, no entra al
// reconocimiento facial. Si no se sube, se usa la foto del rostro.
if (!empty($foto_perfil_base64)) {
    $data = decodificar_imagen($foto_perfil_base64);
    if ($data === null) {
        echo json_encode(["success" => false, "message" => "La foto de perfil no es una imagen válida"]);
        exit;
    }
    $extension = image_type_to_extension(getimagesizefromstring($data)[2]);
    $carpeta = __DIR__ . '/../../statics/img/residentes';
    if (!is_dir($carpeta)) {
        mkdir($carpeta, 0755, true);
    }
    $nombre_archivo = uniqid('residente_') . $extension;
    file_put_contents($carpeta . '/' . $nombre_archivo, $data);
    $foto_perfil = 'statics/img/residentes/' . $nombre_archivo;
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
        (tipo_residente_id, nombres, apellidos, dni, fecha_nacimiento, sexo, estado_civil, correo, celular, telefono, direccion, foto_perfil, ruta_rostro,
         consentimiento_biometrico, fecha_consentimiento)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? = 1, NOW(), NULL))
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
        $ruta_rostro,
        $ruta_rostro ? 1 : 0,
        $ruta_rostro ? 1 : 0
    ]);
    $residente_id = $conexion->lastInsertId();

    // Solo el Propietario es Titular del departamento; el resto (inquilino,
    // familiar, ocupante) son habitantes y no deben desplazar al titular.
    $stmt = $conexion->prepare("SELECT nombre FROM tipo_residentes WHERE id = ?");
    $stmt->execute([$tipo_residente_id]);
    $tipo_relacion = ($stmt->fetchColumn() === 'Propietario') ? 'Titular' : 'Habitante';

    // RESIDENTE <-> DEPARTAMENTO
    $stmt = $conexion->prepare("
        INSERT INTO residente_departamento
        (residente_id, departamento_id, fecha_inicio, tipo_relacion)
        VALUES (?, ?, CURDATE(), ?)
    ");
    $stmt->execute([$residente_id, $departamento_id, $tipo_relacion]);

    $conexion->commit();

    auditar('crear', 'residente', $residente_id, "$nombres $apellidos" . ($ruta_rostro ? ', con rostro' : ''));
    echo json_encode(["success" => true, "residente_id" => $residente_id]);

} catch (PDOException $e) {
    $conexion->rollBack();
    if ($e->getCode() === '23000') {
        echo json_encode(["success" => false, "message" => "El DNI ya está registrado."]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al registrar residente."]);
    }
} catch (Exception $e) {
    $conexion->rollBack();
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
