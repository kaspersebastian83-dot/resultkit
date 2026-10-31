// ResultKit-Kern in Node: Laborauftrag (LabelKit) gegen Prüfberichte, Zusammenführen, _Ergebnisse.json. Synthetische Daten.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname} from 'node:path';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context);}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
const E=await import('../src/ergebnisse.ts');
const {labelkitReport}=await import('../src/labelkit.ts');
const {nachweisgrenze,pruefHinweise}=await import('../src/labreport.ts');
const UE=await import('../src/uebersicht.ts');
let n=0;const ok=(name,fn)=>{fn();n++;console.log('OK Ergebnisse: '+name);};

const SUM='Summe 16 EPA-PAK exkl. BG',U='µg/m²';
// LabelKit: 3 PAK-Wischproben (1–3), 1 Chlorid (4), 1 Bohrkern-Rückstellprobe (5, ohne Analyse). Erfundene Orte.
const labelkit=JSON.stringify({version:'4.41.0',projekt:{nr:'99.9001'},
 proben:[1,2,3].map(i=>({_nr:i,matrix:'Wischprobe',datum:'08.10.2026',z2:`EG Testraum ${i}`,z3:'Wand',z4:'Ansicht',cm2:'400'})),
 chloridProben:[{chloridNr:4,matrix:'Wischprobe',datum:'08.10.2026',z2:'EG Testraum 1',z4:'Aufsicht'}],
 sonstigeProben:[{_nr:5,matrix:'Bohrkern',bkStatus:'R',bkId:'BK-1'}]});
// So schreibt Eurofins den Text der Laborübergabe zurück (wörtlich) – Proben außerhalb des Auftrags: frei erfunden.
const DESC={1:'EG Testraum 1, Wand, Ansicht, 400 cm²',2:'EG Testraum 2, Wand, Ansicht, 400 cm²',3:'EG Testraum 3, Wand, Ansicht, 400 cm²',4:'EG Testraum 1, Aufsicht'};
const auftrag=()=>labelkitReport(labelkit,'99.9001_08.10.2026_Daten.json','99.9001 Musterort');
const report=(bericht,proben,{vorlaeufig=false,ref='99.9001 Musterort',xml=true}={})=>({bericht,labor:'Eurofins',auftragsreferenz:ref,quelle:`${bericht}.xml`,batch:'',sources:xml?{xml:`${bericht}.xml`,pdf:`${bericht}.pdf`}:{pdf:`${bericht}.pdf`},
 rows:proben.map(([nr,werte])=>({label:`P${nr}`,ref:`Probe ${nr}`,desc:DESC[nr]??`Testbereich ${nr}`,art:'Wischprobe',labNr:`999-${nr}`,datum:'2026-10-08',...(werte?{werte}:{})})),expected:proben.length,references:[],warnings:[],results:[],...(vorlaeufig?{vorlaeufig:true}:{})});
const pak=v=>[{p:SUM,r:v,u:U,loq:'0,5'},{p:'Benzo[a]pyren',r:'< 0,5',u:U,loq:'0,5'}];

