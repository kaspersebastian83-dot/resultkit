// ResultKit im echten Browser – rein synthetische Daten. Der Projektordner liegt im privaten Browserdateisystem (OPFS);
// die Ordnerauswahl wird durch diesen Ordner ersetzt. Prüft: Laborauftrag gegen Berichte, Import (XML, XML+PDF, doppelt,
// fremdes Projekt), vorläufig → endgültig, Bewertung nach VdS-Referenz, Rückfrage bei Zwischenstand, „Ergebnisse übernehmen“
// und den Hinweis, wenn sich der Ordner danach ändert.
// pnpm build && node tests/browser.mjs   (lokal ggf. PLAYWRIGHT_MODULE=playwright)
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {preview} from 'vite';
import {labRows,labXML,labPDF} from './lab-fixtures.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');

const PROJEKT='99.9001 Musterort',SUM='Summe 16 EPA-PAK exkl. BG',U='µg/m²';
const probe=(n,lines)=>({...labRows[0],label:`P${n}`,ref:`Probe ${n}`,labNr:`999-2099-${String(n).padStart(8,'0')}`,desc:`Testbereich ${n}, fiktive Oberfläche`,lines});
const pak=v=>[{p:SUM,r:v,u:U},{p:'Benzo[a]pyren',r:'< 0,5',u:U},{p:'Naphthalin',r:'n. n.',u:U}];
const labelkit=JSON.stringify({version:'4.41.0',projekt:{nr:'99.9001'},
 proben:[1,2,3].map(i=>({_nr:i,matrix:'Wischprobe',datum:'08.10.2026',z2:`EG Testraum ${i}`,z3:'Wand',z4:'Ansicht',cm2:'400'})),
 chloridProben:[{chloridNr:4,matrix:'Wischprobe',datum:'08.10.2026',z2:'EG Testraum 1',z4:'Aufsicht'}]});
const vorlaeufig=labXML([probe(1,pak('12')),probe(2,pak('8'))],{vorlaeufig:true,code:'AR-1-01'});
const endgueltig=labXML([probe(1,pak('14')),probe(2,pak('8,5')),probe(3,pak('< 0,5')),probe(4,[{p:'Chlorid',r:'26',u:'µg/cm²'}])],{code:'AR-1-02'});
const fremd=labXML([probe(1,pak('3'))],{code:'AR-7-01',ref:'99.9002 Anderswo'});
// Probenplan mit manipulierter Skalenfarbe: darf kein HTML einschleusen (ungültige Skala entfällt, VdS-Referenz gilt)
const plan=JSON.stringify({results:{usage:'residential',parameter:SUM,scales:{},vds:{[`${SUM}|${U}`]:{name:'X',cats:[{name:'a',from:0,color:'red;background:url(x)"><img id="xss" src="data:," onerror="window.__xss=1">'}]}}}});

const server=await preview({preview:{host:'127.0.0.1',port:0,open:false},logLevel:'silent'});
const base=`http://127.0.0.1:${server.httpServer.address().port}/`;
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
let n=0;const check=async(name,fn)=>{await fn();n++;console.log('OK ResultKit: '+name);};
const until=async(fn,what)=>{for(let i=0;i<100;i++){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,100));}throw Error(`Zeitüberschreitung: ${what}`);};

/** Projektordner im OPFS anlegen (Pfad → Text) und die Ordnerauswahl darauf umleiten. */
const ordner=(page,dateien)=>page.evaluate(async ([projekt,dateien])=>{
 const root=await navigator.storage.getDirectory();
 for await(const [name] of root.entries())await root.removeEntry(name,{recursive:true});
 const dir=await root.getDirectoryHandle(projekt,{create:true});
 for(const [pfad,text] of Object.entries(dateien)){let d=dir;const teile=pfad.split('/');for(const t of teile.slice(0,-1))d=await d.getDirectoryHandle(t,{create:true});
  const w=await (await d.getFileHandle(teile.at(-1),{create:true})).createWritable();await w.write(text);await w.close();}
},[PROJEKT,dateien]);
const lies=(page,pfad)=>page.evaluate(async ([projekt,pfad])=>{let d=await (await navigator.storage.getDirectory()).getDirectoryHandle(projekt);const teile=pfad.split('/');
 try{for(const t of teile.slice(0,-1))d=await d.getDirectoryHandle(t);return await (await (await d.getFileHandle(teile.at(-1))).getFile()).text();}catch{return null;}},[PROJEKT,pfad]);
const liste=(page,pfad)=>page.evaluate(async ([projekt,pfad])=>{let d=await (await navigator.storage.getDirectory()).getDirectoryHandle(projekt);for(const t of pfad.split('/'))d=await d.getDirectoryHandle(t);const out=[];for await(const [name] of d.entries())out.push(name);return out.sort();},[PROJEKT,pfad]);

