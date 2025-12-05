<?php
header('Content-Type: application/json');

// Include database connection
require_once '../db/config.php';

// Get the input
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

// Fetch all categories
if ($action === 'fetch') {
    try {
        $stmt = $pdo->query("SELECT * FROM tab_categories ORDER BY name ASC");
        $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'categories' => $categories]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Fetch categories for a specific newsletter
if ($action === 'fetch_for_newsletter') {
    $newsletterID = $input['newsletter_ID'] ?? null;
    
    if (!$newsletterID) {
        echo json_encode(['success' => false, 'error' => 'Newsletter ID is required']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("SELECT category_ID FROM con_newsletter_categories WHERE newsletter_ID = ?");
        $stmt->execute([$newsletterID]);
        $categoryIDs = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        echo json_encode(['success' => true, 'category_ids' => $categoryIDs]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Create new category
if ($action === 'create') {
    $categoryName = trim($input['category_name'] ?? '');
    $userID = isset($_COOKIE['userID']) ? intval($_COOKIE['userID']) : null;
    
    if (empty($categoryName)) {
        echo json_encode(['success' => false, 'error' => 'Category name is required']);
        exit;
    }
    
    try {
        // Check if category already exists
        $stmt = $pdo->prepare("SELECT category_ID FROM tab_categories WHERE name = ?");
        $stmt->execute([$categoryName]);
        if ($stmt->fetch()) {
            echo json_encode(['success' => false, 'error' => 'Category already exists']);
            exit;
        }
        
        $stmt = $pdo->prepare("INSERT INTO tab_categories (name, user_ID, status) VALUES (?, ?, 'shown')");
        $stmt->execute([$categoryName, $userID]);
        $categoryID = $pdo->lastInsertId();
        
        echo json_encode([
            'success' => true, 
            'category_ID' => $categoryID,
            'category_name' => $categoryName,
            'message' => 'Category created successfully'
        ]);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

// Save newsletter categories (update connections)
if ($action === 'save_newsletter_categories') {
    $newsletterID = $input['newsletter_ID'] ?? null;
    $categoryIDs = $input['category_ids'] ?? [];
    
    if (!$newsletterID) {
        echo json_encode(['success' => false, 'error' => 'Newsletter ID is required']);
        exit;
    }
    
    try {
        // Start transaction
        $pdo->beginTransaction();
        
        // Delete existing connections
        $stmt = $pdo->prepare("DELETE FROM con_newsletter_categories WHERE newsletter_ID = ?");
        $stmt->execute([$newsletterID]);
        
        // Insert new connections
        if (!empty($categoryIDs)) {
            $stmt = $pdo->prepare("INSERT INTO con_newsletter_categories (newsletter_ID, category_ID) VALUES (?, ?)");
            foreach ($categoryIDs as $categoryID) {
                $stmt->execute([$newsletterID, $categoryID]);
            }
        }
        
        $pdo->commit();
        
        echo json_encode(['success' => true, 'message' => 'Categories saved successfully']);
    } catch (PDOException $e) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
    exit;
}

echo json_encode(['success' => false, 'error' => 'Invalid action']);
?>
