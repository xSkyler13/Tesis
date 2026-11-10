<?php
// Activa/desactiva un residente. Al desactivar, cierra sus relaciones activas con
// sus departamentos (marcándolas para poder restaurarlas) y saca su rostro del
// reconocimiento facial (se mueve la foto, no se borra). Al reactivar, hace lo
// inverso: restaura esos vínculos salvo los de Titular cuyo departamento ya
// tiene otro titular asignado mientras estuvo inactivo.

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_ADMIN);

$id     = $_POST['id'] ?? '';
$activo = $_POST['activo'] ?? '';

if (empty($id) || !in_array($activo, ['0', '1'], true)) {
    echo json_encode(["success" => false, "message" => "Datos inválidos"]);
    exit;
}

$stmt = $conexion->prepare("SELECT id, nombres, apellidos, activo FROM residentes WHERE id = ?");
$stmt->execute([$id]);
$residente = $stmt->fetch();

if (!$residente) {
    echo json_encode(["success" => false, "message" => "Residente no encontrado"]);
    exit;
}

$nombreCompleto = trim($residente['nombres'] . ' ' . $residente['apellidos']);

$restaurados = [];
$no_restaurados = [];

try {
    $conexion->beginTransaction();

    // Reactivar también anula una baja definitiva (fecha_baja)
    $stmt = $conexion->prepare("UPDATE residentes SET activo = ?, fecha_baja = IF(? = 1, NULL, fecha_baja) WHERE id = ?");
    $stmt->execute([$activo, $activo, $id]);

    if ($activo === '0') {
        $stmt = $conexion->prepare("
            UPDATE residente_departamento
            SET activo = 0, fecha_fin = CURDATE(), cerrado_por_desactivacion = 1
            WHERE residente_id = ? AND activo = 1
        ");
        $stmt->execute([$id]);
    } else {
        $stmt = $conexion->prepare("
            SELECT rd.id, rd.departamento_id, rd.tipo_relacion,
                   CONCAT(t.nombre, ' - Dep ', d.numero) AS etiqueta,
                   EXISTS (
                       SELECT 1 FROM residente_departamento otro
                       WHERE otro.departamento_id = rd.departamento_id AND otro.activo = 1
                         AND otro.tipo_relacion = 'Titular'
                   ) AS tiene_titular
            FROM residente_departamento rd
            INNER JOIN departamentos d ON d.id = rd.departamento_id
            INNER JOIN torres t ON t.id = d.torre_id
            WHERE rd.residente_id = ? AND rd.cerrado_por_desactivacion = 1
        ");
        $stmt->execute([$id]);
        $vinculos = $stmt->fetchAll();

        $reabrir = $conexion->prepare("
            UPDATE residente_departamento
            SET activo = 1, fecha_fin = NULL, cerrado_por_desactivacion = 0
            WHERE id = ?
        ");
        $descartar = $conexion->prepare("UPDATE residente_departamento SET cerrado_por_desactivacion = 0 WHERE id = ?");

        foreach ($vinculos as $v) {
            if ($v['tipo_relacion'] === 'Titular' && $v['tiene_titular']) {
                $descartar->execute([$v['id']]);
                $no_restaurados[] = $v['etiqueta'];
            } else {
                $reabrir->execute([$v['id']]);
                $restaurados[] = $v['etiqueta'];
            }
        }
    }

    $conexion->commit();
} catch (Exception $e) {
    $conexion->rollBack();
    echo json_encode(["success" => false, "message" => "Error al actualizar el estado del residente."]);
    exit;
}

auditar($activo === '1' ? 'reactivar' : 'desactivar', 'residente', $id, $nombreCompleto);
$respuestaFlask = sincronizar_rostro($nombreCompleto, $activo === '1');

echo json_encode([
    "success" => true,
    "activo" => $activo,
    "departamentos_restaurados" => $restaurados,
    "departamentos_no_restaurados" => $no_restaurados,
    "reconocimiento_facial" => $respuestaFlask,
]);