ok('Beschreibung: gleicher Text still, Abweichung als Hinweis an der Probe und in _Ergebnisse.json',()=>{
 const r=report('AR-9-01',[[1,pak('14')],[2,pak('8')]]);
 r.rows[0].desc='eg  testraum 1, Wand, Ansicht, 400 cm²';   // Leerraum/Schreibung zählen nicht
 r.rows[1].desc='EG Testraum 3, Wand, Ansicht, 400 cm²';    // vertauscht/umnummeriert
 const u=E.uebersicht('99.9001',auftrag(),[{report:r,geaendert:1}]);
 const z=Object.fromEntries(u.zeilen.map(z=>[z.label,z]));
 assert.equal(z.P1.hinweise.filter(h=>h.startsWith('Beschreibung')).length,0);
 assert.deepEqual(z.P2.hinweise,['Beschreibung: LabelKit „EG Testraum 2, Wand, Ansicht, 400 cm²“, Bericht AR-9-01 „EG Testraum 3, Wand, Ansicht, 400 cm²“ – stimmt die Zuordnung? In LabelKit oder beim Labor klären.']);
 assert.equal(z.P2.desc,'EG Testraum 2, Wand, Ansicht, 400 cm²','die Beschreibung aus LabelKit bleibt stehen');
 assert.ok(E.ergebnisDatei(u,auftrag(),[],'1.12.0').hinweise.some(h=>h.startsWith('P2: Beschreibung')));
});
ok('beschreibungWeichtAb: Striche/Anführungszeichen, Tiefe am Ende, Bohrkern und leere Texte nie',()=>{
 assert.equal(E.beschreibungWeichtAb('Zugestellte Probe vom 13.10.2026 - Kaminski','Zugestellte Probe vom 13.10.2026 – Kaminski'),false);
 assert.equal(E.beschreibungWeichtAb('Keller, „Altbau“','Keller, "Altbau"'),false);
 assert.equal(E.beschreibungWeichtAb('EG Flur, Wand, Tiefe: 0–2 cm','EG Flur, Wand'),false);
 assert.equal(E.beschreibungWeichtAb('BK-1 · Beton · 0–5 cm','BK-1 · 0–5 cm · Beton','Sonstige · Bohrkern'),false);
 assert.equal(E.beschreibungWeichtAb('EG Flur','',''),false);assert.equal(E.beschreibungWeichtAb('','EG Flur'),false);
 assert.equal(E.beschreibungWeichtAb('3. OG, Wohnzimmer, Spachtelmassel Zimmerdecke','3. OG, Wohnzimmer, Spachtelmasse Zimmerdecke'),true,'auch ein Buchstabe zählt');
});
ok('Laborauftrag: Rückstellprobe zählt nicht, Probe 4 als Chlorid',()=>{
 const a=auftrag();assert.deepEqual(a.rows.map(r=>[r.label,r.typ]),[['P1','PAK'],['P2','PAK'],['P3','PAK'],['P4','Chlorid']]);
});
ok('nichts eingegangen: alles offen, Stand nennt 0 von 4',()=>{
 const u=E.uebersicht('99.9001',auftrag(),[]);
 assert.deepEqual(u.zeilen.map(z=>z.status),['offen','offen','offen','offen']);assert.equal(E.standText(u),'0 von 4 Proben mit Ergebnis · 4 offen');assert.equal(E.vollstaendig(u),false);
});
ok('vorläufig, dann endgültig: endgültige Werte gelten, vorläufiger Bericht ersetzt',()=>{
 const vorl=report('AR-1-01',[[1,pak('12')],[2,pak('8')]],{vorlaeufig:true}),endg=report('AR-1-02',[[1,pak('14')],[2,pak('9')],[3,pak('< 0,5')]]);
 const u=E.uebersicht('99.9001',auftrag(),[{report:vorl,geaendert:1},{report:endg,geaendert:2}]);
 const z=Object.fromEntries(u.zeilen.map(z=>[z.label,z]));
 assert.equal(z.P1.status,'ergebnis');assert.deepEqual(z.P1.werte.map(w=>w.r),['14','< 0,5']);
 assert.equal(z.P3.status,'ergebnis');assert.equal(z.P4.status,'offen');
 const b1=u.berichte.find(b=>b.bericht==='AR-1-01');assert.deepEqual(b1.ersetztDurch,['AR-1-02']);
 assert.equal(E.standText(u),'3 von 4 Proben mit Ergebnis · 1 offen');
 const datei=E.ergebnisDatei(u,auftrag(),[{name:'AR-1-02.xml',size:10,t:2}],'1.0.0',new Date('2026-10-26T10:00:00Z'));
 assert.deepEqual(datei.berichte.map(b=>b.bericht),['AR-1-02']);assert.deepEqual(datei.ersetzt,[{bericht:'AR-1-01',durch:['AR-1-02']}]);
 assert.deepEqual(datei.offen,['P4']);assert.equal(datei.vollstaendig,false);
 assert.equal(datei.berichte[0].proben[0].reportId,datei.berichte[0].id);assert.equal(datei.berichte[0].proben[0].werte[0].loq,'0,5');
});
ok('Oberflächenart und Raum aus LabelKit stehen auch an den Berichtsproben (für PlanKit)',()=>{
 const u=E.uebersicht('99.9001',auftrag(),[{report:report('AR-7-01',[[1,pak('14')],[4,[{p:'Chlorid',r:'2',u:'µg/cm²'}]]]),geaendert:1}]);
 const d=E.ergebnisDatei(u,auftrag(),[],'1.5.0');const pr=Object.fromEntries(d.berichte[0].proben.map(p=>[p.label,p]));
 assert.equal(pr.P1.surface,'wall');assert.equal(pr.P1.raum,'EG Testraum 1');assert.equal(pr.P1.typ,'PAK');
 assert.equal(pr.P4.surface,'floor');assert.equal(pr.P4.typ,'Chlorid');
 assert.deepEqual(d.auftrag.proben.find(p=>p.label==='P4'),{label:'P4',typ:'Chlorid',ref:'Probe 4',desc:'EG Testraum 1, Aufsicht',surface:'floor',raum:'EG Testraum 1'});
});
ok('ohneLage: alte Datei ohne Oberflächenart, Auftrag mit – erneut übernehmen; neue Datei nicht',()=>{
 const u=E.uebersicht('99.9001',auftrag(),[{report:report('AR-7-01',[[1,pak('14')]]),geaendert:1}]);const neu=E.ergebnisDatei(u,auftrag(),[],'1.5.0');
 const alt={...neu,auftrag:{...neu.auftrag,proben:neu.auftrag.proben.map(({surface,raum,...p})=>p)}};
 assert.equal(E.ohneLage(alt,auftrag()),true);assert.equal(E.ohneLage(neu,auftrag()),false);assert.equal(E.ohneLage(null,auftrag()),false);
});
ok('nur vorläufig: Status vorläufig, mit Hinweis; zählt nicht als Ergebnis',()=>{
 const u=E.uebersicht('99.9001',auftrag(),[{report:report('AR-2-01',[[1,pak('12')]],{vorlaeufig:true}),geaendert:1}]);
 const p1=u.zeilen.find(z=>z.label==='P1');assert.equal(p1.status,'vorlaeufig');assert.match(p1.hinweise.join(' '),/endgültige Bericht fehlt/);
 assert.equal(u.zaehler.ergebnis,0);assert.equal(u.zaehler.vorlaeufig,1);
});
ok('endgültig nur für einen Teil der Werte: Probe bleibt vorläufig, Projekt nicht vollständig',()=>{
 // vorläufig: PAK und Chlorid; endgültig nur PAK → Chlorid gilt weiter vorläufig
 const vorl=report('AR-5-01',[[1,[...pak('12'),{p:'Chlorid',r:'3',u:'µg/cm²'}]],[2,pak('8')],[3,pak('1')],[4,[{p:'Chlorid',r:'2',u:'µg/cm²'}]]],{vorlaeufig:true});
 const endg=report('AR-5-02',[[1,pak('14')],[2,pak('9')],[3,pak('1')],[4,[{p:'Chlorid',r:'2',u:'µg/cm²'}]]]);
 const u=E.uebersicht('99.9001',auftrag(),[{report:vorl,geaendert:1},{report:endg,geaendert:2}]);
 const p1=u.zeilen.find(z=>z.label==='P1');
 assert.equal(p1.status,'vorlaeufig');assert.deepEqual(p1.werte.map(w=>[w.p,w.vorlaeufig]).sort(),[['Benzo[a]pyren',false],['Chlorid',true],[SUM,false]]);
 assert.match(p1.hinweise.join(' '),/^Nur vorläufige Werte für Chlorid – der endgültige Bericht fehlt dafür noch\.$/);
 assert.equal(u.zaehler.ergebnis,3);assert.equal(u.zaehler.vorlaeufig,1);assert.equal(E.vollstaendig(u),false);
 assert.equal(E.standText(u),'3 von 4 Proben mit Ergebnis · 1 nur vorläufig');
 assert.equal(E.ergebnisDatei(u,auftrag(),[],'1.3.1').vollstaendig,false,'an die Projektzentrale: nicht vollständig');
 assert.deepEqual(u.berichte.find(b=>b.bericht==='AR-5-01').ersetztDurch,undefined,'vorläufiger Bericht gilt noch für Chlorid');
});
ok('Chlorid beauftragt, nur PAK geliefert → Hinweis; nicht beauftragte Probe erkannt',()=>{
 const u=E.uebersicht('99.9001',auftrag(),[{report:report('AR-3-01',[[4,pak('3')],[9,pak('1')]]),geaendert:1}]);
 const p4=u.zeilen.find(z=>z.label==='P4'),p9=u.zeilen.find(z=>z.label==='P9');
 assert.match(p4.hinweise.join(' '),/Chlorid beauftragt/);assert.equal(p9.status,'nichtBeauftragt');assert.equal(u.zaehler.nichtBeauftragt,1);
});
ok('nur PDF: keine Werte, Hinweis auf XML; Probe bleibt offen',()=>{
 const u=E.uebersicht('99.9001',auftrag(),[{report:report('AR-4-01',[[1],[2]],{xml:false}),geaendert:1}]);
 assert.equal(u.zeilen.find(z=>z.label==='P1').status,'ohneWerte');assert.match(u.berichte[0].hinweise.join(' '),/Nur die PDF/);assert.equal(u.zaehler.offen,4);
});
ok('fremde Projektnummer in der Auftragsreferenz → Hinweis am Bericht',()=>{
 const u=E.uebersicht('99.9001',auftrag(),[{report:report('AR-5-01',[[1,pak('2')]],{ref:'99.9002 Anderswo'}),geaendert:1}]);
 assert.match(u.berichte[0].hinweise.join(' '),/nennt Projekt 99\.9002/);
});
ok('gleicher Bericht zweimal abgelegt → neuere Datei, Hinweis',()=>{
 const alt=report('AR-6-01',[[1,pak('5')]]),neu={...report('AR-6-01',[[1,pak('6')]]),quelle:'AR-6-01 (2).xml'};
 const u=E.uebersicht('99.9001',auftrag(),[{report:alt,geaendert:1},{report:neu,geaendert:5}]);
 assert.equal(u.berichte.length,1);assert.equal(u.zeilen.find(z=>z.label==='P1').werte[0].r,'6');assert.match(u.hinweise.join(' '),/mehrfach/);
});
ok('gleicher Bericht als XML und neuere PDF mit anderem Dateinamen → Werte der XML gelten, PDF bleibt genannt',()=>{
 const xml={...report('AR-6-02',[[1,pak('7')]]),quelle:'export_123.xml',sources:{xml:'export_123.xml'}};
 const pdf={...report('AR-6-02',[[1]],{xml:false}),quelle:'AR-6-02.pdf'};
 for(const reihe of [[{report:xml,geaendert:1},{report:pdf,geaendert:5}],[{report:pdf,geaendert:5},{report:xml,geaendert:1}]]){
  const u=E.uebersicht('99.9001',auftrag(),reihe);
  assert.equal(u.berichte.length,1);const b=u.berichte[0],p1=u.zeilen.find(z=>z.label==='P1');
  assert.equal(p1.status,'ergebnis');assert.equal(p1.werte[0].r,'7');assert.equal(b.ohneWerte,false);
  assert.doesNotMatch(b.hinweise.join(' '),/Nur die PDF/);assert.deepEqual(b.sources,{xml:'export_123.xml',pdf:'AR-6-02.pdf'});
  assert.match(u.hinweise.join(' '),/mehrfach.*Es zählt die Datei mit Messwerten/);}
 // vorläufige XML: die PDF (dort ohne Vorläufig-Kennung) gehört trotzdem zum selben Bericht
 {const vx={...report('AR-6-04',[[1,pak('5')]],{vorlaeufig:true}),quelle:'export_9.xml',sources:{xml:'export_9.xml'}},vp={...report('AR-6-04',[[1]],{xml:false}),quelle:'AR-6-04.pdf'};
  const u=E.uebersicht('99.9001',auftrag(),[{report:vx,geaendert:1},{report:vp,geaendert:5}]);
  assert.deepEqual(u.berichte[0].sources,{xml:'export_9.xml',pdf:'AR-6-04.pdf'});assert.equal(u.berichte[0].vorlaeufig,true);}
 // gleiche Nummer, beide mit Werten: endgültig vor vorläufig, auch wenn der vorläufige neuer abgelegt ist
 const vorl={...report('AR-6-03',[[1,pak('3')]],{vorlaeufig:true}),quelle:'AR-6-03 vorl.xml'},endg=report('AR-6-03',[[1,pak('4')]]);
 const u=E.uebersicht('99.9001',auftrag(),[{report:endg,geaendert:1},{report:vorl,geaendert:9}]);
 assert.equal(u.zeilen.find(z=>z.label==='P1').werte[0].r,'4');assert.equal(u.berichte[0].vorlaeufig,undefined);
});
ok('ohne Laborauftrag: Werte sichtbar, Vollständigkeit nicht prüfbar',()=>{
 const u=E.uebersicht('99.9001',null,[{report:report('AR-7-01',[[1,pak('2')]]),geaendert:1}]);
 assert.equal(u.zaehler.erwartet,null);assert.equal(u.zeilen[0].status,'ergebnis');assert.match(u.hinweise.join(' '),/Kein Laborauftrag/);assert.equal(E.vollstaendig(u),false);
});
ok('vollständig: alle beauftragten Proben mit endgültigen Werten',()=>{
 const u=E.uebersicht('99.9001',auftrag(),[{report:report('AR-8-01',[[1,pak('1')],[2,pak('1')],[3,pak('1')],[4,[{p:'Chlorid',r:'26',u:'µg/cm²'}]]]),geaendert:1}]);
 assert.equal(E.vollstaendig(u),true);assert.equal(E.standText(u),'4 von 4 Proben mit Ergebnis');
});
ok('_Ergebnisse.json: Rundweg und Ablehnung fremder/neuerer Formate',()=>{
 const u=E.uebersicht('99.9001',auftrag(),[{report:report('AR-9-01',[[1,pak('1')]]),geaendert:1}]);
 const text=JSON.stringify(E.ergebnisDatei(u,auftrag(),[],'1.0.0'));
 assert.equal(E.liesErgebnisDatei(text).projekt,'99.9001');
 assert.throws(()=>E.liesErgebnisDatei('{"format":"x"}'),/nicht aus ResultKit/);
 assert.throws(()=>E.liesErgebnisDatei(JSON.stringify({...JSON.parse(text),version:2})),/aktualisieren/);
 assert.equal(E.standKennung([{name:'b.xml',size:1,t:2},{name:'a.pdf',size:3,t:4}]),'a.pdf|3|4\nb.xml|1|2');
});
// XML↔PDF-Abgleich der Hauptwerte (ab 1.6): PDF-Ergebnistabelle lesen, mit der XML vergleichen, Hinweis an der Probe.
const L=await import('../src/labreport.ts');const {labPages}=await import('./lab-fixtures.mjs');
const pdfMit=werte=>L.parseLabPDF(labPages({werte}),'AR.pdf');
const xmlMit=zeilen=>({...L.blankReport('AR.xml'),bericht:'AR-999-2099-000001-01',rows:zeilen.map(([nr,werte])=>({label:`P${nr}`,ref:`Probe ${nr}`,desc:'',werte}))});
ok('PDF: Hauptwerte je Probe aus der Ergebnistabelle (über mehrere Seiten, Spalten nach Lage)',()=>{
 const pdf=pdfMit([{zeile:'Summe 16 EPA-PAK exkl. BG  µg/m²',r:['14','8,5','< 0,5','','','','','','3']},{zeile:'Benzo[a]pyren  µg/m²',r:['1','1','1']}]);
 assert.deepEqual(pdf.pdfWerte['probe1'],[{zeile:'Summe 16 EPA-PAK exkl. BG µg/m²',r:'14'}]);assert.deepEqual(pdf.pdfWerte['probe3'],[{zeile:'Summe 16 EPA-PAK exkl. BG µg/m²',r:'< 0,5'}]);
 assert.deepEqual(pdf.pdfWerte['probe9'],[{zeile:'Summe 16 EPA-PAK exkl. BG µg/m²',r:'3'}],'zweite Ergebnisseite');assert.equal(pdf.pdfWerte['probe4'],undefined,'leere Zelle');
 assert.equal(Object.values(pdf.pdfWerte).flat().some(w=>/pyren/i.test(w.zeile)),false,'nur Hauptwerte');
});
ok('Abgleich: gleiche Werte ✓ (Schreibweise egal), Abweichung wird benannt',()=>{
 const xml=xmlMit([[1,[{p:SUM,r:'14,0',u:U}]],[2,[{p:SUM,r:'8,5',u:U}]],[3,[{p:SUM,r:'<0,5',u:U}]]]);
 let a=L.compareValues(xml,pdfMit([{zeile:`${SUM}  ${U}`,r:['14','8,5','< 0,5']}]));assert.equal(a.erkannt,true);assert.equal(a.geprueft,3);assert.deepEqual(a.abweichend,{});
 a=L.compareValues(xml,pdfMit([{zeile:`${SUM}  ${U}`,r:['41','8,5','< 0,5']}]));assert.equal(a.geprueft,3);assert.deepEqual(a.abweichend,{probe1:[{p:SUM,u:U,text:`${SUM} (${U}): XML „14,0“, PDF „41“`}]});
 a=L.compareValues(xml,pdfMit([{zeile:`${SUM}  ${U}`,r:['14','8,5','0,5']}]));assert.deepEqual(Object.keys(a.abweichend),['probe3'],'„<“ zählt');
});
ok('Abgleich: Chlorid je Probe und je Fläche über die Einheit getrennt; Asbest-Text; ohne Werte im PDF „nicht erkannt“',()=>{
 const xml=xmlMit([[4,[{p:'Chlorid',r:'1040',u:'µg/Probe'},{p:'Chlorid',r:'2,6',u:'µg/cm²'}]],[5,[{p:'Asbestart',r:'Chrysotil',u:''}]]]);
 const a=L.compareValues(xml,pdfMit([{zeile:'Chlorid  µg/Probe',r:['','','','1040']},{zeile:'Chlorid  µg/cm²',r:['','','','26']},{zeile:'Asbestart',r:['','','','','chrysotil']}]));
 assert.equal(a.geprueft,3);assert.deepEqual(a.abweichend,{probe4:[{p:'Chlorid',u:'µg/cm²',text:'Chlorid (µg/cm²): XML „2,6“, PDF „26“'}]});
 const leer=L.compareValues(xml,pdfMit([]));assert.equal(leer.erkannt,false);assert.equal(leer.geprueft,0);
});
ok('Übersicht: Abweichung als Hinweis an der Probe und am Bericht; ersetzter Bericht meldet nichts',()=>{
 const r=report('AR-1-02',[[1,pak('14')],[2,pak('8,5')]]);r.wertAbgleich={erkannt:true,geprueft:2,abweichend:{probe1:[{p:SUM,u:U,text:`${SUM} (${U}): XML „14“, PDF „41“`}]}};r.warnings.push(L.abgleichHinweis(['Probe 1'],1));
 const u=E.uebersicht('99.9001',auftrag(),[{report:r,geaendert:1}]);
 assert.deepEqual(u.berichte[0].wertAbgleich,{erkannt:true,geprueft:2,abweichend:1});assert.equal(u.berichte[0].hinweise.filter(h=>h.startsWith(L.ABGLEICH)).length,1,'Hinweis am Bericht genau einmal');
 assert.match(u.zeilen.find(z=>z.label==='P1').hinweise.join(' '),/PDF zeigt einen anderen Wert – Summe 16 EPA-PAK exkl\. BG \(µg\/m²\): XML „14“, PDF „41“ \(Bericht AR-1-02\)/);
 assert.equal(u.zeilen.find(z=>z.label==='P2').hinweise.some(h=>/PDF zeigt/.test(h)),false);
 const neu=report('AR-1-03',[[1,pak('14')],[2,pak('8,5')]]);const u2=E.uebersicht('99.9001',auftrag(),[{report:r,geaendert:1},{report:neu,geaendert:2}]);
 assert.equal(u2.zeilen.find(z=>z.label==='P1').hinweise.some(h=>/PDF zeigt/.test(h)),false,'Werte des ersetzten Berichts gelten nicht');
});
ok('Abgleich auch bei verschiedenen Dateinamen (XML und PDF derselben Berichtsnummer)',()=>{
 const xml={...xmlMit([[1,[{p:SUM,r:'14',u:U}]],[2,[{p:SUM,r:'8,5',u:U}]]]),auftragsreferenz:'99.9001 Musterort',sources:{xml:'Export.xml'},quelle:'Export.xml'};
 const pdf={...pdfMit([{zeile:`${SUM}  ${U}`,r:['41','8,5']}]),sources:{pdf:'Pruefbericht unterschrieben.pdf'},quelle:'Pruefbericht unterschrieben.pdf'};
 const u=E.uebersicht('99.9001',null,[{report:xml,geaendert:1},{report:pdf,geaendert:2}]);
 assert.equal(u.berichte.length,1);assert.deepEqual(u.berichte[0].sources,{xml:'Export.xml',pdf:'Pruefbericht unterschrieben.pdf'});
 assert.deepEqual(u.berichte[0].wertAbgleich,{erkannt:true,geprueft:2,abweichend:1});
 assert.match(u.zeilen.find(z=>z.label==='P1').hinweise.join(' '),/PDF zeigt einen anderen Wert.*XML „14“, PDF „41“/);
});
ok('Abgleich: einzeln ersetzter Wert meldet nichts mehr, der noch geltende schon',()=>{
 const chl={p:'Chlorid',r:'2,6',u:'µg/cm²'};
 const vorl=report('AR-1-01',[[1,[...pak('14'),chl]]],{vorlaeufig:true});
 vorl.wertAbgleich={erkannt:true,geprueft:2,abweichend:{probe1:[{p:SUM,u:U,text:`${SUM} (${U}): XML „14“, PDF „41“`},{p:'Chlorid',u:'µg/cm²',text:'Chlorid (µg/cm²): XML „2,6“, PDF „26“'}]}};vorl.warnings.push(L.abgleichHinweis(['Probe 1'],2));
 const end=report('AR-1-02',[[1,[{p:SUM,r:'15',u:U}]]]);
 const u=E.uebersicht('99.9001',null,[{report:vorl,geaendert:1},{report:end,geaendert:2}]);
 const h=u.zeilen.find(z=>z.label==='P1').hinweise.filter(x=>/PDF zeigt/.test(x));
 assert.equal(h.length,1);assert.match(h[0],/Chlorid/,'PAK ist ersetzt, Chlorid gilt noch');
 const b=u.berichte.find(x=>x.bericht==='AR-1-01');assert.equal(b.wertAbgleich.abweichend,1);assert.match(b.hinweise.find(x=>x.startsWith(L.ABGLEICH)),/1 Wert weicht ab/);
});
// Nachweisgrenze (ab 1.10): Eurofins nennt sie bei Asbest nur im Gruppen-/Test-/Methodennamen. Ergebniszeile als Mini-Element.
const zeileEl=felder=>({children:Object.entries(felder).map(([localName,textContent])=>({localName,textContent,children:[]}))});
ok('nachweisgrenze: aus Gruppe, sonst Test, sonst Methode; Schreibweise „0,001 %“',()=>{
 assert.equal(nachweisgrenze(zeileEl({GroupLevel1Name:'Asbestfasern [NWG 0,001%]',TestName:'Asbest [Einzelprobe, Nachweisgrenze 0,001 %]'})),'0,001 %');
 assert.equal(nachweisgrenze(zeileEl({GroupLevel1Name:'Asbestfasern [NWG 1%]'})),'1 %');
 assert.equal(nachweisgrenze(zeileEl({TestName:'Asbest [erweiterte Probenpräparation, NWG 0,1%]'})),'0,1 %');
 assert.equal(nachweisgrenze(zeileEl({Method:'Asbest [Einzelprobe, VDI 3866-5:2017-06 Anhang B, Nachweisgrenze 0,001 %]'})),'0,001 %');
 assert.equal(nachweisgrenze(zeileEl({GroupLevel1Name:'PAK',TestName:'PAK (16 EPA)'})),'','ohne Angabe nichts erfinden');
});
ok('ohneNwg: alte Datei ohne NWG, Berichte mit NWG – erneut übernehmen; neue Datei oder ohne Asbest nicht',()=>{
 const asb=nwg=>[{p:'Asbestgehalt',r:'-',u:'%',...(nwg?{nwg}:{})},{p:'Asbest',r:'Kein Asbest nachgewiesen',u:'',...(nwg?{nwg}:{})}];
 const u=E.uebersicht('99.9001',null,[{report:report('AR-5-01',[[6,asb('0,001 %')]]),geaendert:1}]);
 const alt=E.ergebnisDatei(E.uebersicht('99.9001',null,[{report:report('AR-5-01',[[6,asb()]]),geaendert:1}]),null,[],'1.9.0');
 const neu=E.ergebnisDatei(u,null,[],'1.10.0');
 assert.equal(neu.berichte[0].proben[0].werte[0].nwg,'0,001 %','NWG geht in _Ergebnisse.json');
 assert.equal(E.ohneNwg(alt,u),true);assert.equal(E.ohneNwg(neu,u),false);assert.equal(E.ohneNwg(null,u),false);
 const nurPak=E.uebersicht('99.9001',null,[{report:report('AR-6-01',[[1,pak('3')]]),geaendert:1}]);
 assert.equal(E.ohneNwg(E.ergebnisDatei(nurPak,null,[],'1.9.0'),nurPak),false);
 // Review PR #21: ein Asbestwert, für den der Bericht keine NWG nennt, darf den Hinweis nach frischer Übernahme nicht auslösen
 const gemischt=E.uebersicht('99.9001',null,[{report:report('AR-5-01',[[6,asb('0,001 %')],[7,asb()]]),geaendert:1}]);
 assert.equal(E.ohneNwg(E.ergebnisDatei(gemischt,null,[],'1.10.0'),gemischt),false,'frisch übernommen: kein Hinweis');
 const altGemischt=E.ergebnisDatei(E.uebersicht('99.9001',null,[{report:report('AR-5-01',[[6,asb()],[7,asb()]]),geaendert:1}]),null,[],'1.9.0');
 assert.equal(E.ohneNwg(altGemischt,gemischt),true,'alte Übernahme: Probe 6 hat jetzt eine NWG');
});

