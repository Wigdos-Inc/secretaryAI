<?php
session_start();
require '../config.php';

// Check database connection first
if (!$dbStatus || !$pdo) {
    header("location: ../../../pages/login_view.php?err=Database connection failed. Please try again later.");
    exit();
}

if (!isset($_COOKIE['userID'])) {
    header("location: ../../../pages/login.php");
    exit();
}

$id = $_COOKIE['userID'];
try {
    $query = "DELETE FROM tab_users WHERE user_ID = :ID";
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':ID', $id);
    $stmt->execute();

    session_start();
    session_unset();
    session_destroy();
    header("location: ../../../pages/login_view.php");
} catch (PDOException $e) {
    echo $e->getMessage();
}
