// Projektordner: ResultKit arbeitet im Projektordner (z. B. „26.0123 Köln“): liest „Laboraufträge“ (LabelKit) und
// „Laborergebnisse“ (Prüfberichte), legt importierte Berichte dort ab und schreibt dort „_Ergebnisse.json“.
// Gemeinsame Absprache mit Projektzentrale, FotoKit und PlanKit (dort identisch halten):
//  • IndexedDB „mosaik-suite“ v1, Store „kv“, Schlüssel „archiv“ → Handle des Ordners „Mosaik Archivordner“
//    (alle Apps unter kaspersebastian83-dot.github.io teilen diese Datenbank)
//  • Projektordner „<JJ>.<Nummer> <Schadenort> <Kürzel>“, Pläne im Unterordner „Pläne“, Laborberichte in „Laborergebnisse“
//  • _Projekt.json im Projektordner: gemeinsame Projektdaten – PlanKit liest sie nur.
type Mode={mode:'read'|'readwrite'};
type Handle=FileSystemHandle&{queryPermission?:(m:Mode)=>Promise<PermissionState>;requestPermission?:(m:Mode)=>Promise<PermissionState>};
export type Dir=FileSystemDirectoryHandle&{values():AsyncIterable<FileSystemHandle>;resolve(h:FileSystemHandle):Promise<string[]|null>};
export interface ProjectFolder {dir:Dir;name:string;nr:string;ort:string}
export interface FolderFile {name:string;handle:FileSystemFileHandle;lastModified:number}
export const LABOR='Laborergebnisse',AUFTRAEGE='Laboraufträge',PJ_FILE='_Projekt.json',PLAENE='Pläne';
export const supported=()=>'showDirectoryPicker' in window;

/* SPEKTRON-ORDNERNAME v1 – wie in Projektzentrale, FotoKit, LabelKit und BelegKit (dort identisch gehalten).
   Liest „JJ.Nummer Ort Kürzel“ von hinten: Am Ende wird ein Kürzel der Mitarbeiterliste gesucht (bis zu drei Wörter, längster
   Treffer zuerst; ohne Groß-/Kleinschreibung, Leerzeichen und Punkte). Alles davor ist der Ort. Ohne Liste wird nichts abgetrennt. */
