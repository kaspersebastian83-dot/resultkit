// Spektron-Kette (Integrationstest): LabelKit → ResultKit → Projektzentrale → PlanKit → FotoKit → BüroKit → BelegKit mit den echten Apps.
// Alle vier Apps laufen unter einem lokalen Server auf demselben Ursprung wie auf GitHub Pages und teilen sich daher den
// Archivordner (IndexedDB „mosaik-suite“/„kv“/„archiv“) – hier ein Ordner im privaten Browserdateisystem (OPFS).
// Ein erfundenes Projekt läuft einmal durch: Proben in LabelKit, vorläufiger und (teilweise) endgültiger Prüfbericht in ResultKit,
// Stand in der Projektzentrale, Werte und Warnleiste in PlanKit, Ergebnistabelle fürs Gutachten in FotoKit; danach vollständiger Bericht,
// Übergabe ans Büro, Versand in BüroKit, Abrechnung in BelegKit – bis die Projektzentrale „Versandt und abgerechnet“ zeigt. Geprüft wird vor allem, was zwischen den Apps kaputtgehen kann:
// gleiche Probennummern und -bezeichnungen überall, Vollständigkeit, „Plan liegt hinter ResultKit“.
// Nur erfundene Daten. Fehler nennen die App, in der der Schritt scheiterte.
//
// Voraussetzungen: ResultKit gebaut (pnpm build), daneben LabelKit, Projektzentrale, FotoKit und gebautes PlanKit:
//   LABELKIT_DIR=../labelkit  ZENTRALE_DIR=../projektzentrale  PLANKIT_DIST=../probenplan/dist  FOTOKIT_DIR=../bildumbenenner
//   BUEROKIT_DIR=../buerokit  BELEGKIT_DIR=../aufwandkit  node tests/suite-kette.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {labXML} from './lab-fixtures.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');

