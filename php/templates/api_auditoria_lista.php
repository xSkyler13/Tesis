<?php
// Listado paginado y filtrable del registro de auditoría (solo administradores).

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_ADMIN);

$usuario     = trim($_GET['usuario'] ?? '');
$accion      = $_GET['accion'] ?? '';
$entidad     = $_GET['entidad'] ?? '';
$fecha_desde = $_GET['fecha_desde'] ?? '';
$fecha_hasta = $_GET['fecha_hasta'] ?? '';
$page        = max(1, (int) ($_GET['page'] ?? 1));
$per_page    = max(1, min(100, (int) ($_GET['per_page'] ?? 25)));

$where  = [];
$params = [];

if ($usuario !== '') {
    $where[] = "a.usuario LIKE ?";
    $params[] = '%' . $usuario . '%';
}
if ($accion !== '') {
    $where[] = "a.accion = ?";
    $params[] = $accion;
}
if ($entidad !== '') {
    $where[] = "a.entidad = ?";
    $params[] = $entidad;
}
if ($fecha_desde !== '') {
    $where[] = "DATE(a.fecha) >= ?";
    $params[] = $fecha_desde;
}
if ($fecha_hasta !== '') {
    $where[] = "DATE(a.fecha) <= ?";
    $params[] = $fecha_hasta;
}

$whereSql = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

$stmt = $conexion->prepare("SELECT COUNT(*) AS total FROM auditoria a $whereSql");
$stmt->execute($params);
$total = (int) $stmt->fetch()['total'];

$offset = ($page - 1) * $per_page;
$stmt = $conexion->prepare("
SELECT a.id, a.fecha, a.usuario, a.accion, a.entidad, a.entidad_id, a.detalle, a.ip
FROM auditoria a
$whereSql
ORDER BY a.id DESC
LIMIT $per_page OFFSET $offset
");
$stmt->execute($params);

// Valores existentes, para los filtros
$acciones  = $conexion->query("SELECT DISTINCT accion FROM auditoria ORDER BY accion")->fetchAll(PDO::FETCH_COLUMN);
$entidades = $conexion->query("SELECT DISTINCT entidad FROM auditoria ORDER BY entidad")->fetchAll(PDO::FETCH_COLUMN);

echo json_encode([
    "data" => $stmt->fetchAll(),
    "total" => $total,
    "page" => $page,
    "per_page" => $per_page,
    "acciones" => $acciones,
    "entidades" => $entidades,
]);
