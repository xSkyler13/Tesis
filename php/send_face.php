<?php
// Script llamado en background: send_face.php <usuario> <ruta_tmpfile>
$usuario  = $argv[1] ?? '';
$tmpFile  = $argv[2] ?? '';

if (!$usuario || !file_exists($tmpFile)) exit(1);

$imagen = file_get_contents($tmpFile);
unlink($tmpFile);

$ch = curl_init('http://172.19.0.1:5001/save_face');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, [
    'name'  => $usuario,
    'image' => $imagen,
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_exec($ch);
curl_close($ch);
