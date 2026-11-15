# Tickwerk – Web-App 0.7.4 (Testversion)

Misst mit dem Handy-Mikrofon, wie genau eine mechanische Uhr geht: Gangabweichung, Abfallfehler, Amplitude, Schlagzahl. Die Aufnahme und die Messwerte bleiben auf dem Handy. Ins Internet gehen nur, wenn du in der App zustimmst, leere Zeitabfragen für den «Gang im Alltag» und für «Mit Internetzeit eichen»: an den öffentlichen Zeitdienst time.akamai.com und, wenn er nicht antwortet, an den Server, von dem die App kommt (siehe Datenschutzerklärung).

Das ist die **Testversion** für GitHub: Pro lässt sich unter Mehr → Tickwerk Pro mit einem Schalter ein- und ausschalten, oben steht «TEST». Die Store-Version für Google Play wird getrennt gebaut (Kauf über Google Play, eigene Daten).

## Aktualisieren (bestehender Ordner `tickwerk-app-0.1`)

Seit dem 10.11.2026 legt Claude neue Versionen als Pull Request in den Ordner; «Merge pull request» genügt. Von Hand geht es so:

1. Im Repository den Ordner `tickwerk-app-0.1` öffnen.
2. **Add file → Upload files**, den ganzen Inhalt dieses Pakets hineinziehen (Dateien und die Ordner `engine`, `fonts`, `icons`), **Commit changes**. Gleichnamige Dateien werden ersetzt; deine Uhren und Messungen bleiben auf dem Handy erhalten.
3. App auf dem Handy öffnen. Nach ein paar Sekunden erscheint «Neue Version ist bereit»; unter Mehr auf **Neue Version: neu laden** tippen. Ab 0.6.3 lässt sich die Suche unter Mehr → **Nach Update suchen** auch von Hand anstossen.

## Neu in 0.7.10

- **Update ohne Mischzustand.** Bis 0.7.9 holte der Service Worker jede Datei im Hintergrund nochmals und legte sie in den Speicher. Diese Abfrage lief durch den Zwischenspeicher des Browsers; hielt der noch Dateien der Version davor (der Server lässt sie 10 Minuten gelten), lagen nach einem Update alte Dateien neben neuen. Die App lief dann einmal richtig und beim nächsten Öffnen gemischt: neue Seite, altes Programm, altes Aussehen. Nach einigen Minuten und zwei weiteren Starts stimmte es wieder.
- **Was jetzt gilt.** Antworten kommen nur noch aus dem Speicher der Version; ein Auffrischen im Hintergrund gibt es nicht mehr. Eine neue Version kommt allein über das Installieren des Service Workers: Jede Datei wird frisch geholt und gegen ihre Prüfsumme (SHA-256, vom Build in `sw.js` eingesetzt) geprüft. Erst wenn alle stimmen, kommen sie in den Speicher. Stimmt eine nicht, bleibt die bisherige Version, und «Nach Update suchen» meldet, dass die neue nicht geladen werden konnte.
- **Dateien ausserhalb des Speichers** (Testseiten, Texterkennung beim ersten Gebrauch) holt Tickwerk mit Nachfrage beim Server. Behalten wird davon nur die Texterkennung, in ihrem eigenen Speicher.
- **Unverändert:** Die neue Version wird sofort aktiv, die offene Seite bietet «Neue Version: neu laden» an. Bis zum Neuladen kann die offene Seite Dateien der neuen Version nachladen.

- **Katalog erweitert.** 501 Modelle von 123 Marken und 184 Werke (vorher 444, 114 und 160). Jedes neue Modell hat eine Quelle, die sein Werk nennt; die Liste liegt im Quellcode-Paket (`katalog/modelle-quellen-0710.md`). Ein Hebewinkel steht nur, wo die Seite des Werks ihn nennt.
- **Berichtigt:** Ein Modell stand bei einem Werk mit 28’800 A/h; die Quelle führt es auch bei einem Werk mit 36’000 A/h. Es ist aus dem Eintrag entfernt.

## Neu in 0.7.9

- **«Mehr» neu geordnet.** Zuoberst steht, was noch zu tun ist: die Karte «Handy-Uhr eichen», solange das Handy nicht geeicht oder die Eichung über sechs Monate alt ist (mit dem Grund: Ohne Eichung kann die Gangabweichung je nach Handy um ein bis zwei Sekunden pro Tag danebenliegen, manchmal mehr); eine bereite neue Version; fällige Messungen je Uhr (Gangreserve-Test, Zeitvergleich); «Tickwerk Pro», solange gratis.
- **Gruppen zum Auf- und Zuklappen.** «Werkzeuge für die Uhr», «Genauigkeit», «Deine Daten», «App», «Hilfe». Beim ersten Mal ist «Werkzeuge für die Uhr» offen; Tickwerk merkt sich den Stand. Rechts im Kopf jeder Gruppe steht eine Kurzinfo (Anzahl Werkzeuge, «geeicht», Anzahl Messungen, Pro und Version).
- **Wohin was gewandert ist.** Die Eichung steht nach dem Eichen unter «Genauigkeit» (mit Wert und Datum), «Tickwerk Pro» nach dem Freischalten unter «App». «Daten sichern» hat eine eigene Zeile unter «Deine Daten» und führt zur Karte in den Einstellungen.
- **Farbe einstellbar.** Einstellungen, «Farbe der Gruppen unter «Mehr»»: grün getönt (Standard), grün, wie die Karten, oder nur die offene Gruppe grün (die zugeklappten wie die Karten).
- **Symbole.** Jede Zeile unter «Mehr» hat ein Symbol und einen Pfeil.

## Neu in 0.7.8

- **Uhr per Foto anlegen.** Unter «Uhr hinzufügen» steht «Per Foto anlegen» (Kamera) und «Foto aus der Galerie»; bei einer bestehenden Uhr heisst der Knopf «Modell per Foto finden». Nach dem Zuschneiden liest Tickwerk die Schrift auf dem Zifferblatt und zeigt passende Uhren aus dem Katalog, dazu die Wörter, die es erkannt hat. Übernommen wird nur, was angetippt wird; die Suche bleibt daneben bestehen. Das Foto wird zugleich das Foto der Uhr.
- **Gelesen wird auf dem Gerät.** Die Texterkennung (Tesseract als WebAssembly, Ordner `ocr/`) läuft in einem eigenen Worker. Sie wird erst beim ersten Gebrauch geladen (rund 3 MB) und danach vom Service Worker in einem eigenen Speicher behalten, der ein Update der App überlebt. Die Regeln der Seite (Content Security Policy) bleiben unverändert.
- **Wie verglichen wird.** Gelesene Wörter werden unscharf mit Marke und Modellname im Katalog verglichen (gleiches Wort, Wortteil ab fünf Zeichen, ein bis zwei falsche Zeichen). Die gelesene Marke zählt drei Punkte, jedes Modellwort zwei; ab zwei Punkten ist ein Modell ein Vorschlag. Findet sich nichts, liest Tickwerk das Bild noch in den drei anderen Lagen (falls die 12 nicht oben steht).
- **Grenzen.** Verdecken die Zeiger die Schrift, spiegelt das Glas oder steht der Modellname nicht auf dem Zifferblatt, findet Tickwerk nur die Marke, nichts oder das Falsche. Abgestimmt ist das Lesen an wenigen echten Fotos. Uhren, die gleich aussehen und je nach Baujahr ein anderes Werk haben, kann ein Foto nicht unterscheiden: Hier wählt weiterhin der Mensch.
- **Mehr Auflösung beim Zuschneiden.** Das Foto wird mit bis zu 2400 statt 1600 Bildpunkten Kantenlänge verarbeitet, damit die Schrift lesbar bleibt.

