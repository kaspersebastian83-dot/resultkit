// ResultKit 2.1.0 – Druckseite „Ergebnisübersicht“ im echten Browser, rein synthetische Daten (gleiche Bausteine wie browser.mjs).
// Prüft: Knopf erst nach der Übernahme, eine Zeile je Probenahmestelle aus „_Ergebnisse.json“, leere Spalten ausgeblendet,
// REF markiert, vorläufig im Kopf, stornierte Probe fehlt, nichts geschrieben; als PDF: 40 Zeilen = eine Seite quer,
// mehr Zeilen brechen um und wiederholen den Tabellenkopf.
// pnpm build && node tests/druck-browser.mjs   (lokal ggf. BROWSER_EXECUTABLE=… oder PLAYWRIGHT_MODULE=playwright)
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {preview} from 'vite';
import {labRows,labXML} from './lab-fixtures.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');

const PROJEKT='99.9001 Musterort',SUM='Summe 16 EPA-PAK exkl. BG',U='µg/m²',ERG='_Spektron/ResultKit/_Ergebnisse.json';
const desc=(z2,z3='Wand',z4='Ansicht',cm2='400')=>[z2,z3,z4,cm2?`${cm2} cm²`:''].filter(Boolean).join(', ');
const probe=(n,d,lines)=>({...labRows[0],label:`P${n}`,ref:`Probe ${n}`,labNr:`999-2099-${String(n).padStart(8,'0')}`,desc:d,lines});
const pak=v=>[{p:SUM,r:v,u:U},{p:'Benzo[a]pyren',r:'< 0,5',u:U}];
const wisch=(nr,z2,extra={})=>({_nr:nr,matrix:'Wischprobe',datum:'08.10.2026',z2,z3:'Wand',z4:'Ansicht',cm2:'400',...extra});

// Kleiner Fall: P1+P4 an derselben Stelle (PAK + Chlorid), P5 Referenz (vorläufiger Bericht), P6 in LabelKit storniert.
const klein={
 labelkit:JSON.stringify({version:'4.49.0',projekt:{nr:'99.9001'},
  proben:[wisch(1,'EG Testraum 1'),wisch(2,'EG Testraum 2'),wisch(3,'1. OG Testraum 3 Brandraum'),wisch(5,'EG REF Flur'),wisch(6,'EG Testraum 6',{storniert:{am:'2026-10-09',kuerzel:'Ka',grund:'Test'}})],
  chloridProben:[{chloridNr:4,matrix:'Wischprobe',datum:'08.10.2026',z2:'EG Testraum 1',z3:'Wand',z4:'Ansicht'}]}),
 berichte:{
  'AR-1-02.xml':labXML([probe(1,desc('EG Testraum 1'),pak('14')),probe(2,desc('EG Testraum 2'),pak('8,5')),probe(3,desc('1. OG Testraum 3 Brandraum'),pak('412')),
   probe(4,desc('EG Testraum 1','Wand','Ansicht',''),[{p:'Chlorid',r:'26',u:'µg/cm²'}]),probe(6,desc('EG Testraum 6'),pak('99'))],{code:'AR-1-02'}),
  'AR-1-03.xml':labXML([probe(5,desc('EG REF Flur'),pak('3'))],{code:'AR-1-03',vorlaeufig:true})}};
// Großer Fall: n PAK-Proben in verschiedenen Räumen, ein endgültiger Bericht.
const gross=n=>{const ort=i=>`${['KG','EG','1. OG','2. OG'][i%4]} Raum ${String(i).padStart(2,'0')} ${i%5?'':'Brandraum '}Nordseite`;
 return {labelkit:JSON.stringify({version:'4.49.0',projekt:{nr:'99.9001'},proben:Array.from({length:n},(_,i)=>wisch(i+1,ort(i+1)))}),
  berichte:{'AR-2-01.xml':labXML(Array.from({length:n},(_,i)=>probe(i+1,desc(ort(i+1)),pak(String(5+i*7)))),{code:'AR-2-01'})}};};

const server=await preview({preview:{host:'127.0.0.1',port:0,open:false},logLevel:'silent'});
const base=`http://127.0.0.1:${server.httpServer.address().port}/`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
let n=0;const check=async(name,fn)=>{await fn();n++;console.log('OK Druckseite: '+name);};

