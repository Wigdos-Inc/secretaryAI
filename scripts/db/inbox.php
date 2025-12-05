<?php
/**
 * Inbox Management Functions
 * Handles fetching, updating, and managing user inbox messages
 */

require_once 'config.php';

/**
 * Get inbox messages for a user with optional filtering
 * 
 * @param PDO $pdo Database connection
 * @param int $userID User ID
 * @param string $status Filter by status: 'all', 'unread', 'read', 'archived'
 * @param int $limit Maximum number of messages to return (0 = no limit)
 * @param int $offset Offset for pagination
 * @return array Array of inbox messages with newsletter and creator details
 */
function getInboxMessages($pdo, $userID, $status = 'all', $limit = 0, $offset = 0) {
    
    // Build query based on status filter
    $query = "
        SELECT 
            i.message_ID,
            i.user_ID,
            i.newsletter_ID,
            i.creator_ID,
            i.subject,
            i.snippet,
            i.status,
            i.date,
            n.title as newsletter_title,
            u.username as creator_username
        FROM tab_inbox i
        LEFT JOIN tab_newsletters n ON i.newsletter_ID = n.newsletter_ID
        LEFT JOIN tab_users u ON i.creator_ID = u.user_ID
        WHERE i.user_ID = :userID
    ";
    
    // Add status filter if not 'all'
    if ($status !== 'all') {
        $query .= " AND i.status = :status";
    }
    
    // Order by date descending (newest first)
    $query .= " ORDER BY i.date DESC";
    
    // Add limit and offset if specified
    if ($limit > 0) {
        $query .= " LIMIT :limit OFFSET :offset";
    }
    
    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':userID', $userID, PDO::PARAM_INT);
    
    if ($status !== 'all') {
        $stmt->bindValue(':status', $status, PDO::PARAM_STR);
    }
    
    if ($limit > 0) {
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    }
    
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

/**
 * Get count of inbox messages by status
 * 
 * @param PDO $pdo Database connection
 * @param int $userID User ID
 * @param string $status Status to count: 'all', 'unread', 'read', 'archived'
 * @return int Count of messages
 */
function getInboxCount($pdo, $userID, $status = 'all') {
    
    $query = "SELECT COUNT(*) as count FROM tab_inbox WHERE user_ID = :userID";
    
    if ($status !== 'all') {
        $query .= " AND status = :status";
    }
    
    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':userID', $userID, PDO::PARAM_INT);
    
    if ($status !== 'all') {
        $stmt->bindValue(':status', $status, PDO::PARAM_STR);
    }
    
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    return (int)$result['count'];
}

/**
 * Get a single inbox message by ID
 * 
 * @param PDO $pdo Database connection
 * @param int $messageID Message ID
 * @param int $userID User ID (for security check)
 * @return array|false Message data or false if not found
 */
function getInboxMessage($pdo, $messageID, $userID) {
    
    $query = "
        SELECT 
            i.message_ID,
            i.user_ID,
            i.newsletter_ID,
            i.creator_ID,
            i.subject,
            i.snippet,
            i.status,
            i.date,
            n.title as newsletter_title,
            u.username as creator_username
        FROM tab_inbox i
        LEFT JOIN tab_newsletters n ON i.newsletter_ID = n.newsletter_ID
        LEFT JOIN tab_users u ON i.creator_ID = u.user_ID
        WHERE i.message_ID = :messageID AND i.user_ID = :userID
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':messageID', $messageID, PDO::PARAM_INT);
    $stmt->bindValue(':userID', $userID, PDO::PARAM_INT);
    $stmt->execute();
    
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

/**
 * Update message status (read/unread/archived)
 * 
 * @param PDO $pdo Database connection
 * @param int $messageID Message ID
 * @param int $userID User ID (for security check)
 * @param string $status New status: 'read', 'unread', 'archived'
 * @return bool Success status
 */