## Neu in 0.7.7

- **Foto der Uhr.** Unter «Uhr bearbeiten»: «Foto aufnehmen» öffnet die Kamera des Handys, «Foto wählen» die Galerie. Auf «Foto zuschneiden» liegt das Foto unter einem festen Kreis: schieben mit dem Finger, die Grösse mit zwei Fingern oder dem Regler ändern, «Um 90° drehen» für quer aufgenommene Fotos, «Fein drehen» zum Ausrichten. Tickwerk sucht das Zifferblatt und schlägt den Kreis vor; der Vorschlag ist ein Anfang und lässt sich frei ändern.
- **Wo das Foto erscheint.** Auf der Karte in «Meine Uhren» (rechts unter dem Pfeil), gross auf der Seite der Uhr, klein neben dem Namen auf «Messen» und in «Uhr wählen». So ist auf einen Blick zu sehen, welche Uhr gewählt ist.
- **Was gespeichert wird.** Nur der runde Ausschnitt (512 mal 512 Bildpunkte, JPEG), auf dem Handy im Speicher der App (IndexedDB). Angaben aus der Bilddatei wie Ort und Aufnahmezeit gehen dabei verloren. Der Ausschnitt steht in der Sicherung und kommt beim Laden einer Sicherung mit der Uhr zurück. «Foto entfernen», «Uhr löschen» und «Alle Daten löschen» entfernen ihn.
- **Karten in «Meine Uhren».** Der Verlauf steht neu unten rechts, neben Einstufung und Fusszeile. Oben rechts ist Platz für das Foto; ohne Foto bleibt er frei.
- **Technik.** Die Fotos werden auf eine Zeichenfläche (`canvas`) gezeichnet statt als Bild eingebunden: Die Regel der Seite für Bilder (`img-src 'self'`) bleibt unverändert. Die Datenschutzseite nennt die Fotos in allen vier Sprachen.
- **Kleinigkeit.** «Nicht jetzt» beim Vorschlag zum Lagen-Test bleibt erhalten, wenn die Uhr danach bearbeitet wird.

## Neu in 0.7.6

- **Lagen-Test auflösen.** Auf der Seite der Uhr, Karte «Letzter Lagen-Test»: «Lagen-Test auflösen» nimmt den Messungen die gemeinsame Sitzung, nach einer Rückfrage. Die Messungen bleiben und gelten wieder als einzelne Messungen. Das ist die Umkehrung von «In Lagen-Test umwandeln» (0.7.5) und geht auch für einen gewöhnlichen oder einen angefangenen Lagen-Test (dieser ist damit beendet). Liegen die Messungen höchstens 20 Minuten auseinander, steht danach wieder der Vorschlag zum Umwandeln da.
- **Uhren ordnen ohne Ziehen.** «Uhr bearbeiten» zeigt den Platz der Uhr («Platz 3 von 4 in «Meine Uhren»») und die Knöpfe «Nach oben» und «Nach unten». Sie wirken sofort, unabhängig von «Änderungen speichern», und lassen sich mit Tastatur und Bildschirmleser bedienen; der neue Platz wird angesagt. Langes Drücken und Ziehen (0.7.5) bleibt.

## Neu in 0.7.5

- **Lagen-Test: Das Ergebnis bleibt stehen.** Nach einer Lage ging es bisher nach drei Sekunden von selbst zurück zur Auswahl. Jetzt wartet das Ergebnis, bis «Weiter» oder «Nochmals messen» getippt wird. Solange es dasteht, macht die Abbildung der Lage Platz, damit beide Knöpfe ohne Scrollen zu sehen sind.
- **Einzelne Messungen als Lagen-Test.** Sind alle vier oder sechs Lagen einer Uhr einzeln gemessen worden, höchstens 20 Minuten auseinander, schlägt Tickwerk vor, daraus einen Lagen-Test zu machen: auf «Messen» unter dem Ergebnis und zuoberst auf der Seite der Uhr. Die Messungen bleiben, wie sie sind; sie bekommen nur eine gemeinsame Sitzung. «Nicht jetzt» gilt, bis eine neue Messung dazukommt. Es zählen Messungen übers Mikrofon, die zählen; der Vorschlag gehört wie der Lagen-Test zu Pro.
- **Uhren ordnen.** Unter «Meine Uhren» eine Karte lange drücken (knapp eine halbe Sekunde), dann nach oben oder unten ziehen. Die Reihenfolge gilt auch in der Auswahl beim Messen und bleibt in der Sicherung erhalten.
- **Der vorläufige Wert bleibt sichtbar.** Unter dem Ergebnis steht «Vorläufig zuletzt: … s/Tag (letzte 20 s)»: was der graue Wert am Ende der Messung zeigte. Gibt die Auswertung keinen Wert, bleiben der letzte vorläufige Wert und sein Papierstreifen blass stehen, mit «Letzter vorläufiger Wert · zählt nicht». Beides gilt auch im Lagen-Test.
- **Lagen-Test bei unruhigem Gang.** Schwankt der Gang zu stark und hat kein Geräusch gestört, zeigt auch die Lage den Mittelwert mit «Diese Lage zählt nicht» statt gar nichts (wie «Messen» seit 0.7.4).
- **Ruhige Signalanzeige.** Die Anzeige während der Messung stützt sich auf die letzten 20 Sekunden. Nach einem kurzen Aussetzer des Mikrofons oder einer Erschütterung meldete sie bis zu 18 Sekunden lang «mittel», «schwach» oder «Noch kein klares Ticken», obwohl das Ticken gut war. Jetzt folgt auf eine schwache Probe eine zweite über die letzten 4,5 Sekunden; es gilt die bessere, und die Stufe sinkt erst nach drei schwachen Runden.
- **«Falsche Uhr gewählt?» auch ohne Schlagzahl.** Ist bei der Uhr keine Schlagzahl hinterlegt, vergleicht Tickwerk mit der Mehrheit ihrer letzten sieben Messungen. Weicht die neue ab und passt sie zu einer anderen Uhr, erscheint der Kasten mit dem Angebot zum Umhängen.
- **Geräusch erst ab anderthalb Sekunden.** Ein lauter Abschnitt gilt erst als Störung, wenn er mindestens 1,5 s dauert. Ein einzelner Knacks macht aus einer unruhigen Uhr keine gestörte Messung mehr.
- **Mess-Engine 0.3.2: mehrere Aussetzer der Aufnahme.** Ein einzelner Aussetzer (ein fehlender oder doppelter Audiopuffer) wurde schon ausgeglichen. Bei zweien kurz nacheinander gab es «Signal zu schwach», «Gang schwankte» oder «Ticken nicht zu hören». Drei Ursachen sind behoben: Die Suche nach Stufen hörte auf, wenn zwei nahe Aussetzer zuerst als einer erkannt wurden; die weite Suche des zweiten Versuchs lag fest auf dem Raster und verlor die Schläge, wenn die Summe der Aussetzer grösser war als ihr Fenster; und lag ein grosser Aussetzer früh in der Aufnahme, sass die Schablone des letzten Drittels neben den Schlägen. In einem Raster aus 142 Fällen mit ein bis vier Aussetzern von 3 bis 40 ms gab 0.3.1 in 30 Fällen keinen brauchbaren Wert, 0.3.2 in keinem. An den Werten der übrigen Messungen ändert sich nichts: Von 128 Ausschnitten aus Testaufnahmen ist einer anders, eine Aufnahme mit einem echten Aussetzer von 40 ms (+10,57 statt +10,58 s/Tag).

