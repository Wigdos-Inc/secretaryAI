<?php  require_once '../scripts/php/search.php'; ?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Search Results - Newswire AI</title>
 
    <link rel="stylesheet" href="../bootstrap-5.3.6-dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="../styling/main.css">
    <link rel="stylesheet" href="../styling/search.css">
</head>
<body>
    
    <div class="container py-5">
        <!-- Search Header -->
        <div class="searchHeader text-center">
            <h1 class="searchTitle">Search Results</h1>
            <p class="searchInfo">
                <?php 
                if ($results && $rAmount > 0) {
                    echo "Found <span class='queryHighlight'>$rAmount</span> result" . ($rAmount != 1 ? 's' : '') . " for \"<span class='queryHighlight'>$query</span>\"";
                } else if (!$query) {
                    echo 'No search query provided.';
                } else {
                    echo "No results found for \"$query\".";
                }
                ?>
            </p>
        </div>

        <?php if ($results && $rAmount > 0): ?>

            <!-- Newsletter Results -->
            <?php if (!empty($results['newsletters'])): ?>
                <div class="resSection">
                    <div class="section-header">
                        <i class="fas fa-newspaper"></i>
                        <h2 class="section-title">Newsletters</h2>
                        <span class="section-count"><?= count($results['newsletters']) ?></span>
                    </div>

                    <?php foreach ($results['newsletters'] as $result): 
                        $newsletter = $newsletters[$result[0]];
                        $newsletterID = $result[0];
                    ?>
                        <div class="resCard newsCard" onclick="newsPopup(<?= $newsletterID ?>)">
                            <div class="cardHeader">
                                <h3 class="newsTitle"><?= htmlspecialchars($newsletter['title']) ?></h3>
                                <div class="newsDate">
                                    <i class="fas fa-calendar-alt"></i>
                                    <?= date('M j, Y', strtotime($newsletter['creation_date'])) ?>
                                </div>
                            </div>
                            <p class="newsContent">
                                <?= htmlspecialchars(truncateText($newsletter['content'], 250)) ?>
                            </p>
                            <div class="newsFooter">
                                <span class="readMore">
                                    Read more <i class="fas fa-arrow-right"></i>
                                </span>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

            <!-- Category Results -->
            <?php if (!empty($results['categories'])): ?>
                <div class="resSection">
                    <div class="section-header">
                        <i class="fas fa-th-large"></i>
                        <h2 class="section-title">Categories</h2>
                        <span class="section-count"><?= count($results['categories']) ?></span>
                    </div>

                    <?php foreach ($results['categories'] as $result): 
                        $category = $categories[$result[0]];
                        $categoryID = $result[0];
                        $newsletterCount = count($category['newsletters']);
                    ?>
                        <div class="resCard catCard" onclick="categoryPopup(<?= $categoryID ?>)">
                            <div class="cardHeader">
                                <div class="catIcon">
                                    <i class="fas fa-folder"></i>
                                </div>
                                <div class="catInfo">
                                    <h3 class="catName"><?= htmlspecialchars($category['name']) ?></h3>
                                    <div class="catStats">
                                        <div class="statItem">
                                            <i class="fas fa-newspaper"></i>
                                            <span class="statVal"><?= $newsletterCount ?></span> Newsletter<?= $newsletterCount != 1 ? 's' : '' ?>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

            <!-- Creator Results -->
            <?php if (!empty($results['users'])): ?>
                <div class="resSection">
                    <div class="section-header">
                        <i class="fas fa-users"></i>
                        <h2 class="section-title">Creators</h2>
                        <span class="section-count"><?= count($results['users']) ?></span>
                    </div>

                    <?php foreach ($results['users'] as $result): 
                        $user = $users[$result[0]];
                        $userID = $result[0];
                        
                        $creations = 0;  // Placeholder
                        $contributions = count($user['c_newsletters']);
                    ?>
                        <div class="resCard creatorCard" onclick="creatorPopup(<?= $userID ?>)">
                            <div class="cardHeader">
                                <div class="creatorAvatar">
                                    <?= strtoupper(substr($user['username'], 0, 1)) ?>
                                </div>
                                <div class="creatorInfo">
                                    <h3 class="creatorName">
                                        <?= $user['username'] ?>
                                        <span class="creatorRole <?= strtolower($user['role']) ?>">
                                            <?= $user['role'] ?>
                                        </span>
                                    </h3>
                                    <div class="creatorJoinDate">
                                        <i class="fas fa-calendar-alt"></i>
                                        Joined <?= date('M j, Y', strtotime($user['creation_date'])) ?>
                                    </div>
                                </div>
                            </div>
                            <div class="creatorStats">
                                <div class="creatorStat">
                                    <span class="statLabel">Created</span>
                                    <span class="statVal">
                                        <i class="fas fa-newspaper"></i>
                                        <?= $creations ?>
                                    </span>
                                </div>
                                <div class="creatorStat">
                                    <span class="statLabel">Contributed To</span>
                                    <span class="statVal">
                                        <i class="fas fa-hands-helping"></i>
                                        <?= $contributions ?>
                                    </span>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

        <?php endif; ?>
    </div>

    <script>
        // Initialize data in parent window's popup system
        if (window.parent && window.parent.popupSystem) {
            window.parent.popupSystem.initData(
                <?= json_encode($newsletters) ?>,
                <?= json_encode($categories) ?>,
                <?= json_encode($users) ?>,
                <?= isset($_COOKIE['userID']) ? intval($_COOKIE['userID']) : 'null' ?>
            );
        }

    // Reference parent window's popup functions
    function newsPopup(id) {
        if (window.parent && window.parent.popupSystem) {
            window.parent.popupSystem.newsPopup(id);
        }
    }

    function categoryPopup(id) {
        if (window.parent && window.parent.popupSystem) {
            window.parent.popupSystem.categoryPopup(id);
        }
    }

    function creatorPopup(id) {
        if (window.parent && window.parent.popupSystem) {
            window.parent.popupSystem.creatorPopup(id);
        }
    }
    </script>
    <script src="../scripts/js/theme.js"></script>
</body>
</html>