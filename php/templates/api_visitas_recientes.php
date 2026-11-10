<?php

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_PERSONAL);

$stmt = $conexion->query("
    SELECT v.id, v.nombres_visitante, v.fecha_visita, v.hora_ingreso, v.estado
    FROM visitas v
    ORDER BY v.id DESC
    LIMIT 5
");

$datos = [];
while ($fila = $stmt->fetch()) {
    $datos[] = $fila;
}

echo json_encode($datos);
