import { db } from '../modules/firebaseInit.js';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

function fmtDateISO(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString(); } catch { return String(iso); }
}

async function loadSellerName(sellerId) {
  try {
    const udoc = await getDoc(doc(db, 'Users', sellerId));
    if (udoc && udoc.exists()) {
      const d = udoc.data() || {};
      return ((d.firstname || '') + ' ' + (d.lastname || '')).trim() || d.email || sellerId;
    }
    const sdoc = await getDoc(doc(db, 'Sellers', sellerId));
    if (sdoc && sdoc.exists()) {
      const d = sdoc.data() || {};
      return d.name || d.storeName || d.email || sellerId;
    }
  } catch (e) {}
  return sellerId;
}

async function loadSummary(sellerId, summaryId) {
  if (!sellerId || !summaryId) return null;
  try {
    const sdoc = await getDoc(doc(db, 'Sellers', sellerId, 'summaries', summaryId));
    if (sdoc && sdoc.exists()) return { id: sdoc.id, ...sdoc.data() };
    return null;
  } catch (e) {
    console.warn('loadSummary error', e);
    // surface error to caller so we can show a user-visible message
    throw e;
  }
}

async function renderSummaryToPage(sellerId, summaryId) {
  const clientNameEl = document.getElementById('clientName');
  const callDateEl = document.getElementById('callDate');
  const summaryTextEl = document.querySelector('.summary-text');
  const highlightsEl = document.querySelector('.summary-highlights ul');
  const sentimentFill = document.querySelector('.sentiment-fill');
  const sentimentScore = document.querySelector('.sentiment-score');
  const gradeBadge = document.getElementById('gradeBadge');

  // Loader / error UI
  const loaderEl = document.getElementById('leadLoader');
  const errorEl = document.getElementById('leadError');
  function showLoader(on) { if (loaderEl) loaderEl.style.display = on ? 'block' : 'none'; }
  function showError(msg) { if (errorEl) { errorEl.style.display = msg ? 'block' : 'none'; errorEl.textContent = msg || ''; } }

  // Clear placeholders to avoid showing stale dummy data
  if (clientNameEl) clientNameEl.textContent = 'Loading...';
  if (callDateEl) callDateEl.textContent = '-';
  if (summaryTextEl) summaryTextEl.textContent = 'Loading summary…';
  if (highlightsEl) highlightsEl.innerHTML = '<li>Loading highlights…</li>';
  if (sentimentFill) sentimentFill.style.width = '0%';
  if (sentimentScore) sentimentScore.textContent = '0%';
  if (gradeBadge) gradeBadge.textContent = '—';
  showError('');
  showLoader(true);

  const sellerName = await loadSellerName(sellerId);
  if (clientNameEl) clientNameEl.textContent = sellerName;

  let summary;
  try {
    summary = await loadSummary(sellerId, summaryId);
  } catch (e) {
    showLoader(false);
    showError('Failed to load summary. This may be a permissions or network issue. Check console for details.');
    console.error('renderSummaryToPage: loadSummary failed', e);
    // Clear details so dummy content is not shown
    if (summaryTextEl) summaryTextEl.textContent = 'Unable to load summary.';
    if (highlightsEl) highlightsEl.innerHTML = '<li>No highlights available.</li>';
    return;
  }

  if (!summary) {
    showLoader(false);
    if (summaryTextEl) summaryTextEl.textContent = 'Summary not found.';
    if (highlightsEl) highlightsEl.innerHTML = '<li>No highlights available.</li>';
    return;
  }

  if (callDateEl) callDateEl.textContent = fmtDateISO(summary.createdAt && summary.createdAt.toDate ? summary.createdAt.toDate() : summary.createdAt || summary.sentAt);
  if (summaryTextEl) summaryTextEl.textContent = summary.summary || 'No summary provided.';

  // Highlights
  if (highlightsEl) {
    highlightsEl.innerHTML = '';
    if (Array.isArray(summary.highlights) && summary.highlights.length) {
      for (const h of summary.highlights) {
        const li = document.createElement('li');
        li.textContent = h;
        highlightsEl.appendChild(li);
      }
    } else if (summary.extractedFacts && Object.keys(summary.extractedFacts).length) {
      // fallback to listing some facts
      for (const k of Object.keys(summary.extractedFacts)) {
        const li = document.createElement('li');
        li.textContent = `${k}: ${JSON.stringify(summary.extractedFacts[k])}`;
        highlightsEl.appendChild(li);
      }
    } else {
      highlightsEl.innerHTML = '<li>No highlights available.</li>';
    }
  }

  // Sentiment
  const sent = typeof summary.sentiment === 'number' ? summary.sentiment : null;
  if (sentimentFill) sentimentFill.style.width = (sent != null ? `${Math.max(0, Math.min(100, sent))}%` : '0%');
  if (sentimentScore) sentimentScore.textContent = sent != null ? `${sent}%` : '0%';

  // Grade
  const score = typeof summary.score === 'number' ? summary.score : null;
  if (gradeBadge) {
    const grade = score != null ? (score >= 85 ? 'A' : (score >= 70 ? 'B' : 'C')) : '—';
    gradeBadge.textContent = grade;
    gradeBadge.className = `grade-badge grade-${grade === 'A' ? 'a' : grade === 'B' ? 'b' : grade === 'C' ? 'c' : 'unknown'}`;
  }

  // Recommended next actions (append to summary-content)
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'mt-2';
  if (Array.isArray(summary.recommendedNextActions) && summary.recommendedNextActions.length) {
    const h3 = document.createElement('h3'); h3.textContent = 'Recommended Next Actions';
    const ul = document.createElement('ul');
    summary.recommendedNextActions.forEach(a => { const li = document.createElement('li'); li.textContent = a; ul.appendChild(li); });
    actionsContainer.appendChild(h3); actionsContainer.appendChild(ul);
  }
  // Append actions to summary-content if not already there
  const summaryContent = document.getElementById('summary-content');
  if (summaryContent && actionsContainer.childNodes.length) {
    // remove any previous appended actions to avoid duplication
    const existing = summaryContent.querySelector('.recommended-actions');
    if (existing) existing.remove();
    actionsContainer.classList.add('recommended-actions');
    summaryContent.appendChild(actionsContainer);
  }

  // Source calls: show excerpts
  const srcContainer = document.createElement('div');
  srcContainer.className = 'mt-2';
  if (Array.isArray(summary.sourceCalls) && summary.sourceCalls.length) {
    const h3 = document.createElement('h3'); h3.textContent = 'Source Calls';
    const ul = document.createElement('ul');
    summary.sourceCalls.forEach(s => {
      const li = document.createElement('li');
      const when = s.createdAt || '';
      li.innerHTML = `${when ? `<strong>${fmtDateISO(when)}</strong> — ` : ''}${s.excerpt || ''}`;
      ul.appendChild(li);
    });
    srcContainer.appendChild(h3); srcContainer.appendChild(ul);
  }
  if (summaryContent && srcContainer.childNodes.length) {
    const existing = summaryContent.querySelector('.source-calls');
    if (existing) existing.remove();
    srcContainer.classList.add('source-calls');
    summaryContent.appendChild(srcContainer);
  }

  // Hide loader and clear errors
  try { showLoader(false); showError(''); } catch (e) {}

  // Friendly grade label
  const gradeLabelEl = document.getElementById('gradeLabel');
  if (gradeLabelEl) gradeLabelEl.textContent = (score == null ? '-' : (score >= 85 ? 'Excellent Call' : (score >= 70 ? 'Good Call' : 'Needs Follow-up')));

  // Populate quality indicators and metrics if present in summary.analysis
  try {
    const analysis = summary.analysis || {};
    const interestEl = document.getElementById('interestLevel');
    const financeEl = document.getElementById('financialReadiness');
    const timelineEl = document.getElementById('timelineUrgency');
    if (interestEl) interestEl.textContent = analysis.interestLevel || (analysis.quality && analysis.quality.interestLevel) || analysis.interest || '-';
    if (financeEl) financeEl.textContent = analysis.financialReadiness || (analysis.quality && analysis.quality.financialReadiness) || analysis.financial || '-';
    if (timelineEl) timelineEl.textContent = analysis.timelineUrgency || (analysis.quality && analysis.quality.timelineUrgency) || analysis.timeline || '-';

    // metrics
    const convEl = document.getElementById('conversationFlow');
    const respEl = document.getElementById('responseAccuracy');
    const satEl = document.getElementById('clientSatisfaction');
    const metrics = analysis.metrics || analysis.performance || {};
    if (convEl) convEl.textContent = metrics.conversationFlow != null ? metrics.conversationFlow : (metrics.flow != null ? metrics.flow : '-');
    if (respEl) respEl.textContent = metrics.responseAccuracy != null ? metrics.responseAccuracy : (metrics.accuracy != null ? metrics.accuracy : '-');
    if (satEl) satEl.textContent = metrics.clientSatisfaction != null ? metrics.clientSatisfaction : (metrics.satisfaction != null ? metrics.satisfaction : '-');
  } catch (e) {
    console.warn('Failed to populate analysis/metrics', e);
  }

  // If there's a focal call, fetch call to populate client/contact fields and transcript
  if (summary.focalCallId) {
    try {
      const cref = doc(db, 'Sellers', sellerId, 'calls', summary.focalCallId);
      const cdoc = await getDoc(cref);
      if (cdoc && cdoc.exists()) {
        const cdata = cdoc.data() || {};
        if (clientNameEl) clientNameEl.textContent = (cdata.clientName || cdata.target || (cdata.userSnapshot && (cdata.userSnapshot.firstname ? (cdata.userSnapshot.firstname + ' ' + (cdata.userSnapshot.lastname || '')) : cdata.userSnapshot.email)) || 'Unknown');
        if (callDateEl) callDateEl.textContent = (cdata.startTime && cdata.startTime.toDate) ? cdata.startTime.toDate().toLocaleString() : (cdata.createdAt && cdata.createdAt.toDate) ? cdata.createdAt.toDate().toLocaleString() : '-';
        if (callDurationEl) callDurationEl.textContent = cdata.duration != null ? `${cdata.duration}s` : '-';
        if (callStatusEl) callStatusEl.textContent = cdata.status || '-';

        if (clientPhoneEl) clientPhoneEl.textContent = (cdata.userSnapshot && cdata.userSnapshot.phone) ? cdata.userSnapshot.phone : (cdata.phone || '-');
        if (clientEmailEl) clientEmailEl.textContent = (cdata.userSnapshot && cdata.userSnapshot.email) ? cdata.userSnapshot.email : (cdata.email || '-');
        if (propertyAddressEl) propertyAddressEl.textContent = cdata.propertyAddress || '-';
        if (callTypeEl) callTypeEl.textContent = cdata.callType || '-';

        // Render transcript if present
        try {
          const t = cdata.transcript || '';
          const tList = document.getElementById('transcriptList');
          if (tList) {
            tList.innerHTML = '';
            if (!t) {
              const note = document.createElement('div'); note.className = 'transcript-note'; note.innerHTML = '<em>No transcript available.</em>'; tList.appendChild(note);
            } else {
              const lines = t.split('\n').map(l => l.trim()).filter(Boolean);
              for (const ln of lines) {
                const msg = document.createElement('div');
                msg.className = ln.startsWith('AI:') || ln.startsWith('Agent:') ? 'transcript-message ai' : 'transcript-message client';
                const avatar = document.createElement('div'); avatar.className = 'transcript-avatar'; avatar.textContent = ln.startsWith('AI:') || ln.startsWith('Agent:') ? 'AI' : 'CL';
                const content = document.createElement('div'); content.className = 'transcript-content';
                const ts = document.createElement('div'); ts.className = 'transcript-timestamp'; ts.textContent = '';
                const text = document.createElement('div'); text.className = 'transcript-text'; text.textContent = ln.replace(/^(AI:|Agent:|User:|Client:)/i, '').trim();
                content.appendChild(ts); content.appendChild(text);
                msg.appendChild(avatar); msg.appendChild(content);
                tList.appendChild(msg);
              }
            }
          }
        } catch (e) { console.warn('Failed to render transcript', e); }
      }
    } catch (e) {
      console.warn('Failed to fetch focal call for summary', e);
    }
  } else {
    // If no focal call, try to show excerpts from summary.sourceCalls
    if (Array.isArray(summary.sourceCalls) && summary.sourceCalls.length) {
      try {
        const tList = document.getElementById('transcriptList');
        if (tList) {
          tList.innerHTML = '';
          for (const s of summary.sourceCalls) {
            const note = document.createElement('div'); note.className = 'transcript-note'; note.innerHTML = `${fmtDateISO(s.createdAt || s.startTime)} — ${s.excerpt || ''}`; tList.appendChild(note);
          }
        }
      } catch (e) { console.warn('Failed to render sourceCalls excerpts', e); }
    }
  }
}