## Neu in 0.7.4

- **«Position finden» mit zehn Sekunden je Stelle.** Tickwerk hört an jeder Stelle zehn Sekunden zu und urteilt einmal; die Zahl läuft ruhig von 10 auf 1. Jede Stelle beginnt mit «Stelle prüfen», auch die erste. Stimmt die Stelle, läuft die Messung ohne Countdown weiter, und die zehn Sekunden zählen mit: 40 s statt 30 s, 70 s statt 60 s.
- **Gute Stelle auch bei unruhigem Ticken.** «Position stimmt» hängt nur noch an dem, was von der Stelle abhängt (beide Schläge, 95 % erkannt, 12 dB, Amplitude bestimmbar, ruhiges Handy). Eine Uhr, deren Schläge etwas ungleichmässig kommen, wurde vorher an jeder Stelle weitergeschickt.
- **Geräusch beim Zuhören.** Stört ein deutliches Geräusch die zehn Sekunden und reicht es darum nicht, heisst es «Nochmals prüfen» statt «Jetzt verschieben»; die Stelle wird einmal wiederholt.
- **Ein Wert auch bei unruhigem Gang.** Schwankt der Gang zu stark für einen verlässlichen Wert, zeigt «Messen» den Mittelwert, das ± und den Papierstreifen mit «Dieser Wert zählt nicht», statt gar nichts. Hat ein Geräusch gestört, bleibt es bei «kein Wert». Nach einer Messung von 60 s rät die Meldung nicht mehr zu 60 s, und «Position finden» wird in diesem Fall nicht mehr angeboten.
- **Falsche Uhr gewählt?** Passt die erkannte Schlagzahl zu einer anderen gespeicherten Uhr, fragt der Kasten danach und bietet das Umhängen an. Unter jeder Messung steht «Falsche Uhr?». Umhängen wertet die Aufnahme mit den Angaben der richtigen Uhr neu aus (Schlagzahl, Hebewinkel).
- **Vorläufiger Wert.** Bestätigen zwei Proben nacheinander den gezeigten Wert nicht, wird er blass und trägt den Vermerk «ändert sich noch».
- **Mess-Engine 0.3.1.** Ein klares Signal (20 dB, 95 % der Schläge, Ähnlichkeit 0,85) gilt bis 0,8 ms Streuung von Schlag zu Schlag als «mittel» statt «schwach»: Die Streuung ist dann eine Eigenschaft der Uhr. Lehnt die Engine wegen schwankendem Gang ab, liefert sie das Ergebnis mit, das sonst herausgekommen wäre. An den Werten aller anderen Messungen ändert sich nichts (108 Ausschnitte aus Testaufnahmen verglichen).

## Neu in 0.7.3

- **Störung statt «Gang schwankte».** Schwankt eine Messung oder ist sie unsicher, sucht die App in der Aufnahme nach einem Abschnitt, der deutlich lauter ist als der Rest (ein Geräusch im Raum, eine Bewegung am Tisch oder am Handy). Findet sie einen, nennt das Ergebnis die Sekunden («Zwischen Sekunde 16 und 22 hat ein Geräusch oder eine Bewegung die Messung gestört»), und der Abschnitt ist im Papierstreifen orange hinterlegt. Eine Messung, die trotz Geräusch sicher ist, bekommt keinen Vermerk. Die Regeln, was zählt, sind unverändert.
- **Klarer zum ±.** Der Satz bei schwankendem Gang sagt, wo das ± steht (in der Zeile unter dem Wert) und womit es verglichen wird (mit einer ruhigen Messung).
- **Eine Minute warten.** Bei schwankendem Gang ohne Störung und in der Anleitung steht neu der Rat, nach dem Hinlegen oder Aufziehen der Uhr eine Minute zu warten.
- **«Position finden» in deinem Tempo.** Nach «Jetzt verschieben» wartet Tickwerk, bis «Stelle prüfen» getippt wird, statt nach drei Sekunden von selbst weiterzuhören. «Position stimmt» verlangt neu 12 statt 14 dB Abstand zum Rauschen (die Mess-Engine 0.3.0 bestimmt die Amplitude dort noch richtig); alles andere bleibt (beide Schläge, kaum einer fehlt, ruhig, Amplitude verlässlich).
- Die Diagnose nennt bei einer Messung die Sekunden der Störung. Die Mess-Engine ist unverändert 0.3.0; an den Werten einer Messung ändert sich nichts.

## Neu in 0.7.2

- **Messen aus einem Guss.** Startet die Messung von selbst, läuft sie ohne Countdown weiter. Der Papierstreifen zeigt das Ticken vom Suchen bis zum Ergebnis durchgehend, statt nach dem Start neu anzufangen; die Sekunden, in denen das Ticken schon klar war, zählen zur Messzeit. Der Countdown bleibt, wo eben getippt wurde: beim Start ohne automatischen Start, nach «Jetzt messen» und nach «Position finden».
- **Ruhigerer vorläufiger Wert.** Die laufende Anzeige rechnet über die ganze bisherige Messung (bis 20 Sekunden) statt über die letzten 10 Sekunden und zeigt den Wert erst, wenn er auf ± 1 s/Tag steht.
- **Feste Anordnung.** Papierstreifen und Werte tauschen während der Messung nicht mehr den Platz. «Position finden» sitzt direkt über dem Startknopf (Messen, Lagen-Test, Regulieren), beim Messen zusammen mit «Bedingungen».
- Die Mess-Engine ist unverändert 0.3.0; am Ergebnis einer Messung ändert sich nichts.

## Neu in 0.7.1

Mess-Engine 0.3.0. Die App selbst ist bis auf die Neuigkeiten und eine Zeile in der Diagnose unverändert.

