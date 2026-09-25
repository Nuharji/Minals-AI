const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { Notification, shell } = require('electron');
const store = require('../store');

const execFileAsync = promisify(execFile);

async function runShellCommand({ command, args = [] }) {
  const allowed = store.get('allowedShellCommands');
  if (!allowed.includes(command)) {
    return {
      error: `Befehl "${command}" ist nicht in der Whitelist erlaubt. Erlaubt: ${allowed.join(', ')}`
    };
  }
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { timeout: 10000 });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    return { error: err.message };
  }
}

async function openApplication({ appName }) {
  try {
    await execFileAsync('gtk-launch', [appName]);
    return { success: true, message: `${appName} gestartet (gtk-launch).` };
  } catch (err) {
    try {
      await execFileAsync('xdg-open', [appName]);
      return { success: true, message: `${appName} via xdg-open geoeffnet.` };
    } catch (err2) {
      return { error: `Konnte "${appName}" nicht starten: ${err2.message}` };
    }
  }
}

async function openPath({ targetPath }) {
  const result = await shell.openPath(targetPath);
  if (result) {
    return { error: result };
  }
  return { success: true };
}

async function searchFiles({ query, directory }) {
  const searchDir = directory || os.homedir();
  try {
    const { stdout } = await execFileAsync(
      'find',
      [searchDir, '-iname', `*${query}*`, '-maxdepth', '6'],
      { timeout: 15000, maxBuffer: 1024 * 1024 }
    );
    const results = stdout.split('\n').filter(Boolean).slice(0, 50);
    return { results, count: results.length };
  } catch (err) {
    return { error: err.message, results: [] };
  }
}

async function getSystemInfo() {
  const info = {
    platform: os.platform(),
    release: os.release(),
    hostname: os.hostname(),
    uptimeSeconds: os.uptime(),
    cpuCount: os.cpus().length,
    totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
    freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
    loadAverage: os.loadavg()
  };
  return info;
}

async function sendNotification({ title, body }) {
  if (!Notification.isSupported()) {
    return { error: 'Desktop-Benachrichtigungen werden auf diesem System nicht unterstuetzt.' };
  }
  new Notification({ title, body }).show();
  return { success: true };
}

async function listDirectory({ directory }) {
  const dir = directory || os.homedir();
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return {
      entries: entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file'
      }))
    };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = {
  runShellCommand,
  openApplication,
  openPath,
  searchFiles,
  getSystemInfo,
  sendNotification,
  listDirectory
};
