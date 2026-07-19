# CoachChess 1.4

Diese Version nutzt absichtlich eine flache Dateistruktur. Alle Dateien werden direkt in das Hauptverzeichnis des GitHub-Repositories hochgeladen.

## Benötigte Dateien
- index.html
- app.js
- sw.js
- manifest.webmanifest
- icon-192.png
- icon-512.png
- stockfish-18-lite-single.js
- stockfish-18-lite-single.wasm
- VERSION
- README.md
- STOCKFISH_LICENSE.txt

## Anzeige in der App
- `Stockfish 18 bereit`: Engine funktioniert.
- `Ersatz-Engine aktiv · Stockfish-Datei fehlt`: eine Engine-Datei fehlt oder ist nicht erreichbar.
- `Ersatz-Engine aktiv · Startfehler`: Browser konnte den Worker nicht starten.
- `Ersatz-Engine aktiv · Zeitüberschreitung`: Stockfish wurde geladen, antwortet aber nicht.

Unter „Engine-Diagnose“ stehen die einzelnen Prüfschritte.
