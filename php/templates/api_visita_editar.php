<?php
// Actualiza los datos de una visita ya registrada (la foto del documento no se toca).

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_PERSONAL);

$id                     = $_POST['id'] ?? '';
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
$estado                 = $_POST['estado'] ?? '';

if (
    empty($id) || empty($tipo_visita) || empty($motivo) || empty($fecha_visita) || empty($hora_ingreso) ||
    empty($via_autorizacion) || empty($departamento_id) || empty($residente_id) ||
    empty($nombres_visitante) || empty($numero_documento)
) {
    echo json_encode(["success" => false, "message" => "Campos obligatorios incompletos"]);
    exit;
}

if (!in_array($autorizacion_residente, ['Si', 'No'])) {
    echo json_encode(["success" => false, "message" => "Autorización del residente inválida"]);
    exit;
}

if ($sexo !== '' && !in_array($sexo, ['Masculino', 'Femenino'])) {
    echo json_encode(["success" => false, "message" => "Sexo inválido"]);
    exit;
}

if (!in_array($estado, ['Pendiente', 'Permitido', 'Denegado'])) {
    echo json_encode(["success" => false, "message" => "Estado inválido"]);
    exit;
}

try {
    $stmt = $conexion->prepare("SELECT departamento_id, residente_id FROM visitas WHERE id = ?");
    $stmt->execute([$id]);
    $actual = $stmt->fetch();
    if (!$actual) {
        throw new Exception("La visita no existe");
    }

    // Solo se exige departamento activo / residente activo si se cambiaron.
    if ((int) $actual['departamento_id'] !== (int) $departamento_id) {
        $stmt = $conexion->prepare("SELECT id FROM departamentos WHERE id = ? AND estado = 'Activo'");
        $stmt->execute([$departamento_id]);
        if (!$stmt->fetch()) {
            throw new Exception("El departamento seleccionado no existe o no está activo");
        }
    }
    if ((int) $actual['residente_id'] !== (int) $residente_id) {
        $stmt = $conexion->prepare("SELECT id FROM residentes WHERE id = ? AND activo = 1");
        $stmt->execute([$residente_id]);
        if (!$stmt->fetch()) {
            throw new Exception("El residente anfitrión seleccionado no es válido");
        }
    }

    $stmt = $conexion->prepare("
        UPDATE visitas SET
            tipo_visita = ?, motivo = ?, fecha_visita = ?, hora_ingreso = ?, tiempo_estimado = ?,
            numero_visitantes = ?, autorizacion_residente = ?, via_autorizacion = ?,
            departamento_id = ?, residente_id = ?, nombres_visitante = ?, sexo = ?, tipo_documento = ?,
            numero_documento = ?, fecha_nacimiento = ?, telefono = ?, correo = ?, parentesco = ?,
            direccion = ?, empresa = ?, observaciones = ?, estado = ?
        WHERE id = ?
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
        $estado,
        $id
    ]);

    auditar('editar', 'visita', $id, "estado: $estado");
    echo json_encode(["success" => true]);
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
