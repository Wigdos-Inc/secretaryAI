const contentBox = document.getElementById("pageContent");

// Global Popup System - accessible from all pages
window.popupSystem = {
  // Store data globally
  newsletters: {},
  categories: {},
  users: {},
  userID: window.globalUserID || null,

  // Initialize data (called from pages)
  initData: function(newsletters, categories, users, userID = null) {
    this.newsletters = newsletters || {};
    this.categories = categories || {};
    this.users = users || {};
    // Only update userID if not already set from global or if explicitly passed
    if (userID !== null) {
      this.userID = userID;
    } else if (!this.userID) {
      this.userID = window.globalUserID || null;
    }
    console.log('Popup system initialized with userID:', this.userID);
  },

  // Strip HTML tags for preview text
  stripHtml: function(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  },

  // Truncate text
  truncateText: function(text, maxLength = 200) {
    const stripped = this.stripHtml(text);
    if (stripped.length <= maxLength) return stripped;
    return stripped.substr(0, maxLength) + '...';
  },

  // Open Newsletter Popup
  newsPopup: function(id) {
    const newsletter = this.newsletters[id];
    if (!newsletter) return;

    console.log('Opening newsletter popup. UserID:', this.userID);
    const favoriteBtn = this.userID ? `
      <button class="favorite-btn-icon" 
              data-favorite-btn 
              data-favorite-type="newsletter" 
              data-favorite-id="${id}"
              title="Add to favorites"
              style="margin-right: 10px;">
        <i class="far fa-heart"></i>
      </button>
    ` : '';
    console.log('Favorite button HTML:', favoriteBtn ? 'Generated' : 'Not generated (no userID)');

    const modalHTML = `
      <div class="global-modal-overlay" onclick="window.popupSystem.closePopup()">
        <div class="global-modal-wrapper" onclick="event.stopPropagation()">
          <div class="global-modal-header">
            <h2 class="global-modal-title">${this.escapeHtml(newsletter.title)}</h2>
            <div style="display: flex; align-items: center;">
              ${favoriteBtn}
              <button class="global-modal-close" onclick="window.popupSystem.closePopup()">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
          <div class="global-modal-body">
            <div class="global-modal-meta">
              <div class="global-modal-meta-item">
                <span class="global-modal-label">Created</span>
                <span class="global-modal-value">${new Date(newsletter.creation_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div class="global-modal-meta-item">
                <span class="global-modal-label">Categories</span>
                <span class="global-modal-value">${(newsletter.categories || []).length}</span>
              </div>
              <div class="global-modal-meta-item">
                <span class="global-modal-label">Contributors</span>
                <span class="global-modal-value">${(newsletter.contributors || []).length}</span>
              </div>
            </div>
            <div class="global-modal-section">
              <div class="global-modal-label">Content</div>
              <div class="global-modal-content">${newsletter.content}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.showModal(modalHTML);
  },

  // Open Category Popup
  categoryPopup: function(id) {
    const category = this.categories[id];
    if (!category) return;

    const categoryNewsletters = (category.newsletters || [])
      .map(nId => ({ id: nId, data: this.newsletters[nId] }))
      .filter(n => n.data);

    // Get top 3 recent newsletters
    const recentNewsletters = [...categoryNewsletters]
      .sort((a, b) => new Date(b.data.creation_date) - new Date(a.data.creation_date))
      .slice(0, 3);

    // Get top 3 favorited newsletters
    const favoritedNewsletters = [...categoryNewsletters]
      .sort((a, b) => (b.data.favorited_by || []).length - (a.data.favorited_by || []).length)
      .slice(0, 3);

    const recentHTML = recentNewsletters.length > 0 
      ? recentNewsletters.map(n => `
          <div class="newsletter-card-mini" onclick="window.popupSystem.newsPopup(${n.id})">
            <div class="newsletter-card-mini-header">
              <i class="fas fa-newspaper"></i>
              <h4>${this.escapeHtml(n.data.title)}</h4>
            </div>
            <p>${this.truncateText(n.data.content, 100)}</p>
            <div class="newsletter-card-mini-footer">
              <small><i class="fas fa-calendar-alt"></i> ${new Date(n.data.creation_date).toLocaleDateString()}</small>
            </div>
          </div>
        `).join('')
      : '<p class="text-muted">No newsletters yet</p>';

    const favoritedHTML = favoritedNewsletters.length > 0
      ? favoritedNewsletters.map(n => `
          <div class="newsletter-card-mini" onclick="window.popupSystem.newsPopup(${n.id})">
            <div class="newsletter-card-mini-header">
              <i class="fas fa-newspaper"></i>
              <h4>${this.escapeHtml(n.data.title)}</h4>
            </div>
            <p>${this.truncateText(n.data.content, 100)}</p>
            <div class="newsletter-card-mini-footer">
              <small><i class="fas fa-heart"></i> ${(n.data.favorited_by || []).length} favorites</small>
            </div>
          </div>
        `).join('')
      : '<p class="text-muted">No favorited newsletters</p>';

    const favoriteBtn = this.userID ? `
      <button class="favorite-btn-icon" 
              data-favorite-btn 
              data-favorite-type="category" 
              data-favorite-id="${id}"
              title="Follow category"
              style="margin-right: 10px;">
        <i class="far fa-heart"></i>
      </button>
    ` : '';

    const modalHTML = `
      <div class="global-modal-overlay" onclick="window.popupSystem.closePopup()">
        <div class="global-modal-wrapper" onclick="event.stopPropagation()">
          <div class="global-modal-header">
            <h2 class="global-modal-title">${this.escapeHtml(category.name)}</h2>
            <div style="display: flex; align-items: center;">
              ${favoriteBtn}
              <button class="global-modal-close" onclick="window.popupSystem.closePopup()">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
          <div class="global-modal-body">
            <div class="global-modal-meta">
              <div class="global-modal-meta-item">
                <span class="global-modal-label">Total Newsletters</span>
                <span class="global-modal-value">${categoryNewsletters.length}</span>
              </div>
              <div class="global-modal-meta-item">
                <span class="global-modal-label">Contributors</span>
                <span class="global-modal-value">${(category.contributors || []).length}</span>
              </div>
            </div>
            
            <div class="global-modal-section">
              <div class="global-modal-label"><i class="fas fa-clock"></i> Recently Added</div>
              <div class="newsletters-grid">
                ${recentHTML}
              </div>
            </div>

            <div class="global-modal-section">
              <div class="global-modal-label"><i class="fas fa-heart"></i> Most Favorited</div>
              <div class="newsletters-grid">
                ${favoritedHTML}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.showModal(modalHTML);
  },

  // Open Creator Popup
  creatorPopup: function(id) {
    const user = this.users[id];
    if (!user) return;

    const createdNewsletters = (user.c_newsletters || [])
      .map(nId => ({ id: nId, data: this.newsletters[nId] }))
      .filter(n => n.data);

    // Get newsletters where user contributed but didn't create
    const contributedNewsletters = [];
    for (let nId in this.newsletters) {
      const newsletter = this.newsletters[nId];
      if ((newsletter.contributors || []).includes(parseInt(id)) && newsletter.creator_ID != id) {
        contributedNewsletters.push({ id: nId, data: newsletter });
      }
    }

    // Get 5 most recent contributions
    const recentContributions = contributedNewsletters
      .sort((a, b) => new Date(b.data.creation_date) - new Date(a.data.creation_date))
      .slice(0, 5);

    const createdHTML = createdNewsletters.length > 0
      ? createdNewsletters.map(n => `
          <div class="newsletter-card-mini" onclick="window.popupSystem.newsPopup(${n.id})">
            <div class="newsletter-card-mini-header">
              <i class="fas fa-newspaper"></i>
              <h4>${this.escapeHtml(n.data.title)}</h4>
            </div>
            <p>${this.truncateText(n.data.content, 100)}</p>
            <div class="newsletter-card-mini-footer">
              <small><i class="fas fa-calendar-alt"></i> ${new Date(n.data.creation_date).toLocaleDateString()}</small>
            </div>
          </div>
        `).join('')
      : '<p class="text-muted">No newsletters created yet</p>';

    const contributedHTML = recentContributions.length > 0
      ? recentContributions.map(n => `
          <div class="newsletter-card-mini" onclick="window.popupSystem.newsPopup(${n.id})">
            <div class="newsletter-card-mini-header">
              <i class="fas fa-newspaper"></i>
              <h4>${this.escapeHtml(n.data.title)}</h4>
            </div>
            <p>${this.truncateText(n.data.content, 100)}</p>
            <div class="newsletter-card-mini-footer">
              <small><i class="fas fa-calendar-alt"></i> ${new Date(n.data.creation_date).toLocaleDateString()}</small>
            </div>
          </div>
        `).join('')
      : '<p class="text-muted">No contributions yet</p>';

    const favoriteBtn = this.userID ? `
      <button class="favorite-btn-icon" 
              data-favorite-btn 
              data-favorite-type="creator" 
              data-favorite-id="${id}"
              title="Follow creator"
              style="margin-right: 10px;">
        <i class="far fa-heart"></i>
      </button>
    ` : '';

    const modalHTML = `
      <div class="global-modal-overlay" onclick="window.popupSystem.closePopup()">
        <div class="global-modal-wrapper" onclick="event.stopPropagation()">
          <div class="global-modal-header">
            <div class="creator-header-content">
              <div class="creator-avatar-large">
                ${user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 class="global-modal-title">${this.escapeHtml(user.username)}</h2>
                <span class="creator-role ${user.role.toLowerCase()}">${this.escapeHtml(user.role)}</span>
              </div>
            </div>
            <div style="display: flex; align-items: center;">
              ${favoriteBtn}
              <button class="global-modal-close" onclick="window.popupSystem.closePopup()">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
          <div class="global-modal-body">
            <div class="global-modal-meta">
              <div class="global-modal-meta-item">
                <span class="global-modal-label">Joined</span>
                <span class="global-modal-value">${new Date(user.creation_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div class="global-modal-meta-item">
                <span class="global-modal-label">Created</span>
                <span class="global-modal-value">${createdNewsletters.length} newsletters</span>
              </div>
              <div class="global-modal-meta-item">
                <span class="global-modal-label">Contributions</span>
                <span class="global-modal-value">${contributedNewsletters.length} newsletters</span>
              </div>
            </div>

            <div class="global-modal-section">
              <div class="global-modal-label"><i class="fas fa-newspaper"></i> Created Newsletters</div>
              <div class="newsletters-grid">
                ${createdHTML}
              </div>
            </div>

            <div class="global-modal-section">
              <div class="global-modal-label"><i class="fas fa-hands-helping"></i> Recent Contributions</div>
              <div class="newsletters-grid">
                ${contributedHTML}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.showModal(modalHTML);
  },

  // Helper to show modal
  showModal: function(html) {
    // Remove any existing modal
    this.closePopup();
    
    // Create modal in parent document (not iframe)
    const modalContainer = document.createElement('div');
    modalContainer.id = 'globalModalContainer';
    modalContainer.innerHTML = html;
    document.body.appendChild(modalContainer);

    // Initialize favorite buttons if user is logged in
    if (this.userID && window.favoritesManager) {
      window.favoritesManager.initializeButtons();
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Close on escape key
    this.escapeHandler = (e) => {
      if (e.key === 'Escape') this.closePopup();
    };
    document.addEventListener('keydown', this.escapeHandler);
  },

  // Close popup
  closePopup: function() {
    const modal = document.getElementById('globalModalContainer');
    if (modal) {
      modal.remove();
      document.body.style.overflow = '';
      if (this.escapeHandler) {
        document.removeEventListener('keydown', this.escapeHandler);
        this.escapeHandler = null;
      }
    }
  },

  // Escape HTML
  escapeHtml: function(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }
};

// Make popup functions globally accessible from iframes
window.newsPopup = (id) => window.popupSystem.newsPopup(id);
window.categoryPopup = (id) => window.popupSystem.categoryPopup(id);
window.creatorPopup = (id) => window.popupSystem.creatorPopup(id);

async function search() {

}

document.addEventListener('DOMContentLoaded', () => {
  const iframe = document.getElementById('pageContent');
  const navLinks = Array.from(document.querySelectorAll('a[data-page]'));
  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');

  // Check for load parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const loadPageParam = urlParams.get('load');
  if (loadPageParam) {
    loadPage(loadPageParam);
  }

  // Persist current page in URL
  if (iframe) {
    iframe.addEventListener('load', () => {
      const currentSrc = iframe.src;
      if (currentSrc && currentSrc !== 'pages/home_view.php') {
        const url = new URL(window.location);
        url.searchParams.set('load', currentSrc);
        window.history.replaceState(null, null, url);
      }
    });
  }

  function setActive(link) {
    navLinks.forEach(l => l.classList.remove('active'));
    if (link) link.classList.add('active');
  }

  function loadPage(path, clickedLink) {
    if (!iframe) return;
    
    // Reset iframe height before loading new page
    iframe.style.height = '600px';
    
    // Store current page before loading login
    if (path.includes('login_view.php')) {
      const currentSrc = iframe.src;
      localStorage.setItem('pageBeforeLogin', currentSrc);
      // Also set a cookie for server-side access
      document.cookie = 'pageBeforeLogin=' + encodeURIComponent(currentSrc) + '; path=/; max-age=300'; // 5 minutes
    }
    
    // Check if the path has a hash
    const [basePath, hash] = path.split('#');
    const currentSrc = iframe.src.split('#')[0].split('/').pop();
    const newSrc = basePath.split('/').pop();
    
    // If navigating to the same page with different hash, force reload with hash
    if (currentSrc === newSrc && hash) {
      iframe.src = path; // This will reload even if base is same
      // Wait for content to settle, then handle the hash
      setTimeout(() => {
        if (iframe.contentWindow) {
          iframe.contentWindow.location.hash = hash;
        }
      }, 100);
    } else {
      iframe.src = path;
    }
    
    setActive(clickedLink);
    
    // close mobile menu if open
    if (mobileMenu && window.getComputedStyle(mobileMenu).display !== 'none') {
      mobileMenu.style.display = 'none';
    }
  }

  // Expose loadPage function globally for dynamic content
  window.loadPage = loadPage;

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      if (page) loadPage(page, link);
    });
  });

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      const isHidden = mobileMenu.style.display === 'none' || getComputedStyle(mobileMenu).display === 'none';
      mobileMenu.style.display = isHidden ? 'block' : 'none';
    });
  }

  // Function to resize iframe to fit content
  function resizeIframe() {
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const height = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight, 600); // Minimum 600px
      iframe.style.height = height + 'px';
      // console.log('Iframe resized to:', height + 'px'); // Disabled logging
    } catch (err) {
      // console.log('Cannot resize iframe:', err); // Disabled logging
    }
  }

  // Auto-resize iframe to fit content exactly - no internal scrolling
  if (iframe) {
    iframe.addEventListener('load', () => {
      // Initial resize
      resizeIframe();
      
      // Also check after a short delay to catch dynamic content
      setTimeout(resizeIframe, 100);
      setTimeout(resizeIframe, 500);
      
      // Monitor for content changes inside iframe (only if same-origin)
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (doc && doc.body) {
          const observer = new MutationObserver(() => {
            resizeIframe();
          });
          observer.observe(doc.body, {
            childList: true,
            subtree: true,
            attributes: true
          });
        }
      } catch (err) {
        // Silent fail - this is expected for cross-origin iframes
        // The iframe will still resize on load events
      }
    });
  }

  // Listen for navigation messages from iframe
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'navigateTo') {
      const targetLink = navLinks.find(link => link.getAttribute('data-page') === event.data.page);
      loadPage(event.data.page, targetLink);
    }
    
    // Handle hash updates from iframe (tab changes)
    if (event.data && event.data.type === 'updateHash') {
      const currentSrc = iframe.src.split('#')[0];
      const newUrl = currentSrc + '#' + event.data.hash;
      
      // Update iframe src with hash
      iframe.src = newUrl;
      
      // Update parent URL
      const url = new URL(window.location);
      url.searchParams.set('load', newUrl);
      window.history.replaceState(null, null, url);
    }
    
    // Handle iframe resize requests from child pages
    if (event.data && event.data.type === 'resizeIframe') {
      if (iframe) {
        // Use multiple timeouts to catch content changes
        setTimeout(() => resizeIframe(), 0);
        setTimeout(() => resizeIframe(), 50);
        setTimeout(() => resizeIframe(), 100);
        setTimeout(() => resizeIframe(), 200);
        setTimeout(() => resizeIframe(), 300);
        setTimeout(() => resizeIframe(), 500);
      }
    }
  });

});