<?php
/**
 * Favorites Management API
 * Handles adding/removing favorites for newsletters, categories, and creators
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
$type = $input['type'] ?? ''; // 'newsletter', 'category', or 'creator'
$itemID = $input['item_id'] ?? null;

// Validate type
$validTypes = ['newsletter', 'category', 'creator'];
if (!in_array($type, $validTypes)) {
    echo json_encode(['success' => false, 'error' => 'Invalid type']);
    exit;
}

// Map type to table names
$tableMap = [
    'newsletter' => 'con_favorites_newsletters',
    'category' => 'con_favorites_categories',
    'creator' => 'con_favorites_creators'
];

$columnMap = [
    'newsletter' => 'newsletter_ID',
    'category' => 'category_ID',
    'creator' => 'favorite_user_ID'
];

$table = $tableMap[$type];
$column = $columnMap[$type];

/**
 * Send notification to user's inbox when they favorite something
 * 
 * @param PDO $pdo Database connection
 * @param int $userID User ID
 * @param string $type Type of favorite (newsletter, category, creator)
 * @param int $itemID ID of the favorited item
 * @param string $action Action performed (added or removed)
 */
function sendFavoriteNotification($pdo, $userID, $type, $itemID, $action) {
    try {
        $subject = '';
        $snippet = '';
        $newsletterID = null;
        $creatorID = null;
        
        if ($action === 'added') {
            if ($type === 'newsletter') {
                // Get newsletter details
                $stmt = $pdo->prepare("
                    SELECT n.newsletter_ID, n.title, n.user_ID, u.username as creator_username
                    FROM tab_newsletters n
                    LEFT JOIN tab_users u ON n.user_ID = u.user_ID
                    WHERE n.newsletter_ID = ?
                ");
                $stmt->execute([$itemID]);
                $newsletter = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($newsletter) {
                    $newsletterID = $newsletter['newsletter_ID'];
                    $creatorID = $newsletter['user_ID'];
                    $subject = "Newsletter Added to Favorites";
                    $snippet = "You've added \"" . htmlspecialchars($newsletter['title']) . "\" by " . 
                               htmlspecialchars($newsletter['creator_username']) . " to your favorites. " .
                               "You'll receive notifications about updates to this newsletter.";
                }
            } 
            elseif ($type === 'category') {
                // Get category details
                $stmt = $pdo->prepare("SELECT category_ID, name FROM tab_categories WHERE category_ID = ?");
                $stmt->execute([$itemID]);
                $category = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($category) {
                    $subject = "Category Added to Favorites";
                    $snippet = "You're now following the \"" . htmlspecialchars($category['name']) . "\" category. " .
                               "You'll be notified when new newsletters are added to this category.";
                }
            }
            elseif ($type === 'creator') {
                // Get creator details
                $stmt = $pdo->prepare("SELECT user_ID, username FROM tab_users WHERE user_ID = ?");
                $stmt->execute([$itemID]);
                $creator = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($creator) {
                    $creatorID = $creator['user_ID'];
                    $subject = "Creator Followed";
                    $snippet = "You're now following " . htmlspecialchars($creator['username']) . ". " .
                               "You'll be notified when they publish new newsletters.";
                }
            }
            
            if ($subject && $snippet) {
                createInboxMessage($pdo, $userID, $newsletterID, $creatorID, $subject, $snippet);
            }
        }
    } catch (PDOException $e) {
        // Silent fail - don't interrupt the favorite operation
        error_log("Notification error: " . $e->getMessage());
    }
}

// Handle add favorite action
if ($action === 'add') {
    if (!$itemID) {
        echo json_encode(['success' => false, 'error' => 'Item ID is required']);
        exit;
    }
    
    try {
        // Check if already favorited
        $stmt = $pdo->prepare("SELECT * FROM $table WHERE user_ID = ? AND $column = ?");
        $stmt->execute([$userID, $itemID]);
        
        if ($stmt->fetch()) {
            echo json_encode(['success' => false, 'error' => 'Already in favorites']);
            exit;
        }
        
        // Add to favorites
        $stmt = $pdo->prepare("INSERT INTO $table (user_ID, $column) VALUES (?, ?)");
        $stmt->execute([$userID, $itemID]);
        
        // Send inbox notification
        sendFavoriteNotification($pdo, $userID, $type, $itemID, 'added');
        
        echo json_encode([
            'success' => true, 
            'message' => ucfirst($type) . ' added to favorites',
            'favorited' => true
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle remove favorite action
if ($action === 'remove') {
    if (!$itemID) {
        echo json_encode(['success' => false, 'error' => 'Item ID is required']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("DELETE FROM $table WHERE user_ID = ? AND $column = ?");
        $stmt->execute([$userID, $itemID]);
        
        echo json_encode([
            'success' => true, 
            'message' => ucfirst($type) . ' removed from favorites',
            'favorited' => false
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle toggle favorite action
if ($action === 'toggle') {
    if (!$itemID) {
        echo json_encode(['success' => false, 'error' => 'Item ID is required']);
        exit;
    }
    
    try {
        // Check if already favorited
        $stmt = $pdo->prepare("SELECT * FROM $table WHERE user_ID = ? AND $column = ?");
        $stmt->execute([$userID, $itemID]);
        
        if ($stmt->fetch()) {
            // Remove from favorites
            $stmt = $pdo->prepare("DELETE FROM $table WHERE user_ID = ? AND $column = ?");
            $stmt->execute([$userID, $itemID]);
            
            echo json_encode([
                'success' => true, 
                'message' => ucfirst($type) . ' removed from favorites',
                'favorited' => false
            ]);
        } else {
            // Add to favorites
            $stmt = $pdo->prepare("INSERT INTO $table (user_ID, $column) VALUES (?, ?)");
            $stmt->execute([$userID, $itemID]);
            
            // Send inbox notification
            sendFavoriteNotification($pdo, $userID, $type, $itemID, 'added');
            
            echo json_encode([
                'success' => true, 
                'message' => ucfirst($type) . ' added to favorites',
                'favorited' => true
            ]);
        }
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle check favorite status
if ($action === 'check') {
    if (!$itemID) {
        echo json_encode(['success' => false, 'error' => 'Item ID is required']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM $table WHERE user_ID = ? AND $column = ?");
        $stmt->execute([$userID, $itemID]);
        
        $isFavorited = $stmt->fetch() !== false;
        
        echo json_encode([
            'success' => true, 
            'favorited' => $isFavorited
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle get all favorites
if ($action === 'get_all') {
    try {
        $favorites = [];
        
        if ($type === 'newsletter') {
            $stmt = $pdo->prepare("
                SELECT n.newsletter_ID, n.title, n.creation_date, n.status, u.username as creator_username
                FROM con_favorites_newsletters f
                INNER JOIN tab_newsletters n ON f.newsletter_ID = n.newsletter_ID
                LEFT JOIN tab_users u ON n.user_ID = u.user_ID
                WHERE f.user_ID = ?
                ORDER BY n.creation_date DESC
            ");
            $stmt->execute([$userID]);
            $favorites = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } 
        else if ($type === 'category') {
            $stmt = $pdo->prepare("
                SELECT c.category_ID, c.name
                FROM con_favorites_categories f
                INNER JOIN tab_categories c ON f.category_ID = c.category_ID
                WHERE f.user_ID = ?
                ORDER BY c.name
            ");
            $stmt->execute([$userID]);
            $favorites = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        else if ($type === 'creator') {
            $stmt = $pdo->prepare("
                SELECT u.user_ID, u.username, u.creation_date, u.role
                FROM con_favorites_creators f
                INNER JOIN tab_users u ON f.favorite_user_ID = u.user_ID
                WHERE f.user_ID = ?
                ORDER BY u.username
            ");
            $stmt->execute([$userID]);
            $favorites = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        
        echo json_encode([
            'success' => true, 
            'favorites' => $favorites,
            'count' => count($favorites)
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle get favorite count
if ($action === 'count') {
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM $table WHERE user_ID = ?");
        $stmt->execute([$userID]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true, 
            'count' => (int)$result['count']
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Invalid action
echo json_encode(['success' => false, 'error' => 'Invalid action']);
exit;
