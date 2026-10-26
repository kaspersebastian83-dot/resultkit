// Ergebnisübersicht: die Laborergebnisse auf einen Blick – je Probenart eine einfache Tabelle mit Probe, Probenahmestelle
// (Bezeichnung aus LabelKit, die auch das Labor übernimmt) und Ergebnis. Reine Daten ohne Browserteile (in Node testbar);
// die Bewertung nach Skala macht main.ts mit denselben Skalen wie in der Prüfansicht.
import type {Zeile} from './ergebnisse';
import type {Wert} from './model';
import {chloridEinheit,labNumber} from './bewertung';

export type Gruppe='PAK'|'Chlorid'|'Asbest'|'Weitere';
export const GRUPPEN:Gruppe[]=['PAK','Chlorid','Asbest','Weitere'];
export interface UZeile {label:string;nr:number|null;stelle:string;
 /** Hauptwert (PAK: Σ16 EPA-PAK, Chlorid: Chlorid); null = noch kein Wert */haupt:Wert|null;
 /** Asbest: Befund wie im Prüfbericht; gefunden = Asbest nachgewiesen */befund:{text:string;gefunden:boolean}|null;
 /** Weitere Proben: bis zu zwei Werte */weitere:Wert[];
 ausstehend:boolean;vorlaeufig:boolean;nichtBeauftragt:boolean;
 /** Prüfberichte, aus denen die gezeigten Werte stammen */berichte:string[];
 /** Chlorid umgerechnet: Wert wie im Bericht, z. B. „45 mg/m²“ */original?:string}
export interface UGruppe {gruppe:Gruppe;zeilen:UZeile[];einheit:string;mitErgebnis:number}

const SUMME=/^(?:Summe|Σ)\s*16\s*EPA[-– ]?PAK/i,CHLORID=/chlorid/i;
const ASBEST=/asbest|chrysotil|amosit|krokydolith|tremolit|aktinolith|anthophyllit/i;
const POSITIV=/nachgewiesen|positiv|enthalten|gefunden|^ja$|chrysotil|amosit|krokydolith|tremolit|aktinolith|anthophyllit/i;
const NEGATIV=/nicht|kein|negativ|n\.\s*n\.|^<|unter/i;

/** Asbest: Befundtext(e) wie im Bericht; „gefunden“ nur bei eindeutig positivem Wortlaut (sonst neutral angezeigt). */
export function asbestBefund(werte:Wert[]):{text:string;gefunden:boolean}|null{
 const a=werte.filter(w=>ASBEST.test(w.p));if(!a.length)return null;
 const text=a.length===1?a[0].r:a.map(w=>`${w.p}: ${w.r}`).join(' · ');
 return {text,gefunden:a.some(w=>POSITIV.test(w.r.trim())&&!NEGATIV.test(w.r.trim()))};
}
function gruppeVon(z:Zeile):Gruppe{
 if(z.typ==='PAK'||z.typ==='Chlorid'||z.typ==='Asbest')return z.typ;
 if(z.typ)return 'Weitere';
 if(z.werte.some(w=>SUMME.test(w.p)))return 'PAK';
 if(z.werte.some(w=>CHLORID.test(w.p)))return 'Chlorid';
 if(z.werte.some(w=>ASBEST.test(w.p)))return 'Asbest';
 return 'Weitere';
}
/** Chlorid einheitlich in µg/cm² (ältere Berichte in mg/m²: 1 µg/cm² = 10 mg/m²); „< 0,5“ bleibt „< 0,05“. */
export function chloridInUgCm2(w:Wert):Wert|null{
 const f=chloridEinheit(w.u);if(!f)return null;if(f===1)return {...w,u:'µg/cm²'};
 const m=/^(<\s*)?(.*)$/.exec(w.r.trim())!,n=labNumber(m[2]);if(!Number.isFinite(n))return null;
 const zahl=(x:number)=>x.toLocaleString('de-DE',{maximumFractionDigits:4});
 return {p:w.p,r:`${m[1]?'< ':''}${zahl(n/f)}`,u:'µg/cm²',...(w.loq&&Number.isFinite(labNumber(w.loq))?{loq:zahl(labNumber(w.loq)/f)}:{})};
}
/** Zeilen der Prüfung → Gruppen der Übersicht (leere Gruppen fallen weg). */
export function uebersichtGruppen(zeilen:Zeile[]):UGruppe[]{
 const map=new Map<Gruppe,UZeile[]>();
 for(const z of zeilen){
  const g=gruppeVon(z),w=z.werte;
  const roh=g==='PAK'?(w.find(x=>SUMME.test(x.p))||null):g==='Chlorid'?(w.find(x=>CHLORID.test(x.p))||null):null;
  const um=g==='Chlorid'&&roh?chloridInUgCm2(roh):null,haupt=um||roh;
  const gezeigt=roh?[roh]:g==='Asbest'?w.filter(x=>ASBEST.test(x.p)):g==='Weitere'?w.slice(0,2):[];
  const u:UZeile={label:z.label||z.ref,nr:z.nr,stelle:z.desc||z.ref,haupt:haupt?{p:haupt.p,r:haupt.r,u:haupt.u,...(haupt.loq?{loq:haupt.loq}:{})}:null,
   befund:g==='Asbest'?asbestBefund(w):null,weitere:g==='Weitere'?w.slice(0,2).map(x=>({p:x.p,r:x.r,u:x.u})):[],   // PAK/Chlorid ohne Hauptwert: nichts Fremdes in die Spalte
   ausstehend:z.status==='offen'||z.status==='ohneWerte',vorlaeufig:z.status==='vorlaeufig',nichtBeauftragt:z.status==='nichtBeauftragt',
   berichte:[...new Set(gezeigt.map(x=>x.bericht).filter(Boolean))],...(um&&roh&&roh.u!==um.u?{original:`${roh.r} ${roh.u}`}:{})};
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
/** Sortierung nach Ort: Gebäude, Geschoss (unten nach oben), dann Raum/Bauteil wie geschrieben; sonst nach Probennummer. */
export function sortiere(zeilen:UZeile[],nach:'ort'|'nr'):UZeile[]{
 const nr=(z:UZeile)=>z.nr??1e9;
 if(nach==='nr')return [...zeilen].sort((a,b)=>nr(a)-nr(b)||a.label.localeCompare(b.label,'de',{numeric:true}));
 const k=new Map(zeilen.map(z=>[z,geschoss(z.stelle)]));
 return [...zeilen].sort((a,b)=>{const x=k.get(a)!,y=k.get(b)!;return x.vor.localeCompare(y.vor,'de',{numeric:true})||x.rang-y.rang||x.rest.localeCompare(y.rest,'de',{numeric:true})||nr(a)-nr(b);});
}
