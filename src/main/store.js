const Store = require('electron-store');

const store = new Store({
  name: 'minals-settings',
  defaults: {
    ollamaHost: 'http://127.0.0.1:11434',
    ollamaModel: 'huihui_ai/qwen3.5-abliterated:9b',
    toolsEnabled: true,
    wakeWord: 'hey minals',
    voiceEnabled: false,
    sttBinaryPath: '',
    sttModelPath: '',
    ttsBinaryPath: '',
    ttsVoicePath: '',
    allowedShellCommands: ['ls', 'df', 'uptime', 'uname', 'free'],
    allowedAppLaunchers: [],
    conversationHistory: []
  }
});

module.exports = store;
