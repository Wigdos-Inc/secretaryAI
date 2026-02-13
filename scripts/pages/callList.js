import { db, auth } from '../modules/firebaseInit.js';
import { collection, collectionGroup, doc, getDoc, query, orderBy, limit, getDocs, startAfter, onSnapshot } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { renderSummaryFragment } from './leadDetails.js';
const callListContent = document.getElementById('callListContent') || document.getElementById('leadsList');
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
    const summarySnippet = s.summarySnippet || '';
    const score = (s.summaryScore != null) ? s.summaryScore : null;
    const grade = score != null ? (score >= 85 ? 'A' : (score >= 70 ? 'B' : 'C')) : null;
    const badgeClass = grade === 'A' ? 'grade-a' : (grade === 'B' ? 'grade-b' : (grade === 'C' ? 'grade-c' : ''));
    const hasSummary = !!s.latestSummary && !!s.latestSummary.id;
    const summaryId = hasSummary ? (s.latestSummary.id || '') : '';

    return `
      <div class="seller-row" data-seller-id="${sid}">
        <div class="seller-header d-flex justify-content-between align-items-center p-2 border rounded mb-2">
          <div>
            <strong class="seller-name">${name}</strong>
            <div class="small text-muted">Last: ${last} · Calls: ${count}</div>
            ${summarySnippet ? `<div class="small summary-snippet text-truncate">${summarySnippet}</div>` : ''}
          </div>
          <div>
            ${grade ? `<span class="badge-grade ${badgeClass}">${grade}</span>` : ''}
            ${hasSummary ? `<button class="btn btn-sm btn-primary view-summary" data-seller-id="${sid}" data-summary-id="${summaryId}">View summary</button>` : `<button class="btn btn-sm btn-outline-secondary run-analysis" data-seller-id="${sid}">Run analysis</button>`}
            <button class="btn btn-sm btn-outline-primary view-seller" data-seller-id="${sid}">View calls</button>
          </div>
        </div>
      </div>`;
  }).join('');

  callListContent.innerHTML = html;

  // attach click handlers for 'View calls', 'View summary' and 'Run analysis'
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

  callListContent.querySelectorAll('.view-summary').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const sid = btn.getAttribute('data-seller-id');
      const summaryId = btn.getAttribute('data-summary-id');
      if (!sid || !summaryId) return;
      debugLog('user clicked seller to view summary', { sid, summaryId });
      // Keep selected in localStorage for compatibility
      localStorage.setItem('selectedSeller', sid);
      localStorage.setItem('selectedSummaryId', summaryId);
      // Navigate using hash and show inline deals view
      window.location.hash = `deals?seller=${encodeURIComponent(sid)}&summary=${encodeURIComponent(summaryId)}`;
      try {
        await showDealsInline(sid, summaryId);
      } catch (err) {
        debugLog('Failed to open deals inline view', { sid, summaryId, error: err && err.message ? err.message : String(err) });
        alert('Failed to load summary. See console for details.');
      }
    });
  });

  // Hash-driven inline deals panel
  async function showDealsInline(sellerId, summaryId) {
    // prevent duplicates
    if (document.getElementById('dealsInlineBackdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'dealsInlineBackdrop';
    backdrop.className = 'summary-panel-backdrop';

    const panel = document.createElement('div');
    panel.className = 'deals-inline-panel';
    panel.id = 'dealsInlinePanel';

    panel.innerHTML = `
      <div class="summary-panel-header">
        <div class="summary-panel-title">Loading lead…</div>
        <div class="summary-panel-actions">
          <a class="btn btn-sm btn-outline-secondary open-full" href="#">Open full page</a>
          <button class="summary-panel-close" aria-label="Close">Close</button>
        </div>
      </div>
      <div class="summary-panel-body">Loading lead details…</div>
    `;

    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    function closePanel() {
      try { backdrop.remove(); } catch (e) {}
      try { window.location.hash = ''; } catch (e) {}
    }
    panel.querySelector('.summary-panel-close')?.addEventListener('click', closePanel);
    backdrop.addEventListener('click', (ev) => { if (ev.target === backdrop) closePanel(); });

    const openFull = panel.querySelector('.open-full');
    if (openFull) openFull.href = `/pages/deals.html?seller=${encodeURIComponent(sellerId)}&summary=${encodeURIComponent(summaryId)}`;

    try {
      const resp = await fetch('/pages/deals.html');
      const html = await resp.text();
      const tmp = document.createElement('div'); tmp.innerHTML = html;
      const frag = tmp.querySelector('.lead-detail-page');
      const body = panel.querySelector('.summary-panel-body');
      if (frag && body) {
        body.innerHTML = ''; body.appendChild(frag.cloneNode(true));
        // render summary into the newly-inserted fragment
        await renderSummaryFragment(sellerId, summaryId, body);
        const title = panel.querySelector('.summary-panel-title'); if (title) title.textContent = `Summary — ${localStorage.getItem('selectedSeller') || sellerId}`;
      } else {
        if (body) body.textContent = 'Failed to load lead UI';
      }
    } catch (e) {
      console.error('showDealsInline failed', e);
      const body = panel.querySelector('.summary-panel-body'); if (body) body.textContent = 'Failed to load lead details';
    }
  }

  // Activate inline view if hash indicates a deals view
  function parseHashForDeals() {
    try {
      const h = window.location.hash.replace(/^#/, '');
      if (!h) return null;
      if (!h.startsWith('deals')) return null;
      const params = new URLSearchParams(h.replace(/^deals[?&]?/, ''));
      const sid = params.get('seller');
      const sidDecoded = sid ? decodeURIComponent(sid) : null;
      const summary = params.get('summary');
      const summaryDecoded = summary ? decodeURIComponent(summary) : null;
      return sidDecoded && summaryDecoded ? { seller: sidDecoded, summary: summaryDecoded } : null;
    } catch (e) { return null; }
  }

  window.addEventListener('hashchange', () => {
    const p = parseHashForDeals();
    if (p) showDealsInline(p.seller, p.summary).catch(e => console.warn('showDealsInline from hash failed', e));
  });

  // On initial load, activate if hash present
  const initial = parseHashForDeals();
  if (initial) setTimeout(() => showDealsInline(initial.seller, initial.summary).catch(e => console.warn('showDealsInline initial load failed', e)), 50);

  // Inline panel: create, fetch summary, and render it into a page-like panel
  async function showSummaryPanel(sellerId, summaryId) {
    // Prevent duplicate panels
    if (document.getElementById('summaryPanelBackdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'summaryPanelBackdrop';
    backdrop.className = 'summary-panel-backdrop';

    const panel = document.createElement('div');
    panel.className = 'summary-panel';
    panel.id = 'summaryPanel';

    panel.innerHTML = `
      <div class="summary-panel-header">
        <div class="summary-panel-title">Loading summary…</div>
        <div class="summary-panel-actions">
          <a class="btn btn-sm btn-outline-secondary open-full" href="#">Open full page</a>
          <button class="summary-panel-close" aria-label="Close">Close</button>
        </div>
      </div>
      <div class="summary-panel-body">
        <div class="summary-panel-loader">Loading…</div>
        <div class="summary-panel-content" style="display:none">
          <div class="summary-panel-meta"><span class="summary-seller-name"></span> <span class="summary-grade badge-grade" style="margin-left:8px"></span></div>
          <div class="summary-main">
            <p class="summary-text">—</p>
            <h4>Highlights</h4>
            <ul class="summary-highlights"></ul>
            <h4>Recommended Next Actions</h4>
            <ul class="summary-actions"></ul>
          </div>
        </div>
        <div class="summary-panel-error" style="display:none;color:#b71c1c"></div>
      </div>
    `;

    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    // Hook up close
    backdrop.addEventListener('click', (ev) => { if (ev.target === backdrop) closePanel(); });
    panel.querySelector('.summary-panel-close')?.addEventListener('click', closePanel);
    document.addEventListener('keydown', escHandler);

    function escHandler(e) { if (e.key === 'Escape') closePanel(); }
    function closePanel() {
      try { document.removeEventListener('keydown', escHandler); } catch (e) {}
      try { backdrop.remove(); } catch (e) {}
    }

    // Fetch seller name
    let sellerName = sellerId;
    try {
      const udoc = await getDoc(doc(db, 'Users', sellerId));
      if (udoc && udoc.exists()) {
        const d = udoc.data() || {};
        sellerName = ((d.firstname || '') + ' ' + (d.lastname || '')).trim() || d.email || sellerId;
      } else {
        const sdoc = await getDoc(doc(db, 'Sellers', sellerId));
        if (sdoc && sdoc.exists()) { const sd = sdoc.data() || {}; sellerName = sd.name || sd.storeName || sd.email || sellerId; }
      }
    } catch (e) {
      console.warn('Failed to load seller name for panel', e);
    }

    // Update title
    panel.querySelector('.summary-panel-title').textContent = `Summary — ${sellerName}`;

    const loader = panel.querySelector('.summary-panel-loader');
    const content = panel.querySelector('.summary-panel-content');
    const errorEl = panel.querySelector('.summary-panel-error');

    // Wire "Open full page" link to real page
    const openFull = panel.querySelector('.open-full');
    if (openFull) {
      openFull.href = `/pages/deals.html?seller=${encodeURIComponent(sellerId)}&summary=${encodeURIComponent(summaryId)}`;
    }

    // Fetch summary doc
    try {
      const sdoc = await getDoc(doc(db, 'Sellers', sellerId, 'summaries', summaryId));
      if (!sdoc || !sdoc.exists()) {
        throw new Error('Summary not found');
      }
      const sdata = sdoc.data() || {};

      loader.style.display = 'none';
      content.style.display = 'block';

      const nameEl = panel.querySelector('.summary-seller-name');
      const gradeEl = panel.querySelector('.summary-grade');
      const summaryTextEl = panel.querySelector('.summary-text');
      const highsEl = panel.querySelector('.summary-highlights');
      const actionsEl = panel.querySelector('.summary-actions');

      if (nameEl) nameEl.textContent = sellerName;
      if (gradeEl) {
        const g = typeof sdata.score === 'number' ? (sdata.score >= 85 ? 'A' : (sdata.score >= 70 ? 'B' : 'C')) : '-';
        gradeEl.textContent = g;
      }
      if (summaryTextEl) summaryTextEl.textContent = sdata.summary || 'No summary provided.';

      highsEl.innerHTML = '';
      const highs = Array.isArray(sdata.highlights) ? sdata.highlights : (sdata.analysis && Array.isArray(sdata.analysis.highlights) ? sdata.analysis.highlights : []);
      if (!highs || highs.length === 0) highsEl.innerHTML = '<li>No highlights available.</li>';
      else highs.forEach(h => { const li = document.createElement('li'); li.textContent = h; highsEl.appendChild(li); });

      actionsEl.innerHTML = '';
      if (Array.isArray(sdata.recommendedNextActions) && sdata.recommendedNextActions.length) {
        sdata.recommendedNextActions.forEach(a => { const li = document.createElement('li'); li.textContent = a; actionsEl.appendChild(li); });
      } else {
        actionsEl.innerHTML = '<li>No recommended actions.</li>';
      }

    } catch (e) {
      loader.style.display = 'none';
      errorEl.style.display = 'block';
      errorEl.textContent = 'Failed to load summary. See console for details.';
      console.error('showSummaryPanel failed', e);
    }

    return new Promise(resolve => { /* resolved when panel opened; caller doesn't await close */ resolve(); });
  }

  callListContent.querySelectorAll('.run-analysis').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const sid = btn.getAttribute('data-seller-id');
      if (!sid) return;
      debugLog('user requested run-analysis for seller', sid);
      // Run analysis by posting to the n8n webhook (best-effort).
      try {
        const colRef = collection(db, 'Sellers', sid, 'calls');
        const q = query(colRef, orderBy('createdAt', 'asc'));
        const snap = await getDocs(q);
        const calls = [];
        snap.forEach(d => calls.push({ id: d.id, ...d.data() }));
        await fetch('https://harveygrowthproperties.app.n8n.cloud/webhook-test/deal-synthesis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sellerId: sid, callId: null, calls, sentAt: new Date().toISOString() }) });
        debugLog('analysis requested for seller', sid);
      } catch (err) {
        debugLog('run-analysis failed', { seller: sid, error: err.message || String(err) });
      }
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
      // Also subscribe to latest summary for each seller (real-time updates)
      if (typeof window.__summaryUnsubscribers === 'undefined') window.__summaryUnsubscribers = {};
      // Clear existing listeners
      Object.keys(window.__summaryUnsubscribers).forEach(k => {
        try { window.__summaryUnsubscribers[k](); } catch(e) {}
      });
      window.__summaryUnsubscribers = {};

      const sellerIds = Object.keys(map).slice(0, 50);
      await Promise.all(sellerIds.map(async sid => {
        try {
          const udoc = await getDoc(doc(db, 'Users', sid));
          if (udoc && udoc.exists()) {
            const ud = udoc.data() || {};
            const full = ((ud.firstname || '') + ' ' + (ud.lastname || '')).trim();
            map[sid].name = full || ud.email || sid;
          } else {
            const sdoc = await getDoc(doc(db, 'Sellers', sid));
            if (sdoc && sdoc.exists()) map[sid].name = sdoc.data().name || sdoc.data().storeName || sdoc.data().email || sid;
          }

          // Subscribe to latest summary for this seller (updates automatically)
          try {
            const summariesCol = collection(db, 'Sellers', sid, 'summaries');
            const qsum = query(summariesCol, orderBy('createdAt', 'desc'), limit(1));
            const unsub = onSnapshot(qsum, ssnap => {
              if (ssnap && ssnap.docs && ssnap.docs.length) {
                const sd = ssnap.docs[0];
                const sdata = sd.data() || {};
                map[sid].latestSummary = { id: sd.id, ...sdata };
                map[sid].summarySnippet = sdata.summary ? (sdata.summary.length > 180 ? sdata.summary.slice(0,180) + '…' : sdata.summary) : '';
                map[sid].summaryScore = (typeof sdata.score === 'number') ? sdata.score : null;
              } else {
                map[sid].latestSummary = null;
                map[sid].summarySnippet = '';
                map[sid].summaryScore = null;
              }
              // Re-render list to reflect summary change
              renderGrouped(map);
            }, err => {
              // ignore snapshot errors
            });
            window.__summaryUnsubscribers[sid] = unsub;
          } catch (e2) {
            // ignore summary listener errors
          }

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

  // Clean up summary snapshot listeners when leaving the page
  window.addEventListener('beforeunload', () => {
    if (window.__summaryUnsubscribers) {
      Object.values(window.__summaryUnsubscribers).forEach(unsub => { try { unsub(); } catch(e){} });
      window.__summaryUnsubscribers = {};
    }
  });
}
init();