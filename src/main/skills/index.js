const system = require('./system');
const reminders = require('./reminders');

// Tool definitions (name/description/JSON-schema input) for the local LLM's
// function-calling. Keep names in sync with the `handlers` map below.
const toolDefinitions = [
  {
    name: 'run_shell_command',
    description:
      'Fuehrt einen einzelnen, ungefaehrlichen Shell-Befehl ohne Argumente-Injection aus. Nur Befehle aus der Whitelist des Nutzers sind erlaubt.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Der Befehlsname, z.B. "uptime"' },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optionale Argumente fuer den Befehl'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'open_application',
    description: 'Startet eine installierte Desktop-Anwendung anhand ihres Namens/Desktop-IDs.',
    input_schema: {
      type: 'object',
      properties: {
        appName: { type: 'string', description: 'Name oder .desktop-ID der Anwendung' }
      },
      required: ['appName']
    }
  },
  {
    name: 'open_path',
    description: 'Oeffnet eine Datei oder einen Ordner mit der Standardanwendung.',
    input_schema: {
      type: 'object',
      properties: {
        targetPath: { type: 'string', description: 'Absoluter Pfad zur Datei/zum Ordner' }
      },
      required: ['targetPath']
    }
  },
  {
    name: 'search_files',
    description: 'Sucht nach Dateien/Ordnern, deren Name den Suchbegriff enthaelt.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Suchbegriff (Teil des Dateinamens)' },
        directory: {
          type: 'string',
          description: 'Startverzeichnis der Suche, Standard ist das Home-Verzeichnis'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'list_directory',
    description: 'Listet Dateien und Unterordner eines Verzeichnisses auf.',
    input_schema: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Zu listendes Verzeichnis' }
      }
    }
  },
  {
    name: 'get_system_info',
    description: 'Liefert Systeminformationen: CPU, RAM, Uptime, Hostname, Plattform.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'send_notification',
    description: 'Zeigt eine Desktop-Benachrichtigung an.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string' }
      },
      required: ['title', 'body']
    }
  },
  {
    name: 'set_reminder',
    description: 'Setzt eine Erinnerung/einen Timer, der nach einer bestimmten Zeit als Benachrichtigung ausgeloest wird.',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Erinnerungstext' },
        delaySeconds: { type: 'number', description: 'Verzoegerung in Sekunden' }
      },
      required: ['message', 'delaySeconds']
    }
  },
  {
    name: 'list_reminders',
    description: 'Listet alle aktiven Erinnerungen/Timer auf.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'cancel_reminder',
    description: 'Bricht eine aktive Erinnerung anhand ihrer ID ab.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'number' } },
      required: ['id']
    }
  }
];

const handlers = {
  run_shell_command: system.runShellCommand,
  open_application: system.openApplication,
  open_path: system.openPath,
  search_files: system.searchFiles,
  list_directory: system.listDirectory,
  get_system_info: system.getSystemInfo,
  send_notification: system.sendNotification,
  set_reminder: reminders.setReminder,
  list_reminders: reminders.listReminders,
  cancel_reminder: reminders.cancelReminder
};

async function executeTool(name, input) {
  const handler = handlers[name];
  if (!handler) {
    return { error: `Unbekanntes Tool: ${name}` };
  }
  try {
    return await handler(input || {});
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { toolDefinitions, executeTool };
