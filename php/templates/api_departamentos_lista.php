<?php
// Listado paginado y filtrable de departamentos, con torre y propietario
// (titular activo) resueltos por JOIN, más resumen global.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . "/../includes/config/database.php";

$torre_id      = $_GET['torre_id'] ?? '';
$piso          = $_GET['piso'] ?? '';
$estado        = $_GET['estado'] ?? '';
$tipo          = $_GET['tipo'] ?? '';
$numero_desde  = $_GET['numero_desde'] ?? '';
$numero_hasta  = $_GET['numero_hasta'] ?? '';
$area_desde    = $_GET['area_desde'] ?? '';
$area_hasta    = $_GET['area_hasta'] ?? '';
$fecha_desde   = $_GET['fecha_desde'] ?? '';
$fecha_hasta   = $_GET['fecha_hasta'] ?? '';
$buscar        = $_GET['buscar'] ?? '';
$page          = max(1, (int) ($_GET['page'] ?? 1));
$per_page      = max(1, min(100, (int) ($_GET['per_page'] ?? 10)));

$where  = [];
$params = [];

if (!empty($torre_id)) {
    $where[] = "d.torre_id = ?";
    $params[] = $torre_id;
}
if ($piso !== '') {
    $where[] = "d.piso = ?";
    $params[] = $piso;
}
if (!empty($estado)) {
    $where[] = "d.estado = ?";
    $params[] = $estado;
}
if (!empty($tipo)) {
    $where[] = "d.tipo = ?";
    $params[] = $tipo;
}
if ($numero_desde !== '') {
    $where[] = "CAST(d.numero AS UNSIGNED) >= ?";
    $params[] = $numero_desde;
}
if ($numero_hasta !== '') {
    $where[] = "CAST(d.numero AS UNSIGNED) <= ?";
    $params[] = $numero_hasta;
}
if ($area_desde !== '') {
    $where[] = "d.area >= ?";
    $params[] = $area_desde;
}
if ($area_hasta !== '') {
    $where[] = "d.area <= ?";
    $params[] = $area_hasta;
}
if ($fecha_desde !== '') {
    $where[] = "DATE(d.fecha_creacion) >= ?";
    $params[] = $fecha_desde;
}
if ($fecha_hasta !== '') {
    $where[] = "DATE(d.fecha_creacion) <= ?";
    $params[] = $fecha_hasta;
}
if (!empty($buscar)) {
    $where[] = "(d.numero LIKE ? OR t.nombre LIKE ? OR CONCAT(r.nombres, ' ', r.apellidos) LIKE ?)";
    $like = '%' . $buscar . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

$whereSql = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

$baseSql = "
FROM departamentos d
INNER JOIN torres t ON t.id = d.torre_id
LEFT JOIN residente_departamento rd ON rd.departamento_id = d.id AND rd.activo = 1 AND rd.tipo_relacion = 'Titular'
LEFT JOIN residentes r ON r.id = rd.residente_id
$whereSql
";

// TOTAL (para paginación, respeta filtros)
$stmt = $conexion->prepare("SELECT COUNT(*) AS total $baseSql");
$stmt->execute($params);
$total = (int) $stmt->fetch()['total'];

// DATOS PAGINADOS
$offset = ($page - 1) * $per_page;
$sql = "
SELECT
    d.id, d.numero, d.tipo, d.piso, d.area, d.habitaciones, d.banos,
    d.estacionamiento, d.estado, d.codigo_interno, d.fecha_creacion,
    t.nombre AS torre_nombre,
    CONCAT(r.nombres, ' ', r.apellidos) AS propietario
$baseSql
ORDER BY t.nombre, CAST(d.numero AS UNSIGNED)
LIMIT $per_page OFFSET $offset
";
$stmt = $conexion->prepare($sql);
$stmt->execute($params);
$data = $stmt->fetchAll();

// RESUMEN: si hay torre_id filtrado, se acota a esa torre; si no, es global
if (!empty($torre_id)) {
    $stmt = $conexion->prepare("
        SELECT
            COUNT(*) AS total,
            SUM(estado = 'Activo') AS activos,
            SUM(estado != 'Activo') AS inactivos,
            COALESCE(SUM(area), 0) AS area_total
        FROM departamentos
        WHERE torre_id = ?
    ");
    $stmt->execute([$torre_id]);
} else {
    $stmt = $conexion->query("
        SELECT
            COUNT(*) AS total,
            SUM(estado = 'Activo') AS activos,
            SUM(estado != 'Activo') AS inactivos,
            COALESCE(SUM(area), 0) AS area_total
        FROM departamentos
    ");
}
$resumen = $stmt->fetch();

// INFO DE LA TORRE (solo si hay filtro por torre)
$torre = null;
if (!empty($torre_id)) {
    $stmt = $conexion->prepare("SELECT id, nombre, imagen, activo FROM torres WHERE id = ?");
    $stmt->execute([$torre_id]);
    $torre = $stmt->fetch() ?: null;
}

// PISOS DISPONIBLES (para el filtro, global)
$pisos = $conexion->query("SELECT DISTINCT piso FROM departamentos ORDER BY piso")->fetchAll(PDO::FETCH_COLUMN);

echo json_encode([
    "data" => $data,
    "total" => $total,
    "page" => $page,
    "per_page" => $per_page,
    "resumen" => $resumen,
    "torre" => $torre,
    "pisos_disponibles" => $pisos,
]);
