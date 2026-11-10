<?php
// Asigna un departamento a un residente ya registrado. Un departamento tiene un
// solo Titular activo: si se asigna como Titular, el titular anterior se cierra.

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_ADMIN);

$residente_id    = $_POST['residente_id'] ?? '';
$departamento_id = $_POST['departamento_id'] ?? '';
$tipo_relacion   = $_POST['tipo_relacion'] ?? '';

if (empty($residente_id) || empty($departamento_id) || !in_array($tipo_relacion, ['Titular', 'Copropietario', 'Habitante'], true)) {
    echo json_encode(["success" => false, "message" => "Datos inválidos"]);
    exit;
}

try {
    $conexion->beginTransaction();

    $stmt = $conexion->prepare("SELECT id FROM residentes WHERE id = ? AND activo = 1");
    $stmt->execute([$residente_id]);
    if (!$stmt->fetch()) {
        throw new Exception("El residente no existe o está inactivo");
    }

    $stmt = $conexion->prepare("SELECT id FROM departamentos WHERE id = ? AND estado = 'Activo'");
    $stmt->execute([$departamento_id]);
    if (!$stmt->fetch()) {
        throw new Exception("El departamento seleccionado no existe o no está activo");
    }

    $stmt = $conexion->prepare("SELECT id FROM residente_departamento WHERE residente_id = ? AND departamento_id = ? AND activo = 1");
    $stmt->execute([$residente_id, $departamento_id]);
    if ($stmt->fetch()) {
        throw new Exception("El residente ya está asignado a ese departamento");
    }

    if ($tipo_relacion === 'Titular') {
        $stmt = $conexion->prepare("
            UPDATE residente_departamento
            SET activo = 0, fecha_fin = CURDATE(), cerrado_por_desactivacion = 0
            WHERE departamento_id = ? AND activo = 1 AND tipo_relacion = 'Titular'
        ");
        $stmt->execute([$departamento_id]);
    }

    // uq_residente_departamento es (residente_id, departamento_id): si ese par ya
    // existió y se cerró, se reabre en vez de insertar otro.
    $stmt = $conexion->prepare("
        INSERT INTO residente_departamento (residente_id, departamento_id, fecha_inicio, tipo_relacion, activo, fecha_fin)
        VALUES (?, ?, CURDATE(), ?, 1, NULL)
        ON DUPLICATE KEY UPDATE fecha_inicio = CURDATE(), tipo_relacion = VALUES(tipo_relacion), activo = 1,
                                fecha_fin = NULL, cerrado_por_desactivacion = 0
    ");
    $stmt->execute([$residente_id, $departamento_id, $tipo_relacion]);

    $conexion->commit();
    auditar('asignar_departamento', 'residente', $residente_id, "departamento $departamento_id como $tipo_relacion");
    echo json_encode(["success" => true]);
} catch (Exception $e) {
    $conexion->rollBack();
    $mensaje = $e instanceof PDOException ? "Error al asignar el departamento." : $e->getMessage();
    echo json_encode(["success" => false, "message" => $mensaje]);
}
