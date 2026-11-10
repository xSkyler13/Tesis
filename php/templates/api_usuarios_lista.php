<?php
// Listado de usuarios del sistema (personal con acceso web), con su rol y su
// último ingreso (tomado de la auditoría). Solo administradores.

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_ADMIN);

$buscar = trim($_GET['buscar'] ?? '');
$rol_id = $_GET['rol_id'] ?? '';
$estado = $_GET['estado'] ?? '';

$where  = [];
$params = [];

if ($buscar !== '') {
    $where[] = "(u.usuario LIKE ? OR u.correo LIKE ?)";
    $like = '%' . $buscar . '%';
    array_push($params, $like, $like);
}
if ($rol_id !== '') {
    $where[] = "u.rol_id = ?";
    $params[] = $rol_id;
}
if ($estado === 'Activo') {
    $where[] = "u.activo = 1";
} elseif ($estado === 'Inactivo') {
    $where[] = "u.activo = 0";
}

$whereSql = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

$stmt = $conexion->prepare("
SELECT
    u.id, u.usuario, u.correo, u.rol_id, u.activo, u.fecha_creacion,
    r.nombre AS rol_nombre,
    (SELECT MAX(a.fecha) FROM auditoria a WHERE a.usuario_id = u.id AND a.accion = 'login') AS ultimo_ingreso
FROM usuarios u
INNER JOIN roles r ON r.id = u.rol_id
$whereSql
ORDER BY u.activo DESC, u.usuario
");
$stmt->execute($params);

echo json_encode(["data" => $stmt->fetchAll(), "usuario_actual" => $AUTH['id']]);
