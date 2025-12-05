<?php
header('Content-Type: application/json');

// Include database connection
require_once '../db/config.php';
require_once '../db/notifications.php';

// Get the user's query
$input = json_decode(file_get_contents('php://input'), true);
$query = $input['query'] ?? '';
$action = $input['action'] ?? 'generate';

// Fetch single newsletter for editing
if ($action === 'fetch_single') {
    $newsletterID = $input['newsletter_ID'] ?? null;
    
    if (!$newsletterID) {
        echo json_encode(['success' => false, 'error' => 'Newsletter ID required']);
        exit;
    }
    
    try {
        // Fetch newsletter with creator info
        $stmt = $pdo->prepare("
            SELECT n.*, u.username as creator_username 
            FROM tab_newsletters n 
            LEFT JOIN tab_users u ON n.user_ID = u.user_ID 
            WHERE n.newsletter_ID = ?
        ");
        $stmt->execute([$newsletterID]);
        $newsletter = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$newsletter) {
            echo json_encode(['success' => false, 'error' => 'Newsletter not found']);
            exit;
        }
        
        // Fetch categories
        $stmt = $pdo->prepare("SELECT category_ID FROM con_newsletter_categories WHERE newsletter_ID = ?");
        $stmt->execute([$newsletterID]);
        $categories = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        echo json_encode([
            'success' => true,
            'newsletter' => $newsletter,
            'categories' => $categories
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// Handle AI edit action
if ($action === 'ai_edit') {
    $content = $input['content'] ?? '';
    $editInstructions = $input['instructions'] ?? '';
    
    if (empty($content)) {
        echo json_encode(['success' => false, 'error' => 'Content is required']);
        exit;
    }
    
    $webhookUrl = 'https://harveygrowthproperties.app.n8n.cloud/webhook-test/dadfcd6e-ece4-4982-b8d8-f27692082b71';
    
    $ch = curl_init($webhookUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'content' => $content,
        'instructions' => $editInstructions
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 120);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode == 200) {
        echo $response;
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to process AI edit']);
    }
    exit; // Important: Stop execution here
}

// Handle update action
if ($action === 'update') {
    $newsletterID = $input['newsletter_ID'] ?? null;
    $title = $input['title'] ?? '';
    $content = $input['content'] ?? '';
    $status = $input['status'] ?? null;
    $categoryIDs = $input['category_ids'] ?? null;
    $userID = isset($_COOKIE['userID']) ? intval($_COOKIE['userID']) : null;
    
    if (!$newsletterID || empty($title) || empty($content)) {
        echo json_encode(['success' => false, 'error' => 'Newsletter ID, title, and content are required']);
        exit;
    }
    
    try {
        // Start transaction
        $pdo->beginTransaction();
        
        // Check if newsletter exists and verify permissions
        $stmt = $pdo->prepare("SELECT user_ID FROM tab_newsletters WHERE newsletter_ID = ?");
        $stmt->execute([$newsletterID]);
        $newsletter = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$newsletter) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'error' => 'Newsletter not found']);
            exit;
        }
        
        // Get user role
        $stmt = $pdo->prepare("SELECT role FROM tab_users WHERE user_ID = ?");
        $stmt->execute([$userID]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Allow if user is owner/admin or if it's their own newsletter
        if ($newsletter['user_ID'] != $userID && (!$user || !in_array($user['role'], ['admin', 'owner']))) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'error' => 'Unauthorized']);
            exit;
        }
        
        // Check if content actually changed
        $stmt = $pdo->prepare("SELECT title, content FROM tab_newsletters WHERE newsletter_ID = ?");
        $stmt->execute([$newsletterID]);
        $original = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $contentChanged = ($original['title'] !== $title || $original['content'] !== $content);
        
        // Update newsletter
        if ($status !== null) {
            $stmt = $pdo->prepare("UPDATE tab_newsletters SET title = ?, content = ?, status = ? WHERE newsletter_ID = ?");
            $stmt->execute([$title, $content, $status, $newsletterID]);
        } else {
            $stmt = $pdo->prepare("UPDATE tab_newsletters SET title = ?, content = ? WHERE newsletter_ID = ?");
            $stmt->execute([$title, $content, $newsletterID]);
        }
        
        // Add user as contributor to newsletter if not already
        $stmt = $pdo->prepare("SELECT * FROM con_user_newsletters WHERE user_ID = ? AND newsletter_ID = ?");
        $stmt->execute([$userID, $newsletterID]);
        if ($stmt->rowCount() == 0) {
            $stmt = $pdo->prepare("INSERT INTO con_user_newsletters (user_ID, newsletter_ID) VALUES (?, ?)");
            $stmt->execute([$userID, $newsletterID]);
        }
        
        // Update categories if provided
        if ($categoryIDs !== null) {
            // Delete existing connections
            $stmt = $pdo->prepare("DELETE FROM con_newsletter_categories WHERE newsletter_ID = ?");
            $stmt->execute([$newsletterID]);
            
            // Insert new connections
            if (!empty($categoryIDs)) {
                $stmt = $pdo->prepare("INSERT INTO con_newsletter_categories (newsletter_ID, category_ID) VALUES (?, ?)");
                foreach ($categoryIDs as $categoryID) {
                    $stmt->execute([$newsletterID, $categoryID]);
                    
                    // Add user as contributor to category if not already (when newsletter is published)
                    $checkStatus = $pdo->prepare("SELECT status FROM tab_newsletters WHERE newsletter_ID = ?");
                    $checkStatus->execute([$newsletterID]);
                    $currentStatus = $checkStatus->fetchColumn();
                    
                    if ($currentStatus === 'published') {
                        $stmt2 = $pdo->prepare("SELECT * FROM con_user_categories WHERE user_ID = ? AND category_ID = ?");
                        $stmt2->execute([$userID, $categoryID]);
                        if ($stmt2->rowCount() == 0) {
                            $stmt2 = $pdo->prepare("INSERT INTO con_user_categories (user_ID, category_ID) VALUES (?, ?)");
                            $stmt2->execute([$userID, $categoryID]);
                        }
                    }
                }
            }
        }
        
        $pdo->commit();
        
        // Send notifications to users who favorited this newsletter only if content changed
        if ($contentChanged) {
            notifyNewsletterEdited($pdo, $newsletterID, false);
        }
        
        echo json_encode(['success' => true, 'message' => 'Newsletter updated successfully']);
    } catch (PDOException $e) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle delete action
