// ResultKit – Laborergebnisse eines Projekts an einer Stelle: was LabelKit ans Labor übergeben hat („Laboraufträge“),
// was an Prüfberichten im Ordner „Laborergebnisse“ liegt, was noch fehlt. „Ergebnisse übernehmen“ schreibt die geprüften
// Werte nach „Laborergebnisse/_Ergebnisse.json“ – PlanKit, FotoKit und die Projektzentrale lesen nur noch diese Datei.
// Alles bleibt lokal: ResultKit liest und schreibt nur im gewählten Projektordner.
import './style.css';
import './suite-bar';
import {skalenAbgleich} from './skalen-archiv.js';
import {readLabFiles,reportWarnings,type LabReport} from './labreport';
import {labelkitReport} from './labelkit';
import {uebersicht,standText,vollstaendig,ergebnisDatei,liesErgebnisDatei,standKennung,DATEI,type Uebersicht,type Eingang,type DateiStand,type ErgebnisDatei,type Zeile,type Bericht,type Status} from './ergebnisse';
import {archiv,permission,findSubdir,fileInfo,listFiles,writeFile,readProjectData,openFolder,projectDirOf,pickFolder,supported,LABOR,AUFTRAEGE,PLAENE,type Dir,type ProjectFolder} from './ordner';
import {labQualifier,labNumber,rate,scaleFor,scaleKey,fromShared,shortParameter,setNutzung,getNutzung,usageFromNutzung,autoColors,rangeText,ink,BELOW_LIMIT,NOT_DETECTED,NOT_DETERMINED,UNRATED} from './bewertung';
import type {ResultSettings,Scale,Wert} from './model';
import {uebersichtGruppen,sortiere,type UGruppe,type UZeile,type Gruppe} from './uebersicht';

export const APP_VERSION='1.2.0';
const VORHER='_Ergebnisse.vorher.json';

// ---- Projektübergabe: #projekt=<Ordnername> (Spektron-Leiste, Projektzentrale); alte ?projekt-Links werden bereinigt ----
const PROJEKT_URL=(()=>{
 const start=new URL(location.href);
 const projekt=new URLSearchParams(start.hash.slice(1)).get('projekt')??start.searchParams.get('projekt');
 function setzen(name:string|null){
  const url=new URL(location.href);
  const teile=url.hash.slice(1).split('&').filter(t=>t&&!new URLSearchParams(t).has('projekt'));
  if(name!==null)teile.push('projekt='+encodeURIComponent(name));
  url.searchParams.delete('projekt');url.hash=teile.join('&');
  if(url.href!==location.href)try{history.replaceState(history.state,'',url);}catch{/* file:// o. Ä. */}
 }
 if(start.searchParams.has('projekt'))setzen(projekt);
 return {projekt,setzen,lesen:()=>new URLSearchParams(location.hash.slice(1)).get('projekt')};
})();

const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const datum=(iso?:string)=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');return m?`${m[3]}.${m[2]}.${m[1]}`:(iso||'');};
const uhr=(t:number|string)=>new Date(t).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const meldung=(e:unknown)=>e instanceof Error?e.message:String(e);

document.querySelector<HTMLDivElement>('#app')!.innerHTML=`
<header class="kopf">
 <a class="marke" href="./" aria-label="ResultKit Start"><span class="marke-icon" aria-hidden="true">◧</span><span>ResultKit</span><small>Laborergebnisse</small></a>
 <span id="app-version" class="version">v${APP_VERSION}</span>
 <span id="projekt-badge" class="projekt-badge" hidden></span>
 <span class="kopf-aktionen">
  <button id="btn-projekt" type="button" title="Projektordner wählen (z. B. „26.0123 Köln“)">📁 Projekt</button>
  <button id="btn-import" type="button" disabled title="Prüfberichte (Eurofins-XML und PDF) in „${LABOR}“ ablegen">📥 Berichte importieren</button>
  <button id="btn-neu" type="button" disabled title="Ordner neu einlesen">⟳ Neu einlesen</button>
  <a class="hilfe-link" href="../aidkit/#app-resultkit" target="aidkit" rel="noopener" title="Kapitel ResultKit – öffnet das Handbuch (AidKit) in einem eigenen Fenster">📘 Hilfe</a>
 </span>
</header>
<main id="inhalt">
 <section id="start" class="start">
  <span class="eyebrow">LABORERGEBNISSE IM PROJEKT</span>
  <h1>Was ist beim Labor, was ist zurück, was fehlt?</h1>
  <p>ResultKit vergleicht die Laborübergabe aus LabelKit (Ordner „${AUFTRAEGE}“) mit den Prüfberichten im Ordner „${LABOR}“.
   Neue Berichte (Eurofins-XML und PDF) importieren Sie hier; nach der Prüfung übernimmt „Ergebnisse übernehmen“ die Werte für PlanKit, FotoKit und die Projektzentrale.</p>
  <div id="ordner-frage" class="ordner-frage" hidden><p id="ordner-frage-text"></p><button id="ordner-erlauben" type="button" class="primary">Zugriff erlauben und Projekt öffnen</button></div>
  <p id="start-hinweis" class="hinweis" hidden></p>
  <button id="start-projekt" type="button" class="primary">📁 Projektordner öffnen</button>
  <p class="muted klein">Aus der Projektzentrale oder über die Spektron-Leiste öffnet ResultKit das Projekt direkt. Alles bleibt auf diesem Rechner.</p>
 </section>
 <div id="projekt" hidden>
  <div class="ansicht-wahl" role="tablist" aria-label="Ansicht">
   <button type="button" role="tab" id="tab-uebersicht" aria-selected="true" aria-controls="ansicht-uebersicht">Übersicht</button>
   <button type="button" role="tab" id="tab-pruefung" aria-selected="false" aria-controls="ansicht-pruefung">Prüfung und Import<span id="tab-punkt" class="tab-punkt" hidden title="Hier gibt es etwas zu tun"></span></button>
  </div>
  <div id="ansicht-uebersicht" role="tabpanel" aria-labelledby="tab-uebersicht">
   <div id="u-uebernahme"></div>
   <div id="u-kacheln" class="u-kacheln"></div>
   <div class="u-filter"><span class="u-chips" role="group" aria-label="Filter"><button type="button" data-filter="alle">Alle</button><button type="button" data-filter="auff">Nur auffällige</button><button type="button" data-filter="offen">Nur offene</button></span>
    <label class="u-sort">Sortiert nach <select id="u-sort"><option value="ort">Ort (Geschoss, Raum)</option><option value="nr">Probennummer</option></select></label></div>
   <div id="u-tabellen"></div>
  </div>
  <div id="ansicht-pruefung" role="tabpanel" aria-labelledby="tab-pruefung" hidden>
  <section id="stand" class="stand-karte" aria-live="polite"></section>
  <div id="hinweise"></div>
  <section class="block" aria-labelledby="h-proben"><div class="block-kopf"><h2 id="h-proben">Proben</h2><span id="proben-zahl" class="zahl"></span></div><div id="proben"></div><div id="legende"></div></section>
  <section class="block" aria-labelledby="h-berichte"><div class="block-kopf"><h2 id="h-berichte">Prüfberichte</h2><span id="berichte-zahl" class="zahl"></span></div><div id="berichte"></div>
   <div id="ablage" class="ablage"><p><b>Neue Prüfberichte:</b> XML und PDF hierher ziehen oder <button id="ablage-wahl" type="button" class="link">Dateien wählen …</button></p><p class="muted klein">ResultKit legt sie in „${LABOR}“ ab – nichts wird überschrieben. Die Messwerte kommen aus der XML, die PDF dient dem Abgleich.</p></div>
  </section>
  </div>
 </div>
</main>
<footer class="fuss">ResultKit v${APP_VERSION} · liest und schreibt nur im Projektordner · keine Daten verlassen diesen Rechner</footer>
<input id="datei-wahl" type="file" accept=".xml,.pdf,application/xml,text/xml,application/pdf" multiple hidden>
<dialog id="import-dialog" aria-labelledby="import-titel"><form method="dialog"><button class="schliessen" aria-label="Schließen">×</button></form>
 <span class="eyebrow">BERICHTE IMPORTIEREN</span><h2 id="import-titel">In „${LABOR}“ ablegen?</h2><p class="muted">Bitte prüfen: Gehören die Berichte zu diesem Projekt? Abgelegt wird eine unveränderte Kopie.</p>
 <div id="import-liste"></div><div class="dialog-aktionen"><button id="import-abbrechen" type="button">Abbrechen</button><button id="import-ok" type="button" class="primary">Ablegen</button></div></dialog>
<dialog id="frage-dialog" aria-labelledby="frage-titel"><h2 id="frage-titel"></h2><p id="frage-text"></p><div class="dialog-aktionen" id="frage-aktionen"></div></dialog>
<div id="ziehen" class="ziehen" hidden><p>Prüfberichte loslassen zum Importieren</p></div>
<div id="toast" role="status" hidden></div>`;