- **Amplitude bei schwachem Signal:** Die Engine sucht im Schlag das leise erste Geräusch (die Auslösung); aus seinem Abstand zum lautesten Geräusch folgt die Amplitude. Lag das Ticken nur wenig über dem Rauschen, ging die Auslösung unter, die Engine nahm das nächste Geräusch, und die Amplitude kam um rund die Hälfte zu hoch heraus (aus 219° wurden 320°, als «verlässlich» gemeldet). Neu sucht die Engine zusätzlich im Mittel der Leistung, aus dem sich das Rauschen abziehen lässt. An einer Testaufnahme stimmt die Amplitude damit bis etwa 11 dB Abstand zum Rauschen (vorher bis etwa 17 dB).
- **Ehrlicher bei «verlässlich»:** Die Amplitude gilt nur noch als verlässlich, wenn ein verdecktes erstes Geräusch ausgeschlossen ist: Die Suche hätte auch ein sehr leises Geräusch gefunden, oder der Schlag zeigt das Muster leise, lauter, am lautesten. Sonst steht «unsicher», und die Amplitude zählt nicht für die Wertung.
- **Leiser zweiter Schlag:** Die Engine verlangte bisher, dass der leisere der zwei Schläge mindestens ein Viertel der Energie des lauteren hat; sonst meldete sie die halbe Schlagzahl. Neu zählt auch ein leiserer Schlag, wenn er klar über dem Rauschen liegt und dieselbe Form hat. Gelingt die Auswertung mit beiden Schlägen nicht, gilt wie bisher die mit jedem zweiten. Die Korrektur aus 0.6.8 (hinterlegte Schlagzahl) bleibt als zweite Sicherung.
- **Was gleich bleibt:** Bei sauberen Aufnahmen ändert sich kein Wert. Gang und Abfallfehler rechnet die Engine wie bisher.
- **Diagnose:** neue Zeile «Letzte Auswertung» mit dem, was die Engine über Schlagzahl und Amplitude wusste.

## Neu in 0.7.0

- **Position finden:** neuer Knopf unter «Messen», auf der Seite einer Lage im Lagen-Test und unter «Regulieren». Ein Blatt über den ganzen Bildschirm führt durch die Suche: fünf Sekunden ruhig halten, Tickwerk bewertet die Stelle; ist sie nicht stark, drei Sekunden zum Verschieben, mit dem Vergleich zur Stelle davor («Besser als vorher. In dieselbe Richtung weiter.»). Stimmt die Stelle, wird der Bildschirm grün («Position stimmt. Nicht mehr bewegen, ruhig sein. Die Messung startet.»), ein Countdown läuft, und die Messung beginnt von selbst. Das Mikrofon bleibt dabei offen: Die Suche ist eine geführte Suchphase derselben Aufnahme (`findTick()` in `app.js`), kein eigener Bildschirm.
- **Was «stark» heisst:** beide Schläge hörbar (nicht die halbe Schlagzahl), mindestens 95 % der Schläge erkannt, ruhig (Streuung höchstens 0,3 ms), Amplitude bestimmbar und mindestens 14 dB über dem Rauschen. Die Lautstärke allein reicht nicht: An einer lauten Stelle kann die Engine nur jeden zweiten Schlag hören. Bewertet wird ein Stück von 4,5 Sekunden; kürzer kann die Engine nicht.
- **Wenn es nirgends stark wird:** Nach sechs Stellen nennt Tickwerk die beste («Zurück zu Stelle 3») und misst dort, sobald zwei Proben nacheinander so gut sind wie damals; der Bildschirm wird dann blau statt grün. «Hier messen» geht jederzeit, «Nochmals suchen» beginnt von vorn. Ist an drei Stellen kein Ticken zu hören, hört die Suche auf. Fehlt dreimal nacheinander nur die Amplitude, misst Tickwerk an dieser Stelle, statt weiter suchen zu lassen.
- **Vermerk:** Eine Messung aus «Position finden» trägt `pf` (`s` stark gefunden, `b` beste von n Stellen, `h` «Hier messen»); der Status nach der Messung und die Tabelle (Spalte «Hinweis») nennen es. Die Diagnose zeigt die Proben des letzten Laufs (Zeile «Position finden»), ohne Namen.
- **Angebot nach einer schlechten Messung:** Zählt eine Messung nicht, weil nur jeder zweite Schlag hörbar oder das Signal schwach war, oder liess sich die Amplitude nicht bestimmen, bietet Tickwerk «Position finden» an.
- **Wertung aus mehreren Messungen:** Karte und Seite der Uhr stützen sich auf die letzten höchstens fünf sicheren Messungen (nicht älter als 30 Tage vor der neusten) statt auf die letzte allein. Die Klasse folgt der Mitte (Median) des Gangs. «Service prüfen» braucht drei Messungen, die dasselbe sagen (Amplitude zu tief, Abfallfehler über 2 ms, Mitte über 30 s/Tag daneben); ist nur die letzte auffällig, steht «Nochmals messen».
- **Tiefe Amplitude:** waagrecht unter 200°, senkrecht unter 180°. Tickwerk fragt zuerst nach Aufzug und Datumswechsel. Eine tiefe Amplitude zählt nicht für «Service prüfen», wenn die Uhr als «nicht voll aufgezogen» angegeben war oder in den Stunden um den Datumswechsel gemessen wurde (Uhrzeit auf der Uhr 21:00 bis 00:30, bei einem Werk mit Wochentag bis 03:00; bei einem Werk, das der Katalog ohne Datum führt, gilt das nicht).
- **Bedingungen (freiwillig):** Knopf «Bedingungen» unter «Messen». Aufzug (voll aufgezogen, nicht voll, weiss nicht) und die Uhrzeit, die die Uhr zeigt; leer gilt die Zeit des Handys. Die Angabe gilt eine Stunde für diese Uhr und steht bei jeder Messung (`wd`, `ut`), in der Zeile der Messung und in der Tabelle. Im Gangreserve-Test setzt Tickwerk den Aufzug selbst (erste Messung voll, spätere nicht voll).
- **Messung löschen** auf der Seite der Uhr, in jeder Zeile von «Letzte Messungen» (bisher nur unter Mehr → Alle Messungen).
- Die Mess-Engine ist unverändert 0.2.7.

## Neu in 0.6.8

