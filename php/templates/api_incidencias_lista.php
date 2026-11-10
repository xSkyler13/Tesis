<?php
// Listado paginado y filtrable de intentos de acceso no reconocidos, con quién
// los revisó (si ya se revisaron).

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_PERSONAL);

$estado      = $_GET['estado'] ?? '';
$fecha_desde = $_GET['fecha_desde'] ?? '';
$fecha_hasta = $_GET['fecha_hasta'] ?? '';
$id          = (int) ($_GET['id'] ?? 0);
$page        = max(1, (int) ($_GET['page'] ?? 1));
$per_page    = max(1, min(100, (int) ($_GET['per_page'] ?? 12)));

$where  = [];
$params = [];

if (in_array($estado, ['Pendiente', 'Revisado'], true)) {
    $where[] = "i.estado = ?";
    $params[] = $estado;
}
if ($fecha_desde !== '') {
    $where[] = "DATE(i.fecha_hora) >= ?";
    $params[] = $fecha_desde;
}
if ($fecha_hasta !== '') {
    $where[] = "DATE(i.fecha_hora) <= ?";
    $params[] = $fecha_hasta;
}
if ($id > 0) {
    $where[] = "i.id = ?";
    $params[] = $id;
}

$whereSql = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

$stmt = $conexion->prepare("SELECT COUNT(*) AS total FROM intentos_no_reconocidos i $whereSql");
$stmt->execute($params);
$total = (int) $stmt->fetch()['total'];

$stmt = $conexion->query("SELECT COUNT(*) AS total FROM intentos_no_reconocidos WHERE estado = 'Pendiente'");
$pendientes = (int) $stmt->fetch()['total'];

$offset = ($page - 1) * $per_page;
$stmt = $conexion->prepare("
SELECT
    i.id, i.foto_path, i.fecha_hora, i.estado, i.nota, i.fecha_revision,
    u.usuario AS revisado_por
FROM intentos_no_reconocidos i
LEFT JOIN usuarios u ON u.id = i.revisado_por
$whereSql
ORDER BY i.fecha_hora DESC, i.id DESC
LIMIT $per_page OFFSET $offset
");
$stmt->execute($params);

echo json_encode([
    "data" => $stmt->fetchAll(),
    "total" => $total,
    "pendientes" => $pendientes,
    "page" => $page,
    "per_page" => $per_page,
]);
