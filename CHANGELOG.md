# Changelog

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
