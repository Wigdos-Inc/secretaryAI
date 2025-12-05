// Admin Panel - Newsletter Generator & Management
// This file contains all the admin panel functionality for managing newsletters, categories, and users

let currentNewsletterID = null;
let currentNewsletterContent = null;
let currentNewsletterStatus = 'draft'; // Track newsletter status

// ========================================
// Helper Functions
// ========================================

// Get current active tab
function getCurrentTab() {
    const activeLink = document.querySelector('.admin-nav-link.active');
    if (activeLink) {
        const tabID = activeLink.id.replace('btn_', '');
        return tabID;
    }
    return null;
}

// Store current tab before reload
function storeCurrentTab() {
    const currentTab = getCurrentTab();
    if (currentTab) {
        sessionStorage.setItem('activeAdminTab', currentTab);
    }
}

// Edit newsletter function for row clicks
function editNewsletter(newsletterID) {
    try {
        // Fetch newsletter data
        fetch('../scripts/php/newsletters.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'fetch_single',
                newsletter_ID: newsletterID
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.newsletter) {
                // Switch to generator tab
                swapTab('tab_generator');
                
                // Load newsletter data into editor
                currentNewsletterID = newsletterID;
                currentNewsletterStatus = data.newsletter.status; // Set the status from fetched data
                document.getElementById('admin-newsletter-title').value = data.newsletter.title;
                document.getElementById('admin-newsletter-editor').innerHTML = data.newsletter.content;
                
                // Show edit mode
                document.getElementById('generate-mode').style.display = 'none';
                document.getElementById('admin-edit-mode').style.display = 'block';
                
                // Load and select categories
                loadCategories().then(() => {
                    if (data.categories && data.categories.length > 0) {
                        const select = document.getElementById('admin-category-select');
                        Array.from(select.options).forEach(option => {
                            if (data.categories.includes(parseInt(option.value))) {
                                option.selected = true;
                            }
                        });
                    }
                });
                
                updateButtonVisibility(); // Update button display based on status
            } else {
                alert('Error: ' + (data.error || 'Failed to load newsletter'));
            }
        })
        .catch(err => {
            console.error('Edit error:', err);
            alert('Failed to load newsletter for editing');
        });
    } catch (err) {
        console.error('Edit error:', err);
        alert('Failed to load newsletter for editing');
    }
}
function updateButtonVisibility() {
    const publishBtn = document.getElementById('admin-publish-btn');
    const unpublishBtn = document.getElementById('admin-unpublish-btn');
    const hideBtn = document.getElementById('admin-hide-btn');
    const unhideBtn = document.getElementById('admin-unhide-btn');
    
    if (!publishBtn || !unpublishBtn || !hideBtn || !unhideBtn) {
        console.error('Button elements not found');
        return;
    }
    
    // Reset all buttons to visible
    publishBtn.classList.remove('btn-hidden');
    publishBtn.classList.add('btn-visible');
    unpublishBtn.classList.remove('btn-hidden');
    unpublishBtn.classList.add('btn-visible');
    hideBtn.classList.remove('btn-hidden');
    hideBtn.classList.add('btn-visible');
    unhideBtn.classList.remove('btn-hidden');
    unhideBtn.classList.add('btn-visible');
    
    if (currentNewsletterStatus === 'published') {
        publishBtn.classList.add('btn-hidden');
        publishBtn.classList.remove('btn-visible');
        // unpublishBtn stays visible
        // hideBtn stays visible
        unhideBtn.classList.add('btn-hidden');
        unhideBtn.classList.remove('btn-visible');
    } else if (currentNewsletterStatus === 'hidden') {
        // publishBtn stays visible
        unpublishBtn.classList.add('btn-hidden');
        unpublishBtn.classList.remove('btn-visible');
        hideBtn.classList.add('btn-hidden');
        hideBtn.classList.remove('btn-visible');
        // unhideBtn stays visible
    } else {
        // draft status - default
        // publishBtn stays visible
        unpublishBtn.classList.add('btn-hidden');
        unpublishBtn.classList.remove('btn-visible');
        // hideBtn stays visible
        unhideBtn.classList.add('btn-hidden');
        unhideBtn.classList.remove('btn-visible');
    }
}

