// Alle Tests nacheinander; in GitHub Actions erscheint ein Fehler zusätzlich als Annotation direkt am Pull Request.
import {spawn} from 'node:child_process';
let fehler=0;
for(const datei of ['tests/ergebnisse.mjs','tests/uebersicht.mjs','tests/browser.mjs']){
 console.log(`\n=== ${datei} ===`);let ausgabe='';
 const code=await new Promise((resolve,reject)=>{const c=spawn(process.execPath,[datei],{stdio:['ignore','pipe','pipe']});for(const [s,d] of [[c.stdout,process.stdout],[c.stderr,process.stderr]])s.on('data',x=>{ausgabe+=x;d.write(x);});c.once('error',reject);c.once('exit',resolve);});
 if(code!==0){fehler++;if(process.env.GITHUB_ACTIONS){const rest=ausgabe.replace(/\u001b\[[0-9;]*m/g,'').split('\n').filter(l=>!/^OK /.test(l)).join('\n').trim().slice(-1500);console.log(`::error title=${datei}::${rest.replace(/%/g,'%25').replace(/\r/g,'').replace(/\n/g,'%0A')}`);}}
}
process.exitCode=fehler?1:0;
