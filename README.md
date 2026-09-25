# Minals

Ein für Linux optimierter KI-Assistent mit einer an Jarvis (Iron Man)
angelehnten HUD-Oberfläche. Minals läuft **komplett lokal** – angetrieben
von einem selbst gehosteten Sprachmodell über [Ollama](https://ollama.com),
kostenlos, ohne Cloud-API-Key und ohne Zensur-Vorgaben von außen (das
Verhalten hängt einzig vom gewählten lokalen Modell ab, z. B. unzensierte
Community-Finetunes).

## Aktueller Funktionsumfang (bereits implementiert)

### KI-Gehirn
- Anbindung an einen lokalen [Ollama](https://ollama.com)-Server (Standard: `http://127.0.0.1:11434`)
- Freie Modellwahl: jedes über Ollama installierte Modell nutzbar
  (z. B. `llama3.1`, `qwen2.5`, `mistral-nemo`, aber auch unzensierte
  Finetunes/Abliterationen wie das voreingestellte
  `huihui_ai/qwen3.5-abliterated`, `dolphin-mistral`, `dolphin-llama3` …)
- Standardmodell ab Werk: `huihui_ai/qwen3.5-abliterated:9b` (unzensiertes
  Qwen3.5 via Abliteration, muss lokal per `ollama pull` geladen werden)
- Dropdown in den Einstellungen listet automatisch alle lokal installierten
  Modelle (`ollama pull` vorausgesetzt) und lässt sie live neu laden
- Function-/Tool-Calling: das Modell kann eigenständig die System-Skills
  unten aufrufen, wenn die Anfrage es erfordert
- Tool-Nutzung lässt sich pro Einstellung komplett abschalten (z. B. für
  Modelle ohne Tool-Support – dann reiner Chat)
- Mehrrundiger Tool-Use-Loop (bis zu 6 Runden pro Anfrage), damit das Modell
  z. B. erst suchen und dann öffnen kann
- Gesprächsverlauf bleibt im Chat-Fenster erhalten (Kontext wird bei jeder
  Anfrage mitgeschickt)

### System-Skills (vom Modell aufrufbare Tools)
| Skill | Beschreibung |
|---|---|
| `run_shell_command` | Führt einen einzelnen Shell-Befehl aus – **nur** wenn er in der Whitelist steht |
| `open_application` | Startet eine installierte Desktop-App (`gtk-launch`, Fallback `xdg-open`) |
| `open_path` | Öffnet Datei/Ordner mit der Standardanwendung |
| `search_files` | Durchsucht ein Verzeichnis (Standard: Home) nach Dateinamen |
| `list_directory` | Listet Inhalt eines Verzeichnisses |
| `get_system_info` | CPU, RAM, Uptime, Hostname, Plattform, Load-Average |
| `send_notification` | Zeigt eine Desktop-Benachrichtigung |
| `set_reminder` | Setzt einen Timer, der nach X Sekunden als Benachrichtigung auslöst |
| `list_reminders` | Listet aktive Erinnerungen |
| `cancel_reminder` | Bricht eine Erinnerung per ID ab |

### Sprachsteuerung (optional, komplett lokal)
- **STT (Speech-to-Text):** über extern konfiguriertes
  [whisper.cpp](https://github.com/ggerganov/whisper.cpp)-Binary + Modell
- **TTS (Text-to-Speech):** über extern konfiguriertes
  [Piper](https://github.com/rhasspy/piper)-Binary + Stimme
- Mikrofon-Button (Push-to-Talk) in der Chat-Leiste: Aufnahme startet/stoppt
  per Klick, Audio wird im Browser zu 16-kHz-Mono-WAV umgewandelt und an
  whisper.cpp übergeben
- Antworten werden bei aktivierter Sprachausgabe automatisch über Piper
  vorgelesen
- Whisper/Piper sind bewusst **nicht** im Flatpak gebündelt (große Binaries
  + Modellgewichte) – Pfade werden in den Einstellungen hinterlegt

### Jarvis-artige HUD-Oberfläche
- Animierter, rotierender Ring-Visualizer auf Canvas-Basis (segmentierter
  äußerer Ring + pulsierender Kern)
- Reagiert auf vier Zustände: `idle` (Bereit), `listening` (Höre zu),
  `thinking` (Denke nach), `speaking` (Spreche) – jeweils eigene Farbe
  (Cyan / Grün / Gelb / Cyan)
- Dunkles Sci-Fi-Farbschema (Cyan-Glow auf Dunkelblau/Schwarz)
- Chat-Log mit unterscheidbaren Bubbles für Nutzer-/Assistenten-/Tool-Nachrichten
  (Tool-Aufrufe und -Ergebnisse werden live als kompakte Trace-Zeilen angezeigt)

### Einstellungen (⚙-Icon oben rechts)
- Ollama-Server-URL + Modellwahl (mit „Neu laden“-Button)
- Umschalter „System-Skills/Tools aktivieren“
- Pfade für whisper.cpp-Binary/-Modell und Piper-Binary/-Stimme
- Umschalter „Sprachein-/ausgabe aktivieren“
- Editierbare Shell-Befehl-Whitelist

### Sicherheit
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` im
  BrowserWindow – der Renderer hat **keinen** direkten Node-/Dateisystemzugriff,
  alles läuft über eine explizite `contextBridge`-API (`src/preload/index.js`)
- Shell-Befehle laufen über `execFile` (keine Shell-Interpretation/Injection)
  und ausschließlich mit whitelisted Befehlsnamen
- Kein Cloud-API-Key mehr nötig – alles bleibt auf dem Rechner, Netzwerk wird
  nur für den lokalen Ollama-Server gebraucht

### Packaging
- Flatpak-Manifest (`flatpak/ai.minals.Minals.yml`) auf Basis von
  `org.electronjs.Electron2.BaseApp`
- `.desktop`-Datei und AppStream-Metainfo für Flathub-Reife vorbereitet
- App-Icon vorhanden (`build/icon.png`)

## Architektur

```
src/
  main/            Electron Main-Prozess
    index.js        Fenster, IPC-Handler
    ollama.js        Ollama-Client mit Tool-Use-Loop
    store.js         Settings-Persistenz (electron-store)
    skills/          System-Skills (Tools für das lokale Modell)
    voice/           STT/TTS-Anbindung an externe Binaries
  preload/          contextBridge-API für den Renderer
  renderer/         HUD + Chat-UI (HTML/CSS/JS)
flatpak/            Flatpak-Manifest, .desktop, AppStream-Metainfo
build/icon.png      App-Icon
```

## Setup: Ollama (lokales Modell)

1. Ollama installieren: <https://ollama.com/download> (Linux: Installer-Skript
   oder natives Paket)
2. Server starten: `ollama serve` (läuft danach im Hintergrund auf Port 11434)
3. Ein Modell laden, z. B.:
   ```bash
   ollama pull llama3.1                          # solide Allround-Wahl mit Tool-Support
   ollama pull huihui_ai/qwen3.5-abliterated:9b   # unzensiertes Qwen3.5 (Standard in Minals)
   ```

   `huihui_ai/qwen3.5-abliterated` (Ollama-Standardmodell dieses Projekts) ist
   per „Abliteration“ von Sicherheits-Refusals befreit und in mehreren Größen
   verfügbar – je nach Hardware wählen:

   | Tag | Größe | Empfehlung |
   |---|---|---|
   | `:0.8B` / `:4B` | sehr klein | schwache Antwortqualität, läuft auf fast jeder CPU |
   | `:9b` | mittel | guter Kompromiss, Standard in Minals, läuft auf den meisten Laptops (8 GB+ RAM/VRAM) |
   | `:27b` / `:35b` | groß | deutlich besser, braucht starke GPU (16 GB+ VRAM) |
   | `:35b-a3b` | MoE (35B, 3B aktiv) | großes Modell mit schneller Inferenz, guter Mittelweg für 16 GB+ RAM |

   Alternative: `jaahas/qwen3.5-uncensored`.

4. Minals starten, in den Einstellungen das Modell aus der Liste wählen und
   speichern (Standard ist bereits auf `huihui_ai/qwen3.5-abliterated:9b`
   voreingestellt).

> Hinweis 1: Nicht jedes Modell unterstützt Ollamas Function-/Tool-Calling
> zuverlässig. Falls Tool-Aufrufe fehlschlagen oder das Modell sie ignoriert,
> „System-Skills/Tools aktivieren“ in den Einstellungen deaktivieren – Minals
> funktioniert dann als reiner Chat-Assistent.
>
> Hinweis 2: Abliterierte/unzensierte Modelle entfernen gezielt eingebaute
> Sicherheitsmechanismen. Die Verantwortung für Inhalte und Nutzung liegt
> beim Betreiber des Rechners – Minals selbst filtert nichts, das Verhalten
> hängt komplett vom gewählten Modell ab.

## Entwicklung

```bash
npm install
npm start
```

## Sprachsteuerung aktivieren

1. whisper.cpp bauen/installieren und ein Modell herunterladen
   (z. B. `ggml-base.bin` oder ein deutsches/mehrsprachiges Modell).
2. Piper installieren und eine Stimme herunterladen (z. B. `de_DE-*.onnx`).
3. In den Minals-Einstellungen die Pfade zu beiden Binaries + Modellen/Stimmen
   eintragen und „Sprachein-/ausgabe aktivieren“ anhaken.
4. Mikrofon-Button in der Chat-Leiste nutzen (Push-to-talk: klicken zum
   Start/Stop der Aufnahme).

## Erlaubte Shell-Befehle

Aus Sicherheitsgründen darf das Modell nur Shell-Befehle ausführen, die
explizit in der Whitelist (Einstellungen) stehen. Standardmäßig sind das
harmlose Befehle wie `ls`, `df`, `uptime`, `uname`, `free`. Diese Liste bei
Bedarf erweitern – aber mit Bedacht, da das Modell autonom entscheidet, wann
ein Tool aufgerufen wird.

## Flatpak-Build

Voraussetzung: `flatpak-builder`, `org.freedesktop.Platform`/`Sdk` 23.08 und
`org.electronjs.Electron2.BaseApp` als installierte Flatpak-Runtimes/Basen.

Für reproduzierbare, offline-fähige npm-Abhängigkeiten wird empfohlen,
[flatpak-node-generator](https://github.com/flatpak/flatpak-builder-tools/tree/master/node)
zu verwenden:

```bash
python3 flatpak-node-generator.py npm package-lock.json -o flatpak/generated-sources.json
```

Danach `flatpak/generated-sources.json` als zusätzliche `source` im Manifest
(`flatpak/ai.minals.Minals.yml`) referenzieren und bauen:

```bash
flatpak-builder --user --install --force-clean build-dir flatpak/ai.minals.Minals.yml
flatpak run ai.minals.Minals
```

Da `--share=network` gesetzt ist, teilt sich das Flatpak-Sandbox den
Netzwerk-Namespace mit dem Host – der lokale Ollama-Server unter
`127.0.0.1:11434` ist damit aus der Flatpak-App heraus erreichbar.

## Noch nicht implementiert (Roadmap)

- Wake-Word-Erkennung („Hey Minals“) für freihändige Aktivierung
- Persistentes Konversationsgedächtnis über App-Neustarts hinweg
- Weitere Skills: Kalender, Web-Suche, Mediensteuerung
- Automatisches Herunterladen/Verwalten von whisper.cpp/Piper aus der App heraus
- Flathub-Submission