let toastTimer=0;
function toast(text:string,fehler=false){const t=$('toast');t.textContent=text;t.className=fehler?'fehler':'';t.hidden=false;clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>{t.hidden=true;},fehler?9000:5000);}
function fail(e:unknown){toast(meldung(e),true);}
function frage(titel:string,text:string,wahl:string[]):Promise<string>{return new Promise(resolve=>{const d=$<HTMLDialogElement>('frage-dialog');$('frage-titel').textContent=titel;$('frage-text').textContent=text;
 $('frage-aktionen').replaceChildren(...wahl.map((w,i)=>{const b=document.createElement('button');b.type='button';b.textContent=w;if(i===wahl.length-1)b.className='primary';b.onclick=()=>{d.close();resolve(w);};return b;}));
 d.onclose=()=>resolve(wahl[0]);d.showModal();});}

// ---- Zustand ----
interface Scan {auftrag:LabReport|null;auftragDatei:DateiStand|null;auftragFehler:string;eingaenge:Eingang[];fehler:{name:string;text:string}[];dateien:DateiStand[];stand:string;u:Uebersicht;vorhanden:ErgebnisDatei|null;vorhandenFehler:string;ohneOrdner:boolean}
let folder:ProjectFolder|null=null,scan:Scan|null=null,einstellungen:ResultSettings|null=null,laeuft=0,beschaeftigt=false;
/** Gelesene Berichte je Dateistand – PDFs werden nicht bei jedem Einlesen neu ausgewertet. */
const cache=new Map<string,{report?:LabReport;fehler?:string}>();

async function einlesen(f:ProjectFolder):Promise<Scan>{
 const labor=await findSubdir(f.dir,LABOR),auftraege=await findSubdir(f.dir,AUFTRAEGE);
 let auftrag:LabReport|null=null,auftragDatei:DateiStand|null=null,auftragFehler='';
 if(auftraege){const liste=await listFiles(auftraege,/_Daten\.json$/i);   // LabelKit lädt immer die neueste – sie enthält den ganzen Auftrag
  if(liste[0]){const file=await liste[0].handle.getFile();auftragDatei={name:`${AUFTRAEGE}/${liste[0].name}`,size:file.size,t:file.lastModified};
   try{let ohneNummer=false;auftrag=labelkitReport(await file.text(),liste[0].name,f.name,()=>{ohneNummer=true;return true;});
    if(ohneNummer)auftrag.warnings.push(`„${liste[0].name}“ enthält keine Projektnummer (ältere LabelKit-Datei) – sie liegt im Projektordner und wird daher diesem Projekt zugeordnet.`);}
   catch(e){auftragFehler=meldung(e);}}}
 const dateien:DateiStand[]=[],gruppen=new Map<string,{file:File;name:string}[]>();
 if(labor)for await(const h of labor.values()){
  if(h.kind!=='file'||!/\.(xml|pdf)$/i.test(h.name))continue;
  const file=await (h as FileSystemFileHandle).getFile();dateien.push({name:h.name,size:file.size,t:file.lastModified});
  const key=h.name.replace(/\.(xml|pdf)$/i,'').normalize('NFC').toLowerCase();gruppen.set(key,[...(gruppen.get(key)||[]),{file,name:h.name}]);}
 const eingaenge:Eingang[]=[],fehler:{name:string;text:string}[]=[];
 for(const gruppe of [...gruppen.values()].sort((a,b)=>a[0].name.localeCompare(b[0].name,'de',{numeric:true}))){
  const key=gruppe.map(g=>`${g.name}|${g.file.size}|${g.file.lastModified}`).sort().join('\n');let r=cache.get(key);
  if(!r){try{const report=await readLabFiles(gruppe.map(g=>g.file));r=!report.rows.length&&!report.bericht?{fehler:report.warnings.join(' ')||'Kein Prüfbericht erkannt.'}:{report};}catch(e){r={fehler:meldung(e)};}cache.set(key,r);}
  if(r.report)eingaenge.push({report:r.report,geaendert:Math.max(...gruppe.map(g=>g.file.lastModified))});
  else fehler.push({name:gruppe.map(g=>g.name).join(' + '),text:r.fehler||''});}
 const alle=[...dateien,...(auftragDatei?[auftragDatei]:[])];
 let vorhanden:ErgebnisDatei|null=null,vorhandenFehler='';
 if(labor){try{const file=await fileInfo(labor,DATEI);if(file)vorhanden=liesErgebnisDatei(await file.text());}catch(e){vorhandenFehler=meldung(e);}}
 return {auftrag,auftragDatei,auftragFehler,eingaenge,fehler,dateien:alle,stand:standKennung(alle),u:uebersicht(f.nr,auftrag,eingaenge),vorhanden,vorhandenFehler,ohneOrdner:!labor};
}

