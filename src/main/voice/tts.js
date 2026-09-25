const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const store = require('../store');

/**
 * Synthesizes speech for the given text using a local Piper binary and
 * returns the path to the generated WAV file. Piper and its voice model
 * are configured by the user (not bundled, kept out of the Flatpak to
 * keep the package small and let users pick their preferred voice/language).
 *
 *   <binary> -m <voice.onnx> -f <output.wav>   (text piped via stdin)
 */
async function synthesizeSpeech(text) {
  const binaryPath = store.get('ttsBinaryPath');
  const voicePath = store.get('ttsVoicePath');

  if (!binaryPath || !voicePath) {
    return {
      error:
        'TTS ist nicht konfiguriert. Bitte Pfad zu Piper-Binary und Stimme in den Einstellungen hinterlegen.'
    };
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'minals-tts-'));
  const outPath = path.join(tmpDir, 'output.wav');

  return new Promise((resolve) => {
    const proc = spawn(binaryPath, ['-m', voicePath, '-f', outPath]);
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));

    proc.on('error', (err) => {
      resolve({ error: `Piper konnte nicht gestartet werden: ${err.message}` });
    });

    proc.on('close', async (code) => {
      if (code !== 0) {
        await fs.rm(tmpDir, { recursive: true, force: true });
        resolve({ error: `Piper Exit-Code ${code}: ${stderr}` });
        return;
      }
      resolve({ wavPath: outPath, cleanup: () => fs.rm(tmpDir, { recursive: true, force: true }) });
    });

    proc.stdin.write(text);
    proc.stdin.end();
  });
}

module.exports = { synthesizeSpeech };
