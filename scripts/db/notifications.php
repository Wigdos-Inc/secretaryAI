<?php
/**
 * Notification System
 * Handles automated notifications for newsletter events
 */

require_once 'config.php';
require_once 'inbox.php';

/**
 * Notify users when a new newsletter is added to a category they favorited
 * 
 * @param PDO $pdo Database connection
 * @param int $newsletterID Newsletter ID
 * @param array $categoryIDs Array of category IDs the newsletter belongs to
 * @return int Number of notifications sent
 */
function notifyNewNewsletterInFavoritedCategory($pdo, $newsletterID, $categoryIDs) {
    if (empty($categoryIDs)) {
        return 0;
    }
    
    try {
        // Get newsletter details
        $stmt = $pdo->prepare("
            SELECT n.newsletter_ID, n.title, n.user_ID, u.username as creator_username
            FROM tab_newsletters n
            LEFT JOIN tab_users u ON n.user_ID = u.user_ID
            WHERE n.newsletter_ID = ?
        ");
        $stmt->execute([$newsletterID]);
        $newsletter = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$newsletter) {
            return 0;
        }
        
        // Get snippet from newsletter content (first 150 characters)
        $stmt = $pdo->prepare("SELECT content FROM tab_newsletters WHERE newsletter_ID = ?");
        $stmt->execute([$newsletterID]);
        $contentRow = $stmt->fetch(PDO::FETCH_ASSOC);
        $content = $contentRow ? strip_tags($contentRow['content']) : '';
        $newsletterSnippet = substr($content, 0, 150) . (strlen($content) > 150 ? '...' : '');
        
        // Get all users who favorited these categories
        $placeholders = implode(',', array_fill(0, count($categoryIDs), '?'));
        $stmt = $pdo->prepare("
            SELECT DISTINCT fc.user_ID, c.name as category_name, c.category_ID
            FROM con_favorites_categories fc
            INNER JOIN tab_categories c ON fc.category_ID = c.category_ID
            WHERE fc.category_ID IN ($placeholders) AND fc.user_ID != ?
        ");
        
        $params = array_merge($categoryIDs, [$newsletter['user_ID']]);
        $stmt->execute($params);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $notificationCount = 0;
        
        // Group categories by user
        $userCategories = [];
        foreach ($users as $user) {
            if (!isset($userCategories[$user['user_ID']])) {
                $userCategories[$user['user_ID']] = [];
            }
            $userCategories[$user['user_ID']][] = $user['category_name'];
        }
        
        // Send notification to each user
        foreach ($userCategories as $userID => $categories) {
            $categoryList = count($categories) > 1 
                ? implode(', ', array_slice($categories, 0, -1)) . ' and ' . end($categories)
                : $categories[0];
            
            $subject = "New Newsletter in " . (count($categories) > 1 ? "Your Favorite Categories" : $categories[0]);
            
            $snippet = "A new newsletter \"" . htmlspecialchars($newsletter['title']) . "\" by " . 
                       htmlspecialchars($newsletter['creator_username']) . " has been added to " . 
                       $categoryList . ". " . $newsletterSnippet;
            
            if (createInboxMessage($pdo, $userID, $newsletterID, $newsletter['user_ID'], $subject, $snippet)) {
                $notificationCount++;
            }
        }
        
        return $notificationCount;
        
    } catch (PDOException $e) {
        error_log("Notification error: " . $e->getMessage());
        return 0;
    }
}

/**
 * Notify users when a newsletter they favorited is hidden/banned
 * 
 * @param PDO $pdo Database connection
 * @param int $newsletterID Newsletter ID
 * @param string $reason Reason for hiding (optional)
 * @return int Number of notifications sent
 */
function notifyNewsletterHidden($pdo, $newsletterID, $reason = null) {
    try {
        // Get newsletter details
        $stmt = $pdo->prepare("
            SELECT n.newsletter_ID, n.title, n.user_ID, u.username as creator_username
            FROM tab_newsletters n
            LEFT JOIN tab_users u ON n.user_ID = u.user_ID
            WHERE n.newsletter_ID = ?
        ");
        $stmt->execute([$newsletterID]);
        $newsletter = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$newsletter) {
            return 0;
        }
        
        // Get all users who favorited this newsletter
        $stmt = $pdo->prepare("
            SELECT user_ID
            FROM con_favorites_newsletters
            WHERE newsletter_ID = ?
        ");
        $stmt->execute([$newsletterID]);
        $users = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        if (empty($users)) {
            return 0;
        }
        
        $subject = "Newsletter No Longer Available";
        
        $snippet = "The newsletter \"" . htmlspecialchars($newsletter['title']) . "\" by " . 
                   htmlspecialchars($newsletter['creator_username']) . " is no longer available. ";
        
        if ($reason) {
            $snippet .= "Reason: " . htmlspecialchars($reason) . " ";
        }
        
        $snippet .= "It has been removed from your favorites. You may want to explore similar newsletters in our categories.";
        
        $notificationCount = 0;
        
        foreach ($users as $userID) {
            if (createInboxMessage($pdo, $userID, $newsletterID, $newsletter['user_ID'], $subject, $snippet)) {
                $notificationCount++;
            }
        }
        
        return $notificationCount;
        
    } catch (PDOException $e) {
        error_log("Notification error: " . $e->getMessage());
        return 0;
    }
}

/**
 * Notify users when a newsletter they favorited is edited
 * 
 * @param PDO $pdo Database connection
 * @param int $newsletterID Newsletter ID
 * @param bool $majorUpdate Whether this is a major update (default: false)
 * @return int Number of notifications sent
 */
function notifyNewsletterEdited($pdo, $newsletterID, $majorUpdate = false) {
    try {
        // Get newsletter details
        $stmt = $pdo->prepare("
            SELECT n.newsletter_ID, n.title, n.user_ID, u.username as creator_username
            FROM tab_newsletters n
            LEFT JOIN tab_users u ON n.user_ID = u.user_ID
            WHERE n.newsletter_ID = ?
        ");
        $stmt->execute([$newsletterID]);
        $newsletter = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$newsletter) {
            return 0;
        }
        
        // Get all users who favorited this newsletter
        $stmt = $pdo->prepare("
            SELECT user_ID
            FROM con_favorites_newsletters
            WHERE newsletter_ID = ?
        ");
        $stmt->execute([$newsletterID]);
        $users = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        if (empty($users)) {
            return 0;
        }
        
        $subject = $majorUpdate ? "Major Update to Favorited Newsletter" : "Newsletter Updated";
        
        $snippet = "The newsletter \"" . htmlspecialchars($newsletter['title']) . "\" by " . 
                   htmlspecialchars($newsletter['creator_username']) . " has been updated. ";
        
        if ($majorUpdate) {
            $snippet .= "This is a major update with significant changes. We recommend reviewing the updated content. ";
        } else {
            $snippet .= "The content has been revised with minor improvements. ";
        }
        
        $snippet .= "No action is needed - your favorite is automatically updated. Click to view the latest version.";
        
        $notificationCount = 0;
        
        foreach ($users as $userID) {
            if (createInboxMessage($pdo, $userID, $newsletterID, $newsletter['user_ID'], $subject, $snippet)) {
                $notificationCount++;
            }
        }
        
        return $notificationCount;
        
    } catch (PDOException $e) {
        error_log("Notification error: " . $e->getMessage());
        return 0;
    }
}

/**
 * Notify users when a newsletter they favorited is unpublished
 * 
 * @param PDO $pdo Database connection
 * @param int $newsletterID Newsletter ID
 * @return int Number of notifications sent
 */
function notifyNewsletterUnpublished($pdo, $newsletterID) {
    try {
        // Get newsletter details
        $stmt = $pdo->prepare("
            SELECT n.newsletter_ID, n.title, n.user_ID, u.username as creator_username
            FROM tab_newsletters n
            LEFT JOIN tab_users u ON n.user_ID = u.user_ID
            WHERE n.newsletter_ID = ?
        ");
        $stmt->execute([$newsletterID]);
        $newsletter = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$newsletter) {
            return 0;
        }
        
        // Get all users who favorited this newsletter
        $stmt = $pdo->prepare("
            SELECT user_ID
            FROM con_favorites_newsletters
            WHERE newsletter_ID = ?
        ");
        $stmt->execute([$newsletterID]);
        $users = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        if (empty($users)) {
            return 0;
        }
        
        $subject = "Favorited Newsletter Unpublished";
        
        $snippet = "The newsletter \"" . htmlspecialchars($newsletter['title']) . "\" by " . 
                   htmlspecialchars($newsletter['creator_username']) . " has been unpublished by the creator. " .
                   "It is no longer publicly available but remains in your favorites. " .
                   "You will be notified if it becomes available again.";
        
        $notificationCount = 0;
        
        foreach ($users as $userID) {
            if (createInboxMessage($pdo, $userID, $newsletterID, $newsletter['user_ID'], $subject, $snippet)) {
                $notificationCount++;
            }
        }
        
        return $notificationCount;
        
    } catch (PDOException $e) {
        error_log("Notification error: " . $e->getMessage());
        return 0;
    }
}

/**
 * Notify users when a newsletter they favorited is republished
 * 
 * @param PDO $pdo Database connection
 * @param int $newsletterID Newsletter ID
 * @return int Number of notifications sent
 */
function notifyNewsletterRepublished($pdo, $newsletterID) {
    try {
        // Get newsletter details
        $stmt = $pdo->prepare("
            SELECT n.newsletter_ID, n.title, n.user_ID, u.username as creator_username
            FROM tab_newsletters n
            LEFT JOIN tab_users u ON n.user_ID = u.user_ID
            WHERE n.newsletter_ID = ?
        ");
        $stmt->execute([$newsletterID]);
        $newsletter = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$newsletter) {
            return 0;
        }
        
        // Get all users who favorited this newsletter
        $stmt = $pdo->prepare("
            SELECT user_ID
            FROM con_favorites_newsletters
            WHERE newsletter_ID = ?
        ");
        $stmt->execute([$newsletterID]);
        $users = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        if (empty($users)) {
            return 0;
        }
        
        $subject = "Favorited Newsletter Back Online";
        
        $snippet = "Good news! The newsletter \"" . htmlspecialchars($newsletter['title']) . "\" by " . 
                   htmlspecialchars($newsletter['creator_username']) . " is now available again. " .
                   "It has been republished and you can access it anytime. Click to read now!";
        
        $notificationCount = 0;
        
        foreach ($users as $userID) {
            if (createInboxMessage($pdo, $userID, $newsletterID, $newsletter['user_ID'], $subject, $snippet)) {
                $notificationCount++;
            }
        }
        
        return $notificationCount;
        
    } catch (PDOException $e) {
        error_log("Notification error: " . $e->getMessage());
        return 0;
    }
}
