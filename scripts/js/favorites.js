/**
 * Favorites System - Frontend JavaScript
 * Handles adding/removing favorites for newsletters, categories, and creators
 */

class FavoritesManager {
    constructor() {
        // Determine the correct path based on current location
        // If we're in an iframe (pages/), use '../scripts/php/favorites.php'
        // If we're in main document (index.php), use 'scripts/php/favorites.php'
        const isInIframe = window.self !== window.top;
        this.apiEndpoint = isInIframe ? '../scripts/php/favorites.php' : 'scripts/php/favorites.php';
    }

    /**
     * Toggle favorite status
     * @param {string} type - 'newsletter', 'category', or 'creator'
     * @param {number} itemId - The ID of the item
     * @returns {Promise}
     */
    async toggle(type, itemId) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'toggle',
                    type: type,
                    item_id: itemId
                })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error toggling favorite:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Add item to favorites
     * @param {string} type - 'newsletter', 'category', or 'creator'
     * @param {number} itemId - The ID of the item
     * @returns {Promise}
     */
    async add(type, itemId) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'add',
                    type: type,
                    item_id: itemId
                })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error adding favorite:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Remove item from favorites
     * @param {string} type - 'newsletter', 'category', or 'creator'
     * @param {number} itemId - The ID of the item
     * @returns {Promise}
     */
    async remove(type, itemId) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'remove',
                    type: type,
                    item_id: itemId
                })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error removing favorite:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if item is favorited
     * @param {string} type - 'newsletter', 'category', or 'creator'
     * @param {number} itemId - The ID of the item
     * @returns {Promise}
     */
    async check(type, itemId) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'check',
                    type: type,
                    item_id: itemId
                })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error checking favorite:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all favorites of a specific type
     * @param {string} type - 'newsletter', 'category', or 'creator'
     * @returns {Promise}
     */
    async getAll(type) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'get_all',
                    type: type
                })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error getting favorites:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get count of favorites
     * @param {string} type - 'newsletter', 'category', or 'creator'
     * @returns {Promise}
     */
    async getCount(type) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'count',
                    type: type
                })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error getting count:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update favorite button UI
     * @param {HTMLElement} button - The button element
     * @param {boolean} isFavorited - Whether the item is favorited
     */
    updateButtonUI(button, isFavorited) {
        const icon = button.querySelector('i');
        
        if (isFavorited) {
            icon.classList.remove('far');
            icon.classList.add('fas');
            button.classList.add('favorited');
            button.setAttribute('title', 'Remove from favorites');
            button.setAttribute('aria-label', 'Remove from favorites');
        } else {
            icon.classList.remove('fas');
            icon.classList.add('far');
            button.classList.remove('favorited');
            button.setAttribute('title', 'Add to favorites');
            button.setAttribute('aria-label', 'Add to favorites');
        }
    }

    /**
     * Initialize favorite buttons on the page
     */
    initializeButtons() {
        const buttons = document.querySelectorAll('[data-favorite-btn]');
        
        buttons.forEach(async (button) => {
            const type = button.getAttribute('data-favorite-type');
            const itemId = parseInt(button.getAttribute('data-favorite-id'));
            
            // Check current favorite status
            const result = await this.check(type, itemId);
            if (result.success) {
                this.updateButtonUI(button, result.favorited);
            }
            
            // Add click handler
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Toggle favorite
                const toggleResult = await this.toggle(type, itemId);
                
                if (toggleResult.success) {
                    this.updateButtonUI(button, toggleResult.favorited);
                    
                    // Update favorite counts on the page
                    this.updateFavoriteCounts(type, itemId, toggleResult.favorited);
                    
                    // Show toast notification
                    this.showToast(toggleResult.message, 'success');
                    
                    // Update inbox badge live if item was favorited (added)
                    if (toggleResult.favorited) {
                        // Wait a moment for the notification to be created
                        setTimeout(() => {
                            this.updateInboxBadge();
                        }, 500);
                    }
                } else {
                    this.showToast(toggleResult.error || 'Failed to update favorite', 'error');
                }
            });
        });
    }

    /**
     * Show toast notification
     * @param {string} message - The message to display
     * @param {string} type - 'success' or 'error'
     */
    showToast(message, type = 'success') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `favorite-toast favorite-toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Add to body
        document.body.appendChild(toast);
        
        // Show toast
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Update favorite counts displayed on the page
     * @param {string} type - 'newsletter', 'category', or 'creator'
     * @param {number} itemId - The ID of the item
     * @param {boolean} isFavorited - Whether the item is now favorited
     */
    updateFavoriteCounts(type, itemId, isFavorited) {
        if (type === 'newsletter') {
            // Find all elements displaying favorite count for this newsletter
            const countElements = document.querySelectorAll(`[data-newsletter-fav-count="${itemId}"]`);
            
            countElements.forEach(element => {
                const currentCount = parseInt(element.textContent.trim()) || 0;
                const newCount = isFavorited ? currentCount + 1 : Math.max(0, currentCount - 1);
                
                // Update the text content (the number after the heart icon)
                const textNode = Array.from(element.childNodes).find(node => 
                    node.nodeType === Node.TEXT_NODE && node.textContent.trim()
                );
                
                if (textNode) {
                    textNode.textContent = ` ${newCount}`;
                } else {
                    // Fallback: replace all text content
                    const icon = element.querySelector('i');
                    if (icon) {
                        const iconHTML = icon.outerHTML;
                        element.innerHTML = `${iconHTML} ${newCount}`;
                    }
                }
            });
        }
    }
    async updateInboxBadge() {
        try {
            // Check if we're in the parent window (not iframe)
            const targetWindow = window.parent && window.parent !== window ? window.parent : window;
            const isInIframe = window.self !== window.top;
            const inboxApiPath = isInIframe ? '../scripts/php/inbox_api.php' : 'scripts/php/inbox_api.php';
            
            // Fetch unread inbox count
            const response = await fetch(inboxApiPath, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'get_unread_count'
                })
            });

            const data = await response.json();
            
            if (data.success && typeof data.count !== 'undefined') {
                // Update badges in parent window
                const headerBadge = targetWindow.document.querySelector('.inbox-badge');
                const sidebarBadge = targetWindow.document.querySelector('.sidebar-badge');
                const inboxIcon = targetWindow.document.querySelector('.inbox-icon');
                const dropdownBadge = targetWindow.document.querySelector('.inbox-header .badge');
                
                if (data.count > 0) {
                    // Show header badge with count
                    if (headerBadge) {
                        headerBadge.textContent = data.count;
                        headerBadge.style.display = 'flex';
                    } else if (inboxIcon) {
                        // Create header badge if it doesn't exist
                        const newBadge = targetWindow.document.createElement('span');
                        newBadge.className = 'inbox-badge';
                        newBadge.textContent = data.count;
                        inboxIcon.appendChild(newBadge);
                    }
                    
                    // Show sidebar badge with count
                    if (sidebarBadge) {
                        sidebarBadge.textContent = data.count;
                        sidebarBadge.style.display = 'flex';
                    }
                    
                    if (dropdownBadge) {
                        dropdownBadge.textContent = `${data.count} unread`;
                    }
                } else {
                    // Hide badges if no unread messages
                    if (headerBadge) {
                        headerBadge.style.display = 'none';
                    }
                    
                    if (sidebarBadge) {
                        sidebarBadge.style.display = 'none';
                    }
                    
                    if (dropdownBadge) {
                        dropdownBadge.textContent = '0 unread';
                    }
                }
                
                // Refresh inbox dropdown content
                this.refreshInboxDropdown(targetWindow);
            }
        } catch (error) {
            console.error('Error updating inbox badge:', error);
        }
    }

    /**
     * Refresh inbox dropdown messages
     * @param {Window} targetWindow - The window to update (parent or current)
     */
    async refreshInboxDropdown(targetWindow = window) {
        try {
            const isInIframe = window.self !== window.top;
            const inboxApiPath = isInIframe ? '../scripts/php/inbox_api.php' : 'scripts/php/inbox_api.php';
            const response = await fetch(inboxApiPath, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'get_recent_messages',
                    limit: 5
                })
            });

            const data = await response.json();
            
            if (data.success && data.messages) {
                const inboxItems = targetWindow.document.querySelector('.inbox-items');
                
                if (inboxItems) {
                    if (data.messages.length > 0) {
                        // Build inbox items HTML
                        let html = '';
                        data.messages.forEach(item => {
                            const date = new Date(item.date);
                            const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            const snippet = item.snippet ? item.snippet.substring(0, 50) + '...' : '';
                            
                            html += `
                                <a href="#" class="inbox-item" data-page="pages/inbox_view.php" data-message-id="${item.message_ID}">
                                    <div class="inbox-item-content">
                                        <strong>${item.subject || 'Notification'}</strong>
                                        <p class="mb-0">${snippet}</p>
                                        <small class="text-muted">${formattedDate}</small>
                                    </div>
                                </a>
                            `;
                        });
                        inboxItems.innerHTML = html;
                    } else {
                        // Show empty state
                        inboxItems.innerHTML = `
                            <div class="inbox-empty">
                                <i class="fas fa-inbox fa-2x mb-2"></i>
                                <p class="mb-0">No new messages</p>
                            </div>
                        `;
                    }
                }
            }
        } catch (error) {
            console.error('Error refreshing inbox dropdown:', error);
        }
    }
}

// Initialize favorites manager
const favoritesManager = new FavoritesManager();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        favoritesManager.initializeButtons();
    });
} else {
    favoritesManager.initializeButtons();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FavoritesManager;
}
