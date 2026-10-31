// Laborberichte lesen – aus PlanKit (src/labreport.ts) übernommen; Änderungen: BG (loq) bleibt am Wert, Projektabgleich über die
// Projektnummer. Eurofins-XML liefert die Werte, die PDF dient dem Abgleich (Proben, Labor-Nr., Datum, Art) und der Ablage.
import type {LabSample,LabSources} from './model';
export function sourceFilename(value:string){return value.split(/[\\/]/).at(-1)||'';}
export interface TextItem {text:string;x:number;y:number;width:number;height:number}
export interface TextPage {width:number;height:number;items:TextItem[]}
export interface LabReport {bericht:string;labor:string;auftragsreferenz:string;quelle:string;batch:string;sources:LabSources;rows:LabSample[];expected:number|null;references:string[];warnings:string[];vorlaeufig?:boolean;/** Datum des Prüfberichts (Unterschrift, sonst Bearbeitungsende), JJJJ-MM-TT */datum?:string;results:{ref:string;parameter:string;result:string;unit:string;loq:string;nwg:string;norm:string}[];
 /** PDF (ab 1.6): Hauptwerte aus der Ergebnistabelle je Probenreferenz (norm) – nur zum Abgleich mit der XML, nie als Messwert. */
 pdfWerte?:Record<string,PdfWert[]>;
 /** Ordner (ab 1.14): XML oder PDF einer gleichnamigen Gruppe, die nicht zum selben Bericht gehörte – wird nie mit einem anderen
  *  Eingang gleicher Berichtsnummer zusammengeführt (sonst stünde die PDF wieder als Teil der XML da). */
 getrennt?:true;
 /** XML↔PDF-Abgleich der Hauptwerte: geprüfte Werte und Abweichungen je Probenreferenz (norm). */
 wertAbgleich?:WertAbgleich;
 /** Nur Laborauftrag aus LabelKit (ab 1.13): Probennummern, die in LabelKit storniert sind („P7“). Sie sind keine Proben mehr,
  *  die Nummer bleibt aber vergeben – ein Laborwert dafür gehört zu keiner offenen Probe. */
 storniert?:string[]}
