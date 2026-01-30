const CONFIG = {
  voiceAgent: {
    apiKey: "feb1d4de627a4128035c059c17e598166088b5c5",
    endpoint: "wss://agent.deepgram.com/v1/agent/converse",
    settings: {
      agent: {
        listen: { provider: { type: "deepgram", model: "flux-general-en" } },
        speak: { provider: { type: "deepgram", model: "aura-2-hyperion-en" } },
        think: {
          provider: { type: "open_ai", model: "gpt-5.1" },
          prompt: `You are "Secretary AI", a professional telephone assistant calling potential property sellers in the Netherlands for Growth Properties. Language: English. Tone: warm, friendly and businesslike; prefer short sentences but natural pacing.

          Primary goals:
          - Collect structured lead and property fields: name, phone, email, address, postcode, property_type, rooms, area_m2, desired_price_EUR, motivation_to_sell, desired_timeline, tenants_present, mortgage_remaining_EUR, known_issues, availability_for_viewing, best_contact_time.

          Behavior & outputs:
          - Ask up to 6 focused questions unless more are required to collect crucial data.
          - End with a short summary (max 3 bullets) and request confirmation.
          - Produce two outputs at the end of the call: (1) a JSON object containing all collected fields plus summary, leadQuality (0-100), and recommendedNext, and (2) an ssml string suitable for high-quality neural TTS. The ssml output should include natural prosody, brief breaths or short pauses where appropriate (e.g. small <break time="120ms"/>), and avoid overly long sentences.

          TTS guidance (for the ssml field): Use SSML tags (<speak>, <break>, <prosody>, <emphasis>) to create natural intonation. Insert small, optional breaths or hesitations sparingly (e.g. <break time="80ms"/>), keep speaking rate moderate, and prefer a slightly warmer timbre. Do not attempt to give legal or tax advice — refer those to a human agent.
          `,
        },
      },
    },
  },
  audio: {
    sampleRate: 48000,
    channelCount: 1,
  },
  audioPlayer: {
    minChunkSamples: 48000,
    flushMs: 50,
    fadeMs: 3,
    overlap: 0.04,
    leadTime: 0.03,
  },
  prompts: {
    secretarySystemPrompt: `You are "Secretary AI", a warm, professional telephone assistant for Growth Properties. Language: English. Tone: warm, friendly and businesslike. Collect structured lead/property data, finish with a short summary and a recommended next step. At call end return both: (1) JSON with fields + summary + leadQuality (0-100) + recommendedNext, and (2) an SSML string for high-quality TTS with natural prosody and short pauses.`,
    summaryPrompt: `Input: full call transcript. Output: JSON {summary:[max 3 short bullets], keyFacts:{...}, questionsNeeded:[...], leadQuality:0-100, recommendedNext:string}. Be factual and concise.`,
    dealAnalysisPrompt: `Input: lead-data JSON and transcript summary. Output: JSON {dealScore:0-100, riskFlags:[...], repairEstimateEUR:number|'unknown', suggestedOfferRange:[min,max], rationale:string}. If crucial data is missing, set 'needs_info' and list required fields.`,
    investorPrompt: `You are an investment assistant. For anonymous visitors: brief and informative. For logged-in users: provide detailed analyses, access to saved deals, and search/filter functionality. Cite sources and assumptions for financial estimates.`,
    speechSSMLTemplate: `<speak>
  <p><break time="120ms"/>Hello, my name is Secretary AI. <break time="80ms"/> I'm calling regarding your property.</p>
  <p><prosody rate="medium" pitch="medium">Could I confirm your full name?</prosody></p>
</speak>`,
    jsonSchema: `{
  "type": "object",
  "properties": {
    "summary": { "type": "string" },
    "highlights": { "type": "array", "items": { "type": "string" } },
    "sentiment": { "type": "integer", "minimum": 0, "maximum": 100 },
    "quality": { "type": "string", "enum": ["A", "B", "C"] },
    "score": { "type": "integer", "minimum": 0, "maximum": 100 },
    "timeline": {
      "type": "object",
      "properties": {
        "firstCall": { "type": "string", "nullable": true },
        "lastCall": { "type": "string", "nullable": true },
        "totalCalls": { "type": "integer" }
      }
    },
    "recommendedNextActions": { "type": "array", "items": { "type": "string" } },
    "sourceCalls": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "callId": { "type": "string", "nullable": true },
          "createdAt": { "type": "string", "nullable": true },
          "excerpt": { "type": "string", "nullable": true }
        }
      }
    },
    "extractedFacts": { "type": "object" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "followUp": {
      "type": "object",
      "properties": {
        "method": { "type": "string", "nullable": true },
        "delay_days": { "type": "integer", "nullable": true }
      }
    },
    "raw": { "type": "object", "nullable": true },
    "errors": { "type": "string", "nullable": true }
  },
  "required": [
    "summary",
    "highlights",
    "sentiment",
    "quality",
    "score",
    "timeline",
    "recommendedNextActions",
    "sourceCalls",
    "extractedFacts",
    "tags",
    "followUp",
    "raw",
    "errors"
  ]
}`,
  },
};

