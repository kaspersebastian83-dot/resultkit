// Probenerfassung aus LabelKit („…_Daten.json“ im Ordner „Laboraufträge“) als offene Proben übernehmen.
// LabelKit nummeriert PAK → Chlorid → Asbest → Sonstige fortlaufend (Feld _nr) und übergibt dem Labor „Probe <Nr>“.
// Genau diese Referenz steht später im Laborbericht – beim Import des Berichts werden die Proben daher per
// „Aktualisieren“ um Labordaten und Messwerte ergänzt.
// In LabelKit stornierte Proben (ab 4.49.0) fehlen im Auftrag wie gelöschte; ihre Nummern stehen in `storniert` (bleiben vergeben).
import {blankReport,validDate,type LabReport} from './labreport';
import {MAX_RAUM,SURFACE_FROM_LABELKIT,type LabSample} from './model';
import {parseProjName} from './ordner';

type Probe={_nr?:unknown;chloridNr?:unknown;id?:unknown;matrix?:string;datum?:string;z2?:string;z3?:string;z4?:string;cm2?:string|number;tiefe?:string;bkBez?:string;bkId?:string;bkMaterial?:string;bkStatus?:string;notiz?:string;bkVon?:string|number;bkBis?:string|number;bkGesamt?:string|number;bkRueck?:string;storniert?:unknown};
/** Bohrkern-Segment „R“: nur gesägt und aufbewahrt, kein Laborwert – kommt nicht als offene Probe in den Plan. */
export const RUECKSTELLPROBE='Rückstellprobe – nicht analysieren';
/** LabelKit ab 4.49.0: `storniert: {am, kuerzel, grund}` – die Probe ist keine Probe mehr, behält aber ihre Nummer (`_nr`).
 *  Wie gelöscht behandeln (nicht anbieten, nicht zählen); jeder wahre Wert zählt als storniert. */
export const isStorniert=(p:Probe)=>!!p.storniert;
const isRueckstellprobe=(p:Probe)=>p.matrix==='Bohrkern'&&(str(p.bkStatus).toUpperCase()==='R'||str(p.notiz)===RUECKSTELLPROBE);
const LISTS:[string,string][]=[['proben','PAK'],['chloridProben','Chlorid'],['asbestProben','Asbest'],['sonstigeProben','Sonstige']];
const str=(v:unknown)=>v===undefined||v===null?'':String(v).replace(/\s+/g,' ').trim();
function number(p:Probe){for(const v of [p._nr,p.chloridNr,p.id]){const n=Number(v);if(Number.isSafeInteger(n)&&n>0&&n<1e9)return n;}return 0;}
function description(p:Probe){
  if(p.matrix==='Bohrkern'){const parts=[str(p.bkId)||str(p.bkBez),str(p.bkMaterial)];if(str(p.bkVon)&&str(p.bkBis))parts.push(`${str(p.bkVon)}–${str(p.bkBis)} cm`);if(str(p.bkGesamt))parts.push(`Gesamtl. ${str(p.bkGesamt)} cm`);if(str(p.bkRueck))parts.push(`Rückst.: ${str(p.bkRueck)}`);return parts.filter(Boolean).join(' · ');}
  return [str(p.z2),str(p.z3),str(p.z4),p.matrix==='Wischprobe'&&str(p.cm2)?`${str(p.cm2)} cm²`:'',str(p.tiefe)?`Tiefe: ${str(p.tiefe)}`:''].filter(Boolean).join(', ');
}
function isoDate(v:unknown){const s=str(v);if(validDate(s))return s;const m=/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);if(m){const iso=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;if(validDate(iso))return iso;}return '';}

/** Projektnummer „26.0512“ aus dem LabelKit-Feld „Projektnummer“. Das Feld ist Freitext – ältere Projekte tragen dort oft die
 *  Adresse mit („26.0512 Stegerwaldstraße Leverkusen“). Verglichen wird dann nur die Nummer; ohne Nummer der ganze Text wie bisher.
 *  Gleiche Regel in BerichtKit (bericht-text.js) und LabelKit. */
export const projektNummer=(s:string)=>s.match(/(?<!\d)\d{2}\.\d{3,6}(?!\d)/)?.[0]||'';

