// Navigation and UI Controls for Main Application

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Inbox Dropdown Toggle
const inboxIcon = document.getElementById('inboxIcon');
const inboxDropdown = document.getElementById('inboxDropdown');

if (inboxIcon && inboxDropdown) {
  inboxIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    inboxDropdown.classList.toggle('show');
    // Close profile dropdown if open
    if (profileDropdown) profileDropdown.classList.remove('show');
  });
}

// Profile Dropdown Toggle
const profileIcon = document.getElementById('profileIcon');
const profileDropdown = document.getElementById('profileDropdown');

if (profileIcon && profileDropdown) {
  profileIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle('show');
    // Close inbox dropdown if open
    if (inboxDropdown) inboxDropdown.classList.remove('show');
  });
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (inboxIcon && inboxDropdown && 
      !inboxIcon.contains(e.target) && !inboxDropdown.contains(e.target)) {
    inboxDropdown.classList.remove('show');
  }
  if (profileIcon && profileDropdown &&
      !profileIcon.contains(e.target) && !profileDropdown.contains(e.target)) {
    profileDropdown.classList.remove('show');
  }
});

// Mobile menu toggle
const menuToggle = document.getElementById('menuToggle');
const mobileSearch = document.getElementById('mobileSearch');

if (menuToggle && mobileSearch) {
  menuToggle.addEventListener('click', () => {
    if (mobileSearch.style.display === 'none' || mobileSearch.style.display === '') {
      mobileSearch.style.display = 'block';
    } else {
      mobileSearch.style.display = 'none';
    }
  });
}

// Sidebar functionality
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarOpenBtn = document.getElementById('sidebarOpenBtn');
const sidebarLinks = document.querySelectorAll('.sidebar-link');

// Toggle sidebar - pushes content instead of overlaying
function toggleSidebar() {
  sidebar.classList.toggle('active');
  document.body.classList.toggle('sidebar-open');
}

if (sidebarOpenBtn) {
  sidebarOpenBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSidebar();
  });
}

if (sidebarToggle) {
  sidebarToggle.addEventListener('click', toggleSidebar);
}

// Handle sidebar link clicks - stays open
sidebarLinks.forEach(link => {
  link.addEventListener('click', function(e) {
    // Remove active class from all links
    sidebarLinks.forEach(l => l.classList.remove('active'));
    // Add active class to clicked link
    this.classList.add('active');
    // Sidebar stays open - don't close it
  });
});

// Theme Toggle Functionality
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.querySelector('.theme-toggle-container i');
const themeText = document.querySelector('.theme-toggle-container span');

// Check for saved theme preference or default to dark mode
const currentTheme = localStorage.getItem('theme') || 'dark';
if (currentTheme === 'light') {
  document.body.classList.add('light-mode');
  themeToggle.checked = false;
  themeIcon.classList.remove('fa-moon');
  themeIcon.classList.add('fa-sun');
  themeText.textContent = 'Light Mode';
}

// Function to sync theme with iframe
function syncThemeToIframe(theme) {
  const iframe = document.getElementById('pageContent');
  if (iframe && iframe.contentWindow) {
    try {
      iframe.contentWindow.postMessage({ type: 'themeChange', theme: theme }, '*');
    } catch (err) {
      console.log('Could not sync theme to iframe:', err);
    }
  }
}

// Toggle theme
themeToggle.addEventListener('change', function() {
  if (this.checked) {
    // Switch to dark mode
    document.body.classList.remove('light-mode');
    themeIcon.classList.remove('fa-sun');
    themeIcon.classList.add('fa-moon');
    themeText.textContent = 'Dark Mode';
    localStorage.setItem('theme', 'dark');
    syncThemeToIframe('dark');
  } else {
    // Switch to light mode
    document.body.classList.add('light-mode');
    themeIcon.classList.remove('fa-moon');
    themeIcon.classList.add('fa-sun');
    themeText.textContent = 'Light Mode';
    localStorage.setItem('theme', 'light');
    syncThemeToIframe('light');
  }
});

// Sync theme when iframe loads
const iframe = document.getElementById('pageContent');
if (iframe) {
  iframe.addEventListener('load', function() {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    syncThemeToIframe(currentTheme);
  });
}

// Search functionality
function performSearch(query) {
  if (query.trim()) {
    document.getElementById('pageContent').src = 'pages/search_view.php?query=' + encodeURIComponent(query);
  }
}

// Desktop search
document.getElementById('desktopSearchBtn')?.addEventListener('click', () => {
  performSearch(document.getElementById('desktopSearchInput').value);
});
document.getElementById('desktopSearchInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') performSearch(e.target.value);
});

// Mobile search
document.getElementById('mobileSearchBtn')?.addEventListener('click', () => {
  performSearch(document.getElementById('mobileSearchInput').value);
});
document.getElementById('mobileSearchInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') performSearch(e.target.value);
});

// Logout function
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    fetch('scripts/db/account/logout.php', { 
      method: 'POST',
      credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        window.location.reload();
      } else {
        alert('Logout failed. Please try again.');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      // Reload anyway as a fallback
      window.location.reload();
    });
  }
}

// Make logout function globally available
window.logout = logout;
