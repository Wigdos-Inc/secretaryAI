<?php

// Disable error display, enable logging
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Database configuration - use environment variables; avoid embedding secrets in repository
// Expected env vars: DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME, DB_SSL_CA
$servername = getenv('DB_HOST') ?: 'localhost';
$username   = getenv('DB_USER') ?: 'newsletter';
$password   = getenv('DB_PASS') ?: '';
$dbname     = getenv('DB_NAME') ?: 'Newsletter_Automation';
$port       = getenv('DB_PORT') ?: '3306';
$ssl_ca     = getenv('DB_SSL_CA') ?: __DIR__ . '/ca.pem';

$dbStatus = null;

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