const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('minals', {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (partial) => ipcRenderer.invoke('settings:set', partial)
  },
  secrets: {
    setApiKey: (apiKey) => ipcRenderer.invoke('secrets:setApiKey', apiKey),
    hasApiKey: () => ipcRenderer.invoke('secrets:hasApiKey'),
    clearApiKey: () => ipcRenderer.invoke('secrets:clearApiKey')
  },
  chat: {
    send: (history, text) => ipcRenderer.invoke('chat:send', { history, text }),
    onEvent: (callback) => {
      const listener = (_evt, event) => callback(event);
      ipcRenderer.on('chat:event', listener);
      return () => ipcRenderer.removeListener('chat:event', listener);
    }
  },
  voice: {
    transcribe: (wavBase64) => ipcRenderer.invoke('voice:transcribe', wavBase64),
    speak: (text) => ipcRenderer.invoke('voice:speak', text)
  }
});