- **Halbe Schlagzahl wird korrigiert:** Ist bei einer Uhr einer der zwei Schläge deutlich leiser (bei der Testuhr vom Pixel hat er je nach Lage des Handys nur einen Viertel bis einen Drittel der Energie), hielt die Engine manchmal nur jeden zweiten für einen Schlag: 14’400 statt 28’800 A/h, Abfallfehler falsch, Amplitude fehlt. Ist bei der Uhr eine Schlagzahl hinterlegt und die erkannte genau die Hälfte, wertet Tickwerk dieselbe Aufnahme nochmals mit der hinterlegten aus (`fixHalfBph()` in `worker.js`) und nimmt dieses Ergebnis, wenn die Engine dabei mindestens anderthalbmal so viele Schläge findet. In der Tabelle steht dann der Hinweis «zuerst halbe Schlagzahl erkannt».
- **Gelingt das nicht**, bleibt das erste Ergebnis, aber die Messung zählt nicht («nur jeder zweite Schlag erkannt»); der Hinweis am Bildschirm erklärt es und lässt die erkannte Schlagzahl weiterhin übernehmen, falls die hinterlegte falsch ist.
- **Nicht angefasst:** die doppelte Schlagzahl (dort hat Tickwerk mehr Schläge gehört als hinterlegt) und jede andere Abweichung; dort gilt der bisherige Hinweis. Uhren ohne hinterlegte Schlagzahl werden wie bisher ausgewertet. Die Mess-Engine ist unverändert 0.2.7.
- **Unmögliche Amplitude:** Werte über 360° (auf dem Pixel kam 403° vor, mit dem Vermerk «unsicher») zeigt Tickwerk nicht mehr an; es steht ein Strich (`saneAmp()` in `worker.js`).
- Dazu der Aufklapper «Warum dauert das 60 Minuten?» auf der Seite «Mit Internetzeit eichen» (siehe 0.6.7).

## Neu in 0.6.7

- **Eichung an einem Ort:** Mehr → Einstellungen → «Eichung» (bisher «Handy-Uhr eichen») zeigt oben den Stand der Eichung und darunter die Methoden als Liste: «Mit einer Quarzuhr», «Mit Internetzeit», «Aus einer Aufnahme», «Von Hand eintragen». Jede Methode hat ihre eigene Seite mit nur ihren Schritten; die Methode, von der die Eichung stammt, ist mit «aktuell» markiert. «Noch genauer eichen» (Gang der Quarzuhr) steht auf der Seite «Mit einer Quarzuhr».
- **«Warum dauert das 60 Minuten?»:** Aufklapper auf der Seite «Mit Internetzeit eichen». Er erklärt, warum die Zeit aus dem Internet eine Stunde braucht (1 ppm sind 3,6 ms pro Stunde, eine Zeitabfrage ist nur auf einige Millisekunden genau) und dass sich der Wert ab ± 5 ppm früher übernehmen lässt.
- **Nur die Anordnung ist neu:** Messung, Rechnung und gespeicherte Daten sind dieselben wie in 0.6.6. Wer eine laufende Eichung verlässt (Zurück), bricht sie wie bisher ab.
- Die ältern Abschnitte unten nennen die Seite noch «Handy-Uhr eichen».

## Neu in 0.6.6

- **Mit Internetzeit eichen (ohne Quarzuhr):** Unter «Handy-Uhr eichen». Das Handy liegt 60 Minuten am Ladegerät, der Bildschirm bleibt an. Tickwerk zählt, wie viele Samples das Mikrofon liefert, und stempelt sie mit der laufenden Uhr der Seite; jede Minute kommt eine Zeitabfrage dazu. Daraus folgt, um wie viel der Takt des Mikrofons von der wahren Zeit abweicht. Der Ton selbst wird weder ausgewertet noch gespeichert. Nach etwa 10 Minuten gibt es einen vorläufigen Wert; übernommen wird er, wenn er auf ± 5 ppm oder besser bestimmt ist («Jetzt übernehmen» oder nach 60 Minuten von selbst). Erwartet nach 60 Minuten im WLAN: etwa ± 0,3 bis ± 1 ppm (gerechnet an künstlichen Daten; auf einem Handy noch nicht gemessen). Verlässt man Tickwerk oder sperrt den Bildschirm, bricht die Eichung ab.
- **Welche Samples gezählt werden:** die der Mikrofon-Spur selbst (`MediaStreamTrackProcessor`). Das ist der Takt, in dem auch die Messungen aufgenommen werden, auch mit einem angesteckten Mikrofon. Kann der Browser das nicht, zählt Tickwerk die Blöcke des Aufnahme-Worklets (Takt der Tonausgabe; beim eingebauten Mikrofon derselbe). Die Rechnung steht in `eichzeit.js`: Je 10 Sekunden zählt der Block mit der kleinsten Verspätung; verlorene Blöcke (Sprünge) werden erkannt und herausgerechnet.
- **Öffentlicher Zeitdienst:** Die genaue Zeit holt Tickwerk neu zuerst bei `time.akamai.com` (Adresse `https://time.akamai.com/?iso&ms`, Antwort: Datum und Zeit in UTC mit Millisekunden) und erst, wenn er nicht antwortet oder nichts Brauchbares liefert, beim Server der App (Kopfzeilen `X-Timer` oder `Date`). Weil ein Empfänger dazukommt, fragt die App nochmals nach der Zustimmung. Nur an diese eine Adresse erlaubt die App Anfragen (Content-Security-Policy).
- **Server der App, robuster:** `X-Timer` nennt auch die Bearbeitungszeit des Servers (`VE`); Tickwerk rechnet sie ein. Passen die Antworten nicht zusammen (etwa weil die Kopfzeile aus einem Zwischenspeicher käme), fragt Tickwerk nochmals mit eindeutigen Anfragen und nimmt als letzten Versuch die Kopfzeile `Date`. Wechselt die Quelle der Zeit mitten in einer Eichung, wird jede Quelle für sich gerechnet.
- **Quelle der Eichung:** Die Eich-Seite, die Diagnose, die Tabelle (CSV, zwei neue Spalten «Geeicht mit» und «Eichung genau auf ± (ppm)») und das Messprotokoll (Zeile «Zeitbasis») zeigen, ob mit Quarzuhr, mit Internetzeit oder von Hand geeicht ist, und wie genau. Die Diagnose nennt zur letzten Eichung mit Internetzeit Dauer, Zahl der Zeitabfragen, die zwei Teilwerte (Mikrofon gegen Handy-Uhr, Handy-Uhr gegen Zeit) und erkannte Sprünge.
- **Testseite «GPS-Zeit prüfen»** (`gps-test.html`, nur in der Testversion, in der App nicht verlinkt): prüft, ob die Zeitstempel der Ortung vom GPS kommen oder nur von der Uhr des Handys, und wie stark sie streuen. Der Standort wird weder angezeigt noch gespeichert noch übertragen.

## Neu in 0.6.5

