import { dbAddDoc, dbSetDoc, COLLECTIONS } from '../modules/db.js';
import { serverTimestamp, collection, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { auth, db } from '../modules/firebaseInit.js';

// Simple voice-call UI wiring and Firestore lifecycle writes
let startBtn;
let endBtn;
let muteBtn;
let transcriptEl;
let logEl;

let currentCall = null; // { id, localStartTs }
let muted = false;
let statusBadge = null;

function log(msg) {
    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.textContent = `[${time}] ${msg}`;
    if (logEl) {
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
    } else {
        console.debug(line.textContent);
    }
}

function setStatus(text, variant = 'secondary') {
    try {
        if (!statusBadge) statusBadge = document.getElementById('callStatusBadge');
        if (!statusBadge) return;
        statusBadge.textContent = text;
        statusBadge.className = 'badge bg-' + variant;
    } catch (e) { /* ignore */ }
}

function getSessionId() {
    try {
        const ud = JSON.parse(localStorage.getItem('userData') || 'null');
        return ud && ud.uid ? ud.uid : null;
    } catch (e) {
        return null;
    }
}

function getUserSnapshot() {
    try {
        const ud = JSON.parse(localStorage.getItem('userData') || 'null');
        if (!ud) return null;
        return {
            uid: ud.uid || null,
            firstname: ud.firstname || null,
            lastname: ud.lastname || null,
            email: ud.email || null,
            phone: ud.phone || null,
        };
    } catch (e) {
        return null;
    }
}

function populateSellerInfo() {
    const infoEl = document.getElementById('sellerInfo');
    const ud = JSON.parse(localStorage.getItem('userData') || 'null');
    if (!infoEl) return;
    if (!ud) {
        infoEl.innerHTML = 'Not signed in. <a href="#login">Login</a>';
        return;
    }
    const display = ((ud.firstname || '') + ' ' + (ud.lastname || '')).trim() || ud.email || ud.uid;
    infoEl.innerHTML = `<div><strong>${display}</strong></div><div class="text-muted small">uid: ${ud.uid}</div>`;
}

async function createCallRecord(target, consent) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated with Firebase Auth; please sign in');
    const sessionId = user.uid;

    const userSnapshot = getUserSnapshot();

    const payload = {
        callId: null,
        sellerId: sessionId,
        userSnapshot: userSnapshot,
        target: target || null,
        direction: 'outbound',
        status: 'started',
        startTime: null,
        endTime: null,
        duration: null,
        transcript: null,
        recordingUrl: null,
        notes: null,
        consent: consent || null,
        provider: 'webrtc',
        meta: { muted },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    const docRef = await safeCreateCallDoc(sessionId, payload);
    // Write the callId field to the doc (best-effort)
    try {
        await dbSetDoc([COLLECTIONS.SELLERS, sessionId, 'calls', docRef.id], { callId: docRef.id }, { merge: true });
    } catch (e) {
        console.warn('Failed to set callId field:', e);
    }

    // No top-level denormalized write: keep call documents under Sellers/{sellerId}/calls/{callId}

    return { id: docRef.id, sessionId };
}

// Wrap dbAddDoc to provide clearer error messages for permission issues
async function safeCreateCallDoc(sessionId, payload) {
    try {
        // Debug: ensure auth token is fresh and print current user info
        try {
            if (auth && auth.currentUser) {
                console.log('Auth currentUser uid:', auth.currentUser.uid);
                try {
                    const token = await auth.currentUser.getIdToken(true);
                    console.log('Refreshed ID token length:', token ? token.length : 0);
                } catch (tErr) {
                    console.warn('Failed to refresh ID token:', tErr);
                }
            } else {
                console.warn('Auth.currentUser is null before creating call doc');
            }
        } catch (dbgErr) {
            console.warn('Auth debug error:', dbgErr);
        }

        const docRef = await dbAddDoc([COLLECTIONS.SELLERS, sessionId, 'calls'], payload);
        return docRef;
    } catch (err) {
        console.error('Create call doc failed:', err);
        if (err && (err.code === 'permission-denied' || (err.message && err.message.toLowerCase().includes('permission')))) {
            alert('Permission denied when saving call. Ensure you are signed in with the correct account and disable any extensions blocking Firebase.');
        }
        throw err;
    }
}

function loadVoiceAgentScript() {
    // Avoid double-loading the voice-agent script. Returns a promise that resolves
    // with window.voiceAgent2 once available.
    if (window.voiceAgent2) return Promise.resolve(window.voiceAgent2);
    if (window.__voiceAgentLoadingPromise) return window.__voiceAgentLoadingPromise;

    window.__voiceAgentLoadingPromise = new Promise((resolve, reject) => {
        // If a script tag already exists, reuse it
        const existing = Array.from(document.querySelectorAll('script')).find(s => s.src && s.src.includes('/voice-agent/voice-agent.js'));
        // Ensure the agent auto-init flag is set so the module will initialize itself
        window.__VA_AUTO_INIT = true;

        if (existing) {
            if (window.voiceAgent2) return resolve(window.voiceAgent2);
            existing.addEventListener('load', () => setTimeout(() => resolve(window.voiceAgent2), 50));
            existing.addEventListener('error', reject);
            return;
        }

        const s = document.createElement('script');
        s.src = '/voice-agent/voice-agent.js';
        s.async = true;
        s.onload = () => {
            // mark loaded and resolve after agent may have initialized
            window.__voiceAgentLoaded = true;
            setTimeout(() => resolve(window.voiceAgent2), 100);
        };
        s.onerror = (e) => reject(e || new Error('Failed to load voice-agent script'));
        document.body.appendChild(s);
    });

    return window.__voiceAgentLoadingPromise;
}

async function updateCallStatus(call, updates) {
    if (!call || !call.id || !call.sessionId) return;
    await dbSetDoc([COLLECTIONS.SELLERS, call.sessionId, 'calls', call.id], { ...updates, updatedAt: serverTimestamp() }, { merge: true });
}

// Gather all calls for a seller (ordered by creation time)
async function gatherCallHistory(sessionId) {
    if (!sessionId) return [];
    try {
        const colRef = collection(db, 'Sellers', sessionId, 'calls');
        const q = query(colRef, orderBy('createdAt', 'asc'));
        const snap = await getDocs(q);
        const rows = [];
        snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
        return rows;
    } catch (e) {
        console.warn('Failed to gather call history', e);
        return [];
    }
}

// Send the seller's call history and the latest call id to an n8n webhook.
// Expects n8n to return JSON with at least a `summary` field. Saves result
// back onto the call document as `aiSummary` and `aiAnalysis`.
async function sendCallHistoryToN8n(sessionId, callId) {
    const webhookUrl = 'https://harveygrowthproperties.app.n8n.cloud/webhook-test/deal-synthesis'; // replace with real webhook
    const calls = await gatherCallHistory(sessionId);

    // Fetch the most recent summary for this seller (if any) so the AI can integrate old summary
    let previousSummary = null;
    try {
        const summariesCol = collection(db, 'Sellers', sessionId, 'summaries');
        const q = query(summariesCol, orderBy('createdAt', 'desc'), limit(1));
        let snap = null;
        try {
            snap = await getDocs(q);
        } catch (e) {
            // If this looks like an auth/permission issue, try refreshing the ID token once and retry.
            console.warn('Failed to fetch previous summary for seller before sending to n8n', e);
            if (auth && auth.currentUser && (e.code === 'permission-denied' || (e.message && e.message.toLowerCase().includes('permission')))) {
                try {
                    console.log('Refreshing ID token to retry previous-summary fetch');
                    await auth.currentUser.getIdToken(true);
                    snap = await getDocs(q);
                    console.log('Previous-summary fetch succeeded after token refresh');
                } catch (e2) {
                    console.warn('Retry to fetch previous summary also failed', { err: e2, authUser: auth && auth.currentUser ? auth.currentUser.uid : null, sessionId });
                }
            }
        }

        if (snap && snap.docs && snap.docs.length) {
            const d = snap.docs[0];
            previousSummary = { id: d.id, ...d.data() };
        }
    } catch (e) {
        // Final fallback: log concise diagnostics and continue without previousSummary
        console.warn('Unable to read previous summary (continuing without it)', {
            error: e && e.message ? e.message : e,
            authUser: auth && auth.currentUser ? auth.currentUser.uid : null,
            sessionId
        });
    }

    const payload = { sellerId: sessionId, callId, calls, previousSummary, sentAt: new Date().toISOString() };
    const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error('Webhook responded ' + resp.status);
    const data = await resp.json();
    console.log('n8n webhook response:', data);

    // Save raw AI response and parsed fields back to the call doc for debugging/visibility
    const aiSummary = (data && Object.prototype.hasOwnProperty.call(data, 'summary')) ? data.summary : null;
    const aiAnalysis = (data && Object.prototype.hasOwnProperty.call(data, 'analysis')) ? data.analysis : null;
    const aiErrors = (data && data.errors) ? data.errors : null;
    try {
        // Create a separate summary document under Sellers/{sellerId}/summaries
        const summaryPayload = {
            sellerId: sessionId,
            callId: callId || null,
            focalCallId: (data && data.focalCallId) ? data.focalCallId : null,
            summary: aiSummary || null,
            analysis: aiAnalysis || null,
            score: (data && typeof data.score === 'number') ? data.score : null,
            sentiment: (data && typeof data.sentiment === 'number') ? data.sentiment : null,
            tags: (data && data.tags) ? data.tags : null,
            recommendedNextActions: (data && data.recommendedNextActions) ? data.recommendedNextActions : null,
            raw: data || null,
            errors: aiErrors || null,
            model: (data && data.model) ? data.model : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // Add summary doc (keeps call documents smaller and provides an audit trail)
        let summaryDocRef = null;
        // Ensure the client is authenticated as the seller before attempting to write to their summaries subcollection.
        if (!auth || !auth.currentUser || auth.currentUser.uid !== sessionId) {
            console.warn('Skipping write to summaries: not authenticated as seller', { authUser: auth && auth.currentUser ? auth.currentUser.uid : null, expected: sessionId });
        } else {
            try {
                summaryDocRef = await dbAddDoc([COLLECTIONS.SELLERS, sessionId, 'summaries'], summaryPayload);
            } catch (e) {
                console.warn('Failed to save summary doc to summaries subcollection', e);
                // If this is a permission issue, try refreshing the auth token once and retry.
                if ((e.code === 'permission-denied' || (e.message && e.message.toLowerCase().includes('permission'))) && auth && auth.currentUser) {
                    try {
                        console.log('Permission error saving summary; refreshing ID token and retrying once');
                        await auth.currentUser.getIdToken(true);
                        summaryDocRef = await dbAddDoc([COLLECTIONS.SELLERS, sessionId, 'summaries'], summaryPayload);
                        console.log('Retry save summary succeeded after token refresh.');
                    } catch (e2) {
                        console.error('Retry to save summary failed:', e2);
                        // Provide minimal diagnostic info to help debug Firestore rules/token issues
                        try {
                            const diagnostics = {
                                authUser: auth && auth.currentUser ? auth.currentUser.uid : null,
                                expectedSellerId: sessionId,
                                summaryFields: {
                                    summaryLength: summaryPayload.summary ? String(summaryPayload.summary.length) : 'null',
                                    hasScore: typeof summaryPayload.score === 'number',
                                    hasSentiment: typeof summaryPayload.sentiment === 'number',
                                    tagsCount: Array.isArray(summaryPayload.tags) ? summaryPayload.tags.length : 0,
                                    recommendedNextActionsCount: Array.isArray(summaryPayload.recommendedNextActions) ? summaryPayload.recommendedNextActions.length : 0
                                }
                            };
                            console.error('Summary save diagnostics (no sensitive content):', diagnostics);
                            console.error('If this persists, verify Firestore rules allow writes for the authenticated seller and ensure no browser extensions (adblock/privacy) are blocking network calls.');
                        } catch (diagErr) {
                            console.error('Failed to produce diagnostics for summary save failure', diagErr);
                        }
                    }
                }
            }
        }

        // Link the summary doc back to the call document for quick access
        const callUpdates = {
            aiSummary: aiSummary || null,
            aiAnalysis: aiAnalysis || null,
            aiRawResponse: data || null,
            aiErrors: aiErrors || null,
            updatedAt: serverTimestamp()
        };
        if (summaryDocRef && summaryDocRef.id) callUpdates.latestSummaryId = summaryDocRef.id;

        await updateCallStatus({ id: callId, sessionId }, callUpdates);

        if (!aiSummary) {
            console.warn('n8n: summary missing in response; raw response saved to call doc for inspection');
        }
    } catch (e) {
        console.warn('Failed to save AI summary to call doc', e);
    }

    return data;
}

function bindControls() {
    startBtn = document.getElementById('startCall');
    endBtn = document.getElementById('endCall');
    muteBtn = document.getElementById('muteToggle');
    transcriptEl = document.getElementById('transcript');
    logEl = document.getElementById('callLog');
    // Ensure initial button states
    const consentCheckbox = document.getElementById('consentCheckbox');
    if (startBtn) startBtn.disabled = !(consentCheckbox && consentCheckbox.checked);
    if (endBtn) endBtn.disabled = true;

    // Toggle start button when consent changes
    if (consentCheckbox) {
        consentCheckbox.addEventListener('change', () => {
            if (startBtn) startBtn.disabled = !consentCheckbox.checked;
        });
    }

    // Start call
    startBtn?.addEventListener('click', async () => {
        try {
            const target = null; // target input removed; calls use seller/session context
            log('Loading voice-agent (if needed)...');
                    try {
                        setStatus('Connecting...', 'warning');
                        await loadVoiceAgentScript();
                        log('Voice agent loaded');
                        setStatus('Agent ready', 'info');
                    } catch (e) {
                        log('Voice agent script failed to load: ' + (e.message || e));
                        setStatus('Agent unavailable', 'danger');
                    }

            // ensure user is signed in and consent given
            const sessionId = getSessionId();
            if (!sessionId) {
                log('No authenticated user found — redirecting to login');
                window.location.hash = '#login';
                return;
            }

            const consentCheckbox = document.getElementById('consentCheckbox');
            if (!consentCheckbox || !consentCheckbox.checked) {
                log('Consent required before starting.');
                alert('Please confirm you have the callee\'s consent to record this call.');
                return;
            }

            log('Requesting microphone permission...');
            await navigator.mediaDevices.getUserMedia({ audio: true });
            log('Microphone access granted. Creating call record...');

            const consentObj = { given: true, at: serverTimestamp(), text: 'Callee consent confirmed by user before recording.' };
            const call = await createCallRecord(null, consentObj);
            currentCall = { ...call, localStartTs: Date.now() };
            log(`Call record created: ${currentCall.id}`);

            // If the voiceAgent is present, start it and wire transcript forwarding
            if (window.voiceAgent2 && window.voiceAgent2.client) {
                try {
                    if (typeof window.voiceAgent2.start === 'function') {
                        window.voiceAgent2.start();
                    }
                } catch (e) {
                    console.warn('Failed to start voiceAgent2:', e);
                }

                // Avoid attaching duplicate handlers if already attached
                if (!window.__voiceAgentHandlersAttached) {
                    window.voiceAgent2.client.onUserSpeech((t) => {
                        const text = `User: ${t}`;
                        window.voiceCallAppendTranscript(text);
                        log('User speech: ' + (t || '(empty)'));
                    });
                    window.voiceAgent2.client.onAgentSpeech((t) => {
                        const text = `AI: ${t}`;
                        window.voiceCallAppendTranscript(text);
                        log('Agent speech: ' + (t || '(empty)'));
                    });
                    window.__voiceAgentHandlersAttached = true;
                }

                const agentSession = window.voiceAgent2.sessionId || null;
                if (agentSession) {
                    updateCallStatus(currentCall, { 'meta.voiceAgentSessionId': agentSession }).catch(() => {});
                }
            }

            if (startBtn) startBtn.disabled = true;
            if (endBtn) endBtn.disabled = false;
            setStatus('Live', 'success');
        } catch (e) {
            console.error(e);
            log('Failed to start call: ' + (e.message || e));
        }
    });

    // End call
    endBtn?.addEventListener('click', async () => {
        if (!currentCall) return log('No active call to end');
        try {
            const endTs = Date.now();
            const duration = currentCall.localStartTs ? Math.max(0, Math.floor((endTs - currentCall.localStartTs) / 1000)) : null;
            const transcript = transcriptEl && transcriptEl.value && transcriptEl.value.trim() ? transcriptEl.value.trim() : null;
            await updateCallStatus(currentCall, { status: 'ended', endTime: serverTimestamp(), duration, transcript });
            log(`Call ended (duration ${duration ?? 'unknown'}s)`);
            setStatus('Ended', 'secondary');
            // Ensure the voice agent is stopped and muted so it no longer listens or speaks
            try {
                if (window.voiceAgent2) {
                    try { if (window.voiceAgent2.client && typeof window.voiceAgent2.client.setMuted === 'function') window.voiceAgent2.client.setMuted(true); } catch (e) {}
                    try { if (typeof window.voiceAgent2.setMuted === 'function') window.voiceAgent2.setMuted(true); } catch (e) {}
                    try { if (typeof window.voiceAgent2.stop === 'function') await window.voiceAgent2.stop(); } catch (e) {}
                    try { if (window.voiceAgent2.client && typeof window.voiceAgent2.client.disconnect === 'function') window.voiceAgent2.client.disconnect(); } catch (e) {}
                }
            } catch (e) {
                console.warn('Error stopping voice agent on call end:', e);
            }
                        // Send call history + latest call to n8n webhook (best-effort, async)
                        try {
                            const sessionId = getSessionId();
                            const callId = currentCall && currentCall.id ? currentCall.id : null;
                            if (sessionId && callId) {
                                (async () => {
                                    try {
                                        await sendCallHistoryToN8n(sessionId, callId);
                                        log('n8n: summary stored');
                                    } catch (e) {
                                        console.warn('n8n webhook error:', e);
                                        log('n8n webhook failed: ' + (e.message || e));
                                    }
                                })();
                            }
                        } catch (e) { console.debug('n8n trigger failed', e); }
            if (startBtn) startBtn.disabled = false;
            if (endBtn) endBtn.disabled = true;
            currentCall = null;
        } catch (e) {
            console.error(e);
            log('Failed to end call: ' + (e.message || e));
        }
    });

    // Mute toggle
    muteBtn?.addEventListener('click', () => {
        muted = !muted;
        if (muteBtn) muteBtn.textContent = muted ? 'Unmute' : 'Mute';
        log(muted ? 'Muted' : 'Unmuted');
        setStatus(muted ? 'Muted' : 'Live', muted ? 'warning' : 'success');
        try {
            if (window.voiceAgent2) {
                try { if (window.voiceAgent2.client && typeof window.voiceAgent2.client.setMuted === 'function') window.voiceAgent2.client.setMuted(muted); } catch (e) {}
                try { if (typeof window.voiceAgent2.setMuted === 'function') window.voiceAgent2.setMuted(muted); } catch (e) {}
            }
        } catch (e) {
            console.debug('voiceAgent mute toggle not supported', e);
        }
    });
}

// Expose a tiny API for appending to the transcript from other modules (e.g., voice-agent)
window.voiceCallAppendTranscript = function (text) {
    if (!text) return;
    if (!transcriptEl) transcriptEl = document.getElementById('transcript');
    if (!transcriptEl) return;
    transcriptEl.value = (transcriptEl.value ? transcriptEl.value + '\n' : '') + text;
};

// Also expose a method to programmatically set a recording URL after upload/server processing
window.voiceCallSetRecordingUrl = async function (callId, url) {
    const sessionId = getSessionId();
    if (!sessionId || !callId) return;
    try {
        await updateCallStatus({ id: callId, sessionId }, { recordingUrl: url });
        log('Recording URL saved');
    } catch (e) {
        console.warn('Failed to save recordingUrl', e);
    }
};

log('Voice call module loaded');

// Populate seller info and bind UI after the fragment is injected
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        populateSellerInfo();
        bindControls();
    });
} else {
    populateSellerInfo();
    // run binding on next tick to ensure the page fragment is inserted
    setTimeout(bindControls, 0);
}
