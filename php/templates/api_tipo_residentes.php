<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . "/../includes/config/database.php";

$sql = "SELECT * FROM tipo_residentes ORDER BY nombre";

$resultado = $conexion->query($sql);

$datos = [];

while ($fila = $resultado->fetch()) {
    $datos[] = $fila;
}

echo json_encode($datos);
