// Kopie gegen LabelKit (ab ResultKit 2.7.0, Plan resultkit-nachauftrag-plan.md R2): auftraegeAusLabelKit in src/labelkit.ts rechnet die
// Regel von LabelKit 5.5.0 nach (index.html, Block „NACHAUFTRAG (5.5.0)“: auftraegeAnwenden, auftraegePruefen, auftragMerkmalGilt,
// auftragVon, nrIstFest). Gleiche Projektdatei → gleiche Kennung je Probe, gleiche Aufträge, gleiches „neu aufgebaut“.
// Ändert LabelKit die Regel, wird dieser Test rot. Muster: tests/kopien-pz.mjs. Nur erfundene Proben.
// LabelKit daneben (../labelkit oder LABELKIT_DIR); in der CI Pflicht (LABELKIT_PFLICHT=1), sonst SKIP.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extname,resolve,join} from 'node:path';
import vm from 'node:vm';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL);if(!extname(url.pathname)&&existsSync(fileURLToPath(url)+'.ts'))return {url:url.href+'.ts',shortCircuit:true};}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(fileURLToPath(url),'utf8'),{mode:'transform'}),shortCircuit:true};return next(url,context);}
});
const lk=resolve(process.env.LABELKIT_DIR||join(fileURLToPath(new URL('..',import.meta.url)),'..','labelkit')),datei=join(lk,'index.html');
if(!existsSync(datei)){
 if(process.env.LABELKIT_PFLICHT==='1'){console.error(`LabelKit fehlt: ${datei} (LABELKIT_PFLICHT=1)`);process.exit(1);}
 console.log(`SKIP Kopie Laborauftrag: ${datei} nicht gefunden`);process.exit(0);
}
const html=readFileSync(datei,'utf8');
const zeile=start=>{const i=html.indexOf(start);assert.ok(i>=0,`LabelKit index.html: ${start}`);return html.slice(i,html.indexOf('\n',i));};
const block=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`LabelKit index.html: Block ${a}`);return html.slice(i,j);};
const code=zeile('function nrIstFest(p)')+'\n'+zeile('function nummerierteListen()')+'\n'+block('// ── NACHAUFTRAG (5.5.0)','// ── /NACHAUFTRAG');
const {auftraegeAusLabelKit}=await import('../src/labelkit.ts');

/** LabelKit mit der Projektdatei laden (auftraegeAnwenden wie in applyProjektData) und je Probe auftragVon fragen. */
function labelkit(data){
 const c={console,APP_VERSION:'5.5.0',document:{getElementById:()=>null},PROJEKTORDNER:{state:{pj:null},projektdaten:()=>({})},PROJEKT_URL:{projekt:null,mitteilung:null},
  proben:data.proben||[],chloridProben:data.chloridProben||[],asbestProben:data.asbestProben||[],sonstigeProben:data.sonstigeProben||[]};
 vm.createContext(c);vm.runInContext(code+'\n;globalThis.__get=n=>eval(n);',c);
 c.auftraegeAnwenden(data);
 const proben=['proben','chloridProben','asbestProben','sonstigeProben'].flatMap(k=>c[k]);
 return {kennung:proben.map(p=>c.auftragVon(p)),aufgebaut:c.__get('auftragAufgebaut')!=='',
  auftraege:JSON.parse(JSON.stringify(c.auftraegeBekannt())).map(a=>({id:a.id,am:/^\d{4}-\d{2}-\d{2}$/.test(String(a.am||'').slice(0,10))?String(a.am).slice(0,10):''}))};
}
function resultkit(data){
 const r=auftraegeAusLabelKit(data),proben=['proben','chloridProben','asbestProben','sonstigeProben'].flatMap(k=>Array.isArray(data[k])?data[k]:[]);
 return {kennung:proben.map(p=>r.von(p)),aufgebaut:r.aufgebaut,auftraege:r.auftraege.map(a=>({id:a.id,am:a.am}))};
}

// Erfundenes Projekt wie LabelKit 5.5.0 es schreibt: Runde 1 (14.08.) P1–P8 PAK, P9–P13 Chlorid → a1; Runde 2 (22.08.) P14–P17 PAK, P18–P21 Asbest → a2
const r=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const fest=tag=>({am:`${tag}T10:00:00.000Z`,anlass:'Abschluss'});
const probe=(n,a,x={})=>({id:n,_nr:n,matrix:'Wischprobe',datum:'2026-08-12',z2:`EG Raum ${n}`,z3:'verrußt',z4:'Untersicht',nrFest:fest(a==='a1'?'2026-08-14':'2026-08-22'),...(a?{auftrag:a}:{}),...x});
const gespeichert=()=>({version:'5.5.0',nrSchutz:1,projekt:{nr:'99.9001'},
 proben:[...r(1,8).map(n=>probe(n,'a1')),...r(14,17).map(n=>probe(n,'a2'))],chloridProben:r(9,13).map(n=>probe(n,'a1',{chloridNr:n})),
 asbestProben:r(18,21).map(n=>probe(n,'a2',{matrix:'Material (mineralisch)'})),sonstigeProben:[],
 weitereAuftraege:[{id:'a2',am:'2026-08-22',von:'Ka',proben:r(14,21)}],auftragZaehler:2,auftrag1:{am:'2026-08-14',quelle:'Laborübergabe vom 14.08.2026',proben:r(1,13)}});
