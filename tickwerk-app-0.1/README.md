# Tickwerk – Web-App 0.4 (Testversion)

Misst mit dem Handy-Mikrofon, wie genau eine mechanische Uhr geht: Gangabweichung, Abfallfehler, Amplitude, Schlagzahl. Die Aufnahme bleibt auf dem Handy; die App schickt nichts ins Internet.

Das ist die **Testversion** für GitHub: Pro lässt sich unter Mehr → Tickwerk Pro mit einem Schalter ein- und ausschalten, oben steht «TEST». Die Store-Version für Google Play wird getrennt gebaut (Kauf über Google Play, eigene Daten).

## Aktualisieren (bestehender Ordner `tickwerk-app-0.1`)

1. Im Repository den Ordner `tickwerk-app-0.1` öffnen.
2. **Add file → Upload files**, den ganzen Inhalt dieses Pakets hineinziehen (Dateien und die Ordner `engine`, `fonts`, `icons`), **Commit changes**. Gleichnamige Dateien werden ersetzt; deine Uhren und Messungen bleiben auf dem Handy erhalten.
3. App auf dem Handy öffnen. Nach ein paar Sekunden erscheint «Neue Version ist bereit»; unter Mehr auf **Neue Version: neu laden** tippen.

## Neu in 0.4

- Neues Aussehen nach dem ursprünglichen Entwurf: Tableiste Messen, Meine Uhren, Mehr; grosse Anzeige mit Skala, Papierstreifen
- **Lagen-Test**: 4 oder 6 Lagen nacheinander, je mit Bild der Lage, 5 Sekunden Ruhe vor jeder Messung, Ergebnis mit Lagendifferenz, senkrecht gegenüber waagrecht, Diagramm und eigenem PDF-Protokoll
- **Meine Uhren**: Karten mit letztem Gang, Zustand (Chronometer-Bereich, In Ordnung, Service prüfen) und Verlauf; Seite pro Uhr mit Balken, Hinweis und letzten Messungen
- **Gratis und Pro**: gratis Gang, Schlagzahl und Papierstreifen für eine Uhr und 3 Messungen pro Woche mit allen Werten; Pro für alles andere
- Anleitung «Mikrofon anlegen» beim ersten Start
- Android-Zurück-Taste schliesst Fenster und geht einen Bildschirm zurück
- Daten sichern und auf ein anderes Handy übertragen; alle Daten löschen
- Datenschutzerklärung (`datenschutz.html`)
- Mess-Engine 0.2.1: kurze Aussetzer der Aufnahme (fehlende oder doppelte Audiopuffer, z. B. bei hoher Last) werden erkannt und herausgerechnet, statt die Messung zu verwerfen

## Dateien

- `index.html`, `app.css`, `app.js` – Oberfläche und Ablauf
- `config.js` – Einstellungen dieser Ausgabe (Testversion)
- `recorder-worklet.js` – nimmt das Mikrofon unverändert auf (ohne Rauschunterdrückung)
- `worker.js` + `engine/tickwerk-engine.js` – Auswertung im Hintergrund
- `kaliber.js` – Werke und Modellkatalog für die Suche
- `report.js` + `logo.js` – Messprotokoll als PDF
- `datenschutz.html` – Datenschutzerklärung
- `sw.js`, `manifest.webmanifest`, `icons/` – Installation und Offline-Betrieb
- `fonts/` – Schriften (SIL Open Font License, siehe OFL-Dateien)

Gebaut mit `tools/build-app.py` aus dem Tickwerk-Projekt.
