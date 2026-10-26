// ResultKit – Kern ohne Browserteile (in Node testbar).
// Aus Laborauftrag (LabelKit) und Prüfberichten (Ordner „Laborergebnisse“) wird eine Übersicht je Probe:
// erwartet, Ergebnis da, nur vorläufig, offen oder nicht beauftragt. „Ergebnisse übernehmen“ schreibt daraus
// „Laborergebnisse/_Ergebnisse.json“, aus der PlanKit, FotoKit und die Projektzentrale lesen.
//
// Zusammenführen wie im Datenarchiv der Projektzentrale (archiv/auswertung.js, projektMessungen):
// gleicher Bericht mehrfach abgelegt → neueste Datei; gleiche Probe/Parameter/Einheit in mehreren Berichten → endgültig vor
// vorläufig, sonst der neuere. Ein Bericht, von dem nichts übrig bleibt, gilt als ersetzt.
import type {LabReport} from './labreport';
import {referenceLabel} from './labreport';
import type {LabOrigin,LabSample,Wert} from './model';

export const FORMAT='spektron-ergebnisse',VERSION=1,DATEI='_Ergebnisse.json';
const tidy=(s:unknown)=>String(s??'').normalize('NFC').replace(/\s+/g,' ').trim();
const norm=(s:unknown)=>tidy(s).toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]/gu,'');
const nummer=(label:string)=>{const n=Number(label.replace(/^P/i,''));return Number.isSafeInteger(n)&&n>0?n:null;};

/** Ein Prüfbericht, wie er im Ordner liegt (XML und/oder PDF gleichen Namens). */
export interface Eingang {report:LabReport;geaendert:number}
export interface Bericht extends LabOrigin {proben:LabSample[];geaendert:number;hinweise:string[];ersetztDurch?:string[];ohneWerte:boolean}
export type Status='ergebnis'|'vorlaeufig'|'ohneWerte'|'offen'|'nichtBeauftragt';
export interface Zeile {label:string;nr:number|null;ref:string;desc:string;typ?:string;art?:string;datum?:string;erwartet:boolean;status:Status;werte:(Wert&{bericht:string;vorlaeufig:boolean})[];berichte:string[];hinweise:string[]}
export interface Uebersicht {projekt:string;auftrag:{quelle:string;proben:number;hinweise:string[]}|null;berichte:Bericht[];zeilen:Zeile[];
 zaehler:{erwartet:number|null;ergebnis:number;vorlaeufig:number;offen:number;nichtBeauftragt:number};hinweise:string[]}

/** Was je Probenart im Bericht stehen sollte (grob, nur für einen Hinweis – nie zum Aussortieren). */
const ERWARTET:Record<string,RegExp>={PAK:/pak|pyren|anthen|anthracen|naphthalin|chrysen|fluor|phenanthren|acenaph/i,Chlorid:/chlorid/i,Asbest:/asbest/i};
/** Projektnummer „26.0142“ aus einer Auftragsreferenz. */
const projektnummer=(s:string)=>s.match(/\b\d{2}\.\d{3,6}\b/)?.[0]||'';

