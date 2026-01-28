/*
  Simple Twilio Media Streams -> Deepgram bridge

  - Exposes a TwiML endpoint at POST /twilio/answer which returns TwiML
    that instructs Twilio to open a WebSocket to /twilio/stream
  - Accepts Twilio WebSocket connections at path /twilio/stream
    (Twilio will connect and stream audio frames as JSON 'media' events)
  - Forwards audio frames to Deepgram real-time WebSocket for transcription
  - Logs transcription events and POSTs transcripts to optional AGENT_URL

  Requirements (env):
    DG_API_KEY  - Deepgram API key (server-side only)
    AGENT_URL   - optional HTTP URL to POST transcripts to (your voice agent)
    PORT        - optional, default 3000

  For development use ngrok to expose this server to the public internet
  and configure your Twilio phone Number's Voice webhook to point to
  https://<ngrok>/twilio/answer (HTTP POST).
*/

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const cors = require('cors');
const Twilio = require('twilio');

const DG_API_KEY = process.env.DG_API_KEY;
const AGENT_URL = process.env.AGENT_URL || null;
const PORT = process.env.PORT || 10000;

if (!DG_API_KEY) {
  console.warn('Warning: DG_API_KEY not set. Deepgram forwarding will fail without it.');
}

// Initialize Firebase Admin if service account provided.
let firestore = null;
try {
  if (process.env.SERVICE_ACCOUNT_JSON) {
    const svc = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(svc) });
    firestore = admin.firestore();
    console.log('Initialized Firebase Admin from SERVICE_ACCOUNT_JSON');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
    firestore = admin.firestore();
    console.log('Initialized Firebase Admin via GOOGLE_APPLICATION_CREDENTIALS');
  } else {
    console.log('No service account provided; Firestore writes disabled.');
  }
} catch (e) {
  console.error('Failed to initialize Firebase Admin:', e);
}

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    try { req.rawBody = buf && buf.toString(); } catch (e) { req.rawBody = undefined; }
  }
}));
app.use(cors());

// Log whether OUTBOUND_SECRET is configured (boolean only)
console.log('OUTBOUND_SECRET set?', !!process.env.OUTBOUND_SECRET);

// In-memory map of generated TTS files (id -> { path, expiresAt })
const ttsFiles = new Map();

// Serve generated TTS audio files
app.get('/tts/:id', (req, res) => {
  const id = req.params.id;
  const entry = ttsFiles.get(id);
  if (!entry) return res.status(404).send('Not found');
  const p = entry.path;
  if (!fs.existsSync(p)) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'audio/wav');
  const stream = fs.createReadStream(p);
  stream.pipe(res);
});

// Periodic cleanup of old TTS files
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of ttsFiles.entries()) {
    if (entry.expiresAt < now) {
      try { fs.unlinkSync(entry.path); } catch (e) {}
      ttsFiles.delete(id);
    }
  }
}, 60 * 1000);

