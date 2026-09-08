<?php
// Exporta a un .xlsx real TODOS los departamentos que matchean los filtros
// actuales de Departamentos.html, sin paginación.
//
// El servidor no tiene ext-zip ni PharData habilitado (phar.readonly=On), así
// que el .xlsx (que por dentro es un .zip con varios XML) se arma a mano con
// un mini escritor de ZIP en PHP puro (método "store", sin compresión).

require_once __DIR__ . "/../includes/config/database.php";

// ==================== FILTROS (mismos que api_departamentos_lista.php) ====================

$torre_id      = $_GET['torre_id'] ?? '';
$piso          = $_GET['piso'] ?? '';
$estado        = $_GET['estado'] ?? '';
$tipo          = $_GET['tipo'] ?? '';
$fecha_desde   = $_GET['fecha_desde'] ?? '';
$fecha_hasta   = $_GET['fecha_hasta'] ?? '';
$buscar        = $_GET['buscar'] ?? '';

$where  = [];
$params = [];

if (!empty($torre_id)) {
    $where[] = "d.torre_id = ?";
    $params[] = $torre_id;
}
if ($piso !== '') {
    $where[] = "d.piso = ?";
    $params[] = $piso;
}
if (!empty($estado)) {
    $where[] = "d.estado = ?";
    $params[] = $estado;
}
if (!empty($tipo)) {
    $where[] = "d.tipo = ?";
    $params[] = $tipo;
}
if ($fecha_desde !== '') {
    $where[] = "DATE(d.fecha_creacion) >= ?";
    $params[] = $fecha_desde;
}
if ($fecha_hasta !== '') {
    $where[] = "DATE(d.fecha_creacion) <= ?";
    $params[] = $fecha_hasta;
}
if (!empty($buscar)) {
    $where[] = "(d.numero LIKE ? OR t.nombre LIKE ? OR CONCAT(r.nombres, ' ', r.apellidos) LIKE ?)";
    $like = '%' . $buscar . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

$whereSql = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

$sql = "
SELECT
    d.numero, t.nombre AS torre_nombre, d.piso, d.tipo, d.area, d.habitaciones, d.banos,
    d.estacionamiento, d.estado, CONCAT(r.nombres, ' ', r.apellidos) AS propietario,
    d.codigo_interno, d.fecha_creacion
FROM departamentos d
INNER JOIN torres t ON t.id = d.torre_id
LEFT JOIN residente_departamento rd ON rd.departamento_id = d.id AND rd.activo = 1 AND rd.tipo_relacion = 'Titular'
LEFT JOIN residentes r ON r.id = rd.residente_id
$whereSql
ORDER BY t.nombre, CAST(d.numero AS UNSIGNED)
";
$stmt = $conexion->prepare($sql);
$stmt->execute($params);
$filas = $stmt->fetchAll();

// ==================== ARMAR LA HOJA (xl/worksheets/sheet1.xml) ====================

function columnaExcel($indice) {
    $letra = '';
    while ($indice > 0) {
        $resto = ($indice - 1) % 26;
        $letra = chr(65 + $resto) . $letra;
        $indice = intdiv($indice - 1, 26);
    }
    return $letra;
}

function celdaTexto($col, $fila, $valor, $estilo = null) {
    $ref = columnaExcel($col) . $fila;
    $texto = htmlspecialchars((string) $valor, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    $s = $estilo !== null ? " s=\"$estilo\"" : '';
    return "<c r=\"$ref\"$s t=\"inlineStr\"><is><t>$texto</t></is></c>";
}

function celdaNumero($col, $fila, $valor) {
    $ref = columnaExcel($col) . $fila;
    if ($valor === null || $valor === '') {
        return "<c r=\"$ref\" t=\"inlineStr\"><is><t></t></is></c>";
    }
    return "<c r=\"$ref\"><v>" . htmlspecialchars((string) $valor, ENT_XML1, 'UTF-8') . "</v></c>";
}

$columnas = [
    'Departamento', 'Torre', 'Piso', 'Tipo', 'Área (m²)', 'Habitaciones', 'Baños',
    'Estacionamiento', 'Estado', 'Propietario', 'Código Interno', 'Fecha de Registro'
];

$sheetRows = '';

$celdasHeader = '';
foreach ($columnas as $i => $col) {
    $celdasHeader .= celdaTexto($i + 1, 1, $col, 1);
}
$sheetRows .= "<row r=\"1\">$celdasHeader</row>";

$numFila = 2;
foreach ($filas as $fila) {
    $celdas = '';
    $celdas .= celdaTexto(1, $numFila, $fila['numero']);
    $celdas .= celdaTexto(2, $numFila, $fila['torre_nombre']);
    $celdas .= celdaNumero(3, $numFila, $fila['piso']);
    $celdas .= celdaTexto(4, $numFila, $fila['tipo']);
    $celdas .= celdaNumero(5, $numFila, $fila['area']);
    $celdas .= celdaNumero(6, $numFila, $fila['habitaciones']);
    $celdas .= celdaNumero(7, $numFila, $fila['banos']);
    $celdas .= celdaTexto(8, $numFila, $fila['estacionamiento']);
    $celdas .= celdaTexto(9, $numFila, $fila['estado']);
    $celdas .= celdaTexto(10, $numFila, $fila['propietario'] && trim($fila['propietario']) !== '' ? $fila['propietario'] : '');
    $celdas .= celdaTexto(11, $numFila, $fila['codigo_interno']);
    $celdas .= celdaTexto(12, $numFila, $fila['fecha_creacion']);
    $sheetRows .= "<row r=\"$numFila\">$celdas</row>";
    $numFila++;
}

$sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    . "<sheetData>$sheetRows</sheetData>"
    . '</worksheet>';

// ==================== PARTES FIJAS DEL .xlsx ====================

$contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    . '<Default Extension="xml" ContentType="application/xml"/>'
    . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    . '</Types>';

$rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    . '</Relationships>';

$workbookXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    . '<sheets><sheet name="Departamentos" sheetId="1" r:id="rId1"/></sheets>'
    . '</workbook>';

$workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    . '</Relationships>';

$stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    . '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    . '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
    . '<borders count="1"><border/></borders>'
    . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0"/></cellStyleXfs>'
    . '<cellXfs count="2"><xf numFmtId="0" fontId="0" xfId="0"/><xf numFmtId="0" fontId="1" xfId="0" applyFont="1"/></cellXfs>'
    . '</styleSheet>';

// ==================== MINI ESCRITOR DE ZIP (método "store", sin compresión) ====================

function construirZip(array $archivos) {
    $local = '';
    $central = '';
    $offset = 0;

    foreach ($archivos as $nombre => $contenido) {
        $crc = crc32($contenido);
        $len = strlen($contenido);
        $nombreLen = strlen($nombre);

        $headerLocal = pack('VvvvvvVVVvv', 0x04034b50, 20, 0, 0, 0, 0, $crc, $len, $len, $nombreLen, 0);
        $local .= $headerLocal . $nombre . $contenido;

        $central .= pack(
            'VvvvvvvVVVvvvvvVV',
            0x02014b50, 20, 20, 0, 0, 0, 0, $crc, $len, $len, $nombreLen, 0, 0, 0, 0, 0, $offset
        ) . $nombre;

        $offset += strlen($headerLocal) + $len + $nombreLen;
    }

    $end = pack('VvvvvVVv', 0x06054b50, 0, 0, count($archivos), count($archivos), strlen($central), $offset, 0);

    return $local . $central . $end;
}

$xlsx = construirZip([
    '[Content_Types].xml'       => $contentTypes,
    '_rels/.rels'               => $rootRels,
    'xl/workbook.xml'           => $workbookXml,
    'xl/_rels/workbook.xml.rels' => $workbookRels,
    'xl/styles.xml'             => $stylesXml,
    'xl/worksheets/sheet1.xml'  => $sheetXml,
]);

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="departamentos.xlsx"');
header('Content-Length: ' . strlen($xlsx));
header('Access-Control-Allow-Origin: *');

echo $xlsx;
