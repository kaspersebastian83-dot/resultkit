# Changelog

## 2.3.0 · 11.11.2026 – Nur die LabelKit-Datei dieses Projekts (Audit m1, o13, o16)
- **Laborauftrag:** statt der neuesten beliebigen `…_Daten.json` die Datei dieses Projekts nach der Regel von LabelKit 5.1 (`labelkitWahl` in `spektron-ordner.js`): Name beginnt mit der Projektnummer, danach keine Ziffer; `<Nr>_Daten.json` gilt, eine andere eigene nur mit späterem `gespeichertAm`; ohne feste Datei die neueste eigene. Fremde Dateien werden nie gelesen.
- Keine eigene Datei → kein Laborauftrag geladen, eine gelbe Zeile („… liegt keine LabelKit-Datei von Projekt … – nur „…“ … ResultKit lädt sie nicht.“); eigene und fremde → Zeile „… liegt auch …“.
- **Stand:** dieselbe Datei geht in den Stand (`Laboraufträge/<Name>|Größe|Zeit`) – Projektzentrale, PlanKit und FotoKit rechnen ihn gleich nach. Einmalig „Geändert seit der Übernahme“, wo bisher eine fremde oder eine nur nach Änderungsdatum neuere datierte Datei zählte → einmal „Erneut übernehmen“.
- `spektron-ordner.js`: LabelKit-Hauptdatei nach Projektnummer (Audit o7). `_Ergebnisse.json` unverändert.

## 2.2.0 · 10.11.2026 – Welcher Prüfbericht gilt (Audit K2, M1, m6, m8)
- **Fassungen statt Dateidatum (M1):** Eurofins-Berichtsnummern enden auf einen Fassungsblock (`-01`, `-02` …), eine Änderung am Bericht gibt die nächste Fassung (Entscheidung 10.11.2026). „Gleicher Bericht“ = gleiche Nummer ohne den letzten Block; je Probe/Parameter/Einheit gilt endgültig vor vorläufig, dann die **höhere Fassung**. Das Dateidatum zählt nur noch, wenn dieselbe Nummer in derselben Fassung zweimal im Ordner liegt. Gelesen wird der Block nur bei Eurofins und nur als genau zwei Ziffern am Ende (`berichtsFassung`); ohne lesbaren Block steht der Bericht für sich.
- **Verschiedene Berichte ersetzen einander nie (K2):** Haben zwei Berichte mit verschiedener Grundnummer einen Wert für dieselbe Probe, denselben Parameter und dieselbe Einheit, bleiben beide sichtbar (Zelle mit beiden Werten und Berichtsnummer, „⚠ 2 Berichte“, Hinweis an der Probe und an beiden Berichtskarten). „Jetzt dran“ zeigt „Zwei Prüfberichte für dieselben Proben – erst klären“ (auch vor „Übernommen ✓“), „Ergebnisse übernehmen“ ist gesperrt, ohne „Trotzdem übernehmen“, bis eine Datei aus „Laborergebnisse“ genommen ist. Das gilt auch für vorläufig/endgültig mit verschiedener Grundnummer. Teilberichte für verschiedene Proben oder Parameter gelten weiter nebeneinander.
- **Anderes Projekt (K2):** Nennt die Auftragsreferenz eine andere Projektnummer, steht der Bericht in der Liste („anderes Projekt“), seine Werte zählen nicht und gehen nicht nach `_Ergebnisse.json` – wie im Import-Dialog, ohne Ausnahme. Der Hinweis sagt, dass ein Tippfehler in der Auftragsreferenz dieselbe Wirkung hat.
- **Fremder Bericht ohne Projektnummer (K2):** Weicht die Beschreibung bei allen vergleichbaren Proben eines Berichts von LabelKit ab, fragt „Ergebnisse übernehmen“ vorher und nennt den Bericht.
- Alte Übernahme nach der früheren Regel (gleicher Dateistand, andere Werte): „Bitte einmal erneut übernehmen“.
- **m6:** Leerzeichen am Ende oder doppelt in einem LabelKit-Feld ergeben keinen Hinweis „Beschreibung weicht ab“ mehr (verglichen werden die Kommaabschnitte getrimmt; gespeichert wird nichts anders).
- **m8:** „Vinylchlorid“ erscheint nicht mehr als Chlorid (Muster `/^Chlorid\b/` wie in BerichtKit, auch in der Prüfung „Chlorid beauftragt – kein Wert“).
- `_Ergebnisse.json`: kein Feld neu, umbenannt oder entfernt (Leser: PlanKit, FotoKit, BerichtKit, Projektzentrale).

