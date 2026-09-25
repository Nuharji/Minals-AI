const { toolDefinitions, executeTool } = require('./skills');
const store = require('./store');

const MAX_TOOL_ROUNDS = 6;

const SYSTEM_PROMPT = `Du bist Minals, ein hilfsbereiter, praeziser KI-Assistent fuer den Linux-Desktop, inspiriert von Jarvis aus Iron Man.
Du laeufst vollstaendig lokal auf dem Rechner des Nutzers, ueber ein selbst gehostetes Sprachmodell.
Du sprichst deutsch, es sei denn der Nutzer schreibt in einer anderen Sprache.
Du hast Zugriff auf System-Tools (Apps oeffnen, Dateien suchen, Systeminfo, Benachrichtigungen, Erinnerungen, whitelisted Shell-Befehle).
Nutze Tools nur wenn sie fuer die Anfrage tatsaechlich noetig sind, und fasse das Ergebnis danach kurz und klar in natuerlicher Sprache zusammen.
Sei knapp, direkt und leicht selbstbewusst-sachlich im Ton, wie ein kompetenter Assistent.`;

// Ollama's /api/chat expects OpenAI-style function tool definitions;
// our skill registry stores them as {name, input_schema}, so translate on
// the way out.
function toOllamaTools() {
  return toolDefinitions.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }
  }));
}

async function ollamaChat(messages, tools) {
  const host = store.get('ollamaHost');
  const model = store.get('ollamaModel');
  if (!model) {
    throw new Error('Kein lokales Modell ausgewaehlt. Bitte in den Einstellungen ein Ollama-Modell waehlen.');
  }

  let response;
  try {
    response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        tools,
        stream: false
      })
    });
  } catch (err) {
    throw new Error(
      `Ollama unter ${host} nicht erreichbar (laeuft "ollama serve"?). Details: ${err.message}`
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Ollama antwortete mit ${response.status}: ${body}`);
  }

  const data = await response.json();
  return data.message;
}

/**
 * Runs one user turn against the local model, executing any requested tools
 * until a final text response is produced or MAX_TOOL_ROUNDS is exhausted.
 * `history` is an array of {role, content} messages (no system prompt).
 * `onEvent` receives progress events for the renderer (e.g. tool calls).
 */
async function runTurn(history, onEvent = () => {}) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...history];
  const toolsEnabled = store.get('toolsEnabled');
  const tools = toolsEnabled ? toOllamaTools() : undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const message = await ollamaChat(messages, tools);
    messages.push(message);

    const toolCalls = message.tool_calls || [];
    if (toolCalls.length === 0) {
      return { text: message.content || '', messages: messages.slice(1) };
    }

    for (const call of toolCalls) {
      const { name, arguments: input } = call.function;
      onEvent({ type: 'tool_call', name, input });
      const result = await executeTool(name, input);
      onEvent({ type: 'tool_result', name, result });
      messages.push({
        role: 'tool',
        tool_name: name,
        content: JSON.stringify(result)
      });
    }
  }

  return {
    text: 'Ich konnte die Anfrage nicht abschliessen (zu viele Tool-Aufrufe). Bitte praezisiere sie.',
    messages: messages.slice(1)
  };
}

async function listModels() {
  const host = store.get('ollamaHost');
  try {
    const response = await fetch(`${host}/api/tags`);
    if (!response.ok) return { error: `Ollama antwortete mit ${response.status}` };
    const data = await response.json();
    return { models: (data.models || []).map((m) => m.name) };
  } catch (err) {
    return { error: `Ollama unter ${host} nicht erreichbar: ${err.message}` };
  }
}

module.exports = { runTurn, listModels };