// ---------------------------
// Utilities
// ---------------------------

function floatTo16BitPCM(float32Array) {
  const l = float32Array.length;
  const out = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function resampleBuffer(buffer, inRate, outRate) {
  if (inRate === outRate) return buffer;
  const ratio = inRate / outRate;
  const newLength = Math.floor(buffer.length / ratio);
  const out = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const s0 = buffer[i0] || 0;
    const s1 = buffer[i0 + 1] || 0;
    out[i] = s0 * (1 - frac) + s1 * frac;
  }
  return out;
}

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class AudioPlayer2 {
  constructor() {
    this.audioContext = null;
    this.currentSource = null;
    this.queue = [];
    this._processing = false;
    this._accChunks = [];
    this._accLength = 0;
    this._minChunkSamples = CONFIG.audioPlayer.minChunkSamples;
    this._flushTimer = null;
    this.nextPlayTime = 0;
  }

  async init() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )({ sampleRate: CONFIG.audio.sampleRate });
      } catch (e) {
        this.audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )();
      }
      console.log(
        "[VA2] AudioContext sample rate:",
        this.audioContext.sampleRate,
      );
      this.nextPlayTime = this.audioContext.currentTime + 0.03;
    }
  }

  async playRawPCM(arrayBuffer, sampleRate) {
    await this.init();
    try {
      console.log('[VA2] playRawPCM incoming sampleRate:', sampleRate, 'AudioContext rate:', this.audioContext.sampleRate);
      const int16 = new Int16Array(arrayBuffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
      const ctxRate = this.audioContext.sampleRate;
      const playFloat32 =
        sampleRate === ctxRate
          ? float32
          : resampleBuffer(float32, sampleRate, ctxRate);

      this._accChunks.push(playFloat32);
      this._accLength += playFloat32.length;

      const tryEnqueue = () => {
        if (this._accLength >= this._minChunkSamples) {
          const out = new Float32Array(this._minChunkSamples);
          let written = 0;
          while (written < out.length && this._accChunks.length) {
            const chunk = this._accChunks[0];
            const need = out.length - written;
            if (chunk.length <= need) {
              out.set(chunk, written);
              written += chunk.length;
              this._accChunks.shift();
            } else {
              out.set(chunk.subarray(0, need), written);
              this._accChunks[0] = chunk.subarray(need);
              written += need;
            }
          }
          this._accLength -= out.length;
          this.queue.push({ samples: out, resolve: () => {} });
          this._processQueue();
          return true;
        }
        return false;
      };

      if (!tryEnqueue()) {
        if (this._flushTimer) clearTimeout(this._flushTimer);
        this._flushTimer = setTimeout(() => {
          if (this._accLength > 0) {
            const chunk = new Float32Array(this._accLength);
            let off = 0;
            while (this._accChunks.length) {
              const c = this._accChunks.shift();
              chunk.set(c, off);
              off += c.length;
            }
            this._accLength = 0;
            this.queue.push({ samples: chunk, resolve: () => {} });
            this._processQueue();
          }
        }, CONFIG.audioPlayer.flushMs);
      }

      return Promise.resolve();
    } catch (err) {
      console.error("[VA2] Error playing raw PCM:", err);
    }
  }

  _processQueue() {
    if (this._processing) return;
    if (!this.queue.length) return;
    const item = this.queue.shift();
    this._processing = true;

    try {
      const fadeMs = CONFIG.audioPlayer.fadeMs;
      const sr = this.audioContext.sampleRate;
      const fadeSamples = Math.min(
        Math.floor((fadeMs / 1000) * sr),
        Math.floor(item.samples.length / 2),
      );
      const samples = item.samples;
      if (fadeSamples > 0) {
        for (let i = 0; i < fadeSamples; i++) {
          const ramp = i / fadeSamples;
          samples[i] *= ramp;
          samples[samples.length - 1 - i] *= ramp;
        }
      }

      const audioBuffer = this.audioContext.createBuffer(1, samples.length, sr);
      audioBuffer.getChannelData(0).set(samples);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      if (this.audioContext.state === "suspended") {
        this.audioContext.resume().catch(() => {});
      }
      const now = this.audioContext.currentTime;
      const overlap = 0.04;
      let startAt = Math.max(this.nextPlayTime - overlap, now + 0.005);
      if (startAt < now + 0.005) startAt = now + 0.005;
      try {
        source.start(startAt);
      } catch (e) {
        source.start();
        startAt = this.audioContext.currentTime;
      }
      this.currentSource = source;
      this.nextPlayTime = startAt + audioBuffer.duration - overlap;
      source.onended = () => {
        try {
          item.resolve();
        } catch (e) {}
        this.currentSource = null;
        this._processing = false;
        if (this.queue.length) this._processQueue();
      };
    } catch (err) {
      console.error("[VA2] Error processing audio queue:", err);
      try {
        item.resolve();
      } catch (e) {}
      this._processing = false;
    }
  }

  stop() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {}
      this.currentSource = null;
    }
    this.queue = [];
    this._accChunks = [];
    this._accLength = 0;
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
  }
}

