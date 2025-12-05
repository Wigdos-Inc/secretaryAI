<?php
    session_start();
    
    // Check if user is logged in
    if(!isset($_COOKIE['userID']) || !isset($_COOKIE['user_data'])){
        header('location: login_view.php');
        exit();
    }
    
    // Decode user_data from JSON
    $result = json_decode($_COOKIE['user_data'], true);

    $isIframe = isset($_GET['iframe']);
?>
<?php if (!$isIframe): ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Profile</title>
    <link rel="stylesheet" href="../bootstrap-5.3.6-dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- <link rel="stylesheet" href="../styling/main.css"> -->
    <link rel="stylesheet" href="../styling/profile.css">
</head>
<body>
<?php endif; ?>        
        
        <?php if(isset($_GET['err'])): ?>
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <strong>Error:</strong> <?= htmlspecialchars($_GET['err']) ?>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        <?php endif; ?>
        
        <?php if(isset($_GET['success'])): ?>
            <div class="alert alert-success alert-dismissible fade show" role="alert">
                <strong>Success:</strong> <?= htmlspecialchars($_GET['success']) ?>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        <?php endif; ?>
        
        <div class="d-flex flex-column flex-md-row gap-3">
            <div class="admin-sidebar">
                <div class="text-center mb-4 pb-3" style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div class="profile-avatar-wrapper" style="position: relative; display: inline-block;">
                        <img id="profileAvatar" style="-webkit-user-drag: none; cursor: pointer;" class="rounded-circle mb-2" width="80" height="80" src="https://upload.wikimedia.org/wikipedia/commons/a/a3/Image-not-found.png" alt="User Avatar" title="Click to change profile picture">
                        <button id="changeAvatarBtn" class="change-avatar-btn" style="position: absolute; bottom: 8px; right: -4px; width: 28px; height: 28px; border-radius: 50%; background: var(--accent-blue); border: 2px solid var(--bg-secondary); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;" title="Change profile picture">
                            <i class="fas fa-camera"></i>
                        </button>
                        <input type="file" id="avatarFileInput" accept="image/*" style="display: none;">
                    </div>
                    <p class="mb-0 mt-2" style="color: var(--text-secondary); font-size: 0.9rem;">User Profile</p>
                </div>
                <nav class="admin-nav">
                    <a href="#" id="btn_tab_about" class="admin-nav-link active">
                        <i class="fas fa-user me-2"></i>
                        <span>About</span>
                    </a>
                    <a href="#" id="btn_tab_settings" class="admin-nav-link">
                        <i class="fas fa-cog me-2"></i>
                        <span>Settings</span>
                    </a>
                    <a id="btn_tab_favorites" class="admin-nav-link">
                        <i class="fas fa-star me-2"></i>
                        <span>Favorites</span>
                    </a>
                    <a class="admin-nav-link" href="../scripts/db/account/logout.php">
                        <i class="fas fa-sign-out-alt me-2"></i>
                        <span>Log out</span>
                    </a>
                </nav>
            </div>
            <div id="profile_tabs" class="admin-content-wrapper">
                <div id="tab_about" class="list-unstyled admin-tab-content" style="display: block;">
                    <div class="admin-tab-header">
                        <h2>About</h2>
                        <p>Your account information</p>
                    </div>
                    <div class="mb-3" style="padding: 1.5rem;">
                        <p class="fw-bold" style="color: var(--text-primary);">Username: <?=$result['username']?></p>
                        <p class="fw-bold" style="color: var(--text-primary);">E-mail: <?=$result['email']?></p>
                        <p class="fw-bold" style="color: var(--text-primary);">Date of birth: <?=$result['dob']?></p>
                    </div>
                </div>

                <div id="tab_settings" class="list-unstyled admin-tab-content" style="display: none;">
                    <div class="admin-tab-header">
                        <h2>Settings</h2>
                        <p>Update your account information</p>
                    </div>
                    <div class="mb-3" style="padding: 1.5rem;">
                        <h4 class="fw-bold mb-4" style="color: var(--text-primary);">Update Account Information</h4>
                        <form class="mb-5" action="../scripts/db/account/update_account.php" method="post" style="max-width: 600px;">
                            <div class="form-floating mb-2 mt-2">
                                <input class="form-control" type="text" name="username" id="username" placeholder="New Username ..." value="<?=$result['username']?>">
                                <label for="username">New Username ...</label>
                            </div>
                            <div class="form-floating mb-2">
                                <input class="form-control" type="email" name="email" id="email" placeholder="New E-mail ..." value="<?=$result['email']?>">
                                <label for="email">New E-mail ...</label>
                            </div>
                            <div class="form-floating mb-2">
                                <input class="form-control" type="date" name="dob" id="dob" placeholder="New Date of birth ..." value="<?=$result['dob']?>">
                                <label for="dob">New Date of birth ...</label>
                            </div>
                            <div class="form-floating mb-2 mt-5">
                                <input class="form-control" type="password" name="oldpassword" id="oldpassword" placeholder="Old Password ...">
                                <label for="oldpassword">Old Password ...</label>
                            </div>
                            <div class="form-floating mb-2">
                                <input class="form-control" type="password" name="password" id="password" placeholder="New Password ...">
                                <label for="password">New Password ...</label>
                            </div>
                            <div class="form-floating mb-3">
                                <input class="form-control" type="password" name="passwordCheck" id="passwordCheck" placeholder="New Password(Again) ...">
                                <label for="passwordCheck">New Password(Again) ...</label>
                            </div>
                            <button class="btn btn-success mb-3 mt-5 fw-bold" type="submit">
                                <i class="fas fa-save me-2"></i>Update Information
                            </button>
                        </form>

                        <h3 class="text-danger mt-5">
                            <i class="fas fa-exclamation-triangle me-2"></i>Danger Zone
                        </h3>
                        <hr style="border-color: var(--accent-red, #e74c3c); opacity: 0.3; margin: 1rem 0 2rem 0;">
                        <button class="btn btn-danger" id="delaccBtn">
                            <i class="fas fa-trash me-2"></i>Delete Account
                        </button>
                    </div>
                </div>

                <div id="tab_favorites" class="list-unstyled admin-tab-content" style="display: none;">
                    <div class="admin-tab-header">
                        <h2>Favorites</h2>
                        <p>Manage your favorite newsletters, categories, and creators</p>
                    </div>
                    <div class="mb-3" style="padding: 1.5rem;">
                        <!-- Filter Tabs -->
                        <ul class="nav nav-tabs mb-4" id="favoriteTabs" role="tablist">
                            <li class="nav-item" role="presentation">
                                <button class="nav-link active" id="newsletters-tab" data-bs-toggle="tab" data-bs-target="#newsletters-content" type="button" role="tab">
                                    <i class="fas fa-newspaper me-2"></i>Newsletters <span class="badge bg-primary ms-2" id="newsletter-count">0</span>
                                </button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" id="categories-tab" data-bs-toggle="tab" data-bs-target="#categories-content" type="button" role="tab">
                                    <i class="fas fa-tags me-2"></i>Categories <span class="badge bg-primary ms-2" id="category-count">0</span>
                                </button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" id="creators-tab" data-bs-toggle="tab" data-bs-target="#creators-content" type="button" role="tab">
                                    <i class="fas fa-user-edit me-2"></i>Creators <span class="badge bg-primary ms-2" id="creator-count">0</span>
                                </button>
                            </li>
                        </ul>

                        <!-- Tab Content -->
                        <div class="tab-content" id="favoriteTabContent">
                            <!-- Newsletters Tab -->
                            <div class="tab-pane fade show active" id="newsletters-content" role="tabpanel">
                                <div id="newsletters-loading" class="text-center py-5">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="mt-2" style="color: var(--text-secondary);">Loading newsletters...</p>
                                </div>
                                <div id="newsletters-list" style="display: none;"></div>
                                <div id="newsletters-empty" class="text-center py-5" style="display: none;">
                                    <i class="fas fa-heart-broken fa-3x mb-3" style="color: var(--text-secondary);"></i>
                                    <h4 style="color: var(--text-primary);">No Favorite Newsletters</h4>
                                    <p style="color: var(--text-secondary);">You haven't favorited any newsletters yet.</p>
                                </div>
                            </div>

                            <!-- Categories Tab -->
                            <div class="tab-pane fade" id="categories-content" role="tabpanel">
                                <div id="categories-loading" class="text-center py-5">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="mt-2" style="color: var(--text-secondary);">Loading categories...</p>
                                </div>
                                <div id="categories-list" style="display: none;"></div>
                                <div id="categories-empty" class="text-center py-5" style="display: none;">
                                    <i class="fas fa-heart-broken fa-3x mb-3" style="color: var(--text-secondary);"></i>
                                    <h4 style="color: var(--text-primary);">No Favorite Categories</h4>
                                    <p style="color: var(--text-secondary);">You haven't favorited any categories yet.</p>
                                </div>
                            </div>

                            <!-- Creators Tab -->
                            <div class="tab-pane fade" id="creators-content" role="tabpanel">
                                <div id="creators-loading" class="text-center py-5">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="mt-2" style="color: var(--text-secondary);">Loading creators...</p>
                                </div>
                                <div id="creators-list" style="display: none;"></div>
                                <div id="creators-empty" class="text-center py-5" style="display: none;">
                                    <i class="fas fa-heart-broken fa-3x mb-3" style="color: var(--text-secondary);"></i>
                                    <h4 style="color: var(--text-primary);">No Favorite Creators</h4>
                                    <p style="color: var(--text-secondary);">You haven't favorited any creators yet.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Delete Account Confirmation Modal -->
    <div class="modal fade" id="delconfirm" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="fas fa-exclamation-triangle me-2"></i>Confirm Account Deletion
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>You are about to delete your account: <strong>'<?=$result['username']?>'</strong>.</p>
                    <p>Do you want to proceed with this action?</p>
                </div>
                <div class="modal-footer">
                    <a href="../scripts/db/account/delete_ac.php" class="btn btn-danger">
                        <i class="fas fa-check me-2"></i>Yes, Delete
                    </a>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="fas fa-times me-2"></i>Cancel
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script src="../bootstrap-5.3.6-dist/js/bootstrap.bundle.min.js"></script>
    <script src="../scripts/js/profilePage.js"></script>
    <script src="../scripts/js/favorites.js"></script>
    <script src="../scripts/js/theme.js"></script>
    <script>
        // Initialize data in parent window's popup system
        if (window.parent && window.parent.popupSystem) {
            window.parent.popupSystem.initData(
                <?= json_encode($newsletters) ?>,
                <?= json_encode($categories) ?>,
                <?= json_encode($users) ?>
            );
        }

        // Delete account button - show modal
        document.getElementById('delaccBtn')?.addEventListener('click', function() {
            const modal = new bootstrap.Modal(document.getElementById('delconfirm'));
            modal.show();
        });

        // favoritesManager is already initialized in favorites.js

        // Load favorites when tab is shown
        document.getElementById('btn_tab_favorites')?.addEventListener('click', function() {
            loadFavoriteNewsletters();
            loadFavoriteCategories();
            loadFavoriteCreators();
        });

        // Load favorites when sub-tabs are clicked
        document.getElementById('categories-tab')?.addEventListener('shown.bs.tab', function() {
            loadFavoriteCategories();
        });

        document.getElementById('creators-tab')?.addEventListener('shown.bs.tab', function() {
            loadFavoriteCreators();
        });

        document.getElementById('newsletters-tab')?.addEventListener('shown.bs.tab', function() {
            loadFavoriteNewsletters();
        });

        // Load favorite newsletters
        async function loadFavoriteNewsletters() {
            const loading = document.getElementById('newsletters-loading');
            const list = document.getElementById('newsletters-list');
            const empty = document.getElementById('newsletters-empty');

            loading.style.display = 'block';
            list.style.display = 'none';
            empty.style.display = 'none';

            const result = await favoritesManager.getAll('newsletter');

            loading.style.display = 'none';

            if (result.success && result.favorites.length > 0) {
                document.getElementById('newsletter-count').textContent = result.count;
                list.innerHTML = result.favorites.map(newsletter => `
                    <div class="favorite-card" data-newsletter-id="${newsletter.newsletter_ID}" onclick="openNewsletterPopup(${newsletter.newsletter_ID})" style="cursor: pointer;">
                        <div class="favorite-card-content">
                            <div class="favorite-card-icon">
                                <i class="fas fa-newspaper"></i>
                            </div>
                            <div class="favorite-card-info">
                                <h5 class="favorite-card-title">${escapeHtml(newsletter.title)}</h5>
                                <div class="favorite-card-meta">
                                    <span class="favorite-meta-item">
                                        <i class="fas fa-user"></i>
                                        ${escapeHtml(newsletter.creator_username)}
                                    </span>
                                    <span class="favorite-meta-item">
                                        <i class="fas fa-calendar"></i>
                                        ${new Date(newsletter.creation_date).toLocaleDateString()}
                                    </span>
                                </div>
                                <span class="favorite-status-badge status-${newsletter.status}">
                                    ${newsletter.status.charAt(0).toUpperCase() + newsletter.status.slice(1)}
                                </span>
                            </div>
                        </div>
                        <div class="favorite-card-actions">
                            <button class="favorite-action-btn btn-favorite" onclick="event.stopPropagation(); toggleFavoriteNewsletter(${newsletter.newsletter_ID})" title="Remove from favorites">
                                <i class="fas fa-heart"></i>
                            </button>
                        </div>
                    </div>
                `).join('');
                list.style.display = 'block';
            } else {
                document.getElementById('newsletter-count').textContent = '0';
                empty.style.display = 'block';
            }
        }

        // Load favorite categories
        async function loadFavoriteCategories() {
            const loading = document.getElementById('categories-loading');
            const list = document.getElementById('categories-list');
            const empty = document.getElementById('categories-empty');

            loading.style.display = 'block';
            list.style.display = 'none';
            empty.style.display = 'none';

            const result = await favoritesManager.getAll('category');
            console.log('Category result:', result);

            loading.style.display = 'none';

            if (result.success && result.favorites && result.favorites.length > 0) {
                document.getElementById('category-count').textContent = result.count;
                list.innerHTML = result.favorites.map(category => `
                    <div class="favorite-card" data-category-id="${category.category_ID}" onclick="openCategoryPopup(${category.category_ID})" style="cursor: pointer;">
                        <div class="favorite-card-content">
                            <div class="favorite-card-icon category-icon">
                                <i class="fas fa-tag"></i>
                            </div>
                            <div class="favorite-card-info">
                                <h5 class="favorite-card-title">${escapeHtml(category.name)}</h5>
                                ${category.description ? `<p class="favorite-card-description">${escapeHtml(category.description)}</p>` : ''}
                            </div>
                        </div>
                        <div class="favorite-card-actions">
                            <button class="favorite-action-btn btn-favorite" onclick="event.stopPropagation(); toggleFavoriteCategory(${category.category_ID})" title="Unfollow category">
                                <i class="fas fa-heart"></i>
                            </button>
                        </div>
                    </div>
                `).join('');
                list.style.display = 'block';
            } else {
                document.getElementById('category-count').textContent = '0';
                empty.style.display = 'block';
                if (!result.success) {
                    console.error('Category error:', result.error);
                }
            }
        }

        // Load favorite creators
        async function loadFavoriteCreators() {
            const loading = document.getElementById('creators-loading');
            const list = document.getElementById('creators-list');
            const empty = document.getElementById('creators-empty');

            loading.style.display = 'block';
            list.style.display = 'none';
            empty.style.display = 'none';

            const result = await favoritesManager.getAll('creator');
            console.log('Creator result:', result);

            loading.style.display = 'none';

            if (result.success && result.favorites && result.favorites.length > 0) {
                document.getElementById('creator-count').textContent = result.count;
                list.innerHTML = result.favorites.map(creator => `
                    <div class="favorite-card" data-creator-id="${creator.user_ID}" onclick="openCreatorPopup(${creator.user_ID})" style="cursor: pointer;">
                        <div class="favorite-card-content">
                            <div class="favorite-card-icon creator-icon">
                                <i class="fas fa-user-edit"></i>
                            </div>
                            <div class="favorite-card-info">
                                <h5 class="favorite-card-title">${escapeHtml(creator.username)}</h5>
                                <div class="favorite-card-meta">
                                    <span class="favorite-meta-item">
                                        <i class="fas fa-calendar"></i>
                                        Joined ${new Date(creator.creation_date).toLocaleDateString()}
                                    </span>
                                </div>
                                <span class="favorite-status-badge role-${creator.role}">
                                    ${creator.role.charAt(0).toUpperCase() + creator.role.slice(1)}
                                </span>
                            </div>
                        </div>
                        <div class="favorite-card-actions">
                            <button class="favorite-action-btn btn-favorite" onclick="event.stopPropagation(); toggleFavoriteCreator(${creator.user_ID})" title="Unfollow creator">
                                <i class="fas fa-heart"></i>
                            </button>
                        </div>
                    </div>
                `).join('');
                list.style.display = 'block';
            } else {
                document.getElementById('creator-count').textContent = '0';
                empty.style.display = 'block';
                if (!result.success) {
                    console.error('Creator error:', result.error);
                }
            }
        }

        // Toggle newsletter favorite
        async function toggleFavoriteNewsletter(newsletterID) {
            const result = await favoritesManager.remove('newsletter', newsletterID);
            
            if (result.success) {
                loadFavoriteNewsletters();
            } else {
                alert('Failed to remove newsletter: ' + (result.error || 'Unknown error'));
            }
        }

        // Toggle category favorite
        async function toggleFavoriteCategory(categoryID) {
            const result = await favoritesManager.remove('category', categoryID);
            
            if (result.success) {
                loadFavoriteCategories();
            } else {
                alert('Failed to unfollow category: ' + (result.error || 'Unknown error'));
            }
        }

        // Toggle creator favorite
        async function toggleFavoriteCreator(creatorID) {
            const result = await favoritesManager.remove('creator', creatorID);
            
            if (result.success) {
                loadFavoriteCreators();
            } else {
                alert('Failed to unfollow creator: ' + (result.error || 'Unknown error'));
            }
        }

        // Profile picture functionality
        const avatarImg = document.getElementById('profileAvatar');
        const changeAvatarBtn = document.getElementById('changeAvatarBtn');
        const avatarFileInput = document.getElementById('avatarFileInput');

        // Load saved avatar from localStorage
        const savedAvatar = localStorage.getItem('userAvatar');
        if (savedAvatar) {
            avatarImg.src = savedAvatar;
        }

        // Click handlers for changing avatar
        avatarImg.addEventListener('click', () => avatarFileInput.click());
        changeAvatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            avatarFileInput.click();
        });

        // Handle file selection
        avatarFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    alert('Please select an image file');
                    return;
                }

                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert('Image size should be less than 5MB');
                    return;
                }

                // Read and display the image
                const reader = new FileReader();
                reader.onload = function(event) {
                    const imageData = event.target.result;
                    avatarImg.src = imageData;
                    
                    // Save to localStorage
                    try {
                        localStorage.setItem('userAvatar', imageData);
                        
                        // Update avatar in parent window if in iframe
                        if (window.parent && window.parent !== window) {
                            window.parent.postMessage({
                                type: 'avatarUpdated',
                                avatar: imageData
                            }, '*');
                        }
                    } catch (e) {
                        console.error('Failed to save avatar:', e);
                        alert('Failed to save profile picture. Image may be too large.');
                    }
                };
                reader.readAsDataURL(file);
            }
        });

        // Open newsletter popup
        function openNewsletterPopup(newsletterID) {
            if (window.parent && window.parent.popupSystem) {
                window.parent.popupSystem.newsPopup(newsletterID);
            } else if (window.popupSystem) {
                window.popupSystem.newsPopup(newsletterID);
            } else {
                // Fallback to direct page navigation
                window.location.href = `newsletter_view.php?id=${newsletterID}`;
            }
        }

        // Open category popup
        function openCategoryPopup(categoryID) {
            if (window.parent && window.parent.popupSystem) {
                window.parent.popupSystem.categoryPopup(categoryID);
            } else if (window.popupSystem) {
                window.popupSystem.categoryPopup(categoryID);
            } else {
                // Fallback to direct page navigation
                window.location.href = `category_view.php?id=${categoryID}`;
            }
        }

        // Open creator popup
        function openCreatorPopup(creatorID) {
            if (window.parent && window.parent.popupSystem) {
                window.parent.popupSystem.creatorPopup(creatorID);
            } else if (window.popupSystem) {
                window.popupSystem.creatorPopup(creatorID);
            } else {
                // No fallback for creator view
                console.log('Creator popup not available for ID:', creatorID);
            }
        }

        // Escape HTML to prevent XSS
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    </script>
<?php if (!$isIframe): ?>
</body>
</html>
<?php endif; ?>
