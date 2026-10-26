import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function walk(dir) { return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(async e=>e.isDirectory()?walk(`${dir}/${e.name}`):`${dir}/${e.name}`))).flat(); }
const files=(await walk('dist')).filter(p=>!p.endsWith('/sw.js'));
const hash=createHash('sha256');hash.update(await readFile(new URL(import.meta.url))); for(const f of files)hash.update(await readFile(f));
const version=`resultkit-${hash.digest('hex').slice(0,12)}`;
await writeFile('dist/sw.js', `const PREFIX='resultkit:'+self.registration.scope+':';const CACHE=PREFIX+${JSON.stringify(version)};const FILES=${JSON.stringify(files.map(f=>'./'+f.slice(5)))}.map(f=>new URL(f,self.registration.scope).href);
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||!e.request.url.startsWith(self.registration.scope))return;e.respondWith(caches.open(CACHE).then(async c=>{if(e.request.mode==='navigate')return (await c.match(new URL('index.html',self.registration.scope).href,{ignoreVary:true}))||fetch(e.request);return (await c.match(e.request,{ignoreVary:true}))||fetch(e.request)}))});`);
