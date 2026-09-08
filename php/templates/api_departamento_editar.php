<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . "/../includes/config/database.php";

$id                  = $_POST['id'] ?? '';
$torre_id            = $_POST['torre_id'] ?? '';
$numero              = trim($_POST['numero'] ?? '');
$tipo                = trim($_POST['tipo'] ?? 'Departamento');
$piso                = $_POST['piso'] ?? null;
$area                = $_POST['area'] ?? null;
$habitaciones        = $_POST['habitaciones'] ?? null;
$banos               = $_POST['banos'] ?? null;
$estacionamiento     = trim($_POST['estacionamiento'] ?? '');
$propietario_id      = $_POST['propietario_id'] ?? '';
$telefono_contacto   = trim($_POST['telefono_contacto'] ?? '');
$estado              = $_POST['estado'] ?? 'Activo';
$observaciones       = trim($_POST['observaciones'] ?? '');
$notas_internas      = trim($_POST['notas_internas'] ?? '');

if (empty($id) || empty($torre_id) || empty($numero) || empty($tipo) || empty($piso) || !in_array($estado, ['Activo', 'Inactivo', 'Mantenimiento'])) {
    echo json_encode(["success" => false, "message" => "Campos obligatorios incompletos"]);
    exit;
}

try {
    $conexion->beginTransaction();

    $stmt = $conexion->prepare("SELECT * FROM departamentos WHERE id = ?");
    $stmt->execute([$id]);
    $actual = $stmt->fetch();
    if (!$actual) {
        throw new Exception("El departamento no existe");
    }

    $stmt = $conexion->prepare("SELECT * FROM torres WHERE id = ?");
    $stmt->execute([$torre_id]);
    $torre = $stmt->fetch();
    if (!$torre) {
        throw new Exception("La torre seleccionada no existe");
    }

    // LIMITE DE PISOS
    if (!empty($torre['numero_pisos']) && $piso > $torre['numero_pisos']) {
        throw new Exception("El piso {$piso} excede el número de pisos de la torre ({$torre['numero_pisos']})");
    }

    // LIMITE DE CAPACIDAD (solo si cambia de torre)
    if ($torre_id != $actual['torre_id'] && !empty($torre['numero_departamentos'])) {
        $stmt = $conexion->prepare("SELECT COUNT(*) AS total FROM departamentos WHERE torre_id = ?");
        $stmt->execute([$torre_id]);
        $ocupados = (int) $stmt->fetch()['total'];
        if ($ocupados >= (int) $torre['numero_departamentos']) {
            throw new Exception("La torre {$torre['nombre']} ya alcanzó su capacidad máxima de {$torre['numero_departamentos']} departamentos");
        }
    }

    $codigo_interno = 'DEP-' . ($torre['codigo'] ?: $torre_id) . '-' . $numero;

    $stmt = $conexion->prepare("
        UPDATE departamentos
        SET torre_id = ?, numero = ?, tipo = ?, piso = ?, area = ?, habitaciones = ?, banos = ?,
            estacionamiento = ?, telefono_contacto = ?, estado = ?, observaciones = ?, codigo_interno = ?, notas_internas = ?
        WHERE id = ?
    ");
    $stmt->execute([
        $torre_id,
        $numero,
        $tipo,
        $piso,
        $area ?: null,
        $habitaciones ?: null,
        $banos ?: null,
        $estacionamiento ?: null,
        $telefono_contacto ?: null,
        $estado,
        $observaciones ?: null,
        $codigo_interno,
        $notas_internas ?: null,
        $id
    ]);

    // PROPIETARIO / RESPONSABLE: cerrar titular activo previo si cambia, abrir uno nuevo si corresponde
    $stmt = $conexion->prepare("SELECT residente_id FROM residente_departamento WHERE departamento_id = ? AND activo = 1 AND tipo_relacion = 'Titular'");
    $stmt->execute([$id]);
    $titularActual = $stmt->fetch();

    $nuevoResidenteId = !empty($propietario_id) ? $propietario_id : null;
    $residenteActualId = $titularActual ? $titularActual['residente_id'] : null;

    if ($nuevoResidenteId != $residenteActualId) {
        if ($titularActual) {
            $stmt = $conexion->prepare("UPDATE residente_departamento SET activo = 0, fecha_fin = CURDATE() WHERE departamento_id = ? AND activo = 1 AND tipo_relacion = 'Titular'");
            $stmt->execute([$id]);
        }
        if ($nuevoResidenteId) {
            $stmt = $conexion->prepare("SELECT id FROM residentes WHERE id = ? AND activo = 1");
            $stmt->execute([$nuevoResidenteId]);
            if (!$stmt->fetch()) {
                throw new Exception("El propietario/responsable seleccionado no es válido");
            }
            // uq_residente_departamento es (residente_id, departamento_id): si ese par ya existió
            // antes (inactivo), se reactiva en vez de insertar de nuevo.
            $stmt = $conexion->prepare("
                INSERT INTO residente_departamento (residente_id, departamento_id, fecha_inicio, tipo_relacion, activo, fecha_fin)
                VALUES (?, ?, CURDATE(), 'Titular', 1, NULL)
                ON DUPLICATE KEY UPDATE fecha_inicio = CURDATE(), tipo_relacion = 'Titular', activo = 1, fecha_fin = NULL
            ");
            $stmt->execute([$nuevoResidenteId, $id]);
        }
    }

    $conexion->commit();

    echo json_encode(["success" => true, "codigo_interno" => $codigo_interno]);

} catch (PDOException $e) {
    $conexion->rollBack();
    if ($e->getCode() === '23000') {
        echo json_encode(["success" => false, "message" => "Ese número de departamento ya existe en la torre seleccionada."]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al actualizar el departamento."]);
    }
} catch (Exception $e) {
    $conexion->rollBack();
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
