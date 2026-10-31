// „Jetzt dran“: der eine nächste Schritt je Ordnerstand. Synthetische Daten.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname} from 'node:path';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return next(url.href+'.ts',context);}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
const {jetztDran}=await import('../src/jetzt.ts');
let n=0;const ok=(name,fn)=>{fn();n++;console.log('OK Jetzt dran: '+name);};
const basis={proben:4,berichte:1,gueltig:1,auftrag:true,stand:'S1',vorhanden:null,vorhandenFehler:'',hinweise:0,importiert:null};
const j=(x={})=>jetztDran({...basis,...x});
const knoepfe=r=>[r.haupt?.aktion,r.neben?.aktion];

ok('leerer Ordner → Berichte importieren, ohne Stand-Satz',()=>{
 const r=j({proben:0,berichte:0,gueltig:0,auftrag:false});
 assert.equal(r.art,'leer');assert.deepEqual(knoepfe(r),['import',undefined]);assert.equal(r.stand,false);
});
ok('Laborauftrag, noch kein Bericht → beim Labor, Hauptknopf Import',()=>{
 const r=j({berichte:0,gueltig:0});
 assert.equal(r.art,'warten');assert.equal(r.haupt.aktion,'import');assert.deepEqual(r.chips,[]);
});
ok('nur PDF ohne Messwerte → XML ergänzen',()=>{assert.equal(j({gueltig:0}).art,'ohneWerte');});
ok('Berichte da, nicht übernommen → Ergebnisse übernehmen, Import daneben; Hinweise als anklickbarer Chip',()=>{
 const r=j({hinweise:2});
 assert.equal(r.art,'uebernehmen');assert.deepEqual(knoepfe(r),['uebernehmen','import']);assert.equal(r.haupt.text,'Ergebnisse übernehmen');
 assert.deepEqual(r.chips.map(c=>c.text),['⚠ 2 Hinweise']);
 assert.equal(r.chips.at(-1).aktion,'hinweise');
});
ok('gerade importiert, keine Hinweise → „eingelesen – jetzt übernehmen?“ mit „Erst ansehen“',()=>{
 const r=j({importiert:['AR-1-02']});
 assert.equal(r.art,'importiert');assert.equal(r.titel,'AR-1-02 eingelesen');assert.match(r.text,/Keine Hinweise\. Jetzt übernehmen\?/);
 assert.deepEqual(knoepfe(r),['uebernehmen','ansehen']);
});
ok('gerade importiert, aber mit Hinweis → normal prüfen und übernehmen',()=>{
 const r=j({importiert:['AR-1-02'],hinweise:1});assert.equal(r.art,'uebernehmen');assert.equal(r.chips[0].text,'⚠ 1 Hinweis');
});
ok('übernommen und unverändert → grün, kein Hauptknopf; Zwischenstand sagt es',()=>{
 const r=j({vorhanden:{stand:'S1',uebernommen:'2026-10-27T14:05:00Z',vollstaendig:true}});
 assert.equal(r.art,'fertig');assert.equal(r.ok,true);assert.equal(r.haupt,undefined);assert.match(r.titel,/^Übernommen am 27\.10\.2026, \d\d:05 ✓$/);
 assert.match(r.text,/verwenden diesen Stand/);
 assert.match(j({vorhanden:{stand:'S1',uebernommen:'2026-10-27T14:05:00Z',vollstaendig:false}}).text,/^Zwischenstand/);
 assert.equal(j({importiert:['AR-1-02'],vorhanden:{stand:'S1',uebernommen:'2026-10-27T14:05:00Z',vollstaendig:true}}).art,'fertig','übernommen geht vor „importiert“');
});
ok('Ordner geändert nach Übernahme → Erneut übernehmen',()=>{
 const r=j({vorhanden:{stand:'S0',uebernommen:'2026-10-27T14:05:00Z',vollstaendig:true}});
 assert.equal(r.art,'geaendert');assert.equal(r.haupt.text,'Erneut übernehmen');
});
ok('_Ergebnisse.json nicht lesbar → Erneut übernehmen',()=>{
 const r=j({vorhandenFehler:'kaputt.'});assert.equal(r.art,'unlesbar');assert.equal(r.haupt.aktion,'uebernehmen');
});
ok('übernommen vor 1.5 (ohne Oberflächenart/Raum) → einmal erneut übernehmen',()=>{
 const r=j({vorhanden:{stand:'S1',uebernommen:'2026-10-27T14:05:00Z',vollstaendig:true,ohneLage:true}});
 assert.equal(r.art,'geaendert');assert.equal(r.haupt.aktion,'uebernehmen');assert.match(r.text,/Oberflächenart/);
});

ok('übernommen vor 1.10 (Asbest ohne Nachweisgrenze) → einmal erneut übernehmen',()=>{
 const r=j({vorhanden:{stand:'S1',uebernommen:'2026-10-29T14:05:00Z',vollstaendig:true,ohneNwg:true}});
 assert.equal(r.art,'geaendert');assert.equal(r.haupt.aktion,'uebernehmen');assert.match(r.text,/Nachweisgrenze/);assert.doesNotMatch(r.text,/Oberflächenart/);
});

ok('vor 1.13 übernommen, Datei führt eine stornierte Probe → einmal erneut übernehmen (Werte der übrigen Proben bleiben)',()=>{
 const r=j({vorhanden:{stand:'S1',uebernommen:'2026-10-30T14:05:00Z',vollstaendig:false,mitStorniert:true}});
 assert.equal(r.art,'geaendert');assert.equal(r.titel,'Bitte einmal erneut übernehmen');assert.equal(r.haupt.aktion,'uebernehmen');
 assert.match(r.text,/^Neu: in LabelKit stornierte Proben zählen nicht mehr als offen und gehen nicht an PlanKit und FotoKit\. Die Übernahme vom .* enthält das noch nicht – die Werte der übrigen Proben ändern sich dadurch nicht\.$/);
 assert.equal(j({vorhanden:{stand:'S1',uebernommen:'2026-10-30T14:05:00Z',vollstaendig:true,mitStorniert:false}}).art,'fertig');
 assert.equal(j({stand:'S2',vorhanden:{stand:'S1',uebernommen:'2026-10-30T14:05:00Z',vollstaendig:true,mitStorniert:true}}).titel,'Geändert seit der Übernahme – bitte erneut übernehmen','neuer Dateistand geht vor');
});

console.log(`${n} Prüfungen „Jetzt dran“ bestanden`);
