<?php
// Listado paginado y filtrable de todas las visitas, con departamento,
// torre y anfitrión resueltos por JOIN.

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_PERSONAL);

$estado       = $_GET['estado'] ?? '';
$tipo_visita  = $_GET['tipo_visita'] ?? '';
$fecha_desde  = $_GET['fecha_desde'] ?? '';
$fecha_hasta  = $_GET['fecha_hasta'] ?? '';
$buscar       = $_GET['buscar'] ?? '';
$dni          = trim($_GET['dni'] ?? '');
$sexo         = $_GET['sexo'] ?? '';
$page         = max(1, (int) ($_GET['page'] ?? 1));
$per_page     = max(1, min(100, (int) ($_GET['per_page'] ?? 10)));

$where  = [];
$params = [];

if (in_array($estado, ['Pendiente', 'Permitido', 'Denegado'])) {
    $where[] = "v.estado = ?";
    $params[] = $estado;
}
if ($tipo_visita !== '') {
    $where[] = "v.tipo_visita = ?";
    $params[] = $tipo_visita;
}
if ($fecha_desde !== '') {
    $where[] = "v.fecha_visita >= ?";
    $params[] = $fecha_desde;
}
if ($fecha_hasta !== '') {
    $where[] = "v.fecha_visita <= ?";
    $params[] = $fecha_hasta;
}
if ($dni !== '') {
    $where[] = "v.numero_documento LIKE ?";
    $params[] = '%' . $dni . '%';
}
if (in_array($sexo, ['Masculino', 'Femenino'])) {
    $where[] = "v.sexo = ?";
    $params[] = $sexo;
}
if ($buscar !== '') {
    $where[] = "(v.nombres_visitante LIKE ? OR v.numero_documento LIKE ? OR d.numero LIKE ? OR t.nombre LIKE ? OR CONCAT(r.nombres, ' ', r.apellidos) LIKE ?)";
    $like = '%' . $buscar . '%';
    array_push($params, $like, $like, $like, $like, $like);
}

$whereSql = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

$baseSql = "
FROM visitas v
INNER JOIN departamentos d ON d.id = v.departamento_id
INNER JOIN torres t ON t.id = d.torre_id
INNER JOIN residentes r ON r.id = v.residente_id
$whereSql
";

$stmt = $conexion->prepare("SELECT COUNT(*) AS total $baseSql");
$stmt->execute($params);
$total = (int) $stmt->fetch()['total'];

$offset = ($page - 1) * $per_page;
$stmt = $conexion->prepare("
SELECT
    v.id, v.tipo_visita, v.motivo, v.fecha_visita, v.hora_ingreso, v.numero_visitantes,
    v.nombres_visitante, v.sexo, v.tipo_documento, v.numero_documento, v.telefono, v.estado,
    d.numero AS depto_numero, t.nombre AS torre_nombre,
    CONCAT(r.nombres, ' ', r.apellidos) AS anfitrion
$baseSql
ORDER BY v.fecha_visita DESC, v.hora_ingreso DESC, v.id DESC
LIMIT $per_page OFFSET $offset
");
$stmt->execute($params);

echo json_encode([
    "data" => $stmt->fetchAll(),
    "total" => $total,
    "page" => $page,
    "per_page" => $per_page,
]);
