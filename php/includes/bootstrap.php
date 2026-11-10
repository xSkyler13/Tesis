<?php
// Punto de entrada común de todos los endpoints.
// PHP solo atiende peticiones que vienen de Flask (token interno). Flask ya
// validó la sesión y reenvía la identidad del usuario en X-Usuario-Id / X-Rol-Id;
// si no viene usuario, es una llamada interna del propio Flask.

header('Content-Type: application/json');

require_once __DIR__ . "/config/env.php";

// Misma zona horaria que la conexión MySQL (-05:00), para fechas y nombres de archivo
date_default_timezone_set(env('APP_TIMEZONE', 'America/Lima'));

$tokenRecibido = $_SERVER['HTTP_X_INTERNAL_TOKEN'] ?? '';
if (env('INTERNAL_TOKEN') === '' || !hash_equals(env('INTERNAL_TOKEN'), $tokenRecibido)) {
    http_response_code(403);
    die(json_encode(["success" => false, "message" => "No autorizado"]));
}

$AUTH = null;
if (isset($_SERVER['HTTP_X_USUARIO_ID'])) {
    $AUTH = [
        "id"     => (int) $_SERVER['HTTP_X_USUARIO_ID'],
        "rol_id" => (int) ($_SERVER['HTTP_X_ROL_ID'] ?? 0),
    ];
}

// Roles (tabla roles). Matriz de permisos: cada endpoint declara quién puede
// usarlo con requerir_usuario(ROLES_...). Agente de Cobros (3) no usa la web.
const ROL_ADMINISTRADOR = 1;
const ROL_SEGURIDAD = 2;
const ROLES_ADMIN = [ROL_ADMINISTRADOR];
const ROLES_PERSONAL = [ROL_ADMINISTRADOR, ROL_SEGURIDAD];

require_once __DIR__ . "/config/database.php";

// La sesión de Flask puede ser anterior a un cambio: si el usuario fue
// desactivado o cambió de rol, se aplica de inmediato. 401 hace que Flask
// cierre la sesión y el navegador vuelva al login.
if ($AUTH !== null) {
    $stmt = $conexion->prepare("SELECT rol_id FROM usuarios WHERE id = ? AND activo = 1");
    $stmt->execute([$AUTH['id']]);
    $rolActual = $stmt->fetchColumn();
    if ($rolActual === false) {
        http_response_code(401);
        die(json_encode(["success" => false, "message" => "Sesión expirada"]));
    }
    $AUTH['rol_id'] = (int) $rolActual;
}

function rechazar($mensaje = "No autorizado")
{
    http_response_code(403);
    die(json_encode(["success" => false, "message" => $mensaje]));
}

// Endpoint de uso exclusivo de Flask (reconocimiento facial, login, limpieza)
function requerir_interno()
{
    global $AUTH;
    if ($AUTH !== null) {
        rechazar();
    }
}

// Endpoint para usuarios con sesión; $roles vacío = cualquier rol
function requerir_usuario(array $roles = [])
{
    global $AUTH;
    if ($AUTH === null) {
        rechazar();
    }
    if ($roles && !in_array($AUTH['rol_id'], $roles, true)) {
        rechazar("No tienes permisos para esta acción");
    }
}

// El usuario solo puede operar sobre su propia cuenta, salvo un administrador
function requerir_propio_o_admin($usuarioId)
{
    global $AUTH;
    requerir_usuario();
    if ($AUTH['id'] !== (int) $usuarioId && $AUTH['rol_id'] !== ROL_ADMINISTRADOR) {
        rechazar("No puedes acceder a otra cuenta");
    }
}

// ===== Usuarios del sistema =====

// Valida los datos de un usuario; devuelve el mensaje de error o null
function validar_datos_usuario($usuario, $correo, $rolId)
{
    global $conexion;
    if (!preg_match('/^[A-Za-z0-9._-]{3,50}$/', $usuario)) {
        return "El usuario debe tener de 3 a 50 caracteres: letras, números, punto, guion o guion bajo";
    }
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        return "El correo no es válido";
    }
    $stmt = $conexion->prepare("SELECT id FROM roles WHERE id = ?");
    $stmt->execute([$rolId]);
    if (!$stmt->fetch()) {
        return "El rol no es válido";
    }
    return null;
}