/** Ein Wert aus der PDF-Ergebnistabelle: Text links (Parameter, ggf. Einheit/BG) und der Wert in der Spalte der Probe. */
export interface PdfWert {zeile:string;r:string}
export interface Abweichung {p:string;u:string;text:string}
export interface WertAbgleich {erkannt:boolean;geprueft:number;abweichend:Record<string,Abweichung[]>}
export const MAX_WERTE=300;
const tidy=(s:string)=>s.normalize('NFC').replace(/\s+/g,' ').trim();
const norm=(s:string)=>tidy(s).toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]/gu,'');
export function referenceLabel(ref:string){const s=tidy(ref),match=s.match(/^(?:Probe|P)\s*(\d+)$/i)||s.match(/^\d{2}\.\d{3,5}\s*-\s*(\d+)$/);if(!match)return '';const n=Number(match[1]);return Number.isSafeInteger(n)&&n>0&&n<1e9?`P${n}`:'';}
export function berlinDate(value:string){
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return validDate(value)?value:'';
 const german=value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);if(german){const s=`${german[3]}-${german[2]}-${german[1]}`;return validDate(s)?s:'';}
 if(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!validDate(value.slice(0,10))||!Number.isFinite(Date.parse(value)))return '';
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));const get=(type:string)=>parts.find(p=>p.type===type)!.value;return `${get('year')}-${get('month')}-${get('day')}`;
}
export function validDate(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
export function blankReport(quelle=''):LabReport{quelle=sourceFilename(quelle);return {bericht:'',labor:'',auftragsreferenz:'',quelle,batch:'',sources:/\.xml$/i.test(quelle)?{xml:quelle}:/\.pdf$/i.test(quelle)?{pdf:quelle}:{},rows:[],expected:null,references:[],warnings:[],results:[]};}
const children=(el:Element,name:string)=>[...el.children].filter(e=>e.localName===name);
const child=(el:Element,name:string)=>children(el,name)[0];
const value=(el:Element,name:string)=>tidy(child(el,name)?.textContent||'');
/** Nachweisgrenze (NWG) einer Ergebniszeile. Eurofins nennt sie bei Asbest (VDI 3866-5) nicht im Feld LOQ, sondern im
 *  Gruppen-, Test- oder Methodennamen: „Asbestfasern [NWG 0,001%]“, „Asbest [Einzelprobe, Nachweisgrenze 0,001 %]“.
 *  Rückgabe wie im Bericht mit Einheit, nur einheitlich mit Leerzeichen: „0,001 %“. Nichts gefunden → ''. */
export function nachweisgrenze(line:Element){
 for(const name of ['GroupLevel1Name','TestName','Method']){
  const m=/\b(?:NWG|Nachweisgrenze)\s*:?\s*(\d+(?:[.,]\d+)?)\s*(%)?/i.exec(value(line,name));
  if(m)return `${m[1]}${m[2]?` ${m[2]}`:''}`;
 }
 return '';
}
export function parseLabXML(text:string,quelle=''):LabReport{
 if(text.length>10*1024*1024)throw Error('XML zu groß (maximal 10 MB).');
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('XML mit Dokumenttyp/Entitäten wird nicht unterstützt. Bitte den PDF-Bericht verwenden.');
 const doc=new DOMParser().parseFromString(text,'application/xml'),root=doc.documentElement;
 if(doc.getElementsByTagNameNS('*','parsererror').length||root.localName!=='AnalyticalReport')throw Error('Keine unterstützte Eurofins-XML. Bitte den PDF-Bericht importieren oder Proben manuell eingeben.');
 const report=blankReport(quelle);report.bericht=tidy(root.getAttribute('AnalyticalReportCode')||'');report.labor='Eurofins';if(root.getAttribute('IsPreliminaryReport')==='true')report.vorlaeufig=true;
 {const unterschrift=berlinDate(value(root,'SignatureOn')),ende=berlinDate((value(root,'ProcessingTo').split(' ')[0]||''));const d=unterschrift||ende;if(d)report.datum=d;}
 const batches=child(root,'Batches');if(!batches)throw Error('Eurofins-XML enthält keine Batches. Bitte den PDF-Bericht verwenden.');
 const rows:{row:LabSample;order:number;index:number}[]=[];
 for(const batch of children(batches,'Batch')){
  const reference=value(batch,'ClientPurchaseOrderReference');if(report.auftragsreferenz&&reference&&reference!==report.auftragsreferenz)report.warnings.push('Die XML enthält unterschiedliche Auftragsreferenzen. Bitte prüfen.');report.auftragsreferenz||=reference;report.batch||=value(batch,'BatchCode');
  const samples=child(batch,'Samples');if(!samples)continue;
  for(const sample of children(samples,'SamplePartner')){
   const extra=(name:string)=>{const el=children(sample,'AdditionalFields').find(e=>e.getAttribute('Name')===name);return el?value(el,'Value'):'';};
   const ref=value(sample,'Description'),date=value(sample,'SamplingDate'),row:LabSample={label:referenceLabel(ref),ref,desc:extra('SPLPT_NAME'),art:extra('SAMPLETYPE')||value(sample,'Matrix'),labNr:value(sample,'SamplePartnerCode'),datum:berlinDate(date),bericht:report.bericht};
   if(date&&!row.datum)report.warnings.push(`Probenahmedatum für ${ref||row.labNr} konnte nicht erkannt werden.`);
   const order=value(sample,'SampleOrder');rows.push({row,order:order&&Number.isFinite(Number(order))?Number(order):Infinity,index:rows.length});
   const resultStart=report.results.length,raw=(el:Element,name:string)=>child(el,name)?.textContent||'';
   const lines=child(sample,'Lines');for(const line of lines?children(lines,'AnalyticalReportLine'):[])report.results.push({ref,parameter:value(line,'ParameterName')||value(line,'ParameterDescription'),result:raw(line,'Result'),unit:raw(line,'Unit'),loq:value(line,'LOQ'),nwg:nachweisgrenze(line),norm:value(line,'Standard')});
   const results=report.results.slice(resultStart).filter(r=>r.parameter&&r.result);
   if(results.length>MAX_WERTE||results.some(r=>r.parameter.length>160||r.result.length>40||r.unit.length>40||r.nwg.length>40||r.norm.length>160))throw Error('Laborwerte überschreiten die unterstützte Länge oder Anzahl; Originalwerte wurden nicht gekürzt.');
   const werte=results.map(r=>({p:r.parameter,r:r.result,u:r.unit,...(r.loq?{loq:r.loq}:{}),...(r.nwg?{nwg:r.nwg}:{}),...(r.norm?{norm:r.norm}:{})}));if(werte.length)row.werte=werte;
  }
 }
 if(rows.length>1000)throw Error('Mehr als 1000 Proben. Bitte einen kleineren Export verwenden.');
 report.rows=rows.sort((a,b)=>a.order-b.order||a.index-b.index).map(r=>r.row);report.expected=rows.length;
 if(!rows.length)report.warnings.push('Die XML enthält keine SamplePartner. Bitte den PDF-Bericht verwenden oder Proben manuell ergänzen.');
 return report;
}
function joined(items:TextItem[]){let text='',last:TextItem|undefined;for(const item of [...items].sort((a,b)=>a.x-b.x)){text+=last&&(item.x-last.x-last.width)>Math.max(1,Math.min(item.height,last.height)*.18)?' ':'';text+=item.text;last=item;}return tidy(text);}
function rowsOnPage(page:TextPage){
 const lines:{y:number;items:TextItem[]}[]=[];
 for(const item of [...page.items].filter(i=>tidy(i.text)).sort((a,b)=>a.y-b.y||a.x-b.x)){let line=lines.find(l=>Math.abs(l.y-item.y)<2.5);if(!line){line={y:item.y,items:[]};lines.push(line);}line.items.push({...item,text:tidy(item.text)});}
 return lines.sort((a,b)=>a.y-b.y).map(l=>({...l,items:l.items.sort((a,b)=>a.x-b.x),text:joined(l.items)}));
}
export function parseLabPDF(pages:TextPage[],quelle=''):LabReport{
 const report=blankReport(quelle),all=pages.map(rowsOnPage),cover=all[0]||[];const coverValue=(re:RegExp)=>{const line=cover.find(l=>re.test(l.text));return line?tidy(line.text.replace(re,'')):'';};
 report.bericht=coverValue(/.*?Pr[üu]fberichtsnummer\s*:?\s*/i).match(/AR-[\w-]+/i)?.[0]||'';report.auftragsreferenz=coverValue(/.*?(?:Ihre\s+)?Auftragsreferenz\s*:?\s*/i);report.labor=pages.some(p=>p.items.some(i=>/eurofins/i.test(i.text)))?'Eurofins':'';
 report.batch=coverValue(/^Batch(?:kennung|code|[-\s]*Nr\.?)\s*:?\s*/i);
 const count=coverValue(/.*?Anzahl\s+Proben\s*:?\s*/i).match(/^\d+/);report.expected=count?Number(count[0]):null;const art=coverValue(/^Probenart\s*:?\s*/i),coverDate=berlinDate(coverValue(/^Probenahme(?:zeitraum|datum)\s*:?\s*/i));
 const resultInfo=new Map<string,{datum:string;labNr:string}>();
 // Results are transposed: find sample columns by position, then inspect dates/lab IDs below them.
 for(const lines of all)for(let i=0;i<lines.length;i++){
  const line=lines[i];if(!/^Proben(?:referenz|bezeichnung)\b/i.test(line.text)||line.items.some(it=>/Probenbeschreibung/i.test(it.text)))continue;
  const refs=line.items.filter(it=>it.x>line.items[0].x+30).map(it=>({...it,text:tidy(it.text)})).filter(it=>it.text&&!/probenreferenz|probenbezeichnung/i.test(it.text));
  for(let col=0;col<refs.length;col++){const ref=refs[col],next=refs[col+1],left=ref.x-12,right=next?next.x-12:Infinity;let datum='',prefix='',suffix='';for(const lower of lines.slice(i+1,i+7)){const text=lower.items.filter(it=>it.x>=left&&it.x<right).map(it=>it.text).join(' ');datum||=berlinDate(text.match(/\d{2}\.\d{2}\.\d{4}/)?.[0]||'');prefix||=text.match(/\d{3}-\d{4}-/)?.[0]||'';suffix||=text.match(/\b\d{8}\b/)?.[0]||'';}resultInfo.set(norm(ref.text),{datum,labNr:prefix+suffix});report.references.push(ref.text);}
  // Hauptwerte darunter (ab 1.6, nur zum Abgleich): Zeilen mit Σ16 EPA-PAK, Chlorid oder Asbest links, Wert in der Spalte der Probe.
  if(refs.length){const first=refs[0].x-12;
   for(const lower of lines.slice(i+1)){
    if(/^Proben(?:referenz|bezeichnung)\b/i.test(lower.text)||/Weitere\s+Erl[äa]uterungen/i.test(lower.text))break;
    const links=joined(lower.items.filter(it=>it.x<first));if(!HAUPT.some(re=>re.test(links)))continue;
    for(let col=0;col<refs.length;col++){const left=refs[col].x-12,right=refs[col+1]?refs[col+1].x-12:Infinity,r=joined(lower.items.filter(it=>it.x>=left&&it.x<right));
     if(!r)continue;const k=norm(refs[col].text);(report.pdfWerte||={})[k]=[...(report.pdfWerte[k]||[]),{zeile:tidy(links),r:tidy(r)}];}
   }}
 }
 let columns:{nr:number;lab:number;art:number;ref:number;desc:number;date:number;samplingDate:boolean}|null=null,active=false,current:LabSample|null=null;
 for(const lines of all)for(const line of lines){
  if(/Weitere\s+Erl[äa]uterungen/i.test(line.text)){active=true;current=null;continue;}
  // PDF.js may combine adjacent cells, e.g. "Nr. Probennummer", in one text item.
  const header:TextItem[]=[];
  for(const near of lines.filter(l=>Math.abs(l.y-line.y)<=11&&/Proben|Beschreibung|Nr\.|Datum/i.test(l.text)&&!l.items.some(i=>/^\d{3}-\d{4}-/.test(i.text))))for(const item of near.items)for(const m of item.text.matchAll(/\S+/g)){
   const part={...item,text:m[0],x:item.x+item.width*(m.index||0)/item.text.length},previous=header.find(h=>Math.abs(h.x-part.x)<2&&h.y<part.y);
   if(previous)previous.text+=part.text;else header.push(part);
  }
  const find=(re:RegExp)=>header.find(i=>re.test(norm(i.text)))?.x;
  const lab=find(/^(probennummer|probennr|labornr|labornummer)$/),desc=find(/^(probenbeschreibung|beschreibung)$/),ref=find(/^(probenreferenz|probenbezeichnung)$/),type=find(/^probenart$/),nr=find(/^(nr|nummer)$/),date=find(/^(eingangsdatum|probeneingang|probenahmedatum|datum)$/);
  if(lab!==undefined&&desc!==undefined&&ref!==undefined&&type!==undefined){columns={nr:nr??0,lab,art:type,ref,desc,date:date??Infinity,samplingDate:header.some(h=>/^probenahmedatum$/.test(norm(h.text)))};active=true;current=null;continue;}
  if(!active||!columns)continue;
  if(/^(Labork[üu]rzelerkl[äa]rung|Kommentare|zu Ergebnissen|Pr[üu]fberichtsnummer|Seite\s+\d)/i.test(line.text)){current=null;continue;}
  const c=columns,bound=(a:number,b:number)=>joined(line.items.filter(i=>i.x>=a-3&&i.x<b-3)),number=bound(c.nr,c.lab),labNr=bound(c.lab,c.art),reference=bound(c.ref,c.desc),description=bound(c.desc,c.date);
  if(/^\d+\s*[.)]?$/.test(number)&&/\d/.test(labNr)){
   const info=resultInfo.get(norm(reference));current={label:referenceLabel(reference),ref:tidy(reference),desc:tidy(description),art:tidy(bound(c.art,c.ref))||art,labNr:tidy(labNr),datum:(c.samplingDate?berlinDate(bound(c.date,Infinity)):'')||info?.datum||coverDate,bericht:report.bericht};report.rows.push(current);
  }else if(current&&description&&!labNr&&!reference){current.desc=tidy(`${current.desc} ${description}`);}
 }
 if(report.rows.length>1000)throw Error('Mehr als 1000 PDF-Proben. Bitte einen kleineren Bericht verwenden.');
 if(!report.rows.length)report.warnings.push('Keine unterstützte Beschreibungstabelle gefunden oder PDF ohne Textschicht. Bitte XML verwenden oder die leere Liste manuell ergänzen.');
 if(!report.references.length&&report.rows.length)report.warnings.push('Keine Ergebnistabelle zum Abgleich der Probenreferenzen erkannt.');
 for(const row of report.rows){if(report.references.length&&!resultInfo.has(norm(row.ref)))report.warnings.push(`Beschreibung ohne passende Ergebnisreferenz: ${row.ref}.`);const info=resultInfo.get(norm(row.ref));if(info?.labNr&&norm(info.labNr)!==norm(row.labNr||''))report.warnings.push(`Labor-Nr. weicht zwischen Tabellen ab: ${row.ref}.`);}
 for(const ref of report.references)if(!report.rows.some(r=>norm(r.ref)===norm(ref)))report.warnings.push(`Ergebnisreferenz ohne Beschreibung: ${ref}.`);
 return report;
}
/** Prüfungen am gelesenen Bericht selbst: Probenzahl laut Bericht, doppelte Probenreferenz, doppelte P-Nummer. Beim Import und beim Einlesen
 *  des Ordners gleich – eine doppelte P-Nummer würde in der Übersicht sonst unbemerkt zu einer Zeile zusammenfallen. */
