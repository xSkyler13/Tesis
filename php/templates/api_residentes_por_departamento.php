<?php
// Residentes activos de un departamento (anfitrión de una visita y modal de ocupantes).

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_PERSONAL);

$departamento_id = $_GET['departamento_id'] ?? '';

if (empty($departamento_id)) {
    echo json_encode([]);
    exit;
}

$stmt = $conexion->prepare("
    SELECT r.id, CONCAT(r.nombres, ' ', r.apellidos) AS nombre, r.dni, r.celular, r.telefono, r.correo, r.foto_perfil,
        tr.nombre AS tipo_nombre, rd.tipo_relacion
    FROM residentes r
    INNER JOIN residente_departamento rd ON rd.residente_id = r.id
    INNER JOIN tipo_residentes tr ON tr.id = r.tipo_residente_id
    WHERE rd.departamento_id = ? AND rd.activo = 1 AND r.activo = 1
    ORDER BY (rd.tipo_relacion = 'Titular') DESC, nombre
");
$stmt->execute([$departamento_id]);

$datos = [];
while ($fila = $stmt->fetch()) {
    $datos[] = $fila;
}

echo json_encode($datos);