/** Bewertungsregel wie in PlanKit/FotoKit: Einstellungen der Ergebniskarte aus dem Probenplan, sonst Nutzung aus _Projekt.json. */
async function planEinstellungen(f:ProjectFolder):Promise<ResultSettings|null>{
 try{const d=await findSubdir(f.dir,PLAENE),file=d?await fileInfo(d,`Probenplan ${f.name}.probenplan`):null;if(!file)return null;
  const r=JSON.parse(await file.text())?.results,obj=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,Scale>:undefined;
  if(r&&typeof r==='object')return {usage:r.usage==='residential'||r.usage==='industrial'?r.usage:undefined,vds:obj(r.vds),scales:obj(r.scales)};
 }catch{/* Plan nicht lesbar: Nutzung aus den Projektdaten */}
 return null;
}
function skala(p:string,u:string):{scale?:Scale;quelle:string}{
 const settings=einstellungen??{usage:usageFromNutzung()},r=scaleFor(settings,p,u);
 if(r.scale&&Array.isArray(r.scale.cats)&&r.scale.cats.length){const farben=autoColors(r.scale.cats.length);
  return {scale:{name:r.scale.name,cats:r.scale.cats.map((c,i)=>({...c,color:c.color||farben[i]}))},quelle:r.vds?(r.angepasst?'VdS 2357, in PlanKit angepasst':/^Chlorid/i.test(p)?'VdS 2357, Chlorid':einstellungen?'VdS 2357 (Nutzung aus PlanKit)':`VdS 2357 (Nutzung „${getNutzung()}“)`):'Skala aus PlanKit'};}
 const s=fromShared(scaleKey(p,u));return s?{scale:s,quelle:'Büro-Skala'}:{quelle:''};
}
const genutzt=new Map<string,{p:string;u:string;scale:Scale;quelle:string}>();
function wertZelle(w:Wert,kurz=false){
 const q=labQualifier(w.r),einheit=w.u?` ${esc(w.u)}`:'',name=kurz?`<span class="wp">${esc(shortParameter(w.p))}</span> `:'';
 let farbe='',titel=w.loq?`BG ${w.loq}${w.u?` ${w.u}`:''}`:'';
 if(q==='below'){farbe=BELOW_LIMIT;titel=`unter der Bestimmungsgrenze${w.loq?` (BG ${w.loq} ${w.u})`:''}`;}
 else if(q==='notDetected'){farbe=NOT_DETECTED;titel='nicht nachweisbar';}
 else if(q==='notDetermined'){farbe=NOT_DETERMINED;titel='nicht bestimmt';}
 else if(q==='measured'){const s=skala(w.p,w.u);if(s.scale){const i=rate(s.scale,labNumber(w.r));if(i>=0){farbe=s.scale.cats[i].color||UNRATED;titel=`${s.scale.cats[i].name} – ${s.scale.name}`;genutzt.set(scaleKey(w.p,w.u),{p:w.p,u:w.u,scale:s.scale,quelle:s.quelle});}}}
 const stil=farbe?` style="--c:${farbe};--t:${ink(farbe)}"`:'';
 return `<span class="wert${farbe?' bewertet':''}"${stil}${titel?` title="${esc(titel)}"`:''}>${name}<b>${esc(w.r)}</b>${kurz?einheit:''}</span>`;
}
/** Kernwerte einer Probe: Σ16 EPA-PAK, BaP, Chlorid, Asbest – sonst die ersten beiden Parameter. */
const KERN=[/^Summe\s*16\s*EPA[-– ]PAK/i,/^Benzo\[a\]pyren$/i,/chlorid/i,/asbest/i];
function kernwerte<T extends Wert>(werte:T[]):T[]{const k=KERN.flatMap(re=>werte.filter(w=>re.test(w.p)));return k.length?k:werte.slice(0,2);}

const STATUS:Record<Status,[string,string]>={ergebnis:['✓ Ergebnis','ok'],vorlaeufig:['◐ nur vorläufig','vorl'],ohneWerte:['○ ohne Messwerte','offen'],offen:['○ offen','offen'],nichtBeauftragt:['! nicht beauftragt','warn']};

function render(){
 const da=!!folder;$('start').hidden=da;$('projekt').hidden=!da;
 for(const id of ['btn-import','btn-neu'])($(id) as HTMLButtonElement).disabled=!da||beschaeftigt;
 const badge=$('projekt-badge');badge.hidden=!folder;if(folder){badge.innerHTML=`<b>${esc(folder.nr)}</b> ${esc(folder.ort)}`;badge.title=`Projektordner „${folder.name}“`;document.title=`${folder.name} · ResultKit`;}else document.title='ResultKit · Laborergebnisse';
 if(!folder)return;
 if(!scan){$('stand').innerHTML=`<p class="muted">Projektordner wird eingelesen …</p>`;for(const id of ['hinweise','proben','legende','berichte'])$(id).innerHTML='';return;}
 genutzt.clear();
 renderStand(scan);renderHinweise(scan);renderProben(scan);renderBerichte(scan);renderLegende();
 renderUebersicht(scan);
}

// ---- Übersicht: Ergebnisse auf einen Blick ----
type Ansicht='uebersicht'|'pruefung';type Filter='alle'|'auff'|'offen';
const merke=(k:string,v?:string)=>{try{if(v===undefined)return localStorage.getItem('resultkit-'+k)||'';localStorage.setItem('resultkit-'+k,v);}catch{/* ohne Speicher */}return v||'';};
let ansicht:Ansicht=merke('ansicht')==='pruefung'?'pruefung':'uebersicht',filter:Filter=(['auff','offen'].includes(merke('filter'))?merke('filter'):'alle') as Filter;
($('u-sort') as HTMLSelectElement).value=merke('sortierung')==='nr'?'nr':'ort';
function zeigeAnsicht(a:Ansicht){ansicht=a;merke('ansicht',a);
 for(const [id,x] of [['uebersicht','uebersicht'],['pruefung','pruefung']] as const){$(`tab-${id}`).setAttribute('aria-selected',String(a===x));$(`ansicht-${id}`).hidden=a!==x;}}
