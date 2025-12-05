// Reusable Theme Switching System
// This script can be included in any page that needs theme switching functionality

// Listen for theme changes from parent window (for iframes)
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'themeChange') {
        const theme = event.data.theme;
        applyTheme(theme);
    }
});

// Apply theme to body
function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }
}

// Apply saved theme on load
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}