function updateMessageStatus($pdo, $messageID, $userID, $status) {
    
    // Validate status
    $validStatuses = ['read', 'unread', 'archived'];
    if (!in_array($status, $validStatuses)) {
        return false;
    }
    
    $query = "UPDATE tab_inbox SET status = :status WHERE message_ID = :messageID AND user_ID = :userID";
    
    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':status', $status, PDO::PARAM_STR);
    $stmt->bindValue(':messageID', $messageID, PDO::PARAM_INT);
    $stmt->bindValue(':userID', $userID, PDO::PARAM_INT);
    
    return $stmt->execute();
}

/**
 * Mark message as read
 * 
 * @param PDO $pdo Database connection
 * @param int $messageID Message ID
 * @param int $userID User ID (for security check)
 * @return bool Success status
 */
function markAsRead($pdo, $messageID, $userID) {
    return updateMessageStatus($pdo, $messageID, $userID, 'read');
}

/**
 * Mark message as unread
 * 
 * @param PDO $pdo Database connection
 * @param int $messageID Message ID
 * @param int $userID User ID (for security check)
 * @return bool Success status
 */
function markAsUnread($pdo, $messageID, $userID) {
    return updateMessageStatus($pdo, $messageID, $userID, 'unread');
}

/**
 * Archive a message
 * 
 * @param PDO $pdo Database connection
 * @param int $messageID Message ID
 * @param int $userID User ID (for security check)
 * @return bool Success status
 */
function archiveMessage($pdo, $messageID, $userID) {
    return updateMessageStatus($pdo, $messageID, $userID, 'archived');
}

/**
 * Unarchive a message (move back to read status)
 * 
 * @param PDO $pdo Database connection
 * @param int $messageID Message ID
 * @param int $userID User ID (for security check)
 * @return bool Success status
 */
function unarchiveMessage($pdo, $messageID, $userID) {
    return updateMessageStatus($pdo, $messageID, $userID, 'read');
}

/**
 * Delete a message permanently
 * 
 * @param PDO $pdo Database connection
 * @param int $messageID Message ID
 * @param int $userID User ID (for security check)
 * @return bool Success status
 */
function deleteMessage($pdo, $messageID, $userID) {
    
    $query = "DELETE FROM tab_inbox WHERE message_ID = :messageID AND user_ID = :userID";
    
    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':messageID', $messageID, PDO::PARAM_INT);
    $stmt->bindValue(':userID', $userID, PDO::PARAM_INT);
    
    return $stmt->execute();
}

/**
 * Bulk update messages status
 * 
 * @param PDO $pdo Database connection
 * @param array $messageIDs Array of message IDs
 * @param int $userID User ID (for security check)
 * @param string $status New status
 * @return bool Success status
 */
function bulkUpdateStatus($pdo, $messageIDs, $userID, $status) {
    
    if (empty($messageIDs)) {
        return false;
    }
    
    // Validate status
    $validStatuses = ['read', 'unread', 'archived'];
    if (!in_array($status, $validStatuses)) {
        return false;
    }
    
    $placeholders = implode(',', array_fill(0, count($messageIDs), '?'));
    $query = "UPDATE tab_inbox SET status = ? WHERE message_ID IN ($placeholders) AND user_ID = ?";
    
    $stmt = $pdo->prepare($query);
    
    // Bind status first
    $params = [$status];
    // Add all message IDs
    $params = array_merge($params, $messageIDs);
    // Add user ID last
    $params[] = $userID;
    
    return $stmt->execute($params);
}

/**
 * Bulk delete messages
 * 
 * @param PDO $pdo Database connection
 * @param array $messageIDs Array of message IDs
 * @param int $userID User ID (for security check)
 * @return bool Success status
 */
