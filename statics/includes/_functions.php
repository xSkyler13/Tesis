<?php

session_start();

require_once __DIR__ . "/../config/database.php";

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['accion'])) {
    header('Location: ../login.html');
    exit;
}

switch ($_POST['accion']) {
    case 'Ingresar':
        ingresar($conexion);
        break;

    case 'editar_registro':
        editar_registro($conexion);
        break;

    case 'eliminar_registro':
        eliminar_registro($conexion);
        break;

    case 'registrar':
        registrar($conexion);
        break;

    default:
        header('Location: ../login.html?error=5');
        exit;
}

// ---------------------------------------------------------------------------

function ingresar(PDO $db): void
{
    $nombre   = trim($_POST['nombre'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($nombre === '' || $password === '') {
        header('Location: ../login.html?error=1');
        exit;
    }

    $stmt = $db->prepare(
        "SELECT id, usuario, password_hash, rol_id FROM usuarios WHERE usuario = ? LIMIT 1"
    );
    $stmt->execute([$nombre]);
    $usuario = $stmt->fetch();

    if (!$usuario || !password_verify($password, $usuario['password_hash'])) {
        header('Location: ../login.html?error=3');
        exit;
    }

    // Regenerar ID de sesión tras autenticación exitosa (previene session fixation)
    session_regenerate_id(true);

    $_SESSION['id']        = $usuario['id'];
    $_SESSION['nombre']    = $usuario['usuario'];
    $_SESSION['rol']       = $usuario['rol_id'];
    $_SESSION['logged_in'] = true;

    $destino = match((int) $usuario['rol_id']) {
        1 => '../templates/home.html',
        2 => '../templates/inicio.html',
        default => null,
    };

    if ($destino === null) {
        session_destroy();
        header('Location: ../login.html?error=4');
        exit;
    }

    header('Location: ' . $destino);
    exit;
}

function editar_registro(PDO $db): void
{
    // TODO: implementar lógica de edición
}

function eliminar_registro(PDO $db): void
{
    // TODO: implementar lógica de eliminación
}

function registrar(PDO $db): void
{
    $usuario  = trim($_POST['usuario'] ?? '');
    $correo   = trim($_POST['correo'] ?? '');
    $password = $_POST['password'] ?? '';
    $rol_id   = (int) ($_POST['rol_id'] ?? 0);

    if ($usuario === '' || $correo === '' || $password === '' || $rol_id === 0) {
        header('Location: ../../templates/register.php?error=1');
        exit;
    }

    // Verificar duplicado
    $stmt = $db->prepare("SELECT id FROM usuarios WHERE usuario = ? OR correo = ? LIMIT 1");
    $stmt->execute([$usuario, $correo]);
    if ($stmt->fetch()) {
        header('Location: ../../templates/register.php?error=2');
        exit;
    }

    // Manejar foto capturada desde cámara (base64)
    $ruta_rostro = null;
    $foto_base64 = $_POST['foto_base64'] ?? '';
    if ($foto_base64 !== '') {
        $dir = __DIR__ . '/../../statics/uploads/rostros/';
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        // Extraer datos binarios del data URL (data:image/jpeg;base64,...)
        $imagen_data = explode(',', $foto_base64, 2)[1] ?? '';
        $imagen_bin  = base64_decode($imagen_data);
        if ($imagen_bin !== false) {
            $filename    = $usuario . '_' . time() . '.jpg';
            file_put_contents($dir . $filename, $imagen_bin);
            $ruta_rostro = 'statics/uploads/rostros/' . $filename;
        }
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);

    try {
        $stmt = $db->prepare(
            "INSERT INTO usuarios (usuario, correo, password_hash, rol_id, ruta_rostro)
             VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->execute([$usuario, $correo, $hash, $rol_id, $ruta_rostro]);
    } catch (\PDOException $e) {
        error_log($e->getMessage());
        header('Location: ../../templates/register.php?error=3');
        exit;
    }

    header('Location: ../../templates/register.php?ok=1');
    exit;
}
