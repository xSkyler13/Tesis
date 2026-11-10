<?php
// Lee la configuración de .env en la raíz del proyecto (ver .env.example).
// Formato KEY=VALUE; las líneas con # son comentarios.

$GLOBALS['_ENV_CONFIG'] = [];
$rutaEnv = __DIR__ . '/../../../.env';
if (is_readable($rutaEnv)) {
    foreach (file($rutaEnv, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linea) {
        $linea = trim($linea);
        if ($linea === '' || $linea[0] === '#' || strpos($linea, '=') === false) {
            continue;
        }
        [$clave, $valor] = explode('=', $linea, 2);
        $GLOBALS['_ENV_CONFIG'][trim($clave)] = trim($valor);
    }
}

function env($clave, $defecto = '')
{
    $valor = getenv($clave);
    if ($valor !== false) {
        return $valor;
    }
    return $GLOBALS['_ENV_CONFIG'][$clave] ?? $defecto;
}