// Load Categories Function
async function loadCategories() {
    try {
        const response = await fetch('../scripts/php/categories.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'fetch' })
        });

        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('admin-category-select');
            if (select) {
                select.innerHTML = '';
                
                data.categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.category_ID;
                    option.textContent = cat.name;
                    select.appendChild(option);
                });
            }
        }
    } catch (err) {
        console.error('Load categories error:', err);
    }
}

// Save Newsletter Function
async function saveNewsletter(status) {
    const title = document.getElementById('admin-newsletter-title').value.trim();
    const content = document.getElementById('admin-newsletter-editor').innerHTML;
    const categorySelect = document.getElementById('admin-category-select');
    const selectedCategories = Array.from(categorySelect.selectedOptions).map(opt => parseInt(opt.value));

    if (!title) {
        showError('Please enter a title');
        return;
    }

    const loading = document.getElementById('admin-loading');
    const editMode = document.getElementById('admin-edit-mode');
    
    editMode.style.display = 'none';
    loading.style.display = 'block';
    loading.querySelector('p').textContent = status === 'published' ? 'Publishing...' : 'Saving...';

    try {
        const response = await fetch('../scripts/php/newsletters.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: currentNewsletterID ? 'update' : 'save',
                newsletter_ID: currentNewsletterID,
                title: title,
                content: content,
                status: status,
                category_ids: selectedCategories
            })
        });

        const data = await response.json();
        
        if (data.success) {
            currentNewsletterID = data.newsletter_ID;
            currentNewsletterStatus = status; // Update status
            
            updateButtonVisibility(); // Update button display
            loading.style.display = 'none';
            editMode.style.display = 'block';
            showSuccess(status === 'published' ? 'Newsletter published successfully!' : 'Newsletter saved successfully!');
            
            // Refresh newsletter list if published
            if (status === 'published') {
                refreshNewsletterList();
            }
            
        } else {
            throw new Error(data.error || 'Failed to save');
        }
    } catch (err) {
        console.error('Save error:', err);
        showError('Failed to save newsletter. Please try again.');
        loading.style.display = 'none';
        editMode.style.display = 'block';
    }
}

// Show Error Function
function showError(message) {
    const errorDiv = document.getElementById('admin-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

// Show Success Function
function showSuccess(message) {
    const successDiv = document.getElementById('admin-success');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 5000);
    }
}

// ========================================
// Newsletter List Refresh Function
// ========================================