try{
 for(const viewport of [{width:1366,height:900},{width:360,height:740}]){
  const context=await browser.newContext({viewport,timezoneId:'Europe/Berlin'});
  await context.addInitScript(projekt=>{window.showDirectoryPicker=async()=>(await navigator.storage.getDirectory()).getDirectoryHandle(projekt);},PROJEKT);
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const fehler=[];page.on('pageerror',e=>fehler.push(e.message));page.on('console',m=>{if(m.type()==='error')fehler.push(m.text());});
  await page.goto(base);
  await ordner(page,{'_Projekt.json':JSON.stringify({nutzung:'Wohnen'}),'Laboraufträge/99.9001_08.10.2026_Daten.json':labelkit,'Laborergebnisse/AR-1-01.xml':vorlaeufig,[`Pläne/Probenplan ${PROJEKT}.probenplan`]:plan});
  const stand=page.locator('#stand h1'),w=viewport.width;

  await check(`${w}: Projekt öffnen – Auftrag aus LabelKit gegen vorläufigen Bericht`,async()=>{
   await page.getByRole('button',{name:'📁 Projektordner öffnen'}).click();
   await until(async()=>(await stand.textContent())?.includes('von 4'),'Stand');
   // Zuerst die Übersicht: je Probenart eine Tabelle, LabelKit-Bezeichnung, vorläufige und offene Proben bleiben stehen
   assert.equal(await page.getByRole('tab',{name:'Übersicht'}).getAttribute('aria-selected'),'true');
   assert.deepEqual(await page.locator('.u-kachel .u-k-name').allTextContents(),['PAK','Chlorid']);
   assert.match(await page.locator('.u-kachel').first().textContent(),/2 \/ 3.*1 auffällig · 2 vorläufig · 1 offen/s);
   const pakZeilen=page.locator('.u-gruppe').first().locator('tbody tr');assert.equal(await pakZeilen.count(),3);
   assert.match(await pakZeilen.first().textContent(),/P1.*EG Testraum 1, Wand, Ansicht, 400 cm².*12.*vorläufig/s);
   assert.match(await pakZeilen.nth(2).textContent(),/P3.*ausstehend/s);
   assert.match(await page.locator('#u-uebernahme').textContent(),/Noch nicht übernommen/);
   await page.getByRole('tab',{name:/Prüfung und Import/}).click();
   assert.equal(await stand.textContent(),'0 von 4 Proben mit Ergebnis · 2 nur vorläufig · 2 offen');
   const zeilen=page.locator('table.proben tbody tr');assert.equal(await zeilen.count(),4);
   assert.match(await zeilen.nth(0).textContent(),/P1.*nur vorläufig/s);assert.match(await zeilen.nth(3).textContent(),/P4.*Chlorid.*offen/s);
   assert.match(await page.locator('.uebernahme').textContent(),/Noch nicht übernommen/);
   assert.equal(await page.title(),`${PROJEKT} · ResultKit`);
   assert.match(page.url(),/#projekt=99\.9001%20Musterort$/);
  });

  await check(`${w}: Zwischenstand übernehmen fragt nach; Abbrechen schreibt nichts`,async()=>{
   await page.getByRole('button',{name:'Ergebnisse übernehmen'}).click();
   const d=page.locator('#frage-dialog');await d.waitFor();assert.match(await d.textContent(),/Noch nicht vollständig: 0 von 4/);
   await d.getByRole('button',{name:'Abbrechen'}).click();
   assert.equal(await lies(page,'Laborergebnisse/_Ergebnisse.json'),null);
  });

  await check(`${w}: Import – endgültiger Bericht, fremdes Projekt abgewählt; nur Ausgewähltes wird abgelegt`,async()=>{
   await page.locator('#datei-wahl').setInputFiles([{name:'AR-1-02.xml',mimeType:'application/xml',buffer:Buffer.from(endgueltig)},{name:'AR-7-01.xml',mimeType:'application/xml',buffer:Buffer.from(fremd)}]);
   const d=page.locator('#import-dialog');await d.waitFor();
   const eintraege=d.locator('.import-eintrag');assert.equal(await eintraege.count(),2);
   assert.equal(await eintraege.nth(0).locator('input').isChecked(),true);
   assert.equal(await eintraege.nth(1).locator('input').isChecked(),false,'fremdes Projekt nicht vorgewählt');
   assert.match(await eintraege.nth(1).textContent(),/nennt Projekt 99\.9002/);
   await d.getByRole('button',{name:'Ablegen'}).click();
   await until(async()=>(await stand.textContent())==='4 von 4 Proben mit Ergebnis','vollständig');
   assert.deepEqual(await liste(page,'Laborergebnisse'),['AR-1-01.xml','AR-1-02.xml']);
   const ersetzt=page.locator('.bericht.ersetzt');assert.equal(await ersetzt.count(),1);assert.match(await ersetzt.textContent(),/AR-1-01.*ersetzt/s);
  });

  await check(`${w}: Bewertung – Σ16 EPA-PAK nach VdS (Wohnen), BG neutral markiert, Chlorid nach VdS 2357`,async()=>{
   const p1=page.locator('table.proben tbody tr').nth(0).locator('.wert').first();
   assert.match(await p1.textContent(),/Σ16 EPA-PAK\s*14/);
   assert.equal(await p1.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(224, 69, 58)');
   const p2=page.locator('table.proben tbody tr').nth(1).locator('.wert').first();
   assert.equal(await p2.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(76, 175, 80)');
   assert.match(await page.locator('#legende').textContent(),/VdS 2357.*Wohn/);
   const chlorid=page.locator('table.proben tbody tr').nth(3).locator('.wert').first();
   assert.equal(await chlorid.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(224, 69, 58)','Chlorid 26 µg/cm²: oberhalb von 5–10 µg/cm² (VdS 2357)');
   assert.equal(await page.locator('#xss').count(),0,'Farbe aus dem Probenplan schleust kein HTML ein');assert.equal(await page.evaluate(()=>window.__xss),undefined);
  });

  await check(`${w}: Alle Parameter aufklappbar`,async()=>{
   const karte=page.locator('.bericht:not(.ersetzt)').first();
   await karte.locator('details.alle summary').click();
   assert.match(await karte.locator('.alle-tabelle').textContent(),/Naphthalin.*n\. n\./s);
  });

  await check(`${w}: Übersicht – nur Σ16 EPA-PAK, ruhige Bewertung, Filter „Nur auffällige“, Sortierung`,async()=>{
   await page.getByRole('tab',{name:'Übersicht'}).click();
   const pak=page.locator('.u-gruppe').first();
   assert.deepEqual(await pak.locator('thead th').allTextContents(),['Probe','Probenahmestelle','Σ16 EPA-PAK (µg/m²)'],'drei Spalten, Bewertung als Farbe des Werts');
   assert.match(await pak.locator('h2').textContent(),/Prüfbericht AR-1-02 vom 12\.10\.2026/);
   assert.match(await pak.locator('.u-legende').textContent(),/VdS 2357.*unter Referenzwert.*Referenzwert erreicht\/überschritten/s);
   assert.doesNotMatch(await pak.locator('tbody').textContent(),/BaP|Benzo/);
   const chip=pak.locator('tbody tr').first().locator('.u-chip').first();
   assert.equal(await chip.textContent(),'14');assert.match(await chip.getAttribute('title'),/Referenzwert erreicht/);
   const [bg]=await chip.evaluate(e=>[getComputedStyle(e).backgroundColor]);
   assert.notEqual(bg,'rgb(224, 69, 58)','keine Vollfarbe');
   // Chlorid: VdS 2357, 5–10 µg/cm² korrosionschemisch relevant – 26 µg/cm² liegt darüber
   const cl=page.locator('.u-gruppe').nth(1);
   assert.deepEqual(await cl.locator('thead th').allTextContents(),['Probe','Probenahmestelle','Chlorid (µg/cm²)']);
   assert.match(await cl.locator('.u-legende').textContent(),/unterhalb.*< 5 µg\/cm².*im Bereich.*5 – < 10 µg\/cm².*oberhalb.*≥ 10 µg\/cm²/s);
   const clChip=cl.locator('tbody .u-chip').first();assert.equal(await clChip.textContent(),'26');assert.match(await clChip.getAttribute('title'),/oberhalb/);
   await page.getByRole('button',{name:'Nur auffällige'}).click();
   assert.deepEqual(await pak.locator('tbody th').allTextContents(),['P1']);assert.deepEqual(await cl.locator('tbody th').allTextContents(),['P4'],'Chlorid oberhalb ist auffällig');
   await page.getByRole('button',{name:'Alle'}).click();
   await page.locator('#u-sort').selectOption('nr');assert.deepEqual(await pak.locator('tbody th').allTextContents(),['P1','P2','P3']);
   await page.getByRole('tab',{name:/Prüfung und Import/}).click();
  });

  await check(`${w}: Ergebnisse übernehmen – Datei für PlanKit/FotoKit`,async()=>{
   await page.getByRole('button',{name:'Ergebnisse übernehmen'}).click();
   await until(async()=>/✓ Übernommen/.test(await page.locator('.uebernahme').textContent()),'übernommen');
   assert.equal(await page.getByRole('tab',{name:'Übersicht'}).getAttribute('aria-selected'),'true','nach der Übernahme zurück zur Übersicht');
   assert.match(await page.locator('#u-uebernahme').textContent(),/✓ Übernommen/);
   await page.getByRole('tab',{name:/Prüfung und Import/}).click();
   const datei=JSON.parse(await lies(page,'Laborergebnisse/_Ergebnisse.json'));
   assert.equal(datei.format,'spektron-ergebnisse');assert.equal(datei.projekt,'99.9001');assert.equal(datei.vollstaendig,true);
   assert.deepEqual(datei.berichte.map(b=>b.bericht),['AR-1-02']);assert.equal(datei.berichte[0].datum,'2026-10-12');assert.deepEqual(datei.ersetzt,[{bericht:'AR-1-01',durch:['AR-1-02']}]);
   assert.equal(datei.berichte[0].proben.length,4);assert.equal(datei.berichte[0].proben[0].reportId,datei.berichte[0].id);
   assert.deepEqual(datei.offen,[]);assert.equal(datei.auftrag.proben.length,4);
   assert.equal(await page.getByRole('button',{name:'Erneut übernehmen'}).count(),1);
  });

  await check(`${w}: Gleiche Datei erneut importieren – liegt schon da, nicht wählbar`,async()=>{
   await page.locator('#datei-wahl').setInputFiles([{name:'AR-1-02.xml',mimeType:'application/xml',buffer:Buffer.from(endgueltig)}]);
   const d=page.locator('#import-dialog');await d.waitFor();
   assert.match(await d.textContent(),/Liegt schon unverändert im Ordner/);
   assert.equal(await d.locator('.import-eintrag input').isDisabled(),true);
   assert.equal(await d.getByRole('button',{name:'Ablegen'}).isDisabled(),true);
   await d.getByRole('button',{name:'Abbrechen'}).click();
  });

  await check(`${w}: XML+PDF desselben Berichts werden gemeinsam gelesen (PDF zum Abgleich)`,async()=>{
   await page.locator('#datei-wahl').setInputFiles([{name:'AR-999.xml',mimeType:'application/xml',buffer:Buffer.from(labXML())},{name:'AR-999.pdf',mimeType:'application/pdf',buffer:labPDF()}]);
   const d=page.locator('#import-dialog');await d.waitFor({timeout:60000});
   const e=d.locator('.import-eintrag');assert.equal(await e.count(),1);
   assert.match(await e.textContent(),/AR-999-2099-000001-01.*AR-999\.xml \+ AR-999\.pdf.*9 Proben/s);
   assert.doesNotMatch(await e.textContent(),/Nicht lesbar/);
   await d.getByRole('button',{name:'Abbrechen'}).click();
  });

  await check(`${w}: Ordner ändert sich nach der Übernahme → Hinweis „erneut übernehmen“`,async()=>{
   await page.evaluate(async projekt=>{const d=await (await (await navigator.storage.getDirectory()).getDirectoryHandle(projekt)).getDirectoryHandle('Laborergebnisse');const w=await (await d.getFileHandle('AR-1-02.pdf',{create:true})).createWritable();await w.write('%PDF-1.4 kaputt');await w.close();},PROJEKT);
   await page.getByRole('button',{name:'⟳ Neu einlesen'}).click();
   await until(async()=>/Seit der Übernahme/.test(await page.locator('#u-uebernahme').textContent()),'Übersicht zeigt geändert');
   await until(async()=>/Seit der Übernahme/.test(await page.locator('.uebernahme').textContent()),'veraltet');
   assert.match(await page.locator('#berichte').textContent(),/PDF ist beschädigt/,'unlesbare PDF wird gemeldet');
   await page.getByRole('button',{name:'Ergebnisse übernehmen'}).click();
   await until(async()=>/✓ Übernommen/.test(await page.locator('.uebernahme').textContent()),'erneut übernommen');
   assert.ok(await lies(page,'Laborergebnisse/_Ergebnisse.vorher.json'),'vorige Übernahme bleibt erhalten');
  });

  await check(`${w}: kein waagrechter Überlauf der Seite`,async()=>{
   const breit=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth?[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&!e.closest('.tabelle-scroll')).map(e=>`${e.tagName}.${e.className}#${e.id} ${Math.round(e.getBoundingClientRect().right)}`).slice(0,12):[]);
   assert.deepEqual(breit,[],'Elemente ragen über den Rand');
  });
  assert.deepEqual(fehler,[]);
  await context.close();
 }
}finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}
console.log(`${n} Browserprüfungen ResultKit bestanden`);
