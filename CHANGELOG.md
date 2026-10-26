# Changelog

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