// TwiML answer endpoint for incoming calls. Configure this URL in Twilio.
app.post('/twilio/answer', (req, res) => {
  // The Stream url should be a wss endpoint on this server reachable by Twilio
  // Twilio requires a secure WebSocket (wss) URL. Use ngrok in dev.
  const host = req.headers.host; // Twilio calls this webhook; host will be public host
  const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'wss';
  const streamUrl = `${protocol}://${host}/twilio/stream`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Start>\n    <Stream url="${streamUrl}" />\n  </Start>\n</Response>`;

  res.type('text/xml');
  res.send(twiml);
});

const server = http.createServer(app);

// WebSocket server for Twilio Media Streams
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', function upgrade(request, socket, head) {
  const { url } = request;
  if (url === '/twilio/stream') {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Helper: create a Deepgram WebSocket per Twilio connection
function createDeepgramSocket() {
  if (!DG_API_KEY) return null;
  const dgUrl = 'wss://api.deepgram.com/v1/listen?encoding=mulaw&sample_rate=8000';
  const dg = new WebSocket(dgUrl, {
    headers: {
      Authorization: `Token ${DG_API_KEY}`
    }
  });
  return dg;
}

// Create a Deepgram agent-capable socket for a session
function createDeepgramAgentSocket(sessionId) {
  if (!DG_API_KEY) return null;
  // request agent-capable realtime connection; query params may vary by DG account
  const dgUrl = 'wss://api.deepgram.com/v1/listen?encoding=mulaw&sample_rate=8000&agent=true';
  const dg = new WebSocket(dgUrl, {
    headers: { Authorization: `Token ${DG_API_KEY}` }
  });
  dg.sessionId = sessionId;
  return dg;
}

function getTwilioClientForCall(fromNumber, toNumber) {
  // Prefer account B if its configured phone number matches either side
  if (process.env.TWILIO_PHONE_NUMBER_B && (fromNumber === process.env.TWILIO_PHONE_NUMBER_B || toNumber === process.env.TWILIO_PHONE_NUMBER_B)) {
    if (process.env.TWILIO_ACCOUNT_SID_B && process.env.TWILIO_AUTH_TOKEN_B) return Twilio(process.env.TWILIO_ACCOUNT_SID_B, process.env.TWILIO_AUTH_TOKEN_B);
  }
  if (process.env.TWILIO_PHONE_NUMBER && (fromNumber === process.env.TWILIO_PHONE_NUMBER || toNumber === process.env.TWILIO_PHONE_NUMBER)) {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  // fallback to default account env
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return null;
}

async function playAudioIntoCall(session, url) {
  try {
    if (!session) return;
    // queueing: if already playing, push to queue
    if (!session.playQueue) session.playQueue = [];
    if (!session.playing) {
      session.playing = true;
      const client = getTwilioClientForCall(session.fromNumber, session.toNumber);
      if (!client) {
        console.warn('No Twilio client available to play audio into call');
        session.playing = false;
        return;
      }
      const twiml = `<Response><Play>${url}</Play></Response>`;
      console.log('Playing audio into call', session.callSid, url);
      await client.calls(session.callSid).update({ twiml });
      // done playing, process queue
      session.playing = false;
      if (session.playQueue.length > 0) {
        const next = session.playQueue.shift();
        playAudioIntoCall(session, next);
      }
    } else {
      session.playQueue.push(url);
    }
  } catch (e) {
    session.playing = false;
    console.error('Failed to play audio into call', e);
  }
}

// When Twilio connects, we'll create a Deepgram socket and forward audio
wss.on('connection', function connection(twilioWs, req) {
  console.log('Twilio Media Stream connected');

  const dg = createDeepgramSocket();
  // Per-connection call context
  let callSid = null;
  let fromNumber = null;
  let toNumber = null;
  let transcripts = [];
  const startedAt = Date.now();

  if (!dg) console.error('Deepgram socket not created (DG_API_KEY missing)');

  // Forward messages from Deepgram (transcripts) to logs and optional agent
  if (dg) {
    dg.on('open', () => console.log('Connected to Deepgram'));
    dg.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        // Deepgram sends interim/final transcripts in `channel.alternatives`
        if (data.channel && data.channel.alternatives && data.channel.alternatives[0]) {
          const transcript = data.channel.alternatives[0].transcript;
          const isFinal = data.is_final || false;
          console.log('[Deepgram]', isFinal ? 'FINAL' : 'INTERIM', transcript);
          if (isFinal) {
            // accumulate final transcripts
            transcripts.push({ transcript, ts: Date.now(), deepgram: data });

            if (AGENT_URL) {
              // POST transcript to agent URL
              fetch(AGENT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript })
              }).catch(e => console.error('Agent post failed', e));
            }
          }
        }
      } catch (e) {
        console.error('Deepgram parse error', e);
      }
    });
    // Note: agent responses are handled on a separate agent socket
    dg.on('error', (e) => console.error('Deepgram socket error', e));
    dg.on('close', () => console.log('Deepgram socket closed'));
  }

  // Agent socket (for agent-mode responses)
  let agentDg = null;

    twilioWs.on('message', function incoming(message) {
    // Twilio sends JSON text messages describing events
    // Example: { "event": "media", "media": { "payload": "BASE64DATA" }, ... }
    try {
      const msg = JSON.parse(message.toString());
      if (msg.event === 'media' && msg.media && msg.media.payload) {
        const audioPayload = msg.media.payload; // base64 string
        // Decode base64 to Buffer and forward to Deepgram as binary
        if (dg && dg.readyState === WebSocket.OPEN) {
          const bin = Buffer.from(audioPayload, 'base64');
          dg.send(bin);
          // also forward to agent socket if available
          if (agentDg && agentDg.readyState === WebSocket.OPEN) {
            try { agentDg.send(bin); } catch (e) { console.error('Agent DG send failed', e); }
          }
        }
      } else if (msg.event === 'start') {
        callSid = msg.start.callSid || null;
        fromNumber = msg.start.from || null;
        toNumber = msg.start.to || null;
        console.log('Media stream started for callSid=', callSid, 'from=', fromNumber, 'to=', toNumber);
        // create an agent socket for this session
        try {
          agentDg = createDeepgramAgentSocket(callSid || `${Date.now()}`);
          if (agentDg) {
            agentDg.on('open', () => console.log('Connected to Deepgram (agent)'));
            agentDg.on('message', async (m) => {
              try {
                const data = JSON.parse(m.toString());
                // Look for agent audio payloads (flexible parsing)
                let b64 = null;
                if (data.response && data.response.audio && data.response.audio.data) b64 = data.response.audio.data;
                else if (data.audio && data.audio.data) b64 = data.audio.data;
                else if (data.agent && data.agent.audio && data.agent.audio.data) b64 = data.agent.audio.data;
                if (b64) {
                  const buf = Buffer.from(b64, 'base64');
                  const id = crypto.randomUUID();
                  const filename = `dg-agent-${id}.wav`;
                  const p = path.join(os.tmpdir(), filename);
                  fs.writeFileSync(p, buf);
                  ttsFiles.set(id, { path: p, expiresAt: Date.now() + 1000 * 60 * 10 });
                  // create session object for play
                  const session = { callSid, fromNumber, toNumber };
                  const url = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers.host}/tts/${id}.wav`.replace('http://', 'https://');
                  await playAudioIntoCall(session, url);
                }
                // If agent also returns text responses, log them
                if (data.response && data.response.text) console.log('Agent text:', data.response.text);
              } catch (e) {
                console.error('Deepgram agent message parse error', e);
              }
            });
            agentDg.on('error', (e) => console.error('Deepgram agent socket error', e));
            agentDg.on('close', () => console.log('Deepgram agent socket closed'));
          }
        } catch (e) {
          console.error('Failed to create Deepgram agent socket', e);
        }
      } else if (msg.event === 'stop') {
        console.log('Media stream stopped');
        // build call object and write to Firestore
        try {
          const sessionId = callSid || `${Date.now()}`;
          const callObj = { callSid: callSid || null, from: fromNumber || null, to: toNumber || null, startedAt, endedAt: Date.now(), transcripts };
          if (firestore) {
            // Write to Sellers collection as requested: doc id is sessionId, field `call` contains the JSON
            const docRef = firestore.collection('Sellers').doc(sessionId);
            docRef.set({ call: callObj, recordedAt: admin.firestore.FieldValue.serverTimestamp() }).catch(e => console.error('Firestore write failed', e));
          } else {
            console.log('Final call object (no Firestore):', JSON.stringify(callObj));
          }
        } catch (e) {
          console.error('Error while finalizing call', e);
        }

        if (dg) dg.close();
        if (agentDg && agentDg.readyState === WebSocket.OPEN) agentDg.close();
        twilioWs.close();
      }
    } catch (e) {
      console.error('Twilio WS message parse error', e);
    }
  });

  twilioWs.on('close', () => {
    console.log('Twilio Media Stream disconnected');
    if (dg && dg.readyState === WebSocket.OPEN) dg.close();
  });
});

