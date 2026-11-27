// ResultKit 2.7.0 im echten Browser: Laboraufträge aus LabelKit (Plan resultkit-nachauftrag-plan.md, R1–R6). Rein erfundene Daten.
// LabelKit-Datei mit zwei Aufträgen (wie LabelKit 5.5.0 sie schreibt), Prüfbericht AR-…-01 mit Auftrag 1 → Stand je Auftrag, A1/A2,
// Übernehmen schreibt die Kennung; neue Probe „noch nicht beim Labor“; Übernahme ohne Kennung → einmal erneut übernehmen;
// Übernahme einer neueren Fassung → nur ansehen, nichts überschrieben. Projektordner im privaten Browserdateisystem (OPFS).
// pnpm build && node tests/auftrag-browser.mjs   (lokal: LANG=C.UTF-8)
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {preview} from 'vite';
import {labXML} from './lab-fixtures.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');

const PROJEKT='99.9001 Musterort',SUM='Summe 16 EPA-PAK exkl. BG',U='µg/m²';
const r=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const fest=tag=>({am:`${tag}T10:00:00.000Z`,anlass:'Abschluss'});
const lkProbe=(n,a,x={})=>({id:n,_nr:n,matrix:'Wischprobe',datum:'2026-08-12',z2:`EG Raum ${n}`,z3:'verrußt',z4:'Untersicht',cm2:'100',...(a?{nrFest:fest(a==='a1'?'2026-08-14':'2026-08-22'),auftrag:a}:{}),...x});
const lkDatei=(neu=[])=>JSON.stringify({version:'5.5.0',nrSchutz:1,projekt:{nr:'99.9001'},
 proben:[...r(1,8).map(n=>lkProbe(n,'a1')),...r(14,17).map(n=>lkProbe(n,'a2')),...neu.map(n=>lkProbe(n,''))],chloridProben:r(9,13).map(n=>lkProbe(n,'a1',{chloridNr:n})),
 asbestProben:r(18,21).map(n=>lkProbe(n,'a2',{matrix:'Material (mineralisch)',z3:'Putz',z4:''})),sonstigeProben:[],
 weitereAuftraege:[{id:'a2',am:'2026-08-22',von:'Ka',proben:r(14,21)}],auftragZaehler:2,auftrag1:{am:'2026-08-14',quelle:'Laborübergabe vom 14.08.2026',proben:r(1,13)}});
const desc=n=>`EG Raum ${n}, verrußt, Untersicht, 100 cm²`;   // wie LabelKit die Laborübergabe schreibt – kommt wörtlich zurück
const probe=n=>({label:`P${n}`,ref:`Probe ${n}`,desc:desc(n),art:'Wischprobe',labNr:`999-2099-${String(n).padStart(8,'0')}`,
 lines:n<=8?[{p:SUM,r:String(n+2),u:U}]:[{p:'Chlorid',r:'4',u:'µg/cm²'}]});
const AR1='AR-500-2026-000001-01',AUFTRAG='Laboraufträge/99.9001_Daten.json',ERG='_Spektron/ResultKit/_Ergebnisse.json';

