# Minals

Ein für Linux optimierter, Claude-gepowerter KI-Assistent mit einer an Jarvis
(Iron Man) angelehnten HUD-Oberfläche. Minals führt Konversationen, steuert
das System (Apps öffnen, Dateien suchen, Erinnerungen setzen, Benachrichtigungen
senden) und unterstützt optional lokale Sprachein-/ausgabe.

## Architektur

- **UI/Shell:** Electron (Chromium + Node), Renderer mit Canvas-basiertem HUD
- **KI:** Anthropic Claude (`@anthropic-ai/sdk`) mit Tool-Use für System-Skills
- **Sprache (optional, lokal):**
  - STT: [whisper.cpp](https://github.com/ggerganov/whisper.cpp) (extern, vom Nutzer bereitgestellt)
  - TTS: [Piper](https://github.com/rhasspy/piper) (extern, vom Nutzer bereitgestellt)
- **Packaging:** Flatpak (`org.electronjs.Electron2.BaseApp`)

Whisper.cpp und Piper werden bewusst **nicht** im Flatpak gebündelt (große
native Binaries + Modellgewichte). Stattdessen konfiguriert man in den
Einstellungen die Pfade zu bereits installierten Binaries/Modellen.

## Projektstruktur

```
src/
  main/            Electron Main-Prozess
    index.js       Fenster, IPC-Handler
    claude.js       Claude-Client mit Tool-Use-Loop
    store.js        Settings-Persistenz (electron-store)
    secrets.js       API-Key via Electron safeStorage
    skills/          System-Skills (Tools für Claude)
    voice/           STT/TTS-Anbindung an externe Binaries
  preload/          contextBridge-API für den Renderer
  renderer/         HUD + Chat-UI (HTML/CSS/JS)
flatpak/            Flatpak-Manifest, .desktop, AppStream-Metainfo
build/icon.png      App-Icon
```

## Entwicklung

```bash
npm install
npm start
```

Beim ersten Start nach dem Anthropic API-Key gefragt (Einstellungen-Icon oben
rechts). Der Key wird verschlüsselt über `safeStorage` lokal gespeichert.

## Sprachsteuerung aktivieren

1. whisper.cpp bauen/installieren und ein Modell herunterladen
   (z. B. `ggml-base.bin` oder ein deutsches/mehrsprachiges Modell).
2. Piper installieren und eine Stimme herunterladen (z. B. `de_DE-*.onnx`).
3. In den Minals-Einstellungen die Pfade zu beiden Binaries + Modellen/Stimmen
   eintragen und "Sprachein-/ausgabe aktivieren" anhaken.
4. Mikrofon-Button in der Chat-Leiste nutzen (Push-to-talk: klicken zum
   Start/Stop der Aufnahme).

## Erlaubte Shell-Befehle

Aus Sicherheitsgründen darf Claude nur Shell-Befehle ausführen, die explizit
in der Whitelist (Einstellungen) stehen. Standardmäßig sind das harmlose
Befehle wie `ls`, `df`, `uptime`, `uname`, `free`. Diese Liste bei Bedarf
erweitern – aber mit Bedacht, da Claude autonom entscheidet, wann ein Tool
aufgerufen wird.

## Flatpak-Build

Voraussetzung: `flatpak-builder`, `org.freedesktop.Platform`/`Sdk` 23.08 und
`org.electronjs.Electron2.BaseApp` als installierte Flatpak-Runtimes/Basen.

Für reproduzierbare, offline-fähige npm-Abhängigkeiten wird empfohlen,
[flatpak-node-generator](https://github.com/flatpak/flatpak-builder-tools/tree/master/node)
zu verwenden:

```bash
pip install --user flatpak-builder-tools/node/requirements.txt  # falls benötigt
python3 flatpak-node-generator.py npm package-lock.json -o flatpak/generated-sources.json
```

Danach `flatpak/generated-sources.json` als zusätzliche `source` im Manifest
(`flatpak/ai.minals.Minals.yml`) referenzieren und bauen:

```bash
flatpak-builder --user --install --force-clean build-dir flatpak/ai.minals.Minals.yml
flatpak run ai.minals.Minals
```

## Sicherheit

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` im
  BrowserWindow – der Renderer hat keinen direkten Node-/Dateisystemzugriff,
  alles läuft über die explizite `preload`-API.
- Shell-Befehle laufen über `execFile` (keine Shell-Interpretation) und nur
  mit whitelisted Befehlsnamen.
- API-Key wird nie im Klartext persistiert (Electron `safeStorage`).

## Roadmap

- Wake-Word-Erkennung ("Hey Minals")
- Persistentes Konversationsgedächtnis über Sessions hinweg
- Weitere Skills: Kalender, Web-Suche, Mediensteuerung
- Flathub-Submission