server.listen(PORT, () => {
  console.log(`Voice bridge server listening on port ${PORT}`);
  console.log('TwiML answer endpoint: POST /twilio/answer');
  console.log('WebSocket path for Twilio streams: /twilio/stream');
});

app.post('/twilio/debug-webhook', express.json(), (req, res) => {
  // req.body will contain Twilio's debug payload
  console.log('Twilio debug event:', req.body);

  // Example: store or forward (pseudo)
  // saveToFirestore('twilio_debug', req.body);
  // forwardToSlack(req.body);

  res.sendStatus(204);
});

// Twilio call status change webhook (configure this URL in the Twilio number "Call status changes")
app.post('/twilio/status', express.urlencoded({ extended: true }), (req, res) => {
  try {
    console.log('Twilio call status webhook:', req.body);
    // Optionally write to Firestore for auditing
    try {
      if (firestore && req.body && req.body.CallSid) {
        const sid = req.body.CallSid;
        const docRef = firestore.collection('TwilioCallEvents').doc(sid);
        const payload = { event: req.body, receivedAt: admin.firestore.FieldValue.serverTimestamp() };
        docRef.set(payload, { merge: true }).catch(e => console.error('Failed to write Twilio status to Firestore', e));
      }
    } catch (e) {
      console.error('Error storing Twilio status', e);
    }

    res.sendStatus(204);
  } catch (e) {
    console.error('/twilio/status handler error', e);
    res.sendStatus(500);
  }
});

