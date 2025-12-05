// Home View - Complete Functionality

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Create popup in parent window
function createPopupInParent() {
    if (!window.parent || window.parent === window) return null;
    
    const parentDoc = window.parent.document;
    
    // Check if popup already exists
    let popup = parentDoc.getElementById('categoryPopupOverlay');
    if (popup) return popup;
    
    // Create popup HTML
    const popupHTML = `
        <div class="category-popup-overlay" id="categoryPopupOverlay" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(10px);
            z-index: 99999;
            display: none;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        ">
            <div class="category-popup-content" style="
                background: #1a1a1a;
                border-radius: 16px;
                max-width: 900px;
                width: 90%;
                max-height: 85vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                animation: slideUp 0.3s ease;
            ">
                <div class="category-popup-header" style="
                    padding: 24px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: linear-gradient(135deg, rgba(52, 152, 219, 0.15), rgba(46, 204, 113, 0.15));
                ">
                    <h3 id="categoryPopupTitle" style="
                        font-size: 1.5rem;
                        font-weight: 700;
                        color: #ecf0f1;
                        margin: 0;
                    ">
                        <i class="fas fa-layer-group" style="margin-right: 8px;"></i>Category Newsletters
                    </h3>
                    <button onclick="window.closeCategoryPopup()" aria-label="Close" style="
                        background: none;
                        border: none;
                        color: #ecf0f1;
                        font-size: 1.5rem;
                        cursor: pointer;
                        padding: 8px;
                        border-radius: 50%;
                        transition: all 0.2s ease;
                        width: 40px;
                        height: 40px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    " onmouseover="this.style.background='rgba(231, 76, 60, 0.2)'; this.style.color='#e74c3c'; this.style.transform='rotate(90deg)';" onmouseout="this.style.background='none'; this.style.color='#ecf0f1'; this.style.transform='rotate(0deg)';">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="categoryPopupBody" style="
                    padding: 24px;
                    overflow-y: auto;
                    flex: 1;
                "></div>
            </div>
        </div>
    `;
    
    // Add animations CSS to parent
    if (!parentDoc.getElementById('categoryPopupStyles')) {
        const style = parentDoc.createElement('style');
        style.id = 'categoryPopupStyles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .category-popup-overlay.active {
                display: flex !important;
            }
            #categoryPopupBody::-webkit-scrollbar {
                width: 8px;
            }
            #categoryPopupBody::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 4px;
            }
            #categoryPopupBody::-webkit-scrollbar-thumb {
                background: rgba(52, 152, 219, 0.5);
                border-radius: 4px;
            }
            #categoryPopupBody::-webkit-scrollbar-thumb:hover {
                background: rgba(52, 152, 219, 0.7);
            }
            .popup-newsletter-item {
                padding: 20px;
                margin-bottom: 16px;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 12px;
                border-left: 4px solid #3498db;
                transition: all 0.3s ease;
                cursor: pointer;
            }
            .popup-newsletter-item:hover {
                background: rgba(255, 255, 255, 0.06);
                border-left-color: #2ecc71;
                transform: translateX(8px);
                box-shadow: 0 4px 12px rgba(52, 152, 219, 0.2);
            }
            .popup-newsletter-item:last-child {
                margin-bottom: 0;
            }
        `;
        parentDoc.head.appendChild(style);
    }
    
    // Insert popup into parent body
    const div = parentDoc.createElement('div');
    div.innerHTML = popupHTML;
    parentDoc.body.appendChild(div.firstElementChild);
    
    popup = parentDoc.getElementById('categoryPopupOverlay');
    
    // Add click outside to close
    popup.addEventListener('click', function(e) {
        if (e.target === popup) {
            window.parent.closeCategoryPopup();
        }
    });
    
    // Add ESC key to close
    parentDoc.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && popup.classList.contains('active')) {
            window.parent.closeCategoryPopup();
        }
    });
    
    return popup;
}

// Open category popup in parent window
function openCategoryPopup(categoryId, categoryName) {
    try {
        const popup = createPopupInParent();
        if (!popup) return;
        
        const parentDoc = window.parent.document;
        const title = parentDoc.getElementById('categoryPopupTitle');
        const body = parentDoc.getElementById('categoryPopupBody');
        
        title.innerHTML = '<i class="fas fa-layer-group" style="margin-right: 8px;"></i>' + escapeHtml(categoryName);
        
        const newsletters = window.categoryNewslettersData ? window.categoryNewslettersData[categoryId] : [];
        
        if (!newsletters || newsletters.length === 0) {
            body.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #95a5a6;">
                    <i class="fas fa-inbox" style="font-size: 4rem; margin-bottom: 20px; color: #7f8c8d;"></i>
                    <h4>No Newsletters Yet</h4>
                    <p>This category doesn't have any newsletters at the moment.</p>
                </div>
            `;
        } else {
            let html = '';
            newsletters.forEach(newsletter => {
                const content = newsletter.content || 'Newsletter description coming soon';
                const strippedContent = content.replace(/<[^>]*>/g, '');
                const description = strippedContent.substring(0, 200);
                const date = new Date(newsletter.creation_date);
                const formattedDate = date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                
                html += `
                    <div class="popup-newsletter-item" onclick="window.frames[0].openNewsletter(${newsletter.newsletter_ID})">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                            <h4 style="font-size: 1.15rem; font-weight: 600; color: #ecf0f1; margin: 0; flex: 1; line-height: 1.3;">${escapeHtml(newsletter.title)}</h4>
                        </div>
                        <p style="font-size: 0.9rem; color: #95a5a6; margin-bottom: 12px; line-height: 1.5;">${escapeHtml(description)}${strippedContent.length > 200 ? '...' : ''}</p>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                            <span style="font-size: 0.85rem; color: #7f8c8d;">
                                <i class="far fa-calendar-alt" style="margin-right: 8px;"></i>${formattedDate}
                            </span>
                            <span style="color: #3498db; font-size: 0.9rem; font-weight: 500;">
                                Click to read <i class="fas fa-arrow-right" style="margin-left: 4px;"></i>
                            </span>
                        </div>
                    </div>
                `;
            });
            body.innerHTML = html;
        }
        
        popup.classList.add('active');
        parentDoc.body.style.overflow = 'hidden';
    } catch (e) {
        console.error('Could not open popup in parent window:', e);
    }
}

