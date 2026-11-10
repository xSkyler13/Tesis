<?php
// Listado paginado y filtrable de residentes (propietarios/ocupantes/etc),
// con todos sus departamentos activos (un residente puede tener varios).

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_PERSONAL);

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
    $where[] = "r.activo = 0 AND r.fecha_baja IS NULL";
} elseif ($estado === 'Baja') {
    $where[] = "r.fecha_baja IS NOT NULL";
}
if (!empty($tipo_residente_id)) {
    $where[] = "r.tipo_residente_id = ?";
    $params[] = $tipo_residente_id;
}
if (!empty($buscar)) {
    $where[] = "(CONCAT(r.nombres, ' ', r.apellidos) LIKE ? OR r.dni LIKE ? OR EXISTS (
        SELECT 1 FROM residente_departamento rdb
        INNER JOIN departamentos db ON db.id = rdb.departamento_id
        INNER JOIN torres tb ON tb.id = db.torre_id
        WHERE rdb.residente_id = r.id AND rdb.activo = 1 AND (tb.nombre LIKE ? OR db.numero LIKE ?)
    ))";
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
$whereSql
";

$stmt = $conexion->prepare("SELECT COUNT(*) AS total $baseSql");
$stmt->execute($params);
$total = (int) $stmt->fetch()['total'];

$offset = ($page - 1) * $per_page;
$sql = "
SELECT
    r.id, r.nombres, r.apellidos, r.dni, r.celular, r.correo, r.activo, r.fecha_baja, r.foto_perfil,
    tr.nombre AS tipo_nombre,
    (
        SELECT GROUP_CONCAT(CONCAT(t.nombre, ' - Dep ', d.numero) ORDER BY t.nombre, d.numero SEPARATOR '||')
        FROM residente_departamento rd
        INNER JOIN departamentos d ON d.id = rd.departamento_id
        INNER JOIN torres t ON t.id = d.torre_id
        WHERE rd.residente_id = r.id AND rd.activo = 1
    ) AS departamentos
$baseSql
ORDER BY r.nombres, r.apellidos
LIMIT $per_page OFFSET $offset
";
$stmt = $conexion->prepare($sql);
$stmt->execute($params);
$data = $stmt->fetchAll();
foreach ($data as &$fila) {
    $fila['departamentos'] = $fila['departamentos'] ? explode('||', $fila['departamentos']) : [];
}
unset($fila);

echo json_encode([
    "data" => $data,
    "total" => $total,
    "page" => $page,
    "per_page" => $per_page,
]);
