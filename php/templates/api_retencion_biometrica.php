<?php
// Política de retención de datos biométricos (Ley 29733: no conservar datos
// personales más tiempo del necesario). Lo llama limpiar_biometria.py.
// - Fotos de intentos no reconocidos con más de RETENCION_NO_RECONOCIDOS_DIAS:
//   se borra el archivo; el registro del intento queda (sin foto) para estadística.
// - Residentes dados de baja hace más de RETENCION_BAJA_DIAS: se borran su foto
//   de rostro y de perfil. Devuelve sus nombres para que el script borre también
//   las copias que guarda el módulo facial (known_faces_inactivos/).

require_once __DIR__ . "/../includes/bootstrap.php";
requerir_interno();

$diasNoReconocidos = max(1, (int) env('RETENCION_NO_RECONOCIDOS_DIAS', '90'));
$diasBaja          = max(1, (int) env('RETENCION_BAJA_DIAS', '30'));
$raiz              = realpath(__DIR__ . '/../..');

// Borra un archivo solo si está dentro de una de las carpetas permitidas
function borrar_archivo_en($raiz, $rutaRelativa, array $carpetas)
{
    $archivo = realpath($raiz . '/' . $rutaRelativa);
    if (!$archivo) {
        return false;
    }
    foreach ($carpetas as $carpeta) {
        $base = realpath($raiz . '/' . $carpeta);
        if ($base && strpos($archivo, $base . DIRECTORY_SEPARATOR) === 0) {
            return @unlink($archivo);
        }
    }
    return false;
}

// INTENTOS NO RECONOCIDOS
$stmt = $conexion->prepare("
    SELECT id, foto_path FROM intentos_no_reconocidos
    WHERE foto_path IS NOT NULL AND fecha_hora < NOW() - INTERVAL ? DAY
");
$stmt->execute([$diasNoReconocidos]);
$intentos = $stmt->fetchAll();

$quitarFoto = $conexion->prepare("UPDATE intentos_no_reconocidos SET foto_path = NULL WHERE id = ?");
foreach ($intentos as $i) {
    borrar_archivo_en($raiz, $i['foto_path'], ['statics/img/no_reconocidos']);
    $quitarFoto->execute([$i['id']]);
}

// RESIDENTES DADOS DE BAJA
$stmt = $conexion->prepare("
    SELECT id, CONCAT(nombres, ' ', apellidos) AS nombre, ruta_rostro, foto_perfil
    FROM residentes
    WHERE fecha_baja IS NOT NULL AND fecha_baja <= CURDATE() - INTERVAL ? DAY
      AND (ruta_rostro IS NOT NULL OR foto_perfil IS NOT NULL)
");
$stmt->execute([$diasBaja]);
$residentes = $stmt->fetchAll();

$quitarFotos = $conexion->prepare("UPDATE residentes SET ruta_rostro = NULL, foto_perfil = NULL WHERE id = ?");
$nombres = [];
foreach ($residentes as $r) {
    foreach ([$r['ruta_rostro'], $r['foto_perfil']] as $ruta) {
        if ($ruta) {
            borrar_archivo_en($raiz, $ruta, ['known_faces', 'statics/img/residentes']);
        }
    }
    $quitarFotos->execute([$r['id']]);
    $nombres[] = $r['nombre'];
}

if ($intentos || $residentes) {
    auditar('retencion', 'biometria', null,
        count($intentos) . " fotos de no reconocidos (> $diasNoReconocidos días); "
        . count($residentes) . " residentes de baja (> $diasBaja días)");
}

echo json_encode([
    "success" => true,
    "fotos_no_reconocidos_borradas" => count($intentos),
    "residentes_de_baja" => $nombres,
]);
