// Regression checks: real temporary folders, synthetic data only. Requires Node 24.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {stripTypeScriptTypes}=require('node:module');
const source=async(r,f)=>fs.readFile(path.join(__dirname,'..',f),'utf8');
const missing=()=>Object.assign(Error('synthetic missing file'),{name:'NotFoundError'});
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
class Dir{
 constructor(p,io={}){this.p=p;this.name=path.basename(p);this.kind='directory';this.io=io;}
 async queryPermission(){return 'granted';}
 async getDirectoryHandle(n,o={}){const p=path.join(this.p,n);try{if(!(await fs.stat(p)).isDirectory())throw Object.assign(Error('not directory'),{name:'TypeMismatchError'});}catch(e){if(e.code!=='ENOENT')throw e;if(!o.create)throw missing();await fs.mkdir(p,{recursive:true});}return new Dir(p,this.io);}
 async getFileHandle(n,o={}){
  const p=path.join(this.p,n),io=this.io;if(io.beforeGet)await io.beforeGet(p,o);
  try{if(!(await fs.stat(p)).isFile())throw Object.assign(Error('not file'),{name:'TypeMismatchError'});}catch(e){if(e.code!=='ENOENT')throw e;if(!o.create)throw missing();await fs.writeFile(p,'',{flag:'a'});}
  return{name:n,kind:'file',getFile:async()=>{if(io.beforeRead)await io.beforeRead(p);const b=await fs.readFile(p),s=await fs.stat(p);return new File([b],n,{lastModified:s.mtimeMs});},createWritable:async(o={})=>{
   if(io.beforeOpen)await io.beforeOpen(p);let buf=o.keepExistingData?await fs.readFile(p):Buffer.alloc(0);
   return{write:async v=>{if(io.beforeWrite)await io.beforeWrite(p,v);let val=v&&v.type==='write'?v.data:v;let b=val instanceof Blob?Buffer.from(await val.arrayBuffer()):Buffer.from(val);if(io.transform)b=await io.transform(p,b);if(v&&v.type==='write'){const out=Buffer.alloc(Math.max(buf.length,v.position+b.length));buf.copy(out);b.copy(out,v.position);buf=out;}else buf=b;},close:async()=>{if(io.beforeClose)await io.beforeClose(p);await fs.writeFile(p,buf);if(io.afterClose)await io.afterClose(p);},abort:async()=>{}};
  }};
 }
 async *values(){for(const e of await fs.readdir(this.p,{withFileTypes:true}))yield e.isDirectory()?new Dir(path.join(this.p,e.name),this.io):await this.getFileHandle(e.name);}
 async *entries(){for await(const h of this.values())yield[h.name,h];}
 async removeEntry(n){const p=path.join(this.p,n);if(this.io.beforeRemove)await this.io.beforeRemove(p);const s=await fs.stat(p);if(s.isDirectory())await fs.rmdir(p);else await fs.unlink(p);}
}
function context(extra={}){return vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,File,Blob,console,setTimeout,clearTimeout,Date,navigator:{},...extra});}
function part(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,`source anchors ${a} / ${b}`);return s.slice(i,j);}
async function fixture(fn){const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'spektron-audit-'));try{return await fn(tmp);}finally{await fs.rm(tmp,{recursive:true,force:true});}}
async function put(root,n,v){const p=path.join(root,n);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,typeof v==='string'?v:JSON.stringify(v));}
async function exists(p){return fs.access(p).then(()=>true,()=>false);}

