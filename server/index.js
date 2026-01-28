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
// NOTE: Recording-to-transcribe and Agora token endpoints removed to keep this
// server minimal and focused on Twilio Media Streams -> Deepgram -> Firestore.