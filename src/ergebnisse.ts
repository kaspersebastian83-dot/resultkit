// ResultKit – Kern ohne Browserteile (in Node testbar).
// Aus Laborauftrag (LabelKit) und Prüfberichten (Ordner „Laborergebnisse“) wird eine Übersicht je Probe:
// erwartet, Ergebnis da, nur vorläufig, offen oder nicht beauftragt. „Ergebnisse übernehmen“ schreibt daraus
// „Laborergebnisse/_Ergebnisse.json“, aus der PlanKit, FotoKit und die Projektzentrale lesen.
//
// Zusammenführen wie im Datenarchiv der Projektzentrale (archiv/auswertung.js, projektMessungen):
// gleicher Bericht mehrfach abgelegt → die Datei mit Messwerten (XML), dann endgültig vor vorläufig, sonst die neueste; gleiche Probe/Parameter/Einheit in mehreren Berichten → endgültig vor
// vorläufig, sonst der neuere. Ein Bericht, von dem nichts übrig bleibt, gilt als ersetzt.
import type {LabReport,Abweichung} from './labreport';
import {referenceLabel,mitPdfAbgleichen,abgleichHinweis,ABGLEICH} from './labreport';
import type {LabOrigin,LabSample,Wert} from './model';

export const FORMAT='spektron-ergebnisse',VERSION=1,DATEI='_Ergebnisse.json';
const tidy=(s:unknown)=>String(s??'').normalize('NFC').replace(/\s+/g,' ').trim();
/** Probenbeschreibung vergleichbar machen. Eurofins übernimmt den Text der LabelKit-Laborübergabe wörtlich (geprüft an 15 echten
    Asbestproben, 30.10.2026 – sogar Tippfehler bleiben stehen); angeglichen werden nur Leerraum, Groß-/Kleinschreibung, Striche
    und Anführungszeichen. In BerichtKit (bericht-text.js) gleich halten. */
export const beschreibungKey=(s:unknown)=>tidy(s).toLowerCase().replace(/[\u2010-\u2015\u2212]/g,'-').replace(/[\u201E\u201C\u201D\u201A\u2018\u2019\u00AB\u00BB"']/g,'"');
/** Weicht die Beschreibung im Prüfbericht von der aus LabelKit ab? Nie bei fehlendem Text und bei Bohrkernen (andere Reihenfolge
    in der Übergabe); „Tiefe: …“ am Ende zählt nicht (LabelKit übergibt sie nur bei Bohrmehl). */
export function beschreibungWeichtAb(auftrag:unknown,bericht:unknown,art=''){
 if(!tidy(auftrag)||!tidy(bericht)||/bohrkern/i.test(art))return false;
 const a=beschreibungKey(auftrag),b=beschreibungKey(bericht);
 return a!==b&&a.replace(/, tiefe: [^,]*$/,'')!==b;
}
const norm=(s:unknown)=>tidy(s).toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]/gu,'');
const nummer=(label:string)=>{const n=Number(label.replace(/^P/i,''));return Number.isSafeInteger(n)&&n>0?n:null;};

/** Ein Prüfbericht, wie er im Ordner liegt (XML und/oder PDF gleichen Namens). */
export interface Eingang {report:LabReport;geaendert:number}
/** wertAbgleich (ab 1.6): Hauptwerte XML↔PDF – nur wenn beide Dateien vorliegen. */
export interface Bericht extends LabOrigin {datum?:string;proben:LabSample[];geaendert:number;hinweise:string[];ersetztDurch?:string[];ohneWerte:boolean;wertAbgleich?:{erkannt:boolean;geprueft:number;abweichend:number}}
export type Status='ergebnis'|'vorlaeufig'|'ohneWerte'|'offen'|'nichtBeauftragt';
export interface Zeile {label:string;nr:number|null;ref:string;desc:string;typ?:string;art?:string;datum?:string;erwartet:boolean;status:Status;werte:(Wert&{bericht:string;vorlaeufig:boolean})[];berichte:string[];hinweise:string[]}
/** storniert (ab 1.13): Probennummern, die in LabelKit storniert sind – keine Proben mehr, nicht offen, nicht gezählt, nicht übernommen. */
export interface Uebersicht {projekt:string;auftrag:{quelle:string;proben:number;hinweise:string[]}|null;berichte:Bericht[];zeilen:Zeile[];storniert:string[];
 zaehler:{erwartet:number|null;ergebnis:number;vorlaeufig:number;offen:number;nichtBeauftragt:number};hinweise:string[]}