// Close category popup (exposed to parent window)
window.parent.closeCategoryPopup = function() {
    try {
        const parentDoc = window.parent.document;
        const popup = parentDoc.getElementById('categoryPopupOverlay');
        if (popup) {
            popup.classList.remove('active');
            parentDoc.body.style.overflow = '';
        }
    } catch (e) {
        console.error('Could not close popup:', e);
    }
};

// Open newsletter from popup
function openNewsletter(newsletterId) {
    if (parent.window && parent.window.popupSystem) {
        parent.window.popupSystem.newsPopup(newsletterId);
        // Close category popup after opening newsletter
        if (window.parent.closeCategoryPopup) {
            window.parent.closeCategoryPopup();
        }
    }
}

// AUTO-REFRESH FEATURED NEWSLETTER SYSTEM
let autoRefreshInterval = null;
let currentFeaturedId = window.currentFeaturedId || null;

// Check for newest newsletter via AJAX
function checkForNewestNewsletter() {
    console.log('Checking for newest newsletter... Current ID:', currentFeaturedId);
    
    fetch('pages/home_view.php?check_newest=1')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('AJAX response:', data);
            
            if (data.has_new && data.newsletter) {
                const newId = parseInt(data.newsletter.newsletter_ID);
                console.log('Comparing - New ID:', newId, 'Current ID:', currentFeaturedId);
                
                // Only update if we have a new newsletter ID
                if (currentFeaturedId === null || newId != currentFeaturedId) {
                    console.log('✓ New newsletter detected! Updating...');
                    updateFeaturedNewsletter(data.newsletter);
                    currentFeaturedId = newId;
                    showNewContentNotification();
                } else {
                    console.log('✗ Newsletter is already the newest one');
                }
            } else {
                console.log('No newsletter data in response');
            }
        })
        .catch(error => {
            console.error('Error checking for newest newsletter:', error);
        });
}