// ---------------------------
// Voice Agent WebSocket client
// ---------------------------

class VoiceAgentClient2 {
  constructor(config) {
    this.config = config;
    this.socket = null;
    this.isConnected = false;
    this.onUserSpeechCallback = null;
    this.onAgentSpeechCallback = null;
    this.onAudioCallback = null;
    this.onErrorCallback = null;
    this._shouldReconnect = false;
    this._reconnectAttempts = 0;
    this._settingsSent = false;
  }

  onUserSpeech(callback) {
    this.onUserSpeechCallback = callback;
  }
  onAgentSpeech(callback) {
    this.onAgentSpeechCallback = callback;
  }
  onAudio(callback) {
    this.onAudioCallback = callback;
  }
  onError(callback) {
    this.onErrorCallback = callback;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log("[VA2] Connecting to Deepgram Voice Agent...");
        this.socket = new WebSocket(this.config.endpoint, [
          "token",
          this.config.apiKey,
        ]);
        this.socket.binaryType = "arraybuffer";

        this.socket.onopen = () => {
          console.log("[VA2] WebSocket connected, sending Settings immediately and waiting for Welcome...");
          try {
            this.sendSettings();
          } catch (e) {
            console.warn('[VA2] sendSettings on open failed:', e);
          }
        };

        this._shouldReconnect = true;
        this.socket.onmessage = (event) => this.handleMessage(event.data);
        this.socket.onerror = (err) => {
          console.error("[VA2] WebSocket error", err);
          if (this.onErrorCallback) this.onErrorCallback(err);
          reject(err);
        };
        this.socket.onclose = (event) => {
          console.log("[VA2] WebSocket closed", event);
          this.isConnected = false;
          if (this._shouldReconnect) {
            if (this.onErrorCallback)
              this.onErrorCallback(
                new Error("WebSocket closed by remote host"),
              );
            const backoff = Math.min(
              30000,
              1000 * Math.pow(2, this._reconnectAttempts),
            );
            console.log("[VA2] Reconnecting in", backoff, "ms");
            setTimeout(() => {
              this._reconnectAttempts++;
              this.connect().catch(() => {});
            }, backoff);
          } else {
            console.log(
              "[VA2] WebSocket closed intentionally; not treating this as an error.",
            );
          }
        };

        this._connectedResolve = resolve;
      } catch (error) {
        reject(error);
      }
    });
  }

  handleMessage(data) {
    if (data instanceof ArrayBuffer) {
      if (data.byteLength && data.byteLength > 16) {
        if (this.onAudioCallback) this.onAudioCallback(data);
      } else {
        console.warn(
          "[VA2] Ignoring small binary message, size:",
          data.byteLength,
        );
      }
      return;
    }

    try {
      const msg = JSON.parse(data);

      switch (msg.type) {
        case "Welcome":
            console.log("[VA2] Welcome received");
            if (!this._settingsSent) {
              console.log("[VA2] Settings not yet sent — sending now");
              this.sendSettings();
            } else {
              console.log("[VA2] Settings already sent; skipping");
            }
          break;
        case "SettingsApplied":
          console.log("[VA2] Settings applied");
          this.isConnected = true;
          this._reconnectAttempts = 0;
          if (this._connectedResolve) {
            this._connectedResolve();
            this._connectedResolve = null;
          }
          break;
        case "ConversationText":
          console.log("[VA2] ConversationText received:", msg);
          const text = (msg.text || msg.content || msg.transcript || "").trim();
          const displayText = text || "(no text)";
          if (msg.role === "user") {
            if (this.onUserSpeechCallback)
              this.onUserSpeechCallback(displayText);
          } else {
            if (this.onAgentSpeechCallback)
              this.onAgentSpeechCallback(displayText);
          }
          break;
        case "Error":
          console.error(
            "[VA2] Agent error (full):",
            JSON.stringify(msg, null, 2),
          );
          if (this.onErrorCallback)
            this.onErrorCallback(
              new Error(
                msg.description || msg.message || msg.code || "Unknown",
              ),
            );
          this.disconnect();
          break;
        default:
      }
    } catch (err) {
      console.error("[VA2] Error parsing message:", err);
    }
  }

  sendSettings() {
    // mark settings sent so we don't resend unnecessarily
    this._settingsSent = true;
    const base = JSON.parse(JSON.stringify(this.config.settings || {}));
    const settings = Object.assign({}, base);
    settings.type = "Settings";
    settings.audio = settings.audio || {};
    settings.audio.input = {
      encoding: "linear16",
      sample_rate: CONFIG.audio.sampleRate,
    };
    settings.audio.output = {
      encoding: "linear16",
      sample_rate:
        CONFIG.audio && CONFIG.audio.sampleRate
          ? CONFIG.audio.sampleRate
          : 16000,
      container: "none",
    };
    settings.agent = settings.agent || {};
    settings.agent.language = settings.agent.language || "en";
    settings.agent.listen = settings.agent.listen || {
      provider: { type: "deepgram", model: "nova-3" },
    };

    if (settings.agent.think) {
      if (typeof settings.agent.think === "string") {
        settings.agent.think = { prompt: settings.agent.think };
      }
      if (settings.agent.think.instructions && !settings.agent.think.prompt) {
        settings.agent.think.prompt = settings.agent.think.instructions;
        delete settings.agent.think.instructions;
      }
      if (!settings.agent.think.provider) {
        console.warn(
          "[VA2] agent.think has no provider; removing think from Settings to avoid UNPARSABLE_CLIENT_MESSAGE. Provide agent.think.provider to enable LLM think.",
        );
        delete settings.agent.think;
      }
    }

    console.log("[VA2] Sending Settings:", JSON.stringify(settings, null, 2));
    this.socket.send(JSON.stringify(settings));
  }

  sendAudio(arrayBuffer) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(arrayBuffer);
    } else {
      console.warn("[VA2] Cannot send audio - WebSocket not open");
    }
  }

  sendKeepAlive() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "KeepAlive" }));
    }
  }

  disconnect() {
    this._shouldReconnect = false;
    this._reconnectAttempts = 0;
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {}
      this.socket = null;
      this.isConnected = false;
    }
  }

  onUserSpeech(cb) {
    this.onUserSpeechCallback = cb;
  }
  onAgentSpeech(cb) {
    this.onAgentSpeechCallback = cb;
  }
  onAudio(cb) {
    this.onAudioCallback = cb;
  }
  onError(cb) {
    this.onErrorCallback = cb;
  }
}

