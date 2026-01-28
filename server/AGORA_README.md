Agora integration (quick start)

Overview
- This project exposes an endpoint to mint Agora RTC tokens for browser clients: `GET /agora/token?channel=CHANNEL&uid=UID`.
- Use Agora Console to configure PSTN/SIP to bridge inbound calls to the same channel name (e.g., `secretary-channel`).

Server env required
- `AGORA_APP_ID` - your Agora App ID
- `AGORA_APP_CERT` - your Agora App Certificate
- `PORT` - optional (default present in server/index.js)

How it works
1. A browser client requests a token from `GET /agora/token` and joins the Agora channel with `AgoraRTC`.
2. Configure Agora to bridge PSTN/SIP calls into that channel (see Agora console docs for PSTN/SIP or "Cloud Interactive Voice" features).
3. When a PSTN caller is bridged, the browser will receive remote audio tracks from the caller and can forward them to your agent (Deepgram or your AI pipeline) or play/respond.

Client example (browser)
Include Agora Web SDK in your page:

<script src="https://download.agora.io/sdk/release/AgoraRTC_N-4.8.2.js"></script>

Then use this minimal code to join/publish audio:

<script>
async function joinAgora(channel='secretary-channel'){
  const r = await fetch(`/agora/token?channel=${encodeURIComponent(channel)}`);
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  const appId = data.appId;
  const token = data.token;
  const uid = data.uid || null;

  const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
  await client.join(appId, channel, token, uid);

  // Publish local microphone
  const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
  await client.publish([localAudioTrack]);

  client.on('user-published', async (remoteUser, mediaType) => {
    await client.subscribe(remoteUser, mediaType);
    if (mediaType === 'audio') {
      const remoteAudioTrack = remoteUser.audioTrack;
      remoteAudioTrack.play();
      // Optionally: capture audio frames and forward to your agent
    }
  });
}
</script>

Notes
- Bridging PSTN to Agora channels requires configuration in Agora console and may use Agora's SIP/Cloud Recording or PSTN products.
- For production, generate tokens server-side and never expose `AGORA_APP_CERT` in the client.
- If you want to forward audio to Deepgram or your existing `voice-agent` code, capture remote audio from the Agora `AudioTrack` and send frames to your agent's input pipeline (WebSocket or server relay). The codebase already contains Deepgram bridging logic; you can adapt it to forward audio received in the browser or on the server.

Troubleshooting
- Ensure your Render service supports WebRTC traffic; browser clients will connect to Agora network directly, so tokens just authenticate them.
- If PSTN bridging is failing, verify Agora's PSTN/SIP settings and confirm calls are routed into the target channel.

If you'd like, I can:
- Add a small client page `voice-ageet/agora-join.html` wired to your existing `voice-agent` playback/forwarding, or
- Implement server-side media forwarding from an Agora recording or cloud stream to Deepgram (requires additional Agora cloud recording config).