async function refreshNewsletterList() {
    try {
        const response = await fetch('../scripts/php/admin_actions.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'fetch_newsletters',
                filter: 'all'
            })
        });

        const data = await response.json();
        
        if (data.success) {
            const tableBody = document.getElementById('newsletters-table-body');
            if (!tableBody) return;
            
            tableBody.innerHTML = '';
            
            data.newsletters.forEach(newsletter => {
                const row = document.createElement('tr');
                row.setAttribute('data-newsletter-id', newsletter.newsletter_ID);
                row.className = 'newsletter-row';
                row.style.cursor = 'pointer';
                
                const statusBadgeClass = newsletter.status === 'published' ? 'success' : 
                                       (newsletter.status === 'hidden' ? 'danger' : 'secondary');
                const statusText = newsletter.status.charAt(0).toUpperCase() + newsletter.status.slice(1);
                const hideBtnClass = newsletter.status === 'hidden' ? 'btn-success' : 'btn-secondary';
                const hideBtnIcon = newsletter.status === 'hidden' ? 'eye' : 'eye-slash';
                const hideBtnText = newsletter.status === 'hidden' ? 'Unhide' : 'Hide';
                
                row.innerHTML = `
                    <td><input type="checkbox" class="newsletter-checkbox" value="${newsletter.newsletter_ID}" onclick="event.stopPropagation();"></td>
                    <td onclick="editNewsletter(${newsletter.newsletter_ID})">${newsletter.title.length > 50 ? newsletter.title.substring(0, 50) + '...' : newsletter.title}</td>
                    <td onclick="editNewsletter(${newsletter.newsletter_ID})">${newsletter.owner_username || 'Unknown'}</td>
                    <td onclick="editNewsletter(${newsletter.newsletter_ID})">
                        <span class="badge bg-${statusBadgeClass}">${statusText}</span>
                    </td>
                    <td onclick="editNewsletter(${newsletter.newsletter_ID})">${new Date(newsletter.creation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td>
                        <button class="btn btn-sm ${hideBtnClass} hide-newsletter-btn" data-id="${newsletter.newsletter_ID}" onclick="event.stopPropagation();">
                            <i class="fas fa-${hideBtnIcon} me-1"></i>${hideBtnText}
                        </button>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
            
            // Re-attach event listeners for the new hide buttons
            attachHideButtonListeners();
        }
    } catch (err) {
        console.error('Refresh newsletter list error:', err);
    }
}

// ========================================
// Attach Hide Button Event Listeners
// ========================================

function attachHideButtonListeners() {
    // Hide newsletter buttons
    document.querySelectorAll('.hide-newsletter-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const newsletterID = this.dataset.id;
            
            try {
                const response = await fetch('../scripts/php/admin_actions.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'toggle_newsletter_visibility',
                        newsletter_id: newsletterID
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    // Refresh the newsletter list to show updated status
                    refreshNewsletterList();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (err) {
                console.error('Hide error:', err);
                alert('Failed to toggle newsletter visibility');
            }
        });
    });
}

// ========================================
// Initialize Admin Panel
// ========================================
document.addEventListener('DOMContentLoaded', function() {

        // Load categories on page load
    loadCategories();
    
    // Attach hide button listeners for initial buttons
    attachHideButtonListeners();

    // Add Generator tab button listener
    document.getElementById('btn_tab_generator')?.addEventListener('click', () => {
        swapTab('tab_generator');
    });

    // Generate Newsletter Button
    document.getElementById('admin-generate-btn')?.addEventListener('click', async function() {
        const query = document.getElementById('admin-newsletter-query').value.trim();
        const loading = document.getElementById('admin-loading');
        const generateMode = document.getElementById('generate-mode');
        const editMode = document.getElementById('admin-edit-mode');
        const error = document.getElementById('admin-error');
        const generateBtn = this;

        if (!query) {
            showError('Please enter a topic for the newsletter');
            return;
        }

        // Show loading
        generateMode.style.display = 'none';
        loading.style.display = 'block';
        error.style.display = 'none';
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Generating...';

        try {
            const response = await fetch('../scripts/php/newsletters.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    query: query,
                    action: 'generate'
                })
            });

            const data = await response.json();
            
            // Handle multiple possible response formats
            const newsletterContent = data.output || data.content || data.html || data.body;
            
            if (newsletterContent || data.success !== false) {
                let finalContent = newsletterContent || JSON.stringify(data);
                currentNewsletterID = null; // Reset for new newsletter
                
                // Extract title from response or content (look for first h1 or h2)
                let title = data.title || '';
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = finalContent;
                
                if (!title) {
                    const heading = tempDiv.querySelector('h1, h2');
                    title = heading ? heading.textContent : 'Untitled Newsletter';
                }
                
                // Remove the title heading from content if it exists
                const firstHeading = tempDiv.querySelector('h1, h2');
                if (firstHeading && firstHeading.textContent.trim() === title.trim()) {
                    firstHeading.remove();
                    finalContent = tempDiv.innerHTML;
                }
                
                currentNewsletterContent = finalContent;
                currentNewsletterStatus = 'draft'; // New newsletters start as draft
                
                // Show edit mode
                document.getElementById('admin-newsletter-title').value = title;
                document.getElementById('admin-newsletter-editor').innerHTML = finalContent;
                
                updateButtonVisibility(); // Set correct button display
                loading.style.display = 'none';
                editMode.style.display = 'block';
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="fas fa-magic me-1"></i>Generate Newsletter';
                
            } else {
                throw new Error(data.error || 'No content generated');
            }
        } catch (err) {
            console.error('Generation error:', err);
            loading.style.display = 'none';
            generateMode.style.display = 'block';
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-magic me-1"></i>Generate Newsletter';
            showError('Failed to generate newsletter: ' + err.message);
        }
    });

    // Add event listeners using event delegation
    document.getElementById('admin-edit-mode')?.addEventListener('click', async function(e) {
        const target = e.target;
        
        // Save Draft Button
        if (target.id === 'admin-save-btn') {
            e.preventDefault();
            await saveNewsletter('draft');
        }
        
        // Publish Button
        else if (target.id === 'admin-publish-btn') {
            e.preventDefault();
            await saveNewsletter('published');
        }
        
        // Unpublish Button
        else if (target.id === 'admin-unpublish-btn') {
            e.preventDefault();
            if (!currentNewsletterID) {
                showError('Please save the newsletter first before unpublishing');
                return;
            }
            
            if (!confirm('Are you sure you want to unpublish this newsletter? It will be changed to draft status.')) return;
            
            const btn = target;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Unpublishing...';
            
            try {
                const response = await fetch('../scripts/php/newsletters.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'unpublish',
                        newsletter_ID: currentNewsletterID
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    currentNewsletterStatus = 'draft';
                    updateButtonVisibility();
                    showSuccess('Newsletter unpublished and changed to draft!');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-undo me-1"></i>Unpublish';
                    // Refresh newsletter list
                    refreshNewsletterList();
                } else {
                    showError(data.error || 'Failed to unpublish newsletter');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-undo me-1"></i>Unpublish';
                }
            } catch (err) {
                console.error('Unpublish error:', err);
                showError('Failed to unpublish newsletter: ' + err.message);
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-undo me-1"></i>Unpublish';
            }
        }
        
        // Unhide Button
        else if (target.id === 'admin-unhide-btn') {
            e.preventDefault();
            if (!currentNewsletterID) {
                showError('Please save the newsletter first before unhiding');
                return;
            }
            
            if (!confirm('Are you sure you want to unhide this newsletter? It will be changed to draft status.')) return;
            
            const btn = target;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Unhiding...';
            
            try {
                const response = await fetch('../scripts/php/newsletters.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'update',
                        newsletter_ID: currentNewsletterID,
                        status: 'draft',
                        title: document.getElementById('admin-newsletter-title').value.trim(),
                        content: document.getElementById('admin-newsletter-editor').innerHTML
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    currentNewsletterStatus = 'draft';
                    updateButtonVisibility();
                    showSuccess('Newsletter unhidden and changed to draft!');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-eye me-1"></i>Unhide';
                    // Refresh newsletter list
                    refreshNewsletterList();
                } else {
                    showError(data.error || 'Failed to unhide newsletter');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-eye me-1"></i>Unhide';
                }
            } catch (err) {
                console.error('Unhide error:', err);
                showError('Failed to unhide newsletter: ' + err.message);
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-eye me-1"></i>Unhide';
            }
        }
        
        // Hide Button
        else if (target.id === 'admin-hide-btn') {
            e.preventDefault();
            if (!currentNewsletterID) {
                showError('Please save the newsletter first before hiding');
                return;
            }
            
            if (!confirm('Are you sure you want to hide this newsletter?')) return;
            
            const btn = target;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Hiding...';
            
            try {
                const response = await fetch('../scripts/php/newsletters.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'update',
                        newsletter_ID: currentNewsletterID,
                        status: 'hidden',
                        title: document.getElementById('admin-newsletter-title').value.trim(),
                        content: document.getElementById('admin-newsletter-editor').innerHTML
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    currentNewsletterStatus = 'hidden';
                    updateButtonVisibility();
                    showSuccess('Newsletter hidden successfully!');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-eye-slash me-1"></i>Hide';
                    // Refresh newsletter list
                    refreshNewsletterList();
                } else {
                    showError(data.error || 'Failed to hide newsletter');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-eye-slash me-1"></i>Hide';
                }
            } catch (err) {
                console.error('Hide error:', err);
                showError('Failed to hide newsletter: ' + err.message);
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-eye-slash me-1"></i>Hide';
            }
        }
        
        // Delete Button
        else if (target.id === 'admin-delete-btn') {
            e.preventDefault();
            
            // If newsletter hasn't been saved yet (no ID), just clear the form and return to generator
            if (!currentNewsletterID) {
                if (!confirm('Are you sure you want to discard this newsletter draft?')) return;
                
                // Reset to generate mode without server call
                document.getElementById('generate-mode').style.display = 'block';
                document.getElementById('admin-edit-mode').style.display = 'none';
                document.getElementById('admin-newsletter-query').value = '';
                document.getElementById('admin-newsletter-title').value = '';
                document.getElementById('admin-newsletter-editor').innerHTML = '';
                currentNewsletterID = null;
                currentNewsletterContent = null;
                currentNewsletterStatus = 'draft';
                showSuccess('Newsletter draft discarded');
                return;
            }
            
            if (!confirm('Are you sure you want to delete this newsletter? This cannot be undone.')) return;
            
            const btn = target;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Deleting...';
            
            try {
                const response = await fetch('../scripts/php/newsletters.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'delete',
                        newsletter_ID: currentNewsletterID
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showSuccess('Newsletter deleted successfully!');
                    // Reset to generate mode
                    setTimeout(() => {
                        document.getElementById('generate-mode').style.display = 'block';
                        document.getElementById('admin-edit-mode').style.display = 'none';
                        document.getElementById('admin-newsletter-query').value = '';
                        document.getElementById('admin-newsletter-title').value = '';
                        document.getElementById('admin-newsletter-editor').innerHTML = '';
                        currentNewsletterID = null;
                        currentNewsletterContent = null;
                        currentNewsletterStatus = 'draft';
                        // Refresh newsletter list
                        refreshNewsletterList();
                    }, 1500);
                } else {
                    showError(data.error || 'Failed to delete newsletter');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-trash me-1"></i>Delete';
                }
            } catch (err) {
                console.error('Delete error:', err);
                showError('Failed to delete newsletter');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-trash me-1"></i>Delete';
            }
        }
        
        // AI Edit Button
        else if (target.id === 'admin-ai-edit-btn') {
            e.preventDefault();
            const instructions = prompt('How would you like to edit the newsletter?\n\nExamples:\n- Make it more professional\n- Add more details about AI\n- Shorten it to 500 words\n- Make it more casual');
            
            if (!instructions) return;

            const content = document.getElementById('admin-newsletter-editor').innerHTML;
            const loading = document.getElementById('admin-loading');
            const editMode = document.getElementById('admin-edit-mode');

            editMode.style.display = 'none';
            loading.style.display = 'block';
            loading.querySelector('p').textContent = 'AI is editing your newsletter...';

            try {
                const response = await fetch('../scripts/php/newsletters.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'ai_edit',
                        content: content,
                        instructions: instructions
                    })
                });

                const data = await response.json();
                
                // Handle multiple possible response formats
                const editedContent = data.output || data.content || data.html || data.body;
                
                if (editedContent || data.success !== false) {
                    const finalContent = editedContent || JSON.stringify(data);
                    document.getElementById('admin-newsletter-editor').innerHTML = finalContent;
                    showSuccess('Newsletter edited successfully!');
                } else {
                    throw new Error(data.error || 'No edited content received');
                }
            } catch (err) {
                console.error('AI Edit error:', err);
                showError('Failed to edit newsletter: ' + err.message);
            } finally {
                loading.style.display = 'none';
                editMode.style.display = 'block';
                loading.querySelector('p').textContent = 'Generating newsletter... (may take 1-2 minutes)';
            }
        }
    });

    // Add Category Button (in Generator tab)
    document.getElementById('admin-add-category-btn')?.addEventListener('click', function() {
        const modal = new bootstrap.Modal(document.getElementById('adminCategoryModal'));
        modal.show();
    });

    // Add Category Button (in Categories tab)
    document.getElementById('create-category-tab-btn')?.addEventListener('click', function() {
        const modal = new bootstrap.Modal(document.getElementById('adminCategoryModal'));
        modal.show();
    });

    // Save Category Button (in modal)
    document.getElementById('admin-save-category-btn')?.addEventListener('click', async function() {
        const categoryName = document.getElementById('admin-new-category-name').value.trim();
        if (!categoryName) {
            showError('Please enter a category name');
            return;
        }

        try {
            const response = await fetch('../scripts/php/categories.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    category_name: categoryName
                })
            });

            const data = await response.json();
            
            if (data.success) {
                showSuccess('Category created successfully!');
                loadCategories();
                
                // Close modal and clear input
                const modalElement = document.getElementById('adminCategoryModal');
                const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                modal.hide();
                document.getElementById('admin-new-category-name').value = '';
                
                // Reload page to update categories table
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                showError(data.error || 'Failed to create category');
            }
        } catch (err) {
            console.error('Create category error:', err);
            showError('Failed to create category');
        }
    });

    // ========================================
    // ADMIN PANEL ACTIONS
    // ========================================

    // Update bulk toggle button based on selected categories
    function updateBulkToggleButton() {
        const checkedBoxes = document.querySelectorAll('.category-checkbox:checked');
        if (checkedBoxes.length === 0) {
            document.getElementById('toggle-selected-categories').style.display = 'none';
            return;
        }
        
        document.getElementById('toggle-selected-categories').style.display = 'inline-block';
        
        let shownCount = 0;
        let hiddenCount = 0;
        
        checkedBoxes.forEach(cb => {
            const row = cb.closest('tr');
            const status = row.dataset.status;
            if (status === 'shown') shownCount++;
            else if (status === 'hidden') hiddenCount++;
        });
        
        const button = document.getElementById('toggle-selected-categories');
        const icon = button.querySelector('i');
        
        if (hiddenCount > shownCount) {
            button.innerHTML = '<i class="fas fa-eye me-1"></i>Unhide selected';
            button.className = 'btn btn-success';
        } else {
            button.innerHTML = '<i class="fas fa-eye-slash me-1"></i>Hide selected';
            button.className = 'btn btn-danger';
        }
    }

    // Add event listeners for checkboxes
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('category-checkbox')) {
            updateBulkToggleButton();
        }
    });

    // Select all checkbox
    document.getElementById('select-all-categories')?.addEventListener('change', function() {
        document.querySelectorAll('.category-checkbox').forEach(cb => cb.checked = this.checked);
        updateBulkToggleButton();
    });

    document.getElementById('select-all-categories')?.addEventListener('change', function() {
        document.querySelectorAll('.category-checkbox').forEach(cb => cb.checked = this.checked);
    });

    // Newsletter search
    document.getElementById('search-newsletter-btn')?.addEventListener('click', function() {
        const searchTerm = document.getElementById('searchNewsLetter').value.toLowerCase();
        document.querySelectorAll('#newsletters-table-body tr').forEach(row => {
            const title = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
            const owner = row.querySelector('td:nth-child(3)').textContent.toLowerCase();
            row.style.display = (title.includes(searchTerm) || owner.includes(searchTerm)) ? '' : 'none';
        });
    });

    // User search
    document.getElementById('search-user-btn')?.addEventListener('click', function() {
        const searchTerm = document.getElementById('searchUsername').value.toLowerCase();
        document.querySelectorAll('#users-table-body tr').forEach(row => {
            const username = row.querySelector('td:nth-child(1)').textContent.toLowerCase();
            row.style.display = username.includes(searchTerm) ? '' : 'none';
        });
    });

    // Category search
    document.getElementById('search-category-btn')?.addEventListener('click', function() {
        const searchTerm = document.getElementById('searchCategories').value.toLowerCase();
        document.querySelectorAll('#categories-table-body tr').forEach(row => {
            const name = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
            row.style.display = name.includes(searchTerm) ? '' : 'none';
        });
    });

    // Delete selected newsletters
    document.getElementById('delete-selected-newsletters')?.addEventListener('click', function() {
        const selected = Array.from(document.querySelectorAll('.newsletter-checkbox:checked')).map(cb => cb.value);
        if (selected.length === 0) {
            alert('Please select at least one newsletter');
            return;
        }
        const modal = new bootstrap.Modal(document.getElementById('delNewsletterConfirm'));
        modal.show();
    });

    // Confirm delete newsletters
    document.getElementById('confirm-delete-newsletters')?.addEventListener('click', async function() {
        const selected = Array.from(document.querySelectorAll('.newsletter-checkbox:checked')).map(cb => cb.value);
        
        try {
            const response = await fetch('../scripts/php/admin_actions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete_newsletters',
                    newsletter_ids: selected
                })
            });

            const data = await response.json();
            
            if (data.success) {
                window.location.reload();
                // Note: refreshNewsletterList() will be called when the page reloads and tab switches
            } else {
                alert('Error: ' + data.error);
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert('Failed to delete newsletters');
        }
    });

    // Toggle selected categories visibility
    document.getElementById('toggle-selected-categories')?.addEventListener('click', function() {
        const selected = Array.from(document.querySelectorAll('.category-checkbox:checked')).map(cb => cb.value);
        if (selected.length === 0) {
            alert('Please select at least one category');
            return;
        }
        
        // Determine action based on button text
        const isUnhide = this.textContent.includes('Unhide');
        const targetStatus = isUnhide ? 'shown' : 'hidden';
        const actionText = isUnhide ? 'unhide' : 'hide';
        
        // Update modal
        document.getElementById('toggle-category-modal-title').textContent = `Confirm ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}`;
        document.getElementById('toggle-category-modal-body').textContent = `Are you sure you want to ${actionText} the selected categories?`;
        document.getElementById('confirm-toggle-categories').textContent = actionText.charAt(0).toUpperCase() + actionText.slice(1);
        document.getElementById('confirm-toggle-categories').className = `btn btn-${isUnhide ? 'success' : 'danger'}`;
        
        // Store the target status for the confirm handler
        document.getElementById('confirm-toggle-categories').dataset.targetStatus = targetStatus;
        
        const modal = new bootstrap.Modal(document.getElementById('toggleCategoryConfirm'));
        modal.show();
    });

    // Confirm toggle categories
    document.getElementById('confirm-toggle-categories')?.addEventListener('click', async function() {
        const selected = Array.from(document.querySelectorAll('.category-checkbox:checked')).map(cb => cb.value);
        const targetStatus = this.dataset.targetStatus;
        
        try {
            const response = await fetch('../scripts/php/admin_actions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_categories_status',
                    category_ids: selected,
                    status: targetStatus
                })
            });

            const data = await response.json();
            
            if (data.success) {
                storeCurrentTab();
                window.location.reload();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (err) {
            console.error('Toggle error:', err);
            alert('Failed to update categories');
        }
    });

    // Toggle single category visibility
    document.querySelectorAll('.toggle-category-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const categoryID = this.dataset.id;
            
            try {
                const response = await fetch('../scripts/php/admin_actions.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'toggle_category_visibility',
                        category_id: categoryID
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    storeCurrentTab();
                    window.location.reload();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (err) {
                console.error('Toggle error:', err);
                alert('Failed to toggle category visibility');
            }
        });
    });

}); // End DOMContentLoaded
