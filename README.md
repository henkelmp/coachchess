# CoachChess 2.2

## Safari-Stockfish-Fix

Version 2.1 fand beide Dateien und startete den Worker, Stockfish antwortete aber nicht. Der WASM-Pfad wurde über ein URL-Fragment an den Worker übergeben. Safari verarbeitet diesen Weg bei Web Workern offenbar nicht zuverlässig.

Version 2.2 verwendet deshalb passende Dateinamen:

- `engine.js`
- `engine.wasm`

Stockfish findet seine WASM-Datei damit automatisch.

## Hochladen

Alle Dateien aus diesem Paket ins Hauptverzeichnis des Repositorys hochladen und vorhandene Dateien ersetzen.

Die alte Datei `stockfish-18-lite-single.wasm` kann anschließend gelöscht werden.

## Testadresse

`https://henkelmp.github.io/coachchess/?v=2.2.0`