- **Genaue Zeit für den Gang im Alltag:** Die Uhr des Handys wird nur ab und zu gestellt und kann bis etwa zwei Sekunden danebenliegen. Beim Zeitvergleich holt Tickwerk darum auf Wunsch die genaue Zeit aus dem Internet. Beim ersten Vergleich fragt die App, ob du einverstanden bist; ändern lässt es sich unter Einstellungen → «Genaue Zeit aus dem Internet». Über der Uhr steht, woher die Zeit kommt, wie genau sie ist (zum Beispiel «± 0,02 s») und um wie viel die Uhr des Handys abweicht. Ohne Internet oder ohne Zustimmung gilt wie bisher die Uhr des Handys, mit dem Vermerk «Handy-Uhr» beim Vergleich.
- **Wie die Zeitabfrage geht:** einige leere Anfragen (HEAD) an den Server, von dem die App kommt, am Service Worker vorbei. Ausgewertet wird die Kopfzeile `X-Timer` (auf Mikrosekunden) oder, wenn es sie nicht gibt, `Date` (ganze Sekunden; die Abfragen kreisen dann den Sekundenwechsel ein). Jede Antwort grenzt den Unterschied zur eigenen Uhr ein; der Schnitt aller Bereiche ist das Ergebnis, seine halbe Breite die Unsicherheit. Widersprechen sich die Antworten, gilt die Abfrage als gescheitert. Unter Mehr → «Diagnose teilen» steht, welche Kopfzeile kam, wie viele Antworten, die Unsicherheit und die Laufzeit.
- **Auswertung gewichtet:** Jeder Vergleich merkt sich, ob er mit der genauen Zeit oder mit der Uhr des Handys gemacht wurde. Ein Vergleich mit genauer Zeit zählt rund zwölfmal so viel. Reihen, die nur mit der Handy-Uhr gemacht sind, zeigen darum eine grössere Unsicherheit als bisher (± 0,5 s für die Handy-Uhr statt nur ± 0,15 s für den Tipp).
- **Quarzuhr als Referenz:** Beim Anlegen einer Uhr gibt es den Schalter «Quarzuhr». Eine Quarzuhr hat nur «Gang im Alltag»; unter «Messen» lässt sie sich nicht wählen. Gratis sind eine Uhr zum Messen und eine Quarzuhr möglich.
- **Gang der Quarzuhr übernehmen:** Kennt Tickwerk den Gang einer Quarzuhr auf ± 0,05 s/Tag oder besser (etwa eine Woche mit genauer Zeit), bietet «Handy-Uhr eichen» → «Noch genauer eichen» an, ihn zu übernehmen. Die Eichung ist dann nicht mehr durch den unbekannten Gang der Quarzuhr begrenzt (rund ± 6 ppm), sondern auf unter ± 1 ppm genau. Die Eich-Seite zeigt neu Quelle und Genauigkeit der Eichung.
- **Werksvorgabe des Werks:** Für 19 Werke (Seiko, Miyota, Orient, Oris, Rolex, Tudor, STP) kennt Tickwerk den Gang, den der Hersteller erlaubt. Die Vorgabe steht beim Werk; verglichen wird beim Gang im Alltag und beim Mittel des Lagen-Tests, nicht bei der einzelnen Messung.
- **Modell fehlt?** In der Suche beim Anlegen einer Uhr: öffnet das Mailprogramm mit einem vorbereiteten Text. Gesendet wird erst, wenn du dort auf Senden tippst.
- Katalog: Seiko 4R35/4R36 und NH35/NH36 sowie 4R34 und NH34 sind getrennte Werke (160 Werke, 444 Modelle).

## Neu in 0.6.4

- **Viel mehr Uhren und Werke:** 444 Modelle von 114 Marken und 158 Werke, darunter viele ältere. Aufgenommen ist nur, wofür eine Quelle das verbaute Werk nennt.
- **Vergleich mit den ETA-Stufen:** Der Lagen-Test zeigt, welche Stufe (Standard, Elaboré, Top) das Ergebnis erfüllen würde: Mittel und grösste Abweichung zwischen den Lagen, in den Lagen, die ETA für die Stufe prüft. Das (i) erklärt die Zeilen. «Top» braucht den Test mit 6 Lagen.
- **Gangreserve-Test:** Der Unterschied zwischen voll aufgezogen und nach 24 Stunden (Isochronismus) wird mit den Vorgaben der ETA-Stufen verglichen.
- **Markenkaliber finden:** Die Suche findet Werke auch unter dem Namen, den die Marke ihnen gibt.
- **Hebewinkel:** Bei jedem Werk steht, ob der Hebewinkel bestätigt oder unbestätigt ist.

## Neu in 0.6.3

- **Kein grober Wert mehr nach einer Lücke:** Fehlt das Ticken vier Sekunden oder länger (Handy verrutscht oder weggenommen, Uhr steht), zeigt Tickwerk keinen Wert und speichert nichts. Die Meldung sagt, wo die Lücke lag: «Nach 18 von 30 Sekunden war das Ticken nicht mehr zu hören», «Zwischen Sekunde 12 und 19 …» oder «In den ersten 6 Sekunden …». Das gilt auch im Lagen-Test. Bisher gab es in diesem Fall einen groben Wert mit «Signal schwach» oder die Meldung «Signal zu schwach».
- **Datei auswerten:** Hat eine Aufnahme einen Vor- oder Nachlauf ohne Ticken (Handy noch nicht an der Uhr), wertet Tickwerk nur das Stück mit Ticken aus und sagt, welches. Eine Lücke mittendrin wird abgelehnt.
- **Kurze Störungen:** Ein Rascheln oder ein Stoss von etwa einer Sekunde macht die Messung nicht mehr ungültig. Bisher konnte ein einziges lautes Geräusch in den ersten 20 Sekunden zu «Signal zu schwach» führen.
- **Unsichere Messung läuft weiter:** Ist das Signal klar, der Wert nach der gewählten Dauer aber unsicherer als ±0,5 s/Tag (meist, weil der Gang schwankt), misst Tickwerk von selbst weiter, bis 60 Sekunden um sind. Auf dem Bildschirm steht zuerst «Prüft den Wert», dann «Tickwerk misst weiter …»; im Ergebnis steht «Verlängert von 30 auf 60 s». Gilt auch im Lagen-Test. Ausschalten: Einstellungen → «Unsichere Messung verlängern». Bei schwachem Signal wird nicht verlängert, weil mehr Zeit dort nicht hilft.
- **Verlängerung nicht auswertbar:** Wird das Handy in den zusätzlichen Sekunden weggenommen, gilt der Wert der zuerst gewählten Dauer («Die Verlängerung auf 60 s liess sich nicht auswerten. Es gilt der Wert der ersten 30 Sekunden.»). Das gilt auch, wenn die ganze Minute aus einem anderen Grund keinen Wert ergibt. Eine verlängerte Messung ist so nie schlechter als eine ohne.
- **Tabelle (CSV, Pro):** Auf der Seite der Uhr unter «Letzte Messungen». Alle Messungen der Uhr mit Datum, Zeit, Lage, Gang, Unsicherheit, Wertung, Abfallfehler, Amplitude, Hebewinkel, Schlagzahl, Signal, Dauer, Quelle, Korrektur, Hinweis und Versionen. Für Excel gebaut: UTF-8 mit BOM, Trennzeichen Strichpunkt (auf Englisch Komma), Dezimalzeichen wie auf dem Handy eingestellt. Namen, die mit `=`, `+`, `-` oder `@` beginnen, bekommen ein Hochkomma davor, damit Excel sie nicht als Formel ausführt.
- **Nach Update suchen:** Unter «Mehr» in der neuen Gruppe «Version». Sagt, ob die neuste Version installiert ist («Tickwerk ist aktuell … geprüft um 07:15»), lädt eine neue und bietet dann «Neue Version: neu laden» an. Ohne Netz: «Keine Verbindung».
- **Diagnose teilen:** Unter «Mehr». Ein Text mit Version, Gerät, Sprache, Mikrofon und Erlaubnis, Eichung, Einstellungen, den letzten fünf Messungen (ohne Namen der Uhren) und den letzten Fehlern. Er wird zuerst angezeigt und verlässt das Handy nur über «Teilen» oder «Kopieren». Dafür führt die App ein kleines Protokoll der letzten 20 Fehler (Mikrofon, abgelehnte Messungen, unlesbare Dateien, Programmfehler), ohne Namen von Uhren oder Dateien.
- **Was ist neu:** Nach einem Update erscheint einmal ein Blatt mit den Neuerungen; jederzeit unter «Mehr». Bei einer neuen Installation erscheint es nicht.
- **Mess-Engine 0.2.7:** erkennt Lücken im Ticken (ein Schlag gilt als «da», wenn er zur Schablone passt und zum übernächsten Schlag den richtigen Abstand hat), kappt laute Störgeräusche bei der Suche nach der Schlagzahl und in der Hüllkurve, und setzt das Raster am ersten Stück mit klarem Takt an statt immer in den ersten 3 Sekunden. Saubere Aufnahmen ergeben dieselben Werte wie mit 0.2.6.
- **Aussetzer der Aufnahme:** Liefert das Handy unter Last einen Audiopuffer doppelt oder verliert einen, sind alle folgenden Schläge um 10 bis 30 Millisekunden verschoben. Lag das mitten in der Messung, gab es bisher oft keinen oder nur einen groben Wert; ein Sprung von etwa 30 ms konnte sich sogar verstecken und einen falschen Wert ergeben. Jetzt richtet die Engine die Schläge in einem zweiten Versuch an einer scharfen Schablone (aus wenigen Sekunden) neu aus, prüft jedes Ergebnis auf einen versteckten Sprung und misst die Höhe eines Sprungs zusätzlich aus den Schlägen direkt davor und danach. Bei einer Uhr mit schwankendem Gang macht ein Aussetzer den Wert unsicherer; das ± zeigt es. Aufnahmen ohne Aussetzer ergeben dieselben Werte wie vorher.