function bulkDeleteMessages($pdo, $messageIDs, $userID) {
    
    if (empty($messageIDs)) {
        return false;
    }
    
    $placeholders = implode(',', array_fill(0, count($messageIDs), '?'));
    $query = "DELETE FROM tab_inbox WHERE message_ID IN ($placeholders) AND user_ID = ?";
    
    $stmt = $pdo->prepare($query);
    
    // Add all message IDs
    $params = $messageIDs;
    // Add user ID last
    $params[] = $userID;
    
    return $stmt->execute($params);
}

/**
 * Create a new inbox message (for system notifications)
 * 
 * @param PDO $pdo Database connection
 * @param int $userID User ID
 * @param int $newsletterID Newsletter ID (optional)
 * @param int $creatorID Creator ID (optional)
 * @param string $subject Message subject
 * @param string $snippet Message snippet/preview
 * @return int|false New message ID or false on failure
 */
function createInboxMessage($pdo, $userID, $newsletterID, $creatorID, $subject, $snippet) {
    
    $query = "
        INSERT INTO tab_inbox (user_ID, newsletter_ID, creator_ID, subject, snippet, status, date)
        VALUES (:userID, :newsletterID, :creatorID, :subject, :snippet, 'unread', NOW())
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->bindValue(':userID', $userID, PDO::PARAM_INT);
    $stmt->bindValue(':newsletterID', $newsletterID, $newsletterID ? PDO::PARAM_INT : PDO::PARAM_NULL);
    $stmt->bindValue(':creatorID', $creatorID, $creatorID ? PDO::PARAM_INT : PDO::PARAM_NULL);
    $stmt->bindValue(':subject', $subject, PDO::PARAM_STR);
    $stmt->bindValue(':snippet', $snippet, PDO::PARAM_STR);
    
    if ($stmt->execute()) {
        return $pdo->lastInsertId();
    }
    
    return false;
}

// Handle AJAX requests if this file is called directly
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    
    // Start session if not already started
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    // Check if user is logged in
    $userID = isset($_COOKIE['userID']) ? intval($_COOKIE['userID']) : null;
    
    if (!$userID) {
        echo json_encode(['success' => false, 'error' => 'Not authenticated']);
        exit;
    }
    
    $action = $_POST['action'];
    $response = ['success' => false];
    
    try {
        switch ($action) {
            case 'markRead':
                $messageID = isset($_POST['messageID']) ? intval($_POST['messageID']) : 0;
                if ($messageID) {
                    $response['success'] = markAsRead($pdo, $messageID, $userID);
                }
                break;
                
            case 'markUnread':
                $messageID = isset($_POST['messageID']) ? intval($_POST['messageID']) : 0;
                if ($messageID) {
                    $response['success'] = markAsUnread($pdo, $messageID, $userID);
                }
                break;
                
            case 'archive':
                $messageID = isset($_POST['messageID']) ? intval($_POST['messageID']) : 0;
                if ($messageID) {
                    $response['success'] = archiveMessage($pdo, $messageID, $userID);
                }
                break;
                
            case 'delete':
                $messageID = isset($_POST['messageID']) ? intval($_POST['messageID']) : 0;
                if ($messageID) {
                    $response['success'] = deleteMessage($pdo, $messageID, $userID);
                }
                break;
                
            case 'bulkUpdate':
                $messageIDs = isset($_POST['messageIDs']) ? json_decode($_POST['messageIDs'], true) : [];
                $status = isset($_POST['status']) ? $_POST['status'] : '';
                if (!empty($messageIDs) && $status) {
                    $response['success'] = bulkUpdateStatus($pdo, $messageIDs, $userID, $status);
                }
                break;
                
            case 'bulkDelete':
                $messageIDs = isset($_POST['messageIDs']) ? json_decode($_POST['messageIDs'], true) : [];
                if (!empty($messageIDs)) {
                    $response['success'] = bulkDeleteMessages($pdo, $messageIDs, $userID);
                }
                break;
                
            default:
                $response['error'] = 'Invalid action';
        }
    } catch (Exception $e) {
        $response['error'] = $e->getMessage();
    }
    
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}


