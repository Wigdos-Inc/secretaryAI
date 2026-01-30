import { dbAddDoc, dbSetDoc, COLLECTIONS } from '../modules/db.js';
import { serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { auth } from '../modules/firebaseInit.js';

// Simple voice-call UI wiring and Firestore lifecycle writes
let startBtn;
let endBtn;
let muteBtn;
let transcriptEl;
let logEl;

let currentCall = null; // { id, localStartTs }
let muted = false;

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

    // Also create/keep a denormalized top-level `calls/{callId}` document
    try {
        const topLevelPayload = Object.assign({}, payload, { callId: docRef.id, sellerId: sessionId });
        await dbSetDoc(['calls', docRef.id], topLevelPayload, { merge: true });
    } catch (e) {
        console.warn('Failed to write top-level calls doc:', e);
    }

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

function bindControls() {
    startBtn = document.getElementById('startCall');
    endBtn = document.getElementById('endCall');
    muteBtn = document.getElementById('muteToggle');
    transcriptEl = document.getElementById('transcript');
    logEl = document.getElementById('callLog');
    // Ensure initial button states
    if (startBtn) startBtn.disabled = false;
    if (endBtn) endBtn.disabled = true;

    // Start call
    startBtn?.addEventListener('click', async () => {
        try {
            const target = null; // target input removed; calls use seller/session context
            log('Loading voice-agent (if needed)...');
            try {
                await loadVoiceAgentScript();
                log('Voice agent loaded');
            } catch (e) {
                log('Voice agent script failed to load: ' + (e.message || e));
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

                const agentSession = window.voiceAgent2.sessionId || null;
                if (agentSession) {
                    updateCallStatus(currentCall, { 'meta.voiceAgentSessionId': agentSession }).catch(() => {});
                }
            }

            if (startBtn) startBtn.disabled = true;
            if (endBtn) endBtn.disabled = false;
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
            // Ensure the voice agent is stopped and muted so it no longer listens or speaks
            try {
                if (window.voiceAgent2 && typeof window.voiceAgent2.setMuted === 'function') {
                    window.voiceAgent2.setMuted(true);
                }
                if (window.voiceAgent2 && typeof window.voiceAgent2.stop === 'function') {
                    await window.voiceAgent2.stop();
                }
            } catch (e) {
                console.warn('Error stopping voice agent on call end:', e);
            }
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
        try {
            if (window.voiceAgent2 && window.voiceAgent2.client && typeof window.voiceAgent2.client.setMuted === 'function') {
                window.voiceAgent2.client.setMuted(muted);
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