export function pruefHinweise(report:LabReport){
 const warnings:string[]=[];if(report.expected!==null&&report.rows.length!==report.expected)warnings.push(`${report.rows.length} Proben erkannt/bearbeitet; laut Bericht ${report.expected}.`);
 const duplicate=(values:string[])=>values.filter((v,i)=>v&&values.indexOf(v)!==i);for(const ref of new Set(duplicate(report.rows.map(r=>norm(r.ref)))))warnings.push(`Doppelte Probenreferenz: ${report.rows.find(r=>norm(r.ref)===ref)!.ref}.`);for(const label of new Set(duplicate(report.rows.map(r=>r.label.toUpperCase()))))warnings.push(`Doppelte P-Nummer: ${label}.`);
 return warnings;
}
export function reportWarnings(report:LabReport,p?:{report?:string}){
 const warnings=[...report.warnings];if(report.vorlaeufig)warnings.push(`Vorläufiger Prüfbericht${report.bericht?` ${report.bericht}`:''}: Die Werte können sich mit dem endgültigen Bericht noch ändern. Sie werden in Ergebniskarte, Raumbuch und Anlagen als vorläufig gekennzeichnet.`);warnings.push(...pruefHinweise(report));
 const number=(s:string)=>s.match(/\b\d{2}\.\d{3,}\b/)?.[0];if(p?.report&&report.auftragsreferenz&&number(p.report)!==number(report.auftragsreferenz)&&p.report!==report.auftragsreferenz)warnings.push(`Auftragsreferenz „${report.auftragsreferenz}“ passt möglicherweise nicht zur Gutachtennummer „${p.report}“.`);
 return [...new Set(warnings)];
}
// Ignore layout whitespace / Unicode hyphens, but retain ID punctuation and leading zeros.
const labID=(s:string)=>tidy(s).replace(/[\u2010-\u2015\u2212]/g,'-').replace(/\s/g,'').toUpperCase();
export function compareReports(xml:LabReport,pdf:LabReport){
 const warnings=[...pdf.warnings];if(labID(xml.bericht)!==labID(pdf.bericht)||!xml.bericht||!pdf.bericht)warnings.push('Berichtsnummern von XML und PDF weichen ab oder wurden nicht erkannt.');
 for(const row of xml.rows){
  const others=pdf.rows.filter(r=>norm(r.ref)===norm(row.ref));
  if(!others.length){warnings.push(`XML-Probe fehlt in der PDF-Beschreibungstabelle: ${row.ref}.`);continue;}
  if(others.length!==1){warnings.push(`Probenreferenz zwischen XML und PDF nicht eindeutig: ${row.ref}.`);continue;}
  const other=others[0];
  if(tidy(other.desc)!==tidy(row.desc))warnings.push(`Beschreibung weicht zwischen XML und PDF ab: ${row.ref}.`);
  for(const [key,label,normalize] of [['labNr','Labor-Nr.',labID],['datum','Probenahmedatum',(s:string)=>berlinDate(s)||tidy(s)],['art','Probenart',(s:string)=>tidy(s).toLocaleLowerCase('de')]] as const){
   const a=row[key]||'',b=other[key]||'';
   if(a||b){if(!a||!b)warnings.push(`${label} fehlt in ${a?'PDF':'XML'}: ${row.ref}.`);else if(normalize(a)!==normalize(b))warnings.push(`${label} weicht zwischen XML und PDF ab: ${row.ref}.`);}
  }
 }
 for(const row of pdf.rows)if(!xml.rows.some(r=>norm(r.ref)===norm(row.ref)))warnings.push(`PDF-Probe fehlt im XML: ${row.ref}.`);
 if(pdf.expected!==null&&xml.rows.length!==pdf.expected)warnings.push(`XML enthält ${xml.rows.length} Proben; PDF nennt ${pdf.expected}.`);return [...new Set(warnings)];
}
/** Hauptparameter, die zwischen XML und PDF abgeglichen werden. */
const HAUPT=[/^(?:Summe|Σ)\s*16\s*EPA[-– ]?PAK/i,/^Chlorid\b/i,/^Asbest/i];
/** Wert vergleichbar machen: Leerzeichen, Minus-Varianten, Groß/Klein egal; Zahl mit < > als Zeichen + Zahl. */
function wertForm(r:string){const t=tidy(r).replace(/[\u2212\u2013]/g,'-').replace(/\s+/g,'').toLocaleLowerCase('de');
 const m=/^([<>]?)(\d+(?:[.,]\d+)?)$/.exec(t);return m?`${m[1]}${Number(m[2].replace(',','.'))}`:t;}