// Run analysis button handler (if user wants to trigger a re-run from this page)
async function runAnalysisForSeller(sellerId) {
  try {
    const colRef = collection(db, 'Sellers', sellerId, 'calls');
    const q = query(colRef, orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    const calls = [];
    snap.forEach(d => calls.push({ id: d.id, ...d.data() }));
    await fetch('https://harveygrowthproperties.app.n8n.cloud/webhook-test/deal-synthesis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sellerId, callId: null, calls, sentAt: new Date().toISOString() }) });
    alert('Analysis requested — refresh the page in a few seconds to see the result.');
  } catch (e) {
    console.error('runAnalysis failed', e);
    alert('Failed to request analysis: ' + (e.message || e));
  }
}

// Page init: read selectedSeller and selectedSummaryId from localStorage or URL
async function init() {
  const url = new URL(window.location.href);
  const sellerParam = url.searchParams.get('seller') || localStorage.getItem('selectedSeller');
  const summaryParam = url.searchParams.get('summary') || localStorage.getItem('selectedSummaryId');
  // If no seller was specified, attempt to load the currently signed-in user's latest summary
  let effectiveSeller = sellerParam;
  let effectiveSummary = summaryParam;

  if (!effectiveSeller) {
    // Wait briefly for auth to be present
    let attempts = 0;
    while ((!auth || !auth.currentUser) && attempts < 20) {
      await new Promise(r => setTimeout(r, 100)); attempts++;
    }
    if (auth && auth.currentUser) effectiveSeller = auth.currentUser.uid;
  }

  // If we still don't have a seller, show a helpful message and a link back to Leads
  if (!effectiveSeller) {
    const summaryTextEl = document.querySelector('.summary-text');
    if (summaryTextEl) summaryTextEl.textContent = 'No lead selected. Go to the Leads page to pick a lead or run an analysis.';

    const btn = document.createElement('a');
    btn.className = 'btn btn-primary mt-2';
    btn.textContent = 'Open Leads';
    btn.href = '/pages/callList.html#leads';
    document.querySelector('.call-header')?.appendChild(btn);
    return;
  }

  // If seller present but no summaryId, try to fetch the latest summary for this seller
  if (!effectiveSummary) {
    try {
      const colRef = collection(db, 'Sellers', effectiveSeller, 'summaries');
      const q = query(colRef, orderBy('createdAt', 'desc'), limit(1));
      const snap = await getDocs(q);
      if (snap && snap.docs && snap.docs.length) {
        effectiveSummary = snap.docs[0].id;
      }
    } catch (e) {
      console.warn('Failed to fetch latest summary for seller', e);
    }

    // If no summary found, show Run analysis CTA
    if (!effectiveSummary) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = 'Run analysis for this lead';
      btn.addEventListener('click', () => runAnalysisForSeller(effectiveSeller));
      document.querySelector('.call-header')?.appendChild(btn);

      const summaryTextEl = document.querySelector('.summary-text');
      if (summaryTextEl) summaryTextEl.textContent = 'No summary yet for this lead. You can run analysis to generate one.';
      return;
    }
  }

  // If we have a summary to show, render it
  if (effectiveSummary) {
    await renderSummaryToPage(effectiveSeller, effectiveSummary);
  }
}

document.addEventListener('DOMContentLoaded', init);

// Export fragment renderer for inline embedding
export async function renderSummaryFragment(sellerId, summaryId, root = document) {
  // Scoped element selectors within `root` so this can render into a fetched fragment
  const clientNameEl = root.querySelector('#clientName');
  const callDateEl = root.querySelector('#callDate');
  const callDurationEl = root.querySelector('#callDuration');
  const callStatusEl = root.querySelector('#callStatus');
  const gradeBadgeEl = root.querySelector('#gradeBadge');

  const clientPhoneEl = root.querySelector('#clientPhone');
  const clientEmailEl = root.querySelector('#clientEmail');
  const propertyAddressEl = root.querySelector('#propertyAddress');
  const callTypeEl = root.querySelector('#callType');

  const summaryTextEl = root.querySelector('.summary-text');
  const highlightsEl = root.querySelector('.summary-highlights ul');
  const loaderEl = root.querySelector('#leadLoader');
  const errorEl = root.querySelector('#leadError');
  const sentimentFillEl = root.querySelector('.sentiment-fill');
  const sentimentScoreEl = root.querySelector('.sentiment-score');
  const transcriptList = root.querySelector('#transcriptList');

  function showLoader(on) { if (loaderEl) loaderEl.style.display = on ? 'block' : 'none'; }
  function showError(msg) { if (errorEl) { errorEl.style.display = msg ? 'block' : 'none'; errorEl.textContent = msg || ''; } }

  // Clear placeholders
  if (clientNameEl) clientNameEl.textContent = 'Loading...';
  if (callDateEl) callDateEl.textContent = '-';
  if (callDurationEl) callDurationEl.textContent = '-';
  if (callStatusEl) callStatusEl.textContent = '-';
  if (clientPhoneEl) clientPhoneEl.textContent = '-';
  if (clientEmailEl) clientEmailEl.textContent = '-';
  if (propertyAddressEl) propertyAddressEl.textContent = '-';
  if (callTypeEl) callTypeEl.textContent = '-';
  if (summaryTextEl) summaryTextEl.textContent = 'Loading summary…';
  if (highlightsEl) highlightsEl.innerHTML = '<li>Loading highlights…</li>';
  if (sentimentFillEl) sentimentFillEl.style.width = '0%';
  if (sentimentScoreEl) sentimentScoreEl.textContent = '-';
  showLoader(true); showError('');

  try {
    const sellerName = await loadSellerName(sellerId);
    if (clientNameEl) clientNameEl.textContent = sellerName;

    const summary = await loadSummary(sellerId, summaryId);
    if (!summary) {
      showLoader(false);
      if (summaryTextEl) summaryTextEl.textContent = 'Summary not found.';
      if (highlightsEl) highlightsEl.innerHTML = '<li>No highlights available.</li>';
      return;
    }

    if (callDateEl) callDateEl.textContent = fmtDateISO(summary.createdAt && summary.createdAt.toDate ? summary.createdAt.toDate() : summary.createdAt || summary.sentAt);
    if (summaryTextEl) summaryTextEl.textContent = summary.summary || 'No summary provided.';

    // Highlights
    if (highlightsEl) {
      highlightsEl.innerHTML = '';
      if (Array.isArray(summary.highlights) && summary.highlights.length) {
        for (const h of summary.highlights) {
          const li = document.createElement('li'); li.textContent = h; highlightsEl.appendChild(li);
        }
      } else if (summary.extractedFacts && Object.keys(summary.extractedFacts).length) {
        for (const k of Object.keys(summary.extractedFacts)) {
          const li = document.createElement('li'); li.textContent = `${k}: ${JSON.stringify(summary.extractedFacts[k])}`; highlightsEl.appendChild(li);
        }
      } else {
        highlightsEl.innerHTML = '<li>No highlights available.</li>';
      }
    }

    // Sentiment
    const sent = typeof summary.sentiment === 'number' ? summary.sentiment : null;
    if (sentimentFillEl) sentimentFillEl.style.width = (sent != null ? `${Math.max(0, Math.min(100, sent))}%` : '0%');
    if (sentimentScoreEl) sentimentScoreEl.textContent = sent != null ? `${sent}% Positive` : '-';

    // Grade
    const score = typeof summary.score === 'number' ? summary.score : null;
    if (gradeBadgeEl) {
      const grade = score != null ? (score >= 85 ? 'A' : (score >= 70 ? 'B' : 'C')) : '—';
      gradeBadgeEl.textContent = grade;
      gradeBadgeEl.className = `grade-badge grade-${grade === 'A' ? 'a' : grade === 'B' ? 'b' : grade === 'C' ? 'c' : 'unknown'}`;
    }

    // Populate analysis/metrics
    try {
      const analysis = summary.analysis || {};
      const interestEl = root.querySelector('#interestLevel');
      const financeEl = root.querySelector('#financialReadiness');
      const timelineEl = root.querySelector('#timelineUrgency');
      if (interestEl) interestEl.textContent = analysis.interestLevel || (analysis.quality && analysis.quality.interestLevel) || analysis.interest || '-';
      if (financeEl) financeEl.textContent = analysis.financialReadiness || (analysis.quality && analysis.quality.financialReadiness) || analysis.financial || '-';
      if (timelineEl) timelineEl.textContent = analysis.timelineUrgency || (analysis.quality && analysis.quality.timelineUrgency) || analysis.timeline || '-';

      const convEl = root.querySelector('#conversationFlow');
      const respEl = root.querySelector('#responseAccuracy');
      const satEl = root.querySelector('#clientSatisfaction');
      const metrics = analysis.metrics || analysis.performance || {};
      if (convEl) convEl.textContent = metrics.conversationFlow != null ? metrics.conversationFlow : (metrics.flow != null ? metrics.flow : '-');
      if (respEl) respEl.textContent = metrics.responseAccuracy != null ? metrics.responseAccuracy : (metrics.accuracy != null ? metrics.accuracy : '-');
      if (satEl) satEl.textContent = metrics.clientSatisfaction != null ? metrics.clientSatisfaction : (metrics.satisfaction != null ? metrics.satisfaction : '-');
    } catch (e) { console.warn('Failed to populate analysis/metrics', e); }

    // Render focal call or source call transcripts
    if (summary.focalCallId) {
      try {
        const cref = doc(db, 'Sellers', sellerId, 'calls', summary.focalCallId);
        const cdoc = await getDoc(cref);
        if (cdoc && cdoc.exists()) {
          const cdata = cdoc.data() || {};
          if (clientPhoneEl) clientPhoneEl.textContent = (cdata.userSnapshot && cdata.userSnapshot.phone) ? cdata.userSnapshot.phone : (cdata.phone || '-');
          if (clientEmailEl) clientEmailEl.textContent = (cdata.userSnapshot && cdata.userSnapshot.email) ? cdata.userSnapshot.email : (cdata.email || '-');
          if (propertyAddressEl) propertyAddressEl.textContent = cdata.propertyAddress || '-';
          if (callTypeEl) callTypeEl.textContent = cdata.callType || '-';

          // transcript
          if (transcriptList) {
            transcriptList.innerHTML = '';
            const t = cdata.transcript || '';
            if (!t) { const note = document.createElement('div'); note.className = 'transcript-note'; note.innerHTML = '<em>No transcript available.</em>'; transcriptList.appendChild(note); }
            else {
              const lines = t.split('\n').map(l => l.trim()).filter(Boolean);
              for (const ln of lines) {
                const msg = document.createElement('div');
                msg.className = ln.startsWith('AI:') || ln.startsWith('Agent:') ? 'transcript-message ai' : 'transcript-message client';
                const avatar = document.createElement('div'); avatar.className = 'transcript-avatar'; avatar.textContent = ln.startsWith('AI:') || ln.startsWith('Agent:') ? 'AI' : 'CL';
                const content = document.createElement('div'); content.className = 'transcript-content';
                const ts = document.createElement('div'); ts.className = 'transcript-timestamp'; ts.textContent = '';
                const text = document.createElement('div'); text.className = 'transcript-text'; text.textContent = ln.replace(/^(AI:|Agent:|User:|Client:)/i, '').trim();
                content.appendChild(ts); content.appendChild(text);
                msg.appendChild(avatar); msg.appendChild(content);
                transcriptList.appendChild(msg);
              }
            }
          }
        }
      } catch (e) { console.warn('Failed to fetch focal call for summary', e); }
    } else if (Array.isArray(summary.sourceCalls) && summary.sourceCalls.length) {
      try {
        if (transcriptList) {
          transcriptList.innerHTML = '';
          for (const s of summary.sourceCalls) { const note = document.createElement('div'); note.className = 'transcript-note'; note.innerHTML = `${fmtDateISO(s.createdAt || s.startTime)} — ${s.excerpt || ''}`; transcriptList.appendChild(note); }
        }
      } catch (e) { console.warn('Failed to render sourceCalls excerpts', e); }
    }

    showLoader(false);
  } catch (e) {
    showLoader(false); showError('Failed to load summary. See console for details.'); console.error('renderSummaryFragment failed', e);
  }
}

export async function renderLeadDetails() {
  return init();
}
