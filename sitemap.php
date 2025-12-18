<?php
declare(strict_types=1);

header('Content-Type: application/xml; charset=utf-8');

$mdFolder = 'md';
$url = "https://aajonus.net/";

function sanitizeFileName($string) {
    $string = iconv('UTF-8', 'ASCII//TRANSLIT', $string);
    $string = preg_replace('/[^a-zA-Z0-9\s]/', '', $string);
    $string = preg_replace('/\s+/', '-', $string);
    $string = strtolower(trim($string, '-'));
    return $string;
}

echo '<?xml version="1.0" encoding="UTF-8"?>';
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

// Home Page
echo '<url>';
echo '<loc>' . $url . '</loc>';
echo '<changefreq>daily</changefreq>';
echo '<priority>1.0</priority>';
echo '</url>';

// Categories
$directories = glob($mdFolder . '/*', GLOB_ONLYDIR);
foreach ($directories as $dir) {
    $category = str_replace($mdFolder . '/', '', $dir);
    $category = sanitizeFileName($category);
    echo '<url>';
    echo '<loc>' . $url . $category . '</loc>';
    echo '<changefreq>daily</changefreq>';
    echo '<priority>0.8</priority>';
    echo '</url>';
}

// Articles
$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($mdFolder, FilesystemIterator::SKIP_DOTS | FilesystemIterator::UNIX_PATHS));
foreach ($files as $file) {
    if ($file->isDir()) {
        continue;
    }
    $filename = $file->getBasename('.' . $file->getExtension());
    $sanitizedFileName = sanitizeFileName($filename);

    echo '<url>';
    echo '<loc>' . $url . $sanitizedFileName . '</loc>';
    echo '<changefreq>weekly</changefreq>';
    echo '<priority>0.7</priority>';
    echo '</url>';
}

echo '</urlset>';
?>