## 2.1.1 · 10.11.2026 – Dateien an zwei Orten (Audit K1)
- `src/spektron-ordner.js` byte-gleich mit Projektzentrale 1.43.0: liegen `_Ergebnisse.json`, die LabelKit-Datei, der Plan oder `_Projekt.json` in `_Spektron`, gilt `_Spektron` – eine Datei am früheren Ort (z. B. eine kopierte `_Ergebnisse.json` in „Laborergebnisse“) schaltet das Projekt nicht mehr zurück. Lesen und „Ergebnisse übernehmen“ gehen nach `_Spektron`.
- Skalen und Nutzung aus PlanKit: fehlt in „_Spektron/PlanKit“ der Plan unter dem genauen Namen (Projektordner umbenannt), liest ResultKit den neuesten Plan, der als PlanKit-Hauptdatei dieses Projekts zählt (gleiche Projektnummer, kein Sicherungs-Zusatz – dieselbe Regel wie `spektron-ordner.js`, `planDatei` in `src/so.ts`). Vorher fiel die Bewertung dann still auf die Nutzung aus `_Projekt.json` und die Standardskalen zurück, auch auf der Druckseite.
- Neue Zeile oben in den Hinweisen (`.zwei-orte`, eigener Block, nicht aufklappbar): beide Dateien mit Datum, welche gilt (`zweiOrteZeilen` in `src/so.ts`). Gelöscht wird nichts.

## 2.1.0 · 06.11.2026 – Übersicht drucken
- **Neu: „Übersicht drucken“** (Fußleiste links neben „Mehr …“, sobald die Ergebnisübersicht übernommen ist, und unter „Mehr …“): alle Werte auf **einer A4-Seite quer** – statt des Stapels ausgedruckter Eurofins-Prüfberichte beim Schreiben der Sanierungsmaßnahmen.
- Kopf: Projektnummer und Ort, Objekt und Auftraggeber aus `_Projekt.json`, Druckdatum, „Stand der Laborergebnisse: übernommen am …“, die Prüfberichte; „vorläufig“, wenn ein Prüfbericht vorläufig ist; ein Hinweis, wenn sich der Ordner seit der Übernahme geändert hat.
- Eine Zeile je Probenahmestelle, sortiert Gebäude → Etage → Raum (wie die Übersicht): P-Nr. · Etage · Raum (mit Zusatz wie „Brandraum“) · Oberfläche/-art · PAK Σ16 EPA · Chlorid · Asbest (Befund) · Bemerkung (vorläufig, nicht beauftragt, Chlorid laut Bericht in mg/m²). Leere Spalten fallen weg, Proben weiterer Art bekommen eine Spalte „Weitere“. Die Werte stehen direkt neben dem Raum, die Zeilen sind abwechselnd hinterlegt; Oberfläche und Bemerkung stehen grau am rechten Rand (fürs Nachschlagen, nicht fürs Lesen).
- Bewertung in ruhigen Pastellfarben nach derselben Skala wie in der App, Asbest nachgewiesen nur leicht rot. **REF** und **Freimessung** klein markiert (Regel wie Projektzentrale/BerichtKit: „REF“, „Referenz“, „unbelastet“ … bzw. „F-“ vorn, „Freimessung“, „nach Sanierung“). In LabelKit stornierte Proben stehen nicht drauf.
- Werte und Bezeichnungen kommen unverändert aus der übernommenen `_Ergebnisse.json` – nichts wird bearbeitet, keine Datei wird geschrieben (Druck über den Browser, Spektron-Look). Ab etwa 40 Zeilen bricht die Tabelle auf weitere Seiten um, der Tabellenkopf und die Fußzeile „Spektron ResultKit … · Werte aus den Eurofins-Prüfberichten, keine Bewertung“ stehen auf jeder Seite.
- Strg+P auf der normalen Seite druckt wie bisher die App.