// ---------------------------
// Recorder using AudioWorklet with ScriptProcessor fallback
// ---------------------------

class AudioRecorder2 {
  constructor(config) {
    this.config = config;
    this.audioContext = null;
    this.workletNode = null;
    this.processor = null;
    this.source = null;
    this.stream = null;
    this.onData = null;
    this._silentGain = null;
  }

  async start(onDataAvailable) {
    this.onData = onDataAvailable;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: this.config.channelCount },
    });

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: this.config.sampleRate,
    });
    this.source = this.audioContext.createMediaStreamSource(this.stream);

    if (this.audioContext.audioWorklet) {
      const workletCode = `
      class RecorderProcessor extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0];
          if (input && input[0]) {
            const buffer = new Float32Array(input[0]);
            this.port.postMessage(buffer, [buffer.buffer]);
          }
          return true;
        }
      }
      registerProcessor('recorder-processor', RecorderProcessor);
      `;

      const blob = new Blob([workletCode], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(url);
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        "recorder-processor",
      );
      this.workletNode.port.onmessage = (e) =>
        this._handleWorkletMessage(e.data);
      this._silentGain = this.audioContext.createGain();
      this._silentGain.gain.value = 0;
      this.source.connect(this.workletNode);
      this.workletNode.connect(this._silentGain);
      this._silentGain.connect(this.audioContext.destination);
    } else {
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input);
        this._handleWorkletMessage(copy);
      };
      this.source.connect(this.processor);
      this._silentGain = this.audioContext.createGain();
      this._silentGain.gain.value = 0;
      this.processor.connect(this._silentGain);
      this._silentGain.connect(this.audioContext.destination);
    }

    console.log("[VA2] Recording started");
  }

  _handleWorkletMessage(float32) {
    if (!this.audioContext) return;
    const inRate = this.audioContext.sampleRate || this.config.sampleRate;
    const targetRate = this.config.sampleRate;
    const resampled =
      inRate === targetRate
        ? float32
        : resampleBuffer(float32, inRate, targetRate);
    const int16 = floatTo16BitPCM(resampled);
    if (this.onData) this.onData(int16.buffer);
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch (e) {}
      this.workletNode = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (e) {}
      this.source = null;
    }
    if (this._silentGain) {
      try {
        this._silentGain.disconnect();
      } catch (e) {}
      this._silentGain = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    console.log("[VA2] Recording stopped");
  }
}

