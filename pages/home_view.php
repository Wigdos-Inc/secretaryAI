<?php
session_start();
require_once '../scripts/db/config.php';

// Get UserID from cookie
$userID = isset($_COOKIE['userID']) ? intval($_COOKIE['userID']) : null;

// Handle AJAX check for newest newsletter
if (isset($_GET['check_newest']) && $_GET['check_newest'] == '1') {
    header('Content-Type: application/json');
    
    try {
        // Get the most recent published newsletter
        $stmt = $pdo->query("
            SELECT newsletter_ID, title, content, creation_date
            FROM tab_newsletters
            WHERE status = 'published'
            ORDER BY creation_date DESC
            LIMIT 1
        ");
        $newestNewsletter = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($newestNewsletter) {
            echo json_encode([
                'has_new' => true,
                'newsletter' => $newestNewsletter
            ]);
        } else {
            echo json_encode(['has_new' => false]);
        }
    } catch (PDOException $e) {
        echo json_encode(['has_new' => false, 'error' => 'Database error']);
    }
    exit;
}

// Handle AJAX check for updates
if (isset($_GET['check_updates']) && $_GET['check_updates'] == '1') {
    header('Content-Type: application/json');
    
    try {
        $updates = [];
        
        // Get latest newsletter timestamp
        $stmt = $pdo->query("
            SELECT MAX(creation_date) as latest_newsletter
            FROM tab_newsletters
            WHERE status = 'published'
        ");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $updates['latest_newsletter'] = $result['latest_newsletter'];
        
        // Get latest category timestamp
        $stmt = $pdo->query("
            SELECT MAX(creation_date) as latest_category
            FROM tab_categories
        ");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $updates['latest_category'] = $result['latest_category'];
        
        // Get total counts
        $stmt = $pdo->query("SELECT COUNT(*) as newsletter_count FROM tab_newsletters WHERE status = 'published'");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $updates['newsletter_count'] = (int)$result['newsletter_count'];
        
        $stmt = $pdo->query("SELECT COUNT(*) as category_count FROM tab_categories");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $updates['category_count'] = (int)$result['category_count'];
        
        echo json_encode(['updates' => $updates]);
    } catch (PDOException $e) {
        echo json_encode(['error' => 'Database error']);
    }
    exit;
}

// Fetch the most recent published newsletter for Featured section
$featuredNewsletter = null;
try {
    $stmt = $pdo->query("
        SELECT newsletter_ID, title, content, creation_date
        FROM tab_newsletters
        WHERE status = 'published'
        ORDER BY creation_date DESC
        LIMIT 1
    ");
    $featuredNewsletter = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    // Silent fail
}

// Fetch all categories with their newsletters and contributors
$categories = [];
try {
    $stmt = $pdo->query("SELECT * FROM tab_categories WHERE status != 'hidden' ORDER BY name ASC");
    $baseCategories = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Populate each category with newsletters and contributors
    foreach ($baseCategories as $category) {
        // Fetch newsletters for this category
        $categoryNewsletters = [];
        try {
            $stmt = $pdo->prepare("
                SELECT n.newsletter_ID, n.title, n.content, n.creation_date, n.status
                FROM tab_newsletters n
                INNER JOIN con_newsletter_categories c ON n.newsletter_ID = c.newsletter_ID
                WHERE c.category_ID = ?
                ORDER BY n.creation_date DESC
            ");
            $stmt->execute([$category['category_ID']]);
            $categoryNewsletters = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {}
        
        // Fetch contributors for this category
        $categoryContributors = [];
        try {
            $stmt = $pdo->prepare("
                SELECT DISTINCT u.user_ID, u.username, u.role, u.creation_date
                FROM tab_users u
                INNER JOIN tab_newsletters n ON u.user_ID = n.user_ID
                INNER JOIN con_newsletter_categories c ON n.newsletter_ID = c.newsletter_ID
                WHERE c.category_ID = ?
                ORDER BY u.username ASC
            ");
            $stmt->execute([$category['category_ID']]);
            $categoryContributors = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {}
        
        $category['newsletters'] = $categoryNewsletters;
        $category['contributors'] = $categoryContributors;
        $categories[] = $category;
    }
} catch (PDOException $e) {
    // Silent fail for now
}

// Define how many categories to display before dropdown
$maxDisplayedCategories = 3;

// Fetch newsletters for "Popular" section (by favorite count or date)
$popularNewsletters = [];
try {
    $stmt = $pdo->query("
        SELECT n.newsletter_ID, n.title, n.content, n.creation_date, 
               COUNT(f.user_ID) as fav_count 
        FROM tab_newsletters n 
        LEFT JOIN con_favorites_newsletters f ON n.newsletter_ID = f.newsletter_ID 
        WHERE n.status = 'published'
        GROUP BY n.newsletter_ID, n.title, n.content, n.creation_date 
        ORDER BY fav_count DESC, n.creation_date DESC 
        LIMIT 6
    ");
    $popularNewsletters = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    // Silent fail
}

// Fetch user's most recent newsletter (for logged-in users)
$userDigest = null;
if ($userID) {
    try {
        $stmt = $pdo->prepare("
            SELECT n.* 
            FROM tab_newsletters n
            INNER JOIN con_favorites_newsletters f ON n.newsletter_ID = f.newsletter_ID
            WHERE f.user_ID = ?
            ORDER BY n.creation_date DESC
            LIMIT 1
        ");
        $stmt->execute([$userID]);
        $userDigest = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        // Silent fail
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="./../bootstrap-5.3.6-dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../styling/main.css">
    <link rel="stylesheet" href="../styling/home.css">
    <link rel="stylesheet" href="../styling/favorites.css">
    <title>Home - Newswire AI</title>
</head>
<body>
    <div class="container py-3">
        
        <?php if ($featuredNewsletter): ?>
        <!-- Featured Newsletter Section -->
        <section class="user-digest-section mb-5" id="featuredSection">
            <div class="section-header mb-4">
                <h2 class="section-title">
                    <i class="fas fa-star me-2"></i>
                    Featured Newsletter
                </h2>
                <p class="section-subtitle">Latest published newsletter</p>
            </div>
            
            <div class="digest-card" onclick="if(parent.window.popupSystem) parent.window.popupSystem.newsPopup(<?php echo $featuredNewsletter['newsletter_ID']; ?>)">
                <div class="digest-content">
                    <div class="digest-label">
                        <i class="fas fa-fire"></i>
                        <span>Newest</span>
                    </div>
                    <h3 class="digest-title" id="featuredTitle"><?php echo htmlspecialchars($featuredNewsletter['title']); ?></h3>
                    <p class="digest-description" id="featuredDescription">
                        <?php echo htmlspecialchars(substr(strip_tags($featuredNewsletter['content']) ?? 'Latest newsletter content.', 0, 150)); ?>...
                    </p>
                    <div class="digest-meta">
                        <span class="digest-date" id="featuredDate">
                            <i class="far fa-calendar-alt me-1"></i>
                            <?php echo date('M j, Y', strtotime($featuredNewsletter['creation_date'])); ?>
                        </span>
                    </div>
                </div>
                <div class="digest-image">
                    <i class="fas fa-newspaper"></i>
                </div>
            </div>
        </section>
        <?php else: ?>
        <!-- Placeholder when no newsletters exist -->
        <section class="user-digest-section mb-5">
            <div class="section-header mb-4">
                <h2 class="section-title">
                    <i class="fas fa-star me-2"></i>
                    Featured Newsletter
                </h2>
                <p class="section-subtitle">No newsletters published yet</p>
            </div>
            
            <div class="digest-card digest-placeholder">
                <div class="digest-content">
                    <div class="digest-label">
                        <i class="fas fa-info-circle"></i>
                        <span>Coming Soon</span>
                    </div>
                    <h3 class="digest-title">Latest Newsletter Will Appear Here</h3>
                    <p class="digest-description">
                        Once newsletters are published, the most recent one will be featured right here.
                    </p>
                </div>
                <div class="digest-image">
                    <i class="fas fa-newspaper"></i>
                </div>
            </div>
        </section>
        <?php endif; ?>

        <!-- Newest per Category Section -->
        <section class="newest-category-section mb-5">
            <div class="section-header mb-3">
                <h2 class="section-title">
                    <i class="fas fa-layer-group me-2"></i>
                    Newest per Category
                </h2>
                <p class="section-subtitle">Fresh content from your favorite topics</p>
            </div>

            <?php if (count($categories) > $maxDisplayedCategories): ?>
            <!-- View More Dropdown at the top -->
            <div class="category-dropdown-wrapper">
                <button class="btn btn-outline-primary" type="button" id="viewMoreCategoriesBtn">
                    <i class="fas fa-layer-group me-2"></i>
                    View All Categories
                </button>
                <div class="category-dropdown-menu" id="categoryDropdownMenu">
                    <?php
                    // Show categories from index maxDisplayedCategories onwards in dropdown
                    for ($i = $maxDisplayedCategories; $i < count($categories); $i++):
                        $dropdownCategory = $categories[$i];
                    ?>
                    <a class="category-dropdown-item" href="#" onclick="openCategoryFromDropdown(<?php echo $dropdownCategory['category_ID']; ?>); return false;">
                        <span class="category-name">
                            <i class="fas fa-folder me-2"></i>
                            <?php echo htmlspecialchars($dropdownCategory['name']); ?>
                        </span>
                        <?php if ($userID): ?>
                        <button class="favorite-btn-icon-small" 
                                data-favorite-btn 
                                data-favorite-type="category" 
                                data-favorite-id="<?php echo $dropdownCategory['category_ID']; ?>"
                                title="Follow category"
                                onclick="event.stopPropagation();">
                            <i class="far fa-heart"></i>
                        </button>
                        <?php endif; ?>
                    </a>
                    <?php endfor; ?>
                </div>
            </div>
            <?php endif; ?>

            <div class="row g-3" id="categoryGrid">
                <?php if (count($categories) > 0): ?>
                    <?php foreach ($categories as $index => $category): ?>
                        <?php
                        // Fetch ALL newsletters for this category to get count
                        $categoryNewslettersCount = 0;
                        try {
                            $stmt = $pdo->prepare("
                                SELECT COUNT(*) as count
                                FROM tab_newsletters n
                                INNER JOIN con_newsletter_categories c ON n.newsletter_ID = c.newsletter_ID
                                WHERE c.category_ID = ?
                            ");
                            $stmt->execute([$category['category_ID']]);
                            $result = $stmt->fetch(PDO::FETCH_ASSOC);
                            $categoryNewslettersCount = $result['count'];
                        } catch (PDOException $e) {
                            // Silent fail
                        }
                        ?>
                        <div class="col-lg-4 col-md-6 category-item <?php echo ($index >= $maxDisplayedCategories) ? 'category-hidden' : ''; ?>" id="category-card-<?php echo $index; ?>">
                            <div class="category-card" onclick="if(parent.window.popupSystem) parent.window.popupSystem.categoryPopup(<?php echo $category['category_ID']; ?>)">
                                <div class="category-badge">
                                    <?php echo htmlspecialchars($category['name']); ?>
                                    <?php if ($userID): ?>
                                    <button class="favorite-btn-icon" 
                                            data-favorite-btn 
                                            data-favorite-type="category" 
                                            data-favorite-id="<?php echo $category['category_ID']; ?>"
                                            title="Follow category"
                                            style="float: right; margin-top: -2px;"
                                            onclick="event.stopPropagation();">
                                        <i class="far fa-heart"></i>
                                    </button>
                                    <?php endif; ?>
                                </div>
                                <div class="category-content">
                                    <div class="category-count-display">
                                        <div class="category-icon-display">
                                            <i class="fas fa-newspaper"></i>
                                        </div>
                                        <div class="count-number"><?php echo $categoryNewslettersCount; ?></div>
                                        <div class="count-label">Newsletter<?php echo $categoryNewslettersCount !== 1 ? 's' : ''; ?></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php else: ?>
                    <div class="col-12">
                        <div class="empty-state">
                            <i class="fas fa-folder-open fa-3x mb-3"></i>
                            <h4>No Categories Available</h4>
                            <p>Check back soon for new categories!</p>
                        </div>
                    </div>
                <?php endif; ?>
            </div>
        </section>

        <!-- Popular Section -->
        <section class="popular-section">
            <div class="section-header mb-3">
                <h2 class="section-title">
                    <i class="fas fa-fire me-2"></i>
                    Popular
                </h2>
                <p class="section-subtitle">Trending newsletters everyone's reading</p>
            </div>

            <div class="row g-3">
                <?php if (count($popularNewsletters) > 0): ?>
                    <?php foreach ($popularNewsletters as $newsletter): ?>
                        <div class="col-lg-4 col-md-6">
                            <div class="popular-card" onclick="if(parent.window.popupSystem) parent.window.popupSystem.newsPopup(<?php echo $newsletter['newsletter_ID']; ?>)">
                                <?php if ($userID): ?>
                                <button class="favorite-btn-icon" 
                                        data-favorite-btn 
                                        data-favorite-type="newsletter" 
                                        data-favorite-id="<?php echo $newsletter['newsletter_ID']; ?>"
                                        title="Add to favorites"
                                        style="position: absolute; top: 15px; right: 15px; z-index: 10;"
                                        onclick="event.stopPropagation();">
                                    <i class="far fa-heart"></i>
                                </button>
                                <?php endif; ?>
                                <div class="popular-icon">
                                    <i class="fas fa-newspaper"></i>
                                </div>
                                <div class="popular-content">
                                    <h4 class="popular-title">
                                        <?php echo htmlspecialchars($newsletter['title'] ?? 'Untitled Newsletter'); ?>
                                    </h4>
                                    <p class="popular-desc">
                                        <?php echo htmlspecialchars(substr(strip_tags($newsletter['content']) ?? 'Discover trending content', 0, 100)); ?>...
                                    </p>
                                    <div class="popular-stats">
                                        <span class="stat-item" data-newsletter-fav-count="<?php echo $newsletter['newsletter_ID']; ?>">
                                            <i class="fas fa-heart me-1"></i>
                                            <?php echo $newsletter['fav_count'] ?? 0; ?>
                                        </span>
                                        <span class="stat-item">
                                            <i class="far fa-calendar me-1"></i>
                                            <?php echo date('M j', strtotime($newsletter['creation_date'])); ?>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php else: ?>
                    <div class="col-12">
                        <div class="empty-state">
                            <i class="fas fa-chart-line fa-3x mb-3"></i>
                            <h4>No Popular Newsletters Yet</h4>
                            <p>Be the first to favorite a newsletter!</p>
                        </div>
                    </div>
                <?php endif; ?>
            </div>
        </section>

    </div>

    <script src="./../bootstrap-5.3.6-dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Prepare data for popup system
        window.categoryNewslettersData = <?php
            $categoryData = [];
            foreach ($categories as $category):
                $categoryNewsletters = [];
                try {
                    $stmt = $pdo->prepare("
                        SELECT n.* 
                        FROM tab_newsletters n
                        INNER JOIN con_newsletter_categories c ON n.newsletter_ID = c.newsletter_ID
                        WHERE c.category_ID = ?
                        ORDER BY n.creation_date DESC
                    ");
                    $stmt->execute([$category['category_ID']]);
                    $categoryNewsletters = $stmt->fetchAll(PDO::FETCH_ASSOC);
                } catch (PDOException $e) {}
                $categoryData[$category['category_ID']] = $categoryNewsletters;
            endforeach;
            echo json_encode($categoryData);
        ?>;
        
        window.newslettersData = <?php
            $allNewsletters = [];
            if (isset($userDigest) && $userDigest) {
                $allNewsletters[$userDigest['newsletter_ID']] = [
                    'id' => $userDigest['newsletter_ID'],
                    'title' => $userDigest['title'],
                    'content' => $userDigest['content'],
                    'creation_date' => $userDigest['creation_date'],
                    'status' => $userDigest['status'] ?? 'published'
                ];
            }
            
            // Add all newsletters from categories
            foreach ($categories as $category) {
                foreach ($category['newsletters'] as $newsletter) {
                    $allNewsletters[$newsletter['newsletter_ID']] = [
                        'id' => $newsletter['newsletter_ID'],
                        'title' => $newsletter['title'],
                        'content' => $newsletter['content'],
                        'creation_date' => $newsletter['creation_date'],
                        'status' => $newsletter['status'] ?? 'published'
                    ];
                }
            }
            
            foreach ($popularNewsletters as $newsletter) {
                $allNewsletters[$newsletter['newsletter_ID']] = [
                    'id' => $newsletter['newsletter_ID'],
                    'title' => $newsletter['title'],
                    'content' => $newsletter['content'],
                    'creation_date' => $newsletter['creation_date'],
                    'status' => $newsletter['status'] ?? 'published'
                ];
            }
            echo json_encode($allNewsletters);
        ?>;
        
        window.categoriesData = <?php
            $allCategories = [];
            foreach ($categories as $category) {
                $allCategories[$category['category_ID']] = [
                    'id' => $category['category_ID'],
                    'name' => $category['name'],
                    'newsletters' => array_column($category['newsletters'], 'newsletter_ID'),
                    'contributors' => array_column($category['contributors'], 'user_ID')
                ];
            }
            echo json_encode($allCategories);
        ?>;
        
        window.currentFeaturedId = <?php echo $featuredNewsletter ? $featuredNewsletter['newsletter_ID'] : 'null'; ?>;
        window.currentUserID = <?php echo $userID ? $userID : 'null'; ?>;
    </script>
    <script src="../scripts/js/theme.js"></script>
    <script src="../scripts/js/homeView.js"></script>
    <!-- Favorites System -->
    <script src="../scripts/js/favorites.js"></script>
</body>
</html>