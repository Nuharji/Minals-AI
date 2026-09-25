const { app } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const store = require('../store');

function imagesDir() {
  return path.join(app.getPath('userData'), 'generated-images');
}

/**
 * Generates an image locally via an Automatic1111-compatible Stable
 * Diffusion API (/sdapi/v1/txt2img). Runs entirely against the user's own
 * locally hosted backend + checkpoint; Minals applies no content filtering
 * of its own here.
 *
 * The result returned to the caller intentionally omits the raw image
 * bytes (only a file path) so it doesn't blow up the LLM's context window
 * when this becomes part of the tool-result message sent back to the model.
 * The renderer fetches the actual bytes separately via the images:read IPC.
 */
async function generateImage({ prompt, negativePrompt, width, height, steps }) {
  const host = store.get('sdHost');
  const body = {
    prompt,
    negative_prompt: negativePrompt || store.get('sdNegativePrompt') || '',
    width: width || 512,
    height: height || 512,
    steps: steps || 25
  };

  let response;
  try {
    response = await fetch(`${host}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    return {
      error: `Stable-Diffusion-Server unter ${host} nicht erreichbar (laeuft Automatic1111 mit --api?). Details: ${err.message}`
    };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { error: `Stable-Diffusion-Server antwortete mit ${response.status}: ${text}` };
  }

  const data = await response.json();
  const imageB64 = data.images && data.images[0];
  if (!imageB64) {
    return { error: 'Keine Bilddaten in der Antwort des Stable-Diffusion-Servers.' };
  }

  const dir = imagesDir();
  await fs.mkdir(dir, { recursive: true });
  const fileName = `img-${Date.now()}.png`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, Buffer.from(imageB64, 'base64'));

  return {
    success: true,
    path: filePath,
    prompt,
    width: body.width,
    height: body.height
  };
}

module.exports = { generateImage, imagesDir };
