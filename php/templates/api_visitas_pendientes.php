<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . "/../includes/config/database.php";

$stmt = $conexion->query("
    SELECT
        v.id, v.nombres_visitante, v.fecha_visita, v.hora_ingreso,
        v.autorizacion_residente, v.via_autorizacion,
        CONCAT(r.nombres, ' ', r.apellidos) AS residente_nombre,
        t.nombre AS torre_nombre,
        d.numero AS depto_numero
    FROM visitas v
    INNER JOIN residentes r ON r.id = v.residente_id
    INNER JOIN departamentos d ON d.id = v.departamento_id
    INNER JOIN torres t ON t.id = d.torre_id
    WHERE v.estado = 'Pendiente'
    ORDER BY v.id DESC
");

$datos = [];
while ($fila = $stmt->fetch()) {
    $datos[] = $fila;
}

echo json_encode($datos);
