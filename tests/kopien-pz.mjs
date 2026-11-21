// Kopie gegen die Projektzentrale (Audit 2026-11 Lauf 5, E4 #12): ROLLE v1 – rolleAuto in src/druck.ts ist eine Kopie von
// Projektzentrale archiv/auswertung.js. Gleiche Eingaben → gleiche Rolle. Vorher prüfte das niemand.
// Projektzentrale daneben (../projektzentrale oder PROJEKTZENTRALE_DIR); in der CI Pflicht (ROLLE_PFLICHT=1), sonst SKIP.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname,resolve,join} from 'node:path';
import {createRequire} from 'node:module';
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
