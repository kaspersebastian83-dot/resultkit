// ResultKit 2.2 im echten Browser: welcher Prüfbericht gilt (Audit K2, M1; Entscheidung 10.11.2026). Rein erfundene Daten.
// Der Projektordner liegt im privaten Browserdateisystem (OPFS); die Änderungszeit einer Datei ist die Zeit, zu der sie dort
// geschrieben wird – „später gespeichert“ heißt hier: später geschrieben.
// pnpm build && node tests/fassung-browser.mjs   (lokal: LANG=C.UTF-8, sonst landen Ordner mit Umlaut im übergeordneten Ordner)
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {preview} from 'vite';
import {labRows,labXML} from './lab-fixtures.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');

const PROJEKT='99.9001 Musterort',SUM='Summe 16 EPA-PAK exkl. BG',U='µg/m²';
const pak=v=>[{p:SUM,r:v,u:U},{p:'Benzo[a]pyren',r:'< 0,5',u:U}];
const eigenDesc=n=>`EG Testraum ${n}, Wand, Ansicht, 400 cm²`;
const probe=(n,lines,desc=eigenDesc(n))=>({...labRows[0],label:`P${n}`,ref:`Probe ${n}`,labNr:`999-2099-${String(n).padStart(8,'0')}`,desc,lines});
const labelkit=JSON.stringify({version:'5.0.0',projekt:{nr:'99.9001'},
 proben:[1,2,3].map(i=>({_nr:i,matrix:'Wischprobe',datum:'08.10.2026',z2:`EG Testraum ${i}`,z3:'Wand',z4:'Ansicht',cm2:'400'})),
 chloridProben:[{chloridNr:4,matrix:'Wischprobe',datum:'08.10.2026',z2:'EG Testraum 4',z3:'Wand',z4:'Ansicht'}]});
const AUFTRAG='Laboraufträge/99.9001_08.10.2026_Daten.json';
const EIGEN='AR-100-2026-000001-01',FREMD='AR-200-2026-000009-01';
const eigen=labXML([probe(1,pak('14')),probe(2,pak('8')),probe(3,pak('2')),probe(4,[{p:'Chlorid',r:'3',u:'µg/cm²'}],'EG Testraum 4, Wand, Ansicht')],{code:EIGEN});
const fremd=ref=>labXML([1,2,3].map(n=>probe(n,pak(String(900-n*100)),`OG Anderswo Raum ${n}, Decke, 400 cm²`)),{code:FREMD,ref});

const server=await preview({preview:{host:'127.0.0.1',port:0,open:false},logLevel:'silent'});
const base=`http://127.0.0.1:${server.httpServer.address().port}/`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
let n=0;const check=async(name,fn)=>{await fn();n++;console.log('OK ResultKit 2.2: '+name);};
const until=async(fn,what)=>{for(let i=0;i<100;i++){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,100));}throw Error(`Zeitüberschreitung: ${what}`);};
const pause=()=>new Promise(r=>setTimeout(r,30));

