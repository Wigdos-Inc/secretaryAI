<?php
/**
 * Insert Dummy Inbox Data for Testing
 * User ID: 6
 */

require_once '../config.php';

$userID = 7; // Change this to the desired user ID for testing

echo "=== Inserting Dummy Inbox Data ===\n\n";

try {
    // Check if user exists
    $stmt = $pdo->prepare("SELECT username FROM tab_users WHERE user_ID = ?");
    $stmt->execute([$userID]);
    $user = $stmt->fetch();
    
    if (!$user) {
        echo "ERROR: User ID $userID does not exist!\n";
        exit;
    }
    
    echo "User found: " . $user['username'] . "\n\n";
    
    // Get some newsletter IDs if they exist
    $stmt = $pdo->query("SELECT newsletter_ID, title FROM tab_newsletters LIMIT 3");
    $newsletters = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get some creator IDs if they exist
    $stmt = $pdo->query("SELECT user_ID, username FROM tab_users WHERE user_ID != $userID LIMIT 3");
    $creators = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Sample messages to insert
    $messages = [
        [
            'newsletter_ID' => isset($newsletters[0]) ? $newsletters[0]['newsletter_ID'] : null,
            'creator_ID' => isset($creators[0]) ? $creators[0]['user_ID'] : null,
            'subject' => 'New Newsletter Published!',
            'snippet' => 'Check out our latest newsletter about technology trends in 2025. It covers AI advancements, sustainable tech, and more exciting topics!',
            'status' => 'unread',
            'date' => date('Y-m-d H:i:s', strtotime('-2 hours'))
        ],
        [
            'newsletter_ID' => isset($newsletters[1]) ? $newsletters[1]['newsletter_ID'] : null,
            'creator_ID' => isset($creators[1]) ? $creators[1]['user_ID'] : null,
            'subject' => 'Weekly Digest: Top Stories',
            'snippet' => 'Here are the most popular articles from this week. Your favorite creators have been busy! Click to read the full digest.',
            'status' => 'unread',
            'date' => date('Y-m-d H:i:s', strtotime('-5 hours'))
        ],
        [
            'newsletter_ID' => null,
            'creator_ID' => isset($creators[2]) ? $creators[2]['user_ID'] : null,
            'subject' => 'Welcome to Newswire AI!',
            'snippet' => 'Thank you for joining Newswire AI! We\'re excited to have you here. Start by exploring newsletters and following your favorite creators.',
            'status' => 'read',
            'date' => date('Y-m-d H:i:s', strtotime('-1 day'))
        ],
        [
            'newsletter_ID' => isset($newsletters[2]) ? $newsletters[2]['newsletter_ID'] : null,
            'creator_ID' => isset($creators[0]) ? $creators[0]['user_ID'] : null,
            'subject' => 'Breaking News: Major Update',
            'snippet' => 'We\'ve just released a major update to our platform with new features including dark mode, improved search, and personalized recommendations!',
            'status' => 'unread',
            'date' => date('Y-m-d H:i:s', strtotime('-30 minutes'))
        ],
        [
            'newsletter_ID' => null,
            'creator_ID' => null,
            'subject' => 'System Notification',
            'snippet' => 'Your account settings have been updated successfully. If you didn\'t make these changes, please contact support immediately.',
            'status' => 'read',
            'date' => date('Y-m-d H:i:s', strtotime('-3 days'))
        ],
        [
            'newsletter_ID' => isset($newsletters[0]) ? $newsletters[0]['newsletter_ID'] : null,
            'creator_ID' => isset($creators[1]) ? $creators[1]['user_ID'] : null,
            'subject' => 'New Comment on Your Favorite Newsletter',
            'snippet' => 'Someone commented on a newsletter you follow. Join the conversation and share your thoughts!',
            'status' => 'archived',
            'date' => date('Y-m-d H:i:s', strtotime('-1 week'))
        ],
        [
            'newsletter_ID' => isset($newsletters[1]) ? $newsletters[1]['newsletter_ID'] : null,
            'creator_ID' => isset($creators[2]) ? $creators[2]['user_ID'] : null,
            'subject' => 'Special Offer: Premium Content',
            'snippet' => 'Unlock exclusive premium content from your favorite creators. Limited time offer - 50% off for the first month!',
            'status' => 'unread',
            'date' => date('Y-m-d H:i:s', strtotime('-15 minutes'))
        ],
        [
            'newsletter_ID' => null,
            'creator_ID' => isset($creators[0]) ? $creators[0]['user_ID'] : null,
            'subject' => 'You have a new follower',
            'snippet' => 'Good news! ' . (isset($creators[0]) ? $creators[0]['username'] : 'Someone') . ' started following you. Check out their profile!',
            'status' => 'read',
            'date' => date('Y-m-d H:i:s', strtotime('-2 days'))
        ]
    ];
    
    echo "Inserting " . count($messages) . " test messages...\n\n";
    
    $insertQuery = "
        INSERT INTO tab_inbox (user_ID, newsletter_ID, creator_ID, subject, snippet, status, date)
        VALUES (:userID, :newsletterID, :creatorID, :subject, :snippet, :status, :date)
    ";
    
    $stmt = $pdo->prepare($insertQuery);
    
    $successCount = 0;
    foreach ($messages as $index => $message) {
        $stmt->execute([
            'userID' => $userID,
            'newsletterID' => $message['newsletter_ID'],
            'creatorID' => $message['creator_ID'],
            'subject' => $message['subject'],
            'snippet' => $message['snippet'],
            'status' => $message['status'],
            'date' => $message['date']
        ]);
        
        $successCount++;
        echo "✓ Message " . ($index + 1) . ": " . $message['subject'] . " (" . $message['status'] . ")\n";
    }
    
    echo "\n=== Summary ===\n";
    echo "Successfully inserted $successCount messages for user ID $userID\n";
    
    // Show count by status
    $stmt = $pdo->prepare("SELECT status, COUNT(*) as count FROM tab_inbox WHERE user_ID = ? GROUP BY status");
    $stmt->execute([$userID]);
    $counts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "\nInbox Status Breakdown:\n";
    foreach ($counts as $row) {
        echo "  - " . ucfirst($row['status']) . ": " . $row['count'] . " message(s)\n";
    }
    
    echo "\n✅ Done! You can now test your inbox page.\n";
    
} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
