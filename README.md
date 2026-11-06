# ResultKit – Laborergebnisse

Teil der Spektron-Apps (LabelKit → FotoKit → **ResultKit** → PlanKit → BelegKit). ResultKit zeigt für ein Projekt an einer Stelle:

- **was beim Labor ist** – die Laborübergabe aus LabelKit (neueste `…_Daten.json` im Ordner `Laboraufträge`),
- **was zurück ist** – die Prüfberichte im Ordner `Laborergebnisse` (Eurofins-XML, dazu die PDF zum Abgleich),
- **was noch fehlt** – Proben ohne Ergebnis, nur vorläufige Werte, Proben im Bericht, die nicht beauftragt waren.

**Eine Seite (ab 1.3), einfache Oberfläche (ab 2.0):** Kopfband wie in allen Spektron-Apps; oben **„Jetzt dran“** mit dem Stand in einem Satz, der eine nächste Schritt steht als Hauptaktion unten rechts in der Fußleiste (Berichte importieren · Ergebnisse übernehmen · erneut übernehmen · danach „Weiter“). Seltenes unter „Mehr …“ unten links.
Darunter die Ergebnisse auf einen Blick – je Probenart eine Kachel und eine einfache Tabelle (Probe · Probenahmestelle aus LabelKit · Ergebnis; PAK als Σ16 EPA-PAK mit Bewertung, Chlorid mit Wert, Asbest mit Befund). Werte mit Farbpunkt nach Skala, Legende in einer Zeile, Zwischenzeile je Geschoss. Filter „Nur auffällige“ / „Nur offene“, Sortierung nach Ort oder Probennummer; Ansicht „Nach Stelle“ / „Je Probenart“ unter „Mehr …“.
Ein Klick auf eine Probe klappt alle Parameter, Hinweise, Prüfbericht und Labor-Nr. auf. Ganz unten, zugeklappt: die Prüfberichte und die Ablage für neue Berichte.

**Übersicht drucken (ab 2.1):** Nach der Übernahme druckt „Übersicht drucken“ (Fußleiste bzw. „Mehr …“) alle Werte auf einer A4-Seite quer – eine Zeile je Probenahmestelle (P-Nr., Etage, Raum, Oberfläche, PAK Σ16 EPA, Chlorid, Asbest, Bemerkung), Kopf mit Projekt, Objekt, Auftraggeber, Druckdatum und Stand der Übernahme, „vorläufig“ bei vorläufigen Prüfberichten. Leere Spalten fallen weg, REF und Freimessung sind markiert, stornierte Proben fehlen; ab etwa 40 Zeilen weitere Seiten mit wiederholtem Tabellenkopf. Quelle ist nur die übernommene `_Ergebnisse.json`, gedruckt wird über den Browser (`window.print()`, `src/druck.ts`, `src/druck.css`) – ResultKit ändert dabei nichts und legt keine Datei ab.
Die Regeln für „Jetzt dran“ stehen in `src/jetzt.ts` (in Node getestet, `tests/jetzt.mjs`).

Neue Prüfberichte werden **nur hier** importiert: ResultKit legt eine unveränderte Kopie in `Laborergebnisse` ab (nichts wird überschrieben).
Nach der Prüfung schreibt **„Ergebnisse übernehmen“** die geltenden Werte nach `Laborergebnisse/_Ergebnisse.json`.
PlanKit, FotoKit und die Projektzentrale lesen nur diese Datei. Die vorige Übernahme bleibt als `_Ergebnisse.vorher.json` erhalten.

## Regeln

- Werte kommen ausschließlich aus der XML. Eine PDF allein liefert keine Werte (Hinweis „XML ergänzen“).
- Liegt die PDF dazu vor, werden die Hauptwerte (Σ16 EPA-PAK, Chlorid, Asbest) mit der PDF-Ergebnistabelle abgeglichen; Abweichungen erscheinen als Hinweis an der Probe, geändert wird nichts.
- Die Prüfungen am Bericht (Probenzahl laut Bericht, doppelte Probenreferenz oder P-Nummer) laufen beim Import und beim Einlesen des Ordners. Heißen XML und PDF gleich, gehören aber nicht zum selben Bericht, liest ResultKit sie getrennt und weist darauf hin – keine Datei fällt still weg.
- Gleicher Bericht mehrfach im Ordner → die neuere Datei zählt. Gleiche Probe/Parameter/Einheit in mehreren Berichten →
  endgültig vor vorläufig, sonst der neuere Bericht (wie im Datenarchiv der Projektzentrale). Ein vollständig ersetzter Bericht wird als „ersetzt“ gezeigt und nicht übernommen.