/** Bewertung eines Messwerts für die Übersicht: Kategorie der Skala (wie in der Prüfung), BG/n. n. neutral. */
function bewertung(w:Wert):{text:string;farbe:string;index:number;titel:string}|null{
 const q=labQualifier(w.r);
 if(q==='below')return {text:'< BG',farbe:BELOW_LIMIT,index:-1,titel:`unter der Bestimmungsgrenze${w.loq?` (BG ${w.loq} ${w.u})`:''}`};
 if(q==='notDetected')return {text:'n. n.',farbe:NOT_DETECTED,index:-1,titel:'nicht nachweisbar'};
 if(q!=='measured')return null;
 const s=skala(w.p,w.u);if(!s.scale)return null;const i=rate(s.scale,labNumber(w.r));if(i<0)return null;
 return {text:s.scale.cats[i].name,farbe:s.scale.cats[i].color||UNRATED,index:i,titel:`${s.scale.name} (${s.quelle})`};
}
/** Ruhige Pastellfarben statt Vollfarbe: helle Fläche, dunkle Schrift aus derselben Farbe. */
const pastell=(farbe:string,inhalt:string,titel='')=>`<span class="u-chip" style="--c:${farbe}"${titel?` title="${esc(titel)}"`:''}>${inhalt}</span>`;
const ASBEST_ROT='#d0453a';
const auffaellig=(z:UZeile)=>!!(z.befund?.gefunden||(z.haupt&&(bewertung(z.haupt)?.index??0)>0));
const GTITEL:Record<Gruppe,string>={PAK:'PAK',Chlorid:'Chlorid',Asbest:'Asbest',Weitere:'Weitere Proben'};
function renderUebersicht(s:Scan){
 const gruppen=uebersichtGruppen(s.u.zeilen),nach=($('u-sort') as HTMLSelectElement).value as 'ort'|'nr';
 const ue=uebernahmeText(s),aktuell=!!s.vorhanden&&s.vorhanden.stand===s.stand&&!s.vorhandenFehler;
 const zuTun=!aktuell||s.fehler.length>0||!!s.auftragFehler;
 $('tab-punkt').hidden=!zuTun;
 $('u-uebernahme').innerHTML=gruppen.length?`<p class="u-stand ${aktuell?'ok':'warn'}">${esc(aktuell?ue.text.replace(/ PlanKit und FotoKit verwenden diesen Stand\.$/,''):ue.text)} ${aktuell?'':'<button type="button" class="link" data-zu="pruefung">Prüfen und übernehmen →</button>'}</p>`:'';
 if(!gruppen.length){$('u-kacheln').innerHTML='';$('u-tabellen').innerHTML=`<p class="leer">Noch keine Proben. In LabelKit im Projekt speichern oder unter <button type="button" class="link" data-zu="pruefung">Prüfung und Import</button> Prüfberichte importieren.</p>`;return;}
 $('u-kacheln').innerHTML=gruppen.map(g=>{const n=g.zeilen.length,offen=n-g.mitErgebnis,auff=g.zeilen.filter(auffaellig).length;
  const vorl=g.zeilen.filter(z=>z.vorlaeufig).length;
  const teile=[g.gruppe==='Asbest'?`${auff} Asbest nachgewiesen`:auff?`${auff} auffällig`:'',vorl?`${vorl} vorläufig`:'',offen?`${offen} offen`:'',!offen&&!auff&&!vorl?'alle mit Ergebnis':''].filter(Boolean);
  return `<div class="u-kachel"><span class="u-k-name">${esc(GTITEL[g.gruppe])}</span><span class="u-k-zahl">${g.mitErgebnis} / ${n}</span><span class="u-k-text">${esc(teile.join(' · '))}</span></div>`;}).join('');
 $('u-tabellen').innerHTML=gruppen.map(g=>uTabelle(g,nach,s.u.berichte)).join('');
 document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
}
/** Prüfberichte einer Tabelle mit Datum, z. B. „Prüfbericht AR-1-01 vom 12.10.2026“ oder „Prüfberichte AR-1-01 (12.10.), AR-1-04 (vorläufig, 20.10.)“. */
function berichtZeile(codes:string[],berichte:Bericht[]){
 const b=codes.map(c=>berichte.find(x=>x.bericht===c)).filter(Boolean) as Bericht[];if(!b.length)return '';
 if(b.length===1)return `Prüfbericht ${b[0].bericht}${b[0].vorlaeufig?' (vorläufig)':''}${b[0].datum?` vom ${datum(b[0].datum)}`:''}`;
 return `Prüfberichte ${b.map(x=>`${x.bericht}${x.vorlaeufig||x.datum?` (${[x.vorlaeufig?'vorläufig':'',x.datum?datum(x.datum).slice(0,6):''].filter(Boolean).join(', ')})`:''}`).join(', ')}`;
}
function uTabelle(g:UGruppe,nach:'ort'|'nr',berichte:Bericht[]){
 let zeilen=sortiere(g.zeilen,nach);
 if(filter==='offen')zeilen=zeilen.filter(z=>z.ausstehend);else if(filter==='auff')zeilen=zeilen.filter(auffaellig);
 const hinweis=(z:UZeile)=>z.ausstehend?'<span class="u-aus">ausstehend</span>':`${z.vorlaeufig?' <small class="u-vorl">vorläufig</small>':''}${z.nichtBeauftragt?' <small class="u-nb" title="Steht im Prüfbericht, aber nicht im Laborauftrag aus LabelKit">nicht beauftragt</small>':''}`;
 // Legende: die Kategorien der verwendeten Skalen mit Bereich – die Werte selbst tragen die Farbe
 const skalen=new Map<string,{scale:Scale;u:string}>();let bg=false;
 for(const z of g.zeilen)if(z.haupt){const q=labQualifier(z.haupt.r);if(q==='below'||q==='notDetected')bg=true;if(q==='measured'){const k=skala(z.haupt.p,z.haupt.u);if(k.scale)skalen.set(`${k.scale.name}|${z.haupt.u}`,{scale:k.scale,u:z.haupt.u});}}
 const legende=g.gruppe==='Asbest'?`<p class="u-legende">Befund wie im Prüfbericht · ${pastell(ASBEST_ROT,'Asbest nachgewiesen')}</p>`
  :(g.gruppe==='PAK'||g.gruppe==='Chlorid')?(skalen.size?[...skalen.values()].map(({scale,u})=>`<p class="u-legende">${esc(scale.name)}: ${scale.cats.map((c,i)=>pastell(c.color||UNRATED,`${esc(c.name)} <small>${esc(rangeText(scale,i,u))}</small>`)).join(' ')}${bg?` ${pastell(BELOW_LIMIT,'&lt; BG')}`:''}</p>`).join(''):'<p class="u-legende">ohne Bewertungsskala</p>'):'';
 const codes=[...new Set(g.zeilen.flatMap(z=>z.berichte))];
 const kopf=g.gruppe==='PAK'?`Σ16 EPA-PAK${g.einheit?` (${g.einheit})`:''}`:g.gruppe==='Chlorid'?`Chlorid${g.einheit?` (${g.einheit})`:''}`:g.gruppe==='Asbest'?'Befund':'Ergebnis';
 const leer=`<tr><td colspan="3" class="muted">${filter==='offen'?'Keine offenen Proben.':filter==='auff'?'Keine auffälligen Proben.':''}</td></tr>`;
 const zeile=(z:UZeile)=>{let erg='';
  if(g.gruppe==='Asbest')erg=z.befund?(z.befund.gefunden?pastell(ASBEST_ROT,esc(z.befund.text),'Asbest nachgewiesen'):esc(z.befund.text)):'';
  else if(g.gruppe!=='Weitere'&&!z.haupt)erg=z.ausstehend?'':`<span class="u-aus">kein ${g.gruppe==='PAK'?'Σ16-EPA-PAK':'Chlorid'}-Wert im Bericht</span>`;
  else if(g.gruppe==='Weitere')erg=z.weitere.map(w=>`${esc(shortParameter(w.p))} <span class="u-wert">${esc(w.r)}</span> ${esc(w.u)}`).join(' · ');
  else if(z.haupt){const w=z.haupt,b=bewertung(w),text=`${esc(w.r)}${w.u&&w.u!==g.einheit?` <small>${esc(w.u)}</small>`:''}`;
   const titel=[b?.text,z.original?`laut Bericht ${z.original}`:''].filter(Boolean).join(' · ');
   erg=b?pastell(b.farbe,`<span class="u-wert">${text}</span>`,titel):`<span class="u-wert"${titel?` title="${esc(titel)}"`:''}>${text}</span>`;}
  return `<tr${z.ausstehend?' class="u-offen"':''}><th scope="row">${esc(z.label)}</th><td>${esc(z.stelle)}</td><td>${erg}${hinweis(z)}</td></tr>`;};
 return `<section class="u-gruppe" aria-label="${esc(GTITEL[g.gruppe])}"><h2>${esc(GTITEL[g.gruppe])} <small>${g.zeilen.length} Probe${g.zeilen.length===1?'':'n'}${codes.length?` · ${esc(berichtZeile(codes,berichte))}`:''}</small></h2>${legende}
  <div class="tabelle-scroll"><table class="u-tabelle"><thead><tr><th scope="col">Probe</th><th scope="col">${g.gruppe==='Asbest'?'Material und Stelle':'Probenahmestelle'}</th><th scope="col">${esc(kopf)}</th></tr></thead>
  <tbody>${zeilen.map(zeile).join('')||leer}</tbody></table></div></section>`;
}
function uebernahmeText(s:Scan){
 if(s.vorhandenFehler)return {cls:'warn',text:`⚠ „${DATEI}“ ist nicht lesbar: ${s.vorhandenFehler} Erneut übernehmen schreibt eine neue Datei (die alte bleibt als „${VORHER}“).`};
 if(!s.vorhanden)return {cls:'neu',text:'Noch nicht übernommen – PlanKit und FotoKit sehen diese Ergebnisse erst nach „Ergebnisse übernehmen“.'};
 const wann=uhr(s.vorhanden.uebernommen);
 if(s.vorhanden.stand===s.stand)return {cls:'ok',text:`✓ Übernommen am ${wann}${s.vorhanden.vollstaendig?'':' (Zwischenstand)'} – entspricht dem Ordner. PlanKit und FotoKit verwenden diesen Stand.`};
 return {cls:'warn',text:`⚠ Seit der Übernahme am ${wann} hat sich etwas geändert (Prüfberichte oder Laborauftrag). PlanKit und FotoKit zeigen noch den alten Stand – bitte prüfen und erneut übernehmen.`};
}
function renderStand(s:Scan){
 const u=s.u,z=u.zaehler,voll=vollstaendig(u),ue=uebernahmeText(s);
 const chip=(n:number|null,text:string,cls:string)=>n?`<span class="chip ${cls}"><b>${n}</b> ${text}</span>`:'';
 const gueltig=u.berichte.filter(b=>!b.ersetztDurch&&!b.ohneWerte).length;
 $('stand').className=`stand-karte${voll?' voll':''}`;
 $('stand').innerHTML=`<div class="stand-text"><span class="eyebrow">STAND ${esc(folder!.nr)}</span><h1>${esc(standText(u))}</h1>
  <p class="muted">${s.auftrag?`Laborauftrag aus LabelKit: <b>${esc(s.auftrag.quelle)}</b> · ${z.erwartet} Proben zur Analyse`:s.auftragFehler?'Laborauftrag nicht lesbar':`Noch kein Laborauftrag aus LabelKit in „${esc(AUFTRAEGE)}“`} · ${u.berichte.length} Prüfbericht${u.berichte.length===1?'':'e'} in „${esc(LABOR)}“</p>
  <div class="chips">${chip(z.ergebnis,'mit Ergebnis','ok')}${chip(z.vorlaeufig,'nur vorläufig','vorl')}${chip(z.offen,'offen','offen')}${chip(z.nichtBeauftragt,'nicht beauftragt','warn')}${voll?'<span class="chip ok"><b>✓</b> vollständig</span>':''}</div></div>
  <div class="uebernahme ${ue.cls}"><p>${esc(ue.text)}</p><button id="btn-uebernehmen" type="button" class="primary"${gueltig&&!beschaeftigt?'':' disabled'}>${s.vorhanden&&s.vorhanden.stand===s.stand?'Erneut übernehmen':'Ergebnisse übernehmen'}</button>
  ${gueltig?'':'<p class="muted klein">Übernehmen geht, sobald ein Prüfbericht mit Messwerten (XML) vorliegt.</p>'}</div>`;
 $('btn-uebernehmen').onclick=()=>void uebernehmen();
}
function renderHinweise(s:Scan){
 const liste=[...(s.auftragFehler?[`Laborauftrag: ${s.auftragFehler}`]:[]),...(s.auftrag?.warnings||[]).map(w=>`Laborauftrag: ${w}`),...s.u.hinweise,...s.fehler.map(f=>`„${f.name}“ nicht lesbar: ${f.text}`)];
 $('hinweise').innerHTML=liste.length?`<div class="hinweis-liste" role="note">${liste.map(h=>`<p>${esc(h)}</p>`).join('')}</div>`:'';
}
function renderProben(s:Scan){
 const zeilen=s.u.zeilen;$('proben-zahl').textContent=zeilen.length?`${zeilen.length}`:'';
 if(!zeilen.length){$('proben').innerHTML=`<p class="leer">Noch keine Proben – weder ein Laborauftrag aus LabelKit noch ein Prüfbericht. In LabelKit im Projekt speichern oder unten Prüfberichte importieren.</p>`;return;}
 $('proben').innerHTML=`<div class="tabelle-scroll"><table class="proben"><thead><tr><th scope="col">Probe</th><th scope="col">Art</th><th scope="col">Beschreibung</th><th scope="col">Probenahme</th><th scope="col">Stand</th><th scope="col">Ergebnis</th><th scope="col">Bericht</th></tr></thead><tbody>${zeilen.map(z=>probeZeile(z)).join('')}</tbody></table></div>`;
}
function probeZeile(z:Zeile){
 const [text,cls]=STATUS[z.status],werte=kernwerte(z.werte);
 return `<tr class="st-${cls}"><th scope="row">${esc(z.label||'–')}</th><td data-label="Art">${esc([...new Set([z.typ,...(z.art||'').split(' · ')].filter(Boolean))].join(' · '))}</td><td class="beschreibung" data-label="Beschreibung">${esc(z.desc||z.ref)}${z.hinweise.length?`<ul class="zeilen-hinweise">${z.hinweise.map(h=>`<li>${esc(h)}</li>`).join('')}</ul>`:''}</td>
  <td data-label="Probenahme">${esc(datum(z.datum))}</td><td data-label="Stand"><span class="status ${cls}">${text}</span></td><td class="werte" data-label="Ergebnis">${werte.map(w=>wertZelle(w,true)).join(' ')}${z.werte.length>werte.length?` <span class="muted klein">+${z.werte.length-werte.length}</span>`:''}</td><td class="klein bericht-nr" data-label="Bericht">${z.berichte.map(b=>`<span>${esc(b)}</span>`).join('')}</td></tr>`;
}
function renderBerichte(s:Scan){
 const b=s.u.berichte;$('berichte-zahl').textContent=b.length?`${b.length}`:'';
 $('berichte').innerHTML=b.length?[...b].sort((x,y)=>(x.ersetztDurch?1:0)-(y.ersetztDurch?1:0)||y.geaendert-x.geaendert).map(berichtKarte).join(''):`<p class="leer">${s.ohneOrdner?`Noch kein Ordner „${esc(LABOR)}“ im Projekt – er wird beim ersten Import angelegt.`:`Noch keine Prüfberichte in „${esc(LABOR)}“.`}</p>`;
}
function berichtKarte(b:Bericht){
 const proben=b.proben,daten=[...new Set(proben.map(p=>p.datum).filter(Boolean))].sort() as string[];
 const zustand=b.ersetztDurch?['ersetzt','ersetzt']:b.ohneWerte?['ohne Messwerte','offen']:b.vorlaeufig?['vorläufig','vorl']:['endgültig','ok'];
 const spalten=[...new Map(proben.flatMap(p=>kernwerte(p.werte||[])).map(w=>[`${w.p}|${w.u}`,w])).values()].slice(0,5);
 const alle=[...new Map(proben.flatMap(p=>p.werte||[]).map(w=>[`${w.p}|${w.u}`,w])).values()];
 const zelle=(werte:Wert[]|undefined,p:string,u:string)=>{const w=(werte||[]).find(x=>x.p===p&&x.u===u);return w?wertZelle(w):'<span class="muted">–</span>';};
 const kopf=`<span class="eyebrow">PRÜFBERICHT</span><h3>${esc(b.bericht||b.sources.xml||b.sources.pdf||'ohne Nummer')} <span class="badge ${zustand[1]}">${zustand[0]}</span></h3>
  <p class="meta">${b.datum?`Bericht vom ${datum(b.datum)} · `:''}${proben.length} Probe${proben.length===1?'':'n'}${daten.length?` · Probenahme ${daten.map(datum).join(' – ')}`:''}${b.auftragsreferenz?` · Auftragsreferenz „${esc(b.auftragsreferenz)}“`:''} · ${[b.sources.xml?`XML ✓`:'XML fehlt',b.sources.pdf?'PDF ✓':'ohne PDF'].join(' · ')} · Datei vom ${esc(uhr(b.geaendert))}</p>`;
 const hinweise=b.hinweise.length?`<ul class="bericht-hinweise">${b.hinweise.map(h=>`<li>${esc(h)}</li>`).join('')}</ul>`:'';
 if(b.ersetztDurch)return `<article class="bericht ersetzt"><details><summary>${kopf}</summary>${hinweise}</details></article>`;
 const tabelle=proben.length?`<div class="tabelle-scroll"><table class="werte-tabelle"><thead><tr><th scope="col">Probe</th><th scope="col">Beschreibung</th>${spalten.map(w=>`<th scope="col">${esc(shortParameter(w.p))}<small>${esc(w.u)}</small></th>`).join('')}</tr></thead>
  <tbody>${proben.map(p=>`<tr><th scope="row">${esc(p.label||p.ref)}</th><td class="beschreibung">${esc(p.desc)}</td>${spalten.map(w=>`<td>${zelle(p.werte,w.p,w.u)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'';
 const voll=alle.length>spalten.length?`<details class="alle"><summary>Alle Parameter (${alle.length})</summary><div class="tabelle-scroll"><table class="werte-tabelle alle-tabelle"><thead><tr><th scope="col">Parameter</th><th scope="col">Einheit</th>${proben.map(p=>`<th scope="col">${esc(p.label||p.ref)}</th>`).join('')}</tr></thead>
  <tbody>${alle.map(w=>`<tr><th scope="row">${esc(w.p)}</th><td>${esc(w.u)}</td>${proben.map(p=>`<td>${zelle(p.werte,w.p,w.u)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`:'';
 return `<article class="bericht">${kopf}${hinweise}${tabelle}${voll}</article>`;
}
function renderLegende(){
 const l=[...genutzt.values()];
 $('legende').innerHTML=`<div class="legende"><span class="legende-titel">Bewertung</span>${l.map(x=>`<div class="legende-skala"><span class="skala-name">${esc(shortParameter(x.p))} (${esc(x.u)}): ${esc(x.scale.name||'Skala')} <small>${esc(x.quelle)}</small></span>${x.scale.cats.map((c,i)=>`<span class="wert bewertet" style="--c:${c.color};--t:${ink(c.color||UNRATED)}">${esc(c.name)} <small>${esc(rangeText(x.scale,i,x.u))}</small></span>`).join('')}</div>`).join('')}
  <div class="legende-skala"><span class="wert bewertet" style="--c:${BELOW_LIMIT};--t:${ink(BELOW_LIMIT)}">&lt; BG</span><span class="wert bewertet" style="--c:${NOT_DETECTED};--t:${ink(NOT_DETECTED)}">n. n.</span><span class="wert">ohne Skala</span>
  ${l.length?'':`<span class="muted klein">Keine Skala für diese Parameter – Skalen werden in PlanKit (Ergebniskarte) oder FotoKit gepflegt. ResultKit erfindet keine Grenzwerte.</span>`}</div></div>`;
}

// ---- Projekt öffnen ----
async function neuEinlesen(still=false){
 const f=folder;if(!f)return;const lauf=++laeuft;
 try{const s=await einlesen(f);if(lauf!==laeuft||folder!==f)return;scan=s;render();}
 catch(e){if(lauf===laeuft&&!still)fail(e);}
}
async function oeffnen(dir:Dir){
 let f:ProjectFolder;try{f=await openFolder(dir);}catch(e){fail(e);return;}
 folder=f;scan=null;einstellungen=null;cache.clear();$('ordner-frage').hidden=true;render();PROJEKT_URL.setzen(f.name);
 window.MosaikLeiste?.aktualisieren();
 try{setNutzung((await readProjectData(f)).nutzung);}catch{setNutzung('');}
 einstellungen=await planEinstellungen(f);
 await neuEinlesen();
 void skalenAbgleich().then(()=>{if(folder===f&&scan)render();}).catch(()=>{});
}
async function ausZentrale(name:string){
 if(!supported()){startHinweis('Dieser Browser kann keine Ordner öffnen. Bitte ResultKit in Chrome oder Edge verwenden.');return;}
 const root=await archiv();
 if(!root){startHinweis(`Projekt „${name}“: Der Archivordner ist in diesem Browser nicht bekannt. Bitte in der Projektzentrale einmal den Archivordner wählen – oder hier den Projektordner öffnen.`);return;}
 const los=async()=>{try{await oeffnen(await root.getDirectoryHandle(name) as Dir);}catch(e){startHinweis(`Projekt „${name}“ nicht gefunden in „${root.name}“: ${meldung(e)}`);}};
 if(await permission(root)){await los();return;}
 $('ordner-frage-text').innerHTML=`Projekt <b>${esc(name)}</b> aus der Projektzentrale`;$('ordner-frage').hidden=false;
 $('ordner-erlauben').onclick=async()=>{if(await permission(root,true))await los();else toast('Ohne Zugriff auf den Archivordner kann das Projekt nicht geöffnet werden.',true);};
}
function startHinweis(text:string){const p=$('start-hinweis');p.textContent=text;p.hidden=!text;}
async function projektWaehlen(){
 if(!supported()){toast('Dieser Browser kann keine Ordner öffnen. Bitte Chrome oder Edge verwenden.',true);return;}
 try{const dir=await pickFolder();if(!dir)return;const p=await projectDirOf(dir);if(!p){toast('Bitte den Projektordner (z. B. „26.0123 Köln“) oder dessen Ordner „Laborergebnisse“ wählen.',true);return;}await oeffnen(p);}catch(e){fail(e);}
}

// ---- Ergebnisse übernehmen ----
async function uebernehmen(){
 const f=folder;if(!f||!scan||beschaeftigt)return;
 const recht=permission(f.dir,true);   // noch in der Klick-Geste fragen
 beschaeftigt=true;render();
 try{
  if(!await recht)throw Error('Ohne Schreibzugriff auf den Projektordner kann ResultKit nichts übernehmen.');
  const frisch=await einlesen(f);if(folder!==f)return;
  if(frisch.stand!==scan.stand){scan=frisch;toast('Im Ordner hat sich gerade etwas geändert – bitte die Übersicht prüfen und erneut auf „Ergebnisse übernehmen“ klicken.',true);return;}
  scan=frisch;const u=frisch.u;
  const bedenken=[...(vollstaendig(u)?[]:[`Noch nicht vollständig: ${standText(u)}.`]),...u.berichte.flatMap(b=>b.hinweise.filter(h=>/nennt Projekt/.test(h)))];
  if(bedenken.length){beschaeftigt=false;render();
   if(await frage('Ergebnisse übernehmen?',`${bedenken.join('\n\n')}\n\nPlanKit und FotoKit zeigen dann diesen Zwischenstand. Kommen weitere Berichte, einfach erneut übernehmen.`,['Abbrechen','Trotzdem übernehmen'])!=='Trotzdem übernehmen')return;
   if(folder!==f||scan?.stand!==frisch.stand){toast('Abgebrochen – die Übersicht hat sich inzwischen geändert.',true);return;}
   beschaeftigt=true;render();}
  const labor=await f.dir.getDirectoryHandle(LABOR,{create:true}) as Dir;
  const alt=await fileInfo(labor,DATEI);if(alt)await writeFile(labor,VORHER,await alt.text());
  await writeFile(labor,DATEI,JSON.stringify(ergebnisDatei(u,frisch.auftrag,frisch.dateien,APP_VERSION),null,1));
  toast(`Übernommen: ${standText(u)}. PlanKit und FotoKit verwenden jetzt diesen Stand.`);zeigeAnsicht('uebersicht');
  window.MosaikLeiste?.aktualisieren();
 }catch(e){fail(e);}
 finally{beschaeftigt=false;if(folder===f){render();await neuEinlesen();}}
}

// ---- Prüfberichte importieren ----
interface Vorschau {dateien:File[];report?:LabReport;fehler?:string;hinweise:string[];ziel:Map<File,string>;schonDa:boolean;fremd:boolean}
const gleich=async(a:Blob,b:Blob)=>{if(a.size!==b.size)return false;const [x,y]=await Promise.all([a.arrayBuffer(),b.arrayBuffer()]);const u=new Uint8Array(x),v=new Uint8Array(y);for(let i=0;i<u.length;i++)if(u[i]!==v[i])return false;return true;};
async function importieren(files:File[]){
 const f=folder;if(!f){toast('Bitte zuerst ein Projekt öffnen.',true);return;}
 const passend=files.filter(x=>/\.(xml|pdf)$/i.test(x.name));
 if(!passend.length){toast('Bitte Prüfberichte als XML und/oder PDF wählen (Eurofins).',true);return;}
 beschaeftigt=true;render();toast('Berichte werden gelesen …');
 try{
  const labor=await findSubdir(f.dir,LABOR),gruppen=new Map<string,File[]>();
  for(const x of passend){const k=x.name.replace(/\.(xml|pdf)$/i,'').normalize('NFC').toLowerCase();gruppen.set(k,[...(gruppen.get(k)||[]),x]);}
  const vorschau:Vorschau[]=[];
  for(const dateien of gruppen.values()){
   const v:Vorschau={dateien,hinweise:[],ziel:new Map(),schonDa:false,fremd:false};
   try{v.report=await readLabFiles(dateien);if(!v.report.rows.length&&!v.report.bericht)v.fehler=v.report.warnings.join(' ')||'Kein Prüfbericht erkannt.';else v.hinweise=reportWarnings(v.report,{report:f.name});}catch(e){v.fehler=meldung(e);}
   const nr=v.report?.auftragsreferenz.match(/\b\d{2}\.\d{3,6}\b/)?.[0];if(nr&&nr!==f.nr){v.fremd=true;v.hinweise.unshift(`Auftragsreferenz nennt Projekt ${nr} – geöffnet ist ${f.nr}.`);}
   // Gleichnamige Dateien: identisch → liegt schon da; abweichend → ganze Gruppe unter „Name (2)“, damit XML und PDF zusammenbleiben.
   let konflikt=false,alleDa=true;
   for(const d of dateien){const da=labor?await fileInfo(labor,d.name):null;if(!da){alleDa=false;continue;}if(!await gleich(da,d)){konflikt=true;alleDa=false;}}
   v.schonDa=alleDa;
   if(konflikt){for(let n=2;n<100;n++){const namen=dateien.map(d=>d.name.replace(/(\.(xml|pdf))$/i,` (${n})$1`));if((await Promise.all(namen.map(m=>labor?fileInfo(labor,m):null))).every(x=>!x)){dateien.forEach((d,i)=>v.ziel.set(d,namen[i]));break;}}
    v.hinweise.push(`Gleichnamige, aber andere Datei liegt schon im Ordner – wird als „${[...v.ziel.values()].join('“, „')}“ abgelegt.`);}
   else for(const d of dateien)if(!labor||!await fileInfo(labor,d.name))v.ziel.set(d,d.name);
   vorschau.push(v);}
  beschaeftigt=false;render();$('toast').hidden=true;
  if(folder!==f)return;
  zeigeVorschau(f,vorschau,files.length-passend.length);
 }catch(e){beschaeftigt=false;render();fail(e);}
}
function zeigeVorschau(f:ProjectFolder,vorschau:Vorschau[],uebrig:number){
 const d=$<HTMLDialogElement>('import-dialog');
 $('import-liste').innerHTML=vorschau.map((v,i)=>{const r=v.report,moeglich=!v.fehler&&!v.schonDa&&v.ziel.size>0;
  return `<label class="import-eintrag${moeglich?'':' aus'}"><input type="checkbox" data-i="${i}"${moeglich&&!v.fremd?' checked':''}${moeglich?'':' disabled'}>
   <span><b>${esc(r?.bericht||v.dateien.map(x=>x.name).join(' + '))}</b>${r?.vorlaeufig?' <span class="badge vorl">vorläufig</span>':''}
   <small>${esc(v.dateien.map(x=>x.name).join(' + '))}${r?` · ${r.rows.length} Proben${r.auftragsreferenz?` · Auftragsreferenz „${esc(r.auftragsreferenz)}“`:''}${r.rows.some(x=>x.werte?.length)?'':' · ohne Messwerte'}`:''}</small>
   ${v.fehler?`<small class="fehler-text">Nicht lesbar: ${esc(v.fehler)}</small>`:v.schonDa?'<small>Liegt schon unverändert im Ordner.</small>':''}
   ${v.hinweise.length?`<ul>${v.hinweise.map(h=>`<li>${esc(h)}</li>`).join('')}</ul>`:''}</span></label>`;}).join('')+(uebrig?`<p class="muted klein">${uebrig} Datei${uebrig===1?'':'en'} ohne .xml/.pdf übersprungen.</p>`:'');
 const ok=$<HTMLButtonElement>('import-ok'),pruefen=()=>{ok.disabled=!d.querySelector('input[data-i]:checked');};pruefen();
 $('import-liste').onchange=pruefen;$('import-abbrechen').onclick=()=>d.close();
 ok.onclick=async()=>{
  const wahl=[...d.querySelectorAll<HTMLInputElement>('input[data-i]:checked')].map(x=>vorschau[Number(x.dataset.i)]);d.close();
  if(folder!==f)return;
  try{
   if(!await permission(f.dir,true))throw Error('Ohne Schreibzugriff auf den Projektordner kann ResultKit keine Berichte ablegen.');
   const labor=await f.dir.getDirectoryHandle(LABOR,{create:true}) as Dir;let n=0;
   for(const v of wahl)for(const [datei,name] of v.ziel){if(await fileInfo(labor,name))throw Error(`„${name}“ ist inzwischen im Ordner – bitte erneut importieren.`);await writeFile(labor,name,datei);n++;}
   toast(`${n} Datei${n===1?'':'en'} in „${LABOR}“ abgelegt. Bitte prüfen und dann „Ergebnisse übernehmen“.`);zeigeAnsicht('pruefung');
  }catch(e){fail(e);}
  await neuEinlesen();
 };
 d.showModal();
}

// ---- Bedienung ----
$('btn-projekt').onclick=$('start-projekt').onclick=()=>void projektWaehlen();
$('btn-neu').onclick=()=>void neuEinlesen();
$('tab-uebersicht').onclick=()=>zeigeAnsicht('uebersicht');$('tab-pruefung').onclick=()=>zeigeAnsicht('pruefung');
$('ansicht-uebersicht').addEventListener('click',e=>{const t=e.target as HTMLElement;
 const f=t.closest<HTMLElement>('[data-filter]');if(f){filter=f.dataset.filter as Filter;merke('filter',filter);if(scan)renderUebersicht(scan);return;}
 if(t.closest('[data-zu="pruefung"]'))zeigeAnsicht('pruefung');});
$('u-sort').onchange=()=>{merke('sortierung',($('u-sort') as HTMLSelectElement).value);if(scan)renderUebersicht(scan);};
zeigeAnsicht(ansicht);
const wahl=$<HTMLInputElement>('datei-wahl');
$('btn-import').onclick=$('ablage-wahl').onclick=()=>{wahl.value='';wahl.click();};
wahl.onchange=()=>{const files=[...wahl.files||[]];if(files.length)void importieren(files);};
let ziehTiefe=0;const hatDateien=(e:DragEvent)=>!!e.dataTransfer?.types.includes('Files');
window.addEventListener('dragenter',e=>{if(!hatDateien(e)||!folder)return;e.preventDefault();ziehTiefe++;$('ziehen').hidden=false;});
window.addEventListener('dragover',e=>{if(hatDateien(e)&&folder)e.preventDefault();});
window.addEventListener('dragleave',()=>{if(ziehTiefe&&--ziehTiefe===0)$('ziehen').hidden=true;});
window.addEventListener('drop',e=>{if(!hatDateien(e))return;e.preventDefault();ziehTiefe=0;$('ziehen').hidden=true;if(!folder){toast('Bitte zuerst ein Projekt öffnen.',true);return;}const files=[...e.dataTransfer!.files];if(files.length)void importieren(files);});
// Zurück im Fenster (z. B. nach dem Speichern in LabelKit oder dem Ablegen im Explorer): still neu einlesen.
let fokusZeit=0;const fokus=()=>{if(!folder||beschaeftigt||document.hidden||Date.now()-fokusZeit<1500)return;fokusZeit=Date.now();void neuEinlesen(true);};
window.addEventListener('focus',fokus);document.addEventListener('visibilitychange',fokus);
window.addEventListener('hashchange',()=>{const p=PROJEKT_URL.lesen();if(p&&p!==folder?.name)void ausZentrale(p);});
declare global {interface Window {MosaikLeiste?:{start:(app:string,opt?:Record<string,unknown>)=>void;aktualisieren:()=>void}}}
window.MosaikLeiste?.start('ergebnis',{version:APP_VERSION});
if(!supported()){startHinweis('Dieser Browser kann keine Ordner öffnen. ResultKit arbeitet direkt im Projektordner – bitte Chrome oder Edge verwenden.');($('start-projekt') as HTMLButtonElement).disabled=true;}
render();
if(PROJEKT_URL.projekt)void ausZentrale(PROJEKT_URL.projekt);
if(import.meta.env.PROD&&'serviceWorker' in navigator)void navigator.serviceWorker.register('./sw.js').catch(()=>{});
