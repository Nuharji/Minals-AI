const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const store = require('../store');

/**
 * Transcribes a WAV audio buffer (16kHz, mono, 16-bit PCM) using a local
 * whisper.cpp binary. The binary and model path are configured by the user
 * in the settings panel, since whisper.cpp is not bundled (large native
 * binary + model weights, not fit for the Flatpak sandbox by default).
 *
 * Expects a whisper.cpp CLI compatible with `whisper-cli` / `main`:
 *   <binary> -m <model> -f <wavfile> -otxt -of <outputPrefix>
 */
async function transcribeAudio(wavBuffer) {
  const binaryPath = store.get('sttBinaryPath');
  const modelPath = store.get('sttModelPath');

  if (!binaryPath || !modelPath) {
    return {
      error:
        'STT ist nicht konfiguriert. Bitte Pfad zu einem whisper.cpp-Binary und Modell in den Einstellungen hinterlegen.'
    };
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'minals-stt-'));
  const wavPath = path.join(tmpDir, 'input.wav');
  const outPrefix = path.join(tmpDir, 'output');

  await fs.writeFile(wavPath, wavBuffer);

  return new Promise((resolve) => {
    const proc = spawn(binaryPath, [
      '-m',
      modelPath,
      '-f',
      wavPath,
      '-otxt',
      '-of',
      outPrefix,
      '-l',
      'auto',
      '-nt'
    ]);

    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));

    proc.on('error', async (err) => {
      await fs.rm(tmpDir, { recursive: true, force: true });
      resolve({ error: `whisper.cpp konnte nicht gestartet werden: ${err.message}` });
    });

    proc.on('close', async (code) => {
      try {
        if (code !== 0) {
          resolve({ error: `whisper.cpp Exit-Code ${code}: ${stderr}` });
          return;
        }
        const text = await fs.readFile(`${outPrefix}.txt`, 'utf-8');
        resolve({ text: text.trim() });
      } catch (err) {
        resolve({ error: `Transkript konnte nicht gelesen werden: ${err.message}` });
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });
}

module.exports = { transcribeAudio };
