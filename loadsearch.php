<?php
error_reporting(E_ERROR | E_PARSE);

if (ob_get_level()) {
    ob_end_clean();
}

$mdFolder = 'md';

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

$ids = (isset($data['ids']) && is_array($data['ids'])) ? $data['ids'] : [];

$whiteSpaceList = ["\x09" => ' ', "\x0A" => ' ', "\x0B" => ' ', "\x0C" => ' ', "\x0D" => ' ', "\xC2\xA0" => ' '];
$contents = [];
$mdBase = (realpath($mdFolder) ?: exit('Folder missing')) . DIRECTORY_SEPARATOR;

foreach ($ids as $filePath) {
    $path = realpath($filePath);
    if ($path && strpos($path, $mdBase) === 0 && is_file($path)) {
        $text = file_get_contents($path);
        $text = strtr($text, $whiteSpaceList);
        $text = preg_replace('/ {2,}/', ' ', $text); // Avoid /u (slow)
        $contents[$filePath] = trim($text);
    }
}

$json = json_encode($contents, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

header('Content-Type: application/json');
header('X-Total-Uncompressed-Length: ' . strlen($json));

echo $json;