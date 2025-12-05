// Inbox Actions and Auto-refresh System

// Track selected messages
let selectedMessages = new Set();

// Toggle select all
function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.message-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = !allChecked;
    });
    
    updateBulkActions();
}

// Update bulk action buttons state
function updateBulkActions() {
    const checkboxes = document.querySelectorAll('.message-checkbox:checked');
    const count = checkboxes.length;
    
    document.getElementById('bulkMarkReadBtn').disabled = count === 0;
    document.getElementById('bulkArchiveBtn').disabled = count === 0;
    document.getElementById('bulkDeleteBtn').disabled = count === 0;
    
    // Update select all button text
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (count > 0) {
        selectAllBtn.innerHTML = '<i class="fas fa-times-circle"></i> Deselect All';
    } else {
        selectAllBtn.innerHTML = '<i class="fas fa-check-square"></i> Select All';
    }
}

// Get selected message IDs
function getSelectedMessageIDs() {
    const checkboxes = document.querySelectorAll('.message-checkbox:checked');
    return Array.from(checkboxes).map(cb => {
        return parseInt(cb.closest('.message-card').dataset.messageId);
    });
}

// Mark single message as read
function markAsRead(messageID) {
    sendAction('markRead', messageID, () => {
        location.reload();
    });
}

// Mark single message as unread
function markAsUnread(messageID) {
    sendAction('markUnread', messageID, () => {
        location.reload();
    });
}

// Archive single message
function archiveMessage(messageID) {
    if (confirm('Archive this message?')) {
        sendAction('archive', messageID, () => {
            location.reload();
        });
    }
}

// Delete single message
function deleteMessage(messageID) {
    if (confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
        sendAction('delete', messageID, () => {
            location.reload();
        });
    }
}

// Bulk mark as read
function bulkMarkRead() {
    const messageIDs = getSelectedMessageIDs();
    if (messageIDs.length === 0) return;
    
    sendBulkAction('bulkUpdate', messageIDs, 'read', () => {
        location.reload();
    });
}

// Bulk archive
function bulkArchive() {
    const messageIDs = getSelectedMessageIDs();
    if (messageIDs.length === 0) return;
    
    if (confirm(`Archive ${messageIDs.length} message(s)?`)) {
        sendBulkAction('bulkUpdate', messageIDs, 'archived', () => {
            location.reload();
        });
    }
}

// Bulk delete
function bulkDelete() {
    const messageIDs = getSelectedMessageIDs();
    if (messageIDs.length === 0) return;
    
    if (confirm(`Are you sure you want to delete ${messageIDs.length} message(s)? This action cannot be undone.`)) {
        sendBulkAction('bulkDelete', messageIDs, null, () => {
            location.reload();
        });
    }
}

// Send single action to server
function sendAction(action, messageID, callback) {
    fetch('../scripts/db/inbox.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=${action}&messageID=${messageID}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            callback();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred. Please try again.');
    });
}

// Send bulk action to server
function sendBulkAction(action, messageIDs, status, callback) {
    const formData = new URLSearchParams();
    formData.append('action', action);
    formData.append('messageIDs', JSON.stringify(messageIDs));
    if (status) {
        formData.append('status', status);
    }
    
    fetch('../scripts/db/inbox.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            callback();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred. Please try again.');
    });
}

// Auto-refresh inbox every 30 seconds to check for new messages
let autoRefreshInterval;

function startAutoRefresh() {
    // Clear any existing interval
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // Refresh every 30 seconds
    autoRefreshInterval = setInterval(() => {
        checkForNewMessages();
    }, 30000);
}

function checkForNewMessages() {
    const currentFilter = new URLSearchParams(window.location.search).get('filter') || 'all';
    
    fetch('../scripts/php/inbox_api.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'get_all_messages',
            status: currentFilter,
            limit: 50,
            offset: 0
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update counts in filter badges
            updateFilterBadges(data.counts);
            
            // Update the parent window's inbox badge
            updateParentInboxBadge(data.counts.unread);
            
            // If there are new messages, show a notification
            const currentMessageCount = document.querySelectorAll('.message-card').length;
            if (data.messages.length > currentMessageCount) {
                showNewMessageNotification();
            }
        }
    })
    .catch(error => {
        console.error('Error checking for new messages:', error);
    });
}

function updateFilterBadges(counts) {
    const filterBadges = {
        'all': counts.all,
        'unread': counts.unread,
        'read': counts.read,
        'archived': counts.archived
    };
    
    Object.keys(filterBadges).forEach(filter => {
        const badge = document.querySelector(`a[href="?filter=${filter}"] .filter-badge`);
        if (badge) {
            badge.textContent = filterBadges[filter];
        }
    });
}

function updateParentInboxBadge(unreadCount) {
    try {
        const parentWindow = window.parent && window.parent !== window ? window.parent : null;
        
        if (parentWindow) {
            const headerBadge = parentWindow.document.querySelector('.inbox-badge');
            const sidebarBadge = parentWindow.document.querySelector('.sidebar-badge');
            const dropdownBadge = parentWindow.document.querySelector('.inbox-header .badge');
            
            if (unreadCount > 0) {
                if (headerBadge) {
                    headerBadge.textContent = unreadCount;
                    headerBadge.style.display = 'flex';
                }
                if (sidebarBadge) {
                    sidebarBadge.textContent = unreadCount;
                    sidebarBadge.style.display = 'flex';
                }
                if (dropdownBadge) {
                    dropdownBadge.textContent = `${unreadCount} unread`;
                }
            } else {
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
        }
    } catch (error) {
        // Ignore cross-origin errors
        console.log('Cannot update parent inbox badge (cross-origin)');
    }
}

function showNewMessageNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #3498db;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `
        <i class="fas fa-envelope"></i>
        <strong>New Message!</strong>
        <button onclick="location.reload()" style="margin-left: 10px; background: white; color: #3498db; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
            Refresh
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Start auto-refresh when page loads
startAutoRefresh();

// Stop auto-refresh when page is hidden/closed
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
    } else {
        startAutoRefresh();
        checkForNewMessages(); // Check immediately when page becomes visible
    }
});