## Neu in 0.6.2

Aufgeräumt: Die Funktionen sind dieselben wie in 0.6.1, sie sind aber leichter zu finden und die Seiten sind kürzer.

- **Werkzeuge an einem Ort:** Lagen-Test, Regulieren, Gangreserve-Test, Gang im Alltag, Werk-Detektiv und «Handy-Uhr eichen» stehen in einer Liste: unter «Messen» hinter dem Knopf «Werkzeuge» und unter «Mehr» in der Gruppe «Werkzeuge». Ist etwas fällig (eine Messung des Gangreserve-Tests, ein Zeitvergleich, eine alte Eichung), steht es dort in der Zeile.
- **Messen passt auf einen Bildschirm:** Lage, Messdauer und «Werkzeuge» stehen in einer Zeile. Während der Messung steht der Papierstreifen direkt unter der grossen Zahl; nach der Messung ist er ohne Scrollen zu sehen. Oben steht dann «Gespeichert» mit der Uhrzeit, die ganze Zeile «Gespeichert bei …» steht unter dem Streifen. Unter dem Namen der Uhr heisst es kurz «geeicht» statt «Handy-Uhr korrigiert».
- **Seite der Uhr:** Zuoberst steht, was fällig ist, mit einem Knopf direkt zur Messung. Darunter «Jetzt messen» und «Lagen-Test». «Gang im Alltag», «Gangreserve-Test», «Letzter Lagen-Test» und «Letzte Messungen» lassen sich auf- und zuklappen; zugeklappt zeigen sie das Wichtigste in einer Zeile. Tickwerk merkt sich, was offen war. «Uhr bearbeiten» ist der Stift oben rechts.
- **Handy-Uhr eichen ist eine eigene Seite:** oben der Wert und für welches Mikrofon er gilt, dann drei Schritte und «Quarzuhr messen». «Noch genauer eichen» (Gang der Quarzuhr) und «Korrektur von Hand eintragen» sind aufklappbar. Zu erreichen über die Werkzeuge oder über Einstellungen → «Eichung öffnen».
- **Eichung mit Datum:** Tickwerk merkt sich, wann geeicht wurde, und zeigt es an. Nach etwa sechs Monaten steht bei der Eichung «am besten neu eichen», und beim Öffnen der App erscheint ein Hinweis, höchstens einmal im Monat. Das Datum steckt auch in der Sicherung. Eichungen aus älteren Versionen haben kein Datum («Datum der Eichung unbekannt») und lösen keinen Hinweis aus. Kommt die Eichung aus einer Sicherung, weist Tickwerk darauf hin: Auf einem anderen Handy gilt sie nicht, dort neu eichen.
- **Einstellungen sind kürzer:** Sprache, Messung, Mikrofon, Eichung (ein Knopf), Datei auswerten, Daten sichern.
- Gangreserve-Test: Was nach einer Messung für den Test gilt, steht in einem eigenen Kasten mit dem Knopf «Zum Gangreserve-Test».
- **Französisch und Italienisch:** 17 Texte, die bisher deutsch blieben, sind übersetzt: die Titel der Hinweise auf der Seite der Uhr («Im Chronometer-Bereich», «Amplitude niedrig» …), «angenommen» und «bestätigt» beim Hebewinkel, «hoch» beim Abfallfehler und einige Fehlermeldungen.
- Behoben: Der Hinweis in einer leeren Grafik («Der Papierstreifen erscheint während der Messung.») war auf schmalen Handys abgeschnitten; er steht jetzt mittig und bricht um.
- Behoben: In den Balken «Gangabweichung» konnten «+6» und «−4» auf der Zahl des letzten Balkens liegen, und die gestrichelte Linie lief durch die Zahlen.
- Behoben: In Kacheln mit langer Beschriftung («Senkrecht − waagrecht») rutschte das (i) allein auf eine neue Zeile.
- Behoben: Das (i) neben «Signal» war nur ein grauer Punkt.

## Neu in 0.6.1

- **Eichung je Mikrofon:** Die Korrektur der Handy-Uhr gilt jetzt für das Mikrofon, mit dem geeicht wurde. Wer ein angestecktes Mikrofon wählt und damit «Quarzuhr messen» macht, bekommt einen eigenen Wert; beim Wechsel des Mikrofons wechselt der Wert mit. Ein gewähltes, noch nicht geeichtes Mikrofon wird nicht korrigiert, unter «Messen» steht dann «ungeeicht». Fehlt das gewählte Mikrofon beim Messen, nimmt Tickwerk das eingebaute mit dessen Eichung. Die bisherige Eichung gilt weiter fürs eingebaute Mikrofon.

## Neu in 0.6.0

