<?php

// Disable error display, enable logging
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Database connection configuration: use environment variables in production.
// Do NOT store secrets in source. Provide DB_* env vars in the host (Render, Docker, etc.).
$servername = getenv('DB_HOST') ?: null;
$username   = getenv('DB_USER') ?: null;
$password   = getenv('DB_PASS') ?: null;
$dbname     = getenv('DB_NAME') ?: null;
$port       = getenv('DB_PORT') ?: null;
$ssl_ca     = getenv('DB_SSL_CA') ?: (__DIR__ . '/ca.pem');

$dbStatus = null;

// PMA DB Access
// URL: https://pma.sd-lab.nl/
// Username: newsletter
// Password: [REDACTED]

// Homepage: https://102871.stu.sd-lab.nl/beroeps/newsletters/

$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

try {
    // Validate required settings before attempting connection
    if (!$servername || !$username || !$password || !$dbname) {
        throw new Exception('Database configuration incomplete. Please set DB_HOST, DB_USER, DB_PASS and DB_NAME environment variables.');
    }

    // Add MySQL SSL CA option if available
    if (defined('PDO::MYSQL_ATTR_SSL_CA') && !empty($ssl_ca)) {
        $options[PDO::MYSQL_ATTR_SSL_CA] = $ssl_ca;
    }

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $servername, $port ?: 3306, $dbname);
    $pdo = new PDO($dsn, $username, $password, $options);
    $pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
    $dbStatus = true;

    // Start Session (If necessary) & Get User ID
    if (session_status() === PHP_SESSION_NONE) session_start();
    //echo "Database is connected! ";
} catch (PDOException $e){
    // Log the error but don't display it to prevent information leakage
    error_log("Database connection failed: " . $e->getMessage());
    $dbStatus = false;
    $pdo = null; // Ensure $pdo is null when connection fails
}