// ---------------------------
// Minimal UI glue (re-uses index.html elements)
// ---------------------------

class VoiceAgentApp2 {
  constructor() {
    this.client = new VoiceAgentClient2(CONFIG.voiceAgent);
    this.recorder = new AudioRecorder2(CONFIG.audio);
    this.player = new AudioPlayer2();

    this.startBtn = document.getElementById("startBtn");
    this.stopBtn = document.getElementById("stopBtn");
    this.conversationLog = document.getElementById("conversationLog");
    this.statusIndicator = document.getElementById("deepgramStatus");
    this.statusText = document.getElementById("deepgramStatusText");
    this.sessionIdEl = document.getElementById("sessionId");
    this.messageCountEl = document.getElementById("messageCount");
    this.startTimeEl = document.getElementById("startTime");

    this.sessionId = null;
    this.startTime = null;
    this.messageCount = 0;
    this.keepAlive = null;
    this.muted = false;

    this.init();
    // expose a convenience alias so callers that reference `voiceAgent2.client.setMuted`
    // will work even though the logic lives on the app object.
    try {
      this.client.setMuted = (v) => this.setMuted(v);
    } catch (e) {
      console.warn('[VA2] Could not attach client.setMuted alias', e);
    }
  }

  init() {
    if (this.startBtn) {
      this.startBtn.addEventListener("click", () => this.start());
    } else {
      console.warn('[VA2] startBtn not found in DOM; start button disabled');
    }

    if (this.stopBtn) {
      this.stopBtn.addEventListener("click", () => this.stop());
    } else {
      console.warn('[VA2] stopBtn not found in DOM; stop button disabled');
    }

    // Safely wire client callbacks. addMessage and player.handle will guard for missing DOM/audio.
    this.client.onUserSpeech((t) => this.addMessage("user", t));
    this.client.onAgentSpeech((t) => this.addMessage("ai", t));
    this.client.onAudio(async (buf) => {
      try {
        await this.player.playRawPCM(buf, CONFIG.audio.sampleRate);
      } catch (e) {
        console.warn('[VA2] Failed to play audio chunk', e);
      }
    });
    this.client.onError((err) => this.handleError(err));
  }