export function uebersicht(projekt:string,auftrag:LabReport|null,eingaenge:Eingang[]):Uebersicht{
 const hinweise:string[]=[];
 // 1. Gleicher Bericht mehrfach abgelegt → neueste Datei. Ohne Nummer zählt die Datei als eigener Bericht.
 const nachCode=new Map<string,Eingang>();
 for(const e of eingaenge){const key=e.report.bericht?`b:${norm(e.report.bericht)}`:`d:${e.report.quelle}`;const alt=nachCode.get(key);
  if(alt){hinweise.push(`Prüfbericht ${e.report.bericht} liegt mehrfach im Ordner (${[alt.report.quelle,e.report.quelle].join(', ')}). Es zählt die neuere Datei.`);if(e.geaendert<alt.geaendert)continue;}
  nachCode.set(key,e);}
 const berichte:Bericht[]=[...nachCode.values()].map((e,i)=>{const r=e.report,id=`b${i+1}`;const b:Bericht={id,bericht:r.bericht,labor:r.labor,auftragsreferenz:r.auftragsreferenz,...(r.batch?{batch:r.batch}:{}),sources:{...r.sources},...(r.vorlaeufig?{vorlaeufig:true as const}:{}),
  proben:r.rows.map(row=>({...row,label:row.label||referenceLabel(row.ref),bericht:r.bericht,...(row.werte?{werte:row.werte.map(w=>({...w}))}:{})})),geaendert:e.geaendert,hinweise:[...new Set(r.warnings)],ohneWerte:!r.rows.some(row=>row.werte?.length)};
  const nr=projektnummer(r.auftragsreferenz);if(projekt&&nr&&nr!==projekt)b.hinweise.push(`Die Auftragsreferenz „${r.auftragsreferenz}“ nennt Projekt ${nr} – dieses Projekt ist ${projekt}. Gehört der Bericht hierher?`);
  if(b.ohneWerte)b.hinweise.push(r.sources.xml?'Der Bericht enthält keine Messwerte.':'Nur die PDF liegt vor – Messwerte kommen aus der XML. Bitte die XML des Berichts von Eurofins (EOL) ergänzen.');
  return b;});
 // 2. Je Probe/Parameter/Einheit gewinnt: endgültig vor vorläufig, sonst die neuere Datei.
 const reihenfolge=[...berichte].sort((a,b)=>(a.vorlaeufig?0:1)-(b.vorlaeufig?0:1)||a.geaendert-b.geaendert);
 const sieger=new Map<string,Bericht>(),probeKey=(s:LabSample)=>s.label||norm(s.ref)||norm(s.labNr);
 for(const b of reihenfolge)for(const s of b.proben)for(const w of s.werte||[])sieger.set(`${probeKey(s)}\u0000${tidy(w.p)}\u0000${tidy(w.u)}`,b);
 for(const b of berichte){let blieb=false;const durch=new Set<string>();
  for(const s of b.proben){if(!s.werte)continue;s.werte=s.werte.filter(w=>{const g=sieger.get(`${probeKey(s)}\u0000${tidy(w.p)}\u0000${tidy(w.u)}`);if(g===b)return true;if(g)durch.add(g.bericht||g.sources.xml||'');return false;});if(s.werte.length)blieb=true;}
  if(!b.ohneWerte&&!blieb){b.ersetztDurch=[...durch].filter(Boolean);b.hinweise.push(`Ersetzt durch ${b.ersetztDurch.join(', ')||'einen neueren Bericht'} – die Werte dieses Berichts gelten nicht mehr.`);}
  else if(durch.size&&b.vorlaeufig)b.hinweise.push(`Teilweise ersetzt durch ${[...durch].join(', ')}.`);}
 // 3. Zeilen je Probe: erwartet (LabelKit) ∪ in Berichten.
 const zeilen=new Map<string,Zeile>();
 const zeile=(s:LabSample,erwartet:boolean)=>{const key=s.label||`?${norm(s.ref)||norm(s.labNr)}`;let z=zeilen.get(key);
  if(!z){z={label:s.label,nr:s.label?nummer(s.label):null,ref:tidy(s.ref),desc:tidy(s.desc),...(s.typ?{typ:s.typ}:{}),...(s.art?{art:tidy(s.art)}:{}),...(s.datum?{datum:s.datum}:{}),erwartet,status:'offen',werte:[],berichte:[],hinweise:[]};zeilen.set(key,z);}
  return z;};
 for(const s of auftrag?.rows||[])zeile(s,true);
 for(const b of berichte)for(const s of b.proben){const z=zeile(s,false);
  if(!z.berichte.includes(b.bericht))z.berichte.push(b.bericht);
  if(!z.desc)z.desc=tidy(s.desc);if(!z.art&&s.art)z.art=tidy(s.art);
  if(z.erwartet&&z.datum&&s.datum&&z.datum!==s.datum)z.hinweise.push(`Probenahmedatum: LabelKit ${z.datum}, Bericht ${b.bericht} ${s.datum}.`);
  if(!z.datum&&s.datum)z.datum=s.datum;
  for(const w of s.werte||[])z.werte.push({...w,bericht:b.bericht,vorlaeufig:!!b.vorlaeufig});}
 for(const z of zeilen.values()){
  const endgueltig=z.werte.some(w=>!w.vorlaeufig);
  z.status=!z.erwartet&&auftrag?'nichtBeauftragt':z.werte.length?(endgueltig?'ergebnis':'vorlaeufig'):z.berichte.length?'ohneWerte':'offen';
  if(z.status==='nichtBeauftragt'&&!z.werte.length)z.hinweise.push('Steht im Bericht, aber ohne Messwerte.');
  if(z.status==='nichtBeauftragt')z.hinweise.push('Nicht im Laborauftrag aus LabelKit – Probennummer prüfen.');
  if(!z.label)z.hinweise.push(`Probenreferenz „${z.ref}“ hat keine Probennummer („Probe 3“).`);
  const muster=z.typ?ERWARTET[z.typ]:undefined;
  if(muster&&z.werte.length&&!z.werte.some(w=>muster.test(w.p)))z.hinweise.push(`${z.typ} beauftragt – der Bericht enthält dazu keinen Wert.`);
  if(z.status==='vorlaeufig')z.hinweise.push('Nur vorläufige Werte – der endgültige Bericht fehlt noch.');}
 const liste=[...zeilen.values()].sort((a,b)=>(a.nr??1e9)-(b.nr??1e9)||a.ref.localeCompare(b.ref,'de',{numeric:true}));
 const zahl=(s:Status)=>liste.filter(z=>z.status===s).length;
 if(!auftrag)hinweise.push('Kein Laborauftrag aus LabelKit gefunden (Ordner „Laboraufträge“) – welche Proben noch fehlen, lässt sich nicht prüfen.');
 return {projekt,auftrag:auftrag?{quelle:auftrag.quelle,proben:auftrag.rows.length,hinweise:[...auftrag.warnings]}:null,berichte,zeilen:liste,
  zaehler:{erwartet:auftrag?auftrag.rows.length:null,ergebnis:zahl('ergebnis'),vorlaeufig:zahl('vorlaeufig'),offen:zahl('offen')+zahl('ohneWerte'),nichtBeauftragt:zahl('nichtBeauftragt')},hinweise};
}