if ($action === 'delete') {
    $newsletterID = $input['newsletter_ID'] ?? null;
    $userID = isset($_COOKIE['userID']) ? intval($_COOKIE['userID']) : null;
    
    if (!$newsletterID) {
        echo json_encode(['success' => false, 'error' => 'Newsletter ID is required']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("DELETE FROM tab_newsletters WHERE newsletter_ID = ? AND user_ID = ?");
        $stmt->execute([$newsletterID, $userID]);
        
        echo json_encode(['success' => true, 'message' => 'Newsletter deleted successfully']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle unpublish action
if ($action === 'unpublish') {
    $newsletterID = $input['newsletter_ID'] ?? null;
    $userID = isset($_COOKIE['userID']) ? intval($_COOKIE['userID']) : null;
    
    if (!$newsletterID) {
        echo json_encode(['success' => false, 'error' => 'Newsletter ID is required']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("UPDATE tab_newsletters SET status = 'draft' WHERE newsletter_ID = ? AND user_ID = ?");
        $stmt->execute([$newsletterID, $userID]);
        
        // Notify users who favorited this newsletter
        notifyNewsletterUnpublished($pdo, $newsletterID);
        
        echo json_encode(['success' => true, 'message' => 'Newsletter unpublished successfully']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle publish action
if ($action === 'publish') {
    $newsletterID = $input['newsletter_ID'] ?? null;
    $title = $input['title'] ?? null;
    $content = $input['content'] ?? null;
    $categoryIDs = $input['category_ids'] ?? null;
    $userID = isset($_COOKIE['userID']) ? intval($_COOKIE['userID']) : null;
    
    if (!$newsletterID) {
        echo json_encode(['success' => false, 'error' => 'Newsletter ID is required']);
        exit;
    }
    
    try {
        // Start transaction
        $pdo->beginTransaction();
        
        // Get old status to check if this is a republish
        $stmt = $pdo->prepare("SELECT status FROM tab_newsletters WHERE newsletter_ID = ?");
        $stmt->execute([$newsletterID]);
        $oldNewsletter = $stmt->fetch(PDO::FETCH_ASSOC);
        $wasUnpublished = $oldNewsletter && $oldNewsletter['status'] === 'draft';
        
        // If title and content are provided, update them first
        if ($title !== null && $content !== null) {
            // Verify ownership
            $stmt = $pdo->prepare("SELECT user_ID FROM tab_newsletters WHERE newsletter_ID = ?");
            $stmt->execute([$newsletterID]);
            $newsletter = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$newsletter || $newsletter['user_ID'] != $userID) {
                $pdo->rollBack();
                echo json_encode(['success' => false, 'error' => 'Unauthorized']);
                exit;
            }
            
            $stmt = $pdo->prepare("UPDATE tab_newsletters SET title = ?, content = ?, status = 'published' WHERE newsletter_ID = ?");
            $stmt->execute([$title, $content, $newsletterID]);
        } else {
            $stmt = $pdo->prepare("UPDATE tab_newsletters SET status = 'published' WHERE newsletter_ID = ?");
            $stmt->execute([$newsletterID]);
        }
        
        // Add user as contributor to newsletter if not already
        $stmt = $pdo->prepare("SELECT * FROM con_user_newsletters WHERE user_ID = ? AND newsletter_ID = ?");
        $stmt->execute([$userID, $newsletterID]);
        if ($stmt->rowCount() == 0) {
            $stmt = $pdo->prepare("INSERT INTO con_user_newsletters (user_ID, newsletter_ID) VALUES (?, ?)");
            $stmt->execute([$userID, $newsletterID]);
        }
        
        // Update categories if provided
        if ($categoryIDs !== null) {
            // Delete existing connections
            $stmt = $pdo->prepare("DELETE FROM con_newsletter_categories WHERE newsletter_ID = ?");
            $stmt->execute([$newsletterID]);
            
            // Insert new connections
            if (!empty($categoryIDs)) {
                $stmt = $pdo->prepare("INSERT INTO con_newsletter_categories (newsletter_ID, category_ID) VALUES (?, ?)");
                foreach ($categoryIDs as $categoryID) {
                    $stmt->execute([$newsletterID, $categoryID]);
                    
                    // Add user as contributor to category since newsletter is being published
                    $stmt2 = $pdo->prepare("SELECT * FROM con_user_categories WHERE user_ID = ? AND category_ID = ?");
                    $stmt2->execute([$userID, $categoryID]);
                    if ($stmt2->rowCount() == 0) {
                        $stmt2 = $pdo->prepare("INSERT INTO con_user_categories (user_ID, category_ID) VALUES (?, ?)");
                        $stmt2->execute([$userID, $categoryID]);
                    }
                }
            }
        }
        
        $pdo->commit();
        
        // Send appropriate notification
        if ($wasUnpublished) {
            // Notify users that the newsletter is back
            notifyNewsletterRepublished($pdo, $newsletterID);
        }
        
        // If this is a new publication with categories, notify users who favorited those categories
        if ($categoryIDs !== null && !empty($categoryIDs)) {
            notifyNewNewsletterInFavoritedCategory($pdo, $newsletterID, $categoryIDs);
        }
        
        echo json_encode(['success' => true, 'message' => 'Newsletter published successfully']);
    } catch (PDOException $e) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Handle save action
if ($action === 'save') {
    $title = $input['title'] ?? '';
    $content = $input['content'] ?? '';
    $status = $input['status'] ?? 'draft';
    $categoryIDs = $input['category_ids'] ?? [];
    $userID = isset($_COOKIE['userID']) ? intval($_COOKIE['userID']) : null;
    
    if (empty($title) || empty($content)) {
        echo json_encode(['success' => false, 'error' => 'Title and content are required']);
        exit;
    }
    
    try {
        // Start transaction
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare("INSERT INTO tab_newsletters (title, content, user_ID, creation_date, status) VALUES (?, ?, ?, NOW(), ?)");
        $stmt->execute([$title, $content, $userID, $status]);
        $newsletterID = $pdo->lastInsertId();
        
        // Add creator as contributor to their own newsletter
        try {
            $stmt = $pdo->prepare("INSERT INTO con_user_newsletters (user_ID, newsletter_ID) VALUES (?, ?)");
            $stmt->execute([$userID, $newsletterID]);
        } catch (PDOException $e) {
            throw $e; // Re-throw to rollback transaction
        }
        
        // Insert category connections
        if (!empty($categoryIDs)) {
            $stmt = $pdo->prepare("INSERT INTO con_newsletter_categories (newsletter_ID, category_ID) VALUES (?, ?)");
            foreach ($categoryIDs as $categoryID) {
                $stmt->execute([$newsletterID, $categoryID]);
                
                // Add user as contributor to category if newsletter is published
                if ($status === 'published') {
                    try {
                        $stmt2 = $pdo->prepare("SELECT * FROM con_user_categories WHERE user_ID = ? AND category_ID = ?");
                        $stmt2->execute([$userID, $categoryID]);
                        if ($stmt2->rowCount() == 0) {
                            $stmt2 = $pdo->prepare("INSERT INTO con_user_categories (user_ID, category_ID) VALUES (?, ?)");
                            $stmt2->execute([$userID, $categoryID]);
                        }
                    } catch (PDOException $e) {
                        throw $e; // Re-throw to rollback transaction
                    }
                }
            }
        }
        
        $pdo->commit();
        
        // If the newsletter is published, notify users who favorited the categories
        if ($status === 'published' && !empty($categoryIDs)) {
            notifyNewNewsletterInFavoritedCategory($pdo, $newsletterID, $categoryIDs);
        }
        
        echo json_encode(['success' => true, 'newsletter_ID' => $newsletterID, 'message' => 'Newsletter saved successfully']);
    } catch (PDOException $e) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Generate newsletter (existing code)
if (empty($query)) {
    echo json_encode(['success' => false, 'error' => 'Query is required']);
    exit;
}

$webhookUrl = 'https://harveygrowthproperties.app.n8n.cloud/webhook/066f9c41-8e73-499a-9f94-b58b806ba922';

$ch = curl_init($webhookUrl);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['query' => $query]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 120);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode == 200) {
    echo $response;
} else {
    echo json_encode(['success' => false, 'error' => 'Failed to generate newsletter']);
}
?>