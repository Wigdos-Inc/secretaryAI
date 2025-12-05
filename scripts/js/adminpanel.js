const profile_tabs = document.getElementById('profile_tabs');

function swapTab(tabID){
    const hash = tabID.replace('tab_', '');
    
    // Update URL hash
    window.location.hash = hash;
    
    // Notify parent window to update its URL
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({ 
            type: 'updateHash', 
            hash: hash 
        }, '*');
    }
    
    // Hide all tabs and show the selected one
    for(let i = 0; i < (profile_tabs.childNodes.length - 1) / 2; i++){
        let offset = i * 2;
        const curNode = profile_tabs.childNodes[offset + 1];
        if(curNode.id == tabID){
            curNode.style.display = 'block';
        } else {
            curNode.style.display = 'none';
        }
    }
    
    // Update active state on navigation links
    document.querySelectorAll('.admin-nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Find and activate the corresponding button
    const activeButton = document.getElementById('btn_' + tabID);
    if(activeButton){
        activeButton.classList.add('active');
    }
    
    // Force layout recalculation
    profile_tabs.style.display = 'none';
    profile_tabs.offsetHeight; // Trigger reflow
    profile_tabs.style.display = 'flex';
    
    // Notify parent to resize iframe after DOM settles
    setTimeout(() => {
        if (window.parent) {
            window.parent.postMessage({ type: 'resizeIframe' }, '*');
        }
    }, 10);
}

// Handle hash changes
function handleHashChange() {
    const hash = window.location.hash.substring(1); // Remove #
    if (hash === 'create') {
        swapTab('tab_create');
    } else if (hash === 'generator') {
        swapTab('tab_generator');
    } else if (hash === 'viewLetters') {
        swapTab('tab_viewLetters');
    } else if (hash === 'viewCategories') {
        swapTab('tab_viewCategories');
    } else if (hash) {
        // Try to swap to the tab if it exists
        const tabElement = document.getElementById('tab_' + hash);
        if (tabElement) {
            swapTab('tab_' + hash);
        }
    }
}

document.getElementById('btn_tab_create').addEventListener('click', (e) => {
    e.preventDefault();
    swapTab('tab_create');
    // Refresh newsletter list when switching to newsletters tab
    if (typeof refreshNewsletterList === 'function') {
        refreshNewsletterList();
    }
});
document.getElementById('btn_tab_generator').addEventListener('click', (e) => {
    e.preventDefault();
    swapTab('tab_generator');
});
document.getElementById('btn_tab_viewLetters').addEventListener('click', (e) => {
    e.preventDefault();
    swapTab('tab_viewLetters');
});
document.getElementById('btn_tab_viewCategories').addEventListener('click', (e) => {
    e.preventDefault();
    swapTab('tab_viewCategories');
});

// Handle hash on page load and listen for hash changes
document.addEventListener('DOMContentLoaded', () => {
    // Check for hash first
    if (window.location.hash) {
        handleHashChange();
    } else {
        // Fall back to sessionStorage if no hash
        const activeTab = sessionStorage.getItem('activeAdminTab');
        if (activeTab) {
            swapTab(activeTab);
            sessionStorage.removeItem('activeAdminTab'); // Clear it after use
        }
    }
    
    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
});
