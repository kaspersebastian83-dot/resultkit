// Ergebnisübersicht: die Laborergebnisse auf einen Blick – je Probenart eine einfache Tabelle mit Probe, Probenahmestelle
// (Bezeichnung aus LabelKit, die auch das Labor übernimmt) und Ergebnis. Reine Daten ohne Browserteile (in Node testbar);
// die Bewertung nach Skala macht main.ts mit denselben Skalen wie in der Prüfansicht.
import type {Zeile} from './ergebnisse';
import type {Wert} from './model';
import {chloridEinheit,labNumber,labQualifier} from './bewertung';

export type Gruppe='PAK'|'Chlorid'|'Asbest'|'Weitere';
export const GRUPPEN:Gruppe[]=['PAK','Chlorid','Asbest','Weitere'];
export interface UZeile {label:string;nr:number|null;stelle:string;
 /** Hauptwert (PAK: Σ16 EPA-PAK, Chlorid: Chlorid); null = noch kein Wert */haupt:Wert|null;
 /** Asbest: Befund wie im Prüfbericht; gefunden = Asbest nachgewiesen */befund:{text:string;gefunden:boolean}|null;
 /** Weitere Proben: bis zu zwei Werte */weitere:Wert[];
 ausstehend:boolean;vorlaeufig:boolean;nichtBeauftragt:boolean;
 /** Prüfberichte, aus denen die gezeigten Werte stammen */berichte:string[];
 /** Chlorid umgerechnet: Wert wie im Bericht, z. B. „45 mg/m²“ */original?:string;
 /** Wert für die Bewertung – wie im Bericht (eine im Projekt angepasste Skala gilt für dessen Einheit) */bewertet:Wert|null}
export interface UGruppe {gruppe:Gruppe;zeilen:UZeile[];einheit:string;mitErgebnis:number}

const SUMME=/^(?:Summe|Σ)\s*16\s*EPA[-– ]?PAK/i,CHLORID=/chlorid/i;
const ASBEST=/asbest|chrysotil|amosit|krokydolith|tremolit|aktinolith|anthophyllit/i;
const POSITIV=/nachgewiesen|positiv|enthalten|gefunden|^ja$|chrysotil|amosit|krokydolith|tremolit|aktinolith|anthophyllit/i;
/** Flächenbezogene Einheit (µg/m², µg/cm², µg/100 cm² …). Liefert das Labor denselben Parameter auch je Probe (z. B. Chlorid
 *  „µg/Probe“ und „µg/cm² berechnet“), gilt der Wert je Fläche – nur er ist bewertbar. */
export const FLAECHE=/\/\s*(?:\d+\s*)?(?:c|d)?m\s*(?:2|²)\s*$/i;
const bevorzugt=<T extends Wert>(werte:T[],re:RegExp):T|null=>{const c=werte.filter(x=>re.test(x.p));return c.find(x=>FLAECHE.test(x.u))||c[0]||null;};
const NEGATIV=/nicht|kein|negativ|n\.\s*n\.|^<|unter/i;

/** Asbestgehalt mit Zahl („5 - 20“ %, „> 1“ %) heißt nachgewiesen; „< 0,1“ oder Text wie „n. n.“ nicht. */
const GEHALT=/^asbestgehalt\b/i,ART=/^asbest(?:art)?\b/i;
const gehaltPositiv=(w:Wert)=>GEHALT.test(w.p.trim())&&/\d/.test(w.r)&&!/^\s*</.test(w.r)&&!NEGATIV.test(w.r.trim());
/** Asbest: Befundtext(e) wie im Bericht; „gefunden“ nur bei eindeutig positivem Wortlaut oder Gehalt (sonst neutral angezeigt).
 *  Eurofins (VDI 3866-5) liefert je Nachweisgrenze „Asbestgehalt“ (%) und „Asbestart“ – nicht untersuchte Stufen als „-“.
 *  Gezeigt wird z. B. „Chrysotil · 5 - 20 %“ bzw. „Kein Asbest nachgewiesen“: Art vor Gehalt, gleiche Texte nur einmal. */
