<?php

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_ADMIN);

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
$foto_perfil_base64 = $_POST['foto_perfil_base64'] ?? '';

if (empty($id) || empty($tipo_residente_id) || empty($nombres) || empty($apellidos) || empty($dni)) {
    echo json_encode(["success" => false, "message" => "Campos obligatorios incompletos"]);
    exit;
}

// Foto de perfil nueva (opcional): solo para mostrar, no toca ruta_rostro
$foto_perfil = null;
if (!empty($foto_perfil_base64)) {
    $data = decodificar_imagen($foto_perfil_base64);
    if ($data === null) {
        echo json_encode(["success" => false, "message" => "La foto de perfil no es una imagen válida"]);
        exit;
    }
    $foto_perfil = $data;
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

    if ($foto_perfil !== null) {
        $stmt = $conexion->prepare("SELECT foto_perfil FROM residentes WHERE id = ?");
        $stmt->execute([$id]);
        $anterior = $stmt->fetchColumn();

        $carpeta = __DIR__ . '/../../statics/img/residentes';
        if (!is_dir($carpeta)) {
            mkdir($carpeta, 0755, true);
        }
        $nombre_archivo = uniqid('residente_') . image_type_to_extension(getimagesizefromstring($foto_perfil)[2]);
        file_put_contents($carpeta . '/' . $nombre_archivo, $foto_perfil);

        $stmt = $conexion->prepare("UPDATE residentes SET foto_perfil = ? WHERE id = ?");
        $stmt->execute(['statics/img/residentes/' . $nombre_archivo, $id]);

        // Borra la foto subida anterior; nunca la del reconocimiento (known_faces/)
        if ($anterior) {
            $archivo = realpath(__DIR__ . '/../../' . $anterior);
            if ($archivo && strpos($archivo, realpath($carpeta) . DIRECTORY_SEPARATOR) === 0) {
                @unlink($archivo);
            }
        }
    }

    auditar('editar', 'residente', $id, $foto_perfil !== null ? 'incluye foto de perfil' : null);
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
