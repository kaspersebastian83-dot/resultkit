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
ok('Sortierung nach Ort: Gebäude, Geschoss von unten nach oben, dann Raum; sonst nach Nummer',()=>{
 const zeilen=['P1 DG Bad Decke','P2 EG Küche Wand','P3 KG Heizung Decke','P4 1OG Flur Wand','P5 EG Flur Decke','P6 Haus B EG Lager Wand','P7 2.OG Bad Wand','P8 Garage Decke'].map(s=>{const [l,...r]=s.split(' ');return {label:l,nr:Number(l.slice(1)),stelle:r.join(' ')};});
 assert.deepEqual(U.sortiere(zeilen,'ort').map(z=>z.label),['P3','P5','P2','P4','P7','P1','P8','P6']);
 assert.deepEqual(U.sortiere(zeilen,'nr').map(z=>z.label),['P1','P2','P3','P4','P5','P6','P7','P8']);
});
console.log(`${n} Prüfungen Übersicht bestanden`);
