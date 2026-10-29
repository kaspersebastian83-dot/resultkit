/* SPEKTRON-SKALEN v1 – in FotoKit (index.html, zwischen SPEKTRON-SKALEN und SPEKTRON-SKALEN-ENDE) und PlanKit
   (src/skalen-archiv.js) wörtlich gleich halten.
   Eigene Bewertungsskalen gelten fürs ganze Büro: <Archivordner>/_Spektron-Skalen.json ist maßgeblich; der
   Browser-Speicher „bu-scales“ ist nur die Arbeitskopie, die FotoKit und PlanKit wie bisher lesen.
   • Öffnen (skalenAbgleich): Datei → Arbeitskopie. Eigene, noch nicht geteilte Änderungen bleiben erhalten.
   • Ändern/Löschen (skalaTeilen): Arbeitskopie sofort, Datei kurz danach (frisch gelesen, nur diese Skala geändert).
   • Erster Abgleich eines Browsers: eigene Skalen, die in der Datei fehlen, werden übernommen; danach gilt die Datei,
     auch für Löschungen anderer.
   Ohne Archivordner, ohne Recht oder bei Lesefehler bleibt alles lokal wie bisher – nichts geht verloren, nichts blockiert.
   Die VdS-2357-Referenz ist eingebaut und steht nicht in dieser Datei. */
export const SKALEN_DATEI = '_Spektron-Skalen.json';
const SKALEN_LOKAL = 'bu-scales', SKALEN_OFFEN = 'bu-scales-offen', SKALEN_MERKER = 'bu-scales-geteilt';
const skLesen = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : d; }catch(e){ return d; } };
const skSchreiben = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const skalaGueltig = s => !!s && typeof s === 'object' && typeof s.name === 'string' && Array.isArray(s.cats);
/** Archivordner aus dem gemeinsamen Browser-Speicher (wie Projektzentrale); null ohne Recht. Schreibrecht wird nur auf Wunsch erfragt (nach einem Klick). */
async function skalenArchiv(modus, fragen){
  try{
    const db = await new Promise((res, rej) => { const r = indexedDB.open('mosaik-suite', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const a = await new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get('archiv'); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); });
    db.close();
    if (!a || typeof a.getFileHandle !== 'function') return null;
    let p = await a.queryPermission({ mode: modus });
    if (p === 'prompt' && fragen) p = await a.requestPermission({ mode: modus });
    return p === 'granted' ? a : null;
  }catch(e){ return null; }
}
async function skalenDatei(a){
  let f;
  try{ f = await (await a.getFileHandle(SKALEN_DATEI)).getFile(); }catch(e){ if (e && e.name === 'NotFoundError') return { skalen: null, roh: null }; throw e; }
  const text=await f.text(),o = JSON.parse(text);
  if (!o || o.format !== 'spektron-skalen' || !o.skalen || typeof o.skalen !== 'object' || Array.isArray(o.skalen)) throw Error(SKALEN_DATEI + ': unbekanntes Format');
  const skalen = {};
  for (const [k, v] of Object.entries(o.skalen)) if (skalaGueltig(v)) skalen[k] = v;
  return { skalen, roh: o, text };
}
/** Stand der Datei plus eigene, noch nicht geteilte Änderungen (und beim ersten Mal: eigene Skalen, die dort fehlen). */
function skalenZusammen(datei, lokal, offen, erst){
  const s = Object.assign({}, datei || {}), o = Object.assign({}, offen);
  if (erst) for (const k of Object.keys(lokal)) if (!(k in s)) o[k] = 1;
  for (const [k, v] of Object.entries(o)){ if (v && skalaGueltig(lokal[k])) s[k] = lokal[k]; else if (!v) delete s[k]; }
  return { skalen: s, offen: o };
}
let skalenTimer = null, skalenWartend = [], skalenLaeuft = Promise.resolve();
/** Nach dem Schreiben: Dateistand in die Arbeitskopie. Was während des Schreibens geändert wurde, bleibt lokal und offen –
   erledigt sind nur hochgeladene Skalen, die seitdem unverändert sind. */
