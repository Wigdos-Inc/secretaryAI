import { db, auth } from '../modules/firebaseInit.js';
import { collection, collectionGroup, doc, getDoc, query, orderBy, limit, getDocs, startAfter } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
const callListContent = document.getElementById('callListContent');
const emptyState = document.getElementById('emptyState');
const PAGE_SIZE = 25;
// UI elements for seller view controls
const toolbar = document.getElementById('callListToolbar');
const sortToggle = document.getElementById('sortToggle');
const loadMoreBtn = document.getElementById('loadMore');
const backBtn = document.getElementById('backToGroups');
const titleEl = document.querySelector('.call-list-title');

// State for pagination and current view
let currentSeller = null;
let currentSort = 'desc'; // 'desc' = newest first, 'asc' = oldest first
let lastVisible = null;
let moreAvailable = false;

// Debug log helper: append messages to #debugLog and console.debug
function debugLog(msg, obj) {
  try {
    const container = document.getElementById('debugLog');
    const time = new Date().toISOString();
    const line = document.createElement('div');
    line.textContent = `[${time}] ${msg}` + (obj ? ' ' + (typeof obj === 'string' ? obj : JSON.stringify(obj)) : '');
    if (container) {
      container.appendChild(line);
      container.scrollTop = container.scrollHeight;
    }
  } catch (e) {
    // ignore
  }
  try { console.debug('[CallList]', msg, obj || ''); } catch (e) {}
}

function fmtDate(ts) {
  if (!ts) return '-';
  try { return (ts.toDate ? ts.toDate() : new Date(ts)).toLocaleString(); } catch { return String(ts); }
}

// Render a flat list of calls (for a single seller view)
function render(rows) {
  debugLog('render() called, rows.length=' + (rows ? rows.length : 0));
  if (!rows || rows.length === 0) {
    callListContent.innerHTML = '';
    emptyState.style.display = 'block';
    emptyState.innerHTML = '<p>No calls found.</p>';
    return;
  }

  emptyState.style.display = 'none';
  callListContent.innerHTML = rows.map(r => {
    debugLog('render: rendering row id=' + (r.callId || r.id || '(no-id)'));
    const id = r.callId || r.id || '';
    const snippet = r.transcript ? (r.transcript.length > 200 ? r.transcript.slice(0,200) + '…' : r.transcript) : '';
    const date = fmtDate(r.createdAt || r.startTime);
    const duration = r.duration != null ? `${r.duration}s` : '-';
    const rec = r.recordingUrl ? `<a href="${r.recordingUrl}" target="_blank">Recording</a>` : '';
    return `
      <div class="call-card" data-call-id="${id}">
        <div class="call-content">
          <div class="call-meta small text-muted">${date} · ${duration}</div>
          <div class="call-body">${snippet}</div>
          <div class="call-actions mt-2">${rec}</div>
        </div>
      </div>`;
  }).join('');
}

// Render grouped sellers list: each seller shows summary and click to expand/load
function renderGrouped(sellerMap) {
  debugLog('renderGrouped() called, sellers=' + Object.keys(sellerMap).length);
  if (!sellerMap || Object.keys(sellerMap).length === 0) {
    callListContent.innerHTML = '';
    emptyState.style.display = 'block';
    emptyState.innerHTML = '<p>No sellers or calls found.</p>';
    return;
  }

  emptyState.style.display = 'none';
  const sortedSellers = Object.keys(sellerMap).sort((a,b) => {
    const ta = sellerMap[a].lastCall || 0;
    const tb = sellerMap[b].lastCall || 0;
    const va = (ta.seconds != null) ? ta.seconds : (new Date(ta)).getTime();
    const vb = (tb.seconds != null) ? tb.seconds : (new Date(tb)).getTime();
    return vb - va; // most recent first
  });

  const html = sortedSellers.map(sid => {
    const s = sellerMap[sid];
    const name = s.name || sid;
    const count = s.calls.length || 0;
    const last = s.lastCall ? fmtDate(s.lastCall) : '-';
    return `
      <div class="seller-row" data-seller-id="${sid}">
        <div class="seller-header d-flex justify-content-between align-items-center p-2 border rounded mb-2">
          <div>
            <strong class="seller-name">${name}</strong>
            <div class="small text-muted">Last: ${last} · Calls: ${count}</div>
          </div>
          <div>
            <button class="btn btn-sm btn-outline-primary view-seller" data-seller-id="${sid}">View calls</button>
          </div>
        </div>
      </div>`;
  }).join('');

  callListContent.innerHTML = html;

  // attach click handlers for 'View calls'
  callListContent.querySelectorAll('.view-seller').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const sid = btn.getAttribute('data-seller-id');
      if (!sid) return;
      debugLog('user clicked seller to view calls', sid);
      // show toolbar and load seller's first page
      showToolbarForSeller(sid);
      await loadCallsForSeller(sid);
    });
  });
}

