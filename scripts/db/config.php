<?php

// Disable error display, enable logging
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Database configuration - try to get from environment variables first, fallback to defaults
$servername = getenv('DB_HOST') ?: "sql211.infinityfree.com";
$username = getenv('DB_USER') ?: "if0_40655876";
$password = getenv('DB_PASS') ?: "Oi7gTzzLxT0S4l";
$dbname = getenv('DB_NAME') ?: "if0_40655876_secretaryai";

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
    $pdo = new PDO("mysql:host=$servername;dbname=$dbname",$username,$password,$options);
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