const ohne=(d,...felder)=>{for(const f of felder)delete d[f];return d;};
const FAELLE=[
 ['wie gespeichert',gespeichert()],
 ['Liste und Zähler entfernt (5.4.0 hat gespeichert)',ohne(gespeichert(),'weitereAuftraege','auftragZaehler','auftrag1')],
 ['nur weitereAuftraege fehlt',ohne(gespeichert(),'weitereAuftraege')],
 ['nur auftrag1 fehlt',ohne(gespeichert(),'auftrag1')],
 ['nur der Zähler fehlt',ohne(gespeichert(),'auftragZaehler')],
 ['Kopie P22 mit Merkmal a2 ohne feste Nummer',(d=>{d.proben.push({...probe(22,'a2'),nrFest:undefined});return d;})(gespeichert())],
 ['P5 mit Merkmal a2, aber nicht in der Liste von Auftrag 2',(d=>{d.proben[4].auftrag='a2';return d;})(gespeichert())],
 ['P14 in der Liste, aber ohne feste Nummer',(d=>{delete d.proben[8].nrFest;return d;})(gespeichert())],
 ['Merkmal a7 ohne Liste mit fester Nummer (wird aufgebaut)',(d=>{d.proben.push(probe(22,'a7',{nrFest:fest('2026-09-01')}));return d;})(gespeichert())],
 ['Merkmal a7 ohne feste Nummer und ohne Liste',(d=>{d.proben.push({...probe(22,'a7'),nrFest:undefined});return d;})(gespeichert())],
 ['ein Auftrag (keine Merkmale)',ohne((d=>{for(const l of ['proben','chloridProben','asbestProben'])for(const p of d[l])delete p.auftrag;return d;})(gespeichert()),'weitereAuftraege','auftragZaehler','auftrag1')],
 ['stornierte Probe mit Merkmal (storniert macht die Nummer fest)',(d=>{d.proben.push({...probe(22,'a2'),nrFest:undefined,storniert:{am:'2026-08-23',kuerzel:'Ka',grund:'doppelt'}});d.weitereAuftraege[0].proben.push(22);return d;})(gespeichert())],
 ['neue Proben ohne Merkmal neben zwei Aufträgen',(d=>{d.proben.push({...probe(22,''),nrFest:undefined},probe(23,''));return d;})(gespeichert())],
 ['seltsame Merkmale (a0, b2, Zahl, leer, null)',(d=>{d.proben[0].auftrag='a0';d.proben[1].auftrag='b2';d.proben[2].auftrag=2;d.proben[3].auftrag='';d.proben[4].auftrag=null;return d;})(gespeichert())],
 ['Nummer als Text, nrFest ohne Datum',(d=>{d.proben[0]._nr='1';d.proben[14-6].nrFest={anlass:'Kopieren'};return d;})(gespeichert())],
 ['Liste mit Nummern als Text, kaputte Einträge',(d=>{d.auftrag1.proben=d.auftrag1.proben.map(String);d.weitereAuftraege.push(null,{id:'x9'},{id:'a3'});return d;})(gespeichert())],
 ['auftrag1 ohne Probenliste',(d=>{d.auftrag1={am:'2026-08-14'};return d;})(gespeichert())],
 ['Chlorid ohne _nr (nur chloridNr), Liste fehlt',(d=>{for(const p of d.chloridProben)delete p._nr;return ohne(d,'weitereAuftraege','auftragZaehler','auftrag1');})(gespeichert())],
 ['drei Aufträge, Auftrag 2 zurückgenommen (Kennung verbraucht)',(d=>{d.proben.push(...[22,23].map(n=>probe(n,'a3',{nrFest:fest('2026-09-03')})));d.weitereAuftraege=[{id:'a3',am:'2026-09-03',von:'Ka',proben:[22,23]}];d.auftragZaehler=3;
  for(const p of [...d.proben,...d.asbestProben])if(p.auftrag==='a2')delete p.auftrag;return d;})(gespeichert())],
];
let n=0;
for(const [name,data] of FAELLE){
 const a=labelkit(JSON.parse(JSON.stringify(data))),b=resultkit(JSON.parse(JSON.stringify(data)));
 assert.deepEqual(b.kennung,a.kennung,`${name}: Kennung je Probe`);
 assert.equal(b.aufgebaut,a.aufgebaut,`${name}: Liste neu aufgebaut`);
 assert.deepEqual(b.auftraege,a.auftraege,`${name}: Aufträge (Kennung, Tag)`);
 n++;
}
// Gegenprobe: die Fälle unterscheiden wirklich (sonst prüfte der Vergleich nichts)
const von=(fall,nr)=>{const d=FAELLE[fall][1],l=['proben','chloridProben','asbestProben','sonstigeProben'].flatMap(k=>d[k]||[]);return labelkit(d).kennung[l.findIndex(p=>p._nr===nr)];};
assert.equal(labelkit(FAELLE[0][1]).kennung.filter(Boolean).length,21);
assert.equal(von(5,22),null,'Kopie ohne feste Nummer ist neu');assert.equal(von(6,5),null,'nicht in der Liste ist neu');
assert.equal(von(8,22),'a7','a7 wird aufgebaut');assert.equal(von(7,14),null,'ohne feste Nummer ist neu');assert.equal(von(1,14),'a2','Liste fehlt: aufgebaut');
assert.equal(labelkit(FAELLE[1][1]).aufgebaut,true);assert.equal(labelkit(FAELLE[0][1]).aufgebaut,false);
console.log(`OK Kopie LabelKit: Laborauftrag je Probe gleich (${n} Fälle, ${lk})`);
