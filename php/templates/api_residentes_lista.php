<?php
// Listado paginado y filtrable de residentes (propietarios/ocupantes/etc),
// con su torre/departamento actual (titular activo) resuelto por JOIN.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . "/../includes/config/database.php";

$estado             = $_GET['estado'] ?? '';
$tipo_residente_id  = $_GET['tipo_residente_id'] ?? '';
$buscar             = $_GET['buscar'] ?? '';
$page               = max(1, (int) ($_GET['page'] ?? 1));
$per_page           = max(1, min(100, (int) ($_GET['per_page'] ?? 10)));

$where  = [];
$params = [];

if ($estado === 'Activo') {
    $where[] = "r.activo = 1";
} elseif ($estado === 'Inactivo') {
    $where[] = "r.activo = 0";
}
if (!empty($tipo_residente_id)) {
    $where[] = "r.tipo_residente_id = ?";
    $params[] = $tipo_residente_id;
}
if (!empty($buscar)) {
    $where[] = "(CONCAT(r.nombres, ' ', r.apellidos) LIKE ? OR r.dni LIKE ? OR t.nombre LIKE ? OR d.numero LIKE ?)";
    $like = '%' . $buscar . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

$whereSql = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

$baseSql = "
FROM residentes r
INNER JOIN tipo_residentes tr ON tr.id = r.tipo_residente_id
LEFT JOIN residente_departamento rd ON rd.id = (
    SELECT rd2.id FROM residente_departamento rd2
    WHERE rd2.residente_id = r.id AND rd2.activo = 1
    ORDER BY rd2.id LIMIT 1
)
LEFT JOIN departamentos d ON d.id = rd.departamento_id
LEFT JOIN torres t ON t.id = d.torre_id
$whereSql
";

$stmt = $conexion->prepare("SELECT COUNT(*) AS total $baseSql");
$stmt->execute($params);
$total = (int) $stmt->fetch()['total'];

$offset = ($page - 1) * $per_page;
$sql = "
SELECT
    r.id, r.nombres, r.apellidos, r.dni, r.celular, r.correo, r.activo, r.foto_perfil,
    tr.nombre AS tipo_nombre,
    t.nombre AS torre_nombre,
    d.numero AS depto_numero
$baseSql
ORDER BY r.nombres, r.apellidos
LIMIT $per_page OFFSET $offset
";
$stmt = $conexion->prepare($sql);
$stmt->execute($params);
$data = $stmt->fetchAll();

echo json_encode([
    "data" => $data,
    "total" => $total,
    "page" => $page,
    "per_page" => $per_page,
]);
