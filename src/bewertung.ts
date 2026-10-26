// Bewertung von Laborwerten – unverändert aus PlanKit (src/results.ts): Zahlen lesen, BG/n. n./n. b., VdS-Referenz, Büro-Skalen.
// ResultKit zeigt nur an; Skalen werden in FotoKit/PlanKit gepflegt (gleicher Speicher, _Spektron-Skalen.json im Archivordner).
// Die Skalen sind dieselben wie in FotoKits „Ergebnistabelle“ (gleicher Browser-Speicher „bu-scales“ unter
// kaspersebastian83-dot.github.io): je Parameter und Einheit eine Liste von Kategorien mit „ab“-Wert.
// Für die Karte wird die Skala zusätzlich mit Farben im Projekt gespeichert, damit Kollegen dieselbe Karte sehen.
import {skalaTeilen} from './skalen-archiv.js';
import type {ResultSettings,Scale} from './model';

export const UNRATED='#c3ccd5';
const AUTO=['#4caf50','#f2c94c','#f2994a','#e0453a','#8e2424'];
/** Farben nach Reihenfolge: unterste Kategorie grün, oberste rot. */
export function autoColors(n:number):string[]{
  if(n<=1)return [AUTO[0]];if(n===2)return [AUTO[0],AUTO[3]];if(n===3)return [AUTO[0],AUTO[1],AUTO[3]];if(n===4)return AUTO.slice(0,4);
  return Array.from({length:n},(_,i)=>AUTO[Math.round(i*(AUTO.length-1)/(n-1))]);
}
export const scaleKey=(parameter:string,unit:string)=>`${parameter}|${unit}`;
/** Strict locale-independent parsing. A single separator followed by three digits
 * (1.234 / 1,234) is ambiguous without a declared locale: leave it unrated. */
export function labNumber(raw:string):number{
 const t=String(raw??'').trim().replace(/−/g,'-');
 const match=t.match(/^([+-]?)([\d., \u00a0\u202f]+)([eE][+-]?\d+)?$/);if(!match)return NaN;
 let body=match[2].trim();const exponent=match[3]||'';
 if(/[ \u00a0\u202f]/.test(body)){
  if(!/^\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?$/.test(body))return NaN;
  body=body.replace(/[ \u00a0\u202f]/g,'').replace(',','.');
 }else if(body.includes('.')&&body.includes(',')){
  const decimal=body.lastIndexOf('.')>body.lastIndexOf(',')?'.':',',group=decimal==='.'?',':'.';
  const parts=body.split(decimal);if(parts.length!==2||!/^\d+$/.test(parts[1])||!new RegExp('^\\d{1,3}(?:\\'+group+'\\d{3})+$').test(parts[0]))return NaN;
  body=parts[0].split(group).join('')+'.'+parts[1];
 }else if(/[.,]/.test(body)){
  const parts=body.split(/[.,]/);
  if(parts.length===2){if(!/^\d+$/.test(parts[0])||!/^\d+$/.test(parts[1])||(parts[1].length===3&&/^[1-9]\d{0,2}$/.test(parts[0])))return NaN;body=parts.join('.');}
  else {if(!/^\d{1,3}([.,])\d{3}(?:\1\d{3})+$/.test(body))return NaN;body=parts.join('');}
 }
 const v=Number(match[1]+body+exponent);return Number.isFinite(v)?v:NaN;
}
export type LabQualifier='measured'|'below'|'notDetected'|'notDetermined'|'unrated';
/** Interpret qualifiers separately; never turn them into a measured number. */
export function labQualifier(raw:string):LabQualifier{
 let t=String(raw??'').trim();if(t.startsWith('(')&&t.endsWith(')'))t=t.slice(1,-1).trim();
 if(/^unter\s+BG$/i.test(t))return 'below';
 if(/^n\.\s*n\.$/i.test(t))return 'notDetected';
 if(/^n\.\s*b\.$/i.test(t))return 'notDetermined';
 if(t.startsWith('<')){const limit=labNumber(t.slice(1));return Number.isFinite(limit)&&limit>=0?'below':'unrated';}
 return Number.isFinite(labNumber(raw))?'measured':'unrated';
}
export const belowLimit=(raw:string)=>labQualifier(raw)==='below';
export const BELOW_LIMIT='#749bb5';
export const NOT_DETECTED='#8b83a8';
export const NOT_DETERMINED='#9d8975';
/** Nutzung aus _Projekt.json (Feld der Projektzentrale). Wählt beim ersten Anlegen der Ergebniskarte die VdS-Referenz vor
 *  und benennt die Skala; eine später in PlanKit gewählte Referenz bleibt. Unbekannte Werte wählen nichts vor. */
