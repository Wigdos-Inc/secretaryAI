<?php
session_start();

// Clear the tutorial flag cookie by setting it to expire in the past
if (isset($_COOKIE['show_tutorial'])) {
    setcookie('show_tutorial', '', time() - 3600, '/', '', false, true);
}

// Return success response
header('Content-Type: application/json');
echo json_encode(['success' => true]);
exit();
