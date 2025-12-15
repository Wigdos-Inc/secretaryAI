<?php 
require_once 'scripts/db/data.php'; 

// If someone manually hits ?load=... (used nowhere in app), redirect to the base page to avoid 500s
if (isset($_GET['load'])) {
  // Redirect to site root (remove the unsupported ?load= param)
  header('Location: /');
  exit;
}

// Check if user is admin or owner
$isAdminOrOwner = false;
if ($userID && isset($users[$userID])) {
    $userRole = $users[$userID]['role'];
    $isAdminOrOwner = ($userRole === 'admin' || $userRole === 'owner');
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="bootstrap-5.3.6-dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="styling/main.css">
  <link rel="stylesheet" href="styling/index.css">
  <link rel="stylesheet" href="styling/favorites.css">
  <link rel="stylesheet" href="styling/tutorial.css">
  <link rel="shortcut icon" href="media/images/icons/favicon.svg" type="image/x-icon">
  <title>Newswire AI</title>
</head>
<body>

  <!-- Header -->
  <header class="custom-header">
    <div class="container">
      <div class="d-flex justify-content-between align-items-center">

        <!-- Left Section with Hamburger and Logo -->
        <div class="d-flex align-items-center gap-3">
          <!-- Hamburger Menu Button -->
          <button class="sidebar-open-btn" id="sidebarOpenBtn">
            <span></span>
            <span></span>
            <span></span>
          </button>

          <!-- Logo -->
          <a href="#" data-page="pages/home_view.php" class="logo-section">
            <img src="media/images/icons/favicon.svg" alt="Logo" class="header-logo">
            <span class="logo-text d-none d-md-inline ms-2">Newswire AI</span>
          </a>
        </div>
        
        <!-- Desktop Search Bar (centered) -->
        <div class="search-wrapper desktop-search d-none d-md-flex">
          <input type="text" class="search-input" id="desktopSearchInput" placeholder="Search...">
          <button class="search-btn" id="desktopSearchBtn">
            <i class="fas fa-search"></i>
          </button>
        </div>

        <!-- Right Section -->
        <div class="d-flex align-items-center gap-3">
          <!-- Inbox Dropdown -->
          <div class="position-relative">
            <div class="inbox-icon" id="inboxIcon">
              <i class="fas fa-inbox"></i>
              <?php if (isset($inboxAmount) && $inboxAmount > 0): ?>
                <span class="inbox-badge"><?php echo $inboxAmount; ?></span>
              <?php endif; ?>
            </div>
            <div class="inbox-dropdown" id="inboxDropdown">
              <div class="inbox-header">
                <h6 class="mb-0">Inbox</h6>
                <span class="badge bg-primary"><?php echo isset($inboxAmount) ? $inboxAmount : 0; ?> unread</span>
              </div>
              <div class="inbox-items">
                <?php if (isset($userID) && $userID): ?>
                  <?php
                  $stmt = $pdo->prepare("SELECT * FROM tab_inbox WHERE user_ID = ? AND status = 'unread' ORDER BY date DESC LIMIT 5");
                  $stmt->execute([$userID]);
                  $inboxItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
                  
                  if (count($inboxItems) > 0):
                    foreach ($inboxItems as $item):
                  ?>
                    <a href="#" class="inbox-item" data-page="pages/inbox_view.php" data-message-id="<?php echo $item['message_ID']; ?>">
                      <div class="inbox-item-content">
                        <strong><?php echo htmlspecialchars($item['subject'] ?? 'Notification'); ?></strong>
                        <p class="mb-0"><?php echo htmlspecialchars(substr($item['snippet'] ?? '', 0, 50)); ?>...</p>
                        <small class="inbox-date"><?php echo date('M j, Y', strtotime($item['date'])); ?></small>
                      </div>
                    </a>
                  <?php 
                    endforeach;
                  else:
                  ?>
                    <div class="inbox-empty">
                      <i class="fas fa-inbox fa-2x mb-2"></i>
                      <p class="mb-0">No new messages</p>
                    </div>
                  <?php endif; ?>
                <?php else: ?>
                  <div class="inbox-empty">
                    <i class="fas fa-user-lock fa-2x mb-2"></i>
                    <p class="mb-0">Please login to view inbox</p>
                  </div>
                <?php endif; ?>
              </div>
              <a href="#" class="inbox-footer" data-page="<?php echo isset($userID) && $userID ? 'pages/inbox_view.php' : 'pages/login_view.php?redirect=inbox'; ?>">
                View All Messages
              </a>
            </div>
          </div>

          <!-- Profile Dropdown -->
          <div class="position-relative">
            <div class="profile-icon" id="profileIcon">
              <img id="headerProfileAvatar" src="https://upload.wikimedia.org/wikipedia/commons/a/a3/Image-not-found.png" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: none;">
              <i class="fas fa-user" id="headerProfileIcon"></i>
            </div>
            <div class="profile-dropdown" id="profileDropdown">
              <a href="#" data-page="pages/profile_view.php"><i class="fas fa-user me-2"></i> Profile</a>
              <a href="#" data-page="pages/profile_view.php#settings"><i class="fas fa-cog me-2"></i> Settings</a>
              <?php if ($isAdminOrOwner): ?>
                <a href="#" data-page="pages/adminPanel.php"><i class="fas fa-user-shield me-2"></i> Admin Panel</a>
              <?php endif; ?>
              <?php if (isset($userID) && $userID): ?>
                <a href="#" onclick="logout(); return false;"><i class="fas fa-sign-out-alt me-2"></i> Logout</a>
              <?php else: ?>
                <a href="#" data-page="pages/login_view.php"><i class="fas fa-sign-in-alt me-2"></i> Login</a>
                <a href="#" data-page="pages/register_view.php"><i class="fas fa-user-plus me-2"></i> Register</a>
              <?php endif; ?>
              <div class="dropdown-divider"></div>
              <div class="theme-toggle-container">
                <i class="fas fa-moon me-2"></i>
                <span>Dark Mode</span>
                <label class="theme-toggle-switch">
                  <input type="checkbox" id="themeToggle" checked>
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          <!-- Mobile Hamburger -->
          <button class="btn btn-outline-light d-md-none" id="menuToggle">
            <i class="fas fa-bars"></i>
          </button>
        </div>

      </div>

      <!-- Mobile Search Bar -->
      <div class="mobile-search" id="mobileSearch" style="display: none;">
        <div class="search-wrapper mt-3">
          <input type="text" class="search-input" id="mobileSearchInput" placeholder="Search...">
          <button class="search-btn" id="mobileSearchBtn">
            <i class="fas fa-search"></i>
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- Sidebar -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <h5 class="sidebar-title">Navigation</h5>
      <button class="sidebar-toggle" id="sidebarToggle">
        <i class="fas fa-times"></i>
      </button>
    </div>
    
    <nav class="sidebar-nav">
      <a href="#" class="sidebar-link active" data-page="pages/home_view.php">
        <i class="fas fa-home"></i>
        <span>Home</span>
      </a>
      <!-- 
      <a href="#" class="sidebar-link" data-page="pages/category_view.php">
        <i class="fas fa-th-large"></i>
        <span>Categories</span>
      </a>
      <a href="#" class="sidebar-link" data-page="pages/newsletter_view.php">
        <i class="fas fa-newspaper"></i>
        <span>Newsletters</span>
      </a>
              -->
      <a href="#" class="sidebar-link" data-page="pages/search_view.php">
        <i class="fas fa-search"></i>
        <span>Search</span>
      </a>
      
      <div class="sidebar-divider"></div>
      
      <a href="#" class="sidebar-link" data-page="pages/inbox_view.php">
        <i class="fas fa-inbox"></i>
        <span>Inbox</span>
        <?php if (isset($inboxAmount) && $inboxAmount > 0): ?>
          <span class="sidebar-badge"><?php echo $inboxAmount; ?></span>
        <?php endif; ?>
      </a>
      <a href="#" class="sidebar-link" data-page="pages/profile_view.php#about">
        <i class="fas fa-user"></i>
        <span>Profile</span>
      </a>
      <a href="#" class="sidebar-link" data-page="pages/profile_view.php#settings">
        <i class="fas fa-cog"></i>
        <span>Settings</span>
      </a>
      <?php if ($isAdminOrOwner): ?>
        <a href="#" class="sidebar-link" data-page="pages/adminPanel.php">
          <i class="fas fa-user-shield"></i>
          <span>Admin Panel</span>
        </a>
      <?php endif; ?>
      
      <div class="sidebar-divider"></div>
      
      <?php if (isset($userID) && $userID): ?>
        <a href="#" class="sidebar-link" onclick="logout(); return false;">
          <i class="fas fa-sign-out-alt"></i>
          <span>Logout</span>
        </a>
      <?php else: ?>
        <a href="#" class="sidebar-link" data-page="pages/login_view.php">
          <i class="fas fa-sign-in-alt"></i>
          <span>Login</span>
        </a>
        <a href="#" class="sidebar-link" data-page="pages/register_view.php">
          <i class="fas fa-user-plus"></i>
          <span>Register</span>
        </a>
      <?php endif; ?>
    </nav>

    <div class="sidebar-footer">
      <p class="text-muted small mb-0">© 2025 Newswire AI</p>
    </div>
  </aside>

  <!-- Sidebar Overlay -->
  <div class="sidebar-overlay" id="sidebarOverlay"></div>

  <!-- Main Content -->
  <main class="flex-grow-1 py-5 main-content">
    <div class="container">
      <iframe id="pageContent" src="pages/home_view.php" title="Page content" style="width:100%; border:0; overflow:hidden; display:block;" loading="lazy"></iframe>
    </div>
  </main>

  <!-- Footer -->
  <footer class="footer mt-auto">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-lg-6 col-md-8 text-center">
          
          <!-- Logo -->
          <div class="footer-logo mb-3">Newswire AI</div>
          
          <!-- Description -->
          <p class="footer-about mb-4">Subscribe for updates, news, and exclusive offers.</p>
          
          <!-- Newsletter Signup -->
          <div class="footer-newsletter mb-4">
            <input type="email" placeholder="Enter your email">
            <button class="newsletter-btn"><i class="fas fa-paper-plane"></i></button>
          </div>
          
          <!-- Social Links -->
          <div class="social-links justify-content-center mb-4">
            <a href="#" class="social-icon"><i class="fab fa-facebook-f"></i></a>
            <a href="#" class="social-icon"><i class="fab fa-twitter"></i></a>
            <a href="#" class="social-icon"><i class="fab fa-instagram"></i></a>
            <a href="#" class="social-icon"><i class="fab fa-linkedin-in"></i></a>
          </div>
          
          <!-- Copyright -->
          <div class="footer-bottom">
            <p>© 2025 Newswire AI.</p>
          </div>
          
        </div>
      </div>
    </div>
  </footer>

  <!-- Welcome Tutorial Overlay -->
  <?php if (isset($_COOKIE['show_tutorial']) && $_COOKIE['show_tutorial']): ?>
  <div id="tutorialOverlay" class="tutorial-overlay">
    <div class="tutorial-container">
      <div class="tutorial-card" id="tutorialCard">
        <button class="tutorial-skip-btn" id="skipTutorial">
          <i class="fas fa-times"></i> Skip Tutorial
        </button>
        
        <!-- Welcome Step -->
        <div class="tutorial-step active" data-step="0">
          <div class="tutorial-icon">
            <i class="fas fa-rocket fa-3x"></i>
          </div>
          <h2 class="tutorial-title">Welcome to Newswire AI! 🎉</h2>
          <p class="tutorial-text">Let's take a quick tour of the key features. This will only take a moment!</p>
          <div class="tutorial-progress">
            <span class="tutorial-step-indicator active"></span>
            <span class="tutorial-step-indicator"></span>
            <span class="tutorial-step-indicator"></span>
            <span class="tutorial-step-indicator"></span>
            <span class="tutorial-step-indicator"></span>
            <span class="tutorial-step-indicator"></span>
          </div>
          <button class="tutorial-next-btn" onclick="nextTutorialStep()">Get Started</button>
        </div>

        <!-- Step 1: Sidebar -->
        <div class="tutorial-step" data-step="1">
          <div class="tutorial-icon">
            <i class="fas fa-bars fa-3x"></i>
          </div>
          <h2 class="tutorial-title">Navigation Sidebar</h2>
          <p class="tutorial-text">Click the <strong>hamburger menu</strong> in the top left to access all pages including Home, Categories, Newsletters, and Search.</p>
          <div class="tutorial-mini-card">
            <i class="fas fa-bars"></i>
            <span>Opens the main navigation menu</span>
          </div>
          <div class="tutorial-progress">
            <span class="tutorial-step-indicator completed"></span>
            <span class="tutorial-step-indicator active"></span>
            <span class="tutorial-step-indicator"></span>
            <span class="tutorial-step-indicator"></span>
            <span class="tutorial-step-indicator"></span>
            <span class="tutorial-step-indicator"></span>
          </div>
          <div class="tutorial-buttons">
            <button class="tutorial-back-btn" onclick="prevTutorialStep()">Back</button>
            <button class="tutorial-next-btn" onclick="nextTutorialStep()">Next</button>
          </div>
        </div>

        <!-- Step 2: Search -->
        <div class="tutorial-step" data-step="2">
          <div class="tutorial-icon">
            <i class="fas fa-search fa-3x"></i>
          </div>
          <h2 class="tutorial-title">Search Bar</h2>
          <p class="tutorial-text">Use the <strong>search bar</strong> in the header to quickly find newsletters, articles, and topics that interest you.</p>
          <div class="tutorial-mini-card">
            <i class="fas fa-search"></i>
            <span>Find content across all newsletters</span>
          </div>
          <div class="tutorial-progress">
            <span class="tutorial-step-indicator completed"></span>
            <span class="tutorial-step-indicator completed"></span>
            <span class="tutorial-step-indicator active"></span>
            <span class="tutorial-step-indicator"></span>
            <span class="tutorial-step-indicator"></span>
            <span class="tutorial-step-indicator"></span>
          </div>
          <div class="tutorial-buttons">
            <button class="tutorial-back-btn" onclick="prevTutorialStep()">Back</button>
            <button class="tutorial-next-btn" onclick="nextTutorialStep()">Next</button>
          </div>
        </div>

        <!-- Step 3: Inbox -->
        <div class="tutorial-step" data-step="3">
          <div class="tutorial-icon">
            <i class="fas fa-inbox fa-3x"></i>
          </div>
          <h2 class="tutorial-title">Inbox</h2>
          <p class="tutorial-text">The <strong>inbox icon</strong> shows your unread messages and notifications. Click it to see recent updates.</p>
          <div class="tutorial-mini-card">
            <i class="fas fa-inbox"></i>
            <span>View notifications and messages</span>
          </div>
          <div class="tutorial-progress">
            <span class="tutorial-step-indicator completed"></span>
            <span class="tutorial-step-indicator completed"></span>
            <span class="tutorial-step-indicator completed"></span>
            <span class="tutorial-step-indicator active"></span>
            <span class="tutorial-step-indicator"></span>
            <span class="tutorial-step-indicator"></span>
          </div>
          <div class="tutorial-buttons">
            <button class="tutorial-back-btn" onclick="prevTutorialStep()">Back</button>
            <button class="tutorial-next-btn" onclick="nextTutorialStep()">Next</button>
          </div>
        </div>

        <!-- Step 4: Profile -->
        <div class="tutorial-step" data-step="4">
          <div class="tutorial-icon">
            <i class="fas fa-user fa-3x"></i>
          </div>
          <h2 class="tutorial-title">Profile Menu</h2>
          <p class="tutorial-text">Click the <strong>profile icon</strong> to access your profile, settings, and theme preferences (Light/Dark mode).</p>
          <div class="tutorial-mini-card">
            <i class="fas fa-user"></i>
            <span>Manage your account and preferences</span>
          </div>
          <div class="tutorial-progress">
            <span class="tutorial-step-indicator completed"></span>
            <span class="tutorial-step-indicator completed"></span>
            <span class="tutorial-step-indicator completed"></span>
            <span class="tutorial-step-indicator completed"></span>
            <span class="tutorial-step-indicator active"></span>
            <span class="tutorial-step-indicator"></span>
          </div>
          <div class="tutorial-buttons">
            <button class="tutorial-back-btn" onclick="prevTutorialStep()">Back</button>
            <button class="tutorial-next-btn" onclick="nextTutorialStep()">Next</button>
          </div>
        </div>

        <!-- Final Step -->
        <div class="tutorial-step" data-step="5">
          <div class="tutorial-icon">
            <i class="fas fa-check-circle fa-3x"></i>
          </div>
          <h2 class="tutorial-title">You're All Set! 🚀</h2>
          <p class="tutorial-text">You're ready to explore Newswire AI. Enjoy discovering personalized news and newsletters!</p>
          <div class="tutorial-mini-card highlight">
            <i class="fas fa-lightbulb"></i>
            <span>Tip: You can always access these features from the navigation bar</span>
          </div>
          <div class="tutorial-progress">
            <span class="tutorial-step-indicator completed"></span>
            <span class="tutorial-step-indicator completed"></span>
            <span class="tutorial-step-indicator completed"></span>
            <span class="tutorial-step-indicator completed"></span>
            <span class="tutorial-step-indicator completed"></span>
            <span class="tutorial-step-indicator active"></span>
          </div>
          <button class="tutorial-finish-btn" onclick="finishTutorial()">Start Exploring</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Tutorial styles moved to styling/tutorial.css -->
  <!-- Tutorial scripts moved to scripts/tutorial.js -->
  <?php endif; ?>

  <script src="bootstrap-5.3.6-dist/js/bootstrap.bundle.min.js"></script>
  <script>
    // Set global userID for popup system
    window.globalUserID = <?php echo (isset($userID) && $userID) ? $userID : 'null'; ?>;
  </script>
  <?php if (isset($userID) && $userID): ?>
  <script src="scripts/js/favorites.js"></script>
  <script>
    // Initialize favorites manager globally
    window.favoritesManager = new FavoritesManager();
  </script>
  <?php endif; ?>
  <script src="scripts/js/main.js"></script>
  <script src="scripts/js/navigation.js"></script>
  <?php if (isset($userID) && $userID): ?>
  <script src="scripts/js/inboxBadge.js"></script>
  <?php endif; ?>
  <?php if (isset($_COOKIE['show_tutorial']) && $_COOKIE['show_tutorial']): ?>
  <script src="scripts/js/tutorial.js"></script>
  <?php endif; ?>
  <script>
    // Load profile avatar from localStorage for header
    (function() {
      const savedAvatar = localStorage.getItem('userAvatar');
      const headerAvatar = document.getElementById('headerProfileAvatar');
      const headerIcon = document.getElementById('headerProfileIcon');
      
      function updateHeaderAvatar(avatarData) {
        if (avatarData && headerAvatar && headerIcon) {
          headerAvatar.src = avatarData;
          headerAvatar.style.display = 'block';
          headerIcon.style.display = 'none';
        }
      }
      
      if (savedAvatar) {
        updateHeaderAvatar(savedAvatar);
      }
      
      // Listen for avatar updates from iframe
      window.addEventListener('message', function(event) {
        if (event.data.type === 'avatarUpdated') {
          updateHeaderAvatar(event.data.avatar);
        }
      });
    })();
  </script>
</body>
</html>

