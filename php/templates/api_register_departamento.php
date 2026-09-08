<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . "/../includes/config/database.php";

$torre_id           = $_POST['torre_id'] ?? '';
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

if (empty($torre_id) || empty($numero) || empty($tipo) || empty($piso) || !in_array($estado, ['Activo', 'Inactivo', 'Mantenimiento'])) {
    echo json_encode(["success" => false, "message" => "Campos obligatorios incompletos"]);
    exit;
}

try {
    $conexion->beginTransaction();

    // TORRE: validar que exista y traer sus limites
    $stmt = $conexion->prepare("SELECT * FROM torres WHERE id = ? AND activo = 1");
    $stmt->execute([$torre_id]);
    $torre = $stmt->fetch();
    if (!$torre) {
        throw new Exception("La torre seleccionada no existe o no está activa");
    }

    // LIMITE DE PISOS
    if (!empty($torre['numero_pisos']) && $piso > $torre['numero_pisos']) {
        throw new Exception("El piso {$piso} excede el número de pisos de la torre ({$torre['numero_pisos']})");
    }

    // LIMITE DE CAPACIDAD (departamentos activos vs numero_departamentos declarado)
    if (!empty($torre['numero_departamentos'])) {
        $stmt = $conexion->prepare("SELECT COUNT(*) AS total FROM departamentos WHERE torre_id = ?");
        $stmt->execute([$torre_id]);
        $actual = (int) $stmt->fetch()['total'];

        if ($actual >= (int) $torre['numero_departamentos']) {
            throw new Exception("La torre {$torre['nombre']} ya alcanzó su capacidad máxima de {$torre['numero_departamentos']} departamentos");
        }
    }

    // CODIGO INTERNO auto-generado: DEP-{codigo_torre}-{numero}
    $codigo_interno = 'DEP-' . ($torre['codigo'] ?: $torre_id) . '-' . $numero;

    // DEPARTAMENTO
    $stmt = $conexion->prepare("
        INSERT INTO departamentos
        (torre_id, numero, tipo, piso, area, habitaciones, banos, estacionamiento, telefono_contacto, estado, observaciones, codigo_interno, notas_internas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        $notas_internas ?: null
    ]);
    $departamento_id = $conexion->lastInsertId();

    // PROPIETARIO / RESPONSABLE (opcional)
    if (!empty($propietario_id)) {
        $stmt = $conexion->prepare("SELECT id FROM residentes WHERE id = ? AND activo = 1");
        $stmt->execute([$propietario_id]);
        if (!$stmt->fetch()) {
            throw new Exception("El propietario/responsable seleccionado no es válido");
        }

        $stmt = $conexion->prepare("
            INSERT INTO residente_departamento (residente_id, departamento_id, fecha_inicio, tipo_relacion, activo, fecha_fin)
            VALUES (?, ?, CURDATE(), 'Titular', 1, NULL)
            ON DUPLICATE KEY UPDATE fecha_inicio = CURDATE(), tipo_relacion = 'Titular', activo = 1, fecha_fin = NULL
        ");
        $stmt->execute([$propietario_id, $departamento_id]);
    }

    $conexion->commit();

    echo json_encode(["success" => true, "departamento_id" => $departamento_id, "codigo_interno" => $codigo_interno]);

} catch (PDOException $e) {
    $conexion->rollBack();
    if ($e->getCode() === '23000') {
        echo json_encode(["success" => false, "message" => "Ese número de departamento ya existe en la torre seleccionada."]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al registrar el departamento."]);
    }
} catch (Exception $e) {
    $conexion->rollBack();
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