- Chlorid: VdS 2357, 5–10 µg/cm² korrosionschemisch relevante Größenordnung (< 5 grün, 5 – < 10 amber, ≥ 10 rot), unabhängig von der Nutzung; in ResultKit, PlanKit und FotoKit gleich (Block KORROSION-CHLORID v1). Ältere Berichte in mg/m² werden umgerechnet (1 µg/cm² = 10 mg/m²).
- Bewertung nur aus vorhandenen Skalen: Ergebniskarten-Einstellungen aus PlanKit, sonst VdS-2357-Referenz nach der Nutzung in `_Projekt.json`,
  sonst die Büro-Skalen (`_Spektron-Skalen.json`). Ohne Skala bleibt ein Wert unbewertet – ResultKit erfindet keine Grenzwerte.
- **In LabelKit stornierte Proben** (ab LabelKit 4.49.0, Feld `storniert`) sind keine Proben mehr: Sie fehlen im Laborauftrag, zählen nicht als offen oder ausstehend und gehen nicht nach `_Ergebnisse.json`. Ihre Nummer bleibt vergeben – nennt ein Prüfbericht trotzdem einen Wert dafür, erscheint oben der Hinweis „P7 ist in LabelKit storniert – der Laborwert gehört zu keiner offenen Probe …“; der Wert wird nicht übernommen.
- Ändert sich der Ordner nach der Übernahme (neuer Bericht, neue LabelKit-Datei), zeigt ResultKit „bitte erneut übernehmen“.

## `_Ergebnisse.json` (Format `spektron-ergebnisse`, Version 1)

`projekt` (Nummer), `uebernommen` (ISO-Zeit), `app`, `vollstaendig`, `stand`/`dateien` (Dateistand der Übernahme), `auftrag` (Proben aus LabelKit),
`berichte` (je Bericht Herkunft wie PlanKits `LabOrigin`, `datum` des Prüfberichts, dazu `proben` wie `LabSample` mit `reportId` und `werte` `{p,r,u,loq,nwg,norm}` – `loq` Bestimmungsgrenze, `nwg` Nachweisgrenze des Verfahrens (ab 1.10, z. B. Asbest „0,001 %“), `norm` Prüfnorm, jeweils nur wenn der Bericht sie nennt),
`ersetzt`, `offen`, `hinweise`. Lesen: `liesErgebnisDatei` in `src/ergebnisse.ts`.

## Entwicklung

```
pnpm install
pnpm dev        # http://127.0.0.1:5173
pnpm build && pnpm test
```

Tests nutzen nur erfundene Daten (`tests/lab-fixtures.mjs`). Keine Kundendaten im Repository.
Die Druckseite prüft `tests/druck-browser.mjs` (Zeilen, ausgeblendete Spalten, REF, vorläufig, nichts geschrieben; als PDF: 40 Zeilen = eine Seite quer, 70 Zeilen = zwei Seiten mit Kopf). Mit `DRUCK_PDF=<Ordner>` legt der Test die PDFs und Bildschirmfotos zum Ansehen ab.

### Spektron-Kette (Integrationstest über die Apps)

`tests/suite-kette.mjs` führt ein erfundenes Projekt durch die echten Apps: **LabelKit** (Proben erfassen, speichern) → **ResultKit** (vorläufiger, dann teilweise endgültiger Prüfbericht, übernehmen) → **Projektzentrale** (Stand der Stufe Labor) → **PlanKit** (Proben und Werte übernehmen, Warnleiste „Neuerer Laborstand“, Aktualisieren) → **FotoKit** (Ergebnistabelle fürs Gutachten aus dem übernommenen Stand) → vollständiger Bericht → **Projektzentrale** (Ans Büro übergeben) → **BüroKit** (Gegenlesen, PDF, Versand) → **BelegKit** (Zeiten, Abrechnungsstand) → Projektzentrale „Versandt und abgerechnet“. Geprüft wird, was zwischen den Apps kaputtgehen kann: gleiche Probennummern und Beschreibungen überall, Vollständigkeit, „Plan liegt hinter ResultKit“. Ein Fehler nennt die App, in der der Schritt scheiterte.

Alle Apps laufen dafür unter einem lokalen Server auf demselben Ursprung (wie auf GitHub Pages) und teilen sich einen Archivordner im privaten Browserdateisystem. In CI läuft die Kette bei jedem Pull Request und jede Nacht gegen den aktuellen Stand der anderen Apps (Job „Spektron-Kette“).

```
# LabelKit, Projektzentrale, FotoKit, BüroKit, BelegKit und gebautes PlanKit daneben
# (../labelkit, ../projektzentrale, ../bildumbenenner, ../buerokit, ../aufwandkit, ../probenplan/dist)
pnpm build && pnpm test:kette
```