/** Projektordner im OPFS anlegen und die Ordnerauswahl darauf umleiten; window.print zählt nur (kein Dialog im Test). */
async function projekt(fall){
 const context=await browser.newContext({viewport:{width:1366,height:900},timezoneId:'Europe/Berlin'});
 await context.addInitScript(p=>{window.showDirectoryPicker=async()=>(await navigator.storage.getDirectory()).getDirectoryHandle(p);window.print=()=>{window.__gedruckt=(window.__gedruckt||0)+1;};},PROJEKT);
 const page=await context.newPage();page.setDefaultTimeout(15000);
 const fehler=[];page.on('pageerror',e=>fehler.push(e.message));
 await page.goto(base);
 await page.evaluate(async ([projekt,dateien])=>{
  const root=await navigator.storage.getDirectory();for await(const [name] of root.entries())await root.removeEntry(name,{recursive:true});
  const dir=await root.getDirectoryHandle(projekt,{create:true});
  for(const [pfad,text] of Object.entries(dateien)){let d=dir;const teile=pfad.split('/');for(const t of teile.slice(0,-1))d=await d.getDirectoryHandle(t,{create:true});
   const w=await (await d.getFileHandle(teile.at(-1),{create:true})).createWritable();await w.write(text);await w.close();}
 },[PROJEKT,{'_Projekt.json':JSON.stringify({nutzung:'Wohnen',objekt:'EFH, Musterweg 1, 99999 Musterort',auftraggeber:'Muster Versicherung AG'}),
  'Laboraufträge/99.9001_08.10.2026_Daten.json':fall.labelkit,...Object.fromEntries(Object.entries(fall.berichte).map(([k,v])=>[`Laborergebnisse/${k}`,v]))}]);
 await page.locator('#rk-haupt').click();
 await page.waitForFunction(()=>document.querySelector('#jetzt')?.dataset.art==='uebernehmen');
 return {page,context,fehler};
}
const uebernehmen=async page=>{
 await page.locator('#rk-haupt').click();
 const frage=page.locator('#frage-dialog');
 await Promise.race([frage.waitFor().then(()=>frage.getByRole('button',{name:'Trotzdem übernehmen'}).click()),page.waitForFunction(()=>document.querySelector('#jetzt')?.dataset.art==='fertig')]);
 await page.waitForFunction(()=>document.querySelector('#jetzt')?.dataset.art==='fertig');
};
let pdfNr=0;
const drucken=async page=>{if(process.env.DRUCK_PDF)await page.screenshot({path:`${process.env.DRUCK_PDF}/app-${pdfNr+1}.png`});await page.locator('#rk-drucken').click();await page.waitForFunction(()=>window.__gedruckt>=1);await page.emulateMedia({media:'print'});};
const pdfSeiten=async page=>{const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});if(process.env.DRUCK_PDF)(await import('node:fs')).writeFileSync(`${process.env.DRUCK_PDF}/druck-${++pdfNr}.pdf`,pdf);   // zum Ansehen
 const doc=await pdfjs.getDocument({data:new Uint8Array(pdf),useSystemFonts:true}).promise;
 const seiten=[];for(let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i),v=p.getViewport({scale:1}),t=await p.getTextContent();seiten.push({quer:v.width>v.height,text:t.items.map(x=>x.str).join(' ')});}return seiten;};

