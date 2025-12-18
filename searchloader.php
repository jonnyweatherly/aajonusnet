<?php
error_reporting(E_ERROR | E_PARSE);

if (ob_get_level()) {
    ob_end_clean();
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

$ids = (isset($data['ids']) && is_array($data['ids'])) ? $data['ids'] : [];

$replaceWith = '/\s+/u';
$contents = [];

foreach ($ids as $filePath) {
    if (is_file($filePath)) {
        $text = file_get_contents($filePath);
        $text = preg_replace($replaceWith, ' ', $text);
				$text = trim($text);
        $contents[$filePath] = $text;
    }
}

$json = json_encode($contents, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

header('Content-Type: application/json');
header('X-Total-Uncompressed-Length: ' . strlen($json));

echo $json;