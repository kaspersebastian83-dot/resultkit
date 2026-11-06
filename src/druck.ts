// Druckseite „Ergebnisübersicht“ (ab 2.1.0): eine A4-Seite quer mit allen Werten, die die Sachverständigen beim Schreiben der
// Sanierungsmaßnahmen neben sich haben – statt des Stapels ausgedruckter Eurofins-Prüfberichte.
// Quelle ist ausschließlich die übernommene „_Ergebnisse.json“ (was PlanKit, FotoKit und BerichtKit auch sehen). Nur lesen:
// Werte und Bezeichnungen kommen unverändert aus Prüfbericht und LabelKit; ResultKit schreibt dafür nichts in den Projektordner.
// Reine Daten und HTML-Text ohne Browserteile (in Node testbar, tests/druck.mjs); die Bewertung nach Skala reicht main.ts herein.
import type {ErgebnisDatei,Zeile} from './ergebnisse';
import type {Wert} from './model';
import {uebersichtGruppen,matrix,sortiereMatrix,ortTeile,SPALTE_TITEL,type Gruppe,type UGruppe,type UZeile} from './uebersicht';

const tidy=(s:unknown)=>String(s??'').normalize('NFC').replace(/\s+/g,' ').trim();
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const nummer=(label:string)=>{const n=Number(label.replace(/^P/i,''));return Number.isSafeInteger(n)&&n>0?n:null;};

/* ROLLE v1 – aus der Projektzentrale (archiv/auswertung.js, rolleAuto), dort ändern, hier nachziehen (wie BerichtKit
   bericht-bewertung.js). Konvention des Handbuchs: „F-“ vor der alten ID = Freimessung, „REF“ = Referenz aus unbelasteter Stelle. */
const istFrei=(id:string)=>/^F[-_ ]/i.test(tidy(id));
export function rolleAuto(ref:string,desc:string):''|'frei'|'referenz'|'quelle'|'brand'{
 const t=(tidy(ref)+' | '+tidy(desc)).toLocaleLowerCase('de');
 if(istFrei(ref)||istFrei(desc)||/freimessung|sanierungskontrolle|nach (der )?sanierung/.test(t))return 'frei';
 if(/(^|[^a-zäöüß])ref([^a-zäöüß]|$)|referenz|unbelastet|nullprobe|hintergrund/.test(t))return 'referenz';
 if(/kleber|teer|bitumen|dachpappe|schwarzanstrich/.test(t))return 'quelle';
 if(/brandraum|brandbereich|brandherd|brandstelle|brandausbruch/.test(t))return 'brand';
 return '';
}

/** „_Ergebnisse.json“ → Zeilen wie in der Prüfung (gleiche Status-Regel wie ergebnisse.ts), damit die Übersicht-Funktionen
 *  (Gruppen, Stellen, Sortierung) unverändert gelten. In LabelKit stornierte Proben stehen in der Datei nicht (ab 1.13). */
export function zeilenAusDatei(d:ErgebnisDatei):Zeile[]{
 const zeilen=new Map<string,Zeile>(),auftrag=d.auftrag&&Array.isArray(d.auftrag.proben)?d.auftrag:null;
 const zeile=(s:{label?:unknown;ref?:unknown;desc?:unknown;typ?:unknown;art?:unknown},erwartet:boolean)=>{
  const label=tidy(s.label),ref=tidy(s.ref),key=label?label.toUpperCase():`?${ref.toLowerCase()}`;let z=zeilen.get(key);
  if(!z){z={label,nr:label?nummer(label):null,ref,desc:tidy(s.desc),...(s.typ?{typ:tidy(s.typ)}:{}),...(s.art?{art:tidy(s.art)}:{}),erwartet,status:'offen',werte:[],berichte:[],hinweise:[]};zeilen.set(key,z);}
  return z;};
 for(const p of auftrag?.proben||[])if(p&&typeof p==='object')zeile(p,true);
 for(const b of Array.isArray(d.berichte)?d.berichte:[])for(const s of Array.isArray(b?.proben)?b.proben:[]){
  if(!s||typeof s!=='object')continue;
  const z=zeile(s,!auftrag),code=tidy(b.bericht);
  if(!z.desc)z.desc=tidy(s.desc);if(!z.typ&&s.typ)z.typ=tidy(s.typ);if(!z.art&&s.art)z.art=tidy(s.art);
  if(code&&!z.berichte.includes(code))z.berichte.push(code);
  for(const w of Array.isArray(s.werte)?s.werte:[])if(w&&typeof w==='object')z.werte.push({...w,p:String(w.p??''),r:String(w.r??''),u:String(w.u??''),bericht:code,vorlaeufig:!!b.vorlaeufig});   // Werte wie in der Datei, nichts angeglichen
 }
 for(const z of zeilen.values()){const endgueltig=z.werte.length>0&&!z.werte.some(w=>w.vorlaeufig);
  z.status=!z.erwartet?'nichtBeauftragt':z.werte.length?(endgueltig?'ergebnis':'vorlaeufig'):z.berichte.length?'ohneWerte':'offen';}
 return [...zeilen.values()].sort((a,b)=>(a.nr??1e9)-(b.nr??1e9)||a.ref.localeCompare(b.ref,'de',{numeric:true}));
}

