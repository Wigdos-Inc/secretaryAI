<?php
/**
 * Inbox Page - User Inbox Messages View
 */

// Include inbox functions
require_once '../scripts/db/inbox.php';
require_once '../scripts/db/data.php';

// Check if user is logged in
if (!isset($userID) || !$userID) {
    header('location: login_view.php');
    exit;
}

// Get filter from query parameter (default: all)
$filter = isset($_GET['filter']) ? $_GET['filter'] : 'all';

// Validate filter
$validFilters = ['all', 'unread', 'read', 'archived'];
if (!in_array($filter, $validFilters)) {
    $filter = 'all';
}

// Get inbox messages
$messages = getInboxMessages($pdo, $userID, $filter);

// Get counts for each status
$allCount = getInboxCount($pdo, $userID, 'all');
$unreadCount = getInboxCount($pdo, $userID, 'unread');
$readCount = getInboxCount($pdo, $userID, 'read');
$archivedCount = getInboxCount($pdo, $userID, 'archived');
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="../bootstrap-5.3.6-dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../styling/main.css">
    <link rel="stylesheet" href="../styling/profile.css">
    <link rel="stylesheet" href="../styling/adminPanel.css">
    <link rel="stylesheet" href="../styling/inbox.css">
    <link rel="stylesheet" href="../styling/animations.css">
    <title>Inbox - Newswire AI</title>
</head>
<body>
<div class="admin-wrapper">
    <div class="d-flex flex-column flex-md-row gap-3">
        <div class="admin-sidebar">
            <nav class="admin-nav">
                <a id="btn_tab_all" class="admin-nav-link active">
                    <i class="fas fa-inbox me-2"></i>
                    <span>All</span>
                </a>
                <a id="btn_tab_unread" class="admin-nav-link">
                    <i class="fas fa-envelope me-2"></i>
                    <span>Unread</span>
                    <?php if ($unreadCount > 0): ?>
                        <span class="sidebar-badge"><?php echo $unreadCount; ?></span>
                    <?php endif; ?>
                </a>
                <a id="btn_tab_read" class="admin-nav-link">
                    <i class="fas fa-envelope-open me-2"></i>
                    <span>Read</span>
                </a>
                <a id="btn_tab_archived" class="admin-nav-link">
                    <i class="fas fa-archive me-2"></i>
                    <span>Archived</span>
                </a>
            </nav>
        </div>
        <div id="profile_tabs" class="admin-content-wrapper">
            <div id="tab_all" class="list-unstyled admin-tab-content" style="display: block;">
                <div class="admin-tab-header">
                    <h2>All Messages</h2>
                    <p style="color: var(--text-secondary)">View all your inbox messages</p>
                </div>
                <div class="admin-content-container">
                    <?php $filter = 'all'; include 'inbox_content.php'; ?>
                </div>
            </div>

            <div id="tab_unread" class="list-unstyled admin-tab-content" style="display: none;">
                <div class="admin-tab-header">
                    <h2>Unread Messages</h2>
                    <p style="color: var(--text-secondary)">Messages you haven't read yet</p>
                </div>
                <div class="admin-content-container">
                    <?php $filter = 'unread'; include 'inbox_content.php'; ?>
                </div>
            </div>

            <div id="tab_read" class="list-unstyled admin-tab-content" style="display: none;">
                <div class="admin-tab-header">
                    <h2>Read Messages</h2>
                    <p style="color: var(--text-secondary)">Messages you've already read</p>
                </div>
                <div class="admin-content-container">
                    <?php $filter = 'read'; include 'inbox_content.php'; ?>
                </div>
            </div>

            <div id="tab_archived" class="list-unstyled admin-tab-content" style="display: none;">
                <div class="admin-tab-header">
                    <h2>Archived Messages</h2>
                    <p style="color: var(--text-secondary)">Messages you've archived</p>
                </div>
                <div class="admin-content-container">
                    <?php $filter = 'archived'; include 'inbox_content.php'; ?>
                </div>
            </div>
        </div>
    </div>
</div>