/** Was je Probenart im Bericht stehen sollte (grob, nur für einen Hinweis – nie zum Aussortieren). */
const ERWARTET:Record<string,RegExp>={PAK:/pak|pyren|anthen|anthracen|naphthalin|chrysen|fluor|phenanthren|acenaph/i,Chlorid:/chlorid/i,Asbest:/asbest/i};
/** Hinweis, wenn ein Prüfbericht eine Probe nennt, die in LabelKit storniert ist (ab 1.13). */
export function stornoHinweis(label:string,berichte:string[],mitWerten:boolean){
 const b=`Prüfbericht${berichte.length===1?'':'e'} ${berichte.join(', ')}`;
 return mitWerten?`${label} ist in LabelKit storniert – der Laborwert gehört zu keiner offenen Probe (${b}). ResultKit übernimmt ihn nicht; gilt die Probe doch, heb das Storno in LabelKit auf.`
  :`${label} ist in LabelKit storniert, steht aber im ${b} (ohne Messwerte) – gehört zu keiner offenen Probe.`;
}
const gross=(s:string)=>s.toUpperCase();
/** Projektnummer „26.0142“ aus einer Auftragsreferenz. */
const projektnummer=(s:string)=>s.match(/\b\d{2}\.\d{3,6}\b/)?.[0]||'';

