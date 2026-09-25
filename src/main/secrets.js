const { safeStorage } = require('electron');
const store = require('./store');

const KEY_STORE_ID = 'anthropicApiKeyEncrypted';

function saveApiKey(plainTextKey) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'OS-Schluesselspeicher nicht verfuegbar. Auf Flatpak wird org.freedesktop.secrets benoetigt.'
    );
  }
  const encrypted = safeStorage.encryptString(plainTextKey);
  store.set(KEY_STORE_ID, encrypted.toString('base64'));
}

function getApiKey() {
  const encoded = store.get(KEY_STORE_ID);
  if (!encoded) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
  } catch (err) {
    return null;
  }
}

function clearApiKey() {
  store.delete(KEY_STORE_ID);
}

module.exports = { saveApiKey, getApiKey, clearApiKey };
