// ResultKit – Laborergebnisse eines Projekts an einer Stelle: was LabelKit ans Labor übergeben hat („Laboraufträge“),
// was an Prüfberichten im Ordner „Laborergebnisse“ liegt, was noch fehlt. „Ergebnisse übernehmen“ schreibt die geprüften
// Werte nach „Laborergebnisse/_Ergebnisse.json“ – PlanKit, FotoKit und die Projektzentrale lesen nur noch diese Datei.
// Alles bleibt lokal: ResultKit liest und schreibt nur im gewählten Projektordner.
import './style.css';
import './suite-bar';
import {skalenAbgleich} from './skalen-archiv.js';
import {readLabFiles,reportWarnings,type LabReport} from './labreport';
import {labelkitReport} from './labelkit';
import {uebersicht,standText,vollstaendig,ergebnisDatei,liesErgebnisDatei,ohneLage,standKennung,DATEI,type Uebersicht,type Eingang,type DateiStand,type ErgebnisDatei,type Zeile,type Bericht,type Status} from './ergebnisse';
import {archiv,permission,findSubdir,fileInfo,listFiles,writeFile,readProjectData,openFolder,projectDirOf,pickFolder,supported,LABOR,AUFTRAEGE,PLAENE,type Dir,type ProjectFolder} from './ordner';
import {labQualifier,labNumber,rate,scaleFor,scaleKey,fromShared,shortParameter,setNutzung,getNutzung,usageFromNutzung,autoColors,rangeText,ink,farbeSicher,gueltigeSkalen,BELOW_LIMIT,NOT_DETECTED,NOT_DETERMINED,UNRATED} from './bewertung';
import type {ResultSettings,Scale,Wert} from './model';
import {uebersichtGruppen,sortiere,wertFuer,matrix,sortiereMatrix,tabelleDaten,alsTSV,SPALTE_TITEL,type UGruppe,type UZeile,type Gruppe,type MZeile,type MSpalte} from './uebersicht';
import {jetztDran,type Aktion,type Chip,type Knopf} from './jetzt';

export const APP_VERSION='1.5.0';
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
  <section id="jetzt" class="jetzt" aria-live="polite" aria-label="Jetzt dran"></section>
  <div id="hinweise"></div>
  <div id="u-kacheln" class="u-kacheln"></div>
  <div id="u-filter" class="u-filter"><span class="u-ansicht" role="group" aria-label="Ansicht"><button type="button" data-ansicht="stelle" title="Eine Zeile je Probenahmestelle – PAK, Chlorid und Asbest derselben Stelle nebeneinander">Nach Stelle</button><button type="button" data-ansicht="art" title="Eine Tabelle je Probenart (wie bisher)">Je Probenart</button></span><span class="u-chips" role="group" aria-label="Filter"><button type="button" data-filter="alle">Alle</button><button type="button" data-filter="auff">Nur auffällige</button><button type="button" data-filter="offen">Nur offene</button></span>
   <span class="u-tipp muted klein" id="u-tipp">Zeile anklicken: alle Parameter, Hinweise und Prüfbericht</span>
   <button type="button" id="u-kopieren" class="u-kopieren" title="Markierte Zeilen (sonst alle) als Tabelle kopieren – in Excel oder Word einfügen">⧉ Für Excel kopieren</button>
   <label class="u-sort">Sortiert nach <select id="u-sort"><option value="ort">Ort (Geschoss, Raum)</option><option value="nr">Probennummer</option></select></label></div>
  <div id="u-tabellen"></div>
  <details id="berichte-block" class="berichte-block"><summary><h2 id="h-berichte">Prüfberichte</h2><span id="berichte-zahl" class="zahl"></span><span id="berichte-kurz" class="berichte-kurz"></span></summary>
   <div class="berichte-inhalt"><div id="berichte"></div>
    <div id="ablage" class="ablage"><p><b>Neue Prüfberichte:</b> XML und PDF hierher ziehen oder <button id="ablage-wahl" type="button" class="link">Dateien wählen …</button></p><p class="muted klein">ResultKit legt sie in „${LABOR}“ ab – nichts wird überschrieben. Die Messwerte kommen aus der XML, die PDF dient dem Abgleich.</p></div></div>
  </details>
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
  const r=JSON.parse(await file.text())?.results;   // Skalen wie in PlanKit geprüft: Farben gelangen ins HTML
  if(r&&typeof r==='object')return {usage:r.usage==='residential'||r.usage==='industrial'?r.usage:undefined,vds:gueltigeSkalen(r.vds),scales:gueltigeSkalen(r.scales)};
 }catch{/* Plan nicht lesbar: Nutzung aus den Projektdaten */}
 return null;
}
function skala(p:string,u:string):{scale?:Scale;quelle:string}{
 const settings=einstellungen??{usage:usageFromNutzung()},r=scaleFor(settings,p,u);
 if(r.scale&&Array.isArray(r.scale.cats)&&r.scale.cats.length){const farben=autoColors(r.scale.cats.length);
  return {scale:{name:r.scale.name,cats:r.scale.cats.map((c,i)=>({...c,color:farbeSicher(c.color,farben[i])}))},quelle:r.vds?(r.angepasst?'VdS 2357, in PlanKit angepasst':/^Chlorid/i.test(p)?'VdS 2357, Chlorid':einstellungen?'VdS 2357 (Nutzung aus PlanKit)':`VdS 2357 (Nutzung „${getNutzung()}“)`):'Skala aus PlanKit'};}
 const s=fromShared(scaleKey(p,u));return s?{scale:s,quelle:'Büro-Skala'}:{quelle:''};
}
function wertZelle(w:Wert,kurz=false){
 const q=labQualifier(w.r),einheit=w.u?` ${esc(w.u)}`:'',name=kurz?`<span class="wp">${esc(shortParameter(w.p))}</span> `:'';
 let farbe='',titel=w.loq?`BG ${w.loq}${w.u?` ${w.u}`:''}`:'';
 if(q==='below'){farbe=BELOW_LIMIT;titel=`unter der Bestimmungsgrenze${w.loq?` (BG ${w.loq} ${w.u})`:''}`;}
 else if(q==='notDetected'){farbe=NOT_DETECTED;titel='nicht nachweisbar';}
 else if(q==='notDetermined'){farbe=NOT_DETERMINED;titel='nicht bestimmt';}
 else if(q==='measured'){const s=skala(w.p,w.u);if(s.scale){const i=rate(s.scale,labNumber(w.r));if(i>=0){farbe=s.scale.cats[i].color||UNRATED;titel=`${s.scale.cats[i].name} – ${s.scale.name} (${s.quelle})`;}}}
 if(farbe)farbe=farbeSicher(farbe);const stil=farbe?` style="--c:${farbe};--t:${ink(farbe)}"`:'';
 return `<span class="wert${farbe?' bewertet':''}"${stil}${titel?` title="${esc(titel)}"`:''}>${name}<b>${esc(w.r)}</b>${kurz?einheit:''}</span>`;
}
/** Kernwerte einer Probe: Σ16 EPA-PAK, BaP, Chlorid, Asbest – sonst die ersten beiden Parameter. */
const KERN=[/^Summe\s*16\s*EPA[-– ]PAK/i,/^Benzo\[a\]pyren$/i,/chlorid/i,/asbest/i];
function kernwerte<T extends Wert>(werte:T[]):T[]{const k=KERN.flatMap(re=>werte.filter(w=>re.test(w.p)));return k.length?k:werte.slice(0,2);}

