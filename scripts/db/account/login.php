<?php
// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('log_errors', 1);
error_reporting(E_ALL);

session_start();
require '../config.php';

if($_SERVER['REQUEST_METHOD'] !== 'POST'){
    header("location: ../../../pages/login_view.php?err=Accessed page without POST");
    exit();
}

$username = trim($_POST['username']);
$password = trim($_POST['password']);

if(empty($username) || empty($password)){
    header("location: ../../../pages/login_view.php?err=Username and password are required");
    exit();
}

try {
    $query = "SELECT * FROM tab_users WHERE username = :username";
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':username', $username, PDO::PARAM_STR);
    $stmt->execute();

    $result = $stmt->fetch();
    
    if(!$result){
        header('location: ../../../pages/login_view.php?err=Login details did not match');
        exit();
    }
    
    // Check if this is a legacy SHA1 password or new bcrypt password
    $isLegacyPassword = false;
    $passwordValid = false;
    
    // Check if password_legacy column exists and is set
    if(array_key_exists('password_legacy', $result) && $result['password_legacy'] == 1){
        // Try SHA1 verification for legacy passwords
        if(sha1($password) === $result['password']){
            $passwordValid = true;
            $isLegacyPassword = true;
        }
    } else {
        // Try bcrypt verification for new passwords
        if(password_verify($password, $result['password'])){
            $passwordValid = true;
        } else if(sha1($password) === $result['password']){
            // Fallback: try SHA1 if bcrypt fails (for databases without password_legacy column)
            $passwordValid = true;
            $isLegacyPassword = true;
        }
    }
    
    if(!$passwordValid){
        header('location: ../../../pages/login_view.php?err=Login details did not match');
        exit();
    }
    
    // If this was a legacy password, upgrade it to bcrypt
    if($isLegacyPassword && array_key_exists('password_legacy', $result)){
        // Only update if password_legacy column exists
        $newHash = password_hash($password, PASSWORD_DEFAULT);
        $updateQuery = "UPDATE tab_users SET password = :password, password_legacy = 0 WHERE user_ID = :userID";
        $updateStmt = $pdo->prepare($updateQuery);
        $updateStmt->execute([
            'password' => $newHash,
            'userID' => $result['user_ID']
        ]);
    } else if($isLegacyPassword){
        // If column doesn't exist, just update the password
        $newHash = password_hash($password, PASSWORD_DEFAULT);
        $updateQuery = "UPDATE tab_users SET password = :password WHERE user_ID = :userID";
        $updateStmt = $pdo->prepare($updateQuery);
        $updateStmt->execute([
            'password' => $newHash,
            'userID' => $result['user_ID']
        ]);
    }
    
    // Set cookies
    $expiry = time() + (30 * 24 * 60 * 60); // 30 days
    setcookie('userID', $result['user_ID'], $expiry, '/', '', false, true);
    setcookie('user_data', json_encode($result), $expiry, '/', '', false, true);
    setcookie('logged_in', '1', $expiry, '/', '', false, false); // Not HttpOnly for JS access
    
    // Determine redirect URL
    $redirect = isset($_POST['redirect']) ? $_POST['redirect'] : '';
    if ($redirect === 'inbox') {
        $redirectUrl = '../../../index.php?load=pages/inbox_view.php';
    } else {
        $pageBeforeLogin = isset($_COOKIE['pageBeforeLogin']) ? $_COOKIE['pageBeforeLogin'] : 'pages/profile_view.php';
        $redirectUrl = '../../../index.php?load=' . urlencode($pageBeforeLogin);
    }
    
    // Redirect to the appropriate page
    echo "<script>
        if(window.self !== window.top){
            window.top.location.href = '$redirectUrl';
        } else {
            window.location.href = '$redirectUrl';
        }
    </script>";
    exit();
    
} catch (PDOException $e){
    error_log('Login Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    header("location: ../../../pages/login_view.php?err=Database error: " . urlencode($e->getMessage()));
    exit();
} catch (Exception $e){
    error_log('General Login Error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());
    header("location: ../../../pages/login_view.php?err=Error: " . urlencode($e->getMessage()));
    exit();
}
