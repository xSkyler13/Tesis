<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . "/../includes/config/database.php";

$id = $_POST['id'] ?? '';

if (empty($id)) {
    echo json_encode(["success" => false, "message" => "Id no proporcionado"]);
    exit;
}

try {
    $conexion->beginTransaction();

    // Historial de residentes (titulares/ocupantes) del departamento: se borra
    // primero porque la FK es NO ACTION y bloquea el DELETE de departamentos.
    $stmt = $conexion->prepare("DELETE FROM residente_departamento WHERE departamento_id = ?");
    $stmt->execute([$id]);

    $stmt = $conexion->prepare("DELETE FROM departamentos WHERE id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        $conexion->rollBack();
        echo json_encode(["success" => false, "message" => "Departamento no encontrado"]);
        exit;
    }

    $conexion->commit();
    echo json_encode(["success" => true]);
} catch (PDOException $e) {
    $conexion->rollBack();
    echo json_encode(["success" => false, "message" => "No se pudo eliminar el departamento. Puede tener registros asociados."]);
}
