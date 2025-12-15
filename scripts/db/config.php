<?php

// Disable error display, enable logging
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Database configuration - try to get from environment variables first, fallback to defaults
$servername = getenv('DB_HOST') ?: "secretary-ai-secretaryai.g.aivencloud.com";
$username = getenv('DB_USER') ?: "avnadmin";
$password = getenv('DB_PASS') ?: "[REDACTED_AIVEN_PASS]";
$dbname = getenv('DB_NAME') ?: "defaultdb";
$port     = getenv('DB_PORT') ?: "17780";
$ssl_ca   = getenv('DB_SSL_CA') ?: __DIR__ . '/ca.pem';

$dbStatus = null;

// PMA DB Access
# URL: https://pma.sd-lab.nl/
# Username: newsletter
# Password: 35kwJILTx4IXYeNB2Oqs

// Homepage: https://102871.stu.sd-lab.nl/beroeps/newsletters/

$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

try {
    // Provide SSL CA for Aiven MySQL. PDO::MYSQL_ATTR_SSL_CA is defined when using PDO MySQL.
    if (defined('PDO::MYSQL_ATTR_SSL_CA')) {
        $options[PDO::MYSQL_ATTR_SSL_CA] = $ssl_ca;
    }

    $dsn = "mysql:host=$servername;port=$port;dbname=$dbname;charset=utf8mb4";
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