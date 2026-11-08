# Tickwerk – Web-App 0.4.3 (Testversion)

Misst mit dem Handy-Mikrofon, wie genau eine mechanische Uhr geht: Gangabweichung, Abfallfehler, Amplitude, Schlagzahl. Die Aufnahme bleibt auf dem Handy; die App schickt nichts ins Internet.

Das ist die **Testversion** für GitHub: Pro lässt sich unter Mehr → Tickwerk Pro mit einem Schalter ein- und ausschalten, oben steht «TEST». Die Store-Version für Google Play wird getrennt gebaut (Kauf über Google Play, eigene Daten).

## Aktualisieren (bestehender Ordner `tickwerk-app-0.1`)

1. Im Repository den Ordner `tickwerk-app-0.1` öffnen.
2. **Add file → Upload files**, den ganzen Inhalt dieses Pakets hineinziehen (Dateien und die Ordner `engine`, `fonts`, `icons`), **Commit changes**. Gleichnamige Dateien werden ersetzt; deine Uhren und Messungen bleiben auf dem Handy erhalten.
3. App auf dem Handy öffnen. Nach ein paar Sekunden erscheint «Neue Version ist bereit»; unter Mehr auf **Neue Version: neu laden** tippen.

## Neu in 0.4.3

- **Lagen-Test neu:** Auf der Auswahl eine Lage antippen. Oben zeigt Tickwerk gross, wie die Uhr liegt, unten live das Ticken (Signal, Pegel, Papierstreifen, vorläufiger Gang). Die Messung startet von selbst, sobald das Ticken klar ist. Danach 3 Sekunden das Ergebnis mit Amplitude und Abfallfehler, dann zurück zur Auswahl. Gemessene Lagen sind grau und zeigen ihr Ergebnis, die nächste offene ist hervorgehoben.
- **Uhr-Seite:** neue Karte «Letzter Lagen-Test» mit Mittel, Lagendifferenz, Abfallfehler, Amplitude und den Werten je Lage, dazu das PDF des Tests. In der Messliste steht jetzt auch der Abfallfehler.
- **Werk wählen** wie die Modelle: tippen und aus den Vorschlägen wählen. Leer angetippt zeigt das Feld alle Werke nach Hersteller.
- **Datenschutz:** Geht Tickwerk während einer Aufnahme in den Hintergrund, bricht die Aufnahme ab und das Mikrofon geht zu.
- Sicherung laden: doppelte Einträge innerhalb der Datei werden nur einmal übernommen, höchstens 200 Uhren.

## Neu in 0.4.2

- Hält man eine Quarzuhr ans Mikrofon (ein Schritt pro Sekunde), erkennt «Messen» das nach wenigen Sekunden und führt mit «Handy-Uhr damit eichen» direkt zur Eichung.
- **Eichung mit Quarzuhren, die sich selbst korrigieren** (Mess-Engine 0.2.5): Viele Quarzuhren, z. B. Swatch, lassen den Quarz etwas zu schnell laufen und gleichen das alle 60 Sekunden mit einem kleinen Sprung von einigen Millisekunden aus (Inhibition). Tickwerk erkennt diesen Sägezahn und rechnet mit dem mittleren Gang. Vorher konnte das die Eichung um mehrere ppm verfälschen.
- Die Zeit eines Quarz-Schritts misst Tickwerk jetzt am Beginn des Klicks statt an der lautesten Stelle. Bei Uhren, deren Schritt aus mehreren Spitzen besteht, ist das rund zehnmal genauer.
- Die Eichung dauert jetzt 2½ Minuten, damit immer zwei solche Korrekturen in der Aufnahme liegen. Kürzere Dateien wertet Tickwerk nur aus, wenn es die Korrekturen darin sicher erkennt.
- Ein lautes Geräusch am Anfang (Antippen) bringt die Erkennung der Quarz-Schritte nicht mehr durcheinander.

## Neu in 0.4.1

- **Handy-Uhr eichen** direkt in der App: unter Einstellungen «Quarzuhr messen», dazu das Feld «Gang der Quarzuhr».
- **Automatischer Start:** Nach «Messen» hört Tickwerk zuerst nur zu und zeigt, wie klar das Ticken ist. Sobald es zwei kurze Prüfungen nacheinander klar ist, startet die Messung von selbst (kurzes Vibrieren). So lässt sich das Handy in Ruhe an die beste Stelle halten. «Jetzt messen» startet sofort; nach 2 Minuten ohne klares Ticken hört Tickwerk auf. Abschaltbar unter Einstellungen.
- Gilt auch im Lagen-Test: Statt fester 5 Sekunden Ruhe beginnt jede Lage, sobald das Signal stimmt.
- Mess-Engine 0.2.2: schnelle Signalprüfung für kurze Ausschnitte (ohne Einfluss auf die eigentliche Messung); Rauschen wird nicht mehr als «schwaches Ticken» gemeldet.
- Tickwerk bittet Chrome, die gespeicherten Daten dauerhaft zu behalten (nicht automatisch löschen, wenn das Handy knapp an Speicher ist).

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