const server=await preview({preview:{host:'127.0.0.1',port:0,open:false},logLevel:'silent'});
const base=`http://127.0.0.1:${server.httpServer.address().port}/`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
let n=0;const check=async(name,fn)=>{await fn();n++;console.log('OK ResultKit 2.7: '+name);};
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
 const schreibe=(pfad,text)=>page.evaluate(async ([projekt,pfad,text])=>{let d=await (await navigator.storage.getDirectory()).getDirectoryHandle(projekt,{create:true});const teile=pfad.split('/');
  for(const t of teile.slice(0,-1))d=await d.getDirectoryHandle(t,{create:true});const w=await (await d.getFileHandle(teile.at(-1),{create:true})).createWritable();await w.write(text);await w.close();},[PROJEKT,pfad,text]);
 const lies=pfad=>page.evaluate(async ([projekt,pfad])=>{let d=await (await navigator.storage.getDirectory()).getDirectoryHandle(projekt);const teile=pfad.split('/');
  try{for(const t of teile.slice(0,-1))d=await d.getDirectoryHandle(t);return await (await (await d.getFileHandle(teile.at(-1))).getFile()).text();}catch{return null;}},[PROJEKT,pfad]);
 let offen=false;
 const einlesen=async bis=>{
  await page.evaluate(()=>{document.getElementById('berichte').innerHTML='';});
  if(!offen){await haupt.click();offen=true;}
  else{await page.locator('#rk-mehr').click();await page.locator('#mosaikMehrPop').waitFor();await page.locator('#rk-m-neu').click();}
  await until(async()=>(await page.locator('#berichte').textContent().catch(()=>''))?.includes(bis),`eingelesen: ${bis}`);};
 const stand=()=>page.locator('#jetzt .jetzt-stand').textContent();
 for(const [pfad,text] of [[AUFTRAG,lkDatei()],[`Laborergebnisse/${AR1}.xml`,labXML(r(1,13).map(probe),{code:AR1})]]){await schreibe(pfad,text);await pause();}

 await check('zwei Aufträge, AR-…-01 mit Auftrag 1 → Stand je Auftrag, A1/A2, Übernehmen schreibt die Kennung',async()=>{
  await einlesen(AR1);
  assert.equal(await stand(),'Auftrag 1 (14.08.): 13 von 13 ✓ · Auftrag 2 (22.08.): 0 von 8 · 8 offen');
  assert.equal(await page.locator('#rk-stand').getAttribute('title'),'Auftrag 1 (14.08.): 13 von 13 ✓ · Auftrag 2 (22.08.): 0 von 8 · 8 offen','Fußleiste');
  const pak=page.locator('.u-gruppe').first();
  assert.equal(await pak.locator('tr.u-zeile',{has:page.getByRole('button',{name:'P1',exact:true})}).locator('.rk-a').textContent(),'A1');
  assert.equal(await pak.locator('tr.u-zeile',{has:page.getByRole('button',{name:'P14',exact:true})}).locator('.rk-a').textContent(),'A2');
  assert.equal(await pak.locator('tr.u-zeile',{has:page.getByRole('button',{name:'P14',exact:true})}).locator('td.rk-wz').textContent(),'ausstehend','Auftrag 2 ist beim Labor');
  if(process.env.AUFTRAG_BILD)await page.screenshot({path:`${process.env.AUFTRAG_BILD}/je-auftrag.png`,fullPage:true});   // zum Ansehen: AUFTRAG_BILD=<Ordner>
  await pak.getByRole('button',{name:'P14',exact:true}).click();
  assert.match(await page.locator('.u-detail').first().textContent(),/Laborauftrag\s*Auftrag 2 vom 22\.08\.2026/);
  await haupt.click();const f=page.locator('#frage-dialog');await f.waitFor();
  assert.match(await f.textContent(),/Noch nicht vollständig: Auftrag 1 \(14\.08\.\): 13 von 13 ✓ · Auftrag 2 \(22\.08\.\): 0 von 8 · 8 offen\./,'Rückfrage je Auftrag');
  await f.getByRole('button',{name:'Trotzdem übernehmen'}).click();await until(async()=>await art()==='fertig','übernommen');
  const d=JSON.parse(await lies(ERG));
  assert.equal(d.version,1);assert.equal(d.app.version,'2.7.0');
  assert.deepEqual(d.auftrag.proben.map(p=>p.auftrag),[...r(1,13).map(()=>'a1'),...r(14,21).map(()=>'a2')]);
  assert.deepEqual(d.offen,r(14,21).map(n=>`P${n}`));assert.equal(d.vollstaendig,false);
 });

 await check('neue Probe in LabelKit → „noch nicht beim Labor“, zählt weiter mit',async()=>{
  await schreibe(AUFTRAG,lkDatei([22]));await pause();await einlesen(AR1);
  assert.equal(await stand(),'Auftrag 1 (14.08.): 13 von 13 ✓ · Auftrag 2 (22.08.): 0 von 8 · 8 offen · 1 neue Probe noch nicht beim Labor');
  const z=page.locator('.u-gruppe').first().locator('tr.u-zeile',{has:page.getByRole('button',{name:'P22',exact:true})});
  assert.equal(await z.locator('td.rk-wz').textContent(),'noch nicht beim Labor');assert.equal(await z.locator('.rk-a').count(),0);
  if(process.env.AUFTRAG_BILD){await page.locator('#rk-mehr').click();await page.locator('#rk-m-stelle').click();await page.screenshot({path:`${process.env.AUFTRAG_BILD}/neu-nach-stelle.png`,fullPage:true});
   await page.locator('#rk-mehr').click();await page.locator('#rk-m-art').click();}
  await schreibe(AUFTRAG,lkDatei());await pause();await einlesen(AR1);
 });

 await check('Übernahme ohne Kennung (älteres ResultKit) → „Bitte einmal erneut übernehmen“, Werte ändern sich nicht',async()=>{
  // erst mit dem jetzigen Dateistand übernehmen (die LabelKit-Datei wurde oben neu geschrieben), dann die Kennungen herausnehmen
  const trotzdem=async()=>{await haupt.click();const f=page.locator('#frage-dialog');await f.waitFor();await f.getByRole('button',{name:'Trotzdem übernehmen'}).click();await until(async()=>await art()==='fertig','übernommen');};
  await trotzdem();
  const d=JSON.parse(await lies(ERG));for(const p of d.auftrag.proben)delete p.auftrag;d.app.version='2.6.1';
  await schreibe(ERG,JSON.stringify(d,null,1));await einlesen(AR1);
  assert.equal(await art(),'geaendert');assert.equal(await jetzt.locator('h1').textContent(),'Bitte einmal erneut übernehmen');
  assert.match(await jetzt.textContent(),/Neu: zu jeder Probe steht der Laborauftrag aus LabelKit.*Werte ändern sich dadurch nicht\./s);
  await trotzdem();
  assert.equal(JSON.parse(await lies(ERG)).auftrag.proben.filter(p=>p.auftrag).length,21);
 });

 await check('Übernahme einer neueren Fassung → ansehen ja, Übernehmen gesperrt, nichts überschrieben',async()=>{
  const d=JSON.parse(await lies(ERG));d.app.version='2.8.0';const text=JSON.stringify(d,null,1);
  await schreibe(ERG,text);await schreibe(`Laborergebnisse/${AR1}.pdf`,'%PDF-1.4 kein Inhalt');await pause();   // neuer Dateistand: sonst stünde „erneut übernehmen“ da
  await einlesen(AR1);
  assert.equal(await art(),'neuer');assert.equal(await jetzt.locator('h1').textContent(),'Neuere ResultKit-Fassung – bitte die Seite neu laden');
  assert.match(await jetzt.textContent(),/stammt von ResultKit 2\.8\.0 – neuer als dieses Fenster \(2\.7\.0\)\..*Bitte die Seite neu laden \(Strg\+F5\)\./s);
  assert.equal(await haupt.textContent(),'Ergebnisse ansehen →');assert.equal(await page.locator('#rk-stand').textContent(),'Übernahme gesperrt');
  assert.equal(await page.getByRole('button',{name:/übernehmen/i}).count(),0,'kein Knopf zum Übernehmen');
  if(process.env.AUFTRAG_BILD)await page.screenshot({path:`${process.env.AUFTRAG_BILD}/neuere-fassung.png`});
  assert.equal(await lies(ERG),text,'nichts überschrieben');
 });
 assert.deepEqual(fehler,[]);
 await context.close();
}finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}
console.log(`${n} Browserprüfungen ResultKit 2.7 bestanden`);
