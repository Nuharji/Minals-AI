// ---------- HUD canvas: Jarvis-style animated ring visualizer ----------

const canvas = document.getElementById('hudCanvas');
const ctx = canvas.getContext('2d');
const hudStatus = document.getElementById('hudStatus');

let hudState = 'idle'; // idle | listening | thinking | speaking
let hudLevel = 0; // 0..1 audio level for listening/speaking pulses
let animFrame = 0;

function drawHud() {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  ctx.clearRect(0, 0, w, h);

  const colors = {
    idle: '#3ee8ff',
    listening: '#4dff9e',
    thinking: '#ffd23e',
    speaking: '#3ee8ff'
  };
  const color = colors[hudState] || colors.idle;

  const baseRadius = 90;
  const pulse = hudState === 'idle' ? Math.sin(animFrame / 40) * 4 : hudLevel * 30;

  // Outer rotating ring, segmented
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(animFrame / (hudState === 'thinking' ? 30 : 200));
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2;
  const segments = 24;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const len = i % 3 === 0 ? 14 : 8;
    const r1 = baseRadius + 30;
    const r2 = r1 + len;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
    ctx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2);
    ctx.stroke();
  }
  ctx.restore();

  // Core circle
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius + pulse, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.55 + pulse * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.12;
  ctx.fill();

  ctx.globalAlpha = 1;
  animFrame++;
  requestAnimationFrame(drawHud);
}
requestAnimationFrame(drawHud);

function setHudState(state) {
  hudState = state;
  const labels = {
    idle: 'Bereit',
    listening: 'Höre zu…',
    thinking: 'Denke nach…',
    speaking: 'Spreche…'
  };
  hudStatus.textContent = labels[state] || state;
}

// ---------- Chat ----------

const chatLog = document.getElementById('chatLog');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const micBtn = document.getElementById('micBtn');

let conversationHistory = [];

function appendMessage(role, text) {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.textContent = text;
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
  return el;
}

function appendToolTrace(text) {
  const el = document.createElement('div');
  el.className = 'msg tool';
  el.textContent = text;
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
  return el;
}

async function appendGeneratedImage(imagePath) {
  const { base64, error } = await window.minals.images.read(imagePath);
  if (error) {
    appendToolTrace(`⚠ Bild konnte nicht geladen werden: ${error}`);
    return;
  }
  const wrapper = document.createElement('div');
  wrapper.className = 'msg assistant image';
  const img = document.createElement('img');
  img.src = `data:image/png;base64,${base64}`;
  wrapper.appendChild(img);
  chatLog.appendChild(wrapper);
  chatLog.scrollTop = chatLog.scrollHeight;
}

window.minals.chat.onEvent((event) => {
  if (event.type === 'tool_call') {
    appendToolTrace(`⚙ ${event.name}(${JSON.stringify(event.input)})`);
  } else if (event.type === 'tool_result') {
    if (event.name === 'generate_image' && event.result && event.result.success) {
      appendGeneratedImage(event.result.path);
    } else {
      appendToolTrace(`→ ${JSON.stringify(event.result).slice(0, 300)}`);
    }
  }
});

async function sendMessage(text) {
  if (!text.trim()) return;
  appendMessage('user', text);
  setHudState('thinking');

  const result = await window.minals.chat.send(conversationHistory, text);

  if (result.error) {
    appendMessage('assistant', `⚠ Fehler: ${result.error}`);
    setHudState('idle');
    return;
  }

  conversationHistory = result.messages;
  appendMessage('assistant', result.text);
  setHudState('idle');

  const settings = await window.minals.settings.get();
  if (settings.voiceEnabled && result.text) {
    await speak(result.text);
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value;
  chatInput.value = '';
  sendMessage(text);
});

// ---------- Voice input (mic -> WAV -> whisper.cpp via main) ----------

let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);
  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
    const wavBase64 = await blobToWavBase64(blob);
    setHudState('thinking');
    const { text, error } = await window.minals.voice.transcribe(wavBase64);
    if (error) {
      appendToolTrace(`⚠ STT-Fehler: ${error}`);
      setHudState('idle');
      return;
    }
    if (text) {
      await sendMessage(text);
    } else {
      setHudState('idle');
    }
  };
  mediaRecorder.start();
  isRecording = true;
  micBtn.classList.add('recording');
  setHudState('listening');
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    micBtn.classList.remove('recording');
  }
}

micBtn.addEventListener('click', () => {
  if (isRecording) stopRecording();
  else startRecording();
});

