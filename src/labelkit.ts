// Probenerfassung aus LabelKit („…_Daten.json“ im Ordner „Laboraufträge“) als offene Proben übernehmen.
// LabelKit nummeriert PAK → Chlorid → Asbest → Sonstige fortlaufend (Feld _nr) und übergibt dem Labor „Probe <Nr>“.
// Genau diese Referenz steht später im Laborbericht – beim Import des Berichts werden die Proben daher per
// „Aktualisieren“ um Labordaten und Messwerte ergänzt.
// In LabelKit stornierte Proben (ab 4.49.0) fehlen im Auftrag wie gelöschte; ihre Nummern stehen in `storniert` (bleiben vergeben).
import {blankReport,validDate,type LabReport} from './labreport';
import {MAX_RAUM,SURFACE_FROM_LABELKIT,type LabSample,type LaborAuftrag} from './model';
import {parseProjName} from './ordner';

type Probe={_nr?:unknown;chloridNr?:unknown;id?:unknown;matrix?:string;datum?:string;z2?:string;z3?:string;z4?:string;cm2?:string|number;tiefe?:string;bkBez?:string;bkId?:string;bkMaterial?:string;bkStatus?:string;notiz?:string;bkVon?:string|number;bkBis?:string|number;bkGesamt?:string|number;bkRueck?:string;storniert?:unknown;nrFest?:unknown;auftrag?:unknown};

/* ===== LABORAUFTRAG (ab 2.7.0) – gleich halten mit LabelKit index.html, Block „NACHAUFTRAG (5.5.0)“: auftraegeAnwenden,
   auftraegePruefen, auftragMerkmalGilt, auftragVon, nrIstFest. Test tests/auftrag-labelkit.mjs vergleicht beide mit echten
   LabelKit-Funktionen (in der CI Pflicht). Plan resultkit-nachauftrag-plan.md, R2.
   LabelKit schreibt erst ab dem zweiten Laborauftrag etwas: je Probe `auftrag: "a2"` (die Wahrheit), oben `weitereAuftraege
   [{id, am, von, proben:[Nummern]}]`, `auftragZaehler`, `auftrag1 {am, quelle, proben}`. Ein Merkmal gilt nur mit fester Nummer
   (`nrFest` oder `storniert`) UND wenn die Nummer in der Liste dieses Auftrags steht. Fehlt die Liste einer Kennung ganz (ein
   älteres LabelKit-Fenster hat gespeichert), baut LabelKit sie aus den Merkmalen mit fester Nummer neu auf – dann gelten sie.
   ResultKit vergibt und ändert nie eine Kennung und schreibt die LabelKit-Datei nie; es rechnet nur nach. ===== */