// Admin endpoint: fetch recent failed calls using Twilio REST API.
// Protect with INSPECT_SECRET env or ?secret= query param.
app.get('/admin/fetch-recent-failed-calls', async (req, res) => {
  try {
    const secret = process.env.INSPECT_SECRET;
    const provided = req.query.secret || req.headers['x-inspect-secret'];
    if (!secret || provided !== secret) return res.status(403).json({ error: 'forbidden' });

      // allow selecting which account to use: 'A' (default) or 'B'
      const fromAccount = (req.body && req.body.fromAccount) || req.query.account || 'A';
    // fetch recent calls (page) and filter failed or errored ones
    const pageSize = parseInt(req.query.limit || '50', 10);
    const calls = await tw.calls.list({ pageSize });
      // Resolve credentials for requested account
      function getTwilioConfig(acc) {
        if (acc === 'B') {
          return {
            sid: process.env.TWILIO_ACCOUNT_SID_B,
            token: process.env.TWILIO_AUTH_TOKEN_B,
            from: process.env.TWILIO_PHONE_NUMBER_B
          };
        }
        // default A
        return {
          sid: process.env.TWILIO_ACCOUNT_SID,
          token: process.env.TWILIO_AUTH_TOKEN,
          from: process.env.TWILIO_PHONE_NUMBER
        };
      }

      const cfg = getTwilioConfig(fromAccount);
      if (!cfg.sid || !cfg.token) return res.status(500).json({ error: 'twilio_creds_missing_for_account', account: fromAccount });
      if (!cfg.from) return res.status(500).json({ error: 'twilio_from_number_missing', account: fromAccount });

      const client = Twilio(cfg.sid, cfg.token);
      const callParams = { from: cfg.from, to };
    // For each failed call, fetch events (limited) for diagnostics
    const results = [];
    for (const c of failed.slice(0, 30)) {
      let events = [];
      try {
        const ev = await tw.calls(c.sid).events.list({ limit: 20 });
        events = ev.map(e => ({ sid: e.sid, dateCreated: e.dateCreated, level: e.level, message: e.message, errorCode: e.errorCode }));
      } catch (e) {
        // ignore
      }
      results.push({ sid: c.sid, status: c.status, from: c.from, to: c.to, startTime: c.startTime, endTime: c.endTime, duration: c.duration, events });
    }

    return res.json({ fetched: results.length, results });
  } catch (e) {
    console.error('admin fetch error', e);
    return res.status(500).json({ error: 'server_error', detail: e.message });
  }
});

