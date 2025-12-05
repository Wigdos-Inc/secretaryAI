<?php
session_start();
require '../config.php';

// Check database connection first
if (!$dbStatus || !$pdo) {
    header("location: ../../../pages/profile_view.php?err=Database connection failed. Please try again later.");
    exit();
}

if($_SERVER['REQUEST_METHOD'] !== 'POST'){
    header("location: ../../../pages/profile_view.php?err=Accessed page without POST");
    exit();
}

if(!isset($_COOKIE['userID'])){
    header("location: ../../../pages/login_view.php");
    exit();
}

$username = $_POST['username'];
$email = $_POST['email'];
$dob = $_POST['birthdate'];
$password_old = sha1($_POST['oldpassword']);
$password_new = sha1($_POST['password']);
$password_confirm = sha1($_POST['passwordCheck']);
$id = $_COOKIE['userID'];

// Validate required fields
if(empty($username) || empty($email) || empty($dob)){
    header('location: ../../../pages/profile_view.php?err=All fields are required');
    exit();
}

// Validate email format
if(!filter_var($email, FILTER_VALIDATE_EMAIL)){
    header('location: ../../../pages/profile_view.php?err=Invalid email format');
    exit();
}

try{
    // Check if username is taken by another user
    $query = "SELECT * FROM tab_users WHERE username = :username AND user_ID != :id";
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':username', $username, PDO::PARAM_STR);
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    $result_name = $stmt->fetch();

    if($result_name){
        header('location: ../../../pages/profile_view.php?err=Username already exists');
        exit();
    }

    // Check if email is taken by another user
    $query = "SELECT * FROM tab_users WHERE email = :email AND user_ID != :id";
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':email', $email, PDO::PARAM_STR);
    $stmt->bindParam(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    $result_email = $stmt->fetch();

    if($result_email){
        header('location: ../../../pages/profile_view.php?err=Email already in use');
        exit();
    }

    if(!isset($_POST['username'])){$username = $result_usr['username'];}
    if(!isset($_POST['email'])){$email = $result_usr['email'];}
    if(!isset($_POST['birthdate'])){$dob = $result_usr['dob'];}

    if($_POST['password'] != ''){
        if($password_old != $result_usr['password'] || $password_new != $password_confirm){
            header("location: ../../../pages/profile_view.php?err=Password doesn't match");
            exit();
        }
        else {
            if ($password_new == $result_usr['password']) {
                header("location: ../../../pages/profile_view.php?err=Password is the same as old password.");
                exit();
            }
        }
    }
    else{
        $password_new = $result_usr['password'];
    }

    // Update user information
    $query = "UPDATE tab_users SET username = :username, email = :email, dob = :dob WHERE user_ID = :ID";
    $stmt = $pdo->prepare($query);
    $stmt->execute([
        'ID' => $id,
        'username' => $username,
        'password' => $password_new,
        'email' => $email,
        'dob' => $dob,
        'role' => $result_usr['role'],
        'creation_date' => $result_usr['creation_date']
    ]);

    // Fetch updated user data
    $query = "SELECT * FROM tab_users WHERE user_ID = :ID";
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':ID', $id, PDO::PARAM_INT);
    $stmt->execute();
    $result_usr = $stmt->fetch();

    // Update user_data cookie
    $expiry = time() + (30 * 24 * 60 * 60); // 30 days
    setcookie('user_data', json_encode($result_usr), $expiry, '/', '', false, true);
    header('location: ../../../pages/profile_view.php?success=Profile updated successfully');
    exit();
} catch (PDOException $e){
    error_log($e->getMessage());
    header('location: ../../../pages/profile_view.php?err=An error occurred. Please try again.');
    exit();
}
