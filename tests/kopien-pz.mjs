// Kopie gegen die Projektzentrale (Audit 2026-11 Lauf 5, E4 #12): ROLLE v1 – rolleAuto in src/druck.ts ist eine Kopie von
// Projektzentrale archiv/auswertung.js. Gleiche Eingaben → gleiche Rolle. Vorher prüfte das niemand.
// Dazu E4 #14 (Lauf 5, Nachtrag): SPEKTRON-ORDNERNAME v1 – leseProjektordner in src/ordner.ts ist eine Kopie aus der Projektzentrale
// (index.html, Block ab const PROJ_RE bis SPEKTRON-ORDNERNAME-ENDE). Gleicher Ordnername + gleiche Mitarbeiterliste → gleiche Nummer, Ort, Kürzel, Hinweis.
// Projektzentrale daneben (../projektzentrale oder PROJEKTZENTRALE_DIR); in der CI Pflicht (ROLLE_PFLICHT=1), sonst SKIP.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname,resolve,join} from 'node:path';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return {url:url.href+'.ts',shortCircuit:true};}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
const pz=resolve(process.env.PROJEKTZENTRALE_DIR||join(fileURLToPath(new URL('..',import.meta.url)),'..','projektzentrale')),datei=join(pz,'archiv','auswertung.js');
if(!existsSync(datei)){
 if(process.env.ROLLE_PFLICHT==='1'){console.error(`Projektzentrale fehlt: ${datei} (ROLLE_PFLICHT=1)`);process.exit(1);}
 console.log(`SKIP Kopie rolleAuto: ${datei} nicht gefunden`);process.exit(0);
}
const PZ=createRequire(import.meta.url)(datei);
const {rolleAuto}=await import('../src/druck.ts');
const refs=['P1','F-EG-WZ-B-7-T1','f_OG-K-2','F EG','REF-1','Ref','ref.','Prefix','EG-REF','Freimessung EG','P3','EG-WZ-B-7','','  ','Referenz','KREF'];
const descs=['EG Küche verrußt Wand','Freimessung nach Sanierung','Sanierungskontrolle OG','nach der Sanierung','Referenz aus unbelasteter Stelle','Nullprobe Garten','Hintergrundwert',
 'Fliesenkleber Bad','Teerpappe Dach','Bitumen Anstrich','Dachpappe alt','Schwarzanstrich Keller','EG Wohnen Brandraum Decke','Brandbereich Flur','Brandherd','Brandstelle Küche','Brandausbruch',
 'referenzprobe','Prefabrikat','Kleberrest im Brandraum','ÖG Bad','  ','','Freimessung Brandraum Referenz','Treppenhaus REF','Hintergrund, Kleber'];
let n=0;
for(const r of refs)for(const d of descs){assert.equal(rolleAuto(r,d),PZ.rolleAuto(r,d),`rolleAuto(${JSON.stringify(r)}, ${JSON.stringify(d)})`);n++;}
for(const x of [null,undefined])assert.equal(rolleAuto(x,x),PZ.rolleAuto(x,x));
console.log(`OK Kopie Projektzentrale: rolleAuto gleich (${n} Fälle, ${pz})`);

// E4 #14: SPEKTRON-ORDNERNAME v1 gegen die Projektzentrale (Verhalten; die Kopie hier ist TypeScript und gibt keinen Sortierschlüssel zurück)
{
 const html=readFileSync(join(pz,'index.html'),'utf8'),i=html.indexOf('const PROJ_RE'),j=html.indexOf('/* SPEKTRON-ORDNERNAME-ENDE */');
 assert.ok(i>0&&j>i&&html.indexOf('/* SPEKTRON-ORDNERNAME v1',i)<j,'Projektzentrale index.html: Block SPEKTRON-ORDNERNAME');
 const ctx={};vm.runInNewContext(html.slice(i,j)+'\nthis.lese=leseProjektordner;',ctx);
 const {leseProjektordner}=await import('../src/ordner.ts');
 const teil=r=>JSON.parse(JSON.stringify(r?{nr:r.nr,ort:r.ort,kuerzel:r.kuerzel,hinweis:r.hinweis}:null));
 const ON_PERSONEN=[
  [{ordnerKuerzel:'Abc',name:'Anna Beispiel'},{ordnerKuerzel:'Dr. Te',name:'Dr. Tea Test'},{ordnerKuerzel:'Xy',name:'Xaver Ypsilon',aktiv:false},{ordnerKuerzel:'Van der Ab'}],
  [{ordnerKuerzel:'ABC'}],[null,{ordnerKuerzel:'  Abc  '}],[{name:'ohne Kürzel'}],[],null];
 const ON_NAMEN=['26.0123 Musterstadt Abc','26.0123 Musterstadt abc','26.0123 Musterstadt ABC','26.0123 Musterstraße 5 Musterstadt Abc','26.0123_Musterstadt_Abc','26.0123-Musterstadt-Abc',
  '26.0123 Musterstadt Dr. Te','26.0123 Musterstadt Dr.Te','26.0123 Musterstadt dr te','26.0123 Musterstadt Dr Te','26.0123 Musterstadt Te','26.0123 Musterstadt Xy',
  '26.0123 Musterstadt Van der Ab','26.0123 Musterstadt van der ab','26.0123 Musterstadt der Ab','26.0123 Abc','26.0123 Dr. Te','26.0123','26.0123 ','  26.0123 Musterstadt Abc  ',
  '26.0123 Musterstadt','26.0123 Musterstadt Abcd','26.0123 Musterstadt Abc.','26.0123 Musterstadt .','26.0123 Musterstadt - Abc','26.0123 Musterstadt Abc -','26.0123 Musterstadt\tAbc',
  '26.0123 Münster Abc','26.0123 Münster Abc','26.12 Ort Abc','26.123456 Ort Abc','26.1234567 Ort Abc','2026.0123 Ort Abc','26.0123Ort Abc','26,0123 Ort Abc','6.0123 Ort',
  'Mosaik Archivordner','_Rückmeldungen','Fotos','2026 Altprojekte','',' ','26.0123 Ort Abc','26.0001 A','25.9999 B Abc'];
 let m=0;
 for(const liste of ON_PERSONEN)for(const name of ON_NAMEN){assert.deepEqual(teil(leseProjektordner(name,liste)),teil(ctx.lese(name,liste)),`leseProjektordner(${JSON.stringify(name)}, ${JSON.stringify(liste)})`);m++;}
 assert.ok(teil(ctx.lese('26.0123 Musterstadt Dr. Te',ON_PERSONEN[0])).kuerzel==='Dr. Te','Gegenprobe: die Fälle treffen auch Kürzel');
 console.log(`OK Kopie Projektzentrale: SPEKTRON-ORDNERNAME gleich (${m} Fälle)`);
}