const neben=(env,...namen)=>{if(process.env[env])return path.resolve(process.env[env]);const d=namen.map(n=>path.resolve('..',n)).find(existsSync);if(!d)throw Error(`${env}: ${namen.join(' / ')} liegt nicht neben ResultKit`);return d;};
// Erster Pfadteil → Ordner (ohne Groß-/Kleinschreibung, wie die Links der Apps: ../labelkit/, ../Projektzentrale/, ../Probenplan/)
const APPS={labelkit:neben('LABELKIT_DIR','labelkit'),resultkit:path.resolve('dist'),projektzentrale:neben('ZENTRALE_DIR','projektzentrale','Projektzentrale'),probenplan:neben('PLANKIT_DIST','probenplan/dist','Probenplan/dist'),bildumbenenner:neben('FOTOKIT_DIR','bildumbenenner','Bildumbenenner'),buerokit:neben('BUEROKIT_DIR','buerokit'),aufwandkit:neben('BELEGKIT_DIR','aufwandkit')};
for(const [app,dir] of Object.entries(APPS))if(!existsSync(path.join(dir,'index.html')))throw Error(`${app}: index.html fehlt in ${dir}${app==='resultkit'||app==='probenplan'?' – vorher bauen':''}`);
const TYP={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json','.woff2':'font/woff2','.wasm':'application/wasm','.txt':'text/plain'};
const server=http.createServer(async(req,res)=>{
 try{
  const teile=decodeURIComponent(new URL(req.url,'http://x').pathname).split('/').filter(Boolean);const wurzel=APPS[(teile.shift()||'').toLowerCase()];if(!wurzel)throw 0;
  let datei=path.resolve(wurzel,...teile);if(!datei.startsWith(wurzel))throw 0;
  if((await stat(datei)).isDirectory())datei=path.join(datei,'index.html');
  res.writeHead(200,{'Content-Type':TYP[path.extname(datei)]||'application/octet-stream','Cache-Control':'no-store'}).end(await readFile(datei));
 }catch{res.writeHead(404).end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;

const NR='26.0601',PROJEKT=`${NR} Kettenort`,SUM='Summe 16 EPA-PAK exkl. BG',U='µg/m²',CL='µg/cm²';
const STELLEN=[['EG Küche','Wand','Ansicht'],['EG Flur','Decke','Untersicht'],['OG Bad','Fliese','Ansicht']];
// Wie bei Eurofins: Probenreferenz „Probe <Nr>“ und Probenbeschreibung (SPLPT_NAME) kommen aus der LabelKit-Übergabe zurück
const BESCHREIBUNG=[...STELLEN.map(([z2,z3,z4])=>`${z2}, ${z3}, ${z4}, 400 cm²`),'EG Küche, Arbeitsplatte, Aufsicht, 100 cm²'];
const xmlProbe=(n,lines)=>({ref:`Probe ${n}`,labNr:`999-2099-${String(n).padStart(8,'0')}`,desc:BESCHREIBUNG[n-1],art:'Wischprobe',lines});
const pak=(sum,bap)=>[{p:SUM,r:sum,u:U},...(bap?[{p:'Benzo[a]pyren',r:bap,u:U}]:[])];
// vorläufig: alles; endgültig: P1 nur Σ16 (BaP bleibt vorläufig), P2, P3, P4 Chlorid
const VORL=labXML([xmlProbe(1,pak('12','0,8')),xmlProbe(2,pak('7','< 0,5')),xmlProbe(3,pak('< 0,5','< 0,5')),xmlProbe(4,[{p:'Chlorid',r:'3',u:CL}])],{vorlaeufig:true,code:'AR-9-01',ref:PROJEKT});
const ENDG=labXML([xmlProbe(1,pak('14')),xmlProbe(2,pak('7,5','< 0,5')),xmlProbe(3,pak('< 0,5','< 0,5')),xmlProbe(4,[{p:'Chlorid',r:'3,5',u:CL}])],{code:'AR-9-02',ref:PROJEKT});
// endgültig nachgeliefert: BaP von P1 → alle Werte endgültig
const ENDG2=labXML([xmlProbe(1,[{p:'Benzo[a]pyren',r:'0,7',u:U}])],{code:'AR-9-03',ref:PROJEKT});
const HEUTE=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());   // JJJJ-MM-TT wie in BelegKit
const SVG='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#fff"/><rect x="40" y="40" width="720" height="520" fill="none" stroke="#000" stroke-width="6"/></svg>';

const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
const context=await browser.newContext({viewport:{width:1366,height:900},timezoneId:'Europe/Berlin',locale:'de-DE',serviceWorkers:'block'});
await context.addInitScript(()=>{try{localStorage.setItem('willkommen-gelesen','1');}catch{}});
const fehler=[];let n=0;
const neueSeite=async app=>{const p=await context.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>fehler.push(`${app}: ${e.message}`));p.on('dialog',d=>void d.accept());return p;};
const schritt=async(app,name,fn)=>{try{await fn();}catch(e){e.message=`[${app}] ${name}: ${e.message}`;throw e;}n++;console.log(`OK ${app}: ${name}`);};
const until=async(fn,was,ms=20000)=>{const ende=Date.now()+ms;for(;;){const v=await fn().catch(()=>null);if(v)return v;if(Date.now()>ende)throw Error(`Zeitüberschreitung: ${was}`);await new Promise(r=>setTimeout(r,150));}};
/** Datei im Projektordner lesen (Pfad relativ zum Projekt) bzw. Ordnerinhalt auflisten. */
const lies=(p,pfad)=>p.evaluate(async([projekt,pfad])=>{let d=await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv')).getDirectoryHandle(projekt);const t=pfad.split('/');
 try{for(const x of t.slice(0,-1))d=await d.getDirectoryHandle(x);return await (await (await d.getFileHandle(t.at(-1))).getFile()).text();}catch{return null;}},[PROJEKT,pfad]);
const liste=(p,pfad)=>p.evaluate(async([projekt,pfad])=>{let d=await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Archiv')).getDirectoryHandle(projekt);for(const x of pfad.split('/'))d=await d.getDirectoryHandle(x);const o=[];for await(const [k] of d.entries())o.push(k);return o.sort();},[PROJEKT,pfad]);

try{
 // ---- Archivordner mit leerem Projekt, wie ihn die Projektzentrale anlegt; Handle für alle Apps in „mosaik-suite“ ----
 const start=await neueSeite('Einrichtung');await start.goto(`${base}/resultkit/`);
 await start.evaluate(async([projekt,svg])=>{
  const root=await navigator.storage.getDirectory();for await(const [k] of root.entries())await root.removeEntry(k,{recursive:true});
  const archiv=await root.getDirectoryHandle('Archiv',{create:true}),p=await archiv.getDirectoryHandle(projekt,{create:true});
  const schreib=async(d,name,text)=>{const w=await (await d.getFileHandle(name,{create:true})).createWritable();await w.write(text);await w.close();};
  for(const s of ['Laboraufträge','Laborergebnisse','Pläne','Fotos'])await p.getDirectoryHandle(s,{create:true});
  await schreib(p,'_Projekt.json',JSON.stringify({format:'mosaik-projekt',version:1,projektnummer:projekt.slice(0,7),schadenort:'Kettenort',objekt:'Fiktives Testhaus, Musterweg 1',nutzung:'Wohnen',auftraggeber:'Fiktive Versicherung AG, Beispielweg 2'}));
  await schreib(archiv,'_Spektron-Mitarbeiter.json',JSON.stringify({format:'spektron-mitarbeiter',version:1,personen:[{ordnerKuerzel:'SK',appKuerzel:'SK',name:'Sven Beispiel',aktiv:true},{ordnerKuerzel:'Nad',appKuerzel:'Nad',name:'Nora Test',aktiv:true}]}));
  await schreib(await p.getDirectoryHandle('Mitteilungen',{create:true}),'Gutachten 26.0601.docx','synthetisch');
  await schreib(await p.getDirectoryHandle('Pläne'),'Grundriss EG.svg',svg);
  await new Promise((ok,nein)=>{const r=indexedDB.open('mosaik-suite',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onerror=()=>nein(r.error);
   r.onsuccess=()=>{const tx=r.result.transaction('kv','readwrite');tx.objectStore('kv').put(archiv,'archiv');tx.oncomplete=()=>{r.result.close();ok();};tx.onerror=()=>nein(tx.error);};});
 },[PROJEKT,SVG]);
 await start.close();

 // ---- 1. LabelKit: drei PAK-Wischproben und eine Chloridprobe, Zwischenstand in „Laboraufträge“ ----
 const lk=await neueSeite('LabelKit');
 await schritt('LabelKit','Projekt aus dem Archiv öffnen (#projekt=…)',async()=>{
  await lk.goto(`${base}/labelkit/#projekt=${encodeURIComponent(PROJEKT)}`);
  await lk.waitForFunction(nr=>typeof PROJEKTORDNER!=='undefined'&&PROJEKTORDNER.state.proj?.nr===nr,NR);
 });
 await schritt('LabelKit','Proben erfassen und speichern → …_Daten.json',async()=>{
  await lk.evaluate(async stellen=>{
   document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));document.querySelectorAll('dialog[open]').forEach(d=>d.close());
   for(const [z2,z3,z4] of stellen)addProbe({z2,z3,z4,cm2:'400',datum:'08.10.2026'});
   addChloridProbe();Object.assign(chloridProben.at(-1),{z2:'EG Küche',z3:'Arbeitsplatte',z4:'Aufsicht',cm2:'100',datum:'08.10.2026'});
   renummerieren();renderTable();if(typeof renderChloridTable==='function')renderChloridTable();markUnsaved();
   await schnellSpeichern();
  },STELLEN);
  const dateien=await until(async()=>{const l=await liste(lk,'Laboraufträge');return l.some(x=>/_Daten\.json$/.test(x))&&l;},'LabelKit-Datei im Projektordner');
  const daten=JSON.parse(await lies(lk,`Laboraufträge/${dateien.find(x=>/_Daten\.json$/.test(x))}`));
  assert.equal(daten.projekt?.nr,NR,'Projektnummer in der LabelKit-Datei');
  assert.deepEqual(daten.proben.map(p=>[p._nr,p.z2]),STELLEN.map(([z2],i)=>[i+1,z2]),'PAK-Proben P1–P3');
  assert.deepEqual(daten.chloridProben.map(p=>[p._nr??p.chloridNr,p.z2]),[[4,'EG Küche']],'Chloridprobe P4');
 });
 await lk.close();

 // ---- 2. ResultKit: vorläufiger Bericht → Zwischenstand übernehmen ----
 const rk=await neueSeite('ResultKit');
 const stand=()=>rk.locator('#jetzt .jetzt-stand').textContent(),art=()=>rk.locator('#jetzt').getAttribute('data-art');
 const importieren=async(name,xml)=>{await rk.locator('#datei-wahl').setInputFiles([{name,mimeType:'application/xml',buffer:Buffer.from(xml)}]);
  const d=rk.locator('#import-dialog');await d.waitFor();await d.getByRole('button',{name:'Ablegen'}).click();await d.waitFor({state:'hidden'});};
 const uebernehmen=async()=>{await rk.locator('#jetzt').getByRole('button',{name:/Ergebnisse übernehmen|Erneut übernehmen/}).click();
  const f=rk.locator('#frage-dialog');if(await f.waitFor({timeout:4000}).then(()=>true,()=>false))await f.getByRole('button',{name:'Trotzdem übernehmen'}).click();
  await until(async()=>await art()==='fertig','übernommen');};
 await schritt('ResultKit','Projekt öffnen: LabelKit-Proben sind beauftragt, noch nichts zurück',async()=>{
  await rk.goto(`${base}/resultkit/#projekt=${encodeURIComponent(PROJEKT)}`);
  await until(async()=>/0 von 4/.test(await stand()),'Stand 0 von 4');
  // Standardansicht „Nach Stelle“ (ab ResultKit 1.4.0): eine Zeile je Probenahmestelle, Spalte je Probenart
  const t=rk.locator('#m-tabelle');await t.waitFor();
  const spalten=(await t.locator('thead th').allTextContents()).map(x=>x.replace(/[▲▼]/g,''));
  assert.deepEqual(spalten.slice(0,3),['Probe','Probenahmestelle','Σ16 EPA-PAK']);
  const proben=(await t.locator('tbody tr.m-zeile th').allTextContents()).flatMap(x=>x.split(' · '));
  assert.deepEqual([...proben].sort(),['P1','P2','P3','P4'],'alle LabelKit-Proben genau einmal');
  const p1=t.locator('tr.m-zeile',{has:rk.locator('th',{hasText:/^P1( · |$)/})});
  assert.match(await p1.textContent(),/P1.*EG Küche, Wand, Ansicht/s,'Probenahmestelle wie in LabelKit (ohne Fläche)');
  assert.match(await p1.textContent(),/ausstehend/);
 });
 await schritt('ResultKit','vorläufigen Bericht importieren und als Zwischenstand übernehmen',async()=>{
  await importieren('AR-9-01.xml',VORL);
  await until(async()=>(await stand())==='0 von 4 Proben mit Ergebnis · 4 nur vorläufig','Stand nach vorläufigem Bericht');
  await uebernehmen();
  const e=JSON.parse(await lies(rk,'Laborergebnisse/_Ergebnisse.json'));
  assert.equal(e.projekt,NR);assert.equal(e.vollstaendig,false);assert.deepEqual(e.berichte.map(b=>[b.bericht,!!b.vorlaeufig]),[['AR-9-01',true]]);
  assert.deepEqual(e.berichte[0].proben.map(p=>p.label),['P1','P2','P3','P4'],'Probennummern aus dem Bericht = LabelKit');
 });

 // ---- 3. Projektzentrale: Stand des Projekts ----
 const pz=await neueSeite('Projektzentrale');
 const pzStufe=async()=>{await pz.locator(`.proj[data-name="${PROJEKT}"]`).click();await pz.locator('[data-stufe=labor] [data-stext]').waitFor();
  return until(async()=>{const t=(await pz.locator('[data-stufe=labor] [data-stext]').textContent()).trim();return t&&t;},'Stufe Labor');};
 await schritt('Projektzentrale','Projekt in der Liste (nach dem Spektron-Start), Labor: Zwischenstand',async()=>{
  await pz.goto(`${base}/projektzentrale/`);
  const zeile=pz.locator(`.proj[data-name="${PROJEKT}"]`);await zeile.waitFor();
  await until(async()=>(await zeile.getAttribute('data-gruppe'))!=='lesen','Projekt gelesen');
  assert.notEqual(await zeile.getAttribute('data-gruppe'),'vor','26.0601 liegt nach dem Spektron-Start');
  const t=await pzStufe();assert.match(t,/Zwischenstand|vorläufig/i,`Labor-Stufe zeigt den Zwischenstand (war: „${t}“)`);
  assert.doesNotMatch(t,/vollständig übernommen/i);
 });

 // ---- 4. PlanKit: Plan, Proben aus LabelKit, Werte aus ResultKit ----
 const pk=await neueSeite('PlanKit');
 await pk.addLocatorHandler(pk.locator('#ask-title',{hasText:'Gespeicherte Fassungen prüfen'}),()=>pk.locator('#ask-actions button',{hasText:'Datei verwenden'}).click());
 const planDatei=async()=>JSON.parse(await until(()=>lies(pk,`Pläne/Probenplan ${PROJEKT}.probenplan`),'Plan gespeichert'));
 const uebernahme=async(auswahl)=>{await pk.locator('#lab-import').click();await pk.locator(`#lab-folder-dialog ${auswahl}`).first().click();await pk.locator('#lab-review').waitFor();
  const alle=pk.locator('#lab-update-all:visible');if(await alle.count())await alle.click();
  await pk.locator('#lab-confirm:enabled').click();await pk.locator('#lab-review').waitFor({state:'hidden'});await pk.waitForTimeout(1200);};
 const offene=async()=>Object.fromEntries((await planDatei()).pending.map(r=>[r.label,r]));
 await schritt('PlanKit','Projekt öffnen, Grundriss aus „Pläne“, Proben aus LabelKit',async()=>{
  await pk.goto(`${base}/probenplan/#projekt=${encodeURIComponent(PROJEKT)}`);await pk.locator('#project-badge:not([hidden])').waitFor();
  await pk.locator('#folder-plans button',{hasText:'Grundriss EG.svg'}).click();await pk.locator('#welcome').waitFor({state:'hidden'});
  await uebernahme('[data-labelkit]');
  const o=await offene();assert.deepEqual(Object.keys(o).sort(),['P1','P2','P3','P4']);
  assert.equal(o.P1.desc,'EG Küche, Wand, Ansicht, 400 cm²','Beschreibung wie in LabelKit');assert.equal(o.P4.desc,'EG Küche, Arbeitsplatte, Aufsicht, 100 cm²');
  assert.ok(await pk.locator('#resultkit-warning').isHidden(),'nur LabelKit-Proben: keine Warnleiste');
 });
 await schritt('PlanKit','Werte aus ResultKit (vorläufig) übernehmen',async()=>{
  await uebernahme('[data-ergebnis]');
  const o=await offene();assert.deepEqual(Object.keys(o).sort(),['P1','P2','P3','P4'],'keine neuen oder verschobenen Nummern');
  assert.equal(o.P1.werte.find(w=>w.p===SUM)?.r,'12');assert.equal(o.P1.desc,'EG Küche, Wand, Ansicht, 400 cm²');
  await pk.evaluate(()=>window.dispatchEvent(new Event('focus')));await pk.waitForTimeout(800);
  assert.ok(await pk.locator('#resultkit-warning').isHidden(),'Plan auf dem Stand von ResultKit');
 });

 // ---- 5. Endgültiger Bericht, aber P1 nur teilweise: ResultKit bleibt beim Zwischenstand ----
 await schritt('ResultKit','endgültigen Bericht importieren: P1 bleibt vorläufig (BaP nur vorläufig), Zwischenstand',async()=>{
  await rk.bringToFront();await importieren('AR-9-02.xml',ENDG);
  await until(async()=>(await stand())==='3 von 4 Proben mit Ergebnis · 1 nur vorläufig','Stand nach endgültigem Bericht');
  await uebernehmen();
  const e=JSON.parse(await lies(rk,'Laborergebnisse/_Ergebnisse.json'));
  assert.equal(e.vollstaendig,false,'P1 hat noch einen vorläufigen Wert');
  assert.deepEqual(e.berichte.map(b=>b.bericht).sort(),['AR-9-01','AR-9-02'],'vorläufiger Bericht gilt noch für P1/BaP');assert.deepEqual(e.ersetzt,[]);
 });
 await schritt('Projektzentrale','nach der zweiten Übernahme weiter Zwischenstand, nicht „vollständig“',async()=>{
  await pz.bringToFront();await pz.locator('#btnRescan').click();
  const t=await pzStufe();assert.match(t,/Zwischenstand|vorläufig/i,`Labor-Stufe (war: „${t}“)`);assert.doesNotMatch(t,/vollständig übernommen/i);
 });
 await schritt('PlanKit','Warnleiste „Neuerer Laborstand“, Aktualisieren: gleiche Nummern, neue Werte, Leiste weg',async()=>{
  await pk.bringToFront();await pk.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await pk.locator('#resultkit-warning:not([hidden])').waitFor();
  assert.match(await pk.locator('#resultkit-warning-text').textContent(),/AR-9-02 ist in ResultKit übernommen, aber noch nicht im Plan/);
  await pk.locator('#resultkit-warning-go').click();await pk.locator('#lab-folder-dialog').waitFor();
  await pk.locator('#lab-folder-dialog .close').click();await uebernahme('[data-ergebnis]:has-text("AR-9-02")');
  const o=await offene();assert.deepEqual(Object.keys(o).sort(),['P1','P2','P3','P4'],'Nummern unverändert');
  assert.equal(o.P1.werte.find(w=>w.p===SUM)?.r,'14','Σ16 aus dem endgültigen Bericht');assert.equal(o.P2.werte.find(w=>w.p===SUM)?.r,'7,5');
  assert.equal(o.P4.werte.find(w=>w.p==='Chlorid')?.r,'3,5');assert.equal(o.P3.desc,'OG Bad, Fliese, Ansicht, 400 cm²');
  await pk.evaluate(()=>window.dispatchEvent(new Event('focus')));await pk.locator('#resultkit-warning').waitFor({state:'hidden'});
 });
 // ---- 6. FotoKit: Ergebnistabelle fürs Gutachten aus dem übernommenen Stand ----
 const fk=await neueSeite('FotoKit');
 await schritt('FotoKit','Ergebnistabelle: P1–P4 mit den Werten aus ResultKit, Zwischenstand und vorläufige Werte gekennzeichnet',async()=>{
  await fk.goto(`${base}/bildumbenenner/#projekt=${encodeURIComponent(PROJEKT)}`);
  await fk.locator('#btnLab:enabled').click();
  const vorschau=fk.locator('#lPrev');await until(async()=>/P4/.test(await vorschau.textContent()),'Tabelle mit P4');
  const tabelle=await vorschau.textContent();
  const proben=await vorschau.locator('tr').evaluateAll(z=>z.map(r=>r.cells[0]?.textContent.trim()).filter(t=>/^P\d+$/.test(t||'')));
  assert.deepEqual([...new Set(proben)].sort(),['P1','P2','P3','P4'],'je Probe eine Zeile');
  assert.match(tabelle,/OG Bad, Fliese, Ansicht, 400 cm²/,'Beschreibung wie in LabelKit');
  const p1=await vorschau.locator('tr').evaluateAll(z=>z.filter(r=>r.cells[0]?.textContent.trim()==='P1').map(r=>[...r.cells].map(c=>c.textContent.trim())));
  assert.ok(p1.some(z=>z.some(c=>/^14\b/.test(c))),`Σ16 von P1 aus dem endgültigen Bericht (Zeile: ${JSON.stringify(p1)})`);
  const quelle=await fk.locator('#lSrc').textContent();
  assert.ok(p1.some(z=>z.some(c=>/^0,8\b/.test(c))),'BaP von P1 noch aus dem vorläufigen Bericht');
  assert.match(quelle,/Zwischenstand/,'Zwischenstand aus ResultKit');assert.match(quelle,/vorläufige Werte/);
  assert.doesNotMatch(quelle,/Seit der Übernahme/,'Stand passt zur Übernahme');
 });
 // ---- 7. Letzter endgültiger Bericht: alles vollständig ----
 await schritt('ResultKit','nachgelieferten Bericht importieren: 4 von 4 endgültig, vollständig übernommen',async()=>{
  await rk.bringToFront();await importieren('AR-9-03.xml',ENDG2);
  await until(async()=>(await stand())==='4 von 4 Proben mit Ergebnis','Stand vollständig');
  await uebernehmen();
  const e=JSON.parse(await lies(rk,'Laborergebnisse/_Ergebnisse.json'));assert.equal(e.vollstaendig,true);assert.deepEqual(e.offen,[]);
  assert.deepEqual(e.ersetzt.map(x=>x.bericht),['AR-9-01'],'vorläufiger Bericht jetzt ganz ersetzt');
 });

 // ---- 8. Projektzentrale: Labor fertig, Gutachten ans Büro übergeben ----
 const pzZeile=()=>pz.locator(`.proj[data-name="${PROJEKT}"]`);
 const pzStand=async(gruppe,kurz)=>until(async()=>(await pzZeile().getAttribute('data-gruppe'))===gruppe&&(await pzZeile().locator('.stand').textContent())===kurz,`Liste: ${gruppe} · ${kurz}`);
 await schritt('Projektzentrale','Labor „vollständig übernommen“, dann „Ans Büro übergeben“ → Aufgabe für BüroKit',async()=>{
  await pz.bringToFront();await pz.evaluate(()=>localStorage.setItem('spektron-ich','SK'));await pz.reload();
  const t=await pzStufe();assert.match(t,/Ergebnisse vollständig übernommen/,`Labor-Stufe (war: „${t}“)`);
  await pz.locator('[data-ab-summary]').click();
  await pz.locator('[data-ab-word]').selectOption('Mitteilungen/Gutachten 26.0601.docx');
  if(!await pz.locator('[data-ab-an="0"]').isChecked())await pz.locator('[data-ab-an="0"]').check();
  assert.match(await pz.locator('[data-ab-details="0"]').inputValue(),/Fiktive Versicherung AG/,'Auftraggeber aus den Projektdaten');
  await pz.locator('[data-ab-los]').click();await pz.locator('#bueroPanel [data-ab-msg]').filter({hasText:'✓ Ans Büro übergeben'}).waitFor();
  const aufgaben=await liste(pz,'_Buero/aufgaben');assert.equal(aufgaben.length,1,'eine Aufgabe in „_Buero/aufgaben“');
  await pz.locator('#btnRescan').click();await pzStand('laeuft','Beim Büro');
 });

 // ---- 9. BüroKit: gegenlesen, PDF, Versand → erledigt ----
 const bk=await neueSeite('BüroKit');
 await schritt('BüroKit','Aufgabe aus der Projektzentrale abarbeiten: Gegenlesen, PDF, Versand → erledigt',async()=>{
  await bk.goto(`${base}/buerokit/`);
  const karte=bk.locator('.aufgabe',{hasText:NR});await karte.waitFor();
  assert.match(await karte.textContent(),/Kettenort/);
  await bk.locator('#ich').selectOption('Nad');
  const fertig=()=>bk.waitForFunction(()=>!document.querySelector('#liste input:disabled'));
  await karte.locator('input[data-s="gegenlesen"]').check();await fertig();
  await karte.locator('input[data-s="pdf"]').check();await fertig();
  await karte.locator('button.schritt[data-mehr]').click();
  const empf=karte.locator('.empf input');const anzahl=await empf.count();assert.ok(anzahl>=1,'Empfänger aus der Übergabe');
  for(let i=0;i<anzahl;i++){await karte.locator('.empf input').nth(i).check();await fertig();}
  await bk.locator('#erledigtBox').waitFor();
 });
 await schritt('Projektzentrale','nach dem Versand: „Versandt · Abrechnung offen“',async()=>{
  await pz.bringToFront();await pz.locator('#btnRescan').click();await pzStand('dich','Versandt · Abrechnung offen');
 });

 // ---- 10. BelegKit: Zeiten erfassen, Abrechnungsstand speichern ----
 const bl=await neueSeite('BelegKit');
 await schritt('BelegKit','Zeiten erfassen und „Stand speichern“ → Abrechnung im Projektordner',async()=>{
  await bl.goto(`${base}/aufwandkit/#zeiten&projekt=${encodeURIComponent(PROJEKT)}`);
  await bl.waitForFunction(n=>typeof A!=='undefined'&&A.proj?.name===n,PROJEKT);
  await bl.locator('button[data-tab="zeiten"]').click();
  if(await bl.locator('#kzEin').isVisible().catch(()=>false)){await bl.locator('#kzEin').fill('sk');await bl.locator('#kzOk').click();}
  await bl.locator('#zNeu').click();
  const z=f=>bl.locator(`#zRows tr[data-i="0"] [data-f="${f}"]`);
  await z('datum').fill(HEUTE);await z('stunden').fill('6');
  await bl.waitForFunction(()=>/gespeichert in „Abrechnung\/Aufwand_SK\.json“/.test(document.getElementById('status').textContent));
  await bl.locator('button[data-tab="abrechnung"]').click();await bl.locator('#aStand').click();
  await until(async()=>(await liste(bl,'Abrechnung')).includes(`${NR.replace('.','-')}_Aufwand_${HEUTE}.json`),'Abrechnungsstand gespeichert');
 });
 await schritt('Projektzentrale','Projekt „Versandt und abgerechnet“, abgeschlossen; Fortschritt seit dem Spektron-Start',async()=>{
  await pz.bringToFront();await pz.reload();
  await pzStand('fertig','Versandt und abgerechnet');
  await pz.locator('#heuteLink').click();   // nach dem Neuladen ist das zuletzt geöffnete Projekt wieder offen
  assert.match(await pz.locator('.fortschritt').textContent(),/Seit dem Spektron-Start \(ab 26\.0560\): 1 Projekt im Büro, 1 abgeschlossen/);
 });
 assert.deepEqual(fehler,[],'Skriptfehler in einer App');
}catch(e){
 // In GitHub Actions als Annotation am PR (App und Schritt stehen in der Meldung)
 if(process.env.GITHUB_ACTIONS)console.log(`::error title=Spektron-Kette::${String(e?.message||e).slice(0,1500).replace(/%/g,'%25').replace(/\r/g,'').replace(/\n/g,'%0A')}${fehler.length?`%0ASkriptfehler: ${fehler.join(' | ').slice(0,600)}`:''}`);
 throw e;
}finally{await browser.close();await new Promise(r=>server.close(r));}
console.log(`${n} Schritte der Spektron-Kette bestanden`);