const STATUS:Record<Status,string>={ergebnis:'✓ Ergebnis',vorlaeufig:'nur vorläufig',ohneWerte:'Bericht ohne Messwerte',offen:'offen beim Labor',nichtBeauftragt:'nicht beauftragt'};
/** Hinweise, die schon als eigener Stand gezeigt werden (Chip „vorläufig“, „nicht beauftragt“) – zählen nicht als „Hinweis“. */
const STANDARD=/^(Nur vorläufige Werte|Nicht im Laborauftrag aus LabelKit|Teilweise ersetzt durch)/;
const zeilenHinweise=(z:Zeile)=>z.hinweise.filter(h=>!STANDARD.test(h));
const berichtHinweise=(b:Bericht)=>b.ersetztDurch?[]:b.hinweise.filter(h=>!STANDARD.test(h));
function ordnerHinweise(s:Scan){return [...(s.auftragFehler?[`Laborauftrag: ${s.auftragFehler}`]:[]),...(s.auftrag?.warnings||[]).map(w=>`Laborauftrag: ${w}`),...s.u.hinweise,...s.fehler.map(f=>`„${f.name}“ nicht lesbar: ${f.text}`)];}
const hinweisZahl=(s:Scan)=>ordnerHinweise(s).length+s.u.zeilen.reduce((n,z)=>n+zeilenHinweise(z).length,0)+s.u.berichte.reduce((n,b)=>n+berichtHinweise(b).length,0);

/** Gerade importierte Berichte – bis „Ergebnisse übernehmen“ oder „Erst ansehen“ (nur in dieser Sitzung). */
let nachImport:string[]|null=null;
/** Aufgeklappte Proben der Übersicht (Gruppe|Probe). */
const aufgeklappt=new Set<string>();

function render(){
 const da=!!folder;$('start').hidden=da;$('projekt').hidden=!da;
 for(const id of ['btn-import','btn-neu'])($(id) as HTMLButtonElement).disabled=!da||beschaeftigt;
 const badge=$('projekt-badge');badge.hidden=!folder;if(folder){badge.innerHTML=`<b>${esc(folder.nr)}</b> ${esc(folder.ort)}`;badge.title=`Projektordner „${folder.name}“`;document.title=`${folder.name} · ResultKit`;}else document.title='ResultKit · Laborergebnisse';
 if(!folder)return;
 if(!scan){$('jetzt').className='jetzt';$('jetzt').innerHTML=`<p class="muted">Projektordner wird eingelesen …</p>`;for(const id of ['hinweise','u-kacheln','u-tabellen','berichte','berichte-kurz','berichte-zahl'])$(id).innerHTML='';$('u-filter').hidden=true;return;}
 renderJetzt(scan);renderHinweise(scan);renderUebersicht(scan);renderBerichte(scan);
}

