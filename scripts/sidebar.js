import { startAuthListener, signOut, getProfile } from './modules/auth.js';
/* 
=============================================================
All Scripts related to Sidebar Functionality 
=============================================================
*/

// Navigation and User Menu for SecretaryAI
document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    const pageContent = document.getElementById('pageContent');
    const userMenuTrigger = document.getElementById('userMenuTrigger');
    const userDropdown = document.getElementById('userDropdown');
    const userMenuName = document.getElementById('userMenuName');

    // Use auth listener to drive UI
    let hash = window.location.hash.substring(1) || 'chatbox';

    updateNavigationVisibility();

    // Build initial menu from localStorage, then keep it updated via auth listener
    buildUserDropdownFromStorage();
    startAuthListener((user, profile) => {
        updateNavigationVisibility();
        buildUserDropdown(user, profile);
    });

    function isLoggedIn() {

        return localStorage.getItem('isLoggedIn') === 'true';
    }
    
    const protectedPages = ['profile', 'checkout', 'callList', 'leads'];
    const authPages = ['login', 'register'];
    
    if (!isLoggedIn() && protectedPages.includes(hash)) {
        window.location.hash = '#login';
        loadPage('login');
        updateActiveNav('login');
    } else if (isLoggedIn() && authPages.includes(hash)) {
        window.location.hash = '#chatbox';
        loadPage('chatbox');
        updateActiveNav('chatbox');
    } else if (hash) {
        // If the URL had an old hash, keep the URL updated.
        if (window.location.hash.substring(1) !== hash) {
            window.location.hash = '#' + hash;
        }
        loadPage(hash);
        updateActiveNav(hash);
    } else {
        loadPage('chatbox');
        updateActiveNav('chatbox');
    }
    
    userMenuTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('show');
        userMenuTrigger.classList.toggle('active');
    });
    
    document.addEventListener('click', () => {
        userDropdown.classList.remove('show');
        userMenuTrigger.classList.remove('active');
    });

        function buildUserDropdownFromStorage() {
            const profile = JSON.parse(localStorage.getItem('userData') || 'null');
            buildUserDropdown(profile ? { uid: null } : null, profile);
        }

        function buildUserDropdown(user, profile) {
            const displayName = (profile && ((profile.firstname || '') + ' ' + (profile.lastname || ''))?.trim()) || (profile && profile.email) || 'Account';
            userMenuName.textContent = displayName;

            if (user && profile) {
                userDropdown.innerHTML = `
                    <a href="#profile" class="dropdown-item" data-page="profile">
                        <i class="bi bi-person-circle"></i>
                        <span>My Profile</span>
                    </a>
                    <a href="#callList" class="dropdown-item" data-page="callList">
                        <i class="bi bi-telephone-fill"></i>
                        <span>Call History</span>
                    </a>
                    <div class="dropdown-divider"></div>
                    <button class="dropdown-item logout" id="dropdownLogout">
                        <i class="bi bi-box-arrow-right"></i>
                        <span>Logout</span>
                    </button>
                `;
                userDropdown.querySelectorAll('[data-page]').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.preventDefault();
                        const page = item.dataset.page;
                        // Let the hashchange handler load the page (prevents double loads)
                        window.location.hash = '#' + page;
                        userDropdown.classList.remove('show');
                        userMenuTrigger.classList.remove('active');
                    });
                });
                const logoutBtn = document.getElementById('dropdownLogout');
                if (logoutBtn) logoutBtn.addEventListener('click', () => {
                    if (confirm('Are you sure you want to logout?')) {
                        signOut();
                    }
                });
            } else {
                userMenuName.textContent = 'Account';
                userDropdown.innerHTML = `
                    <div class="dropdown-divider"></div>
                    <a href="#login" class="dropdown-item" data-page="login">
                        <i class="bi bi-box-arrow-in-right"></i>
                        <span>Login</span>
                    </a>
                    <a href="#register" class="dropdown-item" data-page="register">
                        <i class="bi bi-person-plus"></i>
                        <span>Sign Up</span>
                    </a>
                `;
                userDropdown.querySelectorAll('[data-page]').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.preventDefault();
                        const page = item.dataset.page;
                        // Let the hashchange handler load the page (prevents double loads)
                        window.location.hash = '#' + page;
                        userDropdown.classList.remove('show');
                        userMenuTrigger.classList.remove('active');
                    });
                });
            }
        }


    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;

            const nextPage = (!isLoggedIn() && protectedPages.includes(page)) ? 'login' : page;
            // Let the hashchange handler load the page (prevents double loads)
            window.location.hash = '#' + nextPage;
        });
    });
    
    window.addEventListener('hashchange', () => {
        const rawPage = window.location.hash.substring(1) || 'chatbox';
        const page = rawPage;

        // Rewrite legacy hashes to the canonical one.
        if (rawPage !== page) {
            window.location.hash = '#' + page;
            return;
        }
        const authPages = ['login', 'register'];
        const protectedPages = ['profile', 'checkout', 'callList', 'leads'];
        
        if (!isLoggedIn() && protectedPages.includes(page)) {
            window.location.hash = '#login';
            loadPage('login');
            updateActiveNav('login');
        } else if (isLoggedIn() && authPages.includes(page)) {
            window.location.hash = '#chatbox';
            loadPage('chatbox');
            updateActiveNav('chatbox');
        } else {
            loadPage(page);
            updateActiveNav(page);
        }
    });
    
    function updateNavigationVisibility() {
        const loggedIn = isLoggedIn();
        
        navItems.forEach(item => {
            const page = item.dataset.page;
            
            if (!loggedIn && (page === 'profile' || page === 'callList' || page === 'leads')) {
                item.style.display = 'none';
            } else {
                item.style.display = 'flex';
            }
        });
    }
    
    function updateActiveNav(page) {
        navItems.forEach(nav => nav.classList.remove('active'));
        const activeItem = document.querySelector(`[data-page="${page}"]`);
        if (activeItem && activeItem.classList.contains('nav-item')) {
            activeItem.classList.add('active');
        }
    }

    async function loadPage(page) {
        // Redirect old 'history' page to new 'callList' page
        if (page === 'history') {
            window.location.hash = '#callList';
            page = 'callList';
        }
        
        if(window.location.hash === '#debugLogin') {
            pageContent.innerHTML = `
                <div class="call-container">
                    <h2 style="color: #333D8A;">Debug Login Actief!</h2>
                    <p>Refresh de pagina als je nog niet ingelogd bent.</p>
                </div>
            `;
            return;
        }
        
        const loggedIn = isLoggedIn();
        const protectedPages = ['profile', 'checkout', 'callList', 'leads'];
        const authPages = ['login', 'register'];
        
        if (!loggedIn && protectedPages.includes(page)) {
            window.location.hash = '#login';
            page = 'login';
        }
        
        if (loggedIn && authPages.includes(page)) {
            window.location.hash = '#chatbox';
            page = 'chatbox';
        }
        
        try {
            const response = await fetch(`pages/${page}.html`);
            if (response.ok) {
                const html = await response.text();
                pageContent.innerHTML = html;
                
                const scripts = pageContent.querySelectorAll('script');
                const pageUrl = new URL(`pages/${page}.html`, window.location.href).href;
                scripts.forEach(script => {
                    const newScript = document.createElement('script');
                    // Preserve the script type (e.g. "module") so imports work correctly
                    if (script.type) newScript.type = script.type;

                    const srcAttr = script.getAttribute('src');
                    if (srcAttr) {
                        try {
                            // Resolve relative src against the page's URL so paths like "../scripts/..." work
                            const resolved = new URL(srcAttr, pageUrl);

                            // IMPORTANT: module scripts are cached/executed once per URL.
                            // When navigating back to chatbox in the SPA, we need chat.js to run again
                            // so it can bind to the newly-injected DOM.
                            if (page === 'chatbox' && resolved.pathname.endsWith('/scripts/pages/chat.js')) {
                                resolved.searchParams.set('t', Date.now().toString());
                            }

                            newScript.src = resolved.href;
                        } catch (e) {
                            // Fallback to original attribute
                            newScript.src = srcAttr;
                        }
                    } else {
                        newScript.textContent = script.textContent;
                    }
                    document.body.appendChild(newScript);
                });

                // Debug: log all buttons contained in the loaded page to console.debug
                try {
                    const buttons = pageContent.querySelectorAll('button');
                    if (buttons && buttons.length) {
                        console.debug(`Loaded page '${page}' has ${buttons.length} button(s):`);
                        buttons.forEach(btn => console.debug('button', {
                            id: btn.id || null,
                            text: (btn.innerText || btn.textContent || '').trim(),
                            classes: btn.className || null,
                            element: btn
                        }));
                    } else {
                        console.debug(`Loaded page '${page}' has no buttons.`);
                    }
                } catch (e) {
                    console.debug('Error while logging buttons for debug:', e);
                }
            } else {
                pageContent.innerHTML = `
                    <div class="call-container">
                        <h2 style="color: #333D8A;">Page "${page}" Not Found</h2>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading page:', error);
            pageContent.innerHTML = `
                <div class="call-container">
                    <h2 style="color: #EF4444;">Error Loading Page</h2>
                    <p>Please try again later.</p>
                </div>
            `;
        }
    }
});

// Expose as global because some pages use inline onclick="changeHash('...')".
window.changeHash = function changeHash(page) {
    const target = (page || '').toString();
    window.location.hash = target.startsWith('#') ? target : '#' + target;
};

// Used by chat action cards to avoid flashing a protected page.
window.goToLeads = function goToLeads() {
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    window.changeHash(loggedIn ? 'leads' : 'login');
};
