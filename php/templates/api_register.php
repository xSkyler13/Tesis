<?php

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_ADMIN);

$sql = "SELECT * FROM roles";

$resultado = $conexion->query($sql);

$datos = [];

while ($fila = $resultado->fetch()) {
    $datos[] = $fila;
}

echo json_encode($datos);