function skalenNachHochladen(skalen, hochgeladen, lokalVorher){
  const lokal = skLesen(SKALEN_LOKAL, {}), offen = skLesen(SKALEN_OFFEN, {}), rest = {};
  for (const [k, v] of Object.entries(offen)) if (!(k in hochgeladen) || hochgeladen[k] !== v || JSON.stringify(lokal[k]) !== JSON.stringify(lokalVorher[k])) rest[k] = v;
  skSchreiben(SKALEN_LOKAL, skalenZusammen(skalen, lokal, rest, false).skalen); skSchreiben(SKALEN_OFFEN, rest);
}
/** Datei schreiben, wenn Schreibrecht da ist (fragen = nach einem Klick nachfragen dürfen). true = geteilt. */
function skalenHochladen(fragen){
  skalenLaeuft = skalenLaeuft.catch(()=>false).then(() => {const run=async()=>{
    const a = await skalenArchiv('readwrite', fragen); if (!a) return false;
    try{
      const d = await skalenDatei(a), lokal = skLesen(SKALEN_LOKAL, {}), z = skalenZusammen(d.skalen, lokal, skLesen(SKALEN_OFFEN, {}), localStorage.getItem(SKALEN_MERKER) !== '1');
      if (!Object.keys(z.offen).length){ if (d.skalen) skSchreiben(SKALEN_LOKAL, z.skalen); return true; }
      const o = Object.assign({}, d.roh || {}, { format: 'spektron-skalen', version: 1, geaendert: new Date().toISOString(), skalen: z.skalen });
      const w = await (await a.getFileHandle(SKALEN_DATEI, { create: true })).createWritable();
      try{
        const latest=await(await(await a.getFileHandle(SKALEN_DATEI)).getFile()).text();
        if(latest!==(d.text??''))throw Error('Gemeinsame Skalen inzwischen geändert.');
        const text=JSON.stringify(o,null,2);await w.write(text);await w.close();
        if((await skalenDatei(a)).text!==text)throw Error('Gemeinsame Skalen konnten nicht bestätigt werden.');
      }catch(e){await w.abort().catch(()=>{});throw e;}
      skalenNachHochladen(z.skalen, z.offen, lokal); localStorage.setItem(SKALEN_MERKER, '1');
      return true;
    }catch(e){ return false; }
  };return globalThis.navigator?.locks?globalThis.navigator.locks.request("spektron:skalen",run):run();});
  return skalenLaeuft;
}
/** Beim Öffnen eines Projekts: gemeinsame Skalen holen. 'datei' = Stand des Archivordners, 'lokal' = ohne Archiv/Recht. */
export async function skalenAbgleich(){
  const a = await skalenArchiv('read', false); if (!a) return 'lokal';
  try{
    const d = await skalenDatei(a), lokal = skLesen(SKALEN_LOKAL, {}), z = skalenZusammen(d.skalen, lokal, skLesen(SKALEN_OFFEN, {}), localStorage.getItem(SKALEN_MERKER) !== '1');
    if (!d.skalen && !Object.keys(z.offen).length) return 'lokal';
    skSchreiben(SKALEN_LOKAL, z.skalen);
    if (Object.keys(z.offen).length){ skSchreiben(SKALEN_OFFEN, z.offen); if (!(await skalenHochladen(false)) && !d.skalen) return 'lokal'; }
    else if (d.skalen) localStorage.setItem(SKALEN_MERKER, '1');
    return 'datei';
  }catch(e){ return 'lokal'; }
}
/** Nach dem Ändern (skala) oder Löschen (null) einer Skala in der Arbeitskopie: fürs Büro merken und kurz danach in die Datei. */
export function skalaTeilen(key, skala){
  const o = skLesen(SKALEN_OFFEN, {}); o[key] = skala ? 1 : 0; skSchreiben(SKALEN_OFFEN, o);
  clearTimeout(skalenTimer);
  return new Promise(res => { skalenWartend.push(res); skalenTimer = setTimeout(() => { const w = skalenWartend; skalenWartend = []; skalenHochladen(true).then(ok => w.forEach(f => f(ok))); }, 700); });
}
/* SPEKTRON-SKALEN-ENDE */
