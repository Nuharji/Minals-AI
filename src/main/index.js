const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const fs = require('fs/promises');

const store = require('./store');
const ollama = require('./ollama');
const stt = require('./voice/stt');
const tts = require('./voice/tts');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: '#05080d',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- IPC: settings ----

ipcMain.handle('settings:get', () => store.store);

ipcMain.handle('settings:set', (_evt, partial) => {
  for (const [key, value] of Object.entries(partial)) {
    store.set(key, value);
  }
  return store.store;
});

// ---- IPC: local LLM (Ollama) ----

ipcMain.handle('llm:listModels', () => ollama.listModels());

ipcMain.handle('chat:send', async (evt, { history, text }) => {
  const messages = [...history, { role: 'user', content: text }];
  try {
    const { text: replyText, messages: fullMessages } = await ollama.runTurn(messages, (event) => {
      evt.sender.send('chat:event', event);
    });
    return { text: replyText, messages: fullMessages };
  } catch (err) {
    return { error: err.message };
  }
});

// ---- IPC: voice ----

ipcMain.handle('voice:transcribe', async (_evt, wavBase64) => {
  const buffer = Buffer.from(wavBase64, 'base64');
  return stt.transcribeAudio(buffer);
});

ipcMain.handle('voice:speak', async (_evt, text) => {
  const result = await tts.synthesizeSpeech(text);
  if (result.error) return result;
  try {
    const audioBuffer = await fs.readFile(result.wavPath);
    await result.cleanup();
    return { audioBase64: audioBuffer.toString('base64') };
  } catch (err) {
    return { error: err.message };
  }
});
