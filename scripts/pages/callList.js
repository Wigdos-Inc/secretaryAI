/* 
=============================================================
Display all Calls in chronological order 
=============================================================
*/

console.log('CallList.js loaded!');

// Load and display calls from JSON file
async function loadCalls() {
    const callListContent = document.getElementById('callListContent');
    const emptyState = document.getElementById('emptyState');

    console.log('Loading investment calls...');

    try {
        const response = await fetch('../scripts/json/investmentCalls.json');
        console.log('Fetch response:', response);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Data loaded:', data);
        const calls = data.investmentCalls;
        console.log('Number of calls:', calls?.length);

        if (!calls || calls.length === 0) {
            callListContent.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        callListContent.innerHTML = calls.map(call => createCallCard(call)).join('');
        console.log('Cards rendered successfully');
    } catch (error) {
        console.error('Error loading investment calls:', error);
        emptyState.style.display = 'block';
        emptyState.innerHTML = `<p>Error loading calls: ${error.message}</p>`;
    }
}

// Create HTML for a single call card
function createCallCard(call) {
    const formattedDate = formatDate(call.date);
    
    return `
        <div class="call-card" data-call-id="${call.id}">
            <div class="call-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                </svg>
            </div>
            <div class="call-content">
                <h3 class="call-title">${escapeHtml(call.title)}</h3>
                <p class="call-description">${escapeHtml(call.summarization)}</p>
                <div class="call-metadata">
                    <span class="call-metadata-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                        </svg>
                        ${formattedDate}
                    </span>
                </div>
            </div>
        </div>
    `;
}

// Format date to human-readable format
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize the page
console.log('Setting up DOMContentLoaded listener');
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired!');
    loadCalls();
});

// Also try to load immediately if DOM is already loaded
if (document.readyState === 'loading') {
    console.log('Document still loading, waiting for DOMContentLoaded');
} else {
    console.log('Document already loaded, calling loadCalls immediately');
    loadCalls();
}