export interface Person{ordnerKuerzel:string;appKuerzel?:string;name?:string;aktiv?:boolean}
const maNorm=(s:unknown)=>String(s??'').normalize('NFC').toLowerCase().replace(/[\s.]+/g,'');
let personen:Person[]|null=null;
export function setPersonen(p:Person[]|null){personen=p;}
export function leseProjektordner(name:string,liste:Person[]|null=personen){
 const m=/^(\d{2})\.(\d{2,6})(?:[\s_-]+(.*))?$/.exec(String(name).normalize('NFC').trim());if(!m)return null;
 const rest=(m[3]||'').trim(),r={nr:`${m[1]}.${m[2]}`,ort:rest,kuerzel:'',hinweis:''};
 if(!Array.isArray(liste)||!liste.length)return r;
 const woerter=[...rest.matchAll(/[^\s_]+/g)];
 for(let n=Math.min(3,woerter.length);n>=1;n--){
  const ende=maNorm(woerter.slice(-n).map(w=>w[0]).join(''));
  const p=liste.find(x=>x&&maNorm(x.ordnerKuerzel)===ende);
  if(!p)continue;
  r.kuerzel=String(p.ordnerKuerzel).trim();r.ort=rest.slice(0,woerter[woerter.length-n].index).replace(/[\s_-]+$/,'');
  if(!r.ort)r.hinweis='Im Ordnernamen fehlt der Ort.';
  return r;
 }
 r.hinweis=rest?'Kein bekanntes Kürzel am Ende des Ordnernamens.':'Im Ordnernamen fehlen Ort und Kürzel.';
 return r;
}
export function parseProjName(name:string){const r=leseProjektordner(name);return r?{nr:r.nr,ort:r.ort}:null;}
/** Mitarbeiterliste der Projektzentrale (<Archivordner>/_Spektron-Mitarbeiter.json) – PlanKit liest sie nur. */
export const MA_FILE='_Spektron-Mitarbeiter.json';
export async function personenLaden(){
 setPersonen(null);
 try{
  const root=await archiv() as (Dir&{queryPermission?:(m:Mode)=>Promise<PermissionState>})|null;
  if(!root||(root.queryPermission&&await root.queryPermission({mode:'read'})!=='granted'))return;
  const o=JSON.parse(await (await (await root.getFileHandle(MA_FILE)).getFile()).text());
  if(o&&o.format==='spektron-mitarbeiter'&&Array.isArray(o.personen))setPersonen(o.personen.filter((p:Person)=>p&&typeof p.ordnerKuerzel==='string'&&p.ordnerKuerzel.trim()));
 }catch{/* keine Liste: Ordnername wie bisher */}
}
export const safeName=(s:string)=>s.replace(/[<>:"/\\|?*]/g,'_').trim();

function suite(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('mosaik-suite',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function archiv():Promise<Dir|null>{try{const db=await suite();try{return await new Promise<Dir|null>((resolve,reject)=>{const r=db.transaction('kv').objectStore('kv').get('archiv');r.onsuccess=()=>resolve((r.result as Dir)||null);r.onerror=()=>reject(r.error);});}finally{db.close();}}catch{return null;}}
/** Schreibrecht prüfen; mit request=true fragt der Browser (nur nach einem Klick erlaubt). */
export async function permission(h:FileSystemHandle,request=false){const x=h as Handle,o:Mode={mode:'readwrite'};try{if(!x.queryPermission||await x.queryPermission(o)==='granted')return true;return request&&!!x.requestPermission&&await x.requestPermission(o)==='granted';}catch{return false;}}

export async function findSubdir(dir:Dir,name:string):Promise<Dir|null>{try{return await dir.getDirectoryHandle(name) as Dir;}catch{/* Schreibweise abweichend? */}const want=name.normalize('NFC').toLowerCase();for await(const h of dir.values())if(h.kind==='directory'&&h.name.normalize('NFC').toLowerCase()===want)return h as Dir;return null;}
export async function listFiles(dir:Dir,pattern:RegExp):Promise<FolderFile[]>{const out:FolderFile[]=[];for await(const h of dir.values())if(h.kind==='file'&&pattern.test(h.name)){const f=await (h as FileSystemFileHandle).getFile();out.push({name:h.name,handle:h as FileSystemFileHandle,lastModified:f.lastModified});}return out.sort((a,b)=>b.lastModified-a.lastModified);}
export async function fileInfo(dir:Dir,name:string){try{const h=await dir.getFileHandle(name);return await h.getFile();}catch(e){if((e as DOMException).name==='NotFoundError')return null;throw e;}}
export async function writeFile(dir:Dir,name:string,data:Blob|string){const h=await dir.getFileHandle(name,{create:true}),w=await h.createWritable();try{await w.write(data);await w.close();}catch(e){await w.abort().catch(()=>{});throw e;}return (await h.getFile()).lastModified;}
/** Read errors must propagate; an empty object is only valid JSON or a verified missing file. */
export async function readProjectData(f:{dir:Dir}):Promise<Record<string,unknown>>{
 const file=await fileInfo(f.dir,PJ_FILE);
 if(!file){for await(const h of f.dir.values())if(h.name===PJ_FILE)throw Error('Die vorhandene _Projekt.json ist nicht lesbar.');return {};}
 const data:unknown=JSON.parse(await file.text());
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Ungültige gemeinsame Projektdaten.');
 return data as Record<string,unknown>;
}

/** Projektordner öffnen (Name „JJ.Nummer Ort Kürzel“). */
export async function openFolder(dir:Dir):Promise<ProjectFolder>{
  await personenLaden();
  const p=parseProjName(dir.name);if(!p)throw Error(`„${dir.name}“ ist kein Projektordner (erwartet z. B. „26.0123 Köln“).`);
  return {dir,name:dir.name,nr:p.nr,ort:p.ort};
}
/** Aus einem gewählten Ordner (Projektordner oder einem seiner Unterordner) den Projektordner bestimmen. */
export async function projectDirOf(dir:Dir):Promise<Dir|null>{
  if(parseProjName(dir.name))return dir;
  const root=await archiv();if(!root||!await permission(root))return null;
  try{const path=await root.resolve(dir);if(path&&path.length===2&&parseProjName(path[0]))return await root.getDirectoryHandle(path[0]) as Dir;}catch{/* außerhalb des Archivs */}
  return null;
}
export async function pickFolder():Promise<Dir|null>{
  const root=await archiv();const picker=(window as unknown as {showDirectoryPicker:(o:unknown)=>Promise<Dir>}).showDirectoryPicker;
  try{return await picker({mode:'readwrite',id:'resultkit-projekt',...(root?{startIn:root}:{})});}catch(e){if((e as DOMException).name==='AbortError')return null;throw e;}
}
export async function fromArchiv(name:string):Promise<{root:Dir|null;dir?:Dir}>{const root=await archiv();if(!root)return {root:null};return {root,dir:await root.getDirectoryHandle(name) as Dir};}

/** Content identity detects deletion and replacements even with equal/older timestamps. */
export async function fileRevision(file:File|null):Promise<string|null>{
 if(!file)return null;
 const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
 return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