## 2.0.0 · 05.11.2026 – einfache Oberfläche (Spektron Schritt 3)
- **Kopfband** wie in LabelKit, FotoKit und PlanKit (Spektron-Leiste v3, byte-gleich): Projekt groß, sechs Kacheln, „Weiter“ mit Grund. Die eigene lila Kopfzeile entfällt; Version, Projektwechsel, Neu einlesen und Hilfe stehen unter „Mehr …“.
- **Fußleiste:** „Mehr …“ links, rechts **eine Hauptaktion** als Satz aus „Jetzt dran“ („Ergebnisse übernehmen →“, „Erneut übernehmen →“, „Prüfberichte importieren →“), daneben höchstens eine Nebenaktion („Berichte importieren“, „Erst ansehen“). Nach der Übernahme führt die Hauptaktion zum „Weiter“ des Kopfbands. In der Mitte der Stand der Übernahme („Noch nicht übernommen“ / „✓ Übernommen am …“).
- „Jetzt dran“ bleibt die Karte oben (Titel, Stand, Hinweis-Chip); darüber eine kleine Ablauf-Zeile „Berichte importiert · Geprüft · Übernommen“.
- **Ruhigere Ergebnistabelle:** Werte mit kleinem Farbpunkt statt farbiger Pille, auffällige Werte fett; Legende in einer Zeile (Kategorienamen im Tooltip); „vorläufig“, „ausstehend“, „nicht beauftragt“ grau; Zwischenzeile je Geschoss bei Sortierung nach Ort; „Je Probenart“ zeigt die Stelle ohne Fläche (die steht in den Details).
- **Nach Stelle:** die Probenahmestelle steht vorn, die Probennummer klein am Wert („12 · P1“, „3,2 · P7“) statt „P1 · P7“ als Zeilenkopf. Kopieren für Excel liefert dieselben Spalten wie bisher (mit „Probe“).
- **Aufgeklappte Probe kompakt:** Hinweise oben als Satz, links alle Parameter als kleine Tabelle, rechts Stand, Prüfbericht, Labor-Nr., Probenahme, Beschreibung.
- Ansicht „Nach Stelle / Je Probenart“ unter „Mehr …“ (gilt weiter je Browser); Kurzanleitung mit „Neu in 2.0.0“. Spektron-Look v1 (Segoe UI), Leistenfarbe Labor.
- Unverändert: Import, Prüfungen, XML↔PDF-Abgleich, Bewertung, Storno-Regel, Übernahme und `_Ergebnisse.json`.
- Spektron-Kette auf die neuen Wege von FotoKit 2.0 und PlanKit 2.0 umgestellt (lief seit FotoKit 2.0 nachts rot).

## 1.15.0 · 01.11.2026
- Spektron-Leiste v2: Schritt „BerichtKit · Brandbericht“ bzw. „· Asbestbericht“, wenn BerichtKit sich die Berichtsart des Projekts gemerkt hat (der Link öffnet genau diese); Haken bei BerichtKit nur für einen gespeicherten Bericht dieser Art, dessen Datei noch in „Mitteilungen“ liegt (Projekte ohne BerichtKit-Angaben wie bisher nach dem Dateinamen). Nach dem gespeicherten Bericht heißt der Knopf „Weiter: Ans Büro übergeben →“ (Projektzentrale, eigenes Fenster). „Weiter“ nennt im Tooltip Ziel und Grund. Keine Nummern mehr an den Schritten (✓ reicht), die eigene App ist deutlicher markiert, „Aktuelles Projekt“ im Projektmenü lädt nicht mehr neu.

