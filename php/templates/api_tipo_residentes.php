<?php

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_PERSONAL);

$sql = "SELECT * FROM tipo_residentes ORDER BY nombre";

$resultado = $conexion->query($sql);

$datos = [];

while ($fila = $resultado->fetch()) {
    $datos[] = $fila;
}

echo json_encode($datos);
