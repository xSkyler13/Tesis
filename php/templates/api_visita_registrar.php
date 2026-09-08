<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . "/../includes/config/database.php";

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

if (!in_array($autorizacion_residente, ['Si', 'No'])) {
    echo json_encode(["success" => false, "message" => "Autorización del residente inválida"]);
    exit;
}

// El estado real (Permitido/Denegado) lo decide el panel de control desde
// home.html; "autorizacion_residente" es solo cómo se contactó al residente.
$estado = 'Pendiente';

$foto_documento = null;
if (!empty($foto_base64)) {
    $data = preg_replace('#^data:(image|application)/[\w.+-]+;base64,#i', '', $foto_base64);
    $data = base64_decode($data);
    $carpeta = __DIR__ . '/../../statics/img/visitas_docs';
    if (!is_dir($carpeta)) {
        mkdir($carpeta, 0755, true);
    }
    $nombre_archivo = uniqid('doc_') . '.jpg';
    file_put_contents($carpeta . '/' . $nombre_archivo, $data);
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
         tipo_documento, numero_documento, fecha_nacimiento, telefono, correo, parentesco,
         direccion, empresa, observaciones, foto_documento, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    echo json_encode(["success" => true, "visita_id" => $conexion->lastInsertId(), "estado" => $estado]);
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