(async()=>{
 await fixture(async tmp=>{

 const text=await source('','src/main.ts'),hit=defer(),go=defer();let calls=0;
 const code=stripTypeScriptTypes(part(text,'const cache=','/** Bewertungsregel'),{mode:'transform'});
 const pa=path.join(tmp,'99.9001 Synthetic A'),pb=path.join(tmp,'99.9002 Synthetic B');await put(pa,'Laborergebnisse/report.xml','AAAA');await put(pb,'Laborergebnisse/report.xml','BBBB');
 for(const p of [pa,pb])await fs.utimes(path.join(p,'Laborergebnisse/report.xml'),new Date('2026-10-01'),new Date('2026-10-01'));
 const c=context({findSubdir:async(d,n)=>d.getDirectoryHandle(n),LABOR:'Laborergebnisse',ort:async()=>({dir:null}),DATEI:'_Ergebnisse.json',standKennung:x=>JSON.stringify(x),uebersicht:()=>({}),meldung:e=>e.message,readLabFiles:async files=>{calls++;const value=await files[0].text();if(value==='AAAA'){hit.resolve();await go.promise;}return{rows:[{synthetic:value}],bericht:'Synthetic'};}});vm.runInContext(code,c);
 const fa={dir:new Dir(pa)},fb={dir:new Dir(pb)},old=c.einlesen(fa);await hit.promise;go.resolve();await old;const result=await c.einlesen(fb);assert.equal(result.eingaenge[0].report.rows[0].synthetic,'BBBB');assert.equal(calls,2);

 });console.log('OK safety: delayed project parser cannot contaminate another project');
 await fixture(async tmp=>{

 const p=path.join(tmp,'99.9001 Synthetic A');await put(p,'Laborergebnisse/_Ergebnisse.json','{"synthetic":"INITIAL"}');const f={dir:new Dir(p),name:path.basename(p),nr:'99.9001'},dir=await f.dir.getDirectoryHandle('Laborergebnisse'),text=await source('','src/main.ts'),hit=defer(),go=defer();
 const code=stripTypeScriptTypes(part(text,'async function uebernehmen(){','// ---- Prüfberichte importieren'),{mode:'transform'});
 const scan={stand:'synthetic',u:{synthetic:'STALE',berichte:[]},auftrag:null,dateien:[]};let failure='';
 const c=context({folder:f,scan,beschaeftigt:false,permission:async()=>true,render:()=>{},einlesen:async()=>scan,vollstaendig:()=>true,ort:async()=>({dir}),ortZumSchreiben:async()=>{hit.resolve();await go.promise;return{dir};},fileInfo:async(d,n)=>{try{return await(await d.getFileHandle(n)).getFile();}catch(e){if(e.name==='NotFoundError')return null;throw e;}},writeFile:async(d,n,s)=>{const w=await(await d.getFileHandle(n,{create:true})).createWritable();await w.write(s);await w.close();},ergebnisDatei:u=>u,APP_VERSION:'test',DATEI:'_Ergebnisse.json',VORHER:'_Ergebnisse.vorher.json',nachImport:null,standText:()=>'',toast:()=>{},window:{},fail:e=>{failure=e.message;},neuEinlesen:async()=>{}});vm.runInContext(code,c);
 const pending=c.uebernehmen();await hit.promise;await put(p,'Laborergebnisse/_Ergebnisse.json','{"synthetic":"NEW"}');go.resolve();await pending;assert.match(failure,/anderweitig übernommen/);assert.equal(await fs.readFile(path.join(dir.p,'_Ergebnisse.json'),'utf8'),'{"synthetic":"NEW"}');

 });console.log('OK safety: a delayed publication cannot replace a newer output');
 await fixture(async tmp=>{

 const text=await source('','src/skalen-archiv.js'),code='src/skalen-archiv.js'==='index.html'?part(text,'const SKALEN_DATEI =','/* SPEKTRON-SKALEN-ENDE */'):text.replace(/export (const|async function|function) /g,'$1 '),ls=new Map([['bu-scales',JSON.stringify({A:{name:'Synthetic A',cats:[]}})],['bu-scales-offen','{"A":1}'],['bu-scales-geteilt','1']]);
 await put(tmp,'_Spektron-Skalen.json',{format:'spektron-skalen',version:1,skalen:{}});const c=context({localStorage:{getItem:k=>ls.get(k)||null,setItem:(k,v)=>ls.set(k,v)}});vm.runInContext(code,c);let once=true;c.skalenArchiv=async()=>new Dir(tmp,{beforeOpen:async()=>{if(once){once=false;await put(tmp,'_Spektron-Skalen.json',{format:'spektron-skalen',version:1,skalen:{B:{name:'Synthetic B',cats:[]}}});}}});assert.equal(await c.skalenHochladen(false),false);assert.equal(JSON.parse(ls.get('bu-scales-offen')).A,1);assert.deepEqual(Object.keys(JSON.parse(await fs.readFile(path.join(tmp,'_Spektron-Skalen.json'))).skalen),['B']);

 });console.log('OK safety: an intervening scale upload is retained and reported as not shared');
})().catch(e=>{console.error(e);process.exitCode=1;});
