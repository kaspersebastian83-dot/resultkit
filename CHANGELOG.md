# Changelog

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
