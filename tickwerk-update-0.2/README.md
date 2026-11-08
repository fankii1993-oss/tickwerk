# Tickwerk – Web-App 0.2

Misst mit dem Handy-Mikrofon, wie genau eine mechanische Uhr geht: Gangabweichung, Abfallfehler, Amplitude, Schlagzahl. Die Aufnahme bleibt auf dem Handy; die App schickt nichts ins Internet.

## Auf GitHub Pages veröffentlichen

1. Auf github.com ein neues Repository anlegen: Name `tickwerk`, **Public**, sonst nichts ankreuzen.
2. Im leeren Repository auf **uploading an existing file** klicken.
3. Den Inhalt dieses Ordners (alle Dateien und die Ordner `engine`, `fonts`, `icons`) ins Browserfenster ziehen, dann **Commit changes**.
4. Im Repository **Settings → Pages**: bei «Build and deployment» Source **Deploy from a branch**, Branch **main** und **/(root)**, **Save**.
5. Nach 1–2 Minuten ist die App erreichbar unter `https://<benutzername>.github.io/tickwerk/`.

## Auf dem Handy

Adresse in Chrome öffnen, Mikrofon erlauben. Über das Menü (⋮) **App installieren** bzw. **Zum Startbildschirm hinzufügen**. Danach funktioniert Tickwerk auch ohne Internet.

## Neu in 0.2

- Modellsuche beim Hinzufügen einer Uhr: 129 Modelle von 20 Marken und 69 Werke. Ein Tipp füllt Name, Werk, Hebewinkel und Schlagzahl aus.
- Unbestätigte und angenommene Hebewinkel sind gekennzeichnet, Co-Axial-Werke (Amplitude nur Richtwert) und Spring Drive (nicht messbar) ebenfalls.
- Die Schlagzahl wird immer erkannt. Passt sie nicht zur gespeicherten, erscheint ein Hinweis mit «übernehmen».
- Genauere Hilfe, wenn das Mikrofon blockiert oder belegt ist.

## Aktualisieren

Geänderte Dateien im Repository-Ordner ersetzen: **Add file → Upload files**, Dateien hineinziehen, **Commit changes**. Ordner (`engine`, `fonts`, `icons`) nur hochladen, wenn sich darin etwas geändert hat.

## Dateien

- `index.html`, `app.css`, `app.js` – Oberfläche und Ablauf
- `recorder-worklet.js` – nimmt das Mikrofon unverändert auf (ohne Rauschunterdrückung)
- `worker.js` + `engine/tickwerk-engine.js` – Auswertung im Hintergrund
- `kaliber.js` – Werke (Schlagzahl, Hebewinkel, Quelle) und Modellkatalog für die Suche
- `sw.js`, `manifest.webmanifest`, `icons/` – Installation und Offline-Betrieb
- `fonts/` – Schriften (SIL Open Font License, siehe OFL-Dateien)

Gebaut mit `tools/build-app.py` aus dem Tickwerk-Projekt.