export interface DZeile {key:string;labels:string[];etage:string;raum:string;oberflaeche:string;rolle:''|'frei'|'referenz';zellen:Partial<Record<Gruppe,UZeile>>;bemerkung:string[]}
export interface DModell {gruppen:UGruppe[];zeilen:DZeile[];spalten:{etage:boolean;oberflaeche:boolean;bemerkung:boolean};
 berichte:{code:string;datum:string;vorlaeufig:boolean}[];vorlaeufig:boolean;uebernommen:string;projekt:string}

/** Stelle → Ort (LabelKit „Raum/Ort“, z2) und Oberfläche/Oberflächenart (der Rest ohne Fläche/Tiefe). */
function teile(stelle:string,raum:string){
 let ort=stelle,rest='';
 if(raum&&stelle.toLocaleLowerCase('de').startsWith(raum.toLocaleLowerCase('de'))){ort=stelle.slice(0,raum.length);rest=stelle.slice(raum.length);}
 else{const i=stelle.indexOf(',');if(i>=0){ort=stelle.slice(0,i);rest=stelle.slice(i);}}
 return {...ortTeile(ort),oberflaeche:rest.replace(/^[\s,]+/,'').trim()};
}

/** Druckmodell: eine Zeile je Probenahmestelle (wie „Nach Stelle“), sortiert Gebäude → Etage → Raum; leere Spalten fallen weg. */
export function druckModell(d:ErgebnisDatei):DModell{
 const zeilen=zeilenAusDatei(d),gruppen=uebersichtGruppen(zeilen);
 const raumVon=new Map<string,string>();
 for(const p of d.auftrag?.proben||[])if(p?.label&&p.raum)raumVon.set(tidy(p.label).toUpperCase(),tidy(p.raum));
 for(const b of d.berichte||[])for(const s of b?.proben||[])if(s?.label&&s.raum&&!raumVon.has(tidy(s.label).toUpperCase()))raumVon.set(tidy(s.label).toUpperCase(),tidy(s.raum));
 const descVon=new Map(zeilen.map(z=>[z.label||z.ref,z.desc]));
 const rows=sortiereMatrix(matrix(gruppen),'stelle',true).map(r=>{
  const proben=gruppen.map(g=>({g:g.gruppe,z:r.zellen[g.gruppe]})).filter((x):x is {g:Gruppe;z:UZeile}=>!!x.z);
  const ersterRaum=r.labels.map(l=>raumVon.get(l.toUpperCase())).find(Boolean)||'';
  const rollen=r.labels.map(l=>{const r2=rolleAuto('',descVon.get(l)||'');return r2==='frei'||r2==='referenz'?r2:'';});
  const rolle=rollen.includes('frei')?'frei':rollen.includes('referenz')?'referenz':'';
  const mehrere=r.labels.length>1,wer=(z:UZeile)=>mehrere?`${z.label} `:'';
  const bemerkung=[
   ...proben.filter(x=>x.z.vorlaeufig&&!x.z.ausstehend).map(x=>`${wer(x.z)}vorläufig`),
   ...proben.filter(x=>x.z.nichtBeauftragt).map(x=>`${wer(x.z)}nicht beauftragt`),
   ...proben.filter(x=>x.z.original).map(x=>`${SPALTE_TITEL[x.g]} laut Bericht ${x.z.original}`)];
  return {key:r.key,labels:r.labels,...teile(r.stelle,ersterRaum),rolle,zellen:r.zellen,bemerkung:[...new Set(bemerkung)]} as DZeile;});
 const berichte=(d.berichte||[]).filter(b=>b&&(b.proben||[]).some(s=>s?.werte?.length)).map(b=>({code:tidy(b.bericht)||tidy(b.sources?.xml)||'ohne Nummer',datum:tidy(b.datum),vorlaeufig:!!b.vorlaeufig}));
 return {gruppen,zeilen:rows,spalten:{etage:rows.some(r=>r.etage),oberflaeche:rows.some(r=>r.oberflaeche),bemerkung:rows.some(r=>r.bemerkung.length)},
  berichte,vorlaeufig:berichte.some(b=>b.vorlaeufig),uebernommen:tidy(d.uebernommen),projekt:tidy(d.projekt)};
}