// Update the featured newsletter section with new content
function updateFeaturedNewsletter(newsletter) {
    const sectionEl = document.getElementById('featuredSection');
    const titleEl = document.getElementById('featuredTitle');
    const descEl = document.getElementById('featuredDescription');
    const dateEl = document.getElementById('featuredDate');
    const btnEl = document.getElementById('featuredReadBtn');
    
    if (!sectionEl || !titleEl || !descEl || !dateEl || !btnEl) {
        console.error('Featured section elements not found');
        return;
    }
    
    // Add highlight animation
    sectionEl.style.animation = 'highlightFlash 1s ease-in-out';
    setTimeout(() => {
        sectionEl.style.animation = '';
    }, 1000);
    
    // Update content
    titleEl.textContent = newsletter.title;
    
    // Strip HTML tags and truncate description
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newsletter.content || 'Latest newsletter content.';
    const strippedContent = tempDiv.textContent || tempDiv.innerText || '';
    descEl.textContent = strippedContent.substring(0, 150) + '...';
    
    // Format and update date
    const date = new Date(newsletter.creation_date);
    const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    dateEl.innerHTML = '<i class="far fa-calendar-alt me-1"></i>' + formattedDate;
    
    // Update read button onclick
    btnEl.setAttribute('onclick', `if(parent.window.popupSystem) parent.window.popupSystem.newsPopup(${newsletter.newsletter_ID})`);
    
    console.log('Featured newsletter updated to:', newsletter.title);
}

// Show notification when new content is available
function showNewContentNotification() {
    // Check if notification already exists
    if (document.getElementById('newContentNotification')) {
        return;
    }
    
    const notification = document.createElement('div');
    notification.id = 'newContentNotification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #2ecc71, #27ae60);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(46, 204, 113, 0.4);
        z-index: 10000;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideInRight 0.5s ease;
        max-width: 350px;
    `;
    
    notification.innerHTML = `
        <i class="fas fa-check-circle" style="font-size: 1.3rem;"></i>
        <div style="flex: 1;">
            <div style="font-weight: 600; margin-bottom: 4px;">New Newsletter Available!</div>
            <div style="font-size: 0.85rem; opacity: 0.95;">The featured section has been updated.</div>
        </div>
        <button onclick="this.parentElement.remove()" style="
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.9rem;
            transition: all 0.2s ease;
        " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-dismiss after 8 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.5s ease';
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 500);
    }, 8000);
}

// Start auto-refresh polling
function startAutoRefresh() {
    // Check immediately on load
    checkForNewestNewsletter();
    
    // Then check every 30 seconds
    autoRefreshInterval = setInterval(checkForNewestNewsletter, 30000);
    
    console.log('Auto-refresh started - checking every 30 seconds');
}

// Stop auto-refresh polling
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('Auto-refresh stopped');
    }
}

// Set initial page load time
const pageLoadTime = new Date();

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

// Update timestamp every 30 seconds
setInterval(updateTimestamp, 30000);

// Scroll to a specific category card when selected from dropdown
function scrollToCategoryCard(index) {
    const categoryCard = document.getElementById('category-card-' + index);
    if (categoryCard) {
        // Show the hidden category
        categoryCard.style.display = 'block';
        categoryCard.classList.remove('category-hidden');
        
        // Smooth scroll to the category
        categoryCard.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
        
        // Add highlight effect
        categoryCard.classList.add('highlight-flash');
        setTimeout(() => {
            categoryCard.classList.remove('highlight-flash');
        }, 2000);
    }
}

// Refresh button with animation
const refreshBtn = document.getElementById('refreshHomeBtn');
if (refreshBtn) {
    refreshBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const icon = this.querySelector('i');
        
        // Add spinning animation
        icon.classList.add('fa-spin');
        this.disabled = true;
        
        // Check for new newsletter instead of reloading
        checkForNewestNewsletter();
        
        // Re-enable button after check
        setTimeout(() => {
            icon.classList.remove('fa-spin');
            this.disabled = false;
        }, 1000);
    });
}

// Start auto-refresh when page loads
startAutoRefresh();

// Pause auto-refresh when page is hidden, resume when visible
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        startAutoRefresh();
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
});

// Request parent window to remove overflow restrictions on iframe
if (window.parent !== window) {
    // Send message to parent to adjust iframe styles
    window.parent.postMessage({
        type: 'removeIframeOverflow'
    }, '*');
    
    // Also try direct manipulation if accessible
    try {
        const iframe = window.parent.document.querySelector('iframe');
        if (iframe) {
            iframe.style.overflow = 'visible';
            iframe.parentElement.style.overflow = 'visible';
        }
    } catch (e) {
        // Cross-origin restriction, message should handle it
        console.log('Using postMessage for overflow control');
    }
}

// Make functions globally available
window.openCategoryPopup = openCategoryPopup;
window.openNewsletter = openNewsletter;
window.scrollToCategoryCard = scrollToCategoryCard;