ok('Projektnummer mit Adresse im LabelKit-Feld: nur die Nummer zählt',()=>{
 const mit=nr=>labelkit.replace('"projekt":{"nr":"99.9001"}',`"projekt":{"nr":${JSON.stringify(nr)}}`);
 assert.notEqual(mit('x'),labelkit,'Testdaten enthalten das Projektfeld');
 assert.equal(labelkitReport(mit('99.9001 Stegerwaldstraße Leverkusen'),'a.json','99.9001 Musterort').rows.length>0,true);
 assert.equal(labelkitReport(mit('99.9001_Stegerwaldstraße_Leverkusen'),'a.json','99.9001 Musterort').rows.length>0,true);
 assert.throws(()=>labelkitReport(mit('99.9002 Stegerwaldstraße Leverkusen'),'a.json','99.9001 Musterort'),/Projektzuordnung blockiert/);
 assert.throws(()=>labelkitReport(mit('99.90010'),'a.json','99.9001 Musterort'),/Projektzuordnung blockiert/);
 assert.throws(()=>labelkitReport(mit('PAK'),'a.json','99.9001 Musterort'),/Projektzuordnung blockiert/,'ohne Nummer wie bisher');
});

// Storno (LabelKit 4.49.0): stornierte Proben behalten ihre Nummer, sind aber keine Proben mehr – wie gelöscht behandeln.
// P2 (PAK) und P4 (Chlorid) storniert, P3 nur mit `nrFest`. Echte Form `storniert: {am, kuerzel, grund}`; jeder wahre Wert zählt.
const STORNO={am:'2026-10-30T10:00:00.000Z',kuerzel:'Te',grund:'doppelt genommen'};
const mitStorno=(proben=[2],chlorid=true)=>{const d=JSON.parse(labelkit);d.nrSchutz=1;
 for(const p of d.proben){p.nrFest={am:'2026-10-29T08:00:00.000Z',anlass:'Etiketten'};if(proben.includes(p._nr))p.storniert=STORNO;}
 if(chlorid)d.chloridProben[0].storniert=true;return JSON.stringify(d);};
