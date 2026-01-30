import { db } from '../modules/firebaseInit.js';
import { collection, query, orderBy, limit, getDocs, where } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

const callListContent = document.getElementById('callListContent');
const emptyState = document.getElementById('emptyState');
const PAGE_SIZE = 25;

function formatDate(ts) {
    if (!ts) return '-';
    try {
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleString();
    } catch (e) {
        return String(ts);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function renderCalls(rows, filterSellerId) {
    if (!rows || rows.length === 0) {
        callListContent.innerHTML = '';
        emptyState.style.display = 'block';
        emptyState.innerHTML = `<p>No calls${filterSellerId ? ' for this user' : ''}.</p>`;
        return;
    }

    emptyState.style.display = 'none';

    callListContent.innerHTML = rows.map(r => {
        const data = r;
        const id = data.callId || r.id || '';
        const seller = (data.userSnapshot && ((data.userSnapshot.firstname || '') + ' ' + (data.userSnapshot.lastname || '')).trim()) || data.sellerId || 'Unknown';
        const sellerId = data.sellerId || '';
        const summary = data.summary || (data.transcript ? (data.transcript.substring(0, 200) + (data.transcript.length > 200 ? '...' : '')) : '');
        const date = formatDate(data.createdAt || data.startTime);
        const duration = data.duration != null ? `${data.duration}s` : '-';
        const recording = data.recordingUrl ? `<a href="${escapeHtml(data.recordingUrl)}" target="_blank">Play</a>` : '';

        return `
            <div class="call-card" data-call-id="${escapeHtml(id)}">
                <div class="call-icon">📞</div>
                <div class="call-content">
                    <h3 class="call-title">${escapeHtml(data.title || ('Call ' + id))}</h3>
                    <p class="call-description">${escapeHtml(summary)}</p>
                    <div class="call-metadata">
                        <span class="call-metadata-item">${escapeHtml(date)}</span>
                        <span class="call-metadata-item">Duration: ${escapeHtml(duration)}</span>
                        <span class="call-metadata-item">${recording}</span>
                        <span class="call-metadata-item">Seller: <a href="#" class="seller-link" data-seller-id="${escapeHtml(sellerId)}">${escapeHtml(seller)}</a></span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // attach seller click handlers
    callListContent.querySelectorAll('.seller-link').forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const sid = a.dataset.sellerId;
            if (!sid) return;
            // reload list filtered to this seller
            loadCalls(sid);
        });
    });
}

export async function loadCalls(filterSellerId = null) {
    if (!callListContent || !emptyState) return;
    try {
        const callsCol = collection(db, 'calls');
        let q;
        if (filterSellerId) {
            q = query(callsCol, where('sellerId', '==', filterSellerId), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
        } else {
            q = query(callsCol, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
        }

        const snap = await getDocs(q);
        const rows = [];
        snap.forEach(doc => rows.push({ id: doc.id, ...doc.data() }));

        renderCalls(rows, filterSellerId);
    } catch (err) {
        console.error('Failed to load calls:', err);
        emptyState.style.display = 'block';
        emptyState.innerHTML = `<p>Error loading calls: ${escapeHtml(err.message || String(err))}</p>`;
    }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    loadCalls();
});

// also run immediately if already loaded
if (document.readyState !== 'loading') {
    loadCalls();
}

