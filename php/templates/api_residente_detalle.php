<?php

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_PERSONAL);

$id = $_GET['id'] ?? '';

if (empty($id)) {
    echo json_encode(["success" => false, "message" => "Id no proporcionado"]);
    exit;
}

$stmt = $conexion->prepare("SELECT * FROM residentes WHERE id = ?");
$stmt->execute([$id]);
$residente = $stmt->fetch();

if (!$residente) {
    echo json_encode(["success" => false, "message" => "Residente no encontrado"]);
    exit;
}

// Todos sus departamentos activos (un residente puede tener varios)
$stmt = $conexion->prepare("
    SELECT rd.departamento_id, rd.tipo_relacion, rd.fecha_inicio,
           d.numero AS depto_numero, t.nombre AS torre_nombre
    FROM residente_departamento rd
    INNER JOIN departamentos d ON d.id = rd.departamento_id
    INNER JOIN torres t ON t.id = d.torre_id
    WHERE rd.residente_id = ? AND rd.activo = 1
    ORDER BY t.nombre, d.numero
");
$stmt->execute([$id]);
$residente['departamentos'] = $stmt->fetchAll();

// Para la baja por mudanza: sus departamentos activos y los suspendidos por una
// desactivación temporal, con los demás ocupantes de cada uno.
$stmt = $conexion->prepare("
    SELECT rd.departamento_id, rd.tipo_relacion, rd.activo,
           d.numero AS depto_numero, t.nombre AS torre_nombre,
           (
               SELECT GROUP_CONCAT(CONCAT(r2.nombres, ' ', r2.apellidos, ' (', o.tipo_relacion, ')') SEPARATOR '||')
               FROM residente_departamento o
               INNER JOIN residentes r2 ON r2.id = o.residente_id
               WHERE o.departamento_id = rd.departamento_id AND o.activo = 1 AND o.residente_id <> rd.residente_id
           ) AS otros_ocupantes
    FROM residente_departamento rd
    INNER JOIN departamentos d ON d.id = rd.departamento_id
    INNER JOIN torres t ON t.id = d.torre_id
    WHERE rd.residente_id = ? AND (rd.activo = 1 OR rd.cerrado_por_desactivacion = 1)
    ORDER BY t.nombre, d.numero
");
$stmt->execute([$id]);
$residente['departamentos_baja'] = array_map(function ($fila) {
    $fila['otros_ocupantes'] = $fila['otros_ocupantes'] ? explode('||', $fila['otros_ocupantes']) : [];
    return $fila;
}, $stmt->fetchAll());

echo json_encode(["success" => true, "residente" => $residente]);
