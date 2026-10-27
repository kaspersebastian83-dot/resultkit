# Changelog

## 1.3.0 · 27.10.2026
- **Eine Seite statt zwei Reitern.** „Übersicht“ und „Prüfung und Import“ sind zusammengelegt: oben „Jetzt dran“, darunter die Ergebnisse, ganz unten die Prüfberichte (zugeklappt).
- **„Jetzt dran“** zeigt den einen nächsten Schritt mit einem Hauptknopf: Berichte importieren → Ergebnisse übernehmen → grün „Übernommen ✓“ (nichts zu tun) → nach Änderungen im Ordner „Erneut übernehmen“. Darunter der Stand in einem Satz; Hinweise als Chip „⚠ n Hinweise“, der die betroffenen Proben und Berichte aufklappt.
- **Nach dem Import ohne Hinweise:** „AR-… eingelesen – Jetzt übernehmen?“ mit „Ergebnisse übernehmen“ oder „Erst ansehen“.
- **Proben aufklappen:** Klick auf eine Zeile zeigt alle Parameter (in der Bewertungsfarbe), Hinweise, Stand, Prüfbericht (vorläufig/endgültig, XML/PDF), Labor-Nr., Probenahmedatum und Art. Proben mit Hinweis tragen „⚠ Hinweis“ in der Zeile.
- Prüfberichte (Karten mit Kernwerten und „Alle Parameter“, ersetzte Berichte) und die Ablage für neue Berichte stehen im aufklappbaren Bereich „Prüfberichte“; ohne Bericht ist er offen.
- Unverändert: Import-Dialog, Ziehen überall, Regeln zum Zusammenführen, Bewertung und `_Ergebnisse.json`.

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