/** Bewertung eines Werts nach der Skala der App (main.ts): Farbe der Kategorie, index > 0 = auffällig, < 0 = unter BG/n. n. */
export type Bewerte=(w:Wert)=>{farbe:string;index:number;titel:string}|null;
export interface DruckKopf {nr:string;ort:string;objekt:string;auftraggeber:string;gedruckt:string;stand:string;veraltet:boolean;version:string;legende:string}
/** Nur Farbwerte, die nichts ins HTML tragen können (Skalen kommen aus Dateien). */
const farbe=(f:string)=>/^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%]+\))$/i.test(f.trim())?f.trim():'';
const ASBEST_ROT='#d0453a';
const datumDE=(iso:string)=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');return m?`${m[3]}.${m[2]}.${m[1]}`:iso;};

function zelle(g:UGruppe,z:UZeile|undefined,mehrere:boolean,bewerte:Bewerte){
 if(!z)return '<td class="dr-w dr-leer"></td>';
 const p=mehrere?` <small class="dr-p">${esc(z.label)}</small>`:'';
 if(z.ausstehend)return `<td class="dr-w dr-aus">ausstehend${p}</td>`;
 if(g.gruppe==='Asbest'){if(!z.befund)return `<td class="dr-w dr-aus">–${p}</td>`;
  return `<td class="dr-w dr-asb${z.befund.gefunden?' dr-asb-ja':''}"${z.befund.gefunden?` style="--c:${ASBEST_ROT}"`:''}>${esc(z.befund.text)}${p}</td>`;}
 if(g.gruppe==='Weitere')return `<td class="dr-w dr-text">${z.weitere.map(w=>`${esc(w.p)} ${esc(w.r)}${w.u?` ${esc(w.u)}`:''}`).join(' · ')}${p}</td>`;
 if(!z.haupt)return `<td class="dr-w dr-aus">kein ${g.gruppe==='PAK'?'Σ16-Wert':'Chlorid-Wert'}${p}</td>`;
 const b=z.bewertet?bewerte(z.bewertet):null,f=b&&b.index>=0?farbe(b.farbe):'';
 const einheit=z.haupt.u&&z.haupt.u!==g.einheit?` <small>${esc(z.haupt.u)}</small>`:'';
 return `<td class="dr-w${f?' dr-bew':''}${b&&b.index>0?' dr-auff':''}"${f?` style="--c:${f}"`:''}${b?.titel?` title="${esc(b.titel)}"`:''}>${esc(z.haupt.r)}${einheit}${p}</td>`;
}
/** Kopf einer Wertespalte; Einheit wie in der Übersicht (häufigste der Spalte, nie umgerechnet außer Chlorid wie in der App). */
const spaltenTitel=(g:UGruppe)=>g.gruppe==='PAK'?`PAK Σ16 EPA${g.einheit?` (${g.einheit})`:''}`:g.gruppe==='Chlorid'?`Chlorid${g.einheit?` (${g.einheit})`:''}`:g.gruppe==='Asbest'?'Asbest (Befund)':'Weitere';