export function asbestBefund(werte:Wert[]):{text:string;gefunden:boolean}|null{
 const a=werte.filter(w=>ASBEST.test(w.p)&&!/^[-–—]?$/.test(w.r.trim()));if(!a.length)return null;   // „Asbestgehalt: -“ weglassen
 const teil=(w:Wert)=>GEHALT.test(w.p.trim())?`${w.r.trim()}${w.u.trim()&&/\d/.test(w.r)?` ${w.u.trim()}`:''}`
  :ART.test(w.p.trim())?w.r.trim():`${w.p.trim()}: ${w.r.trim()}`;   // Mineral (Chrysotil …, Amphibol-Asbest) bleibt genannt
 const sortiert=[...a.filter(w=>!GEHALT.test(w.p.trim())),...a.filter(w=>GEHALT.test(w.p.trim()))];
 const text=[...new Set(sortiert.map(teil))].join(' · ');
 return {text,gefunden:a.some(w=>(POSITIV.test(w.r.trim())&&!NEGATIV.test(w.r.trim()))||gehaltPositiv(w))};
}
function gruppeVon(z:Zeile):Gruppe{
 if(z.typ==='PAK'||z.typ==='Chlorid'||z.typ==='Asbest')return z.typ;
 if(z.typ)return 'Weitere';
 if(z.werte.some(w=>SUMME.test(w.p)))return 'PAK';
 if(z.werte.some(w=>CHLORID.test(w.p)))return 'Chlorid';
 if(z.werte.some(w=>ASBEST.test(w.p)))return 'Asbest';
 return 'Weitere';
}
/** Chlorid einheitlich in µg/cm² (ältere Berichte in mg/m²: 1 µg/cm² = 10 mg/m²); „< 0,5“ bleibt „< 0,05“, „> 500“ wird „> 50“.
 *  Was sich nicht sicher umrechnen lässt („(3)“, „1.250“), bleibt wie im Bericht (null = nicht umgerechnet). */
export function chloridInUgCm2(w:Wert):Wert|null{
 const f=chloridEinheit(w.u);if(!f)return null;if(f===1)return {...w,u:'µg/cm²'};
 const zahl=(x:number)=>x.toLocaleString('de-DE',{maximumFractionDigits:4});
 const loq=w.loq&&Number.isFinite(labNumber(w.loq))?{loq:zahl(labNumber(w.loq)/f)}:{};
 const m=/^([<>])?\s*(.*)$/.exec(w.r.trim())!,n=labNumber(m[2]);
 if(Number.isFinite(n)&&n>=0)return {p:w.p,r:`${m[1]?`${m[1]} `:''}${zahl(n/f)}`,u:'µg/cm²',...loq};
 const q=labQualifier(w.r);
 if(!/\d/.test(w.r)&&(q==='below'||q==='notDetected'||q==='notDetermined'))return {p:w.p,r:w.r,u:'µg/cm²',...loq};   // „unter BG“, „n. n.“: Text bleibt, Einheit und BG umgerechnet
 return null;
}
/** Wert einer Probe für Parameter/Einheit. Eurofins wiederholt Parameter (Asbest nach VDI 3866-5 je Nachweisgrenze,
 *  nicht untersuchte Stufen „-“): ein Wert mit Inhalt geht vor „-“. */