- **Regulieren (Pro):** Unter «Messen» neben dem Lagen-Test. Tickwerk zeigt den Gang laufend, alle zwei Sekunden neu, dazu Abfallfehler, Amplitude, den Verlauf der letzten Minuten und den Papierstreifen. Gemittelt werden die letzten 6 bis 15 Sekunden. Stört etwas (Arbeit am Werk) oder ändert sich der Gang deutlich, merkt Tickwerk das, sucht die Stelle der Änderung und mittelt ab dort neu. Gespeichert wird nichts; nach 10 Minuten hält Tickwerk von selbst an.
- **Gangreserve-Test (Pro):** Auf der Seite einer Uhr. Voll aufgezogen messen, die Uhr 24 Stunden liegen lassen und nochmals messen, freiwillig auch nach 36 Stunden. Tickwerk vergleicht Amplitude und Gang und sagt, ob die Zugfeder noch genug Kraft hat. Gemessen wird immer mit dem Zifferblatt oben. «Uhr ist stehen geblieben» schliesst den Test ab.
- **Erinnerungen:** Für die nächste Messung des Gangreserve-Tests und den nächsten Zeitvergleich (Gang im Alltag) gibt es «Google Kalender» und «Kalenderdatei (.ics)». Ist etwas fällig, steht es bei der Uhr in «Meine Uhren», und beim Öffnen der App erscheint ein Hinweis.
- **Mikrofon wählen (Pro):** Unter Einstellungen → «Mikrofone suchen», dann eines wählen, zum Beispiel ein angestecktes über USB-C. Ist es beim Messen nicht da, nimmt Tickwerk das Standard-Mikrofon und sagt es.
- **Ergebnis als Bild teilen (gratis):** Nach einer Messung und beim Lagen-Test «Als Bild teilen»: ein Bild 1080 × 1350 mit Gang, Skala, Wertung, Werten und Papierstreifen. Abfallfehler und Amplitude stehen nur darauf, wenn die Messung sie zeigt.
- **Französisch und Italienisch:** Die ganze App, das Messprotokoll und die Datenschutzerklärung (`privacy-fr.html`, `privacy-it.html`). «Automatisch» folgt der Sprache des Handys; fest wählbar unter Einstellungen → «Sprache · Language».
- Messen: «Lagen-Test» und «Regulieren» stehen in einer eigenen Zeile unter Lage und Messdauer.
- Kleinigkeiten: Beschriftung «Hebezeit» und «Gemessen am» waren auf Englisch noch deutsch.

## Neu in 0.5.2

- **Zählregel angepasst:** Eine Messung zählt wieder bis ±0,5 s/Tag. Nur wenn die Klicks klar sind, der Gang aber während der Messung schwankt, zählt sie bis ±1,5 s/Tag, mit dem Vermerk «Gang könnte schwanken» in der Kachel, in den Listen und im Messprotokoll. Das ersetzt die Regel aus 0.5.1.
- Lagen-Test: Die Texte in den Kacheln dürfen zwei Zeilen haben und werden nicht mehr abgeschnitten.

## Neu in 0.5.1

- **Keine Vibration mehr beim Messen.** Das Handy liegt an der Krone; das Vibrieren konnte es verschieben, und das Mikrofon nahm es auf. Stattdessen zeigt Tickwerk einen **Countdown**: Sobald das Ticken klar ist, zählt es gross 3, 2, 1 herunter, erst dann beginnt die Messung. Im Lagen-Test steht danach gross, wie viele Sekunden noch fehlen.
- **«Signal schwach» war oft falsch.** Waren die Klicks klar, schwankte aber der Gang während der Messung (Uhr oder unruhig gehaltenes Handy), meldete Tickwerk «Signal schwach». Jetzt beurteilt die Mess-Engine 0.2.6 das Signal nur noch an den Klicks selbst; ein wandernder Gang heisst «Gang schwankt».
- **Was zählt:** Schwankte der Gang während der Messung, zählt eine Messung mit Vermerk bis ±1,5 s/Tag (in 0.5.2 genauer gefasst, siehe oben). Ein Lagen-Test lässt sich so auch mit einer Uhr abschliessen, deren Gang innerhalb einer Minute schwankt.
- Lage «Krone oben»: Hinweis, das Handy nur leicht an die Krone zu halten und den Arm aufzustützen.
- Erklärung zum Papierstreifen: neu «Spur wellig».

## Neu in 0.5.0

- **Englisch:** Tickwerk gibt es jetzt auch auf Englisch, samt Messprotokoll (PDF) und Datenschutzerklärung (`privacy.html`). Die Sprache folgt dem Handy (Deutsch bei deutscher Handy-Sprache, sonst Englisch) und lässt sich unter Einstellungen → «Sprache · Language» fest wählen. Zahlen, Daten und Einheiten passen sich an (z. B. «+2.1 s/day», «28,800 bph»).
- **Erklärung zu jedem Wert:** Das (i) neben Gangabweichung, Abfallfehler, Amplitude, Schlagzahl, Hebewinkel, Papierstreifen, Signal, Lagendifferenz und Gang im Alltag erklärt den Wert und zeigt, welche Bereiche gut sind.
- **Gang im Alltag:** Auf der Seite einer Uhr «Mit der Atomzeit vergleichen» antippen und tippen, wenn der Sekundenzeiger auf der 12 steht. Nach ein paar Vergleichen über mehrere Tage zeigt Tickwerk, wie viel die Uhr am Handgelenk pro Tag wirklich vor- oder nachgeht. Den Gang zeigt es ab 6 Stunden zwischen dem ersten und dem letzten Vergleich; ein neuer Vergleich innert 10 Minuten ersetzt den vorherigen.
- **Werk-Detektiv:** Werk unbekannt? Die gemessene Schlagzahl und ein paar Fragen (Automatik, Handaufzug, Sekundenstopp, Datum, Chronograph) grenzen die passenden Werke ein; eines antippen, und Hebewinkel und Schlagzahl sind gesetzt.
- Das (i) neben «Gangabweichung» liess sich nach einer Messung nicht antippen, weil die grosse Zahl darüber lag. Behoben.
- Messprotokoll: Bei genau einer nicht gewerteten Messung steht jetzt «1 von 5 Messungen ist nicht gewertet».

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
- `eichzeit.js` – Rechnung für «Mit Internetzeit eichen»
- `gps-test.html`, `gps-test.js` – Testseite «GPS-Zeit prüfen» (nur Testversion)
- `en.js`, `fr.js`, `it.js` – englische, französische und italienische Texte (deutscher Text → Übersetzung, gebaut aus `i18n/`)
- `datenschutz.html`, `privacy.html`, `privacy-fr.html`, `privacy-it.html` – Datenschutzerklärung in vier Sprachen
- `sw.js`, `manifest.webmanifest`, `icons/` – Installation und Offline-Betrieb
- `fonts/` – Schriften (SIL Open Font License, siehe OFL-Dateien)
- `ocr/` – Texterkennung für «Per Foto anlegen»: `lib.js` und die gepackten `.wasm`-Dateien aus tesseract-wasm 0.11.0 (BSD-Lizenz; darin Tesseract, Apache-Lizenz 2.0), `eng.traineddata.gz` aus tessdata_fast (Apache-Lizenz 2.0), `worker.js` von Tickwerk; Lizenzen in `ocr/LICENSE.txt`

Gebaut mit `tools/build-app.py` aus dem Tickwerk-Projekt.
