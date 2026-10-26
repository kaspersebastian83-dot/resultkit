# ResultKit – Laborergebnisse

Teil der Spektron-Apps (LabelKit → FotoKit → **ResultKit** → PlanKit → BelegKit). ResultKit zeigt für ein Projekt an einer Stelle:

- **was beim Labor ist** – die Laborübergabe aus LabelKit (neueste `…_Daten.json` im Ordner `Laboraufträge`),
- **was zurück ist** – die Prüfberichte im Ordner `Laborergebnisse` (Eurofins-XML, dazu die PDF zum Abgleich),
- **was noch fehlt** – Proben ohne Ergebnis, nur vorläufige Werte, Proben im Bericht, die nicht beauftragt waren.

Neue Prüfberichte werden **nur hier** importiert: ResultKit legt eine unveränderte Kopie in `Laborergebnisse` ab (nichts wird überschrieben).
Nach der Prüfung schreibt **„Ergebnisse übernehmen“** die geltenden Werte nach `Laborergebnisse/_Ergebnisse.json`.
PlanKit, FotoKit und die Projektzentrale lesen nur diese Datei. Die vorige Übernahme bleibt als `_Ergebnisse.vorher.json` erhalten.

## Regeln

- Werte kommen ausschließlich aus der XML. Eine PDF allein liefert keine Werte (Hinweis „XML ergänzen“).
- Gleicher Bericht mehrfach im Ordner → die neuere Datei zählt. Gleiche Probe/Parameter/Einheit in mehreren Berichten →
  endgültig vor vorläufig, sonst der neuere Bericht (wie im Datenarchiv der Projektzentrale). Ein vollständig ersetzter Bericht wird als „ersetzt“ gezeigt und nicht übernommen.
- Bewertung nur aus vorhandenen Skalen: Ergebniskarten-Einstellungen aus PlanKit, sonst VdS-2357-Referenz nach der Nutzung in `_Projekt.json`,
  sonst die Büro-Skalen (`_Spektron-Skalen.json`). Ohne Skala bleibt ein Wert unbewertet – ResultKit erfindet keine Grenzwerte.
- Ändert sich der Ordner nach der Übernahme (neuer Bericht, neue LabelKit-Datei), zeigt ResultKit „bitte erneut übernehmen“.

## `_Ergebnisse.json` (Format `spektron-ergebnisse`, Version 1)

`projekt` (Nummer), `uebernommen` (ISO-Zeit), `app`, `vollstaendig`, `stand`/`dateien` (Dateistand der Übernahme), `auftrag` (Proben aus LabelKit),
`berichte` (je Bericht Herkunft wie PlanKits `LabOrigin` plus `proben` wie `LabSample` mit `reportId` und `werte` `{p,r,u,loq}`),
`ersetzt`, `offen`, `hinweise`. Lesen: `liesErgebnisDatei` in `src/ergebnisse.ts`.

## Entwicklung

```
pnpm install
pnpm dev        # http://127.0.0.1:5173
pnpm build && pnpm test
```

Tests nutzen nur erfundene Daten (`tests/lab-fixtures.mjs`). Keine Kundendaten im Repository.