<script src="../bootstrap-5.3.6-dist/js/bootstrap.bundle.min.js"></script>
<script src="../scripts/js/theme.js"></script>
<script>
    // Override the tab switching for inbox
    function swapTab(tabID){
        // Update URL hash
        window.location.hash = tabID.replace('tab_', '');
        
        // Hide all tabs and show the selected one
        const tabs = document.querySelectorAll('#profile_tabs > div');
        tabs.forEach(tab => {
            if(tab.id === tabID){
                tab.style.display = 'block';
            } else {
                tab.style.display = 'none';
            }
        });
        
        // Update active state on navigation links
        document.querySelectorAll('.admin-nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Find and activate the corresponding button
        const activeButton = document.getElementById('btn_' + tabID);
        if(activeButton){
            activeButton.classList.add('active');
        }

        // Update bulk action buttons after tab switch
        setTimeout(() => {
            updateBulkActions();
        }, 10);
    }

    // Handle hash changes
    function handleHashChange() {
        const hash = window.location.hash.substring(1); // Remove #
        if (hash === 'unread') {
            swapTab('tab_unread');
        } else if (hash === 'read') {
            swapTab('tab_read');
        } else if (hash === 'archived') {
            swapTab('tab_archived');
        } else {
            swapTab('tab_all');
        }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        handleHashChange();
        
        // Initialize button states after tab content is loaded
        setTimeout(() => {
            updateBulkActions();
        }, 50);
        
        // Add event listeners
        document.getElementById('btn_tab_all').addEventListener('click', (e) => {
            e.preventDefault();
            swapTab('tab_all');
        });
        document.getElementById('btn_tab_unread').addEventListener('click', (e) => {
            e.preventDefault();
            swapTab('tab_unread');
        });
        document.getElementById('btn_tab_read').addEventListener('click', (e) => {
            e.preventDefault();
            swapTab('tab_read');
        });
        document.getElementById('btn_tab_archived').addEventListener('click', (e) => {
            e.preventDefault();
            swapTab('tab_archived');
        });

        // Listen for hash changes
        window.addEventListener('hashchange', handleHashChange);
    });

    // Get the currently active tab
    function getActiveTab() {
        return document.querySelector('#profile_tabs > div[style*="display: block"]');
    }

    // Inbox functions
    function selectAllMessages() {
        const activeTab = getActiveTab();
        if (!activeTab) return;
        const checkboxes = activeTab.querySelectorAll('.message-checkbox');
        checkboxes.forEach(cb => cb.checked = true);
        updateBulkActions();
    }

    function unselectAllMessages() {
        const activeTab = getActiveTab();
        if (!activeTab) return;
        const checkboxes = activeTab.querySelectorAll('.message-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
        updateBulkActions();
    }

    function selectMessageCard(cardElement) {
        const checkbox = cardElement.querySelector('.message-checkbox');
        checkbox.checked = !checkbox.checked;
        updateBulkActions();
    }

    function readNewsletter(newsletterId) {
        if (newsletterId && newsletterId !== 'null') {
            // Use the existing popup system
            if (window.parent && window.parent.popupSystem) {
                window.parent.popupSystem.newsPopup(newsletterId);
            } else {
                alert('Newsletter popup system not available');
            }
        } else {
            alert('Newsletter not available');
        }
    }

    function updateBulkActions() {
        const activeTab = getActiveTab();
        if (!activeTab) return;
        
        const allCheckboxes = activeTab.querySelectorAll('.message-checkbox');
        const checkedBoxes = activeTab.querySelectorAll('.message-checkbox:checked');
        const hasSelection = checkedBoxes.length > 0;
        const allSelected = allCheckboxes.length > 0 && checkedBoxes.length === allCheckboxes.length;
        
        // Update Select All/Unselect All button
        const selectBtn = activeTab.querySelector('#selectAllBtn');
        if (selectBtn) {
            if (allSelected) {
                selectBtn.innerHTML = '<i class="fas fa-times me-1"></i>Unselect All';
                selectBtn.onclick = unselectAllMessages;
            } else {
                selectBtn.innerHTML = '<i class="fas fa-check-square me-1"></i>Select All';
                selectBtn.onclick = selectAllMessages;
            }
        }
        
        if (!hasSelection) {
            // No selection - disable action buttons
            const readBtn = activeTab.querySelector('#bulkReadBtn');
            const archiveBtn = activeTab.querySelector('#bulkArchiveBtn');
            const deleteBtn = activeTab.querySelector('#bulkDeleteBtn');
            if (readBtn) readBtn.disabled = true;
            if (archiveBtn) archiveBtn.disabled = true;
            if (deleteBtn) deleteBtn.disabled = true;
            return;
        }

        // Analyze selected messages
        let readCount = 0;
        let unreadCount = 0;
        let archivedCount = 0;
        let notArchivedCount = 0;

        checkedBoxes.forEach(cb => {
            const card = cb.closest('.message-card');
            const status = card.classList.contains('read') ? 'read' : 
                          card.classList.contains('archived') ? 'archived' : 'unread';
            
            if (status === 'read') readCount++;
            else if (status === 'unread') unreadCount++;
            else if (status === 'archived') archivedCount++;
            
            if (status !== 'archived') notArchivedCount++;
        });

        // Update Read/Unread button
        const readBtn = activeTab.querySelector('#bulkReadBtn');
        if (readBtn) {
            if (unreadCount > readCount) {
                // Most are unread - show "Mark as Read"
                readBtn.innerHTML = '<i class="fas fa-envelope-open me-1"></i>Mark Read';
                readBtn.onclick = bulkMarkRead;
            } else {
                // Most are read - show "Mark as Unread"
                readBtn.innerHTML = '<i class="fas fa-envelope me-1"></i>Mark Unread';
                readBtn.onclick = bulkMarkUnread;
            }
            readBtn.disabled = false;
        }

        // Update Archive/Unarchive button
        const archiveBtn = activeTab.querySelector('#bulkArchiveBtn');
        if (archiveBtn) {
            if (notArchivedCount > archivedCount) {
                // Most are not archived - show "Archive"
                archiveBtn.innerHTML = '<i class="fas fa-archive me-1"></i>Archive';
                archiveBtn.onclick = bulkArchive;
            } else {
                // Most are archived - show "Unarchive"
                archiveBtn.innerHTML = '<i class="fas fa-undo me-1"></i>Unarchive';
                archiveBtn.onclick = bulkUnarchive;
            }
            archiveBtn.disabled = false;
        }

        // Delete button always enabled when selection exists
        const deleteBtn = activeTab.querySelector('#bulkDeleteBtn');
        if (deleteBtn) deleteBtn.disabled = false;
    }

    function bulkMarkRead() {
        const activeTab = getActiveTab();
        if (!activeTab) return;
        const checkedBoxes = activeTab.querySelectorAll('.message-checkbox:checked');
        checkedBoxes.forEach(cb => {
            markAsRead(cb.closest('.message-card').dataset.messageId);
        });
    }

    function bulkMarkUnread() {
        const activeTab = getActiveTab();
        if (!activeTab) return;
        const checkedBoxes = activeTab.querySelectorAll('.message-checkbox:checked');
        checkedBoxes.forEach(cb => {
            markAsUnread(cb.closest('.message-card').dataset.messageId);
        });
    }

    function bulkArchive() {
        const activeTab = getActiveTab();
        if (!activeTab) return;
        const checkedBoxes = activeTab.querySelectorAll('.message-checkbox:checked');
        checkedBoxes.forEach(cb => {
            archiveMessage(cb.closest('.message-card').dataset.messageId);
        });
    }

    function bulkUnarchive() {
        const activeTab = getActiveTab();
        if (!activeTab) return;
        const checkedBoxes = activeTab.querySelectorAll('.message-checkbox:checked');
        checkedBoxes.forEach(cb => {
            unarchiveMessage(cb.closest('.message-card').dataset.messageId);
        });
    }

    function bulkDelete() {
        const activeTab = getActiveTab();
        if (!activeTab) return;
        const checkedBoxes = activeTab.querySelectorAll('.message-checkbox:checked');
        
        if (confirm(`Are you sure you want to delete ${checkedBoxes.length} selected message(s)?`)) {
            checkedBoxes.forEach(cb => {
                deleteMessage(cb.closest('.message-card').dataset.messageId, true);
            });
        }
    }

    function markAsRead(messageId) {
        fetch('../scripts/php/inbox_api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_read', message_id: messageId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            }
        });
    }

    function markAsUnread(messageId) {
        fetch('../scripts/php/inbox_api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_unread', message_id: messageId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            }
        });
    }

    function archiveMessage(messageId) {
        fetch('../scripts/php/inbox_api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'archive', message_id: messageId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            }
        });
    }

    function unarchiveMessage(messageId) {
        fetch('../scripts/php/inbox_api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'unarchive', message_id: messageId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            }
        });
    }

    function deleteMessage(messageId, skipConfirm = false) {
        if (!skipConfirm && !confirm('Are you sure you want to delete this message?')) {
            return;
        }
        
        fetch('../scripts/php/inbox_api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', message_id: messageId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            }
        });
    }

    // Initialize data in parent window's popup system
    if (window.parent && window.parent.popupSystem) {
        window.parent.popupSystem.initData(
            <?= json_encode($newsletters) ?>,
            <?= json_encode($categories) ?>,
            <?= json_encode($users) ?>,
            <?= isset($_COOKIE['userID']) ? intval($_COOKIE['userID']) : 'null' ?>
        );
    }
</script>
</body>
</html>