## 1.14.0 · 31.10.2026
- **Prüfungen auch beim Einlesen des Ordners:** Bisher liefen die Hinweise zum Bericht („3 Proben erkannt, laut Bericht 4“, doppelte Probenreferenz, doppelte P-Nummer) nur beim Import über den Dialog. Berichte, die du direkt im Ordner `Laborergebnisse` ablegst, werden jetzt genauso geprüft – der Hinweis steht am Prüfbericht und zählt bei den Hinweisen mit.
- **Gleichnamige XML und PDF aus verschiedenen Berichten:** Heißen `AR-123.xml` und `AR-123.pdf` gleich, gehören aber nicht zum selben Bericht (andere Berichtsnummer, Auftragsreferenz oder Batchkennung), hat ResultKit beim Einlesen des Ordners beide Dateien verworfen. Jetzt werden sie getrennt gelesen und erscheinen als zwei Prüfberichte, jeweils mit dem Hinweis „… heißen gleich, gehören aber nicht zum selben Bericht … – ResultKit liest sie getrennt. Bitte prüfen, ob beide Dateien hierher gehören.“ Die beiden bleiben auch dann zwei Prüfberichte, wenn sie dieselbe Berichtsnummer tragen (nur Auftragsreferenz oder Batch weichen ab) – sie werden nicht wieder zu einem Paar zusammengelegt und nicht gegeneinander abgeglichen. Der Import-Dialog fragt weiter wie bisher nach getrenntem Import.
- ResultKit ändert dabei nichts an den Werten: Es sind reine Hinweise.

## 1.13.0 · 31.10.2026
- **Stornierte Proben aus LabelKit** (Folge zu LabelKit 4.49.0 „Proben stornieren“): Eine in LabelKit stornierte Probe ist keine Probe mehr. ResultKit lässt sie im Laborauftrag weg – sie zählt nicht als offen oder ausstehend, nicht im Stand („3 von 3 Proben mit Ergebnis“) und nicht für „vollständig“. Ihre Nummer bleibt vergeben und wird keiner anderen Probe zugeordnet.
- **Laborwert für eine stornierte Probe:** Steht sie trotzdem im Prüfbericht, erscheint oben der Hinweis „P7 ist in LabelKit storniert – der Laborwert gehört zu keiner offenen Probe (Prüfbericht …). ResultKit übernimmt ihn nicht; gilt die Probe doch, heb das Storno in LabelKit auf.“ – statt „nicht beauftragt“. Der Wert steht nicht in der Ergebnistabelle und geht nicht nach `_Ergebnisse.json` (PlanKit, FotoKit); der Hinweis geht mit. In der Prüfberichtskarte ist die Probe als „storniert“ gekennzeichnet.
- Storno setzen und aufheben schreibt die LabelKit-Datei neu – ResultKit zeigt dann „Geändert seit der Übernahme“. Wurde schon vorher (mit ResultKit vor 1.13) übernommen und führt `_Ergebnisse.json` noch eine stornierte Probe, zeigt „Jetzt dran“ einmal „Bitte einmal erneut übernehmen“.

## 1.12.1 · 30.10.2026
- **Projektzuordnung beim LabelKit-Auftrag:** Steht im LabelKit-Feld „Projektnummer“ zusätzlich die Adresse (ältere Projekte, z. B. „26.0512 Stegerwaldstraße Leverkusen“), wurde der Auftrag fälschlich als „gehört zu einem anderen Projekt“ blockiert – dann fehlten Probenliste und Beschreibungsabgleich. Jetzt zählt nur die Projektnummer; eine andere Nummer blockiert weiter. Bitte bei betroffenen Projekten einmal erneut übernehmen.

## 1.12.0 · 30.10.2026
- **Beschreibung LabelKit ↔ Prüfbericht:** Eurofins schreibt den Text der Laborübergabe wörtlich zurück (geprüft an 15 echten Asbestproben, sogar Tippfehler bleiben stehen). Weicht er bei einer Probe von LabelKit ab, steht an der Probe jetzt „Beschreibung: LabelKit „…“, Bericht … „…“ – stimmt die Zuordnung?“. Das fängt umnummerierte oder nachträglich geänderte Proben ab, bevor ein Wert der falschen Stelle zugeordnet wird – für PAK, Chlorid, Asbest und Sonstige. Nur Hinweis, nichts wird geändert; der Hinweis geht mit nach `_Ergebnisse.json`.
- Angeglichen werden nur Leerraum, Groß-/Kleinschreibung, Striche und Anführungszeichen; Bohrkerne (andere Reihenfolge in der Übergabe) und Proben ohne Beschreibung werden nicht verglichen, „Tiefe: …“ am Ende zählt nicht.

