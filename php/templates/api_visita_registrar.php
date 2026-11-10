<?php

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_PERSONAL);

$tipo_visita            = trim($_POST['tipo_visita'] ?? '');
$motivo                 = trim($_POST['motivo'] ?? '');
$fecha_visita           = $_POST['fecha_visita'] ?? '';
$hora_ingreso           = $_POST['hora_ingreso'] ?? '';
$tiempo_estimado        = trim($_POST['tiempo_estimado'] ?? '');
$numero_visitantes      = $_POST['numero_visitantes'] ?? 1;
$autorizacion_residente = $_POST['autorizacion_residente'] ?? 'Si';
$via_autorizacion       = trim($_POST['via_autorizacion'] ?? '');
$departamento_id        = $_POST['departamento_id'] ?? '';
$residente_id           = $_POST['residente_id'] ?? '';
$nombres_visitante      = trim($_POST['nombres_visitante'] ?? '');
$tipo_documento         = trim($_POST['tipo_documento'] ?? 'DNI');
$sexo                   = $_POST['sexo'] ?? '';
$numero_documento       = trim($_POST['numero_documento'] ?? '');
$fecha_nacimiento       = $_POST['fecha_nacimiento'] ?? null;
$telefono               = trim($_POST['telefono'] ?? '');
$correo                 = trim($_POST['correo'] ?? '');
$parentesco             = trim($_POST['parentesco'] ?? '');
$direccion              = trim($_POST['direccion'] ?? '');
$empresa                = trim($_POST['empresa'] ?? '');
$observaciones          = trim($_POST['observaciones'] ?? '');
$foto_base64            = $_POST['foto_documento_base64'] ?? '';

if (
    empty($tipo_visita) || empty($motivo) || empty($fecha_visita) || empty($hora_ingreso) ||
    empty($autorizacion_residente) || empty($via_autorizacion) || empty($departamento_id) ||
    empty($residente_id) || empty($nombres_visitante) || empty($numero_documento)
) {
    echo json_encode(["success" => false, "message" => "Campos obligatorios incompletos"]);
    exit;
}

if ($sexo !== '' && !in_array($sexo, ['Masculino', 'Femenino'])) {
    echo json_encode(["success" => false, "message" => "Sexo inválido"]);
    exit;
}

if (!in_array($autorizacion_residente, ['Si', 'No'])) {
    echo json_encode(["success" => false, "message" => "Autorización del residente inválida"]);
    exit;
}

// El estado real (Permitido/Denegado) lo decide el panel de control desde
// home.html; "autorizacion_residente" es solo cómo se contactó al residente.
$estado = 'Pendiente';

$foto_documento = null;
if (!empty($foto_base64)) {
    $documento = decodificar_documento($foto_base64);
    if ($documento === null) {
        echo json_encode(["success" => false, "message" => "El documento debe ser una imagen (JPG, PNG, WEBP) o un PDF de hasta 2 MB"]);
        exit;
    }
    $carpeta = __DIR__ . '/../../statics/img/visitas_docs';
    if (!is_dir($carpeta)) {
        mkdir($carpeta, 0755, true);
    }
    $nombre_archivo = uniqid('doc_') . $documento['extension'];
    file_put_contents($carpeta . '/' . $nombre_archivo, $documento['data']);
    $foto_documento = 'statics/img/visitas_docs/' . $nombre_archivo;
}

try {
    $stmt = $conexion->prepare("SELECT id FROM departamentos WHERE id = ? AND estado = 'Activo'");
    $stmt->execute([$departamento_id]);
    if (!$stmt->fetch()) {
        throw new Exception("El departamento seleccionado no existe o no está activo");
    }

    $stmt = $conexion->prepare("SELECT id FROM residentes WHERE id = ? AND activo = 1");
    $stmt->execute([$residente_id]);
    if (!$stmt->fetch()) {
        throw new Exception("El residente anfitrión seleccionado no es válido");
    }

    $stmt = $conexion->prepare("
        INSERT INTO visitas
        (tipo_visita, motivo, fecha_visita, hora_ingreso, tiempo_estimado, numero_visitantes,
         autorizacion_residente, via_autorizacion, departamento_id, residente_id, nombres_visitante,
         sexo, tipo_documento, numero_documento, fecha_nacimiento, telefono, correo, parentesco,
         direccion, empresa, observaciones, foto_documento, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $tipo_visita,
        $motivo,
        $fecha_visita,
        $hora_ingreso,
        $tiempo_estimado ?: null,
        $numero_visitantes ?: 1,
        $autorizacion_residente,
        $via_autorizacion,
        $departamento_id,
        $residente_id,
        $nombres_visitante,
        $sexo ?: null,
        $tipo_documento ?: 'DNI',
        $numero_documento,
        $fecha_nacimiento ?: null,
        $telefono ?: null,
        $correo ?: null,
        $parentesco ?: null,
        $direccion ?: null,
        $empresa ?: null,
        $observaciones ?: null,
        $foto_documento,
        $estado
    ]);

    $visitaId = $conexion->lastInsertId();
    auditar('crear', 'visita', $visitaId, $nombres_visitante);
    echo json_encode(["success" => true, "visita_id" => $visitaId, "estado" => $estado]);
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
