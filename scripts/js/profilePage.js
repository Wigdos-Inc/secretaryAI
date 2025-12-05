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
    
    // Only resize if content height actually changed significantly
    // Removed forced reflow and resize notification to prevent shrinking
}

// Handle hash changes
function handleHashChange() {
    const hash = window.location.hash.substring(1); // Remove #
    if (hash === 'settings') {
        swapTab('tab_settings');
    } else if (hash === 'profile') {
        swapTab('tab_about');
    } else if (hash === 'favorites') {
        swapTab('tab_favorites');
    } else {
        swapTab('tab_about'); // Default to about tab
    }
}

// Check for hash on page load to show the correct tab
document.addEventListener('DOMContentLoaded', () => {
    let params = new URLSearchParams(document.location.search);
    let delac = params.get("delac");

    handleHashChange();
    
    if (delac) {
        document.getElementById('delconfirm').style.display = 'block';
    }

    // Add event listeners after DOM is loaded
    document.getElementById('btn_tab_about').addEventListener('click', (e) => {
        e.preventDefault();
        swapTab('tab_about');
    });
    document.getElementById('btn_tab_settings').addEventListener('click', (e) => {
        e.preventDefault();
        swapTab('tab_settings');
    });
    document.getElementById('btn_tab_favorites')?.addEventListener('click', (e) => {
        e.preventDefault();
        swapTab('tab_favorites');
    });

    document.getElementById('delaccBtn').addEventListener('click', (e) => {
        window.location.href = './profile_view.php?delac=1';
    });

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
});
