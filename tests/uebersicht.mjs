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
// Ergebnisübersicht: Gruppen je Probenart, Hauptwert, Asbest-Befund, Sortierung nach Ort. Synthetische Daten.
const U=await import('../src/uebersicht.ts');
let n=0;const ok=(name,fn)=>{fn();n++;console.log('OK Übersicht: '+name);};
const z=(label,desc,werte,{typ,status='ergebnis'}={})=>({label,nr:Number(label.slice(1)),ref:`Probe ${label.slice(1)}`,desc,...(typ?{typ}:{}),erwartet:true,status,werte:werte.map(([p,r,u])=>({p,r,u,bericht:'AR',vorlaeufig:status==='vorlaeufig'})),berichte:['AR'],hinweise:[]});
const SUM='Summe 16 EPA-PAK exkl. BG';
ok('Gruppen je Probenart; PAK nur Σ16, Chlorid-Wert, offene bleiben stehen',()=>{
 const g=U.uebersichtGruppen([z('P1','EG Küche Decke',[[SUM,'48','µg/m²'],['Benzo[a]pyren','1,2','µg/m²']],{typ:'PAK'}),z('P2','EG Flur Wand',[],{typ:'PAK',status:'offen'}),
  z('P3','EG Küche Aufsicht',[['Chlorid','26','µg/cm²']],{typ:'Chlorid'}),z('P4','KG Heizung Rohrisolierung',[['Asbest','Chrysotil nachgewiesen','']],{typ:'Asbest'}),z('P5','Bohrkern 1',[['MKW C10-C40','120','mg/kg TS']],{typ:'Sonstige'})]);
 assert.deepEqual(g.map(x=>x.gruppe),['PAK','Chlorid','Asbest','Weitere']);
 const pak=g[0];assert.equal(pak.einheit,'µg/m²');assert.equal(pak.mitErgebnis,1);assert.equal(pak.zeilen[0].haupt.r,'48');assert.deepEqual(pak.zeilen[0].weitere,[]);
 assert.equal(pak.zeilen[1].ausstehend,true);assert.equal(pak.zeilen[1].haupt,null);
 assert.equal(g[1].zeilen[0].haupt.r,'26');assert.equal(g[2].zeilen[0].befund.gefunden,true);assert.equal(g[3].zeilen[0].weitere[0].r,'120');
});
ok('ohne Laborauftrag: Probenart aus den Parametern',()=>{
 const g=U.uebersichtGruppen([z('P1','x',[[SUM,'3','µg/m²']]),z('P2','y',[['Chlorid','2','µg/cm²']]),z('P3','w',[['Asbest','nicht nachgewiesen','']])]);
 assert.deepEqual(g.map(x=>x.gruppe),['PAK','Chlorid','Asbest']);
});
ok('Asbest: nur eindeutig positiver Befund ist rot; Text bleibt wie im Bericht',()=>{
 for(const [r,gef] of [['nicht nachgewiesen',false],['nachgewiesen',true],['Chrysotil',true],['kein Asbest',false],['n. n.',false],['< 0,1 %',false],['negativ',false],['positiv',true]])
  assert.equal(U.asbestBefund([{p:'Asbest',r,u:''}]).gefunden,gef,r);
 const b=U.asbestBefund([{p:'Chrysotil',r:'nachgewiesen',u:''},{p:'Amphibol-Asbest',r:'nicht nachgewiesen',u:''}]);
 assert.equal(b.text,'Chrysotil: nachgewiesen · Amphibol-Asbest: nicht nachgewiesen');assert.equal(b.gefunden,true);
 assert.equal(U.asbestBefund([{p:'PAK',r:'1',u:''}]),null);
});
ok('PAK ohne Σ16: keine Einzelstoffe als Ersatz in der Σ16-Spalte',()=>{
 const g=U.uebersichtGruppen([z('P1','EG Küche',[['Benzo[a]pyren','1,2','µg/m²']],{typ:'PAK'})]);
 assert.equal(g[0].zeilen[0].haupt,null);assert.deepEqual(g[0].zeilen[0].weitere,[]);
});
ok('Geschoss mit Leerzeichen: „1. OG“ und „OG 2“',()=>{
 const zeilen=['P1 Haus A DG Bad','P2 Haus A 1. OG Flur','P3 Haus A EG Küche','P4 Haus A OG 2 Bad','P5 Haus A KG Lager'].map(s=>{const [l,...r]=s.split(' ');return {label:l,nr:Number(l.slice(1)),stelle:r.join(' ')};});
 assert.deepEqual(U.sortiere(zeilen,'ort').map(z=>z.label),['P5','P3','P2','P4','P1']);
});
ok('Chlorid in µg/cm²: ältere Berichte in mg/m² umgerechnet (1 µg/cm² = 10 mg/m²), Bericht der Werte bekannt',()=>{
 const g=U.uebersichtGruppen([z('P1','EG',[['Chlorid','45','mg/m²']],{typ:'Chlorid'}),z('P2','EG',[['Chlorid','< 0,5','mg/m²']],{typ:'Chlorid'}),z('P3','EG',[['Chlorid','7,2','µg/cm²']],{typ:'Chlorid'})]);
 const r=g[0].zeilen.map(x=>[x.haupt.r,x.haupt.u,x.original||'']);
 assert.deepEqual(r,[['4,5','µg/cm²','45 mg/m²'],['< 0,05','µg/cm²','< 0,5 mg/m²'],['7,2','µg/cm²','']]);
 assert.equal(g[0].einheit,'µg/cm²');assert.deepEqual(g[0].zeilen[0].berichte,['AR']);
 assert.deepEqual(g[0].zeilen[0].bewertet,{p:'Chlorid',r:'45',u:'mg/m²'},'bewertet wird wie im Bericht (angepasste Skala je Einheit)');
 assert.deepEqual(U.chloridInUgCm2({p:'Chlorid',r:'unter BG',u:'mg/m²',loq:'5'}),{p:'Chlorid',r:'unter BG',u:'µg/cm²',loq:'0,5'});
 assert.deepEqual(U.chloridInUgCm2({p:'Chlorid',r:'n. n.',u:'mg/m²'}),{p:'Chlorid',r:'n. n.',u:'µg/cm²'});
});
ok('Gleicher Parameter je Probe und je Fläche (Eurofins: Chlorid µg/Probe und µg/cm² berechnet): der Flächenwert gilt',()=>{
 for(const reihe of [[['Chlorid (Cl)','2800','µg/ Probe'],['Chlorid (Cl)','20','µg/cm²']],[['Chlorid (Cl)','20','µg/cm²'],['Chlorid (Cl)','2800','µg/ Probe']]]){
  const g=U.uebersichtGruppen([z('P6','EG',[['Größe der Probenfläche','140','cm²'],...reihe],{typ:'Chlorid'})]);
  assert.deepEqual([g[0].zeilen[0].haupt.r,g[0].zeilen[0].haupt.u],['20','µg/cm²']);}
 const pak=U.uebersichtGruppen([z('P1','EG',[['Summe 16 EPA-PAK exkl. BG','1700','ng/Probe'],['Summe 16 EPA-PAK exkl. BG','28','µg/m²']],{typ:'PAK'})]);
 assert.equal(pak[0].zeilen[0].haupt.u,'µg/m²');
 assert.equal(U.uebersichtGruppen([z('P2','EG',[['Chlorid','2800','µg/ Probe']],{typ:'Chlorid'})])[0].zeilen[0].haupt.u,'µg/ Probe','nur je Probe: wie im Bericht');
});
ok('Asbest: leere Zeilen wie „Asbestgehalt: -“ fallen weg',()=>{
 assert.deepEqual(U.asbestBefund([{p:'Asbestgehalt',r:'-',u:''},{p:'Asbest',r:'Kein Asbest nachgewiesen',u:''}]),{text:'Kein Asbest nachgewiesen',gefunden:false});
 assert.deepEqual(U.asbestBefund([{p:'Asbestgehalt',r:'-',u:''},{p:'Chrysotil',r:'nachgewiesen',u:''}]),{text:'Chrysotil: nachgewiesen',gefunden:true},'Mineral bleibt genannt');
});
ok('Asbest nach VDI 3866-5 (Eurofins): Asbestgehalt % und Asbestart je Nachweisgrenze, nicht untersuchte Stufen „-“',()=>{
 const roh=(g1,a1,g2,a2,g3,a3)=>[['Asbestgehalt',g1,'%'],['Asbestart',a1,''],['Asbestgehalt',g2,'%'],['Asbestart',a2,''],['Asbestgehalt',g3,'%'],['Asbestart',a3,'']];
 const stufen=(...x)=>roh(...x).map(([p,r,u])=>({p,r,u}));
 assert.deepEqual(U.asbestBefund(stufen('5 - 20','Chrysotil','-','-','-','-')),{text:'Chrysotil · 5 - 20 %',gefunden:true},'positiv bei NWG 1 %');
 assert.deepEqual(U.asbestBefund(stufen('-','-','-','Kein Asbest nachgewiesen','-','-')),{text:'Kein Asbest nachgewiesen',gefunden:false},'negativ bei NWG 0,1 %');
 assert.deepEqual(U.asbestBefund(stufen('-','-','-','-','-','Kein Asbest nachgewiesen')),{text:'Kein Asbest nachgewiesen',gefunden:false},'negativ bei NWG 0,001 %');
 assert.deepEqual(U.asbestBefund(stufen('-','-','-','-','>1','Chrysotil')),{text:'Chrysotil · >1 %',gefunden:true},'positiv bei NWG 0,001 %');
 assert.equal(U.asbestBefund([{p:'Asbestgehalt',r:'>1',u:'%'}]).gefunden,true,'Gehalt allein reicht');
 for(const r of ['< 0,1','n. n.','nicht nachweisbar'])assert.equal(U.asbestBefund([{p:'Asbestgehalt',r,u:'%'}]).gefunden,false,r);
 assert.deepEqual(U.asbestBefund(stufen('-','Kein Asbest nachgewiesen','-','Kein Asbest nachgewiesen','-','-')).text,'Kein Asbest nachgewiesen','gleicher Text nur einmal');
 const g=U.uebersichtGruppen([z('P11','Garage, Faserzementplatte Dach',roh('5 - 20','Chrysotil','-','-','-','-'),{typ:'Asbest'}),z('P12','Garage, Wandputz',roh('-','-','-','-','-','Kein Asbest nachgewiesen'),{typ:'Asbest'})]);
 assert.deepEqual(g[0].zeilen.map(x=>[x.befund.text,x.befund.gefunden]),[['Chrysotil · 5 - 20 %',true],['Kein Asbest nachgewiesen',false]]);
});
ok('Sortierung nach Ort: Gebäude, Geschoss von unten nach oben, dann Raum; sonst nach Nummer',()=>{
 const zeilen=['P1 DG Bad Decke','P2 EG Küche Wand','P3 KG Heizung Decke','P4 1OG Flur Wand','P5 EG Flur Decke','P6 Haus B EG Lager Wand','P7 2.OG Bad Wand','P8 Garage Decke'].map(s=>{const [l,...r]=s.split(' ');return {label:l,nr:Number(l.slice(1)),stelle:r.join(' ')};});
 assert.deepEqual(U.sortiere(zeilen,'ort').map(z=>z.label),['P3','P5','P2','P4','P7','P1','P8','P6']);
 assert.deepEqual(U.sortiere(zeilen,'nr').map(z=>z.label),['P1','P2','P3','P4','P5','P6','P7','P8']);
});
console.log(`${n} Prüfungen Übersicht bestanden`);