/** Kurzer Stand in einem Satz, z. B. „8 von 10 Proben mit Ergebnis · 2 offen“. */
export function standText(u:Uebersicht){
 const z=u.zaehler,teile:string[]=[];
 if(z.erwartet!==null)teile.push(`${z.ergebnis} von ${z.erwartet} Proben mit Ergebnis`);else teile.push(`${z.ergebnis} Proben mit Ergebnis`);
 if(z.vorlaeufig)teile.push(`${z.vorlaeufig} nur vorläufig`);if(z.offen)teile.push(`${z.offen} offen`);if(z.nichtBeauftragt)teile.push(`${z.nichtBeauftragt} nicht beauftragt`);
 return teile.join(' · ');
}
export const vollstaendig=(u:Uebersicht)=>u.zaehler.erwartet!==null&&u.zaehler.erwartet>0&&u.zaehler.ergebnis===u.zaehler.erwartet&&!u.zaehler.nichtBeauftragt;

/** Dateistand, auf dem eine Übernahme beruht: ändert sich der Ordner danach, zeigen die Apps „neu prüfen“. */
export interface DateiStand {name:string;size:number;t:number}
export const standKennung=(dateien:DateiStand[])=>[...dateien].sort((a,b)=>a.name.localeCompare(b.name)).map(d=>`${d.name}|${d.size}|${d.t}`).join('\n');

export interface ErgebnisDatei {format:typeof FORMAT;version:typeof VERSION;projekt:string;uebernommen:string;app:{name:'ResultKit';version:string};
 vollstaendig:boolean;stand:string;dateien:DateiStand[];auftrag:{quelle:string;proben:{label:string;typ?:string;ref:string;desc:string}[]}|null;
 berichte:(LabOrigin&{proben:LabSample[]})[];ersetzt:{bericht:string;durch:string[]}[];offen:string[];hinweise:string[]}

/** Inhalt von „_Ergebnisse.json“: nur geltende Werte (ersetzte entfallen), je Bericht mit Herkunft wie in PlanKit. */
export function ergebnisDatei(u:Uebersicht,auftrag:LabReport|null,dateien:DateiStand[],app:string,jetzt=new Date()):ErgebnisDatei{
 const berichte=u.berichte.filter(b=>!b.ersetztDurch).map(b=>({id:b.id,bericht:b.bericht,labor:b.labor,auftragsreferenz:b.auftragsreferenz,...(b.batch?{batch:b.batch}:{}),sources:{...b.sources},...(b.vorlaeufig?{vorlaeufig:true as const}:{}),
  proben:b.proben.filter(s=>!b.ohneWerte?s.werte?.length:true).map(s=>({...s,reportId:b.id,werte:(s.werte||[]).map(w=>({...w}))}))}));
 return {format:FORMAT,version:VERSION,projekt:u.projekt,uebernommen:jetzt.toISOString(),app:{name:'ResultKit',version:app},vollstaendig:vollstaendig(u),stand:standKennung(dateien),dateien:[...dateien],
  auftrag:auftrag?{quelle:auftrag.quelle,proben:auftrag.rows.map(r=>({label:r.label,...(r.typ?{typ:r.typ}:{}),ref:r.ref,desc:r.desc}))}:null,
  berichte,ersetzt:u.berichte.filter(b=>b.ersetztDurch).map(b=>({bericht:b.bericht,durch:b.ersetztDurch!})),
  offen:u.zeilen.filter(z=>z.status==='offen'||z.status==='ohneWerte').map(z=>z.label||z.ref),hinweise:[...u.hinweise,...u.zeilen.flatMap(z=>z.hinweise.map(h=>`${z.label||z.ref}: ${h}`))]};
}

/** Gelesene „_Ergebnisse.json“ prüfen (für ResultKit selbst und als Muster für PlanKit/FotoKit). */
export function liesErgebnisDatei(text:string):ErgebnisDatei{
 let v:unknown;try{v=JSON.parse(text);}catch{throw Error(`„${DATEI}“ ist keine gültige JSON-Datei.`);}
 const o=v as Partial<ErgebnisDatei>;
 if(!o||typeof o!=='object'||o.format!==FORMAT)throw Error(`„${DATEI}“ stammt nicht aus ResultKit.`);
 if(o.version!==VERSION)throw Error(`„${DATEI}“ hat ein unbekanntes Format (Version ${String(o.version)}) – bitte ResultKit aktualisieren.`);
 if(!Array.isArray(o.berichte)||typeof o.uebernommen!=='string'||typeof o.stand!=='string')throw Error(`„${DATEI}“ ist unvollständig.`);
 return o as ErgebnisDatei;
}