/** HTML der Druckseite (ein Abschnitt, Stil in einfach.css „Druckseite“). */
export function druckHtml(m:DModell,k:DruckKopf,bewerte:Bewerte):string{
 const sp=m.spalten,gruppen=m.gruppen;
 // Werte direkt neben dem Raum (kurzer Blickweg), Oberfläche und Bemerkung grau am Rand
 const kopfZellen=[['dr-c-nr','P-Nr.'],...(sp.etage?[['dr-c-etage','Etage']]:[]),['dr-c-raum','Raum'],
  ...gruppen.map(g=>[`dr-c-w dr-c-${g.gruppe.toLowerCase()}`,spaltenTitel(g)]),...(sp.oberflaeche?[['dr-c-ober','Oberfläche / -art']]:[]),...(sp.bemerkung?[['dr-c-bem','Bemerkung']]:[])];
 const n=kopfZellen.length;
 const tag=(r:DZeile)=>r.rolle==='frei'?'<span class="dr-tag" title="Freimessung nach Sanierung">Freimessung</span> ':r.rolle==='referenz'?'<span class="dr-tag" title="Referenz (unbelastet)">REF</span> ':'';
 const zeile=(r:DZeile)=>`<tr data-p="${esc(r.labels.join(' '))}"><td class="dr-nr">${esc(r.labels.join(', '))}</td>${sp.etage?`<td class="dr-etage">${esc(r.etage)}</td>`:''}<td class="dr-raum">${tag(r)}${esc(r.raum)}</td>${gruppen.map(g=>zelle(g,r.zellen[g.gruppe],r.labels.length>1,bewerte)).join('')}${sp.oberflaeche?`<td class="dr-ober">${esc(r.oberflaeche)}</td>`:''}${sp.bemerkung?`<td class="dr-bem">${esc(r.bemerkung.join('; '))}</td>`:''}</tr>`;
 const berichte=m.berichte.map(b=>`${esc(b.code)}${b.vorlaeufig||b.datum?` (${[b.vorlaeufig?'vorläufig':'',b.datum?esc(datumDE(b.datum)):''].filter(Boolean).join(', ')})`:''}`).join(' · ');
 const feld=(t:string,v:string)=>v?`<div><dt>${t}</dt><dd>${esc(v)}</dd></div>`:'';
 return `<section class="dr-seite" aria-label="Ergebnisübersicht zum Drucken">
 <header class="dr-kopf">
  <div class="dr-titel"><h1>Ergebnisübersicht${m.vorlaeufig?' <span class="dr-vorl-marke">vorläufig</span>':''}</h1><p class="dr-projekt"><b>${esc(k.nr)}</b> ${esc(k.ort)}</p></div>
  <dl class="dr-meta">${feld('Objekt',k.objekt)}${feld('Auftraggeber',k.auftraggeber)}${feld('Stand der Laborergebnisse',k.stand)}${feld('Gedruckt',k.gedruckt)}</dl>
  ${berichte?`<p class="dr-zeile">Prüfbericht${m.berichte.length===1?'':'e'}: ${berichte}</p>`:''}
  ${m.vorlaeufig?'<p class="dr-zeile dr-hinweis">Vorläufig: Mindestens ein Prüfbericht ist vorläufig – diese Werte können sich mit dem endgültigen Bericht noch ändern.</p>':''}
  ${k.veraltet?'<p class="dr-zeile dr-hinweis">Im Projektordner hat sich seit der Übernahme etwas geändert (neuer Prüfbericht oder LabelKit-Datei) – gedruckt ist der übernommene Stand.</p>':''}
  ${k.legende?`<p class="dr-zeile dr-legende">${k.legende}</p>`:''}
 </header>
 <table class="dr-tabelle">
  <thead><tr>${kopfZellen.map(([c,t])=>`<th scope="col" class="${c}">${esc(t)}</th>`).join('')}</tr></thead>
  <tbody>${m.zeilen.map(zeile).join('')||`<tr><td colspan="${n}">Keine Proben in der Übernahme.</td></tr>`}</tbody>
  <tfoot><tr><td colspan="${n}"><span class="dr-fuss-r">${esc(k.nr)} ${esc(k.ort)}</span><span>Spektron ResultKit ${esc(k.version)} · Werte aus den Eurofins-Prüfberichten, keine Bewertung</span></td></tr></tfoot>
 </table>
</section>`;
}
