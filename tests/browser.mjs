// ResultKit im echten Browser – rein synthetische Daten. Eine Seite: „Jetzt dran“, Übersicht mit aufklappbaren Proben, Prüfberichte zugeklappt. Der Projektordner liegt im privaten Browserdateisystem (OPFS);
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
 chloridProben:[{chloridNr:4,matrix:'Wischprobe',datum:'08.10.2026',z2:'EG Testraum 1',z3:'Wand',z4:'Ansicht'}]});   // gleiche Stelle wie P1 → „Nach Stelle“ eine Zeile
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
  // Die Prüfungen der Tabellen je Probenart laufen in „Je Probenart“; „Nach Stelle“ (Standard) hat eine eigene Prüfung.
  await context.addInitScript(()=>{try{if(localStorage.getItem('resultkit-ansicht')===null)localStorage.setItem('resultkit-ansicht','art');}catch{}});
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base.replace(/\/$/,'')});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const fehler=[];page.on('pageerror',e=>fehler.push(e.message));page.on('console',m=>{if(m.type()==='error')fehler.push(m.text());});
  await page.goto(base);
  await ordner(page,{'_Projekt.json':JSON.stringify({nutzung:'Wohnen'}),'Laboraufträge/99.9001_08.10.2026_Daten.json':labelkit,'Laborergebnisse/AR-1-01.xml':vorlaeufig,[`Pläne/Probenplan ${PROJEKT}.probenplan`]:plan});
  const stand=page.locator('#jetzt .jetzt-stand'),jetzt=page.locator('#jetzt'),w=viewport.width;
  const art=()=>jetzt.getAttribute('data-art');
  const aufklappen=async(gruppe,probe)=>{const z=page.locator('.u-gruppe').nth(gruppe).locator('tr.u-zeile',{has:page.getByRole('button',{name:probe,exact:true})});await z.getByRole('button',{name:probe,exact:true}).click();
   const d=z.locator('xpath=following-sibling::tr[1]');await d.locator('.u-det').waitFor();return d;};

  await check(`${w}: Projekt öffnen – eine Seite: Jetzt dran, Übersicht, Prüfberichte zugeklappt`,async()=>{
   await page.getByRole('button',{name:'📁 Projektordner öffnen'}).click();
   await until(async()=>(await stand.textContent().catch(()=>''))?.includes('von 4'),'Stand');
   assert.equal(await page.getByRole('tab').count(),0,'keine Reiter mehr');
   assert.equal(await stand.textContent(),'0 von 4 Proben mit Ergebnis · 2 nur vorläufig · 2 offen');
   assert.equal(await art(),'uebernehmen');
   assert.match(await jetzt.locator('h1').textContent(),/Ergebnisse prüfen und übernehmen/);
   assert.match(await jetzt.textContent(),/Noch nicht übernommen/);assert.equal(await jetzt.locator('.chip').count(),0,'keine Hinweise');
   assert.deepEqual(await jetzt.locator('.jetzt-knoepfe button').allTextContents(),['Ergebnisse übernehmen','📥 Berichte importieren']);
   assert.deepEqual(await page.locator('.u-kachel .u-k-name').allTextContents(),['PAK','Chlorid']);
   assert.match(await page.locator('.u-kachel').first().textContent(),/2 \/ 3.*1 auffällig · 2 vorläufig · 1 offen/s);
   const pakZeilen=page.locator('.u-gruppe').first().locator('tbody tr.u-zeile');assert.equal(await pakZeilen.count(),3);
   assert.match(await pakZeilen.first().textContent(),/P1.*EG Testraum 1, Wand, Ansicht, 400 cm².*12.*vorläufig/s);
   assert.match(await pakZeilen.nth(2).textContent(),/P3.*ausstehend/s);
   assert.equal(await page.locator('#berichte-block').evaluate(e=>e.open),false,'Prüfberichte zugeklappt');
   assert.match(await page.locator('#berichte-block > summary').textContent(),/Prüfberichte\s*1.*AR-1-01 \(vorläufig\).*Neue hier ablegen/s);
   assert.equal(await page.title(),`${PROJEKT} · ResultKit`);
   assert.match(page.url(),/#projekt=99\.9001%20Musterort$/);
  });

  await check(`${w}: Probe aufklappen – alle Parameter, Hinweis, Bericht, Labor-Nr.; wieder zuklappen`,async()=>{
   const d=await aufklappen(0,'P1');
   assert.match(await d.textContent(),/Alle Parameter \(3\).*Σ16 EPA-PAK\s*12.*Naphthalin\s*n\. n\..*Nur vorläufige Werte.*AR-1-01 \(vorläufig\) vom 12\.10\.2026.*XML ✓.*999-2099-00000001/s);
   assert.equal(await page.getByRole('button',{name:'P1',exact:true}).getAttribute('aria-expanded'),'true');
   await page.getByRole('button',{name:'P1',exact:true}).click();
   assert.equal(await page.locator('.u-detail').count(),0);
  });

  await check(`${w}: Zwischenstand übernehmen fragt nach; Abbrechen schreibt nichts`,async()=>{
   await jetzt.getByRole('button',{name:'Ergebnisse übernehmen'}).click();
   const d=page.locator('#frage-dialog');await d.waitFor();assert.match(await d.textContent(),/Noch nicht vollständig: 0 von 4/);
   await d.getByRole('button',{name:'Abbrechen'}).click();
   assert.equal(await lies(page,'Laborergebnisse/_Ergebnisse.json'),null);
  });

  await check(`${w}: Import – fremdes Projekt abgewählt; danach „eingelesen – jetzt übernehmen?“`,async()=>{
   await page.locator('#datei-wahl').setInputFiles([{name:'AR-1-02.xml',mimeType:'application/xml',buffer:Buffer.from(endgueltig)},{name:'AR-7-01.xml',mimeType:'application/xml',buffer:Buffer.from(fremd)}]);
   const d=page.locator('#import-dialog');await d.waitFor();
   const eintraege=d.locator('.import-eintrag');assert.equal(await eintraege.count(),2);
   assert.equal(await eintraege.nth(0).locator('input').isChecked(),true);
   assert.equal(await eintraege.nth(1).locator('input').isChecked(),false,'fremdes Projekt nicht vorgewählt');
   assert.match(await eintraege.nth(1).textContent(),/nennt Projekt 99\.9002/);
   await d.getByRole('button',{name:'Ablegen'}).click();
   await until(async()=>(await stand.textContent().catch(()=>''))==='4 von 4 Proben mit Ergebnis','vollständig');
   assert.deepEqual(await liste(page,'Laborergebnisse'),['AR-1-01.xml','AR-1-02.xml']);
   assert.equal(await art(),'importiert');
   assert.equal(await jetzt.locator('h1').textContent(),'AR-1-02 eingelesen');
   assert.match(await jetzt.textContent(),/Keine Hinweise\. Jetzt übernehmen\?/);
   assert.deepEqual(await jetzt.locator('.jetzt-knoepfe button').allTextContents(),['Ergebnisse übernehmen','Erst ansehen']);
   const ersetzt=page.locator('.bericht.ersetzt');assert.equal(await ersetzt.count(),1);assert.match(await ersetzt.textContent(),/AR-1-01.*ersetzt/s);
   assert.match(await page.locator('#berichte-block > summary').textContent(),/AR-1-02 vom 12\.10\.2026.*1 ersetzt/s);
  });

  await check(`${w}: Bewertung in der aufgeklappten Probe – Σ16 EPA-PAK nach VdS (Wohnen), Chlorid nach VdS 2357`,async()=>{
   const p1=(await aufklappen(0,'P1')).locator('.wert').first();
   assert.match(await p1.textContent(),/Σ16 EPA-PAK\s*14/);
   assert.equal(await p1.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(224, 69, 58)');
   assert.match(await p1.getAttribute('title'),/VdS 2357.*Wohn/);
   const p2=(await aufklappen(0,'P2')).locator('.wert').first();
   assert.equal(await p2.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(76, 175, 80)');
   const chlorid=(await aufklappen(1,'P4')).locator('.wert').first();
   assert.equal(await chlorid.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(224, 69, 58)','Chlorid 26 µg/cm²: oberhalb von 5–10 µg/cm² (VdS 2357)');
   for(const p of ['P1','P2','P4'])await page.getByRole('button',{name:p,exact:true}).click();
   assert.equal(await page.locator('.u-detail').count(),0);
   assert.equal(await page.locator('#xss').count(),0,'Farbe aus dem Probenplan schleust kein HTML ein');assert.equal(await page.evaluate(()=>window.__xss),undefined);
  });

  await check(`${w}: Prüfberichte aufklappen – Alle Parameter je Bericht`,async()=>{
   await page.locator('#berichte-block > summary').click();
   const karte=page.locator('.bericht:not(.ersetzt)').first();
   await karte.locator('details.alle summary').click();
   assert.match(await karte.locator('.alle-tabelle').textContent(),/Naphthalin.*n\. n\./s);
   await page.locator('#berichte-block > summary').click();
  });

  await check(`${w}: Übersicht – nur Σ16 EPA-PAK, ruhige Bewertung, Filter „Nur auffällige“, Sortierung`,async()=>{
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
  });

  await check(`${w}: Nach Stelle – PAK und Chlorid nebeneinander, sortieren, markieren, Strg+C für Excel, nichts bearbeitbar`,async()=>{
   await page.getByRole('button',{name:'Nach Stelle'}).click();
   const t=page.locator('#m-tabelle');await t.waitFor();
   assert.deepEqual((await t.locator('thead th').allTextContents()).map(x=>x.replace(/[▲▼]/g,'')),['Probe','Probenahmestelle','Σ16 EPA-PAK (µg/m²)','Chlorid (µg/cm²)']);
   const zeilen=t.locator('tbody tr.m-zeile');assert.equal(await zeilen.count(),3);
   assert.match(await zeilen.first().textContent(),/P1 · P4.*EG Testraum 1, Wand, Ansicht.*14.*26/s);
   assert.equal(await t.locator('input,textarea,select,[contenteditable]').count(),0,'nur lesen');
   await t.getByRole('button',{name:/Σ16 EPA-PAK/}).click();
   assert.equal(await t.locator('thead th').nth(2).getAttribute('aria-sort'),'descending');
   assert.deepEqual(await zeilen.locator('th').allTextContents(),['P1 · P4','P2','P3'],'höchster Wert zuerst, < BG zuletzt');
   await zeilen.nth(1).locator('td').first().click();assert.equal(await zeilen.nth(1).getAttribute('aria-selected'),'true');
   await page.keyboard.press('Shift+ArrowDown');assert.deepEqual(await zeilen.evaluateAll(r=>r.map(x=>x.getAttribute('aria-selected'))),['false','true','true']);
   await page.keyboard.press('Control+c');
   const text=await page.evaluate(()=>navigator.clipboard.readText());
   assert.deepEqual(text.split(/\r?\n/),['Probe\tProbenahmestelle\tΣ16 EPA-PAK (µg/m²)\tChlorid (µg/cm²)','P2\tEG Testraum 2, Wand, Ansicht\t8,5\t','P3\tEG Testraum 3, Wand, Ansicht\t< 0,5\t']);
   await page.locator('#toast',{hasText:'2 Zeilen kopiert'}).waitFor();
   await page.keyboard.press('Enter');await t.locator('.u-detail .u-det').first().waitFor();assert.match(await t.locator('.u-detail').textContent(),/P3 · PAK.*Alle Parameter/s);
   await page.keyboard.press('Escape');assert.equal(await t.locator('.u-detail').count(),0);
   await zeilen.first().locator('td').first().dblclick();assert.match(await t.locator('.u-detail').textContent(),/P1 · PAK.*P4 · Chlorid/s,'beide Proben der Stelle');
   await page.keyboard.press('Escape');await page.keyboard.press('Control+a');assert.equal(await t.locator('tr.m-zeile[aria-selected=true]').count(),3);
   await page.getByRole('button',{name:'Je Probenart'}).click();assert.equal(await page.locator('#m-tabelle').count(),0);assert.equal(await page.locator('.u-gruppe').count(),2);
  });

  await check(`${w}: Ergebnisse übernehmen – Datei für PlanKit/FotoKit, danach grün ohne Hauptknopf`,async()=>{
   if(w<500){await jetzt.getByRole('button',{name:'Erst ansehen'}).click();assert.equal(await art(),'uebernehmen');}
   await jetzt.getByRole('button',{name:'Ergebnisse übernehmen'}).click();
   await until(async()=>await art()==='fertig','übernommen');
   assert.match(await jetzt.locator('h1').textContent(),/^Übernommen am .* ✓$/);
   assert.match(await jetzt.textContent(),/PlanKit und FotoKit verwenden diesen Stand/);
   assert.equal(await jetzt.locator('button.primary').count(),0,'nichts mehr zu tun');
   const datei=JSON.parse(await lies(page,'Laborergebnisse/_Ergebnisse.json'));
   assert.equal(datei.format,'spektron-ergebnisse');assert.equal(datei.projekt,'99.9001');assert.equal(datei.vollstaendig,true);
   assert.deepEqual(datei.berichte.map(b=>b.bericht),['AR-1-02']);assert.equal(datei.berichte[0].datum,'2026-10-12');assert.deepEqual(datei.ersetzt,[{bericht:'AR-1-01',durch:['AR-1-02']}]);
   assert.equal(datei.berichte[0].proben.length,4);assert.equal(datei.berichte[0].proben[0].reportId,datei.berichte[0].id);
   assert.deepEqual(datei.offen,[]);assert.equal(datei.auftrag.proben.length,4);
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

  await check(`${w}: XML+PDF: abweichender Hauptwert im PDF wird beim Import gemeldet (nur Hinweis, Wert aus der XML)`,async()=>{
   const rows=labRows.map((r,i)=>({...r,lines:[{p:SUM,r:['14','8,5','< 0,5'][i]??'2',u:U}]}));
   const pdfWerte=[{zeile:`${SUM}  ${U}`,r:['41','8,5','< 0,5','2','2','2','2','2','2']}];
   await page.locator('#datei-wahl').setInputFiles([{name:'AR-999.xml',mimeType:'application/xml',buffer:Buffer.from(labXML(rows))},{name:'AR-999.pdf',mimeType:'application/pdf',buffer:labPDF({werte:pdfWerte})}]);
   const d=page.locator('#import-dialog');await d.waitFor({timeout:60000});
   assert.match(await d.locator('.import-eintrag').textContent(),/1 Messwert weicht zwischen XML und PDF ab \(Probe 1\)/);
   await d.getByRole('button',{name:'Abbrechen'}).click();
  });

  await check(`${w}: Ordner ändert sich nach der Übernahme → „Erneut übernehmen“, Hinweis-Chip öffnet die Berichte`,async()=>{
   await page.evaluate(async projekt=>{const d=await (await (await navigator.storage.getDirectory()).getDirectoryHandle(projekt)).getDirectoryHandle('Laborergebnisse');const w=await (await d.getFileHandle('AR-1-02.pdf',{create:true})).createWritable();await w.write('%PDF-1.4 kaputt');await w.close();},PROJEKT);
   await page.getByRole('button',{name:'⟳ Neu einlesen'}).click();
   await until(async()=>await art()==='geaendert','geändert');
   assert.match(await jetzt.textContent(),/Geändert seit der Übernahme/);
   assert.match(await page.locator('#berichte').textContent(),/PDF ist beschädigt/,'unlesbare PDF wird gemeldet');
   await jetzt.getByRole('button',{name:/⚠ \d+ Hinweis/}).click();
   assert.equal(await page.locator('#berichte-block').evaluate(e=>e.open),true,'Hinweis-Chip klappt die Prüfberichte auf');
   await jetzt.getByRole('button',{name:'Erneut übernehmen'}).click();
   await until(async()=>await art()==='fertig','erneut übernommen');
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