// ---- Jetzt dran: der eine nächste Schritt ----
function renderJetzt(s:Scan){
 const gueltig=s.u.berichte.filter(b=>!b.ersetztDurch&&!b.ohneWerte).length;
 const j=jetztDran({proben:s.u.zeilen.length,berichte:s.u.berichte.length,gueltig,auftrag:!!s.auftrag,stand:s.stand,
  vorhanden:s.vorhanden?{stand:s.vorhanden.stand,uebernommen:s.vorhanden.uebernommen,vollstaendig:s.vorhanden.vollstaendig,ohneLage:ohneLage(s.vorhanden,s.auftrag)}:null,vorhandenFehler:s.vorhandenFehler,
  hinweise:hinweisZahl(s),importiert:nachImport});
 const knopf=(k:Knopf|undefined,haupt:boolean)=>k?`<button type="button"${haupt&&k.aktion==='uebernehmen'?' id="btn-uebernehmen"':''} class="${haupt?'primary':''}" data-aktion="${k.aktion}"${beschaeftigt&&k.aktion!=='ansehen'?' disabled':''}>${esc(k.text)}</button>`:'';
 const chip=(c:Chip)=>`<button type="button" class="chip ${c.art}" data-aktion="${c.aktion}" title="Proben und Berichte mit Hinweisen aufklappen">${esc(c.text)}</button>`;
 const el=$('jetzt');el.className=`jetzt ${j.art}${j.ok?' ok':''}`;el.dataset.art=j.art;
 el.innerHTML=`<div class="jetzt-text"><span class="eyebrow">${esc(j.eyebrow)} · ${esc(folder!.nr)}</span><h1>${esc(j.titel)}</h1>
  ${j.stand?`<p class="jetzt-stand">${esc(standText(s.u))}</p>`:''}<p class="muted">${esc(j.text)}</p>${j.chips.length?`<div class="chips">${j.chips.map(chip).join('')}</div>`:''}</div>
  <div class="jetzt-knoepfe">${knopf(j.haupt,true)}${knopf(j.neben,false)}</div>`;
}
function renderHinweise(s:Scan){
 const liste=ordnerHinweise(s);
 $('hinweise').innerHTML=liste.length?`<div class="hinweis-liste" role="note">${liste.map(h=>`<p>${esc(h)}</p>`).join('')}</div>`:'';
}
/** „⚠ Hinweise“: Proben und Berichte mit Hinweisen aufklappen und zum ersten springen. */
function hinweiseZeigen(){
 if(!scan)return;const s=scan;
 for(const g of uebersichtGruppen(s.u.zeilen))for(const z of g.zeilen){const q=quelleVon(s,z);if(q&&zeilenHinweise(q).length)aufgeklappt.add(`${g.gruppe}|${z.label}`);}
 if(s.u.berichte.some(b=>berichtHinweise(b).length))($('berichte-block') as HTMLDetailsElement).open=true;
 if(filter!=='alle'){filter='alle';merke('filter',filter);}
 renderUebersicht(s);
 const ziel=document.querySelector('#hinweise .hinweis-liste')||document.querySelector('.u-detail .u-hinweise')||document.querySelector('#berichte .bericht-hinweise');
 ziel?.scrollIntoView({behavior:'smooth',block:'center'});
}

