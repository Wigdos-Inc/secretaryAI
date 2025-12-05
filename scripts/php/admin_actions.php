<?php
session_start();
header('Content-Type: application/json');

require_once '../db/config.php';

// Check if user is admin or owner
$userID = isset($_COOKIE['userID']) ? intval($_COOKIE['userID']) : null;
if (!$userID) {
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit();
}

$stmt = $pdo->prepare("SELECT role FROM tab_users WHERE user_ID = ?");
$stmt->execute([$userID]);
$user = $stmt->fetch();

if (!$user || !in_array($user['role'], ['admin', 'owner'])) {
    echo json_encode(['success' => false, 'error' => 'Admin access required']);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

// ======================================
// NEWSLETTER ACTIONS
// ======================================

if ($action === 'fetch_newsletters') {
    $filter = $input['filter'] ?? 'all';
    $search = $input['search'] ?? '';
    
    try {
        $query = "SELECT n.*, u.username as owner_username 
                  FROM tab_newsletters n 
                  LEFT JOIN tab_users u ON n.user_ID = u.user_ID 
                  WHERE 1=1";
        $params = [];
        
        if ($filter === 'admin') {
            $query .= " AND n.user_ID = ?";
            $params[] = $userID;
        }
        if ($filter === 'hidden') {
            $query .= " AND n.status = 'hidden'";
        }
        
        if ($search) {
            $query .= " AND n.title LIKE ?";
            $params[] = "%$search%";
        }
        
        $query .= " ORDER BY n.creation_date DESC";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $newsletters = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'newsletters' => $newsletters]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'delete_newsletters') {
    $newsletterIDs = $input['newsletter_ids'] ?? [];
    
    if (empty($newsletterIDs)) {
        echo json_encode(['success' => false, 'error' => 'No newsletters selected']);
        exit();
    }
    
    try {
        $placeholders = implode(',', array_fill(0, count($newsletterIDs), '?'));
        $stmt = $pdo->prepare("DELETE FROM tab_newsletters WHERE newsletter_ID IN ($placeholders)");
        $stmt->execute($newsletterIDs);
        
        echo json_encode(['success' => true, 'message' => 'Newsletters deleted successfully']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'toggle_newsletter_visibility') {
    $newsletterID = $input['newsletter_id'] ?? 0;
    
    try {
        $stmt = $pdo->prepare("SELECT status FROM tab_newsletters WHERE newsletter_ID = ?");
        $stmt->execute([$newsletterID]);
        $newsletter = $stmt->fetch();
        
        // If published -> hidden, if hidden -> draft
        $newStatus = ($newsletter['status'] === 'published' || $newsletter['status'] === 'draft') ? 'hidden' : 'draft';
        
        $stmt = $pdo->prepare("UPDATE tab_newsletters SET status = ? WHERE newsletter_ID = ?");
        $stmt->execute([$newStatus, $newsletterID]);
        
        // Notify users who favorited this newsletter if it's being hidden
        if ($newStatus === 'hidden') {
            require_once '../db/notifications.php';
            notifyNewsletterHidden($pdo, $newsletterID, 'Hidden by administrator');
        } elseif ($newsletter['status'] === 'hidden' && $newStatus === 'draft') {
            // Newsletter is being unhidden, notify users it's available again
            require_once '../db/notifications.php';
            notifyNewsletterRepublished($pdo, $newsletterID);
        }
        
        echo json_encode(['success' => true, 'new_status' => $newStatus]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// ======================================
// USER MANAGEMENT ACTIONS
// ======================================

if ($action === 'fetch_users') {
    $search = $input['search'] ?? '';
    
    try {
        $query = "SELECT user_ID, username, email, role, banned, locked_until, creation_date 
                  FROM tab_users WHERE 1=1";
        $params = [];
        
        if ($search) {
            $query .= " AND (username LIKE ? OR email LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }
        
        $query .= " ORDER BY creation_date DESC";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'users' => $users]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'lock_user') {
    $targetUserID = $input['user_id'] ?? 0;
    $days = intval($input['days'] ?? 7);
    
    try {
        $lockUntil = date('Y-m-d H:i:s', strtotime("+$days days"));
        $stmt = $pdo->prepare("UPDATE tab_users SET locked_until = ? WHERE user_ID = ?");
        $stmt->execute([$lockUntil, $targetUserID]);
        
        echo json_encode(['success' => true, 'message' => "User locked for $days days"]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'ban_user') {
    $targetUserID = $input['user_id'] ?? 0;
    
    try {
        $stmt = $pdo->prepare("UPDATE tab_users SET banned = 1 WHERE user_ID = ?");
        $stmt->execute([$targetUserID]);
        
        echo json_encode(['success' => true, 'message' => 'User banned successfully']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'unban_user') {
    $targetUserID = $input['user_id'] ?? 0;
    
    try {
        $stmt = $pdo->prepare("UPDATE tab_users SET banned = 0 WHERE user_ID = ?");
        $stmt->execute([$targetUserID]);
        
        echo json_encode(['success' => true, 'message' => 'User unbanned successfully']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// ======================================
// CATEGORY ACTIONS
// ======================================

if ($action === 'fetch_categories') {
    $search = $input['search'] ?? '';
    
    try {
        $query = "SELECT * FROM tab_categories WHERE 1=1";
        $params = [];
        
        if ($search) {
            $query .= " AND name LIKE ?";
            $params[] = "%$search%";
        }
        
        $query .= " ORDER BY name ASC";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'categories' => $categories]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'update_categories_status') {
    $categoryIDs = $input['category_ids'] ?? [];
    $status = $input['status'] ?? 'hidden';
    
    if (empty($categoryIDs)) {
        echo json_encode(['success' => false, 'error' => 'No categories selected']);
        exit();
    }
    
    if (!in_array($status, ['shown', 'hidden'])) {
        echo json_encode(['success' => false, 'error' => 'Invalid status']);
        exit();
    }
    
    try {
        $placeholders = implode(',', array_fill(0, count($categoryIDs), '?'));
        $stmt = $pdo->prepare("UPDATE tab_categories SET status = ? WHERE category_ID IN ($placeholders)");
        $stmt->execute(array_merge([$status], $categoryIDs));
        
        $actionText = $status === 'hidden' ? 'hidden' : 'shown';
        echo json_encode(['success' => true, 'message' => 'Categories ' . $actionText . ' successfully']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'toggle_category_visibility') {
    $categoryID = $input['category_id'] ?? 0;
    
    try {
        $stmt = $pdo->prepare("SELECT status FROM tab_categories WHERE category_ID = ?");
        $stmt->execute([$categoryID]);
        $category = $stmt->fetch();
        
        $newStatus = ($category['status'] === 'shown') ? 'hidden' : 'shown';
        
        $stmt = $pdo->prepare("UPDATE tab_categories SET status = ? WHERE category_ID = ?");
        $stmt->execute([$newStatus, $categoryID]);
        
        echo json_encode(['success' => true, 'new_status' => $newStatus]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// ======================================
// TAG MANAGEMENT ACTIONS
// ======================================

if ($action === 'fetch_banned_tags') {
    try {
        $stmt = $pdo->query("SELECT * FROM tab_banned_tags ORDER BY tag_name ASC");
        $tags = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'tags' => $tags]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'ban_tag') {
    $tagName = trim($input['tag_name'] ?? '');
    
    if (empty($tagName)) {
        echo json_encode(['success' => false, 'error' => 'Tag name is required']);
        exit();
    }
    
    // Ensure tag starts with #
    if (!str_starts_with($tagName, '#')) {
        $tagName = '#' . $tagName;
    }
    
    try {
        $stmt = $pdo->prepare("INSERT INTO tab_banned_tags (tag_name, banned_by, banned_date) VALUES (?, ?, NOW())");
        $stmt->execute([$tagName, $userID]);
        
        echo json_encode(['success' => true, 'message' => 'Tag banned successfully']);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            echo json_encode(['success' => false, 'error' => 'Tag already banned']);
        } else {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    exit;
}

if ($action === 'unban_tag') {
    $tagID = $input['tag_id'] ?? 0;
    
    try {
        $stmt = $pdo->prepare("DELETE FROM tab_banned_tags WHERE tag_ID = ?");
        $stmt->execute([$tagID]);
        
        echo json_encode(['success' => true, 'message' => 'Tag unbanned successfully']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid action']);
?>