const auftragStorno=(...a)=>labelkitReport(mitStorno(...a),'99.9001_Daten.json','99.9001 Musterort');
ok('Storno: stornierte Proben fehlen im Laborauftrag, Nummern bleiben als storniert vermerkt',()=>{
 const a=auftragStorno();
 assert.deepEqual(a.rows.map(r=>r.label),['P1','P3']);assert.equal(a.expected,2);assert.deepEqual(a.storniert,['P2','P4']);
 assert.deepEqual(a.warnings,['1 Bohrkern-Rückstellprobe (nur gesägt und aufbewahrt, keine Analyse) nicht übernommen – dafür gibt es keinen Laborwert.'],'Storno selbst ist kein Hinweis');
 assert.equal(auftrag().storniert,undefined,'ohne Storno kein Feld');
 const alle=labelkitReport(mitStorno([1,2,3]),'a.json','99.9001 Musterort');
 assert.deepEqual(alle.rows,[]);assert.deepEqual(alle.warnings.at(-1),'Alle Proben der LabelKit-Datei sind storniert.');
 // gleiche Nummer aktiv und storniert (darf LabelKit nicht schreiben): die aktive Probe gilt
 const d=JSON.parse(labelkit);d.sonstigeProben.push({_nr:1,matrix:'Material',storniert:STORNO});
 const dop=labelkitReport(JSON.stringify(d),'a.json','99.9001 Musterort');assert.deepEqual(dop.rows.map(r=>r.label),['P1','P2','P3','P4']);assert.equal(dop.storniert,undefined);
});
ok('Storno: nicht offen, nicht ausstehend, nicht gezählt – Projekt ohne die stornierten Proben vollständig',()=>{
 const leer=E.uebersicht('99.9001',auftragStorno(),[]);
 assert.deepEqual(leer.zeilen.map(z=>[z.label,z.status]),[['P1','offen'],['P3','offen']]);
 assert.equal(leer.zaehler.offen,2);assert.equal(leer.zaehler.erwartet,2);assert.equal(E.standText(leer),'0 von 2 Proben mit Ergebnis · 2 offen');
 assert.deepEqual(leer.storniert,['P2','P4']);assert.deepEqual(leer.hinweise,[],'ohne Laborwert kein Hinweis');
 const leerDatei=E.ergebnisDatei(leer,auftragStorno(),[],'1.13.0');
 assert.deepEqual(leerDatei.offen,['P1','P3']);assert.deepEqual(leerDatei.auftrag.proben.map(p=>p.label),['P1','P3']);
 assert.deepEqual(UE.uebersichtGruppen(leer.zeilen).flatMap(g=>g.zeilen.filter(z=>z.ausstehend).map(z=>z.label)),['P1','P3'],'„ausstehend“ nur für nicht stornierte');
 const fertig=E.uebersicht('99.9001',auftragStorno(),[{report:report('AR-5-01',[[1,pak('3')],[3,pak('1')]]),geaendert:1}]);
 assert.equal(E.vollstaendig(fertig),true);assert.equal(E.standText(fertig),'2 von 2 Proben mit Ergebnis');
});
ok('Storno: Laborwert für eine stornierte Probe → eigener Hinweis, kein Ergebnis, nicht „nicht beauftragt“, nicht an PlanKit',()=>{
 const r=report('AR-5-02',[[1,pak('3')],[2,pak('42')],[3,pak('1')],[4,[{p:'Chlorid',r:'26',u:'µg/cm²'}]],[9,pak('1')]]);
 const u=E.uebersicht('99.9001',auftragStorno(),[{report:r,geaendert:1}]);
 assert.deepEqual(u.zeilen.map(z=>[z.label,z.status]),[['P1','ergebnis'],['P3','ergebnis'],['P9','nichtBeauftragt']]);
 assert.deepEqual(u.zaehler,{erwartet:2,ergebnis:2,vorlaeufig:0,offen:0,nichtBeauftragt:1},'P2/P4 weder Ergebnis noch offen noch nicht beauftragt');
 assert.deepEqual(u.hinweise,[
  'P2 ist in LabelKit storniert – der Laborwert gehört zu keiner offenen Probe (Prüfbericht AR-5-02). ResultKit übernimmt ihn nicht; gilt die Probe doch, heb das Storno in LabelKit auf.',
  'P4 ist in LabelKit storniert – der Laborwert gehört zu keiner offenen Probe (Prüfbericht AR-5-02). ResultKit übernimmt ihn nicht; gilt die Probe doch, heb das Storno in LabelKit auf.']);
 assert.equal(UE.uebersichtGruppen(u.zeilen).flatMap(g=>g.zeilen).some(z=>z.label==='P2'||z.label==='P4'),false,'nicht in der Ergebnistabelle');
 const datei=E.ergebnisDatei(u,auftragStorno(),[],'1.13.0');
 assert.deepEqual(datei.berichte[0].proben.map(p=>p.label),['P1','P3','P9'],'Wert der stornierten Probe geht nicht an PlanKit/FotoKit');
 assert.ok(datei.hinweise.some(h=>h.startsWith('P2 ist in LabelKit storniert')),'Hinweis geht mit nach _Ergebnisse.json');
 assert.deepEqual(datei.offen,[]);
 // Bericht ohne Messwerte (nur PDF) nennt die stornierte Probe: eigener Satz; ersetzter Bericht meldet nichts
 const nurPdf=E.uebersicht('99.9001',auftragStorno(),[{report:report('AR-5-03',[[2]],{xml:false}),geaendert:1}]);
 assert.deepEqual(nurPdf.hinweise,['P2 ist in LabelKit storniert, steht aber im Prüfbericht AR-5-03 (ohne Messwerte) – gehört zu keiner offenen Probe.']);
 const ersetzt=E.uebersicht('99.9001',auftragStorno(),[{report:report('AR-5-04',[[2,pak('40')]],{vorlaeufig:true}),geaendert:1},{report:report('AR-5-05',[[2,pak('42')],[1,pak('3')]]),geaendert:2}]);
 assert.deepEqual(ersetzt.hinweise.map(h=>h.match(/Prüfberichte? [^)]*/)[0]),['Prüfbericht AR-5-05']);
});
ok('Storno: Fingerabdruck – Storno setzen oder aufheben ändert die LabelKit-Datei, damit den Stand („geändert“)',()=>{
 // ResultKit vergleicht Name|Größe|Änderungszeit der LabelKit-Datei. LabelKit schreibt beim Storno (und beim Aufheben) die feste Datei neu.
 const vorher=labelkit,nachher=mitStorno([2],false),aufgehoben=JSON.stringify({...JSON.parse(nachher),proben:JSON.parse(nachher).proben.map(({storniert,...p})=>({...p,nrFest:{am:'2026-10-31T09:00:00.000Z',anlass:'Storno aufgehoben'}}))});
 const stand=(text,t)=>E.standKennung([{name:'Laboraufträge/99.9001_Daten.json',size:Buffer.byteLength(text),t},{name:'AR-1.xml',size:10,t:1}]);
 assert.notEqual(stand(vorher,100),stand(nachher,200));assert.notEqual(stand(nachher,200),stand(aufgehoben,300));
 assert.notEqual(Buffer.byteLength(vorher),Buffer.byteLength(nachher),'auch die Größe ändert sich');
 // gleicher Dateistand, aber vor 1.13 übernommen (P2 noch offen/mit Wert in der Datei) → einmal erneut übernehmen
 const r=report('AR-5-06',[[1,pak('3')],[2,pak('42')]]);
 const alt=E.ergebnisDatei(E.uebersicht('99.9001',auftrag(),[{report:r,geaendert:1}]),auftrag(),[],'1.12.1');
 const u=E.uebersicht('99.9001',auftragStorno([2],false),[{report:r,geaendert:1}]);
 assert.equal(E.mitStorniert(alt,u),true);
 assert.equal(E.mitStorniert(E.ergebnisDatei(u,auftragStorno([2],false),[],'1.13.0'),u),false,'neu übernommen: nichts mehr zu tun');
 assert.equal(E.mitStorniert(alt,E.uebersicht('99.9001',auftrag(),[{report:r,geaendert:1}])),false,'ohne Storno nie');
 assert.equal(E.mitStorniert(null,u),false);
});


