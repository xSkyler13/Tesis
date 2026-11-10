<?php
// Elimina una visita y, si tiene, la foto del documento guardada en disco.

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_usuario(ROLES_ADMIN);

$id = $_POST['id'] ?? '';

if (empty($id)) {
    echo json_encode(["success" => false, "message" => "Id no proporcionado"]);
    exit;
}

try {
    $stmt = $conexion->prepare("SELECT foto_documento FROM visitas WHERE id = ?");
    $stmt->execute([$id]);
    $visita = $stmt->fetch();
    if (!$visita) {
        throw new Exception("La visita no existe");
    }

    $stmt = $conexion->prepare("DELETE FROM visitas WHERE id = ?");
    $stmt->execute([$id]);

    // Solo se borra el archivo si realmente está dentro de la carpeta de documentos.
    if (!empty($visita['foto_documento'])) {
        $carpeta = realpath(__DIR__ . '/../../statics/img/visitas_docs');
        $archivo = realpath(__DIR__ . '/../../' . $visita['foto_documento']);
        if ($carpeta && $archivo && strpos($archivo, $carpeta . DIRECTORY_SEPARATOR) === 0) {
            @unlink($archivo);
        }
    }

    auditar('eliminar', 'visita', $id);
    echo json_encode(["success" => true]);
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
