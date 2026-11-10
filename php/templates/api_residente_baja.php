<?php
// Baja definitiva de un residente que se muda. A diferencia de desactivar:
// - sus vínculos se cierran sin marca de restauración (reactivarlo no se los devuelve);
// - por cada departamento en liberar[] se cierran también los demás ocupantes,
//   decidido caso por caso por el operador. Quien se quede sin ningún
//   departamento activo también se da de baja.
// Nada se borra: todo queda en el historial con su fecha_fin / fecha_baja.

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_ADMIN);

$id      = $_POST['id'] ?? '';
$liberar = array_map('intval', (array) ($_POST['liberar'] ?? []));

if (empty($id)) {
    echo json_encode(["success" => false, "message" => "Datos inválidos"]);
    exit;
}

$stmt = $conexion->prepare("SELECT id, nombres, apellidos, activo, fecha_baja FROM residentes WHERE id = ?");
$stmt->execute([$id]);
$residente = $stmt->fetch();

if (!$residente) {
    echo json_encode(["success" => false, "message" => "Residente no encontrado"]);
    exit;
}
if ($residente['fecha_baja']) {
    echo json_encode(["success" => false, "message" => "El residente ya fue dado de baja"]);
    exit;
}

// Sus departamentos: activos o suspendidos por una desactivación temporal
$stmt = $conexion->prepare("
    SELECT departamento_id FROM residente_departamento
    WHERE residente_id = ? AND (activo = 1 OR cerrado_por_desactivacion = 1)
");
$stmt->execute([$id]);
$susDepartamentos = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

if (array_diff($liberar, $susDepartamentos)) {
    echo json_encode(["success" => false, "message" => "Solo se pueden liberar departamentos del propio residente"]);
    exit;
}

$dadosDeBaja = [trim($residente['nombres'] . ' ' . $residente['apellidos'])];
$siguenEnOtroDepto = [];

try {
    $conexion->beginTransaction();

    $stmt = $conexion->prepare("UPDATE residentes SET activo = 0, fecha_baja = CURDATE() WHERE id = ?");
    $stmt->execute([$id]);

    $stmt = $conexion->prepare("
        UPDATE residente_departamento
        SET fecha_fin = IF(activo = 1, CURDATE(), fecha_fin), activo = 0, cerrado_por_desactivacion = 0
        WHERE residente_id = ? AND (activo = 1 OR cerrado_por_desactivacion = 1)
    ");
    $stmt->execute([$id]);

    // Liberar por completo: cierra a los demás ocupantes de esos departamentos
    $afectados = [];
    $buscarOtros = $conexion->prepare("SELECT residente_id FROM residente_departamento WHERE departamento_id = ? AND activo = 1");
    $cerrarOtros = $conexion->prepare("
        UPDATE residente_departamento
        SET activo = 0, fecha_fin = CURDATE(), cerrado_por_desactivacion = 0
        WHERE departamento_id = ? AND activo = 1
    ");
    foreach ($liberar as $departamentoId) {
        $buscarOtros->execute([$departamentoId]);
        foreach ($buscarOtros->fetchAll(PDO::FETCH_COLUMN) as $otroId) {
            $afectados[(int) $otroId] = true;
        }
        $cerrarOtros->execute([$departamentoId]);
    }

    // Quien se quedó sin departamentos activos ya no reside en el edificio
    $contarActivos = $conexion->prepare("SELECT COUNT(*) FROM residente_departamento WHERE residente_id = ? AND activo = 1");
    $datosResidente = $conexion->prepare("SELECT nombres, apellidos, activo FROM residentes WHERE id = ?");
    $darDeBaja = $conexion->prepare("UPDATE residentes SET activo = 0, fecha_baja = CURDATE() WHERE id = ?");
    foreach (array_keys($afectados) as $otroId) {
        $datosResidente->execute([$otroId]);
        $otro = $datosResidente->fetch();
        $nombreOtro = trim($otro['nombres'] . ' ' . $otro['apellidos']);

        $contarActivos->execute([$otroId]);
        if ((int) $contarActivos->fetchColumn() === 0) {
            $darDeBaja->execute([$otroId]);
            $dadosDeBaja[] = $nombreOtro;
        } else {
            $siguenEnOtroDepto[] = $nombreOtro;
        }
    }

    $conexion->commit();
} catch (Exception $e) {
    $conexion->rollBack();
    echo json_encode(["success" => false, "message" => "Error al dar de baja al residente."]);
    exit;
}

auditar('baja', 'residente', $id, 'dados de baja: ' . implode(', ', $dadosDeBaja)
    . ($liberar ? '; departamentos liberados: ' . implode(', ', $liberar) : ''));

// Fuera del reconocimiento facial (si ya estaba desactivado, Flask solo
// responde que no lo encontró)
foreach ($dadosDeBaja as $nombre) {
    sincronizar_rostro($nombre, false);
}

echo json_encode([
    "success" => true,
    "departamentos_liberados" => count($liberar),
    "dados_de_baja" => $dadosDeBaja,
    "siguen_en_otro_departamento" => $siguenEnOtroDepto,
]);