## 1.11.0 · 30.10.2026
- Spektron-Leiste: neuer Schritt „BerichtKit“ (Asbest-Untersuchungsbericht) zwischen PlanKit und BelegKit – Haken, sobald ein Bericht in „Mitteilungen“ liegt. Gemeinsames Modul spektron-ordner.js: neuer Bereich „BerichtKit“ (Angaben zum Bericht in „_Spektron/BerichtKit“).

## 1.10.0 · 30.10.2026
- **Nachweisgrenze an jedem Asbestwert:** Eurofins nennt die Nachweisgrenze (VDI 3866-5) nicht im Feld BG, sondern im Gruppen-/Testnamen („Asbestfasern [NWG 0,001%]“). ResultKit liest sie jetzt mit und schreibt sie als `nwg` („0,001 %“, „0,1 %“, „1 %“) an den Wert in `_Ergebnisse.json`, dazu die Prüfnorm als `norm` („VDI 3866-5:2017-06 Anhang B“). Grundlage für den Asbest-Bericht: „Kein Asbest nachgewiesen“ heißt je nach Verfahren unter 0,001 % oder unter 1 %.
- Aufgeklappte Probe: hinter dem Asbestwert steht „(NWG 0,001 %)“; der Tooltip jedes Werts nennt BG, NWG und Norm, soweit der Bericht sie hat.
- Wurden Asbestergebnisse vor 1.10 übernommen, zeigt „Jetzt dran“ einmal „Bitte einmal erneut übernehmen“ – Werte ändern sich dadurch nicht.
- Neue Felder sind optional, Format `spektron-ergebnisse` bleibt Version 1; PlanKit und FotoKit lesen die Datei unverändert.

## 1.9.0 · 29.10.2026
- **Übernehmen überschreibt keinen neueren Stand mehr** (Prüfbericht 29.10.): Hat jemand anderes (anderes Fenster, anderer Rechner) die Ergebnisse inzwischen übernommen, oder ändert sich ein Bericht im Ordner, während die Rückfrage „Trotzdem übernehmen?“ offen ist, schreibt ResultKit nichts und meldet es.
- Gelesene Berichte werden je geöffnetem Projekt zwischengespeichert – ein verspätet fertiges Einlesen eines vorher geöffneten Projekts kann nicht mehr in ein anderes Projekt geraten.
- Gemeinsame Skalen: Hat ein Kollege die Datei inzwischen geändert, wird nichts überschrieben; die eigene Skala bleibt „noch nicht geteilt“ und geht beim nächsten Mal mit. Änderungen während des Teilens bleiben erhalten (gleich wie FotoKit und PlanKit).

## 1.8.1 · 29.10.2026
- Gemeinsames Modul spektron-ordner.js: Beim Umzug und bei der Ortswahl zählen in „Abrechnung“ nur noch die Dateien, die BelegKit selbst schreibt (Aufwand_<Kürzel>.json, _Abrechnung.json, <Nr>_Aufwand_<Datum>.json, _BelegKit_Sicherungen) – andere JSON dort bleiben liegen. Für ResultKit ändert sich nichts.

## 1.8.0 · 28.10.2026
- **Spektron-Ordner ist da:** Neue Projekte (ab 26.0560) und per Projektzentrale umgezogene Projekte haben `_Ergebnisse.json` jetzt unter `_Spektron/ResultKit`; noch nicht umgezogene Projekte werden weiter am bisherigen Ort gelesen und geschrieben (`spektron-ordner.js`, Umstellung aktiv). Prüfberichte bleiben in „Laborergebnisse“.

## 1.7.1 · 28.10.2026
- Leiste oben: die Haken für Proben, Fotos, Ergebnisse, Plan und Abrechnung finden die App-Daten auch im künftigen Ordner „_Spektron“ (spektron-ordner.js). Keine sichtbare Änderung.