function showToolbarForSeller(sellerId) {
  currentSeller = sellerId;
  lastVisible = null;
  moreAvailable = false;
  // Default to chronological (oldest -> newest) when viewing a single user's calls
  currentSort = 'asc';
  if (toolbar) toolbar.style.display = 'flex';
  updateSortButton();
  if (loadMoreBtn) loadMoreBtn.style.display = 'none';
  // Show seller name when available (best-effort). Prefer Users/{id} for full name.
  if (titleEl) titleEl.textContent = `Calls for ${sellerId}`;
  try {
    getDoc(doc(db, 'Users', sellerId)).then(udoc => {
      if (udoc && udoc.exists()) {
        const data = udoc.data() || {};
        const full = ((data.firstname || '') + ' ' + (data.lastname || '')).trim();
        const name = full || data.email || sellerId;
        if (titleEl) titleEl.textContent = `Calls for ${name}`;
      } else {
        // Fallback to Sellers
        getDoc(doc(db, 'Sellers', sellerId)).then(sdoc => {
          if (sdoc && sdoc.exists()) {
            const data = sdoc.data() || {};
            const name = data.name || data.storeName || data.email || sellerId;
            if (titleEl) titleEl.textContent = `Calls for ${name}`;
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  } catch (e) {}
}

function hideToolbar() {
  currentSeller = null;
  lastVisible = null;
  moreAvailable = false;
  if (toolbar) toolbar.style.display = 'none';
  if (titleEl) titleEl.textContent = 'Call History';
}

function updateSortButton() {
  if (!sortToggle) return;
  sortToggle.textContent = currentSort === 'desc' ? 'Newest' : 'Oldest';
}

async function loadCalls() {
  debugLog('loadCalls() start');
  if (!callListContent || !emptyState) return;

  // Wait for a signed-in user (simple polling, fast and reliable in SPA)
  let user = auth && auth.currentUser ? auth.currentUser : null;
  const start = Date.now();
  while (!user && Date.now() - start < 3000) {
    await new Promise(r => setTimeout(r, 100));
    user = auth && auth.currentUser ? auth.currentUser : null;
  }

  if (!user) {
    emptyState.style.display = 'block';
    emptyState.innerHTML = '<p>Please sign in to view your calls.</p>';
    debugLog('No authenticated user after wait; aborting loadCalls');
    return;
  }

  emptyState.style.display = 'block';
  emptyState.innerHTML = '<p>Loading your calls…</p>';
  debugLog('Authenticated user', { uid: user.uid, email: user.email || null });

  try {
    // First try a collectionGroup to present a grouped view of recent calls by seller.
    try {
      const cg = collectionGroup(db, 'calls');
      const q = query(cg, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
      debugLog('Trying collectionGroup query for grouping', { orderBy: 'createdAt desc', limit: PAGE_SIZE });
      const snap = await getDocs(q);
      const rows = [];
      snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

      // Group by sellerId
      const map = {};
      for (const r of rows) {
        const sid = r.sellerId || r.seller || 'unknown';
        map[sid] = map[sid] || { name: null, calls: [], lastCall: null };
        map[sid].calls.push(r);
        const ts = r.createdAt || r.startTime || null;
        if (ts && (!map[sid].lastCall || (ts.seconds || ts) > (map[sid].lastCall.seconds || map[sid].lastCall))) {
          map[sid].lastCall = ts;
        }
      }

      // Best-effort resolve seller names: prefer Users/{id} (full name), fallback to Sellers/{id}
      const sellerIds = Object.keys(map).slice(0, 50);
      await Promise.all(sellerIds.map(async sid => {
        try {
          const udoc = await getDoc(doc(db, 'Users', sid));
          if (udoc && udoc.exists()) {
            const ud = udoc.data() || {};
            const full = ((ud.firstname || '') + ' ' + (ud.lastname || '')).trim();
            map[sid].name = full || ud.email || sid;
            return;
          }

          const sdoc = await getDoc(doc(db, 'Sellers', sid));
          if (sdoc && sdoc.exists()) map[sid].name = sdoc.data().name || sdoc.data().storeName || sdoc.data().email || sid;
        } catch (e) {}
      }));

      hideToolbar();
      renderGrouped(map);
      return;
    } catch (cgErr) {
      debugLog('collectionGroup failed; falling back to owner-only subcollection', { message: cgErr.message || String(cgErr) });
    }

    // Fallback: show current user's calls (owner-only). Treat the owner as the
    // currently selected seller so toolbar controls (sort/load more) work.
    debugLog('Falling back to owner-only subcollection view', { seller: user.uid });
    showToolbarForSeller(user.uid);
    await loadCallsForSeller(user.uid, false);
    return;
  } catch (err) {
    console.error('loadCalls error', err);
    debugLog('loadCalls error', { message: err.message || String(err), code: err.code || null });
    emptyState.style.display = 'block';
    emptyState.innerHTML = `<p>Error loading calls: ${err.message || err}</p>`;
  }
}

// Load a page of calls for a specific seller. If append=true, append to existing list.
async function loadCallsForSeller(sellerId, append = false) {
  debugLog('loadCallsForSeller', { sellerId, append, sort: currentSort });
  if (!sellerId) return;
  try {
    const colRef = collection(db, 'Sellers', sellerId, 'calls');
    let q = null;
    if (append && lastVisible) {
      q = query(colRef, orderBy('createdAt', currentSort), startAfter(lastVisible), limit(PAGE_SIZE));
    } else {
      q = query(colRef, orderBy('createdAt', currentSort), limit(PAGE_SIZE));
    }
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

    // Update cursor
    lastVisible = snap.docs && snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
    moreAvailable = snap.docs && snap.docs.length === PAGE_SIZE;
    if (loadMoreBtn) loadMoreBtn.style.display = moreAvailable ? 'inline-block' : 'none';

    if (append) {
      appendRows(rows);
    } else {
      render(rows);
    }
  } catch (e) {
    debugLog('loadCallsForSeller error', { sellerId, message: e.message || String(e) });
    emptyState.style.display = 'block';
    emptyState.innerHTML = `<p>Error loading calls for seller ${sellerId}: ${e.message || e}</p>`;
  }
}

function appendRows(rows) {
  if (!rows || rows.length === 0) return;
  const html = rows.map(r => {
    const id = r.callId || r.id || '';
    const snippet = r.transcript ? (r.transcript.length > 200 ? r.transcript.slice(0,200) + '…' : r.transcript) : '';
    const date = fmtDate(r.createdAt || r.startTime);
    const duration = r.duration != null ? `${r.duration}s` : '-';
    const rec = r.recordingUrl ? `<a href="${r.recordingUrl}" target="_blank">Recording</a>` : '';
    return `
      <div class="call-card" data-call-id="${id}">
        <div class="call-content">
          <div class="call-meta small text-muted">${date} · ${duration}</div>
          <div class="call-body">${snippet}</div>
          <div class="call-actions mt-2">${rec}</div>
        </div>
      </div>`;
  }).join('');
  callListContent.insertAdjacentHTML('beforeend', html);
}

function init() {
  if (sortToggle) {
    sortToggle.addEventListener('click', () => {
      currentSort = currentSort === 'desc' ? 'asc' : 'desc';
      updateSortButton();
      if (currentSeller) loadCallsForSeller(currentSeller, false);
    });
  }
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      if (currentSeller) loadCallsForSeller(currentSeller, true);
    });
  }
  if (backBtn) {
    backBtn.addEventListener('click', async () => {
      hideToolbar();
      await loadCalls();
    });
  }

  document.addEventListener('DOMContentLoaded', loadCalls);
  if (document.readyState !== 'loading') loadCalls();
}
init();