async function blobToWavBase64(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  const targetRate = 16000;
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();

  const pcm = rendered.getChannelData(0);
  const wavBuffer = encodeWav(pcm, targetRate);
  const bytes = new Uint8Array(wavBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

async function speak(text) {
  setHudState('speaking');
  const { audioBase64, error } = await window.minals.voice.speak(text);
  if (error) {
    appendToolTrace(`⚠ TTS-Fehler: ${error}`);
    setHudState('idle');
    return;
  }
  const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
  audio.onended = () => setHudState('idle');
  audio.play();
}

// ---------- Settings panel ----------

const settingsOverlay = document.getElementById('settingsOverlay');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

const ollamaHost = document.getElementById('ollamaHost');
const ollamaModelSelect = document.getElementById('ollamaModelSelect');
const refreshModelsBtn = document.getElementById('refreshModelsBtn');
const toolsEnabled = document.getElementById('toolsEnabled');
const ollamaStatus = document.getElementById('ollamaStatus');
const sttBinaryPath = document.getElementById('sttBinaryPath');
const sttModelPath = document.getElementById('sttModelPath');
const ttsBinaryPath = document.getElementById('ttsBinaryPath');
const ttsVoicePath = document.getElementById('ttsVoicePath');
const voiceEnabled = document.getElementById('voiceEnabled');
const allowedShellCommands = document.getElementById('allowedShellCommands');
const sdHost = document.getElementById('sdHost');
const sdNegativePrompt = document.getElementById('sdNegativePrompt');

async function refreshModelList(selectedModel) {
  ollamaStatus.textContent = 'Suche laufenden Ollama-Server…';
  const { models, error } = await window.minals.llm.listModels();
  ollamaModelSelect.innerHTML = '';
  if (error) {
    ollamaStatus.textContent = `⚠ ${error}`;
    return;
  }
  if (!models || models.length === 0) {
    ollamaStatus.textContent = 'Keine lokalen Modelle gefunden. "ollama pull <modell>" ausfuehren.';
    return;
  }
  for (const name of models) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    ollamaModelSelect.appendChild(opt);
  }
  if (selectedModel && models.includes(selectedModel)) {
    ollamaModelSelect.value = selectedModel;
  }
  ollamaStatus.textContent = `${models.length} lokale(s) Modell(e) gefunden.`;
}

async function openSettings() {
  const settings = await window.minals.settings.get();
  ollamaHost.value = settings.ollamaHost || '';
  toolsEnabled.checked = settings.toolsEnabled !== false;
  sttBinaryPath.value = settings.sttBinaryPath || '';
  sttModelPath.value = settings.sttModelPath || '';
  ttsBinaryPath.value = settings.ttsBinaryPath || '';
  ttsVoicePath.value = settings.ttsVoicePath || '';
  voiceEnabled.checked = Boolean(settings.voiceEnabled);
  allowedShellCommands.value = (settings.allowedShellCommands || []).join(', ');
  sdHost.value = settings.sdHost || '';
  sdNegativePrompt.value = settings.sdNegativePrompt || '';

  await refreshModelList(settings.ollamaModel);

  settingsOverlay.classList.remove('hidden');
}

settingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', () => settingsOverlay.classList.add('hidden'));

refreshModelsBtn.addEventListener('click', () => refreshModelList(ollamaModelSelect.value));

document.getElementById('saveOllamaSettingsBtn').addEventListener('click', async () => {
  await window.minals.settings.set({
    ollamaHost: ollamaHost.value.trim() || 'http://127.0.0.1:11434',
    ollamaModel: ollamaModelSelect.value || '',
    toolsEnabled: toolsEnabled.checked
  });
  ollamaStatus.textContent = 'Gespeichert.';
});

document.getElementById('saveVoiceSettingsBtn').addEventListener('click', async () => {
  await window.minals.settings.set({
    sttBinaryPath: sttBinaryPath.value.trim(),
    sttModelPath: sttModelPath.value.trim(),
    ttsBinaryPath: ttsBinaryPath.value.trim(),
    ttsVoicePath: ttsVoicePath.value.trim(),
    voiceEnabled: voiceEnabled.checked
  });
});

document.getElementById('saveSdSettingsBtn').addEventListener('click', async () => {
  await window.minals.settings.set({
    sdHost: sdHost.value.trim() || 'http://127.0.0.1:7860',
    sdNegativePrompt: sdNegativePrompt.value.trim()
  });
});

document.getElementById('saveShellWhitelistBtn').addEventListener('click', async () => {
  const list = allowedShellCommands.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  await window.minals.settings.set({ allowedShellCommands: list });
});

// First-run: check whether a local Ollama model is configured/reachable.
(async () => {
  const settings = await window.minals.settings.get();
  const { models, error } = await window.minals.llm.listModels();

  if (error) {
    appendMessage(
      'assistant',
      `Willkommen bei Minals. Ich finde keinen laufenden Ollama-Server (${error}). Bitte "ollama serve" starten und ein Modell in den Einstellungen (⚙ oben rechts) waehlen.`
    );
    openSettings();
  } else if (!settings.ollamaModel || !(models || []).includes(settings.ollamaModel)) {
    appendMessage(
      'assistant',
      'Willkommen bei Minals. Bitte waehle in den Einstellungen (⚙ oben rechts) ein lokales Ollama-Modell aus.'
    );
    openSettings();
  } else {
    appendMessage('assistant', 'Minals ist bereit. Wie kann ich helfen?');
  }
})();
