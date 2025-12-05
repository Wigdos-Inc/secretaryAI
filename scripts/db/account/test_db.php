<?php
// Simple DB test for diagnosing 500/internal server errors
ini_set('display_errors', 1);
ini_set('log_errors', 1);
error_reporting(E_ALL);

echo "test_db.php started\n";
require __DIR__ . '/../config.php';

if (!isset($pdo) || $pdo === null) {
    echo "PDO is not set or connection failed.\n";
    // Try to show last PHP error if available
    $err = error_get_last();
    if ($err) {
        echo "Last error: " . $err['message'] . " in " . $err['file'] . " on line " . $err['line'] . "\n";
    }
    exit(1);
}

try {
    $stmt = $pdo->query('SELECT 1');
    $row = $stmt->fetch();
    if ($row) {
        echo "DB query OK\n";
    } else {
        echo "DB query returned no rows\n";
    }
    echo "PDO driver: " . $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) . "\n";
} catch (Exception $e) {
    echo "PDO Exception: " . $e->getMessage() . "\n";
}

echo "test_db.php finished\n";

?>
