// ResultKit 2.0 – einfache Oberfläche (Spektron Schritt 3, Plan: resultkit-schritt3-plan.md).
// Kopfband (Leiste v3) statt eigener Kopfzeile, Fußleiste mit „Mehr …“, Stand und EINER Hauptaktion, die aus „Jetzt dran“ kommt.
// Nur Oberfläche: Die Zustandsmaschine jetztDran() bleibt die Quelle; die Fußleiste klickt die (unsichtbaren) Knöpfe der Karte.
// Die alten Kopfzeilen-Knöpfe liegen unsichtbar in #rk-alt und werden aus „Mehr …“ ausgelöst (IDs und Handler unverändert).
import type {Jetzt} from './jetzt';

export interface RkHooks {
 /** Projekt geöffnet? */projekt():boolean;
 /** Stand in einem Satz (standText) oder '' */stand():string;
 /** Zuletzt gezeigtes „Jetzt dran“ (null: noch keins) */jetzt():Jetzt|null;
 /** Übernahme oder Import läuft */beschaeftigt():boolean;
 /** Ansicht der Übersicht */ansicht():'stelle'|'art';
 version:string;
}
type MehrEintrag={text?:string;id?:string;title?:string;onclick?:()=>void;hidden?:boolean;disabled?:boolean;trenner?:boolean};
type ML={mehr?:(k:HTMLElement,e:MehrEintrag[])=>void;aktualisieren?:()=>void};

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
function h<K extends keyof HTMLElementTagNameMap>(tag:K,attrs:Record<string,string>={},text?:string):HTMLElementTagNameMap[K]{const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
const MEHR_ICON='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>';
/** Ablauf-Zeile in der Karte (E2, reine Anzeige): welcher der drei Schritte ist dran? */
const ABLAUF:Record<string,number>={leer:0,warten:0,ohneWerte:0,importiert:1,uebernehmen:1,geaendert:1,unlesbar:1,fertig:2};

export class Oberflaeche {
 constructor(private hooks:RkHooks){this.aufbauen();}

 private aufbauen(){
  document.body.classList.add('rk2');
  // Alte Kopfzeile: unsichtbar, Knöpfe bleiben (Mehr … klickt sie)
  const alt=h('div',{id:'rk-alt',hidden:''});document.body.append(alt);
  const kopf=document.querySelector('header.kopf');if(kopf)alt.append(kopf);
  // Ansicht-Umschalter „Nach Stelle / Je Probenart“ und Tipp bleiben in der Filterzeile (Klicks laufen über #projekt),
  // sind aber unsichtbar (einfach.css): die Ansicht wählt man unter „Mehr …“ (E4), der Tipp steht als Tooltip an der Tabelle.
  // Fußleiste
  const fuss=h('footer',{id:'rk-fuss'});
  const mehr=h('button',{type:'button',id:'rk-mehr',class:'sp-knopf','aria-haspopup':'menu',title:'Prüfberichte, Ansicht, Ordner neu einlesen, anderes Projekt, Kurzanleitung, Version, Handbuch …'});mehr.innerHTML=MEHR_ICON+'Mehr …';mehr.onclick=()=>this.mehr(mehr);
  const stand=h('span',{id:'rk-stand',class:'rk-stand'});
  const neben=h('button',{type:'button',id:'rk-neben',class:'sp-knopf',hidden:''});neben.onclick=()=>this.klick(neben);
  const haupt=h('button',{type:'button',id:'rk-haupt',class:'sp-haupt'});haupt.onclick=()=>this.klick(haupt);
  fuss.append(mehr,stand,neben,haupt);document.body.append(fuss);
  // Kurzanleitung + Version (statt Fußzeile und Hilfe-Link)
  const d=h('dialog',{id:'rk-hilfe','aria-labelledby':'rk-hilfe-titel'});
  d.innerHTML=`<form method="dialog"><button class="schliessen" aria-label="Schließen">×</button></form>
   <span class="eyebrow">KURZANLEITUNG</span><h2 id="rk-hilfe-titel">ResultKit – Laborergebnisse</h2>
   <ol class="rk-anleitung">
    <li><b>Prüfberichte importieren.</b> Eurofins-XML (und die PDF dazu) auf die Seite ziehen oder unten „Berichte importieren“. ResultKit legt eine unveränderte Kopie in „Laborergebnisse“ ab – nichts wird überschrieben. Die Messwerte kommen aus der XML, die PDF dient dem Abgleich.</li>
    <li><b>Ergebnisse prüfen.</b> Oben steht, was dran ist; darunter je Probenart der Zähler und die Tabelle (Ort · Probe · Wert). Farbpunkt = Bewertung nach Skala (VdS 2357 oder Büro-Skala), ⚠ = Hinweis. Zeile anklicken zeigt alle Parameter, Hinweise und den Prüfbericht. „Nur auffällige“ / „Nur offene“ filtern; „Für Excel kopieren“ kopiert die Tabelle (oder markierte Zeilen, Strg+C).</li>
    <li><b>Ergebnisse übernehmen.</b> Der große Knopf unten rechts schreibt die geltenden Werte nach „_Ergebnisse.json“ – erst dann sehen PlanKit, FotoKit und die Projektzentrale die Werte. Kommen weitere Berichte: importieren und erneut übernehmen. Danach führt „Weiter“ zum Probenplan.</li>
   </ol>
   <p>Unter <b>„Mehr …“</b> unten links: Prüfberichte zeigen, Ansicht „Nach Stelle“ (eine Zeile je Probenahmestelle, PAK und Chlorid nebeneinander) oder „Je Probenart“, Ordner neu einlesen, anderes Projekt öffnen, Handbuch, Rückmeldung.</p>
   <h3 id="rk-aenderungen">Neu in ResultKit 2.0.0 · 05.11.2026</h3>
   <p>Kopfband wie in den anderen Spektron-Apps, eine Hauptaktion unten rechts, „Mehr …“ unten links. Ruhigere Tabelle: Farbpunkte statt farbiger Pillen, Legende in einer Zeile, Probennummer klein am Wert, Zwischenzeile je Geschoss, kompakte Details. Werte, Regeln, Import, Übernahme und die Datei „_Ergebnisse.json“ sind unverändert.</p>
   <p id="rk-version-zeile" class="muted klein">ResultKit v${this.hooks.version} · liest und schreibt nur im Projektordner · keine Daten verlassen diesen Rechner</p>`;
  document.body.append(d);
  // Ablauf-Zeile in der Karte „Jetzt dran“ (E2 Variante A)
  this.ablaufZeile();
  this.nachRender();
 }
 private ablaufZeile(){
  const jetzt=document.getElementById('jetzt');if(!jetzt||document.getElementById('rk-ablauf'))return;
  const z=h('ol',{id:'rk-ablauf',class:'rk-ablauf','aria-label':'Ablauf'});
  for(const t of ['Berichte importiert','Geprüft','Übernommen'])z.append(h('li',{},t));
  jetzt.before(z);
 }

 /** Fußleiste → unsichtbarer Kartenknopf bzw. Kopfband-„Weiter“. */
 private klick(b:HTMLButtonElement){
  const a=b.dataset.aktion;if(!a||b.disabled)return;
  if(a==='kopfband'){this.kopfbandWeiter()?.click();return;}
  if(a==='start'){$('start-projekt').click();return;}
  if(a==='erlauben'){$('ordner-erlauben').click();return;}
  document.querySelector<HTMLButtonElement>(`#jetzt .jetzt-knoepfe button[data-aktion="${a}"]`)?.click();
 }
 private kopfbandWeiter(){return document.querySelector<HTMLAnchorElement>('#mosaikLeiste a.ml-weiter');}

 private mehr(knopf:HTMLElement){
  const ML=(window as unknown as {MosaikLeiste?:ML}).MosaikLeiste;if(!ML?.mehr)return;
  const projekt=this.hooks.projekt(),ansicht=this.hooks.ansicht(),dis=(id:string)=>!!(document.getElementById(id) as HTMLButtonElement|null)?.disabled;
  const umschalten=(a:'stelle'|'art')=>document.querySelector<HTMLButtonElement>(`.u-ansicht [data-ansicht="${a}"]`)?.click();
  ML.mehr(knopf,[
   {text:'Prüfberichte zeigen',id:'rk-m-berichte',title:'Die Prüfberichte im Ordner „Laborergebnisse“ (XML/PDF, alle Parameter) und die Ablage für neue Berichte',hidden:!projekt,onclick:()=>{const b=$<HTMLDetailsElement>('berichte-block');b.open=true;b.scrollIntoView({behavior:'smooth',block:'start'});}},
   {trenner:true},
   {text:(ansicht==='stelle'?'✓ ':'')+'Ansicht: Nach Stelle',id:'rk-m-stelle',title:'Eine Zeile je Probenahmestelle – PAK, Chlorid und Asbest derselben Stelle nebeneinander (gilt in diesem Browser)',hidden:!projekt,onclick:()=>umschalten('stelle')},
   {text:(ansicht==='art'?'✓ ':'')+'Ansicht: Je Probenart',id:'rk-m-art',title:'Eine Tabelle je Probenart (gilt in diesem Browser)',hidden:!projekt,onclick:()=>umschalten('art')},
   {trenner:true},
   {text:'Ordner neu einlesen',id:'rk-m-neu',title:'Projektordner neu einlesen (passiert beim Zurückkommen ins Fenster von selbst)',hidden:!projekt,disabled:dis('btn-neu'),onclick:()=>$('btn-neu').click()},
   {text:'Anderes Projekt öffnen …',id:'rk-m-projekt',title:'Projektordner wählen (z. B. „26.0123 Köln“) – zuletzt benutzte Projekte stehen oben im Kopfband',disabled:dis('btn-projekt')&&dis('start-projekt'),onclick:()=>(projekt?$('btn-projekt'):$('start-projekt')).click()},
   {trenner:true},
   {text:'Kurzanleitung',id:'rk-m-hilfe',onclick:()=>this.hilfe()},
   {text:'Version und Änderungen',id:'rk-m-version',onclick:()=>{this.hilfe();requestAnimationFrame(()=>document.getElementById('rk-aenderungen')?.scrollIntoView({block:'start'}));}},
  ]);
 }
 private hilfe(){const d=$<HTMLDialogElement>('rk-hilfe');if(!d.open)d.showModal();}

 /** Nach jedem render(): Fußleiste und Ablauf-Zeile aus dem Zustand. */
 nachRender(){
  const projekt=this.hooks.projekt(),j=this.hooks.jetzt(),busy=this.hooks.beschaeftigt();
  const haupt=$<HTMLButtonElement>('rk-haupt'),neben=$<HTMLButtonElement>('rk-neben'),stand=$('rk-stand');
  const setze=(b:HTMLButtonElement,text:string,aktion:string,disabled=false,title='')=>{b.hidden=false;if(b.textContent!==text)b.textContent=text;b.dataset.aktion=aktion;b.disabled=disabled;b.title=title;};
  neben.hidden=true;delete neben.dataset.aktion;
  document.body.classList.toggle('rk-ohne-projekt',!projekt);
  if(!projekt){
   const frage=!$('ordner-frage').hidden;
   if(frage)setze(haupt,'Zugriff erlauben und Projekt öffnen →','erlauben',false,'Das Projekt aus der Projektzentrale im Archivordner öffnen');
   else setze(haupt,'Projektordner öffnen →','start',$<HTMLButtonElement>('start-projekt').disabled,'Projektordner wählen (z. B. „26.0123 Köln“)');
   stand.textContent='';stand.className='rk-stand';
   this.ablauf(-1);return;
  }
  // Stand der Übernahme (der Stand der Proben steht schon in der Karte): übernommen / nicht aktuell / noch nicht
  const art=j?.art||'',text=art==='fertig'?'✓ '+(j!.titel.replace(/\s*✓\s*$/,'')):art==='geaendert'||art==='unlesbar'?'Übernahme nicht mehr aktuell':art==='uebernehmen'||art==='importiert'?'Noch nicht übernommen':'';
  stand.textContent=text;stand.className=`rk-stand${art==='fertig'?' ok':art==='geaendert'||art==='unlesbar'?' gelb':''}`;stand.title=this.hooks.stand();
  if(!j){haupt.hidden=true;this.ablauf(-1);return;}
  this.ablauf(ABLAUF[j.art]??1);
  const satz=(t:string)=>t.replace(/^📥\s*/,'').replace(/\s*→$/,'')+' →';
  if(j.haupt){setze(haupt,satz(j.haupt.text),j.haupt.aktion,busy&&j.haupt.aktion!=='ansehen',j.haupt.aktion==='uebernehmen'?'Schreibt die geltenden Werte nach „_Ergebnisse.json“ – erst dann sehen PlanKit, FotoKit und die Projektzentrale die Werte':'');
   if(j.neben)setze(neben,j.neben.text.replace(/^📥\s*/,''),j.neben.aktion,busy&&j.neben.aktion!=='ansehen');}
  else{
   // fertig: Hauptaktion = „Weiter“ des Kopfbands (Spiegel); Nebenaktion „Berichte importieren“
   const w=this.kopfbandWeiter();
   const wt=(w?.querySelector('strong')?.textContent||'').replace(/\s+/g,' ').trim().replace(/\s*→$/,'');   // wie PlanKit: Kopfband-„Weiter“ ohne Grundzeile
   if(w&&wt&&w.offsetParent!==null)setze(haupt,`${wt} →`,'kopfband',false,w.title||'');
   else haupt.hidden=true;
   if(j.neben)setze(neben,j.neben.text.replace(/^📥\s*/,''),j.neben.aktion,busy);
  }
 }
 private ablauf(aktiv:number){
  const z=document.getElementById('rk-ablauf');if(!z)return;z.hidden=aktiv<0;
  z.querySelectorAll('li').forEach((li,i)=>{li.classList.toggle('fertig',aktiv===2||i<aktiv);li.classList.toggle('aktiv',aktiv<2&&i===aktiv);li.setAttribute('aria-current',aktiv<2&&i===aktiv?'step':'false');});
 }
}