## 1.7.0 · 28.10.2026
- **Vorbereitung „Spektron-Ordner“:** Die App-Daten eines Projekts ziehen später in den Unterordner `_Spektron` (Prüfberichte bleiben in „Laborergebnisse“). ResultKit liest und schreibt `_Ergebnisse.json`, die LabelKit-Datei, den Probenplan und die Projektdaten jetzt über `spektron-ordner.js` – bis zum Umzug am bisherigen Ort, es ändert sich nichts.
- Der Dateistand nennt die LabelKit-Datei weiter „Laboraufträge/…“, auch wenn sie später in `_Spektron` liegt – übernommene Ergebnisse bleiben gültig.

## 1.6.0 · 28.10.2026
- **Hauptwerte XML↔PDF abgleichen:** Liegen XML und PDF eines Prüfberichts vor, liest ResultKit aus der Ergebnistabelle der PDF die Hauptwerte (Σ16 EPA-PAK, Chlorid, Asbest) und vergleicht sie mit der XML. Zuordnung über Probenreferenz und Parameter (bei Chlorid je Probe/je Fläche zusätzlich über die Einheit); Schreibweisen wie „<0,5“ / „< 0,5“ oder „14“ / „14,0“ zählen als gleich.
- Weicht ein Wert ab: Hinweis beim Import und in „Jetzt dran“ (auch wenn XML und PDF verschieden benannt sind), an der Probe „⚠ Hinweis – PDF zeigt einen anderen Wert … Bitte mit dem unterschriebenen PDF prüfen; berichtigen kann nur das Labor.“ Die Prüfberichtskarte nennt das Ergebnis („Hauptwerte XML↔PDF: 12 geprüft ✓“, „⚠ 1 von 12 … weicht ab“ oder „Werte im PDF nicht erkannt – nicht abgeglichen“).
- Es wird nichts automatisch geändert: Messwerte kommen weiter ausschließlich aus der XML. Werte, die ein neuerer Bericht ersetzt hat (ganz oder je Parameter), melden nichts mehr.

## 1.5.0 · 28.10.2026
- **Oberflächenart und Raum gehen mit an PlanKit:** `_Ergebnisse.json` trägt an jeder Probe Oberflächenart (Aufsicht/Ansicht/Untersicht) und Raum aus dem LabelKit-Auftrag, dazu die Probenart, wenn der Prüfbericht keine nennt. PlanKit (ab 1.42) zeigt damit den Oberflächen-Balken und füllt das Raumbuch auch bei Proben aus dem Prüfbericht. Werte ändern sich nicht.
- Wurde ein Projekt vor 1.5 übernommen und hat der Laborauftrag Oberflächenart oder Raum, zeigt „Jetzt dran“ einmal „Bitte einmal erneut übernehmen“.

## 1.4.0 · 28.10.2026
- **Ergebnisse „Nach Stelle“** (neuer Standard, Umschalter „Nach Stelle / Je Probenart“ über der Übersicht, gilt je Browser): eine Zeile je Probenahmestelle, eine Spalte je Probenart – PAK und Chlorid derselben Stelle stehen nebeneinander, Asbest und Weitere ebenso. Gleiche Stelle heißt gleiche Bezeichnung aus LabelKit; Fläche (cm²), Oberflächenart und Attribute wie „verrußt“ zählen dafür nicht. Spalten ohne Proben gibt es nicht – ein reines PAK-Projekt sieht aus wie bisher, nur nach Ort sortiert.
- **Lesen wie in Excel, nichts bearbeitbar:** Spaltenkopf anklicken sortiert (Werte zuerst absteigend, erneut klicken dreht um; < BG unter jedem Messwert, leere Zellen immer zuletzt). Zeilen markieren mit Klick, Umschalt, Strg, Ziehen oder Pfeiltasten (Strg+A alle); Doppelklick oder Enter zeigt alle Parameter, Hinweise und Prüfbericht jeder Probe der Zeile, Esc schließt. **Strg+C** bzw. „⧉ Für Excel kopieren“ kopiert die markierten Zeilen (sonst alle) als Tabelle: in Excel landen die Werte in Zellen, in Word als Tabelle – Werte wie im Prüfbericht, Einheit im Spaltenkopf, ohne Farben. Der Spaltenkopf bleibt beim Blättern stehen.
- Werte und Bezeichnungen lassen sich in ResultKit nicht ändern: Grundlage ist der Prüfbericht des Labors. Ein falscher Wert wird vom Labor mit einem neuen Bericht berichtigt.

