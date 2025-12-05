<?php
/**
 * Inbox API for Real-Time Updates
 * Handles AJAX requests for inbox badge and message updates
 */

header('Content-Type: application/json');
session_start();

require_once '../db/config.php';
require_once '../db/inbox.php';

// Check if user is logged in
$userID = isset($_COOKIE['userID']) ? intval($_COOKIE['userID']) : null;

if (!$userID) {
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Get input data
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

// Handle get unread count
if ($action === 'get_unread_count') {
    try {
        $count = getInboxCount($pdo, $userID, 'unread');
        echo json_encode([
            'success' => true,
            'count' => $count
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle get recent messages
if ($action === 'get_recent_messages') {
    try {
        $limit = isset($input['limit']) ? intval($input['limit']) : 5;
        $messages = getInboxMessages($pdo, $userID, 'unread', $limit, 0);
        
        echo json_encode([
            'success' => true,
            'messages' => $messages,
            'count' => count($messages)
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle get all messages (for inbox page)
if ($action === 'get_all_messages') {
    try {
        $status = isset($input['status']) ? $input['status'] : 'all';
        $limit = isset($input['limit']) ? intval($input['limit']) : 20;
        $offset = isset($input['offset']) ? intval($input['offset']) : 0;
        
        $messages = getInboxMessages($pdo, $userID, $status, $limit, $offset);
        
        // Get counts
        $allCount = getInboxCount($pdo, $userID, 'all');
        $unreadCount = getInboxCount($pdo, $userID, 'unread');
        $readCount = getInboxCount($pdo, $userID, 'read');
        $archivedCount = getInboxCount($pdo, $userID, 'archived');
        
        echo json_encode([
            'success' => true,
            'messages' => $messages,
            'counts' => [
                'all' => $allCount,
                'unread' => $unreadCount,
                'read' => $readCount,
                'archived' => $archivedCount
            ]
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle mark as read
if ($action === 'mark_read') {
    try {
        $messageID = isset($input['message_id']) ? intval($input['message_id']) : 0;
        
        if ($messageID) {
            $success = markAsRead($pdo, $messageID, $userID);
            echo json_encode(['success' => $success]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Message ID required']);
        }
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle mark as unread
if ($action === 'mark_unread') {
    try {
        $messageID = isset($input['message_id']) ? intval($input['message_id']) : 0;
        
        if ($messageID) {
            $success = markAsUnread($pdo, $messageID, $userID);
            echo json_encode(['success' => $success]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Message ID required']);
        }
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle archive
if ($action === 'archive') {
    try {
        $messageID = isset($input['message_id']) ? intval($input['message_id']) : 0;
        
        if ($messageID) {
            $success = archiveMessage($pdo, $messageID, $userID);
            echo json_encode(['success' => $success]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Message ID required']);
        }
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle unarchive
if ($action === 'unarchive') {
    try {
        $messageID = isset($input['message_id']) ? intval($input['message_id']) : 0;
        
        if ($messageID) {
            $success = unarchiveMessage($pdo, $messageID, $userID);
            echo json_encode(['success' => $success]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Message ID required']);
        }
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle delete
if ($action === 'delete') {
    try {
        $messageID = isset($input['message_id']) ? intval($input['message_id']) : 0;
        
        if ($messageID) {
            $success = deleteMessage($pdo, $messageID, $userID);
            echo json_encode(['success' => $success]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Message ID required']);
        }
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Invalid action
echo json_encode(['success' => false, 'error' => 'Invalid action']);
exit;
