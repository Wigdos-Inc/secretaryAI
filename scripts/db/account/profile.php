<?php
session_start();
require '../config.php';

// Check database connection first
if (!$dbStatus || !$pdo) {
    header("location: ../../../pages/login_view.php?err=Database connection failed. Please try again later.");
    exit();
}

try{
    if (!isset($_COOKIE['userID'])) {
        header("Location: ../../../pages/login_view.php");
        exit();
    }
    else{
        $userid = $_COOKIE['userID'];
        
        $query = "SELECT * FROM tab_users WHERE user_ID = :ID";
        $stmt = $pdo->prepare($query);
        $stmt->bindParam(':ID', $userid, PDO::PARAM_INT);
        $stmt->execute();

        $result = $stmt->fetch();
        
        // Update user_data cookie
        $expiry = time() + (30 * 24 * 60 * 60); // 30 days
        setcookie('user_data', json_encode($result), $expiry, '/', '', false, true);

        header('location: ../../../pages/profile_view.php');
        exit();
    }
} catch (PDOException $e){
    error_log($e->getMessage());
    header("Location: ../../../pages/login_view.php?err=An error occurred");
    exit();
}
