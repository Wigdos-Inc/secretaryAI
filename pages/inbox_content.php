<?php
// Get filter from query parameter (default: all)
$currentFilter = isset($filter) ? $filter : 'all';

// Validate filter
$validFilters = ['all', 'unread', 'read', 'archived'];
if (!in_array($currentFilter, $validFilters)) {
    $currentFilter = 'all';
}

// Get inbox messages
$messages = getInboxMessages($pdo, $userID, $currentFilter);

// Get counts for each status
$allCount = getInboxCount($pdo, $userID, 'all');
$unreadCount = getInboxCount($pdo, $userID, 'unread');
$readCount = getInboxCount($pdo, $userID, 'read');
$archivedCount = getInboxCount($pdo, $userID, 'archived');
?>

<div class="admin-actions-section" style="padding-top: 1rem; padding-left: 0.5rem;">
    <div class="d-flex gap-2 mb-3">
        <button class="btn btn-primary" onclick="location.reload()">
            <i class="fas fa-sync-alt me-1"></i>Refresh
        </button>
        <button class="btn btn-secondary" id="selectAllBtn" onclick="selectAllMessages()">
            <i class="fas fa-check-square me-1"></i>Select All
        </button>
        <button class="btn btn-success" onclick="bulkMarkRead()" disabled id="bulkReadBtn">
            <i class="fas fa-envelope-open me-1"></i>Mark Read
        </button>
        <button class="btn btn-warning" onclick="bulkArchive()" disabled id="bulkArchiveBtn">
            <i class="fas fa-archive me-1"></i>Archive
        </button>
        <button class="btn btn-danger" onclick="bulkDelete()" disabled id="bulkDeleteBtn">
            <i class="fas fa-trash me-1"></i>Delete
        </button>
    </div>
</div>

<div class="messages-container">
    <?php if (empty($messages)): ?>
        <div class="empty-state">
            <i class="fas fa-inbox fa-3x mb-3"></i>
            <h4>No <?php echo $currentFilter === 'all' ? '' : ucfirst($currentFilter); ?> Messages</h4>
            <p><?php echo $currentFilter === 'all' ? 'Your inbox is empty.' : 'No ' . $currentFilter . ' messages found.'; ?></p>
        </div>
    <?php else: ?>
        <?php foreach ($messages as $message): ?>
            <div class="message-card <?php echo htmlspecialchars($message['status'] ?? ''); ?>" data-message-id="<?php echo $message['message_ID']; ?>" onclick="selectMessageCard(this)">
                <div class="message-header">
                    <input type="checkbox" class="message-checkbox" onchange="updateBulkActions(); event.stopPropagation();" onclick="event.stopPropagation();">
                    <h4 class="message-subject"><?php echo htmlspecialchars($message['subject'] ?? ''); ?></h4>
                    <div class="message-actions">
                        <?php if ($message['status'] === 'unread'): ?>
                            <button class="message-action-btn" onclick="markAsRead(<?php echo $message['message_ID']; ?>); event.stopPropagation();" title="Mark as read">
                                <i class="fas fa-envelope-open"></i>
                            </button>
                        <?php else: ?>
                            <button class="message-action-btn" onclick="markAsUnread(<?php echo $message['message_ID']; ?>); event.stopPropagation();" title="Mark as unread">
                                <i class="fas fa-envelope"></i>
                            </button>
                        <?php endif; ?>
                        <?php if ($message['status'] !== 'archived'): ?>
                            <button class="message-action-btn" onclick="archiveMessage(<?php echo $message['message_ID']; ?>); event.stopPropagation();" title="Archive">
                                <i class="fas fa-archive"></i>
                            </button>
                        <?php endif; ?>
                        <button class="message-action-btn delete-btn" onclick="deleteMessage(<?php echo $message['message_ID']; ?>); event.stopPropagation();" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="message-content">
                    <p><?php echo nl2br(htmlspecialchars($message['snippet'] ?? '')); ?></p>
                </div>
                <div class="message-footer">
                    <small class="message-date">
                        <i class="far fa-calendar-alt me-1"></i>
                        <?php echo date('M j, Y g:i A', strtotime($message['date'] ?? 'now')); ?>
                    </small>
                    <?php if (!empty($message['newsletter_ID'])): ?>
                        <button class="btn btn-primary btn-sm read-newsletter-btn" onclick="readNewsletter(<?php echo $message['newsletter_ID']; ?>); event.stopPropagation();" title="Read Newsletter">
                            <i class="fas fa-external-link-alt me-1"></i>Read Newsletter
                        </button>
                    <?php endif; ?>
                </div>
            </div>
        <?php endforeach; ?>
    <?php endif; ?>
</div>