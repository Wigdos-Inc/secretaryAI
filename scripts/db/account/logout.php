<?php
session_start();

if (!isset($_COOKIE['userID'])) {
    header("location: ../../../index.php");
    exit();
}

// Clear all cookies by setting them to expire in the past
setcookie('userID', '', time() - 3600, '/', '', false, true);
setcookie('user_data', '', time() - 3600, '/', '', false, true);
setcookie('logged_in', '', time() - 3600, '/', '', false, false);
setcookie('show_tutorial', '', time() - 3600, '/', '', false, true);

session_unset();
session_destroy();
header("location: ../../../pages/login_view.php");
exit();
