<?php
    session_start();

    // Check if user is logged in
    if(!isset($_COOKIE['userID']) || !isset($_COOKIE['user_data'])){
        header('location: login_view.php');
        exit();
    }

    // Decode user_data from JSON
    $result = json_decode($_COOKIE['user_data'], true);
    
    // Check if user is admin or owner
    require_once '../scripts/db/data.php';
    $userID = isset($_COOKIE['userID']) ? intval($_COOKIE['userID']) : null;
    
    $isAdminOrOwner = false;
    if ($userID && isset($users[$userID])) {
        $userRole = $users[$userID]['role'];
        $isAdminOrOwner = ($userRole === 'admin' || $userRole === 'owner');
    }
    
    if (!$isAdminOrOwner) {
        header('location: ../index.php?err=Access denied - Admin privileges required');
        exit();
    }
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel</title>
    <link rel="stylesheet" href="../bootstrap-5.3.6-dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- <link rel="stylesheet" href="../styling/main.css"> -->
    <link rel="stylesheet" href="../styling/profile.css">
    <link rel="stylesheet" href="../styling/adminPanel.css">
</head>
<body>
<div class="admin-wrapper">
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
                <img id="adminAvatar" style="-webkit-user-drag: none;" class="rounded-circle mb-2" width="80" height="80" src="https://upload.wikimedia.org/wikipedia/commons/a/a3/Image-not-found.png" alt="Admin Avatar">
                <p class="mb-0 mt-2" style="color: var(--text-secondary); font-size: 0.9rem;">Admin Dashboard</p>
            </div>
            <nav class="admin-nav">
                <a id="btn_tab_create" class="admin-nav-link active">
                    <i class="fas fa-newspaper me-2"></i>
                    <span>Newsletters</span>
                </a>
                <a id="btn_tab_generator" class="admin-nav-link">
                    <i class="fas fa-magic me-2"></i>
                    <span>Generator</span>
                </a>
                <a id="btn_tab_viewLetters" class="admin-nav-link">
                    <i class="fas fa-users me-2"></i>
                    <span>Users</span>
                </a>
                <a id="btn_tab_viewCategories" class="admin-nav-link">
                    <i class="fas fa-tags me-2"></i>
                    <span>Categories</span>
                </a>
            </nav>
        </div>
        <div id="profile_tabs" class="admin-content-wrapper">
            <div id="tab_create" class="list-unstyled admin-tab-content" style="display: block;">
                <div class="admin-tab-header">
                    <h2>Newsletters</h2>
                    <p style="color: var(--text-secondary)">Here you can view, edit and delete NewsLetters.</p>
                </div>
                <div class="admin-content-container">
                    <div class="admin-search-section">
                        <div class="input-group">
                            <input type="text" class="form-control" id="searchNewsLetter" placeholder="Search newsletters...">
                            <button class="btn btn-primary" type="button" id="search-newsletter-btn"><i class="fas fa-search"></i></button>
                        </div>
                        <button class="btn btn-danger" id="delete-selected-newsletters">
                            <i class="fas fa-trash me-1"></i>Delete selected
                        </button>
                    </div>
                    <div class="admin-table-section">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th><input type="checkbox" id="select-all-newsletters"></th>
                                    <th>Title</th>
                                    <th>Owner</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="newsletters-table-body">
                                <?php foreach($newsletters as $newsletter): 
                                    $owner = isset($users[$newsletter['user_ID']]) ? $users[$newsletter['user_ID']]['username'] : 'Unknown';
                                ?>
                                <tr data-newsletter-id="<?= $newsletter['newsletter_ID'] ?>" class="newsletter-row" style="cursor: pointer;">
                                    <td><input type="checkbox" class="newsletter-checkbox" value="<?= $newsletter['newsletter_ID'] ?>" onclick="event.stopPropagation();"></td>
                                    <td onclick="editNewsletter(<?= $newsletter['newsletter_ID'] ?>)"><?= htmlspecialchars(substr($newsletter['title'], 0, 50)) ?><?= strlen($newsletter['title']) > 50 ? '...' : '' ?></td>
                                    <td onclick="editNewsletter(<?= $newsletter['newsletter_ID'] ?>)"><?= htmlspecialchars($owner) ?></td>
                                    <td onclick="editNewsletter(<?= $newsletter['newsletter_ID'] ?>)">
                                        <span class="badge bg-<?= $newsletter['status'] === 'published' ? 'success' : ($newsletter['status'] === 'hidden' ? 'danger' : 'secondary') ?>">
                                            <?= ucfirst($newsletter['status']) ?>
                                        </span>
                                    </td>
                                    <td onclick="editNewsletter(<?= $newsletter['newsletter_ID'] ?>)"><?= date('M j, Y', strtotime($newsletter['creation_date'])) ?></td>
                                    <td>
                                        <button class="btn btn-sm <?= $newsletter['status'] === 'hidden' ? 'btn-success' : 'btn-secondary' ?> hide-newsletter-btn" data-id="<?= $newsletter['newsletter_ID'] ?>" onclick="event.stopPropagation();">
                                            <i class="fas fa-<?= $newsletter['status'] === 'hidden' ? 'eye' : 'eye-slash' ?> me-1"></i>
                                            <?= $newsletter['status'] === 'hidden' ? 'Unhide' : 'Hide' ?>
                                        </button>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div id="tab_generator" class="list-unstyled admin-tab-content" style="display: none;">
                <div class="admin-tab-header">
                    <h2><i class="fas fa-magic me-2"></i>AI Newsletter Generator</h2>
                    <p style="color: var(--text-secondary)">Generate and edit newsletters with AI assistance.</p>
                </div>
                
                <!-- Generate Mode -->
                <div id="generate-mode" style="padding: 1.5rem;">
                    <div class="card mb-4">
                        <div class="card-body">
                            <label class="form-label fw-bold" style="color: var(--text-primary); font-size: 1.1rem;">
                                <i class="fas fa-lightbulb me-2"></i>What should the newsletter be about?
                            </label>
                            <textarea id="admin-newsletter-query" class="form-control mb-3" rows="5" 
                                      placeholder="Example: Write a newsletter about the latest AI trends in 2025, including breakthroughs in machine learning and their impact on businesses."
                                      style="background-color: var(--card-bg); color: var(--text-primary); border-color: var(--border-color); font-size: 1rem;"></textarea>
                            <div class="d-flex gap-2">
                                <button id="admin-generate-btn" class="btn btn-primary btn-lg">
                                    <i class="fas fa-magic me-2"></i>Generate Newsletter
                                </button>
                            </div>
                            <small class="text-muted d-block mt-2">
                                <i class="fas fa-info-circle me-1"></i>
                                Generation takes 1-2 minutes. Be specific about topics, tone, and target audience.
                            </small>
                        </div>
                    </div>
                </div>

                <!-- Loading State -->
                <div id="admin-loading" style="display:none;" class="text-center my-5">
                    <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <h4 class="mt-3" style="color: var(--text-primary)">Generating Your Newsletter</h4>
                    <p class="mt-2" style="color: var(--text-secondary)">
                        <i class="fas fa-clock me-1"></i>This may take 1-2 minutes. Please wait...
                    </p>
                    <div class="progress mt-3 mx-auto" style="max-width: 400px; height: 8px;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary" role="progressbar" style="width: 100%"></div>
                    </div>
                </div>

                <!-- Edit Mode -->
                <div id="admin-edit-mode" style="display:none;">
                    <div class="card mb-3">
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-8 mb-3">
                                    <label class="form-label fw-bold" style="color: var(--text-primary)">
                                        <i class="fas fa-heading me-1"></i>Title
                                    </label>
                                    <input type="text" id="admin-newsletter-title" class="form-control" 
                                           placeholder="Enter newsletter title..."
                                           style="background-color: var(--card-bg); color: var(--text-primary); border-color: var(--border-color);">
                                </div>
                                
                                <div class="col-md-4 mb-3">
                                    <label class="form-label fw-bold" style="color: var(--text-primary)">
                                        <i class="fas fa-tags me-1"></i>Categories
                                    </label>
                                    <select id="admin-category-select" class="form-select" multiple size="3"
                                            style="background-color: var(--card-bg); color: var(--text-primary); border-color: var(--border-color);">
                                        <option value="" disabled>Loading categories...</option>
                                    </select>
                                    <button id="admin-add-category-btn" class="btn btn-sm btn-outline-primary mt-2 w-100">
                                        <i class="fas fa-plus me-1"></i>New Category
                                    </button>
                                </div>
                            </div>
                            
                            <label class="form-label fw-bold" style="color: var(--text-primary)">
                                <i class="fas fa-file-alt me-1"></i>Content
                            </label>
                            <div id="admin-newsletter-editor" class="form-control mb-3" 
                                 style="min-height: 450px; max-height: 550px; overflow-y: auto; background-color: var(--card-bg); color: var(--text-primary); border-color: var(--border-color); font-size: 1rem; line-height: 1.6;" 
                                 contenteditable="true">
                            </div>
                            
                            <div class="d-flex gap-2 flex-wrap">
                                <button id="admin-save-btn" class="btn btn-success">
                                    <i class="fas fa-save me-1"></i>Save
                                </button>
                                <button id="admin-ai-edit-btn" class="btn btn-info">
                                    <i class="fas fa-magic me-1"></i>AI Edit
                                </button>
                                <button id="admin-publish-btn" class="btn btn-primary btn-visible">
                                    <i class="fas fa-paper-plane me-1"></i>Publish
                                </button>
                                <button id="admin-unpublish-btn" class="btn btn-warning btn-hidden">
                                    <i class="fas fa-undo me-1"></i>Unpublish
                                </button>
                                <button id="admin-hide-btn" class="btn btn-secondary btn-visible">
                                    <i class="fas fa-eye-slash me-1"></i>Hide
                                </button>
                                <button id="admin-unhide-btn" class="btn btn-success btn-hidden">
                                    <i class="fas fa-eye me-1"></i>Unhide
                                </button>
                                <button id="admin-delete-btn" class="btn btn-danger">
                                    <i class="fas fa-trash me-1"></i>Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Error/Success Display -->
                <div id="admin-error" style="display:none;" class="alert alert-danger mb-3 p-3"></div>
                <div id="admin-success" style="display:none;" class="alert alert-success mb-3 p-3"></div>
            </div>

            <div id="tab_viewLetters" class="list-unstyled admin-tab-content" style="display: none;">
                <div class="admin-tab-header">
                    <h2>Users</h2>
                    <p style="color: var(--text-secondary)">Here you can view all user accounts.</p>
                </div>
                <div class="admin-content-container">
                    <div class="admin-search-section">
                        <div class="input-group">
                            <input type="text" class="form-control" id="searchUsername" placeholder="Search users...">
                            <button class="btn btn-primary" type="button" id="search-user-btn"><i class="fas fa-search"></i></button>
                        </div>
                    </div>
                    <div class="admin-table-section">
                        <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Joined</th>
                                <th>Newsletters</th>
                                <th>Categories</th>
                            </tr>
                        </thead>
                        <tbody id="users-table-body">
                            <?php foreach($users as $user): ?>
                            <tr data-user-id="<?= $user['user_ID'] ?>">
                                <td><?= htmlspecialchars($user['username']) ?></td>
                                <td>
                                    <span class="badge bg-<?= $user['role'] === 'owner' ? 'danger' : ($user['role'] === 'admin' ? 'warning' : 'primary') ?>">
                                        <?= ucfirst($user['role']) ?>
                                    </span>
                                </td>
                                <td><?= date('M j, Y', strtotime($user['creation_date'])) ?></td>
                                <td><?= count($user['c_newsletters']) ?></td>
                                <td><?= count($user['c_categories']) ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div id="tab_viewCategories" class="list-unstyled admin-tab-content" style="display: none;">
            <div class="admin-tab-header">
                <h2>Categories</h2>
                <p style="color: var(--text-secondary)">Here you can view and manage Categories.</p>
            </div>
            <div class="admin-content-container">
                <div class="admin-search-section">
                    <div class="input-group">
                        <input type="text" class="form-control" id="searchCategories" placeholder="Search categories...">
                        <button class="btn btn-primary" type="button" id="search-category-btn"><i class="fas fa-search"></i></button>
                    </div>
                    <div class="admin-button-group">
                        <button class="btn btn-success" id="create-category-tab-btn">
                            <i class="fas fa-plus me-1"></i>Create New Category
                        </button>
                        <button class="btn btn-danger" id="toggle-selected-categories">
                            <i class="fas fa-eye-slash me-1"></i>Hide selected
                        </button>
                    </div>
                </div>
                <div class="admin-table-section">
                    <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th><input type="checkbox" id="select-all-categories"></th>
                                    <th>Name</th>
                                    <th>Status</th>
                                    <th>Newsletters</th>
                                    <th>Contributors</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="categories-table-body">
                                <?php foreach($categories as $category): ?>
                                <tr data-category-id="<?= $category['category_ID'] ?>" data-status="<?= $category['status'] ?>">
                                    <td><input type="checkbox" class="category-checkbox" value="<?= $category['category_ID'] ?>"></td>
                                    <td><?= htmlspecialchars($category['name']) ?></td>
                                    <td>
                                        <span class="badge bg-<?= $category['status'] === 'shown' ? 'success' : 'secondary' ?>">
                                            <?= ucfirst($category['status']) ?>
                                        </span>
                                    </td>
                                    <td><?= count($category['newsletters']) ?></td>
                                    <td><?= count($category['contributors']) ?></td>
                                    <td>
                                        <button class="btn btn-sm <?= $category['status'] === 'shown' ? 'btn-warning' : 'btn-success' ?> toggle-category-btn" data-id="<?= $category['category_ID'] ?>">
                                            <i class="fas fa-<?= $category['status'] === 'shown' ? 'eye-slash' : 'eye' ?> me-1"></i>
                                            <?= $category['status'] === 'shown' ? 'Hide' : 'Show' ?>
                                        </button>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

    <!-- Delete NewsLetters Confirmation Modal -->
    <div class="modal fade" id="delNewsletterConfirm" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content" style="background-color: var(--bg-secondary)">
                <div class="modal-header">
                    <h5 class="modal-title" style="color: var(--text-primary)">Confirm Deletion</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body" style="color: var(--text-secondary)">
                    Are you sure you want to delete the selected newsletters?
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" id="confirm-delete-newsletters">Delete</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Toggle Categories Confirmation Modal -->
    <div class="modal fade" id="toggleCategoryConfirm" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content" style="background-color: var(--bg-secondary)">
                <div class="modal-header">
                    <h5 class="modal-title" style="color: var(--text-primary)" id="toggle-category-modal-title">Confirm Action</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body" style="color: var(--text-secondary)" id="toggle-category-modal-body">
                    Are you sure you want to perform this action on the selected categories?
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="confirm-toggle-categories">Confirm</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Category Modal for Newsletter Generator -->
    <div class="modal fade" id="adminCategoryModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content" style="background-color: var(--bg-secondary)">
                <div class="modal-header">
                    <h5 class="modal-title" style="color: var(--text-primary)">Create New Category</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <input type="text" id="admin-new-category-name" class="form-control" 
                           placeholder="Category name" style="background-color: var(--bg-primary); color: var(--text-primary); border-color: var(--border-color);">
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" id="admin-save-category-btn" class="btn btn-primary">Create</button>
                </div>
            </div>
        </div>
    </div>

<script src="../bootstrap-5.3.6-dist/js/bootstrap.bundle.min.js"></script>
<script src="../scripts/js/adminpanel.js"></script>
<script src="../scripts/js/theme.js"></script>
<script src="../scripts/js/adminActions.js"></script>
<script>
    // Load saved avatar from localStorage
    const adminAvatar = document.getElementById('adminAvatar');
    const savedAvatar = localStorage.getItem('userAvatar');
    if (savedAvatar && adminAvatar) {
        adminAvatar.src = savedAvatar;
    }
</script>
</body>
</html>
