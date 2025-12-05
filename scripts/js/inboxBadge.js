// Inbox Badge and Dropdown Auto-Update System
// This file is only loaded when user is logged in

function updateInboxBadge() {
  fetch('scripts/php/inbox_api.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      action: 'get_unread_count'
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success && typeof data.count !== 'undefined') {
      const headerBadge = document.querySelector('.inbox-badge');
      const sidebarBadge = document.querySelector('.sidebar-badge');
      const dropdownBadge = document.querySelector('.inbox-header .badge');
      const inboxIcon = document.querySelector('.inbox-icon');
      
      if (data.count > 0) {
        // Show header badge with count
        if (headerBadge) {
          headerBadge.textContent = data.count;
          headerBadge.style.display = 'flex';
        } else if (inboxIcon) {
          // Create header badge if it doesn't exist
          const newBadge = document.createElement('span');
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
          dropdownBadge.textContent = data.count + ' unread';
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
      
      // Also refresh inbox dropdown
      updateInboxDropdown();
    }
  })
  .catch(error => {
    console.error('Error updating inbox badge:', error);
  });
}

function updateInboxDropdown() {
  fetch('scripts/php/inbox_api.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      action: 'get_recent_messages',
      limit: 5
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success && data.messages) {
      const inboxItems = document.querySelector('.inbox-items');
      
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
          
          // Attach click event listeners to the newly created inbox items
          const newInboxItems = inboxItems.querySelectorAll('.inbox-item');
          newInboxItems.forEach(item => {
            item.addEventListener('click', (e) => {
              e.preventDefault();
              const page = item.getAttribute('data-page');
              if (page && window.loadPage) {
                window.loadPage(page);
              }
            });
          });
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
  })
  .catch(error => {
    console.error('Error updating inbox dropdown:', error);
  });
}

// Update inbox badge every 5 seconds
setInterval(updateInboxBadge, 5000);

// Update immediately on page load
setTimeout(updateInboxBadge, 1000);