// ---- Übersicht: Ergebnisse auf einen Blick, Zeile aufklappen für alles Weitere ----
type Filter='alle'|'auff'|'offen';
const merke=(k:string,v?:string)=>{try{if(v===undefined)return localStorage.getItem('resultkit-'+k)||'';localStorage.setItem('resultkit-'+k,v);}catch{/* ohne Speicher */}return v||'';};
let filter:Filter=(['auff','offen'].includes(merke('filter'))?merke('filter'):'alle') as Filter;
($('u-sort') as HTMLSelectElement).value=merke('sortierung')==='nr'?'nr':'ort';
/** Bewertung eines Messwerts für die Übersicht: Kategorie der Skala, BG/n. n. neutral. */
function bewertung(w:Wert):{text:string;farbe:string;index:number;titel:string}|null{
 const q=labQualifier(w.r);
 if(q==='below')return {text:'< BG',farbe:BELOW_LIMIT,index:-1,titel:`unter der Bestimmungsgrenze${w.loq?` (BG ${w.loq} ${w.u})`:''}`};
 if(q==='notDetected')return {text:'n. n.',farbe:NOT_DETECTED,index:-1,titel:'nicht nachweisbar'};
 if(q!=='measured')return null;
 const s=skala(w.p,w.u);if(!s.scale)return null;const i=rate(s.scale,labNumber(w.r));if(i<0)return null;
 return {text:s.scale.cats[i].name,farbe:s.scale.cats[i].color||UNRATED,index:i,titel:`${s.scale.name} (${s.quelle})`};
}
/** Ruhige Pastellfarben statt Vollfarbe: helle Fläche, dunkle Schrift aus derselben Farbe. */
const pastell=(farbe:string,inhalt:string,titel='')=>`<span class="u-chip" style="--c:${farbeSicher(farbe)}"${titel?` title="${esc(titel)}"`:''}>${inhalt}</span>`;
const ASBEST_ROT='#d0453a';
const auffaellig=(z:UZeile)=>!!(z.befund?.gefunden||(z.bewertet&&(bewertung(z.bewertet)?.index??0)>0));
const GTITEL:Record<Gruppe,string>={PAK:'PAK',Chlorid:'Chlorid',Asbest:'Asbest',Weitere:'Weitere Proben'};
/** Zeile der Prüfung zu einer Zeile der Übersicht (gleiche Bezeichnung). */
function quelleVon(s:Scan,z:UZeile):Zeile|undefined{return s.u.zeilen.find(x=>(x.label||x.ref)===z.label);}
function renderUebersicht(s:Scan){
 const gruppen=uebersichtGruppen(s.u.zeilen),nach=($('u-sort') as HTMLSelectElement).value as 'ort'|'nr';
 $('u-filter').hidden=!gruppen.length;
 if(!gruppen.length){$('u-kacheln').innerHTML='';$('u-tabellen').innerHTML='';return;}
 $('u-kacheln').innerHTML=gruppen.map(g=>{const n=g.zeilen.length,offen=n-g.mitErgebnis,auff=g.zeilen.filter(auffaellig).length;
  const vorl=g.zeilen.filter(z=>z.vorlaeufig).length;
  const teile=[g.gruppe==='Asbest'?`${auff} Asbest nachgewiesen`:auff?`${auff} auffällig`:'',vorl?`${vorl} vorläufig`:'',offen?`${offen} offen`:'',!offen&&!auff&&!vorl?'alle mit Ergebnis':''].filter(Boolean);
  return `<div class="u-kachel"><span class="u-k-name">${esc(GTITEL[g.gruppe])}</span><span class="u-k-zahl">${g.mitErgebnis} / ${n}</span><span class="u-k-text">${esc(teile.join(' · '))}</span></div>`;}).join('');
 const fokusDrin=!!document.activeElement?.closest('#m-tabelle');
 const stelle=ansicht==='stelle';$('u-sort').hidden=stelle;$('u-kopieren').hidden=!stelle;
 $('u-tipp').textContent=stelle?'Klick markiert (Umschalt/Strg für mehrere) · Doppelklick oder Enter: Details · Strg+C kopiert für Excel':'Zeile anklicken: alle Parameter, Hinweise und Prüfbericht';
 document.querySelectorAll<HTMLButtonElement>('[data-ansicht]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ansicht===ansicht)));
 $('u-tabellen').innerHTML=stelle?mTabelle(s,gruppen):gruppen.map(g=>uTabelle(s,g,nach)).join('');
 if(stelle){markierungZeigen();if(fokusDrin)$('m-tabelle')?.focus({preventScroll:true});}
 document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
}
/** Prüfberichte einer Tabelle mit Datum, z. B. „Prüfbericht AR-1-01 vom 12.10.2026“ oder „Prüfberichte AR-1-01 (12.10.), AR-1-04 (vorläufig, 20.10.)“. */
function berichtZeile(codes:string[],berichte:Bericht[]){
 const b=codes.map(c=>berichte.find(x=>x.bericht===c)).filter(Boolean) as Bericht[];if(!b.length)return '';
 if(b.length===1)return `Prüfbericht ${b[0].bericht}${b[0].vorlaeufig?' (vorläufig)':''}${b[0].datum?` vom ${datum(b[0].datum)}`:''}`;
 return `Prüfberichte ${b.map(x=>`${x.bericht}${x.vorlaeufig||x.datum?` (${[x.vorlaeufig?'vorläufig':'',x.datum?datum(x.datum).slice(0,6):''].filter(Boolean).join(', ')})`:''}`).join(', ')}`;
}
// ---- Ansicht „Nach Stelle“ (ab 1.4.0): eine Zeile je Probenahmestelle, Lesen wie in Excel ----
// Nur lesen: sortieren über den Spaltenkopf, Zeilen markieren (Klick, Umschalt, Strg, Ziehen, Pfeiltasten), Details mit
// Doppelklick oder Enter, Strg+C kopiert als Tabelle für Excel/Word. Werte und Bezeichnungen sind nie bearbeitbar –
// sie kommen aus dem Prüfbericht des Labors und aus LabelKit.
let ansicht:'stelle'|'art'=merke('ansicht')==='art'?'art':'stelle';
let msort:{s:MSpalte;auf:boolean}=(()=>{try{const v=JSON.parse(merke('msort')||'null');if(v&&['probe','stelle','PAK','Chlorid','Asbest','Weitere'].includes(v.s)&&typeof v.auf==='boolean')return v;}catch{/* alt */}return {s:'stelle',auf:true};})();
let mZeilen:MZeile[]=[],mGruppen:UGruppe[]=[],cursor:string|null=null,anker:string|null=null;
const markiert=new Set<string>();
const mFilter=(r:MZeile)=>filter==='offen'?Object.values(r.zellen).some(z=>z!.ausstehend):filter==='auff'?Object.values(r.zellen).some(z=>auffaellig(z!)):true;
function mTabelle(s:Scan,gruppen:UGruppe[]){
 mGruppen=gruppen;
 mZeilen=sortiereMatrix(matrix(gruppen),msort.s,msort.auf).filter(mFilter);
 const keys=new Set(mZeilen.map(r=>r.key));for(const k of [...markiert])if(!keys.has(k))markiert.delete(k);if(cursor&&!keys.has(cursor))cursor=null;
 const spalten=gruppen.map(g=>g.gruppe),n=2+spalten.length;
 const kopf=(id:MSpalte,titel:string)=>{const an=msort.s===id;return `<th scope="col" aria-sort="${an?(msort.auf?'ascending':'descending'):'none'}"><button type="button" class="m-sort" data-msort="${id}" title="Sortieren${an?` – erneut klicken: ${msort.auf?'absteigend':'aufsteigend'}`:''}">${esc(titel)}<span class="m-pfeil" aria-hidden="true">${an?(msort.auf?'▲':'▼'):''}</span></button></th>`;};
 const titel=(g:UGruppe)=>`${SPALTE_TITEL[g.gruppe]}${g.einheit&&(g.gruppe==='PAK'||g.gruppe==='Chlorid')?` (${g.einheit})`:''}`;
 const codes=[...new Set(gruppen.flatMap(g=>g.zeilen.flatMap(z=>z.berichte)))];
 const leer=`<tr><td colspan="${n}" class="muted">${filter==='offen'?'Keine offenen Proben.':filter==='auff'?'Keine auffälligen Proben.':'Keine Proben.'}</td></tr>`;
 const zeile=(r:MZeile)=>{const key=`M|${r.key}`,auf=aufgeklappt.has(key),proben=gruppen.map(g=>({g,z:r.zellen[g.gruppe]})).filter(x=>x.z);
  const zellen=gruppen.map(g=>{const z=r.zellen[g.gruppe];return `<td>${z?`${ergebnis(g.gruppe,g.einheit,z)}${hinweis(z,quelleVon(s,z))}`:'<span class="m-leer" aria-label="keine Probe">–</span>'}</td>`;}).join('');
  const det=auf?`<tr class="u-detail"><td colspan="${n}">${proben.map(({g,z})=>{const q=quelleVon(s,z!);return q?`<h3 class="m-det-titel">${esc(z!.label)} · ${esc(GTITEL[g.gruppe])}</h3>${probeDetails(s,q)}`:'';}).join('')}</td></tr>`:'';
  return `<tr class="u-zeile m-zeile${auf?' auf':''}" data-m="${esc(r.key)}" aria-selected="false"><th scope="row"><button type="button" class="u-auf" tabindex="-1" aria-expanded="${auf}" title="${auf?'Details zuklappen':'Alle Parameter, Hinweise und Prüfbericht zeigen'}">${esc(r.labels.join(' · '))}</button></th><td>${esc(r.stelle)}</td>${zellen}</tr>${det}`;};
 return `<section class="u-gruppe m-gruppe" aria-label="Ergebnisse nach Probenahmestelle"><h2>Nach Probenahmestelle <small>${mZeilen.length} Zeile${mZeilen.length===1?'':'n'}${codes.length?` · ${esc(berichtZeile(codes,s.u.berichte))}`:''}</small></h2>${gruppen.map(g=>legendeFuer(g,gruppen.length>1)).join('')}
  <div class="m-scroll" id="m-tabelle" tabindex="0" aria-label="Ergebnistabelle: Pfeiltasten wählen, Enter zeigt Details, Strg+C kopiert"><table class="u-tabelle m-tabelle" role="grid" aria-multiselectable="true" aria-readonly="true"><thead><tr>${kopf('probe','Probe')}${kopf('stelle','Probenahmestelle')}${gruppen.map(g=>kopf(g.gruppe,titel(g))).join('')}</tr></thead>
  <tbody>${mZeilen.map(zeile).join('')||leer}</tbody></table></div></section>`;
}
/** Markierung und Cursor ohne neues Zeichnen anzeigen. */
function markierungZeigen(){
 document.querySelectorAll<HTMLElement>('#m-tabelle tr.m-zeile').forEach(tr=>{const k=tr.dataset.m!;tr.classList.toggle('sel',markiert.has(k));tr.classList.toggle('cur',k===cursor);tr.setAttribute('aria-selected',String(markiert.has(k)));});
 if(cursor)document.querySelector(`#m-tabelle tr.m-zeile[data-m="${CSS.escape(cursor)}"]`)?.scrollIntoView({block:'nearest'});
}
function markiere(key:string,art:'eins'|'bereich'|'umschalten'){
 const idx=(k:string|null)=>k?mZeilen.findIndex(r=>r.key===k):-1;
 if(art==='bereich'&&anker&&idx(anker)>=0){const a=idx(anker),b=idx(key);markiert.clear();for(let i=Math.min(a,b);i<=Math.max(a,b);i++)markiert.add(mZeilen[i].key);}
 else if(art==='umschalten'){if(markiert.has(key))markiert.delete(key);else markiert.add(key);anker=key;}
 else{markiert.clear();markiert.add(key);anker=key;}
 cursor=key;markierungZeigen();
}
function detailUmschalten(key:string){if(!scan)return;const k=`M|${key}`;if(aufgeklappt.has(k))aufgeklappt.delete(k);else aufgeklappt.add(k);cursor=key;renderUebersicht(scan);$('m-tabelle')?.focus({preventScroll:true});}
/** Markierte Zeilen (sonst alle sichtbaren) als Tabelle: Text mit Tabulatoren für Excel, HTML-Tabelle für Word. */
function kopierDaten(){
 const rows=markiert.size?mZeilen.filter(r=>markiert.has(r.key)):mZeilen,d=tabelleDaten(rows,mGruppen);
 const html=`<table><thead><tr>${d.kopf.map(k=>`<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${d.zeilen.map(z=>`<tr>${z.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 return {text:alsTSV(d),html,n:rows.length};
}
const kopiertText=(n:number)=>`${n} Zeile${n===1?'':'n'} kopiert – in Excel oder Word einfügen (Strg+V).`;
/** Hinweise an einem Ergebnis: ausstehend, vorläufig, nicht beauftragt, ⚠ Hinweis. */
const hinweis=(z:UZeile,q:Zeile|undefined)=>`${z.ausstehend?'<span class="u-aus">ausstehend</span>':''}${!z.ausstehend&&z.vorlaeufig?' <small class="u-vorl">vorläufig</small>':''}${z.nichtBeauftragt?' <small class="u-nb" title="Steht im Prüfbericht, aber nicht im Laborauftrag aus LabelKit">nicht beauftragt</small>':''}${q&&zeilenHinweise(q).length?` <small class="u-hw" title="${esc(zeilenHinweise(q).join(' '))}">⚠ Hinweis</small>`:''}`;
/** Legende einer Probenart: die Kategorien der verwendeten Skalen mit Bereich – die Werte selbst tragen die Farbe. */
function legendeFuer(g:UGruppe,mitName=false){
 const skalen=new Map<string,{scale:Scale;u:string}>();let bg=false;
 for(const z of g.zeilen)if(z.bewertet){const w=z.bewertet,q=labQualifier(w.r);if(q==='below'||q==='notDetected')bg=true;if(q==='measured'){const k=skala(w.p,w.u);if(k.scale)skalen.set(`${k.scale.name}|${w.u}`,{scale:k.scale,u:w.u});}}
 const vor=mitName?`<b>${esc(GTITEL[g.gruppe])}</b> · `:'';
 return g.gruppe==='Asbest'?`<p class="u-legende">${vor}Befund wie im Prüfbericht · ${pastell(ASBEST_ROT,'Asbest nachgewiesen')}</p>`
  :(g.gruppe==='PAK'||g.gruppe==='Chlorid')?(skalen.size?[...skalen.values()].map(({scale,u})=>`<p class="u-legende">${vor}${esc(scale.name)}: ${scale.cats.map((c,i)=>pastell(c.color||UNRATED,`${esc(c.name)} <small>${esc(rangeText(scale,i,u))}</small>`)).join(' ')}${bg?` ${pastell(BELOW_LIMIT,'&lt; BG')}`:''}</p>`).join(''):`<p class="u-legende">${vor}ohne Bewertungsskala</p>`):'';
}
/** Ergebnis einer Probe als Zelle (Farbe nach Skala, Asbest-Befund leicht rot) – in beiden Ansichten gleich. */
function ergebnis(gruppe:Gruppe,einheit:string,z:UZeile){
 if(gruppe==='Asbest')return z.befund?(z.befund.gefunden?pastell(ASBEST_ROT,esc(z.befund.text),'Asbest nachgewiesen'):esc(z.befund.text)):'';
 if(gruppe!=='Weitere'&&!z.haupt)return z.ausstehend?'':`<span class="u-aus">kein ${gruppe==='PAK'?'Σ16-EPA-PAK':'Chlorid'}-Wert im Bericht</span>`;
 if(gruppe==='Weitere')return z.weitere.map(w=>`${esc(shortParameter(w.p))} <span class="u-wert">${esc(w.r)}</span> ${esc(w.u)}`).join(' · ');
 const w=z.haupt!,b=z.bewertet?bewertung(z.bewertet):null,text=`${esc(w.r)}${w.u&&w.u!==einheit?` <small>${esc(w.u)}</small>`:''}`;
 const titel=[b?.text,z.original?`laut Bericht ${z.original}`:''].filter(Boolean).join(' · ');
 return b?pastell(b.farbe,`<span class="u-wert">${text}</span>`,titel):`<span class="u-wert"${titel?` title="${esc(titel)}"`:''}>${text}</span>`;
}
function uTabelle(s:Scan,g:UGruppe,nach:'ort'|'nr'){
 const berichte=s.u.berichte;
 let zeilen=sortiere(g.zeilen,nach);
 if(filter==='offen')zeilen=zeilen.filter(z=>z.ausstehend);else if(filter==='auff')zeilen=zeilen.filter(auffaellig);
 const legende=legendeFuer(g);
 const codes=[...new Set(g.zeilen.flatMap(z=>z.berichte))];
 const kopf=g.gruppe==='PAK'?`Σ16 EPA-PAK${g.einheit?` (${g.einheit})`:''}`:g.gruppe==='Chlorid'?`Chlorid${g.einheit?` (${g.einheit})`:''}`:g.gruppe==='Asbest'?'Befund':'Ergebnis';
 const leer=`<tr><td colspan="3" class="muted">${filter==='offen'?'Keine offenen Proben.':filter==='auff'?'Keine auffälligen Proben.':''}</td></tr>`;
 const zeile=(z:UZeile)=>{const erg=ergebnis(g.gruppe,g.einheit,z),q=quelleVon(s,z),key=`${g.gruppe}|${z.label}`,auf=aufgeklappt.has(key);
  return `<tr class="u-zeile${z.ausstehend?' u-offen':''}${auf?' auf':''}" data-zeile="${esc(key)}"><th scope="row"><button type="button" class="u-auf" aria-expanded="${auf}" title="${auf?'Details zuklappen':'Alle Parameter, Hinweise und Prüfbericht zeigen'}">${esc(z.label)}</button></th><td>${esc(z.stelle)}</td><td>${erg}${hinweis(z,q)}</td></tr>${auf&&q?`<tr class="u-detail"><td colspan="3">${probeDetails(s,q)}</td></tr>`:''}`;};
 return `<section class="u-gruppe" aria-label="${esc(GTITEL[g.gruppe])}"><h2>${esc(GTITEL[g.gruppe])} <small>${g.zeilen.length} Probe${g.zeilen.length===1?'':'n'}${codes.length?` · ${esc(berichtZeile(codes,berichte))}`:''}</small></h2>${legende}
  <div class="tabelle-scroll"><table class="u-tabelle"><thead><tr><th scope="col">Probe</th><th scope="col">${g.gruppe==='Asbest'?'Material und Stelle':'Probenahmestelle'}</th><th scope="col">${esc(kopf)}</th></tr></thead>
  <tbody>${zeilen.map(zeile).join('')||leer}</tbody></table></div></section>`;
}
/** Aufgeklappte Probe: alle Parameter, Hinweise, Stand, Prüfbericht, Labor-Nr. und Probenahme. */
function probeDetails(s:Scan,z:Zeile){
 const berichte=z.berichte.map(c=>s.u.berichte.find(b=>b.bericht===c)).filter(Boolean) as Bericht[];
 const probe=berichte.filter(b=>!b.ersetztDurch).concat(berichte).flatMap(b=>b.proben).find(p=>(p.label||p.ref)===(z.label||z.ref));
 const hinweise=z.hinweise;
 const bericht=(b:Bericht)=>`${esc(b.bericht||b.sources.xml||b.sources.pdf||'ohne Nummer')}${b.vorlaeufig?' (vorläufig)':''}${b.datum?` vom ${esc(datum(b.datum))}`:''}${b.ersetztDurch?' – ersetzt':''} · ${b.sources.xml?'XML ✓':'XML fehlt'} · ${b.sources.pdf?'PDF ✓':'ohne PDF'}`;
 const feld=(titel:string,inhalt:string,cls='')=>inhalt?`<div${cls?` class="${cls}"`:''}><dt>${titel}</dt><dd>${inhalt}</dd></div>`:'';
 return `<dl class="u-det">
  ${feld(`Alle Parameter (${z.werte.length})`,z.werte.length?`<span class="u-params">${z.werte.map(w=>wertZelle(w,true)).join(' ')}</span>`:'<span class="muted">noch keine Messwerte</span>','u-det-breit')}
  ${feld('Hinweise',hinweise.length?`<ul class="u-hinweise">${hinweise.map(h=>`<li>${esc(h)}</li>`).join('')}</ul>`:'')}
  ${feld('Stand',esc(STATUS[z.status]))}
  ${feld(berichte.length===1?'Prüfbericht':'Prüfberichte',berichte.map(bericht).join('<br>'))}
  ${feld('Labor-Nr. · Probenahme',esc([probe?.labNr,datum(z.datum),[...new Set([z.typ,...(z.art||'').split(' · ')].filter(Boolean))].join(' · ')].filter(Boolean).join(' · ')),'mono-feld')}
  ${z.ref&&z.ref!==z.label?feld('Probenreferenz',esc(z.ref)):''}
 </dl>`;
}
function renderBerichte(s:Scan){
 const b=s.u.berichte,gueltig=b.filter(x=>!x.ersetztDurch),ersetzt=b.length-gueltig.length;
 $('berichte-zahl').textContent=b.length?`${b.length}`:'';
 const codes=gueltig.map(x=>x.bericht).filter(Boolean);
 $('berichte-kurz').textContent=[b.length?berichtZeile(codes,b):'Noch keine',ersetzt?`${ersetzt} ersetzt`:'',s.fehler.length?`${s.fehler.length} nicht lesbar`:'','Neue hier ablegen'].filter(Boolean).join(' · ');
 if(!b.length||s.fehler.length)($('berichte-block') as HTMLDetailsElement).open=true;
 $('berichte').innerHTML=b.length?[...b].sort((x,y)=>(x.ersetztDurch?1:0)-(y.ersetztDurch?1:0)||y.geaendert-x.geaendert).map(berichtKarte).join(''):`<p class="leer">${s.ohneOrdner?`Noch kein Ordner „${esc(LABOR)}“ im Projekt – er wird beim ersten Import angelegt.`:`Noch keine Prüfberichte in „${esc(LABOR)}“.`}</p>`;
}
function berichtKarte(b:Bericht){
 const proben=b.proben,daten=[...new Set(proben.map(p=>p.datum).filter(Boolean))].sort() as string[];
 const zustand=b.ersetztDurch?['ersetzt','ersetzt']:b.ohneWerte?['ohne Messwerte','offen']:b.vorlaeufig?['vorläufig','vorl']:['endgültig','ok'];
 const spalten=[...new Map(proben.flatMap(p=>kernwerte(p.werte||[])).map(w=>[`${w.p}|${w.u}`,w])).values()].slice(0,5);
 const alle=[...new Map(proben.flatMap(p=>p.werte||[]).map(w=>[`${w.p}|${w.u}`,w])).values()];
 const zelle=(werte:Wert[]|undefined,p:string,u:string)=>{const w=wertFuer(werte||[],p,u);return w?wertZelle(w):'<span class="muted">–</span>';};
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
// ---- Projekt öffnen ----
async function neuEinlesen(still=false){
 const f=folder;if(!f)return;const lauf=++laeuft;
 try{const s=await einlesen(f);if(lauf!==laeuft||folder!==f)return;scan=s;render();}
 catch(e){if(lauf===laeuft&&!still)fail(e);}
}
async function oeffnen(dir:Dir){
 let f:ProjectFolder;try{f=await openFolder(dir);}catch(e){fail(e);return;}
 folder=f;scan=null;einstellungen=null;cache.clear();nachImport=null;aufgeklappt.clear();($('berichte-block') as HTMLDetailsElement).open=false;$('ordner-frage').hidden=true;render();PROJEKT_URL.setzen(f.name);
 window.MosaikLeiste?.aktualisieren();
 let nutzung:unknown='';try{nutzung=(await readProjectData(f)).nutzung;}catch{/* ohne Projektdaten */}
 if(folder!==f)return;setNutzung(nutzung);   // inzwischen ein anderes Projekt geöffnet
 const e=await planEinstellungen(f);if(folder!==f)return;einstellungen=e;
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
  nachImport=null;toast(`Übernommen: ${standText(u)}. PlanKit und FotoKit verwenden jetzt diesen Stand.`);
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
   nachImport=wahl.map(v=>v.report?.bericht||v.dateien.map(x=>x.name).join(' + '));
   toast(`${n} Datei${n===1?'':'en'} in „${LABOR}“ abgelegt.`);$('jetzt').scrollIntoView({block:'nearest'});
  }catch(e){fail(e);}
  await neuEinlesen();
 };
 d.showModal();
}

// ---- Bedienung ----
$('btn-projekt').onclick=$('start-projekt').onclick=()=>void projektWaehlen();
$('btn-neu').onclick=()=>void neuEinlesen();
$('projekt').addEventListener('click',e=>{const t=e.target as HTMLElement;
 const f=t.closest<HTMLElement>('[data-filter]');if(f){filter=f.dataset.filter as Filter;merke('filter',filter);if(scan)renderUebersicht(scan);return;}
 const an=t.closest<HTMLElement>('[data-ansicht]');if(an){ansicht=an.dataset.ansicht==='art'?'art':'stelle';merke('ansicht',ansicht);if(scan)renderUebersicht(scan);return;}
 const so=t.closest<HTMLElement>('[data-msort]');if(so){const sp=so.dataset.msort as MSpalte;msort=msort.s===sp?{s:sp,auf:!msort.auf}:{s:sp,auf:sp==='probe'||sp==='stelle'};   // Werte: zuerst die höchsten
  merke('msort',JSON.stringify(msort));if(scan)renderUebersicht(scan);$('m-tabelle')?.focus({preventScroll:true});return;}
 const mz=t.closest<HTMLElement>('tr.m-zeile');if(mz){if(t.closest('.u-auf'))detailUmschalten(mz.dataset.m!);return;}   // Markieren: über mousedown
 const a=t.closest<HTMLButtonElement>('[data-aktion]');
 if(a){const aktion=a.dataset.aktion as Aktion;
  if(aktion==='uebernehmen')void uebernehmen();
  else if(aktion==='import'){wahl.value='';wahl.click();}
  else if(aktion==='ansehen'){nachImport=null;if(scan)renderJetzt(scan);document.getElementById('u-kacheln')?.scrollIntoView({behavior:'smooth',block:'start'});}
  else if(aktion==='hinweise')hinweiseZeigen();
  return;}
 // Probe auf- und zuklappen: Klick auf die Zeile (nicht beim Markieren von Text)
 const tr=t.closest<HTMLElement>('tr.u-zeile');if(!tr||!scan||String(getSelection()||''))return;
 const key=tr.dataset.zeile!;if(aufgeklappt.has(key))aufgeklappt.delete(key);else aufgeklappt.add(key);
 renderUebersicht(scan);
 document.querySelector<HTMLButtonElement>(`tr.u-zeile[data-zeile="${CSS.escape(key)}"] .u-auf`)?.focus({preventScroll:true});});
// Nach Stelle: markieren mit Maus (auch Ziehen), Tastatur und Kopieren – nur lesen.
let ziehMarkierung=false;
$('u-tabellen').addEventListener('mousedown',e=>{const tr=(e.target as HTMLElement).closest<HTMLElement>('tr.m-zeile');if(!tr||e.button>0||(e.target as HTMLElement).closest('.u-auf'))return;
 e.preventDefault();$('m-tabelle')?.focus({preventScroll:true});const k=tr.dataset.m!;markiere(k,e.shiftKey?'bereich':e.ctrlKey||e.metaKey?'umschalten':'eins');ziehMarkierung=!e.ctrlKey&&!e.metaKey;});
$('u-tabellen').addEventListener('mouseover',e=>{if(!ziehMarkierung)return;const tr=(e.target as HTMLElement).closest<HTMLElement>('tr.m-zeile');if(tr&&tr.dataset.m!==cursor)markiere(tr.dataset.m!,'bereich');});
window.addEventListener('mouseup',()=>{ziehMarkierung=false;});
$('u-tabellen').addEventListener('dblclick',e=>{const tr=(e.target as HTMLElement).closest<HTMLElement>('tr.m-zeile');if(tr&&!(e.target as HTMLElement).closest('.u-auf'))detailUmschalten(tr.dataset.m!);});
$('u-tabellen').addEventListener('keydown',e=>{
 if(!(e.target as HTMLElement).closest('#m-tabelle')||!mZeilen.length)return;
 const i=cursor?mZeilen.findIndex(r=>r.key===cursor):-1,geh=(j:number)=>{const k=mZeilen[Math.max(0,Math.min(mZeilen.length-1,j))].key;markiere(k,e.shiftKey?'bereich':'eins');};
 if(e.key==='ArrowDown'){e.preventDefault();geh(i<0?0:i+1);}
 else if(e.key==='ArrowUp'){e.preventDefault();geh(i<0?0:i-1);}
 else if(e.key==='PageDown'){e.preventDefault();geh(i+10);}
 else if(e.key==='PageUp'){e.preventDefault();geh(i-10);}
 else if(e.key==='Home'){e.preventDefault();geh(0);}
 else if(e.key==='End'){e.preventDefault();geh(mZeilen.length-1);}
 else if(e.key==='Enter'&&cursor){e.preventDefault();detailUmschalten(cursor);}
 else if(e.key==='Escape'){if(cursor&&aufgeklappt.has(`M|${cursor}`)){e.preventDefault();detailUmschalten(cursor);}else if(markiert.size){e.preventDefault();markiert.clear();markierungZeigen();}}
 else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();markiert.clear();for(const r of mZeilen)markiert.add(r.key);markierungZeigen();}
});
// Strg+C in der Tabelle: Tabelle statt markiertem Text (markierter Text in den Details wird normal kopiert)
document.addEventListener('copy',e=>{if(ansicht!=='stelle'||!document.activeElement?.closest('#m-tabelle')||String(getSelection()||'').trim()||!e.clipboardData)return;
 const d=kopierDaten();e.preventDefault();e.clipboardData.setData('text/plain',d.text);e.clipboardData.setData('text/html',d.html);toast(kopiertText(d.n));});
$('u-kopieren').onclick=async()=>{const d=kopierDaten();
 try{if('ClipboardItem' in window)await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([d.text],{type:'text/plain'}),'text/html':new Blob([d.html],{type:'text/html'})})]);else await navigator.clipboard.writeText(d.text);toast(kopiertText(d.n));}
 catch{toast('Kopieren wurde vom Browser blockiert. In der Tabelle Strg+C drücken.',true);}};
$('u-sort').onchange=()=>{merke('sortierung',($('u-sort') as HTMLSelectElement).value);if(scan)renderUebersicht(scan);};
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