ok('Prüfhinweise am Bericht: Probenzahl, doppelte Referenz und P-Nummer (auch beim Einlesen des Ordners)',()=>{
 const r=report('AR-9-01',[[1,pak('1')],[2,pak('2')]]);
 assert.deepEqual(pruefHinweise(r),[],'unauffälliger Bericht: nichts');
 assert.deepEqual(pruefHinweise({...r,expected:3}),['2 Proben erkannt/bearbeitet; laut Bericht 3.']);
 const gleichesLabel={...r,expected:3,rows:[...r.rows,{...r.rows[0],ref:'Probe 1b'}]};
 assert.deepEqual(pruefHinweise(gleichesLabel),['Doppelte P-Nummer: P1.']);
 const gleicheRef={...r,expected:3,rows:[...r.rows,{...r.rows[0],label:'P3'}]};
 assert.deepEqual(pruefHinweise(gleicheRef),['Doppelte Probenreferenz: Probe 1.']);
});

ok('Ordner: getrennt gelesene XML und PDF gleicher Berichtsnummer (andere Auftragsreferenz) bleiben zwei Berichte',()=>{
 const xml={...report('AR-5-01',[[1,pak('7')]]),sources:{xml:'AR-5.xml'},quelle:'AR-5.xml',getrennt:true};
 const pdf={...report('AR-5-01',[[1]],{ref:'99.9002 Anderswo',xml:false}),sources:{pdf:'AR-5.pdf'},quelle:'AR-5.pdf',getrennt:true};
 const u=E.uebersicht('99.9001',auftrag(),[{report:xml,geaendert:1},{report:pdf,geaendert:2}]);
 assert.equal(u.berichte.length,2,'nicht wieder zu einem Paar zusammengeführt');
 assert.deepEqual(u.berichte.map(b=>b.sources),[{xml:'AR-5.xml'},{pdf:'AR-5.pdf'}]);
 assert.ok(!u.hinweise.some(h=>/mehrfach im Ordner/.test(h)),'kein „liegt mehrfach“');
 assert.equal(u.berichte[1].auftragsreferenz,'99.9002 Anderswo','die PDF behält ihre eigenen Angaben');
 assert.ok(u.berichte[1].hinweise.some(h=>/nennt Projekt 99\.9002/.test(h)));
 assert.ok(!u.berichte[0].wertAbgleich,'kein XML↔PDF-Abgleich über fremde Dateien');
 assert.equal(u.zeilen.find(z=>z.label==='P1').werte[0].r,'7');
 // Ohne die Markierung bleibt es beim bisherigen Verhalten (XML und PDF desselben Berichts mit anderem Dateinamen = ein Bericht)
 const {getrennt:_a,...x2}=xml,{getrennt:_b,...p2}=pdf;
 assert.equal(E.uebersicht('99.9001',auftrag(),[{report:x2,geaendert:1},{report:p2,geaendert:2}]).berichte.length,1);
});
console.log(`${n} Prüfungen ResultKit-Kern bestanden`);