## 1.3.1 · 27.10.2026
- **Vollständigkeit richtig:** Eine Probe gilt erst als „✓ Ergebnis“, wenn keiner ihrer Werte mehr nur vorläufig ist. Bisher reichte ein endgültiger Wert – kam z. B. PAK endgültig, Chlorid aber nur vorläufig, stand die Probe als fertig da, und das Projekt konnte als „vollständig“ an die Projektzentrale gehen. Jetzt bleibt sie „vorläufig“ mit dem Hinweis, welcher Parameter fehlt („Nur vorläufige Werte für Chlorid …“); `_Ergebnisse.json` meldet dann `vollstaendig: false`.

## 1.3.0 · 27.10.2026
- **Eine Seite statt zwei Reitern.** „Übersicht“ und „Prüfung und Import“ sind zusammengelegt: oben „Jetzt dran“, darunter die Ergebnisse, ganz unten die Prüfberichte (zugeklappt).
- **„Jetzt dran“** zeigt den einen nächsten Schritt mit einem Hauptknopf: Berichte importieren → Ergebnisse übernehmen → grün „Übernommen ✓“ (nichts zu tun) → nach Änderungen im Ordner „Erneut übernehmen“. Darunter der Stand in einem Satz; Hinweise als Chip „⚠ n Hinweise“, der die betroffenen Proben und Berichte aufklappt.
- **Nach dem Import ohne Hinweise:** „AR-… eingelesen – Jetzt übernehmen?“ mit „Ergebnisse übernehmen“ oder „Erst ansehen“.
- **Proben aufklappen:** Klick auf eine Zeile zeigt alle Parameter (in der Bewertungsfarbe), Hinweise, Stand, Prüfbericht (vorläufig/endgültig, XML/PDF), Labor-Nr., Probenahmedatum und Art. Proben mit Hinweis tragen „⚠ Hinweis“ in der Zeile.
- Prüfberichte (Karten mit Kernwerten und „Alle Parameter“, ersetzte Berichte) und die Ablage für neue Berichte stehen im aufklappbaren Bereich „Prüfberichte“; ohne Bericht ist er offen.
- Unverändert: Import-Dialog, Ziehen überall, Regeln zum Zusammenführen, Bewertung und `_Ergebnisse.json`.

## 1.2.3 · 26.10.2026
- Liegt ein Prüfbericht als XML und als PDF mit anderem Dateinamen im Ordner, gelten die Werte der XML – auch wenn die PDF neuer ist. Vorher zeigte ResultKit dann „ohne Messwerte“ und den falschen Hinweis „Nur die PDF liegt vor“. Bei gleicher Berichtsnummer zählt die Datei mit Messwerten, dann der endgültige Bericht, sonst die neuere Datei; die PDF bleibt beim Bericht genannt.
- Chlorid in mg/m²: Nur Zahlen, „< …“, „> …“ und Texte wie „unter BG“, „n. n.“ werden in µg/cm² umgerechnet. Werte wie „(3)“ oder „1.250“ bleiben wie im Bericht mit dessen Einheit, statt ohne Umrechnung mit „µg/cm²“ beschriftet zu werden.
- Prüfbericht-Karte: Bei Asbest nach VDI 3866-5 (Asbestgehalt und Asbestart je Nachweisgrenze) erscheint der Befund auch, wenn er erst bei einer späteren Nachweisgrenze steht – vorher „-“.
- Sortierung nach Ort: Proben ohne Geschoss stehen am Ende, auch nach Gebäuden mit Geschoss (z. B. „Treppenhaus“ nach „Haus A 1.OG“).
- Skalen aus dem Probenplan werden wie in PlanKit geprüft; ungültige Skalen entfallen, Farben gelangen nur als „#rrggbb“ in die Anzeige.
- Schneller Projektwechsel: Nutzung und Skalen des vorigen Projekts überschreiben das neu geöffnete nicht mehr.

