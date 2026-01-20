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

    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const hash = window.location.hash.substring(1) || 'chatbox';

    const userData = {
        email: 'email',
        name: 'Joe Bloggs',
        company: 'SecretaryAI User',
        loginDate: new Date().toISOString()
    };
    
    // Moet verwijderd worden in uitgegeven versie (alleen voor debuggen!)
    if (window.location.hash === '#debugLogin') {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userData', JSON.stringify(userData));
    }
    
    updateNavigationVisibility();
    initUserMenu();
    
    const protectedPages = ['history', 'profile', 'checkout'];
    const authPages = ['login', 'register'];
    
    if (!isLoggedIn && protectedPages.includes(hash)) {
        window.location.hash = '#login';
        loadPage('login');
        updateActiveNav('login');
    } else if (isLoggedIn && authPages.includes(hash)) {
        window.location.hash = '#chatbox';
        loadPage('chatbox');
        updateActiveNav('chatbox');
    } else if (hash) {
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
    
    function initUserMenu() {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        
        if (isLoggedIn && userData.name) {
            userMenuName.textContent = userData.name;
            
            userDropdown.innerHTML = `
                <a href="#profile" class="dropdown-item" data-page="profile">
                    <i class="bi bi-person-circle"></i>
                    <span>My Profile</span>
                </a>
                <a href="#history" class="dropdown-item" data-page="history">
                    <i class="bi bi-clock-history"></i>
                    <span>Conversation History</span>
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
                    loadPage(page);
                    window.location.hash = '#' + page;
                    userDropdown.classList.remove('show');
                    userMenuTrigger.classList.remove('active');
                });
            });
            
            document.getElementById('dropdownLogout').addEventListener('click', () => {
                if (confirm('Are you sure you want to logout?')) {
                    localStorage.removeItem('isLoggedIn');
                    localStorage.removeItem('userData');
                    window.location.hash = '#chatbox';
                    location.reload();
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
                    loadPage(page);
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
            
            updateActiveNav(page);
            loadPage(page);
            window.location.hash = '#' + page;
        });
    });
    
    window.addEventListener('hashchange', () => {
        const page = window.location.hash.substring(1) || 'chatbox';
        const currentlyLoggedIn = localStorage.getItem('isLoggedIn');
        const authPages = ['login', 'register'];
        const protectedPages = ['history', 'profile', 'checkout'];
        
        if (!currentlyLoggedIn && protectedPages.includes(page)) {
            window.location.hash = '#login';
            loadPage('login');
            updateActiveNav('login');
        } else if (currentlyLoggedIn && authPages.includes(page)) {
            window.location.hash = '#chatbox';
            loadPage('chatbox');
            updateActiveNav('chatbox');
        } else {
            loadPage(page);
            updateActiveNav(page);
        }
    });
    
    function updateNavigationVisibility() {
        const loggedIn = localStorage.getItem('isLoggedIn');
        
        navItems.forEach(item => {
            const page = item.dataset.page;
            
            if (!loggedIn && (page === 'profile' || page === 'history')) {
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
        if(window.location.hash === '#debugLogin') {
            pageContent.innerHTML = `
                <div class="call-container">
                    <h2 style="color: #333D8A;">Debug Login Actief!</h2>
                    <p>Refresh de pagina als je nog niet ingelogd bent.</p>
                </div>
            `;
            return;
        }
        
        const loggedIn = localStorage.getItem('isLoggedIn');
        const protectedPages = ['history', 'profile', 'checkout'];
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
                scripts.forEach(script => {
                    const newScript = document.createElement('script');
                    if (script.src) {
                        newScript.src = script.src;
                    } else {
                        newScript.textContent = script.textContent;
                    }
                    document.body.appendChild(newScript);
                });
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

function changeHash(page) {
    window.location.hash = page;
}