export function wertFuer<T extends Wert>(werte:T[],p:string,u:string):T|undefined{
 const c=werte.filter(x=>x.p===p&&x.u===u);return c.find(x=>!/^[-–—]?$/.test(x.r.trim()))||c[0];
}
/** Zeilen der Prüfung → Gruppen der Übersicht (leere Gruppen fallen weg). */
export function uebersichtGruppen(zeilen:Zeile[]):UGruppe[]{
 const map=new Map<Gruppe,UZeile[]>();
 for(const z of zeilen){
  const g=gruppeVon(z),w=z.werte;
  const roh=g==='PAK'?bevorzugt(w,SUMME):g==='Chlorid'?bevorzugt(w,CHLORID):null;
  const um=g==='Chlorid'&&roh?chloridInUgCm2(roh):null,haupt=um||roh;
  const gezeigt=roh?[roh]:g==='Asbest'?w.filter(x=>ASBEST.test(x.p)):g==='Weitere'?w.slice(0,2):[];
  const u:UZeile={label:z.label||z.ref,nr:z.nr,stelle:z.desc||z.ref,haupt:haupt?{p:haupt.p,r:haupt.r,u:haupt.u,...(haupt.loq?{loq:haupt.loq}:{})}:null,
   befund:g==='Asbest'?asbestBefund(w):null,weitere:g==='Weitere'?w.slice(0,2).map(x=>({p:x.p,r:x.r,u:x.u})):[],   // PAK/Chlorid ohne Hauptwert: nichts Fremdes in die Spalte
   ausstehend:z.status==='offen'||z.status==='ohneWerte',vorlaeufig:z.status==='vorlaeufig',nichtBeauftragt:z.status==='nichtBeauftragt',
   berichte:[...new Set(gezeigt.map(x=>x.bericht).filter(Boolean))],bewertet:roh?{p:roh.p,r:roh.r,u:roh.u,...(roh.loq?{loq:roh.loq}:{})}:null,...(um&&roh&&roh.u!==um.u?{original:`${roh.r} ${roh.u}`}:{})};
  map.set(g,[...(map.get(g)||[]),u]);
 }
 return GRUPPEN.filter(g=>map.has(g)).map(g=>{const z=map.get(g)!;const einheiten=z.map(x=>x.haupt?.u).filter(Boolean) as string[];
  const einheit=einheiten.sort((a,b)=>einheiten.filter(x=>x===b).length-einheiten.filter(x=>x===a).length)[0]||'';
  return {gruppe:g,zeilen:z,einheit,mitErgebnis:z.filter(x=>!x.ausstehend).length};});
}

/** Geschoss aus der Probenbezeichnung (von groß nach klein, z. B. „Haus A 1OG Bad Wand B“): KG/UG < EG < 1.OG … < DG. */
const GESCHOSS=/^(?:(UG|KG|Keller(?:geschoss)?|EG|Erdgeschoss|DG|Dach(?:geschoss)?|Spitzboden|Außen(?:bereich)?)|(\d{1,2})\.?\s?OG|OG\s?(\d{1,2})|(OG))$/i;
function geschoss(text:string){
 const w=text.replace(/(\d{1,2})\.\s+OG\b/gi,'$1.OG').replace(/\bOG\s+(\d{1,2})\b/gi,'OG$1').split(/[\s,·]+/);   // „1. OG“, „OG 2“ zusammenhalten
 for(let i=0;i<w.length;i++){
  const m=GESCHOSS.exec(w[i]);if(!m)continue;
  const n=m[1]?.toUpperCase();const rang=m[2]||m[3]?1+Number(m[2]||m[3]):m[4]?2:n?(/^(UG|KG|KELLER)/.test(n)?0:n==='EG'||n==='ERDGESCHOSS'?1:/^(DG|DACH|SPITZBODEN)/.test(n)?50:60):40;
  return {vor:w.slice(0,i).join(' '),rang,rest:w.slice(i+1).join(' ')};}
 return {vor:'',rang:70,rest:text};   // ohne Geschoss: ans Ende
}
/** Vergleich nach Ort: Gebäude, Geschoss (unten nach oben), dann Raum/Bauteil wie geschrieben. Ohne Geschoss ans Ende. */
export function ortVergleich(a:string,b:string){
 const x=geschoss(a),y=geschoss(b),ohne=(g:{rang:number})=>g.rang===70?1:0;
 return ohne(x)-ohne(y)||x.vor.localeCompare(y.vor,'de',{numeric:true})||x.rang-y.rang||x.rest.localeCompare(y.rest,'de',{numeric:true});
}
/** Sortierung nach Ort: Gebäude, Geschoss (unten nach oben), dann Raum/Bauteil wie geschrieben; sonst nach Probennummer. */
export function sortiere(zeilen:UZeile[],nach:'ort'|'nr'):UZeile[]{
 const nr=(z:UZeile)=>z.nr??1e9;
 if(nach==='nr')return [...zeilen].sort((a,b)=>nr(a)-nr(b)||a.label.localeCompare(b.label,'de',{numeric:true}));
 return [...zeilen].sort((a,b)=>ortVergleich(a.stelle,b.stelle)||nr(a)-nr(b));
}

