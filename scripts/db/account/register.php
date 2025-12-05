<?php
session_start();
require '../config.php';

// Check database connection first
if (!$dbStatus || !$pdo) {
    header("location: ../../../pages/register_view.php?err=Database connection failed. Please try again later.");
    exit();
}

if($_SERVER['REQUEST_METHOD'] !== 'POST'){
    header("location: ../../../pages/register_view.php?err=Accessed page without POST");
    exit();
}

$name = trim($_POST['username']);
$email = trim($_POST['email']);
$password = trim($_POST['password']);
$passwordck = trim($_POST['passwordCheck']);
$dob = $_POST['birthdate'];

// Validate required fields
if(empty($name) || empty($email) || empty($password) || empty($passwordck) || empty($dob)){
    header('location: ../../../pages/register_view.php?err=All fields are required');
    exit();
}

// Check password match
if($password !== $passwordck){
    header('location: ../../../pages/register_view.php?err=Passwords did not match');
    exit();
}

// Validate password strength (minimum 6 characters)
if(strlen($password) < 6){
    header('location: ../../../pages/register_view.php?err=Password must be at least 6 characters');
    exit();
}

// Validate email format
if(!filter_var($email, FILTER_VALIDATE_EMAIL)){
    header('location: ../../../pages/register_view.php?err=Invalid email format');
    exit();
}

$date = date("Y-m-d");

try {
    // Check if username exists
    $query = "SELECT * FROM tab_users WHERE username = :username";
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':username', $name, PDO::PARAM_STR);
    $stmt->execute();
    $result_name = $stmt->fetch();

    // Check if email exists
    $query = "SELECT * FROM tab_users WHERE email = :email";
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':email', $email, PDO::PARAM_STR);
    $stmt->execute();
    $result_mail = $stmt->fetch();

    if($result_name){
        header('location: ../../../pages/register_view.php?err=Username already exists');
        exit();
    }
    if($result_mail){
        header('location: ../../../pages/register_view.php?err=Email address has already been used');
        exit();
    }

    // Hash password securely
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    // Insert new user
    $query = "INSERT INTO tab_users (username, password, email, dob, role, creation_date) ";
    $query .= "VALUES (:username, :password, :email, :dob, :role, :creation_date)";

    $stmt = $pdo->prepare($query);
    $stmt->execute([
        'username' => $name,
        'password' => $hashedPassword,
        'email' => $email,
        'dob' => $dob,
        'role' => "user",
        'creation_date' => $date
    ]);

    if ($stmt->rowCount()) {
        $id = $pdo->lastInsertId();
        
        // Fetch user data
        $query = "SELECT * FROM tab_users WHERE user_ID = :id";
        $stmt = $pdo->prepare($query);
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        $userData = $stmt->fetch();
        
        // Set cookies
        $expiry = time() + (30 * 24 * 60 * 60); // 30 days
        setcookie('userID', $id, $expiry, '/', '', false, true);
        setcookie('user_data', json_encode($userData), $expiry, '/', '', false, true);
        setcookie('show_tutorial', '1', $expiry, '/', '', false, true); // Flag for new users
        header("location: ../../../index.php");
        exit();
    } else {
        header('location: ../../../pages/register_view.php?err=Error creating account');
        exit();
    }
} catch (PDOException $e) {
    error_log($e->getMessage());
    header('location: ../../../pages/register_view.php?err=An error occurred. Please try again.');
    exit();
}