// Administradores activos sin contar a $excluirId
function admins_activos($excluirId)
{
    global $conexion;
    $stmt = $conexion->prepare("SELECT COUNT(*) FROM usuarios WHERE rol_id = ? AND activo = 1 AND id <> ?");
    $stmt->execute([ROL_ADMINISTRADOR, $excluirId]);
    return (int) $stmt->fetchColumn();
}

// Decodifica una imagen en base64 (data URL) y devuelve los bytes solo si es
// realmente una imagen; null en caso contrario.
function decodificar_imagen($base64)
{
    $data = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $base64), true);
    if ($data === false || @getimagesizefromstring($data) === false) {
        return null;
    }
    return $data;
}

// Registra una acción en la tabla auditoria (solo inserción para la app).
// $usuarioId explícito sirve para eventos sin sesión, como el login.
// Nunca interrumpe la operación: si falla, se deja en el log de PHP.
function auditar($accion, $entidad, $entidadId = null, $detalle = null, $usuarioId = null)
{
    global $conexion, $AUTH;
    $usuarioId = $usuarioId ?? ($AUTH['id'] ?? null);
    try {
        $nombre = null;
        if ($usuarioId) {
            $stmt = $conexion->prepare("SELECT usuario FROM usuarios WHERE id = ?");
            $stmt->execute([$usuarioId]);
            $nombre = $stmt->fetchColumn() ?: null;
        }
        $stmt = $conexion->prepare("
            INSERT INTO auditoria (usuario_id, usuario, accion, entidad, entidad_id, detalle, ip)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $usuarioId, $nombre, $accion, $entidad,
            $entidadId !== null ? (int) $entidadId : null,
            $detalle !== null ? mb_substr_seguro($detalle, 500) : null,
            $_SERVER['HTTP_X_CLIENTE_IP'] ?? null,
        ]);
    } catch (Exception $e) {
        error_log("auditoria: " . $e->getMessage());
    }
}

// Decodifica el documento de una visita (foto del DNI o PDF). Valida el
// contenido real, no la extensión ni el tipo declarado. Devuelve
// ['data' => bytes, 'extension' => '.jpg|.png|.pdf'] o null si no es válido.
function decodificar_documento($base64, $maxBytes = 2 * 1024 * 1024)
{
    $data = base64_decode(preg_replace('#^data:[\w/.+-]+;base64,#i', '', $base64), true);
    if ($data === false || $data === '' || strlen($data) > $maxBytes) {
        return null;
    }
    if (strncmp($data, '%PDF-', 5) === 0) {
        return ['data' => $data, 'extension' => '.pdf'];
    }
    $info = @getimagesizefromstring($data);
    if ($info !== false && in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
        return ['data' => $data, 'extension' => image_type_to_extension($info[2])];
    }
    return null;
}

// Recorta sin mbstring (no está instalado) y sin partir caracteres UTF-8
function mb_substr_seguro($texto, $max)
{
    return strlen($texto) <= $max ? $texto : preg_replace('/^(.{0,' . ($max - 3) . '}).*$/us', '$1', $texto) . '...';
}

// Saca ($activo = false) o devuelve ($activo = true) a una persona del
// reconocimiento facial en Flask. La foto se mueve, no se borra. Si Flask no
// responde devuelve null: el cambio en BD ya quedó guardado y se puede reintentar.
function sincronizar_rostro($nombreCompleto, $activo)
{
    $url = rtrim(env('FLASK_URL', 'http://localhost:5001'), '/') . ($activo ? '/reactivate_face' : '/delete_face');
    $contexto = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n"
                      . "X-Internal-Token: " . env('INTERNAL_TOKEN') . "\r\n",
            'content' => http_build_query(['name' => $nombreCompleto]),
            'timeout' => 5,
            'ignore_errors' => true,
        ],
    ]);
    $respuesta = @file_get_contents($url, false, $contexto);
    return $respuesta ? json_decode($respuesta, true) : null;
}

// Nombre seguro para usar como archivo: solo letras, números, _ y -
function nombre_archivo_seguro($texto)
{
    return preg_replace('/[^\p{L}\p{N}_-]/u', '_', $texto);
}