## 1.2.2 · 26.10.2026
- Asbest nach VDI 3866-5 wie bei Eurofins (je Nachweisgrenze „Asbestgehalt“ in % und „Asbestart“, nicht untersuchte Stufen „-“): Befund kurz als „Chrysotil · 5 - 20 %“ bzw. „Kein Asbest nachgewiesen“ – Art vor Gehalt, mit Einheit, gleiche Texte nur einmal. Ein Gehalt mit Zahl (z. B. „5 - 20“ oder „>1“ %) gilt als nachgewiesen, auch ohne Asbestart.

## 1.2.1 · 26.10.2026
- Liefert das Labor denselben Parameter zweimal – je Probe und je Fläche (Eurofins: „Chlorid (Cl)“ in µg/Probe und berechnet in mg/m² bzw. µg/cm²) –, zeigt und bewertet die Übersicht immer den Wert je Fläche. Vorher konnte je nach Reihenfolge in der XML der Wert je Probe erscheinen (z. B. „2800 µg/Probe“ ohne Bewertung).
- Asbest: leere Zeilen wie „Asbestgehalt: -“ erscheinen nicht mehr im Befund.

## 1.2.0 · 26.10.2026
- Übersicht mit drei Spalten: Probe · Probenahmestelle · Ergebnis. Die Bewertung ist die Farbe des Werts (ruhiges Pastell), die Ergebnisse stehen in allen Tabellen untereinander. Über jeder Tabelle eine kleine Legende mit den Kategorien und Bereichen.
- Über jeder Tabelle die Prüfberichte, aus denen die Werte stammen, mit Datum (vorläufige gekennzeichnet).
- **Chlorid wird bewertet:** VdS 2357, 5–10 µg/cm² als korrosionschemisch relevante Größenordnung – grün unterhalb (< 5), amber im Bereich (5 – < 10), rot oberhalb (≥ 10), unabhängig von der Nutzung. Gleiche Regel in PlanKit und FotoKit.
- Chlorid wird in µg/cm² gezeigt; ältere Berichte in mg/m² werden umgerechnet (1 µg/cm² = 10 mg/m²), der Wert laut Bericht steht im Tooltip.

## 1.1.0 · 26.10.2026
- Neue Startansicht **„Übersicht“**: die Ergebnisse auf einen Blick. Oben je Probenart eine Kachel (z. B. „34 / 40 · 12 auffällig · 6 offen“), darunter je Probenart eine einfache Tabelle: Probe · Probenahmestelle (Bezeichnung aus LabelKit) · Ergebnis.
  PAK nur mit Σ16 EPA-PAK und Bewertung in ruhigen Pastellfarben; Chlorid mit Wert (Bewertung nur mit hinterlegter Skala); Asbest mit dem Befund wie im Prüfbericht, nachgewiesener Asbest zart rot.
- Offene Proben bleiben als „ausstehend“ in ihrer Zeile; vorläufige Werte sind markiert. Filter „Nur auffällige“ und „Nur offene“, Sortierung nach Ort (Gebäude, Geschoss von unten nach oben, Raum) oder Probennummer – beides wird gemerkt.
- Was bisher die Seite war, steht unter **„Prüfung und Import“** (Stand je Probe, Prüfberichte, Import, „Ergebnisse übernehmen“). Ein Punkt am Reiter zeigt, wenn dort etwas zu tun ist.

## 1.0.0 · 26.10.2026
- Erste Version: Laborauftrag aus LabelKit gegen Prüfberichte in „Laborergebnisse“, Stand je Probe (Ergebnis, nur vorläufig, offen, nicht beauftragt).
- Prüfberichte (Eurofins-XML und PDF) importieren – per Dateiwahl oder Ziehen; fremde Projektnummer wird nicht vorgewählt, nichts wird überschrieben.
- Berichtskarten mit Kernwerten (Σ16 EPA-PAK, BaP, Chlorid, Asbest) und „Alle Parameter“; vorläufige Berichte werden durch endgültige ersetzt.
- „Ergebnisse übernehmen“ schreibt `Laborergebnisse/_Ergebnisse.json` für PlanKit, FotoKit und die Projektzentrale.
- Neuer Schritt „ResultKit“ in der Spektron-Leiste.