try{
 await check('Knopf erst mit übernommener „_Ergebnisse.json“; eine Zeile je Stelle, leere Spalten weg, REF, vorläufig, ohne Storno',async()=>{
  const {page,context,fehler}=await projekt(klein);
  assert.equal(await page.locator('#rk-drucken').isVisible(),false,'vor der Übernahme kein Druckknopf in der Fußleiste');
  await page.locator('#rk-mehr').click();await page.locator('#mosaikMehrPop').waitFor();
  assert.equal(await page.locator('#rk-m-drucken').isDisabled(),true,'„Mehr …“: ohne Übernahme nicht druckbar');
  await page.keyboard.press('Escape');
  await uebernehmen(page);
  const vorher=await page.evaluate(async p=>{const out=[];const geh=async(d,pfad)=>{for await(const [name,h] of d.entries())if(h.kind==='directory')await geh(h,pfad+name+'/');else out.push(pfad+name+'|'+(await h.getFile()).lastModified);};await geh(await (await navigator.storage.getDirectory()).getDirectoryHandle(p),'');return out.sort();},PROJEKT);
  assert.equal(await page.locator('#rk-drucken').textContent(),'Übersicht drucken');
  await drucken(page);
  assert.equal(await page.locator('#rk-druck').isVisible(),true);
  assert.equal(await page.locator('#jetzt').isVisible(),false,'beim Drucken nur die Druckseite');
  const kopf=await page.locator('.dr-tabelle thead th').allTextContents();
  assert.deepEqual(kopf,['P-Nr.','Etage','Raum','Oberfläche / -art','PAK Σ16 EPA (µg/m²)','Chlorid (µg/cm²)','Bemerkung'],'ohne Asbest und Weitere');
  const zeilen=page.locator('.dr-tabelle tbody tr');
  assert.deepEqual(await zeilen.evaluateAll(l=>l.map(tr=>tr.dataset.p)),['P5','P1 P4','P2','P3'],'Gebäude → Etage → Raum; P1 und P4 eine Stelle; P6 storniert fehlt');
  const zeile=p=>page.locator(`.dr-tabelle tbody tr[data-p="${p}"]`),zelle=async(p,i)=>(await zeile(p).locator('td').nth(i).textContent()).trim();
  assert.deepEqual([await zelle('P1 P4',0),await zelle('P1 P4',1),await zelle('P1 P4',2),await zelle('P1 P4',3),await zelle('P1 P4',4),await zelle('P1 P4',5)],['P1, P4','EG','Testraum 1','Wand, Ansicht','14 P1','26 P4'],'Werte wie im Bericht, Probennummer am Wert');
  assert.deepEqual([await zelle('P3',1),await zelle('P3',2),await zelle('P3',4)],['1. OG','Testraum 3 Brandraum','412']);
  assert.equal(await zeile('P5').locator('.dr-tag').textContent(),'REF');assert.equal(await page.locator('.dr-tag').count(),1,'nur P5 ist REF');assert.equal(await zelle('P5',6),'vorläufig');
  assert.equal(await zeile('P3').locator('td.dr-w').first().evaluate(td=>td.classList.contains('dr-bew')&&td.classList.contains('dr-auff')),true,'412 µg/m² bewertet und auffällig');
  const k=await page.locator('.dr-kopf').textContent();
  for(const t of ['Ergebnisübersicht','vorläufig','99.9001','Musterort','EFH, Musterweg 1','Muster Versicherung AG','Stand der Laborergebnisse','übernommen am','AR-1-02','AR-1-03 (vorläufig'])assert.ok(k.includes(t),`Kopf: ${t}`);
  assert.match(await page.locator('.dr-tabelle tfoot').textContent(),/Spektron ResultKit \d+\.\d+\.\d+ · Werte aus den Eurofins-Prüfberichten, keine Bewertung/);
  assert.ok(!(await page.locator('#rk-druck').textContent()).includes('P6'),'stornierte Probe nicht gedruckt');
  const seiten=await pdfSeiten(page);assert.equal(seiten.length,1);assert.ok(seiten[0].quer,'A4 quer');
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'});
  assert.equal(await page.locator('#rk-druck').isVisible(),false);assert.equal(await page.locator('#jetzt').isVisible(),true,'nach dem Drucken wieder die App');
  const nachher=await page.evaluate(async p=>{const out=[];const geh=async(d,pfad)=>{for await(const [name,h] of d.entries())if(h.kind==='directory')await geh(h,pfad+name+'/');else out.push(pfad+name+'|'+(await h.getFile()).lastModified);};await geh(await (await navigator.storage.getDirectory()).getDirectoryHandle(p),'');return out.sort();},PROJEKT);
  assert.deepEqual(nachher,vorher,'nichts in den Projektordner geschrieben');
  assert.deepEqual(fehler,[]);await context.close();
 });

 await check('40 Zeilen passen auf eine Seite; 70 brechen um, Kopfzeile und Fuß auf jeder Seite',async()=>{
  for(const [anzahl,seitenSoll] of [[40,1],[70,2]]){
   const {page,context,fehler}=await projekt(gross(anzahl));await uebernehmen(page);await drucken(page);
   assert.equal(await page.locator('.dr-tabelle tbody tr').count(),anzahl);
   assert.deepEqual(await page.locator('.dr-tabelle thead th').allTextContents(),['P-Nr.','Etage','Raum','Oberfläche / -art','PAK Σ16 EPA (µg/m²)'],'ohne Chlorid, Asbest, Bemerkung');
   const seiten=await pdfSeiten(page);
   assert.equal(seiten.length,seitenSoll,`${anzahl} Zeilen: ${seitenSoll} Seite(n)`);
   for(const s of seiten){assert.ok(s.quer);assert.match(s.text,/Nr\.\s+Etage\s+Raum/,'Tabellenkopf auf jeder Seite');assert.match(s.text,/keine Bewertung/,'Fuß auf jeder Seite');}
   assert.deepEqual(fehler,[]);await context.close();
  }
 });
 console.log(`${n} Prüfungen Druckseite bestanden`);
}finally{await browser.close();server.httpServer.close();}