/** LabelKit-Projektdatei → Prüfliste (ohne Messwerte). null bezeichnet ausdrücklich einen freien Plan ohne Projektzuordnung. */
export function labelkitReport(text:string,quelle:string,project:string|null,confirmMissingProject?:(message:string)=>boolean):LabReport{
  let data:Record<string,unknown>;try{data=JSON.parse(text);}catch{throw Error(`„${quelle}“ ist keine gültige LabelKit-Projektdatei.`);}
  if(!data||typeof data!=='object'||!LISTS.some(([k])=>Array.isArray(data[k])))throw Error(`„${quelle}“ enthält keine Proben aus LabelKit.`);
  const target=project===null?undefined:parseProjName(project)?.nr;
  const nr=String((data.projekt as {nr?:unknown}|null)?.nr??'').trim();
  if(project!==null&&!target)throw Error('LabelKit-Import blockiert: Die Projektnummer des aktiven Projekts ist nicht erkennbar. Bitte den passenden Projektordner öffnen.');
  if(target&&nr&&(projektNummer(nr)||nr)!==target)throw Error(`Projektzuordnung blockiert: „${quelle}“ gehört zu Projekt ${nr}, das aktive Projekt zu ${target}. Bitte die Datei und den Projektordner prüfen und das passende Projekt öffnen.`);
  if(!nr&&!confirmMissingProject?.(`„${quelle}“ enthält keine Projektnummer (ältere Datei). ${target?`Die Zugehörigkeit zu Projekt ${target}`:'Die Zugehörigkeit zum geöffneten freien Plan'} kann nicht automatisch geprüft werden.\n\nHaben Sie die Datei geprüft und gehört sie zu diesem Projekt? Nur dann mit OK übernehmen.`))throw Error('LabelKit-Import abgebrochen: Die Datei ohne Projektnummer wurde nicht ausdrücklich dem aktiven Projekt zugeordnet.');
  const report=blankReport();report.quelle=quelle;report.labor='LabelKit (Probenerfassung)';report.bericht='';report.auftragsreferenz=nr||target||'';report.sources={};
  const seen=new Set<number>(),storniert=new Set<number>();let rueckstell=0;
  for(const [key,type] of LISTS)for(const raw of (Array.isArray(data[key])?data[key] as Probe[]:[])){
    if(!raw||typeof raw!=='object')continue;const n=number(raw);
    if(isStorniert(raw)){if(n)storniert.add(n);continue;}   // Nummer bleibt vergeben: ein Laborwert dafür wird gemeldet, nie einer anderen Probe zugeordnet
    if(!n){report.warnings.push(`${type}: eine Probe ohne Nummer wurde übersprungen.`);continue;}
    if(isRueckstellprobe(raw)){rueckstell++;continue;}
    if(seen.has(n)){report.warnings.push(`Probe ${n} ist in LabelKit doppelt vergeben (${type}) und wurde übersprungen.`);continue;}seen.add(n);
    const row:LabSample={label:`P${n}`,typ:type,ref:`Probe ${n}`,desc:description(raw).slice(0,500),art:`${type}${str(raw.matrix)?` · ${str(raw.matrix)}`:''}`.slice(0,160)};
    const datum=isoDate(raw.datum);if(datum)row.datum=datum;
    const surface=SURFACE_FROM_LABELKIT[str(raw.z4)];if(surface)row.surface=surface;
    const raum=str(raw.z2).slice(0,MAX_RAUM);if(raum)row.raum=raum;
    report.rows.push(row);
  }
  if(rueckstell)report.warnings.push(`${rueckstell} Bohrkern-Rückstellprobe${rueckstell===1?'':'n'} (nur gesägt und aufbewahrt, keine Analyse) nicht übernommen – dafür gibt es keinen Laborwert.`);
  report.rows.sort((a,b)=>Number(a.label.slice(1))-Number(b.label.slice(1)));report.expected=report.rows.length;
  for(const n of seen)storniert.delete(n);   // gleiche Nummer aktiv und storniert (sollte LabelKit nie schreiben): die aktive Probe gilt
  if(storniert.size)report.storniert=[...storniert].sort((a,b)=>a-b).map(n=>`P${n}`);
  if(!report.rows.length)report.warnings.push(storniert.size?'Alle Proben der LabelKit-Datei sind storniert.':'Die LabelKit-Datei enthält noch keine PAK-, Chlorid-, Asbest- oder sonstigen Proben.');
  return report;
}