/** XML↔PDF: je Probe die Hauptwerte (Σ16 EPA-PAK, Chlorid, Asbest) der PDF-Ergebnistabelle mit der XML vergleichen.
 *  Zuordnung über den Parameternamen (und die Einheit, wenn die XML denselben Parameter mehrfach hat). Nicht eindeutig = nicht geprüft.
 *  Ergebnis nur als Hinweis – die Messwerte kommen immer aus der XML. */
export function compareValues(xml:LabReport,pdf:LabReport):WertAbgleich{
 const out:WertAbgleich={erkannt:!!pdf.pdfWerte&&Object.keys(pdf.pdfWerte).length>0,geprueft:0,abweichend:{}};
 for(const row of xml.rows){const pw=pdf.pdfWerte?.[norm(row.ref)];if(!pw||!row.werte?.length)continue;
  for(const w of pw){const z=norm(w.zeile);
   let c=row.werte.filter(x=>HAUPT.some(re=>re.test(x.p))&&z.startsWith(norm(x.p)));
   const lang=Math.max(0,...c.map(x=>norm(x.p).length));c=c.filter(x=>norm(x.p).length===lang);   // „exkl. BG“ vor bloßem „Summe 16 EPA-PAK“
   if(c.length>1)c=c.filter(x=>x.u&&z.includes(norm(x.u)));
   if(c.length!==1)continue;const x=c[0];out.geprueft++;
   if(wertForm(x.r)!==wertForm(w.r))(out.abweichend[norm(row.ref)]||=[]).push({p:x.p,u:x.u,text:`${x.p}${x.u?` (${x.u})`:''}: XML „${x.r}“, PDF „${w.r}“`});
  }}
 return out;
}
/** Satz für Import und „Jetzt dran“; beginnt immer mit ABGLEICH, damit die Übersicht ihn nach dem Ersetzen neu bilden kann. */
export const ABGLEICH='Messwert-Abgleich XML↔PDF: ';
export function abgleichHinweis(refs:string[],n:number){return n?`${ABGLEICH}${n} Wert${n===1?'':'e'} weich${n===1?'t':'en'} ab (${refs.join(', ')}). Bitte mit dem unterschriebenen PDF prüfen – berichtigen kann nur das Labor.`:'';}
/** XML-Bericht und PDF desselben Berichts (auch mit anderem Dateinamen) abgleichen: Ergebnis und Hinweis am XML-Bericht. */
export function mitPdfAbgleichen(xml:LabReport,pdf:LabReport){
 const a=compareValues(xml,pdf);xml.wertAbgleich=a;const n=Object.values(a.abweichend).flat().length;
 const h=abgleichHinweis(Object.keys(a.abweichend).map(k=>xml.rows.find(r=>norm(r.ref)===k)?.ref||k),n);if(h)xml.warnings.push(h);return a;
}
/** XML und PDF gleichen Namens gehören nicht zum selben Bericht (Nummer, Auftragsreferenz oder Batch weichen ab). */
export class PaarFehler extends Error{readonly paar=true;constructor(text:string){super(text);this.name='PaarFehler';}}
export async function readLabFiles(files:File[]):Promise<LabReport>{
 if(!files.length||files.length>2||files.some(f=>!(/\.(xml|pdf)$/i.test(f.name))))throw Error('Bitte eine XML, eine PDF oder beide Berichte gemeinsam auswählen (höchstens zwei Dateien).');
 const xml=files.filter(f=>/\.xml$/i.test(f.name)),pdf=files.filter(f=>/\.pdf$/i.test(f.name));if(xml.length>1||pdf.length>1)throw Error('Bitte höchstens eine XML und eine PDF desselben Berichts wählen.');
 if(files.some(f=>f.size>(/\.xml$/i.test(f.name)?10:60)*1024*1024))throw Error('Bericht zu groß: XML maximal 10 MB, PDF maximal 60 MB.');
 let a:LabReport|null=null,b:LabReport|null=null;const errors:string[]=[];
 if(xml.length)try{a=parseLabXML(await xml[0].text(),xml[0].name);}catch(e){errors.push((e as Error).message);}
 if(pdf.length)try{const {openPDF}=await import('./pdf'),doc=await openPDF(pdf[0].name,new Uint8Array(await pdf[0].arrayBuffer()));try{b=parseLabPDF(await doc.text(),pdf[0].name);}finally{await doc.close();}}catch(e){errors.push((e as Error).message);}
 const report=a||b||blankReport();if(a&&b){
  if(a.bericht&&b.bericht&&a.bericht!==b.bericht)throw new PaarFehler('XML und PDF gehören zu unterschiedlichen Berichten. Bitte getrennt importieren.');
  if(a.auftragsreferenz&&b.auftragsreferenz&&a.auftragsreferenz!==b.auftragsreferenz)throw new PaarFehler('XML und PDF haben unterschiedliche Auftragsreferenzen. Bitte getrennt importieren.');
  if(a.batch&&b.batch&&a.batch!==b.batch)throw new PaarFehler('XML und PDF haben unterschiedliche Batchkennungen. Bitte getrennt importieren.');
  report.warnings.push(...compareReports(a,b));
  mitPdfAbgleichen(report,b);const xmlRefs=new Set(a.rows.map(r=>norm(r.ref)));for(const row of b.rows)if(!xmlRefs.has(norm(row.ref)))report.rows.push({...row});
  report.bericht||=b.bericht;report.labor||=b.labor;report.auftragsreferenz||=b.auftragsreferenz;report.batch||=b.batch;
 }
 report.sources={...(a?{xml:sourceFilename(xml[0].name)}:{}),...(b?{pdf:sourceFilename(pdf[0].name)}:{})};report.quelle=[report.sources.xml,report.sources.pdf].filter(Boolean).join(' + ');report.warnings.push(...errors);return report;
}
/** Einlesen des Ordners: Eine Gruppe (XML und/oder PDF gleichen Namens) liefert einen Bericht samt Prüfhinweisen. Gehören XML und PDF mit
 *  gleichem Namen nicht zum selben Bericht, fielen vorher beide aus der Übersicht – jetzt werden sie einzeln gelesen und beide
 *  mit einem Hinweis gemeldet (Zählung und Werte kommen aus dem, was lesbar ist; nichts wird verschwiegen). */
export async function readLabGroup(files:File[]):Promise<{report:LabReport;dateien:File[]}[]>{
 let teile:{report:LabReport;dateien:File[]}[];
 try{teile=[{report:await readLabFiles(files),dateien:files}];}
 catch(e){
  if(!(e instanceof PaarFehler)||files.length!==2)throw e;
  const namen=files.map(f=>`„${f.name}“`).join(' und ');
  teile=[];for(const f of files){const report=await readLabFiles([f]);report.warnings.push(`${namen} heißen gleich, gehören aber nicht zum selben Bericht (${e.message.replace(/\.? Bitte getrennt importieren\.$/,'')}) – ResultKit liest sie getrennt. Bitte prüfen, ob beide Dateien hierher gehören.`);report.getrennt=true;teile.push({report,dateien:[f]});}
 }
 for(const t of teile)t.report.warnings.push(...pruefHinweise(t.report).filter(h=>!t.report.warnings.includes(h)));
 return teile;
}