  addMessage(role, text) {
    if (!this.conversationLog) {
      // Fallback: log to console when conversation log element is not present
      console.log('[VA2] message', { role, text });
    } else {
      const el = document.createElement("div");
      el.className = "message " + (role === "ai" ? "ai" : "user");
      const rl = document.createElement("div");
      rl.className = "message-role";
      rl.textContent = role === "ai" ? "Secretary AI" : "You";
      const tx = document.createElement("div");
      tx.className = "message-text";
      tx.textContent = text;
      el.appendChild(rl);
      el.appendChild(tx);
      this.conversationLog.appendChild(el);
      this.conversationLog.scrollTop = this.conversationLog.scrollHeight;
    }

    this.messageCount += 1;
    if (this.messageCountEl)
      this.messageCountEl.textContent = String(this.messageCount);
  }

  updateStatus(connected) {
    if (connected) {
      this.statusIndicator.classList.add("active");
      this.statusText.textContent = "Voice Agent: Connected";
    } else {
      this.statusIndicator.classList.remove("active");
      this.statusText.textContent = "Voice Agent: Disconnected";
    }
  }

  async start() {
    try {
      this.startBtn.disabled = true;
      this.stopBtn.disabled = false;
      this.updateStatus(false);

      this.sessionId = generateUUID();
      this.startTime = new Date();
      this.messageCount = 0;
      if (this.sessionIdEl) this.sessionIdEl.textContent = this.sessionId;
      if (this.startTimeEl)
        this.startTimeEl.textContent = this.startTime.toLocaleString();
      if (this.messageCountEl)
        this.messageCountEl.textContent = String(this.messageCount);
      console.log("[VA2] Session started:", this.sessionId);

      await this.client.connect();

      await this.recorder.start((audioBuffer) => {
        try {
          if (!this.muted) this.client.sendAudio(audioBuffer);
        } catch (e) {
          console.warn('[VA2] Error in recorder callback:', e);
        }
      });

      this.keepAlive = setInterval(() => this.client.sendKeepAlive(), 5000);
      this.updateStatus(true);
    } catch (err) {
      this.handleError(err);
    }
  }

  async stop() {
    try {
      if (this.keepAlive) {
        clearInterval(this.keepAlive);
        this.keepAlive = null;
      }
      this.recorder.stop();
      this.client.disconnect();
      this.player.stop();
      this.updateStatus(false);

      if (this.startTimeEl) this.startTimeEl.textContent = "-";
      this.startBtn.disabled = false;
      this.stopBtn.disabled = true;
      console.log("[VA2] Session ended:", this.sessionId);
    } catch (err) {
      console.error("[VA2] Stop error", err);
    }
  }

  // Mute/unmute sending microphone audio to the agent
  setMuted(v) {
    this.muted = !!v;
    console.log('[VA2] setMuted ->', this.muted);
    return this.muted;
  }

  isMuted() {
    return !!this.muted;
  }

  handleError(err) {
    console.error("[VA2] Error", err);
    this.addMessage("ai", "Error: " + (err.message || err));
    this.stop().catch(() => {});
  }
}

function tryAutoInit() {
  // Only auto-init if the host element exists or an explicit flag is set.
  const hostPresent = !!document.getElementById('voiceAgentHost');
  const explicit = !!window.__VA_AUTO_INIT;
  if (!hostPresent && !explicit) {
    console.log('[VA2] Skipping auto-init; add <div id="voiceAgentHost"></div> or set window.__VA_AUTO_INIT = true to initialize');
    return;
  }
  try {
    window.voiceAgent2 = new VoiceAgentApp2();
  } catch (e) {
    console.error('[VA2] Failed to auto-initialize VoiceAgentApp2', e);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", tryAutoInit);
} else {
  tryAutoInit();
}

console.log("[VA2] Script loaded — voice agent ready (auto-init conditional)");
