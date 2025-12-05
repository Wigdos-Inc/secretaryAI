// Home View - Popup Initialization and Refresh Logic

// Initialize popup system with newsletter data
if (parent.window && parent.window.popupSystem) {
    parent.window.popupSystem.initData(window.newslettersData || {}, window.categoriesData || {}, {}, window.currentUserID || null);
}

// Open category popup function
function openCategoryFromDropdown(categoryId) {
    if (parent.window && parent.window.popupSystem) {
        parent.window.popupSystem.categoryPopup(categoryId);
    }
    // Close dropdown after selection
    closeCategoryDropdown();
}

// Dropdown functionality
function toggleCategoryDropdown() {
    const dropdown = document.getElementById('categoryDropdownMenu');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

function closeCategoryDropdown() {
    const dropdown = document.getElementById('categoryDropdownMenu');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('categoryDropdownMenu');
    const button = document.getElementById('viewMoreCategoriesBtn');
    
    if (dropdown && button) {
        if (!dropdown.contains(event.target) && !button.contains(event.target)) {
            closeCategoryDropdown();
        }
    }
});

// Initialize dropdown button
document.addEventListener('DOMContentLoaded', function() {
    const dropdownBtn = document.getElementById('viewMoreCategoriesBtn');
    if (dropdownBtn) {
        dropdownBtn.addEventListener('click', function(e) {
            e.preventDefault();
            toggleCategoryDropdown();
        });
    }
});

// Set current featured ID for auto-refresh
window.currentFeaturedId = window.currentFeaturedId || null;

// Set initial page load time
const pageLoadTime = new Date();

// Real-time sync variables
let lastUpdateCheck = new Date();
let currentNewsletterCount = 0;
let currentCategoryCount = 0;
let lastNewsletterDate = null;
let lastCategoryDate = null;

// Sync interval (in milliseconds) - check every 5 seconds
const SYNC_INTERVAL = 5 * 1000;

// Update the "last updated" timestamp
function updateTimestamp() {
    const now = new Date();
    const diffSeconds = Math.floor((now - pageLoadTime) / 1000);
    const updateTimeSpan = document.getElementById('updateTime');
    
    if (updateTimeSpan) {
        if (diffSeconds < 60) {
            updateTimeSpan.textContent = 'just now';
        } else if (diffSeconds < 3600) {
            const minutes = Math.floor(diffSeconds / 60);
            updateTimeSpan.textContent = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            const hours = Math.floor(diffSeconds / 3600);
            updateTimeSpan.textContent = `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
    }
}

// Check for updates from server
async function checkForUpdates() {
    try {
        const response = await fetch('home_view.php?check_updates=1');
        const data = await response.json();
        
        if (data.updates) {
            const updates = data.updates;
            let hasNewContent = false;
            
            // Check if newsletter count changed
            if (currentNewsletterCount > 0 && updates.newsletter_count !== currentNewsletterCount) {
                hasNewContent = true;
            }
            
            // Check if category count changed
            if (currentCategoryCount > 0 && updates.category_count !== currentCategoryCount) {
                hasNewContent = true;
            }
            
            // Check if latest newsletter is newer
            if (lastNewsletterDate && updates.latest_newsletter && new Date(updates.latest_newsletter) > new Date(lastNewsletterDate)) {
                hasNewContent = true;
            }
            
            // Check if latest category is newer
            if (lastCategoryDate && updates.latest_category && new Date(updates.latest_category) > new Date(lastCategoryDate)) {
                hasNewContent = true;
            }
            
            // Update stored values
            currentNewsletterCount = updates.newsletter_count;
            currentCategoryCount = updates.category_count;
            lastNewsletterDate = updates.latest_newsletter;
            lastCategoryDate = updates.latest_category;
            
            // Refresh if new content detected
            if (hasNewContent) {
                console.log('New content detected, refreshing page...');
                location.reload();
            }
        }
    } catch (error) {
        console.log('Error checking for updates:', error);
    }
}

// Initialize sync data
function initializeSyncData() {
    // Get initial counts from the page data
    if (window.newslettersData) {
        currentNewsletterCount = Object.keys(window.newslettersData).length;
    }
    if (window.categoriesData) {
        currentCategoryCount = Object.keys(window.categoriesData).length;
    }
    
    // Get latest dates from the data
    if (window.newslettersData) {
        const dates = Object.values(window.newslettersData).map(n => n.creation_date).filter(d => d);
        if (dates.length > 0) {
            lastNewsletterDate = dates.sort().pop();
        }
    }
    
    // Start checking for updates
    setInterval(checkForUpdates, SYNC_INTERVAL);
}

// Update timestamp every 5 seconds
setInterval(updateTimestamp, 5000);

// Initialize sync when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeSyncData();
});
