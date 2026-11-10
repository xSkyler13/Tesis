<?php

require_once __DIR__ . "/env.php";

$host = env('DB_HOST', '172.17.0.2');
$dbname = env('DB_NAME', 'control_acceso');
$user = env('DB_USER', 'root');
$password = env('DB_PASSWORD');

try {

    $conexion = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $user,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );

    $conexion->exec("SET time_zone = '-05:00'");

} catch (PDOException $e) {

    error_log($e->getMessage());

    die(json_encode(["success" => false, "message" => "Error de conexión a la base de datos."]));

}
