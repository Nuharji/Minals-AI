const Anthropic = require('@anthropic-ai/sdk');
const { toolDefinitions, executeTool } = require('./skills');
const { getApiKey } = require('./secrets');

const MODEL = 'claude-sonnet-5';
const MAX_TOOL_ROUNDS = 6;

const SYSTEM_PROMPT = `Du bist Minals, ein hilfsbereiter, praeziser KI-Assistent fuer den Linux-Desktop, inspiriert von Jarvis aus Iron Man.
Du sprichst deutsch, es sei denn der Nutzer schreibt in einer anderen Sprache.
Du hast Zugriff auf System-Tools (Apps oeffnen, Dateien suchen, Systeminfo, Benachrichtigungen, Erinnerungen, whitelisted Shell-Befehle).
Nutze Tools nur wenn sie fuer die Anfrage tatsaechlich noetig sind, und fasse das Ergebnis danach kurz und klar in natuerlicher Sprache zusammen.
Sei knapp, direkt und leicht selbstbewusst-sachlich im Ton, wie ein kompetenter Assistent.`;

function getClient() {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Kein Anthropic API-Key gespeichert. Bitte in den Einstellungen hinterlegen.');
  }
  return new Anthropic({ apiKey });
}

/**
 * Runs one user turn against Claude, executing any requested tools until
 * a final text response is produced or MAX_TOOL_ROUNDS is exhausted.
 * `history` is an array of Anthropic message objects (without system prompt).
 * `onEvent` receives progress events for the renderer (e.g. tool calls).
 */
async function runTurn(history, onEvent = () => {}) {
  const client = getClient();
  const messages = [...history];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages
    });

    messages.push({ role: 'assistant', content: response.content });

    const toolUses = response.content.filter((block) => block.type === 'tool_use');

    if (toolUses.length === 0) {
      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
      return { text, messages };
    }

    const toolResults = [];
    for (const toolUse of toolUses) {
      onEvent({ type: 'tool_call', name: toolUse.name, input: toolUse.input });
      const result = await executeTool(toolUse.name, toolUse.input);
      onEvent({ type: 'tool_result', name: toolUse.name, result });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result)
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return {
    text: 'Ich konnte die Anfrage nicht abschliessen (zu viele Tool-Aufrufe). Bitte praezisiere sie.',
    messages
  };
}

module.exports = { runTurn };
