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
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const cors = require('cors');

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
app.use(bodyParser.json());
app.use(cors());

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

// When Twilio connects, we'll create a Deepgram socket and forward audio
wss.on('connection', function connection(twilioWs, req) {
  console.log('Twilio Media Stream connected');

  const dg = createDeepgramSocket();
  // Per-connection call context
  let callSid = null;
  let fromNumber = null;
  let toNumber = null;

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
            // Write final transcript to Firestore if available
            try {
              if (firestore) {
                // Determine sellerId: prefer the called number (toNumber)
                const rawSeller = (toNumber || fromNumber || 'unknown').toString();
                const sellerId = rawSeller.replace(/[^0-9a-zA-Z]/g, '_');
                const sessionId = callSid || (Date.now()).toString();
                const docRef = firestore.collection('Sellers').doc(`${sellerId}_sessions`).collection('sessions').doc(sessionId);
                const payload = {
                  transcript,
                  callSid: callSid || null,
                  from: fromNumber || null,
                  to: toNumber || null,
                  recordedAt: admin.firestore.FieldValue.serverTimestamp(),
                  deepgram: data
                };
                docRef.set(payload).catch(e => console.error('Firestore write failed', e));
              }
            } catch (e) {
              console.error('Error writing transcript to Firestore', e);
            }

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
    dg.on('error', (e) => console.error('Deepgram socket error', e));
    dg.on('close', () => console.log('Deepgram socket closed'));
  }

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
        }
      } else if (msg.event === 'start') {
        callSid = msg.start.callSid || null;
        fromNumber = msg.start.from || null;
        toNumber = msg.start.to || null;
        console.log('Media stream started for callSid=', callSid, 'from=', fromNumber, 'to=', toNumber);
      } else if (msg.event === 'stop') {
        console.log('Media stream stopped');
        if (dg) dg.close();
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

// Agora token generation endpoint
app.get('/agora/token', async (req, res) => {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERT;
  if (!appId || !appCertificate) { 
    return res.status(500).json({ error: 'AGORA_APP_ID or AGORA_APP_CERT not set on server' });
  }

  const channel = req.query.channel || 'secretary-channel';
  const uid = parseInt(req.query.uid || '0', 10);

  try {
    // Try require first (CommonJS). If that fails, try dynamic import() (ESM).
    let tokenModule = null;
    try {
      tokenModule = require('agora-access-token');
    } catch (e) {
      try {
        const imported = await import('agora-access-token');
        tokenModule = imported && (imported.default || imported);
      } catch (e2) {
        // dynamic import failed; tokenModule stays null
      }
    }

    if (!tokenModule) {
      console.error('agora-access-token module not found or failed to load');
      return res.status(500).json({ error: 'agora_token_module_missing' });
    }

    // Try multiple supported APIs for token generation
    let token = null;
    let logTokenGeneration = null;
    const lifeSeconds = parseInt(req.query.exp || '3600', 10);
    const now = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = now + lifeSeconds;

    // 1) RtcTokenBuilder.buildTokenWithUid (common older API)
    if (tokenModule.RtcTokenBuilder && typeof tokenModule.RtcTokenBuilder.buildTokenWithUid === 'function') {
      try {
        const RtcRole = tokenModule.RtcRole || { PUBLISHER: 1 };
        token = tokenModule.RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channel, uid, RtcRole.PUBLISHER || RtcRole.PUBLISHER, privilegeExpiredTs);
        logTokenGeneration = 'RtcTokenBuilder';
      } catch (e) {
        console.error('RtcTokenBuilder build failed', e);
      }
    }

    // 2) module-level buildTokenWithUid
    if (!token && typeof tokenModule.buildTokenWithUid === 'function') {
      try {
        token = tokenModule.buildTokenWithUid(appId, appCertificate, channel, uid, privilegeExpiredTs);
        logTokenGeneration = 'module.buildTokenWithUid';
      } catch (e) {
        console.error('module.buildTokenWithUid failed', e);
      }
    }

    // 3) AccessToken class (handle variants exported by some packages)
    if (!token && tokenModule.AccessToken) {
      try {
        // Common package shape: AccessToken: { Token: <class>, Priviledges: { ... } }
        const atWrapper = tokenModule.AccessToken;
        let AccessTokenClass = atWrapper.Token || atWrapper.Token || tokenModule.AccessToken;
        let Privs = atWrapper.Priviledges || atWrapper.Privileges || tokenModule.priviledges || tokenModule.privileges || null;

        if (typeof AccessTokenClass === 'function') {
          let at = null;
          try { at = new AccessTokenClass(appId, appCertificate, channel, uid); } catch (e) {
            try { at = new AccessTokenClass(appId, appCertificate, channel); } catch (e2) { at = null; }
          }

          if (at) {
            try {
              if (Privs && typeof at.addPriviledge === 'function') {
                // note: some packages use addPriviledge (misspelling)
                const joinConst = Privs.kJoinChannel || Privs.JOIN_CHANNEL || Object.values(Privs)[0];
                if (joinConst) at.addPriviledge(joinConst, privilegeExpiredTs);
              } else if (Privs && typeof at.addPrivilege === 'function') {
                const joinConst = Privs.kJoinChannel || Privs.JOIN_CHANNEL || Object.values(Privs)[0];
                if (joinConst) at.addPrivilege(joinConst, privilegeExpiredTs);
              }
            } catch (e) {
              // ignore
            }

            if (typeof at.build === 'function') token = at.build();
            else if (typeof at.toString === 'function') token = at.toString();
            logTokenGeneration = 'AccessTokenClass';
          }
        }
      } catch (e) {
        console.error('AccessToken flow failed', e);
      }
    }

    if (!token) {
      console.error('agora-access-token API incompatible', Object.keys(tokenModule));
      return res.status(500).json({ error: 'agora_token_module_api_mismatch', available: Object.keys(tokenModule) });
    }

    return res.json({ appId, token, channel, uid, expiresAt: privilegeExpiredTs, generatedBy: logTokenGeneration || 'unknown' });
  } catch (e) {
    console.error('Failed to build Agora token', e);
    return res.status(500).json({ error: 'token_generation_failed', detail: e.message });
  }
});