type Auftrag1={am?:unknown;proben:number[]};type Weiterer={id?:unknown;am?:unknown;proben:number[]};
const auftragNr=(id:unknown)=>{const m=/^a(\d+)$/.exec(String(id||''));return m?Number(m[1]):0;};
const nrIstFest=(p:Probe)=>!!(p&&(p.nrFest||p.storniert));
/** Tag wie LabelKit tagIso (Ortszeit des Rechners). */
const tagIso=(v:unknown)=>{const d=new Date(v as string);return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export interface AuftraegeAusLabelKit {
 /** Kennung einer Probe der Datei, nur wenn sie nach LabelKits Regel gilt – sonst null (= neue Probe) */von:(p:object)=>string|null;
 /** Aufträge aus der Liste (oder neu aufgebaut), nach Nummer */auftraege:LaborAuftrag[];
 /** Liste oder Zähler fehlten und wurden aus den Merkmalen neu aufgebaut (wie LabelKits gelbe Zeile) */aufgebaut:boolean;
 /** Proben mit Merkmal, das nicht gilt: Nummer nicht fest oder nicht in der Liste dieses Auftrags */ungueltig:(p:object)=>''|'nichtFest'|'nichtInListe';
}
const NUMMERIERT=['proben','chloridProben','asbestProben','sonstigeProben'];
/** Laboraufträge einer LabelKit-Projektdatei nach der Regel von LabelKit 5.5.0 (reine Funktion, ändert `data` nicht). */
export function auftraegeAusLabelKit(data:Record<string,unknown>):AuftraegeAusLabelKit{
 const alle:Probe[]=NUMMERIERT.flatMap(k=>Array.isArray(data[k])?(data[k] as Probe[]):[]).filter(p=>!!p&&typeof p==='object');
 let weitere:Weiterer[]|null=Array.isArray(data.weitereAuftraege)?(data.weitereAuftraege as Weiterer[]).filter(a=>a&&auftragNr(a.id)).map(a=>({...a,proben:Array.isArray(a.proben)?a.proben.map(Number):[]})):null;
 const roh=data.auftrag1 as {proben?:unknown}|null|undefined;
 let auftrag1:Auftrag1|null=roh&&typeof roh==='object'?{...roh,proben:Array.isArray(roh.proben)?roh.proben.map(Number):[]}:null;
 const z=data.auftragZaehler,zaehler=Number.isFinite(Number(z))&&z!==null&&z!==''?Number(z):null;
 // auftraegePruefen: fehlen Liste oder Zähler, aus den Merkmalen mit fester Nummer neu aufbauen
 let aufgebaut=false;
 const mit=alle.filter(p=>auftragNr(p.auftrag)&&nrIstFest(p));
 if(mit.length){
  const je=new Map<unknown,number[]>();for(const p of mit){if(!je.has(p.auftrag))je.set(p.auftrag,[]);je.get(p.auftrag)!.push(Number(p._nr));}
  const tagVon=(id:unknown)=>mit.filter(p=>p.auftrag===id&&p.nrFest&&(p.nrFest as {am?:unknown}).am).map(p=>tagIso((p.nrFest as {am?:unknown}).am)).sort().pop()||'';
  if(je.has('a1')&&!auftrag1){auftrag1={am:tagVon('a1'),proben:je.get('a1')!.sort((a,b)=>a-b)};aufgebaut=true;}
  for(const [id,nrs] of je){if(id==='a1'||(weitere||[]).some(a=>a&&a.id===id))continue;(weitere=weitere||[]).push({id,am:tagVon(id),proben:nrs.sort((a,b)=>a-b)});aufgebaut=true;}
  if(zaehler===null)aufgebaut=true;
 }
 const liste=(id:unknown)=>{if(id==='a1')return auftrag1?auftrag1.proben:null;const e=(weitere||[]).find(a=>a&&a.id===id);return e?e.proben:null;};
 const gilt=(p:Probe)=>{if(!p||!auftragNr(p.auftrag)||!nrIstFest(p))return false;const l=liste(p.auftrag);return !!l&&l.includes(Number(p._nr));};
 const auftraege=new Map<string,LaborAuftrag>(),dazu=(id:unknown,am:unknown)=>{const nr=auftragNr(id);if(nr&&!auftraege.has(String(id)))auftraege.set(String(id),{id:String(id),nr,am:validDate(String(am??'').slice(0,10))?String(am).slice(0,10):''});};
 if(auftrag1)dazu('a1',auftrag1.am);for(const a of weitere||[])dazu(a.id,a.am);
 return {von:p=>gilt(p as Probe)?String((p as Probe).auftrag):null,auftraege:[...auftraege.values()].sort((a,b)=>a.nr-b.nr),aufgebaut,
  ungueltig:p=>{const q=p as Probe;if(!q||!auftragNr(q.auftrag)||gilt(q))return '';return nrIstFest(q)?'nichtInListe':'nichtFest';}};
}
/* ===== Ende LABORAUFTRAG ===== */
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
  const A=auftraegeAusLabelKit(data),falsch:{n:number;k:number;grund:string}[]=[];   // ab 2.7.0: Laborauftrag je Probe (nur gültige Kennungen)
  for(const [key,type] of LISTS)for(const raw of (Array.isArray(data[key])?data[key] as Probe[]:[])){
    if(!raw||typeof raw!=='object')continue;const n=number(raw);
    if(isStorniert(raw)){if(n)storniert.add(n);continue;}   // Nummer bleibt vergeben: ein Laborwert dafür wird gemeldet, nie einer anderen Probe zugeordnet
    if(!n){report.warnings.push(`${type}: eine Probe ohne Nummer wurde übersprungen.`);continue;}
    if(isRueckstellprobe(raw)){rueckstell++;continue;}
    if(seen.has(n)){report.warnings.push(`Probe ${n} ist in LabelKit doppelt vergeben (${type}${auftragNr(raw.auftrag)?`, Merkmal „Auftrag ${auftragNr(raw.auftrag)}“`:''}) und wurde übersprungen.`);continue;}seen.add(n);
    const row:LabSample={label:`P${n}`,typ:type,ref:`Probe ${n}`,desc:description(raw).slice(0,500),art:`${type}${str(raw.matrix)?` · ${str(raw.matrix)}`:''}`.slice(0,160)};
    const datum=isoDate(raw.datum);if(datum)row.datum=datum;
    const surface=SURFACE_FROM_LABELKIT[str(raw.z4)];if(surface)row.surface=surface;
    const raum=str(raw.z2).slice(0,MAX_RAUM);if(raum)row.raum=raum;
    const kennung=A.von(raw);if(kennung)row.auftrag=kennung;
    const grund=A.ungueltig(raw);if(grund)falsch.push({n,k:auftragNr(raw.auftrag),grund});
    report.rows.push(row);
  }
  if(rueckstell)report.warnings.push(`${rueckstell} Bohrkern-Rückstellprobe${rueckstell===1?'':'n'} (nur gesägt und aufbewahrt, keine Analyse) nicht übernommen – dafür gibt es keinen Laborwert.`);
  report.rows.sort((a,b)=>Number(a.label.slice(1))-Number(b.label.slice(1)));report.expected=report.rows.length;
  for(const n of seen)storniert.delete(n);   // gleiche Nummer aktiv und storniert (sollte LabelKit nie schreiben): die aktive Probe gilt
  if(storniert.size)report.storniert=[...storniert].sort((a,b)=>a-b).map(n=>`P${n}`);
  // Laboraufträge nur, wenn mindestens eine aktive Probe eine gültige Kennung trägt (sonst: ein Auftrag, alles wie bis 2.6)
  const mitAuftrag=report.rows.some(r=>r.auftrag);
  if(mitAuftrag){report.auftraege=A.auftraege;
   if(A.aufgebaut)report.warnings.push('Liste der Laboraufträge fehlt in der LabelKit-Datei (ein älteres LabelKit-Fenster hat gespeichert) – in LabelKit einmal öffnen und speichern. ResultKit rechnet die Aufträge wie LabelKit aus den Proben.');}
  for(const f of falsch)report.warnings.push(`P${f.n}: Merkmal „Auftrag ${f.k}“ aus LabelKit gilt nicht (${f.grund==='nichtFest'?'Nummer nicht fest':'Nummer nicht in der Liste dieses Auftrags'}) – ${mitAuftrag?'zählt als neue Probe; ':''}in LabelKit prüfen.`);
  if(!report.rows.length)report.warnings.push(storniert.size?'Alle Proben der LabelKit-Datei sind storniert.':'Die LabelKit-Datei enthält noch keine PAK-, Chlorid-, Asbest- oder sonstigen Proben.');
  return report;
}
