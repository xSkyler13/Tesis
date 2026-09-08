<?php
// Datos reales para el panel de control (home.html): stat-cards + lista
// "Accesos en tiempo real", armados a partir de la tabla accesos.

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . "/../includes/config/database.php";

// ACCESOS HOY (ingresos aprobados del día)
$stmt = $conexion->query("
    SELECT COUNT(*) AS total FROM accesos
    WHERE resultado = 'APROBADO' AND DATE(fecha_hora) = CURDATE()
");
$accesos_hoy = (int) $stmt->fetch()['total'];

// RESIDENTES DENTRO: residentes cuyo último acceso aprobado fue una Entrada
$stmt = $conexion->query("
    SELECT COUNT(*) AS total FROM (
        SELECT a.residente_id
        FROM accesos a
        INNER JOIN (
            SELECT residente_id, MAX(id) AS ultimo_id
            FROM accesos
            WHERE resultado = 'APROBADO'
            GROUP BY residente_id
        ) u ON u.ultimo_id = a.id
        WHERE a.tipo = 'Entrada'
    ) x
");
$residentes_dentro = (int) $stmt->fetch()['total'];

// ALERTAS HOY: accesos denegados + intentos no reconocidos del día
$stmt = $conexion->query("
    SELECT COUNT(*) AS total FROM accesos
    WHERE resultado = 'DENEGADO' AND DATE(fecha_hora) = CURDATE()
");
$denegados_hoy = (int) $stmt->fetch()['total'];

$stmt = $conexion->query("
    SELECT COUNT(*) AS total FROM intentos_no_reconocidos
    WHERE DATE(fecha_hora) = CURDATE()
");
$desconocidos_hoy = (int) $stmt->fetch()['total'];

$alertas_hoy = $denegados_hoy + $desconocidos_hoy;

// VISITAS ACTIVAS: visitas pendientes de autorización
$stmt = $conexion->query("SELECT COUNT(*) AS total FROM visitas WHERE estado = 'Pendiente'");
$visitas_activas_hoy = (int) $stmt->fetch()['total'];

// LISTA: últimos accesos (con residente/torre/depto) + últimos intentos desconocidos, combinados por fecha
$stmt = $conexion->query("
    SELECT
        a.fecha_hora,
        a.resultado,
        a.tipo,
        CONCAT(r.nombres, ' ', r.apellidos) AS nombre,
        r.foto_perfil,
        t.nombre AS torre_nombre,
        d.numero AS depto_numero
    FROM accesos a
    INNER JOIN residentes r ON r.id = a.residente_id
    LEFT JOIN residente_departamento rd ON rd.id = (
        SELECT rd2.id FROM residente_departamento rd2
        WHERE rd2.residente_id = r.id AND rd2.activo = 1
        ORDER BY rd2.id LIMIT 1
    )
    LEFT JOIN departamentos d ON d.id = rd.departamento_id
    LEFT JOIN torres t ON t.id = d.torre_id
    ORDER BY a.id DESC
    LIMIT 8
");
$accesos = $stmt->fetchAll();

$stmt = $conexion->query("
    SELECT fecha_hora, foto_path FROM intentos_no_reconocidos
    ORDER BY id DESC LIMIT 4
");
$desconocidos = $stmt->fetchAll();

$eventos = [];
foreach ($accesos as $a) {
    $eventos[] = [
        "fecha_hora" => $a['fecha_hora'],
        "tipo_evento" => $a['resultado'] === 'DENEGADO' ? 'alerta' : ($a['tipo'] === 'Salida' ? 'salida' : 'entrada'),
        "nombre" => $a['nombre'],
        "detalle" => $a['torre_nombre'] ? "{$a['torre_nombre']} - Dep {$a['depto_numero']}" : "Sin departamento asignado",
        "foto" => $a['foto_perfil'],
    ];
}
foreach ($desconocidos as $d) {
    $eventos[] = [
        "fecha_hora" => $d['fecha_hora'],
        "tipo_evento" => "alerta",
        "nombre" => "Persona no reconocida",
        "detalle" => "Intento de acceso por reconocimiento facial",
        "foto" => null,
    ];
}

usort($eventos, fn($a, $b) => strcmp($b['fecha_hora'], $a['fecha_hora']));
$eventos = array_slice($eventos, 0, 8);

echo json_encode([
    "accesos_hoy" => $accesos_hoy,
    "residentes_dentro" => $residentes_dentro,
    "visitas_activas_hoy" => $visitas_activas_hoy,
    "alertas_hoy" => $alertas_hoy,
    "eventos" => $eventos,
]);
