let currentNewsletter = null;
let savedNewsletterID = null;

document.getElementById('generate-btn').addEventListener('click', async function() {
    const query = document.getElementById('newsletter-query').value.trim();
    const loading = document.getElementById('loading');
    const result = document.getElementById('result');
    const error = document.getElementById('error');
    const content = document.getElementById('newsletter-content');

    if (!query) {
        error.textContent = 'Please enter a topic';
        error.style.display = 'block';
        return;
    }

    loading.style.display = 'block';
    result.style.display = 'none';
    error.style.display = 'none';

    try {
        const response = await fetch('scripts/php/newsletters.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query, action: 'generate' })
        });

        const data = await response.json();
        loading.style.display = 'none';

        if (data.success !== false) {
            currentNewsletter = data;
            const newsletterHTML = data.content || data.html || data.body || JSON.stringify(data);
            
            // Log the response for debugging
            console.log('Newsletter response:', data);
            console.log('Title:', data.title);
            console.log('Content:', newsletterHTML);
            
            // Auto-save the newsletter and redirect to edit page
            await autoSaveNewsletter(newsletterHTML, data.title);
        } else {
            error.textContent = data.error || 'Something went wrong';
            error.style.display = 'block';
        }
    } catch (err) {
        loading.style.display = 'none';
        error.textContent = 'Error: ' + err.message;
        error.style.display = 'block';
    }
});

// Auto-save newsletter to database as draft and redirect to edit page
async function autoSaveNewsletter(content, title = null) {
    const error = document.getElementById('error');
    const loading = document.getElementById('loading');
    
    // Use provided title or extract from <h1> tag as fallback
    if (!title || title === '') {
        console.log('No title provided, extracting from content');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const h1Element = tempDiv.querySelector('h1');
        title = h1Element ? h1Element.textContent.trim() : 'Untitled Newsletter';
    }
    
    console.log('Saving with title:', title);
    console.log('Saving with content:', content);
    
    // Update loading message
    loading.style.display = 'block';
    loading.innerHTML = '<div class="spinner-border text-primary"></div><p class="mt-2">Saving newsletter...</p>';
    
    try {
        const response = await fetch('scripts/php/newsletters.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'save',
                title: title,
                content: content,
                status: 'draft'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            savedNewsletterID = data.newsletter_ID;
            console.log('Newsletter auto-saved as draft. ID: ' + savedNewsletterID);
            
            // Redirect to edit page
            window.location.href = `pages/newsletter_view.php?id=${savedNewsletterID}`;
        } else {
            loading.style.display = 'none';
            error.textContent = 'Failed to auto-save: ' + (data.error || 'Unknown error');
            error.style.display = 'block';
        }
    } catch (err) {
        loading.style.display = 'none';
        error.textContent = 'Error auto-saving: ' + err.message;
        error.style.display = 'block';
    }
}