let nutzung='';
export function setNutzung(value:unknown){nutzung=typeof value==='string'?value.trim():'';}
export const getNutzung=()=>nutzung;
const RESIDENTIAL=['Wohnen','Büro','Öffentlich','Gesundheit & Labor'],INDUSTRIAL=['Gewerbe/Industrie','Landwirtschaft'];
export function usageFromNutzung(value=nutzung):ResultSettings['usage']{return RESIDENTIAL.includes(value)?'residential':INDUSTRIAL.includes(value)?'industrial':undefined;}
/** VdS 2357 background references; only Σ16 EPA-PAK in surface units.
 * Source: LANUV, Bericht Steinhagen 15.02.2023, p. 7 (see README). */
export function vdsScale(parameter:string,unit:string,usage:ResultSettings['usage']):Scale|undefined{
 if(!usage||!(/^(?:Summe|Σ)\s*16\s*EPA[-– ]PAK(?:\s.*)?$/i.test(parameter)))return;
 const u=unit.replace(/μ/g,'µ').replace(/²/g,'2').replace(/\s+/g,'').toLowerCase();
 const factor=({'µg/m2':1,'µg/100cm2':.01,'mg/m2':.001,'ng/m2':1000} as Record<string,number>)[u];if(!factor)return;
 const limit=(usage==='residential'?10:100)*factor;
 const label=usage==='industrial'?'Industrie':nutzung==='Gesundheit & Labor'?'Gesundheit & Labor, Referenz < 10 µg/m²':'Wohn-/Büroräume';
 return {name:`VdS 2357 · ${label} · Hintergrundreferenz`,cats:[{name:'unter Referenzwert',from:0,color:'#4caf50'},{name:'Referenzwert erreicht/überschritten',from:limit,color:'#e0453a'}]};
}
export function shortParameter(p:string){return p.replace(/^Summe 16 EPA-PAK.*$/i,'Σ16 EPA-PAK').replace(/^Benzo\[a\]pyren$/i,'BaP');}

/** Index der Kategorie: letzte Kategorie, deren „ab“-Wert erreicht ist (wie in FotoKit). */
export function rate(scale:Scale|undefined,value:number){if(!scale?.cats.length||!Number.isFinite(value)||value<0)return -1;let index=0;scale.cats.forEach((c,i)=>{if(i>0&&value>=c.from)index=i;});return index;}

type Shared=Record<string,{name?:string;cats?:{name:string;from:number}[];geaendert?:string}>;
export function sharedScales():Shared{try{const v=JSON.parse(localStorage.getItem('bu-scales')||'{}');return v&&typeof v==='object'?v:{};}catch{return {};}}
export function saveShared(key:string,scale:Scale|null){try{const all=sharedScales();if(scale)all[key]={name:scale.name,cats:scale.cats.map(c=>({name:c.name,from:c.from})),geaendert:new Date().toISOString()};else delete all[key];localStorage.setItem('bu-scales',JSON.stringify(all));
  void skalaTeilen(key,scale?all[key]:null);   // fürs ganze Büro: <Archivordner>/_Spektron-Skalen.json (wie FotoKit)
 }catch{/* Speicher nicht verfügbar */}}
/** Skala aus FotoKit übernehmen (mit automatischen Farben), falls vorhanden. */
export function fromShared(key:string):Scale|null{
  const s=sharedScales()[key];const cats=(s?.cats||[]).filter(c=>c&&typeof c.name==='string'&&c.name.trim()).map((c,i)=>({name:c.name.trim().slice(0,60),from:i===0?0:Number(c.from)})).filter(c=>Number.isFinite(c.from)&&c.from>=0).sort((a,b)=>a.from-b.from).slice(0,12);
  if(!cats.length)return null;cats[0].from=0;const colors=autoColors(cats.length);return {name:String(s?.name||'').slice(0,160),cats:cats.map((c,i)=>({...c,color:colors[i]}))};
}
/** Eine Regel für Ergebniskarte, Raumbuch, Anlage und Wandansicht: Ist eine Nutzung gewählt und gibt es für Parameter
 *  und Einheit eine VdS-Referenz, gilt sie – außer sie wurde im Projekt angepasst. Sonst gilt die eigene Skala des Projekts.
 *  Beide bleiben bearbeitbar; keine Skala wird erfunden. */
export function scaleFor(settings:ResultSettings|undefined,parameter:string,unit:string):{scale?:Scale;vds?:Scale;angepasst:boolean}{
  const key=scaleKey(parameter,unit),vds=settings?.usage?vdsScale(parameter,unit,settings.usage):undefined;
  if(vds){const eigen=settings?.vds?.[key];return {scale:eigen||vds,vds,angepasst:!!eigen};}
  return {scale:settings?.scales?.[key],angepasst:false};
}
export function rangeText(scale:Scale,i:number,unit:string){const c=scale.cats[i],next=scale.cats[i+1],n=(v:number)=>v.toLocaleString('de-DE');return next?(i===0?`< ${n(next.from)} ${unit}`:`${n(c.from)} – < ${n(next.from)} ${unit}`):(i===0?`alle Werte`:`≥ ${n(c.from)} ${unit}`);}
/** Gut lesbare Schriftfarbe auf einer Füllfarbe. */
export function ink(color:string){const n=parseInt(color.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;return (r*299+g*587+b*114)/1000>150?'#1d2a33':'#ffffff';}
