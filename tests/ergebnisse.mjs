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
let n=0;const ok=(name,fn)=>{fn();n++;console.log('OK Ergebnisse: '+name);};

const SUM='Summe 16 EPA-PAK exkl. BG',U='µg/m²';
// LabelKit: 3 PAK-Wischproben (1–3), 1 Chlorid (4), 1 Bohrkern-Rückstellprobe (5, ohne Analyse). Erfundene Orte.
const labelkit=JSON.stringify({version:'4.41.0',projekt:{nr:'99.9001'},
 proben:[1,2,3].map(i=>({_nr:i,matrix:'Wischprobe',datum:'08.10.2026',z2:`EG Testraum ${i}`,z3:'Wand',z4:'Ansicht',cm2:'400'})),
 chloridProben:[{chloridNr:4,matrix:'Wischprobe',datum:'08.10.2026',z2:'EG Testraum 1',z4:'Aufsicht'}],
 sonstigeProben:[{_nr:5,matrix:'Bohrkern',bkStatus:'R',bkId:'BK-1'}]});
const auftrag=()=>labelkitReport(labelkit,'99.9001_08.10.2026_Daten.json','99.9001 Musterort');
const report=(bericht,proben,{vorlaeufig=false,ref='99.9001 Musterort',xml=true}={})=>({bericht,labor:'Eurofins',auftragsreferenz:ref,quelle:`${bericht}.xml`,batch:'',sources:xml?{xml:`${bericht}.xml`,pdf:`${bericht}.pdf`}:{pdf:`${bericht}.pdf`},
 rows:proben.map(([nr,werte])=>({label:`P${nr}`,ref:`Probe ${nr}`,desc:`Testbereich ${nr}`,art:'Wischprobe',labNr:`999-${nr}`,datum:'2026-10-08',...(werte?{werte}:{})})),expected:proben.length,references:[],warnings:[],results:[],...(vorlaeufig?{vorlaeufig:true}:{})});
const pak=v=>[{p:SUM,r:v,u:U,loq:'0,5'},{p:'Benzo[a]pyren',r:'< 0,5',u:U,loq:'0,5'}];

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
 a=L.compareValues(xml,pdfMit([{zeile:`${SUM}  ${U}`,r:['41','8,5','< 0,5']}]));assert.equal(a.geprueft,3);assert.deepEqual(a.abweichend,{probe1:[`${SUM} (${U}): XML „14,0“, PDF „41“`]});
 a=L.compareValues(xml,pdfMit([{zeile:`${SUM}  ${U}`,r:['14','8,5','0,5']}]));assert.deepEqual(Object.keys(a.abweichend),['probe3'],'„<“ zählt');
});
ok('Abgleich: Chlorid je Probe und je Fläche über die Einheit getrennt; Asbest-Text; ohne Werte im PDF „nicht erkannt“',()=>{
 const xml=xmlMit([[4,[{p:'Chlorid',r:'1040',u:'µg/Probe'},{p:'Chlorid',r:'2,6',u:'µg/cm²'}]],[5,[{p:'Asbestart',r:'Chrysotil',u:''}]]]);
 const a=L.compareValues(xml,pdfMit([{zeile:'Chlorid  µg/Probe',r:['','','','1040']},{zeile:'Chlorid  µg/cm²',r:['','','','26']},{zeile:'Asbestart',r:['','','','','chrysotil']}]));
 assert.equal(a.geprueft,3);assert.deepEqual(a.abweichend,{probe4:['Chlorid (µg/cm²): XML „2,6“, PDF „26“']});
 const leer=L.compareValues(xml,pdfMit([]));assert.equal(leer.erkannt,false);assert.equal(leer.geprueft,0);
});
ok('Übersicht: Abweichung als Hinweis an der Probe und am Bericht; ersetzter Bericht meldet nichts',()=>{
 const r=report('AR-1-02',[[1,pak('14')],[2,pak('8,5')]]);r.wertAbgleich={erkannt:true,geprueft:2,abweichend:{probe1:[`${SUM} (${U}): XML „14“, PDF „41“`]}};
 const u=E.uebersicht('99.9001',auftrag(),[{report:r,geaendert:1}]);
 assert.deepEqual(u.berichte[0].wertAbgleich,{erkannt:true,geprueft:2,abweichend:1});
 assert.match(u.zeilen.find(z=>z.label==='P1').hinweise.join(' '),/PDF zeigt einen anderen Wert – Summe 16 EPA-PAK exkl\. BG \(µg\/m²\): XML „14“, PDF „41“ \(Bericht AR-1-02\)/);
 assert.equal(u.zeilen.find(z=>z.label==='P2').hinweise.some(h=>/PDF zeigt/.test(h)),false);
 const neu=report('AR-1-03',[[1,pak('14')],[2,pak('8,5')]]);const u2=E.uebersicht('99.9001',auftrag(),[{report:r,geaendert:1},{report:neu,geaendert:2}]);
 assert.equal(u2.zeilen.find(z=>z.label==='P1').hinweise.some(h=>/PDF zeigt/.test(h)),false,'Werte des ersetzten Berichts gelten nicht');
});
console.log(`${n} Prüfungen ResultKit-Kern bestanden`);