/* ---------- Übersicht nach Probenahmestelle (ab 1.4.0) ----------
   Eine Zeile je Probenahmestelle, eine Spalte je Probenart: PAK und Chlorid derselben Stelle stehen nebeneinander.
   Nur lesen – Werte und Bezeichnungen kommen unverändert aus Prüfbericht und LabelKit. */
export interface MZeile {key:string;stelle:string;zellen:Partial<Record<Gruppe,UZeile>>;labels:string[];nr:number|null}
/** Beschreibungsteile, die nicht zur Stelle gehören: Fläche (cm²), Tiefe. */
const NEBEN=/^(?:\d+(?:[.,]\d+)?\s*cm\s*(?:²|2)|tiefe\s*:.*)$/i;
/** Attribute nach der Stelle (Beaufschlagung, Oberflächenart): zählen für „gleiche Stelle“ nicht. */
const ATTRIBUT=new Set(['verrußt','verrusst','leicht','stark','gereinigt','ungereinigt','aufsicht','ansicht','untersicht']);
const MIT=new Set(['belag','ruß','russ','kondensat','staub']);
/** Stelle zum Anzeigen: Beschreibung ohne Fläche und Tiefe. */
export function stelleText(desc:string){const t=String(desc||'').split(',').map(x=>x.trim()).filter(x=>x&&!NEBEN.test(x)).join(', ');return t||String(desc||'').trim();}
/** Schlüssel „gleiche Stelle“: Groß-/Kleinschreibung, Satzzeichen, Fläche/Tiefe und Attribute (verrußt, Ansicht …) zählen nicht. */
export function stelleKey(desc:string){
 const w=stelleText(desc).toLowerCase().replace(/[,;·/()]+/g,' ').split(/\s+/).filter(Boolean),out:string[]=[];
 for(let i=0;i<w.length;i++){if(ATTRIBUT.has(w[i]))continue;if(w[i]==='mit'&&MIT.has(w[i+1]||'')){i++;continue;}out.push(w[i]);}
 return out.join(' ').replace(/(\d+)\s*\.\s*og\b/g,'$1.og');
}
/** Gruppen → Zeilen je Stelle. Zwei Proben derselben Art an derselben Stelle bleiben getrennte Zeilen. */
export function matrix(gruppen:UGruppe[]):MZeile[]{
 const rows:MZeile[]=[],byKey=new Map<string,MZeile[]>();
 for(const g of gruppen)for(const z of g.zeilen){
  const key=stelleKey(z.stelle);let row=key?(byKey.get(key)||[]).find(r=>!r.zellen[g.gruppe]):undefined;
  if(!row){row={key:`${key||z.label}#${rows.length}`,stelle:stelleText(z.stelle),zellen:{},labels:[],nr:null};rows.push(row);if(key)byKey.set(key,[...(byKey.get(key)||[]),row]);}
  row.zellen[g.gruppe]=z;row.labels.push(z.label);if(z.nr!==null&&(row.nr===null||z.nr<row.nr))row.nr=z.nr;
 }
 return rows;
}
export type MSpalte='probe'|'stelle'|Gruppe;
/** Wert einer Zelle zum Sortieren: Messwert als Zahl, < BG / n. n. kleiner als jeder Messwert; leer oder offen = null (immer ans Ende). */
export function sortWert(g:Gruppe,z:UZeile|undefined):number|string|null{
 if(!z||z.ausstehend)return null;
 if(g==='Asbest')return z.befund?(z.befund.gefunden?1:0):null;
 const w=g==='Weitere'?z.weitere[0]:z.haupt;if(!w)return null;
 const q=labQualifier(w.r);if(q==='below'||q==='notDetected')return -1;
 const n=labNumber(w.r);return Number.isFinite(n)?n:w.r;
}
/** Sortierung wie in Excel: auf-/absteigend, leere Zellen immer zuletzt; bei Gleichstand nach Ort. */
export function sortiereMatrix(rows:MZeile[],spalte:MSpalte,auf:boolean):MZeile[]{
 const nr=(r:MZeile)=>r.nr??1e9,ort=(a:MZeile,b:MZeile)=>ortVergleich(a.stelle,b.stelle)||nr(a)-nr(b),d=auf?1:-1;
 if(spalte==='stelle')return [...rows].sort((a,b)=>d*ort(a,b));
 if(spalte==='probe')return [...rows].sort((a,b)=>d*(nr(a)-nr(b)||a.labels[0].localeCompare(b.labels[0],'de',{numeric:true})));
 return [...rows].sort((a,b)=>{const x=sortWert(spalte,a.zellen[spalte]),y=sortWert(spalte,b.zellen[spalte]);
  if(x===null||y===null)return (x===null?1:0)-(y===null?1:0)||ort(a,b);
  const c=typeof x==='number'&&typeof y==='number'?x-y:typeof x==='number'?-1:typeof y==='number'?1:String(x).localeCompare(String(y),'de',{numeric:true});
  return d*c||ort(a,b);});
}
export const SPALTE_TITEL:Record<Gruppe,string>={PAK:'Σ16 EPA-PAK',Chlorid:'Chlorid',Asbest:'Asbest',Weitere:'Weitere'};
/** Zelle als Text für Excel/Word: Wert wie im Bericht, Einheit nur wenn sie von der Spalte abweicht. */
export function zelleText(g:Gruppe,z:UZeile|undefined,einheit:string){
 if(!z)return '';if(z.ausstehend)return 'ausstehend';
 if(g==='Asbest')return z.befund?.text||'';
 if(g==='Weitere')return z.weitere.map(w=>`${w.p} ${w.r}${w.u?` ${w.u}`:''}`).join(' · ');
 return z.haupt?`${z.haupt.r}${z.haupt.u&&z.haupt.u!==einheit?` ${z.haupt.u}`:''}`:'';
}
/** Tabelle zum Kopieren: Kopf und Zeilen (nur Werte, keine Farben oder Hinweise). */
export function tabelleDaten(rows:MZeile[],gruppen:UGruppe[]):{kopf:string[];zeilen:string[][]}{
 const kopf=['Probe','Probenahmestelle',...gruppen.map(g=>`${SPALTE_TITEL[g.gruppe]}${g.einheit&&(g.gruppe==='PAK'||g.gruppe==='Chlorid')?` (${g.einheit})`:''}`)];
 return {kopf,zeilen:rows.map(r=>[r.labels.join(', '),r.stelle,...gruppen.map(g=>zelleText(g.gruppe,r.zellen[g.gruppe],g.einheit))])};
}
/** Tabulatorgetrennt: Excel übernimmt das in Zellen. */
export function alsTSV(d:{kopf:string[];zeilen:string[][]}){const c=(x:string)=>x.replace(/[\t\r\n]+/g,' ');return [d.kopf,...d.zeilen].map(r=>r.map(c).join('\t')).join('\r\n');}
