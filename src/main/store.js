const Store = require('electron-store');

const store = new Store({
  name: 'minals-settings',
  defaults: {
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
