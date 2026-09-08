<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . "/../includes/config/database.php";

$nombre    = $_POST['usuario'] ?? '';
$resultado = $_POST['resultado'] ?? '';

if (empty($nombre) || !in_array($resultado, ['APROBADO', 'DENEGADO'])) {
    echo json_encode(["success" => false, "message" => "Datos inválidos"]);
    exit;
}

// accesos.residente_id es obligatorio: solo se registra si el nombre
// corresponde a un residente activo. Los intentos de "desconocido" ya
// quedan guardados aparte en intentos_no_reconocidos.
$stmt = $conexion->prepare("
    SELECT id FROM residentes
    WHERE CONCAT(nombres, ' ', apellidos) = ? AND activo = 1
");
$stmt->execute([$nombre]);
$residente = $stmt->fetch();

if (!$residente) {
    echo json_encode(["success" => true, "message" => "Sin residente asociado, no se registró acceso"]);
    exit;
}

// Anti-duplicado: si dos pestañas/cámaras reconocen a la misma persona casi
// al mismo tiempo, ignora el segundo POST en vez de crear un Entrada/Salida falso.
$stmt = $conexion->prepare("
    SELECT tipo, TIMESTAMPDIFF(SECOND, fecha_hora, NOW()) AS segundos_desde
    FROM accesos
    WHERE residente_id = ? AND resultado = 'APROBADO'
    ORDER BY id DESC LIMIT 1
");
$stmt->execute([$residente['id']]);
$ultimo = $stmt->fetch();

if ($resultado === 'APROBADO' && $ultimo && $ultimo['segundos_desde'] < 8) {
    echo json_encode(["success" => true, "message" => "Duplicado ignorado", "tipo" => $ultimo['tipo']]);
    exit;
}

// Alterna Entrada/Salida según el último registro APROBADO de ese residente:
// si su última entrada fue "Entrada", este reconocimiento se toma como su salida.
$tipo = ($ultimo && $ultimo['tipo'] === 'Entrada') ? 'Salida' : 'Entrada';

$stmt = $conexion->prepare("
    INSERT INTO accesos (residente_id, fecha_hora, resultado, tipo, metodo)
    VALUES (?, NOW(), ?, ?, 'Reconocimiento Facial')
");
$stmt->execute([$residente['id'], $resultado, $tipo]);

echo json_encode(["success" => true, "tipo" => $tipo]);