export function uebersicht(projekt:string,auftrag:LabReport|null,eingaenge:Eingang[]):Uebersicht{
 const hinweise:string[]=[];
 // 1. Gleicher Bericht mehrfach abgelegt → die Datei mit Messwerten (XML), dann endgültig vor vorläufig, sonst die neuere.
 //    Eine PDF allein (anderer Dateiname als die XML) verdrängt die Werte nicht, sie bleibt als PDF des Berichts genannt.
 //    Ohne Nummer zählt die Datei als eigener Bericht.
 const nachCode=new Map<string,Eingang>(),mitWerten=(e:Eingang)=>e.report.rows.some(row=>row.werte?.length);
 for(const e of eingaenge){const key=e.report.bericht?`b:${norm(e.report.bericht)}`:`d:${e.report.quelle}`;const alt=nachCode.get(key);
  if(!alt){nachCode.set(key,e);continue;}
  const [grund,neuGilt]=mitWerten(e)!==mitWerten(alt)?['die Datei mit Messwerten',mitWerten(e)]:!e.report.vorlaeufig!==!alt.report.vorlaeufig?['der endgültige Bericht',!e.report.vorlaeufig]:['die neuere Datei',e.geaendert>=alt.geaendert];
  hinweise.push(`Prüfbericht ${e.report.bericht} liegt mehrfach im Ordner (${[alt.report.quelle,e.report.quelle].join(', ')}). Es zählt ${grund}.`);
  const [gilt,andere]=neuGilt?[e,alt]:[alt,e];
  const pdf=!mitWerten(andere)&&andere.report.sources.pdf&&!gilt.report.sources.pdf?andere.report.sources.pdf:'';
  if(!pdf){nachCode.set(key,gilt);continue;}
  // XML und PDF mit verschiedenem Dateinamen: wie gemeinsam abgelegt behandeln – auch die Hauptwerte abgleichen (ab 1.6)
  const zusammen:LabReport={...gilt.report,sources:{...gilt.report.sources,pdf},warnings:[...gilt.report.warnings]};if(gilt.report.sources.xml)mitPdfAbgleichen(zusammen,andere.report);
  nachCode.set(key,{...gilt,report:zusammen});}
 const abweichungen=new Map<Bericht,Record<string,Abweichung[]>>();
 const berichte:Bericht[]=[...nachCode.values()].map((e,i)=>{const r=e.report,id=`b${i+1}`;const b:Bericht={id,bericht:r.bericht,labor:r.labor,auftragsreferenz:r.auftragsreferenz,...(r.batch?{batch:r.batch}:{}),sources:{...r.sources},...(r.vorlaeufig?{vorlaeufig:true as const}:{}),...(r.datum?{datum:r.datum}:{}),
  proben:r.rows.map(row=>({...row,label:row.label||referenceLabel(row.ref),bericht:r.bericht,...(row.werte?{werte:row.werte.map(w=>({...w}))}:{})})),geaendert:e.geaendert,hinweise:[...new Set(r.warnings.filter(h=>!h.startsWith(ABGLEICH)))],ohneWerte:!r.rows.some(row=>row.werte?.length)};
  const nr=projektnummer(r.auftragsreferenz);if(projekt&&nr&&nr!==projekt)b.hinweise.push(`Die Auftragsreferenz „${r.auftragsreferenz}“ nennt Projekt ${nr} – dieses Projekt ist ${projekt}. Gehört der Bericht hierher?`);
  if(r.wertAbgleich&&r.sources.xml&&r.sources.pdf){b.wertAbgleich={erkannt:r.wertAbgleich.erkannt,geprueft:r.wertAbgleich.geprueft,abweichend:0};abweichungen.set(b,r.wertAbgleich.abweichend);}
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
 // Abweichungen XML↔PDF nur für Werte, die noch gelten (ein neuerer Bericht kann einzelne Parameter ersetzen)
 for(const [b,alle] of abweichungen){const gilt:Record<string,Abweichung[]>={};
  for(const s of b.proben){const k=norm(s.ref),a=(alle[k]||[]).filter(x=>(s.werte||[]).some(w=>tidy(w.p)===tidy(x.p)&&tidy(w.u)===tidy(x.u)));if(a.length)gilt[k]=a;}
  abweichungen.set(b,gilt);const n=Object.values(gilt).flat().length;b.wertAbgleich!.abweichend=n;
  const h=abgleichHinweis(Object.keys(gilt).map(k=>b.proben.find(s=>norm(s.ref)===k)?.ref||k),n);if(h)b.hinweise.push(h);}
 // 3. Zeilen je Probe: erwartet (LabelKit) ∪ in Berichten. In LabelKit stornierte Proben (ab 1.13) bekommen keine Zeile:
 //    nicht offen, kein Ergebnis, nicht „nicht beauftragt“ – ein Laborwert dafür wird nur gemeldet (Hinweis oben).
 const aktiv=new Set((auftrag?.rows||[]).map(r=>gross(r.label)));
 const storniert=(auftrag?.storniert||[]).filter(l=>!aktiv.has(gross(l))),istStorniert=new Set(storniert.map(gross));
 const stornoImBericht=new Map<string,{berichte:string[];werte:boolean}>();
 const zeilen=new Map<string,Zeile>();
 const zeile=(s:LabSample,erwartet:boolean)=>{const key=s.label||`?${norm(s.ref)||norm(s.labNr)}`;let z=zeilen.get(key);
  if(!z){z={label:s.label,nr:s.label?nummer(s.label):null,ref:tidy(s.ref),desc:tidy(s.desc),...(s.typ?{typ:s.typ}:{}),...(s.art?{art:tidy(s.art)}:{}),...(s.datum?{datum:s.datum}:{}),erwartet,status:'offen',werte:[],berichte:[],hinweise:[]};zeilen.set(key,z);}
  return z;};
 for(const s of auftrag?.rows||[])zeile(s,true);
 for(const b of berichte)for(const s of b.proben){
  if(s.label&&istStorniert.has(gross(s.label))){if(b.ersetztDurch)continue;   // Werte ersetzter Berichte gelten ohnehin nicht
   const e=stornoImBericht.get(gross(s.label))||{berichte:[],werte:false},code=b.bericht||b.sources.xml||b.sources.pdf||'';
   if(code&&!e.berichte.includes(code))e.berichte.push(code);e.werte||=!!s.werte?.length;stornoImBericht.set(gross(s.label),e);continue;}
  const z=zeile(s,false);
  if(!z.berichte.includes(b.bericht))z.berichte.push(b.bericht);
  // Beschreibung: Der Text aus der Laborübergabe kommt wörtlich zurück – weicht er ab, gehört der Wert evtl. zu einer anderen Stelle
  // (umnummeriert, nachträglich geändert). Nur Hinweis; berichtigt wird in LabelKit oder beim Labor, nie hier.
  if(z.erwartet&&beschreibungWeichtAb(z.desc,s.desc,z.art))z.hinweise.push(`Beschreibung: LabelKit „${z.desc}“, Bericht ${b.bericht||b.sources.xml||b.sources.pdf||''} „${tidy(s.desc)}“ – stimmt die Zuordnung? In LabelKit oder beim Labor klären.`);
  if(!z.desc)z.desc=tidy(s.desc);if(!z.art&&s.art)z.art=tidy(s.art);
  if(z.erwartet&&z.datum&&s.datum&&z.datum!==s.datum)z.hinweise.push(`Probenahmedatum: LabelKit ${z.datum}, Bericht ${b.bericht} ${s.datum}.`);
  if(!z.datum&&s.datum)z.datum=s.datum;
  for(const a of abweichungen.get(b)?.[norm(s.ref)]||[])z.hinweise.push(`PDF zeigt einen anderen Wert – ${a.text} (Bericht ${b.bericht}). Bitte mit dem unterschriebenen PDF prüfen; berichtigen kann nur das Labor.`);
  for(const w of s.werte||[])z.werte.push({...w,bericht:b.bericht,vorlaeufig:!!b.vorlaeufig});}
 for(const z of zeilen.values()){
  // Endgültig erst, wenn kein Wert der Probe mehr nur vorläufig ist (z. B. PAK endgültig, Chlorid erst vorläufig → noch vorläufig)
  const vorlaeufigeWerte=z.werte.filter(w=>w.vorlaeufig),endgueltig=z.werte.length>0&&!vorlaeufigeWerte.length;
  z.status=!z.erwartet&&auftrag?'nichtBeauftragt':z.werte.length?(endgueltig?'ergebnis':'vorlaeufig'):z.berichte.length?'ohneWerte':'offen';
  if(z.status==='nichtBeauftragt'&&!z.werte.length)z.hinweise.push('Steht im Bericht, aber ohne Messwerte.');
  if(z.status==='nichtBeauftragt')z.hinweise.push('Nicht im Laborauftrag aus LabelKit – Probennummer prüfen.');
  if(!z.label)z.hinweise.push(`Probenreferenz „${z.ref}“ hat keine Probennummer („Probe 3“).`);
  const muster=z.typ?ERWARTET[z.typ]:undefined;
  if(muster&&z.werte.length&&!z.werte.some(w=>muster.test(w.p)))z.hinweise.push(`${z.typ} beauftragt – der Bericht enthält dazu keinen Wert.`);
  if(z.status==='vorlaeufig')z.hinweise.push(vorlaeufigeWerte.length<z.werte.length
   ?`Nur vorläufige Werte für ${[...new Set(vorlaeufigeWerte.map(w=>w.p))].join(', ')} – der endgültige Bericht fehlt dafür noch.`
   :'Nur vorläufige Werte – der endgültige Bericht fehlt noch.');}
 const liste=[...zeilen.values()].sort((a,b)=>(a.nr??1e9)-(b.nr??1e9)||a.ref.localeCompare(b.ref,'de',{numeric:true}));
 const zahl=(s:Status)=>liste.filter(z=>z.status===s).length;
 for(const l of storniert){const e=stornoImBericht.get(gross(l));if(e)hinweise.push(stornoHinweis(l,e.berichte,e.werte));}
 if(!auftrag)hinweise.push('Kein Laborauftrag aus LabelKit gefunden (Ordner „Laboraufträge“) – welche Proben noch fehlen, lässt sich nicht prüfen.');
 return {projekt,auftrag:auftrag?{quelle:auftrag.quelle,proben:auftrag.rows.length,hinweise:[...auftrag.warnings]}:null,berichte,zeilen:liste,storniert,
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
 vollstaendig:boolean;stand:string;dateien:DateiStand[];auftrag:{quelle:string;proben:{label:string;typ?:string;ref:string;desc:string;surface?:LabSample['surface'];raum?:string}[]}|null;
 berichte:(LabOrigin&{datum?:string;proben:LabSample[]})[];ersetzt:{bericht:string;durch:string[]}[];offen:string[];hinweise:string[]}

/** Inhalt von „_Ergebnisse.json“: nur geltende Werte (ersetzte entfallen), je Bericht mit Herkunft wie in PlanKit. */
export function ergebnisDatei(u:Uebersicht,auftrag:LabReport|null,dateien:DateiStand[],app:string,jetzt=new Date()):ErgebnisDatei{
 // Oberflächenart und Raum kennt nur LabelKit (der Prüfbericht nicht): je Probennummer an die Berichtsproben hängen,
 // damit PlanKit sie auch bei Proben aus dem Prüfbericht übernimmt (Balken am Plan, Raumbuch). Probenart ebenso, falls fehlend.
 const ausAuftrag=new Map((auftrag?.rows||[]).filter(r=>r.label).map(r=>[r.label.toUpperCase(),r]));
 // In LabelKit stornierte Proben (ab 1.13) gehen nicht an PlanKit/FotoKit – auch nicht, wenn ein Bericht noch einen Wert dafür hat (Hinweis in „hinweise“).
 const storniert=new Set((u.storniert||[]).map(gross)),istStorniert=(s:LabSample)=>!!s.label&&storniert.has(gross(s.label));
 const ergaenzt=(s:LabSample)=>{const a=s.label?ausAuftrag.get(s.label.toUpperCase()):undefined;if(!a)return {};
  return {...(!s.typ&&a.typ?{typ:a.typ}:{}),...(!s.surface&&a.surface?{surface:a.surface}:{}),...(!s.raum&&a.raum?{raum:a.raum}:{})};};
 const berichte=u.berichte.filter(b=>!b.ersetztDurch).map(b=>({id:b.id,bericht:b.bericht,labor:b.labor,auftragsreferenz:b.auftragsreferenz,...(b.batch?{batch:b.batch}:{}),sources:{...b.sources},...(b.vorlaeufig?{vorlaeufig:true as const}:{}),...(b.datum?{datum:b.datum}:{}),
  proben:b.proben.filter(s=>(!b.ohneWerte?s.werte?.length:true)&&!istStorniert(s)).map(s=>({...s,...ergaenzt(s),reportId:b.id,werte:(s.werte||[]).map(w=>({...w}))}))}));
 return {format:FORMAT,version:VERSION,projekt:u.projekt,uebernommen:jetzt.toISOString(),app:{name:'ResultKit',version:app},vollstaendig:vollstaendig(u),stand:standKennung(dateien),dateien:[...dateien],
  auftrag:auftrag?{quelle:auftrag.quelle,proben:auftrag.rows.map(r=>({label:r.label,...(r.typ?{typ:r.typ}:{}),ref:r.ref,desc:r.desc,...(r.surface?{surface:r.surface}:{}),...(r.raum?{raum:r.raum}:{})}))}:null,
  berichte,ersetzt:u.berichte.filter(b=>b.ersetztDurch).map(b=>({bericht:b.bericht,durch:b.ersetztDurch!})),
  offen:u.zeilen.filter(z=>z.status==='offen'||z.status==='ohneWerte').map(z=>z.label||z.ref),hinweise:[...u.hinweise,...u.zeilen.flatMap(z=>z.hinweise.map(h=>`${z.label||z.ref}: ${h}`))]};
}

/** Vor ResultKit 1.5 übernommen: die Datei kennt Oberflächenart/Raum aus LabelKit noch nicht, der Laborauftrag hat sie aber. */
export function ohneLage(datei:ErgebnisDatei|null,auftrag:LabReport|null):boolean{
 if(!datei||!auftrag?.rows.some(r=>r.surface||r.raum))return false;
 return !(datei.auftrag?.proben||[]).some(p=>p.surface||p.raum);
}
/** Vor ResultKit 1.10 übernommen: Asbestwerte ohne Nachweisgrenze, obwohl die Prüfberichte sie nennen (für den Asbest-Bericht nötig). */
export function ohneNwg(datei:ErgebnisDatei|null,u:Uebersicht):boolean{
 if(!datei)return false;
 // Je Wert vergleichen (Bericht, Probe, Parameter, Einheit): nur ein gespeicherter Asbestwert ohne NWG, dessen aktueller
 // Gegenpart eine NWG hat, zählt – ein Wert, für den der Bericht keine nennt, löst den Hinweis nicht immer wieder aus.
 const asbest=(w:Wert)=>/asbest/i.test(w.p),key=(bericht:string,probe:string,w:Wert)=>[bericht,probe,tidy(w.p),tidy(w.u)].join('\u0000');
 const mitNwg=new Set<string>();
 for(const z of u.zeilen)for(const w of z.werte)if(asbest(w)&&w.nwg)mitNwg.add(key(w.bericht,z.label||norm(z.ref),w));
 if(!mitNwg.size)return false;
 return datei.berichte.some(b=>b.proben.some(s=>(s.werte||[]).some(w=>asbest(w)&&!w.nwg&&mitNwg.has(key(b.bericht,s.label||norm(s.ref),w)))));
}
/** Vor ResultKit 1.13 übernommen (oder vor dem Storno, ohne dass sich der Dateistand geändert hat): die Datei führt eine Probe,
 *  die in LabelKit storniert ist – als offen, im Laborauftrag oder mit Werten für PlanKit/FotoKit. */
export function mitStorniert(datei:ErgebnisDatei|null,u:Uebersicht):boolean{
 if(!datei||!u.storniert?.length)return false;
 const st=new Set(u.storniert.map(gross)),drin=(l:unknown)=>typeof l==='string'&&st.has(gross(l));
 return (datei.offen||[]).some(drin)||(datei.auftrag?.proben||[]).some(p=>drin(p.label))||datei.berichte.some(b=>(b.proben||[]).some(s=>drin(s.label)));
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