// Outbound call trigger (protected)
// Usage: POST /twilio/outbound with body { to: "+31...", twiml: "<Response>..." }
// Protect with OUTBOUND_SECRET env or ?secret= query param.
app.post('/twilio/outbound', async (req, res) => {
  try {
    const secret = process.env.OUTBOUND_SECRET;
    const provided = req.query.secret || req.headers['x-outbound-secret'];
    if (!secret || provided !== secret) {
      console.warn('/twilio/outbound forbidden: outbound secret missing or mismatch; provided?', !!provided);
      return res.status(403).json({ error: 'forbidden', provided: !!provided });
    }

    const TW_SID = process.env.TWILIO_ACCOUNT_SID;
    const TW_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER;
    if (!TW_SID || !TW_TOKEN) return res.status(500).json({ error: 'twilio_creds_missing' });
    if (!FROM_NUMBER) return res.status(500).json({ error: 'twilio_from_number_missing' });

    const { to, twiml } = req.body || {};
    if (!to) return res.status(400).json({ error: 'missing_to' });

    const client = Twilio(TW_SID, TW_TOKEN);
    const callParams = { from: FROM_NUMBER, to };
    if (twiml) callParams.twiml = twiml;
    else callParams.twiml = '<Response><Say voice="alice">This is a test call from Secretary AI.</Say></Response>';

    const call = await client.calls.create(callParams);
    console.log('Outbound call created', call.sid, 'to', to);
    return res.json({ sid: call.sid, status: call.status });
  } catch (e) {
    console.error('/twilio/outbound error', e);
    return res.status(500).json({ error: 'call_failed', detail: e.message });
  }
});

// Bridge two PSTN numbers by originating a call from the configured Twilio account
// This creates a call from TWILIO_PHONE_NUMBER -> target, and uses TwiML to Dial the target (connects them).
// Protected by OUTBOUND_SECRET (same as outbound endpoint).
app.post('/twilio/bridge', async (req, res) => {
  try {
    const secret = process.env.OUTBOUND_SECRET;
    const provided = req.query.secret || req.headers['x-outbound-secret'];
    if (!secret || provided !== secret) {
      console.warn('/twilio/bridge forbidden: outbound secret missing or mismatch; provided?', !!provided);
      return res.status(403).json({ error: 'forbidden', provided: !!provided });
    }

    // allow selecting which account to use to originate the bridge leg (A or B)
    const fromAccount = (req.body && req.body.fromAccount) || req.query.account || 'A';

    const { target } = req.body || {};
    if (!target) return res.status(400).json({ error: 'missing_target' });

    function getTwilioConfig(acc) {
      if (acc === 'B') {
        return {
          sid: process.env.TWILIO_ACCOUNT_SID_B,
          token: process.env.TWILIO_AUTH_TOKEN_B,
          from: process.env.TWILIO_PHONE_NUMBER_B
        };
      }
      return {
        sid: process.env.TWILIO_ACCOUNT_SID,
        token: process.env.TWILIO_AUTH_TOKEN,
        from: process.env.TWILIO_PHONE_NUMBER
      };
    }

    const cfg = getTwilioConfig(fromAccount);
    if (!cfg.sid || !cfg.token) return res.status(500).json({ error: 'twilio_creds_missing_for_account', account: fromAccount });
    if (!cfg.from) return res.status(500).json({ error: 'twilio_from_number_missing', account: fromAccount });

    const client = Twilio(cfg.sid, cfg.token);

    // Use TwiML: Dial the target. Create a call from the configured 'from' number to itself (executes TwiML)
    const twiml = `<Response><Dial>${target}</Dial></Response>`;

    const call = await client.calls.create({ from: cfg.from, to: cfg.from, twiml });

    return res.json({ sid: call.sid, status: call.status, account: fromAccount });
  } catch (e) {
    console.error('/twilio/bridge error', e);
    return res.status(500).json({ error: 'bridge_failed', detail: e.message });
  }
});
// JSON parse error handler to surface invalid JSON bodies and log raw body start
app.use((err, req, res, next) => {
  if (!err) return next();
  const isBodyParserError = err && ((err instanceof SyntaxError && err.status === 400 && 'body' in err) || err.type === 'entity.parse.failed');
  if (isBodyParserError) {
    console.warn('JSON parse error on', req.path, 'Content-Type:', req.headers['content-type']);
    if (req.rawBody) console.warn('Raw body starts with:', req.rawBody.slice(0, 200));
    return res.status(400).json({ error: 'invalid_json', detail: 'Could not parse JSON body' });
  }
  return next(err);
});
// NOTE: Recording-to-transcribe and Agora token endpoints removed to keep this
// server minimal and focused on Twilio Media Streams -> Deepgram -> Firestore.