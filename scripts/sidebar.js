import { startAuthListener, signOut, getProfile } from './modules/auth.js';
import { db, auth } from './modules/firebaseInit.js';
import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    startAfter,
    doc,
    getDoc,
    deleteDoc,
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
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

    // ChatBot history UI
    const chatbotExpander = document.getElementById('chatbotExpander');
    const chatbotSubmenu = document.getElementById('chatbotSubmenu');
    const chatbotRecent = document.getElementById('chatbotRecent');
    const chatbotLoadMore = document.getElementById('chatbotLoadMore');
    const chatbotPinned = document.getElementById('chatbotPinned');

    // Firestore pagination state (must be initialized before any UI refresh calls)
    let chatsLastVisible = null;
    const CHATS_PAGE_SIZE = 3;
    const CHATS_LOAD_MORE_SIZE = 10;
    let chatsBusy = false;

    // Use auth listener to drive UI
    let hash = window.location.hash.substring(1) || 'chatbox';

    updateNavigationVisibility();
    refreshChatbotHistoryUI(isLoggedIn() ? { uid: getUid() } : null);

    // Build initial menu from localStorage, then keep it updated via auth listener
    buildUserDropdownFromStorage();
    startAuthListener((user, profile) => {
        updateNavigationVisibility();
        buildUserDropdown(user, profile);
        refreshChatbotHistoryUI(user);
    });

    function isLoggedIn() {

        return localStorage.getItem('isLoggedIn') === 'true';
    }

    function getUid() {
        return JSON.parse(localStorage.getItem('userData') || 'null')?.uid ?? null;
    }

    function getCidFromUrl() {
        try {
            return new URLSearchParams(window.location.search).get('cid');
        } catch {
            return null;
        }
    }

    function setCidInUrl(cid) {
        const url = new URL(window.location.href);
        if (cid) url.searchParams.set('cid', cid);
        else url.searchParams.delete('cid');
        // Keep the same hash (or default) and update URL without reload
        window.history.replaceState(null, '', url.toString());
        // Notify other modules (chat page) / sidebar UI
        window.dispatchEvent(new Event('cidchange'));
    }

    function chatTitleFromData(data, fallbackId) {
        const title = (data && (data.title || data.summary)) ? String(data.title || data.summary).trim() : '';
        if (title) return title;
        const firstUser = data?.transcript?.find(t => t && typeof t.user === 'string' && t.user.trim())?.user;
        if (firstUser) return firstUser.trim().slice(0, 48);
        return fallbackId ? `Chat ${String(fallbackId).slice(0, 6)}` : 'Untitled chat';
    }

    function renderChatRow({ container, chatId, data, active }) {
        if (!container) return;
        const title = chatTitleFromData(data, chatId);

        const row = document.createElement('button');
        row.type = 'button';
        row.className = `nav-subitem${active ? ' active' : ''}`;
        row.setAttribute('data-cid', chatId);

        const titleEl = document.createElement('span');
        titleEl.className = 'nav-subitem-title';
        titleEl.textContent = title;

        const actions = document.createElement('span');
        actions.className = 'nav-subitem-actions';

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'nav-subitem-delete';
        del.setAttribute('aria-label', 'Delete chat');
        del.innerHTML = '<i class="bi bi-x-lg"></i>';

        del.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await deleteChat(chatId);
        });

        actions.appendChild(del);
        row.appendChild(titleEl);
        row.appendChild(actions);

        row.addEventListener('click', (e) => {
            e.preventDefault();
            // Navigate to chatbox with cid param
            setCidInUrl(chatId);
            window.location.hash = '#chatbox';
            // Ensure pinned view updates immediately
            updatePinnedChat();
        });

        container.appendChild(row);
    }

    async function deleteChat(chatId) {
        const uid = getUid();
        if (!uid || !chatId) return;
        if (!confirm('Delete this chat?')) return;
        try {
            await deleteDoc(doc(db, 'Users', uid, 'chats', chatId));
        } catch (e) {
            console.error('Failed to delete chat', e);
        }

        try { localStorage.removeItem(`chat_${chatId}`); } catch {}

        // If deleting the active chat, clear cid and refresh chatbox
        if (getCidFromUrl() === chatId) {
            setCidInUrl(null);
            window.location.hash = '#chatbox';
        }

        // Refresh UI
        chatsLastVisible = null;
        await loadRecentChats({ reset: true });
        await updatePinnedChat();
    }

    // Track total chat count for load more/less logic
    let totalChatCount = 0;
    let showingAllChats = false;

    async function loadRecentChats({ reset } = { reset: false }) {
        const uid = getUid();
        if (!uid || !chatbotRecent) return;
        if (chatsBusy) return;
        chatsBusy = true;
        try {
            if (reset) {
                chatbotRecent.innerHTML = '';
                chatsLastVisible = null;
                showingAllChats = false;
            }

            // Always fetch total count for correct button logic
            const base = collection(db, 'Users', uid, 'chats');
            const allSnap = await getDocs(query(base, orderBy('activity', 'desc')));
            totalChatCount = allSnap.docs.length;

            // Hide expander if no chats
            if (chatbotExpander) {
                chatbotExpander.hidden = totalChatCount === 0;
                // If dropdown is open but now empty, auto-collapse
                if (totalChatCount === 0 && chatbotExpander.getAttribute('aria-expanded') === 'true') {
                    setHistoryExpanded(false);
                }
            }

            let pageSize = CHATS_PAGE_SIZE;
            if (showingAllChats) pageSize = totalChatCount;
            else if (!reset && chatsLastVisible) pageSize = CHATS_LOAD_MORE_SIZE;

            let q = query(base, orderBy('activity', 'desc'), limit(pageSize));
            if (!reset && chatsLastVisible) {
                q = query(base, orderBy('activity', 'desc'), startAfter(chatsLastVisible), limit(pageSize));
            }
            const snap = await getDocs(q);

            if (snap.docs.length) chatsLastVisible = snap.docs[snap.docs.length - 1];

            const activeCid = getCidFromUrl();

            snap.docs.forEach(d => {
                const data = d.data() || {};
                renderChatRow({
                    container: chatbotRecent,
                    chatId: d.id,
                    data,
                    active: activeCid && d.id === activeCid,
                });
            });

            // Show Load More/Less button logic
            if (chatbotLoadMore) {
                if (totalChatCount > CHATS_PAGE_SIZE) {
                    chatbotLoadMore.hidden = false;
                    chatbotLoadMore.textContent = showingAllChats ? 'Load less' : 'Load more';
                } else {
                    chatbotLoadMore.hidden = true;
                }
            }
        } catch (e) {
            console.error('Failed to load recent chats', e);
            if (chatbotLoadMore) chatbotLoadMore.hidden = true;
            if (chatbotExpander) chatbotExpander.hidden = true;
        } finally {
            chatsBusy = false;
        }
    }

    async function updatePinnedChat() {
        if (!chatbotPinned) return;
        const uid = getUid();
        const cid = getCidFromUrl();
        const onChatbox = (window.location.hash.substring(1) || 'chatbox') === 'chatbox';

        chatbotPinned.innerHTML = '';
        chatbotPinned.hidden = true;
        if (!uid || !cid || !onChatbox) return;

        // Try localStorage first (fast), then Firestore
        let data = null;
        try {
            data = JSON.parse(localStorage.getItem(`chat_${cid}`) || 'null');
        } catch {}

        if (!data) {
            try {
                const snap = await getDoc(doc(db, 'Users', uid, 'chats', cid));
                if (snap.exists()) data = snap.data();
            } catch (e) {
                console.debug('Pinned chat fetch failed', e);
            }
        }

        chatbotPinned.hidden = false;
        renderChatRow({ container: chatbotPinned, chatId: cid, data: data || {}, active: true });
    }

    function setHistoryExpanded(expanded) {
        if (!chatbotExpander || !chatbotSubmenu) return;
        chatbotExpander.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        chatbotSubmenu.hidden = !expanded;
        if (expanded) loadRecentChats({ reset: true });
    }

    async function refreshChatbotHistoryUI(user) {
        const loggedIn = !!user && isLoggedIn();
        if (chatbotExpander) {
            chatbotExpander.hidden = true; // always hidden by default, only show if chats exist
            if (!loggedIn) chatbotExpander.setAttribute('aria-expanded', 'false');
        }
        if (chatbotSubmenu) chatbotSubmenu.hidden = true;
        if (chatbotRecent) chatbotRecent.innerHTML = '';
        if (chatbotLoadMore) chatbotLoadMore.hidden = true;
        chatsLastVisible = null;

        // Pinned should follow current URL and login state
        if (!loggedIn) {
            if (chatbotPinned) {
                chatbotPinned.innerHTML = '';
                chatbotPinned.hidden = true;
            }
            return;
        }

        // Only show expander if logged in and there are chats
        try {
            const uid = getUid();
            if (uid && chatbotExpander) {
                const base = collection(db, 'Users', uid, 'chats');
                const allSnap = await getDocs(query(base, orderBy('activity', 'desc')));
                if (allSnap.docs.length > 0 && loggedIn) {
                    chatbotExpander.hidden = false;
                } else {
                    chatbotExpander.hidden = true;
                    if (chatbotExpander.getAttribute('aria-expanded') === 'true') {
                        setHistoryExpanded(false);
                    }
                }
            }
        } catch {}

        updatePinnedChat();
    }

    // History expander interactions
    if (chatbotExpander) {
        chatbotExpander.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isLoggedIn()) return;
            const isExpanded = chatbotExpander.getAttribute('aria-expanded') === 'true';
            setHistoryExpanded(!isExpanded);
        });
    }

    if (chatbotLoadMore) {
        chatbotLoadMore.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isLoggedIn()) return;
            if (!showingAllChats) {
                showingAllChats = true;
                await loadRecentChats({ reset: true });
            } else {
                showingAllChats = false;
                await loadRecentChats({ reset: true });
            }
        });
    }

    // Keep pinned + active highlight in sync when cid changes
    window.addEventListener('cidchange', () => {
        updatePinnedChat();
        // If expanded, refresh list so active state updates
        if (chatbotExpander && chatbotExpander.getAttribute('aria-expanded') === 'true') {
            loadRecentChats({ reset: true });
        }
    });

    window.addEventListener('chatlistrefresh', () => {
        if (!isLoggedIn()) return;
        // Update pinned and, if expanded, refresh the list for updated ordering
        updatePinnedChat();
        if (chatbotExpander && chatbotExpander.getAttribute('aria-expanded') === 'true') {
            loadRecentChats({ reset: true });
        }
    });

    window.addEventListener('popstate', () => updatePinnedChat());
    
    const protectedPages = ['profile', 'checkout', 'callList', 'leads', 'voiceCall'];
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

            // Clicking the main ChatBot button should start a fresh chat
            if (page === 'chatbox') {
                setCidInUrl(null);
            }

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
        const protectedPages = ['profile', 'checkout', 'callList', 'leads', 'voiceCall'];
        
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

        // Keep pinned chat visibility correct (only on chatbox with cid)
        updatePinnedChat();
    });
    
    function updateNavigationVisibility() {
        const loggedIn = isLoggedIn();
        
        navItems.forEach(item => {
            const page = item.dataset.page;
            
            if (!loggedIn && (page === 'profile' || page === 'callList' || page === 'leads' || page === 'voiceCall')) {
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
                            // For some SPA pages we need the module script to re-execute when
                            // navigating back to the page. Add a cache-busting timestamp for
                            // those module scripts so the browser will re-run them.
                            if (['chatbox','callList','leads','voiceCall'].includes(page) && /\/scripts\/pages\/.+\.js$/.test(resolved.pathname)) {
                                        resolved.searchParams.set('t', Date.now().toString());
                                    }

                            newScript.src = resolved.href;
                            // If the original script had no explicit type, but the src points to our
                            // `/scripts/` folder (our ES module files live there), treat it as a module.
                            if (!script.type && /\/scripts\//.test(resolved.pathname)) {
                                newScript.type = 'module';
                            }
                        } catch (e) {
                            // Fallback to original attribute
                            newScript.src = srcAttr;
                            if (!script.type && /scripts\//.test(srcAttr)) {
                                newScript.type = 'module';
                            }
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