try{
 const context=await browser.newContext({viewport:{width:1366,height:900},timezoneId:'Europe/Berlin'});
 await context.addInitScript(projekt=>{window.showDirectoryPicker=async()=>(await navigator.storage.getDirectory()).getDirectoryHandle(projekt);},PROJEKT);
 await context.addInitScript(()=>{try{if(localStorage.getItem('resultkit-ansicht')===null)localStorage.setItem('resultkit-ansicht','art');}catch{}});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 const fehler=[];page.on('pageerror',e=>fehler.push(e.message));page.on('console',m=>{if(m.type()==='error')fehler.push(m.text());});
 await page.goto(base);
 const jetzt=page.locator('#jetzt'),haupt=page.locator('#rk-haupt'),art=()=>jetzt.getAttribute('data-art');
 /** Ordner neu anlegen; Dateien in der angegebenen Reihenfolge schreiben (spätere = neuere Änderungszeit). */
 const ordner=async dateien=>{await page.evaluate(async projekt=>{const d=await (await navigator.storage.getDirectory()).getDirectoryHandle(projekt,{create:true});   // Inhalt leeren, der Ordner bleibt (ResultKit hält ihn offen)
   for await(const [name] of d.entries())await d.removeEntry(name,{recursive:true});},PROJEKT);
  for(const [pfad,text] of dateien){await schreibe(pfad,text);await pause();}};
 const schreibe=(pfad,text)=>page.evaluate(async ([projekt,pfad,text])=>{let d=await (await navigator.storage.getDirectory()).getDirectoryHandle(projekt);const teile=pfad.split('/');
  for(const t of teile.slice(0,-1))d=await d.getDirectoryHandle(t,{create:true});const w=await (await d.getFileHandle(teile.at(-1),{create:true})).createWritable();await w.write(text);await w.close();},[PROJEKT,pfad,text]);
 const entferne=pfad=>page.evaluate(async ([projekt,pfad])=>{let d=await (await navigator.storage.getDirectory()).getDirectoryHandle(projekt);const teile=pfad.split('/');for(const t of teile.slice(0,-1))d=await d.getDirectoryHandle(t);await d.removeEntry(teile.at(-1));},[PROJEKT,pfad]);
 const lies=pfad=>page.evaluate(async ([projekt,pfad])=>{let d=await (await navigator.storage.getDirectory()).getDirectoryHandle(projekt);const teile=pfad.split('/');
  try{for(const t of teile.slice(0,-1))d=await d.getDirectoryHandle(t);return await (await (await d.getFileHandle(teile.at(-1))).getFile()).text();}catch{return null;}},[PROJEKT,pfad]);
 const ERG='_Spektron/ResultKit/_Ergebnisse.json';
 let offen=false;
 /** Projekt öffnen (erstes Mal über die Fußleiste) bzw. neu einlesen; wartet auf den neuen Stand. */
 const einlesen=async bis=>{
  await page.evaluate(()=>{document.getElementById('berichte').innerHTML='';});   // alte Anzeige weg: gewartet wird auf das neue Einlesen
  if(!offen){await haupt.click();offen=true;}
  else{await page.locator('#rk-mehr').click();await page.locator('#mosaikMehrPop').waitFor();await page.locator('#rk-m-neu').click();}
  await until(async()=>(await page.locator('#berichte').textContent().catch(()=>''))?.includes(bis),`eingelesen: ${bis}`);};
 const uebernehmen=async()=>{assert.equal(await haupt.textContent(),'Ergebnisse übernehmen →');await haupt.click();await until(async()=>await art()==='fertig','übernommen');return JSON.parse(await lies(ERG));};
 const pakZelle=label=>page.locator('.u-gruppe').first().locator('tr.u-zeile',{has:page.getByRole('button',{name:label,exact:true})}).locator('td.rk-wz');

 await check('K2 mit Projektnummer: fremder Bericht (neuere Datei) steht in der Liste, seine Werte zählen nicht',async()=>{
  await ordner([[AUFTRAG,labelkit],[`Laborergebnisse/${EIGEN}.xml`,eigen],[`Laborergebnisse/${FREMD}.xml`,fremd('99.9002 Anderswo Hauptstr. 3')]]);
  await einlesen(FREMD);
  assert.equal(await page.locator('#jetzt .jetzt-stand').textContent(),'4 von 4 Proben mit Ergebnis');
  assert.match(await pakZelle('P1').textContent(),/^14/);
  const karte=page.locator('#berichte .bericht.fremd');assert.equal(await karte.count(),1);
  assert.match(await karte.textContent(),/AR-200-2026-000009-01.*anderes Projekt \(99\.9002\).*ResultKit übernimmt die Werte dieses Berichts nicht\. Das gilt auch, wenn nur die Auftragsreferenz einen Tippfehler hat – dann gibt es keinen zweiten Bericht zu suchen/s);
  assert.equal(await page.locator('#berichte .bericht.ersetzt').count(),0,'der eigene Bericht ist nicht „ersetzt“');
  assert.match(await page.locator('#berichte-block > summary').textContent(),/1 anderes Projekt/);
  if(process.env.FASSUNG_BILD){await page.locator('#berichte-block').evaluate(e=>{e.open=true;});await page.screenshot({path:`${process.env.FASSUNG_BILD}/fremd.png`,fullPage:true});}
  const d=await uebernehmen();
  assert.deepEqual(d.berichte.map(b=>b.bericht),[EIGEN]);assert.deepEqual(d.ersetzt,[]);assert.equal(d.vollstaendig,true);
  assert.equal(d.berichte[0].proben.find(p=>p.label==='P1').werte[0].r,'14');
 });

 await check('K2 ohne Projektnummer: Konflikt, beide Werte sichtbar, Übernahme gesperrt – nach Entfernen der Datei wieder frei',async()=>{
  await ordner([[AUFTRAG,labelkit],[`Laborergebnisse/${EIGEN}.xml`,eigen],[`Laborergebnisse/${FREMD}.xml`,fremd('Anderswo Hauptstr. 3')]]);
  await einlesen(FREMD);
  assert.equal(await art(),'konflikt');
  assert.equal(await jetzt.locator('h1').textContent(),'Zwei Prüfberichte für dieselben Proben – erst klären');
  assert.match(await jetzt.textContent(),/Für P1, P2, P3 stehen Werte in AR-100-2026-000001-01 und AR-200-2026-000009-01 – verschiedene Berichte, keine neue Fassung\. Welcher gehört zu diesem Projekt\? Nimm die falsche Datei aus „Laborergebnisse“ – bis dahin übernimmt ResultKit nichts\./);
  assert.equal(await haupt.textContent(),'Prüfberichte zeigen →','kein „Ergebnisse übernehmen“');
  assert.equal(await page.locator('#rk-stand').textContent(),'Übernahme gesperrt');
  assert.equal(await page.getByRole('button',{name:/übernehmen/i}).count(),0,'kein Knopf zum Übernehmen, auch nicht „Trotzdem“');
  const zelle=await pakZelle('P1').textContent();assert.match(zelle,/14 AR-100-2026-000001-01\s*800 AR-200-2026-000009-01/);assert.match(zelle,/⚠ 2 Berichte/);
  assert.equal(await page.locator('#berichte .bericht.konflikt').count(),2);
  if(process.env.FASSUNG_BILD)await page.screenshot({path:`${process.env.FASSUNG_BILD}/konflikt.png`,fullPage:true});   // zum Ansehen: FASSUNG_BILD=<Ordner>
  await haupt.click();await until(async()=>page.locator('#berichte-block').evaluate(e=>e.open),'Prüfberichte aufgeklappt');
  if(process.env.FASSUNG_BILD)await page.screenshot({path:`${process.env.FASSUNG_BILD}/konflikt-berichte.png`,fullPage:true});
  assert.equal(await lies(ERG),null,'nichts geschrieben');
  await entferne(`Laborergebnisse/${FREMD}.xml`);await einlesen(EIGEN);
  await until(async()=>await art()==='uebernehmen','wieder frei');
  const d=await uebernehmen();assert.deepEqual(d.berichte.map(b=>b.bericht),[EIGEN]);
 });

 await check('Beschreibung weicht bei allen Proben eines Berichts ab: Frage nennt den Bericht, Abbrechen schreibt nichts',async()=>{
  const nurFremd=labXML([probe(1,pak('5'),'OG Anderswo Raum 1, Decke, 400 cm²'),probe(2,pak('6'),'OG Anderswo Raum 2, Decke, 400 cm²')],{code:FREMD,ref:'Anderswo'});
  await ordner([[AUFTRAG,labelkit],[`Laborergebnisse/${FREMD}.xml`,nurFremd]]);
  await einlesen(FREMD);
  await haupt.click();const f=page.locator('#frage-dialog');await f.waitFor();
  assert.match(await f.textContent(),/Bei Prüfbericht AR-200-2026-000009-01 weicht die Probenbeschreibung bei allen 2 Proben von LabelKit ab\. Gehört der Bericht wirklich zu diesem Projekt\?/);
  await f.getByRole('button',{name:'Abbrechen'}).click();
  assert.equal(await lies(ERG),null);
 });

 await check('M1: -01 und -02 desselben Berichts, die ältere Fassung später gespeichert → -02 gilt',async()=>{
  const v1=labXML([probe(1,pak('12')),probe(2,pak('8'))],{code:'AR-300-2026-000001-01'}),v2=labXML([probe(1,pak('14')),probe(2,pak('9'))],{code:'AR-300-2026-000001-02'});
  await ordner([[AUFTRAG,labelkit],['Laborergebnisse/Bericht-02.xml',v2],['Laborergebnisse/Bericht-01-kopie.xml',v1]]);
  await einlesen('AR-300-2026-000001-01');
  assert.match(await pakZelle('P1').textContent(),/^14/);
  assert.match(await page.locator('#berichte .bericht.ersetzt').textContent(),/AR-300-2026-000001-01.*Ersetzt durch AR-300-2026-000001-02/s);
  await haupt.click();const f=page.locator('#frage-dialog');await f.waitFor();await f.getByRole('button',{name:'Trotzdem übernehmen'}).click();   // Zwischenstand (P3, P4 offen)
  await until(async()=>await art()==='fertig','übernommen');
  const d=JSON.parse(await lies(ERG));
  assert.deepEqual(d.berichte.map(b=>b.bericht),['AR-300-2026-000001-02']);assert.deepEqual(d.ersetzt,[{bericht:'AR-300-2026-000001-01',durch:['AR-300-2026-000001-02']}]);
  assert.deepEqual(d.berichte[0].proben.map(p=>p.werte[0].r),['14','9']);
 });

 await check('Vorläufig, dann endgültig; Teilberichte ohne Überschneidung gelten nebeneinander – ein dritter Bericht mit P1 sperrt',async()=>{
  const vorl=labXML([probe(1,pak('12')),probe(2,pak('8'))],{code:'AR-400-2026-000001-01',vorlaeufig:true});
  const endg=labXML([probe(1,pak('14')),probe(2,pak('9'))],{code:'AR-400-2026-000001-02'});
  const teil=labXML([probe(3,pak('2')),probe(4,[{p:'Chlorid',r:'3',u:'µg/cm²'}],'EG Testraum 4, Wand, Ansicht')],{code:'AR-401-2026-000002-01'});
  await ordner([[AUFTRAG,labelkit],['Laborergebnisse/A.xml',vorl],['Laborergebnisse/B.xml',endg],['Laborergebnisse/C.xml',teil]]);
  await einlesen('AR-401-2026-000002-01');
  assert.equal(await page.locator('#jetzt .jetzt-stand').textContent(),'4 von 4 Proben mit Ergebnis');
  const d=await uebernehmen();
  assert.deepEqual(d.berichte.map(b=>b.bericht).sort(),['AR-400-2026-000001-02','AR-401-2026-000002-01']);assert.deepEqual(d.ersetzt,[{bericht:'AR-400-2026-000001-01',durch:['AR-400-2026-000001-02']}]);
  // anderer Bericht (andere Grundnummer) mit einem Wert für P1 → Konflikt, die übernommene Datei bleibt unverändert
  const vorher=await lies(ERG);
  await schreibe('Laborergebnisse/D.xml',labXML([probe(1,pak('15'))],{code:'AR-402-2026-000003-01'}));
  await einlesen('AR-402-2026-000003-01');
  assert.equal(await art(),'konflikt');assert.match(await jetzt.textContent(),/Für P1 stehen Werte in AR-400-2026-000001-02 und AR-402-2026-000003-01.*PlanKit und FotoKit zeigen noch den Stand der letzten Übernahme/s);
  assert.equal(await lies(ERG),vorher);
 });
 assert.deepEqual(fehler,[]);
 await context.close();
}finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}
console.log(`${n} Browserprüfungen ResultKit 2.2 bestanden`);
