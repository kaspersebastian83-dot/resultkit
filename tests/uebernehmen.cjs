// Übernehmen und Berichtscache (Prüfbericht 29.10., F07/F08): ein verspätetes Einlesen von Projekt A gerät nicht in B,
// ein verzögertes Übernehmen überschreibt keinen inzwischen neueren Stand. Teile aus src/main.ts, Ordner im Speicher, synthetisch.
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.ts'), 'utf8');
const stueck = (von, bis) => { const a = src.indexOf(von), b = src.indexOf(bis, a + von.length); assert.ok(a >= 0 && b > a, 'Abschnitt ' + von); return stripTypeScriptTypes(src.slice(a, b), { mode: 'transform' }); };
const warte = () => { let auf; const p = new Promise(r => { auf = r; }); return { p, auf }; };

function ordner(dateien){
  const d = { kind: 'directory', dateien,
    async *values(){ for (const n of Object.keys(dateien)) yield d.datei(n); },
    datei: n => ({ name: n, kind: 'file', getFile: async () => Object.assign(new Blob([dateien[n]]), { name: n, lastModified: 1 }) }),
    async getFileHandle(n){ if (!(n in dateien)) throw Object.assign(Error('fehlt'), { name: 'NotFoundError' }); return d.datei(n); } };
  return d;
}

(async () => {
  // 1. A wird eingelesen und hängt im Parser; inzwischen B (gleicher Dateiname, Größe, Zeit) – B bekommt seinen eigenen Bericht
  {
    const angehalten = warte(), weiter = warte(); let aufrufe = 0;
    const c = { console, Map, WeakMap, LABOR: 'Laborergebnisse', DATEI: '_Ergebnisse.json', findSubdir: async (d, n) => d.unter[n] || null, ort: async () => ({ dir: null }),
      standKennung: x => JSON.stringify(x), uebersicht: () => ({}), meldung: e => e.message,
      readLabFiles: async files => { aufrufe++; const t = await files[0].text(); if (t === 'BERICHT A'){ angehalten.auf(); await weiter.p; } return { rows: [{ synthetisch: t }], bericht: 'Synthetisch', warnings: [] }; } };
    vm.createContext(c); vm.runInContext(stueck('const cache=', '/** Bewertungsregel') + '\nthis.einlesen = einlesen;', c);
    const a = { name: '99.9001 A', dir: { unter: { Laborergebnisse: ordner({ 'bericht.xml': 'BERICHT A' }) } } };
    const b = { name: '99.9002 B', dir: { unter: { Laborergebnisse: ordner({ 'bericht.xml': 'BERICHT B' }) } } };
    const spaet = c.einlesen(a); await angehalten.p;
    const rb = c.einlesen(b); weiter.auf(); await spaet;
    assert.equal((await rb).eingaenge[0].report.rows[0].synthetisch, 'BERICHT B', 'B liest seinen eigenen Bericht');
    assert.equal((await c.einlesen(b)).eingaenge[0].report.rows[0].synthetisch, 'BERICHT B', 'auch aus dem Cache');
    assert.equal(aufrufe, 2, 'je Projekt einmal gelesen, danach aus dem Cache');
  }
  // 2. Übernehmen wartet (Rückfrage offen) – inzwischen übernimmt ein anderer Rechner → nichts überschrieben, Fehlermeldung
  {
    const dateien = { '_Ergebnisse.json': '{"synthetisch":"ALT"}' }, ablage = Object.assign(ordner(dateien), {
      async getFileHandle(n, o){ if (!(n in dateien)){ if (!(o && o.create)) throw Object.assign(Error('fehlt'), { name: 'NotFoundError' }); dateien[n] = ''; } return { ...this.datei(n), createWritable: async () => { let t = ''; return { write: async v => { t = v; }, close: async () => { dateien[n] = t; }, abort: async () => {} }; } }; } });
    const angehalten = warte(), weiter = warte(), scan = { stand: 'S1', u: { berichte: [] }, auftrag: null, dateien: [] }, f = { name: '99.9001 A', dir: {} };
    let fehler = '';
    const c = { console, folder: f, scan, beschaeftigt: false, navigator: {}, permission: async () => true, render: () => {}, einlesen: async () => scan, vollstaendig: () => true,
      ort: async () => ({ dir: ablage }), ortZumSchreiben: async () => { angehalten.auf(); await weiter.p; return { dir: ablage }; },
      fileInfo: async (d, n) => { try{ return await (await d.getFileHandle(n)).getFile(); }catch(e){ if (e.name === 'NotFoundError') return null; throw e; } },
      writeFile: async (d, n, t) => { const w = await (await d.getFileHandle(n, { create: true })).createWritable(); await w.write(t); await w.close(); },
      ergebnisDatei: () => ({ synthetisch: 'MEIN ÄLTERES BILD' }), APP_VERSION: 'test', DATEI: '_Ergebnisse.json', VORHER: '_Ergebnisse.vorher.json', nachImport: null,
      standText: () => '', toast: () => {}, window: {}, fail: e => { fehler = e.message; }, neuEinlesen: async () => {} };
    vm.createContext(c); vm.runInContext(stueck('async function uebernehmen(){', '// ---- Prüfberichte importieren') + '\nthis.uebernehmen = uebernehmen;', c);
    const lauf = c.uebernehmen(); await angehalten.p;
    dateien['_Ergebnisse.json'] = '{"synthetisch":"NEU VON WOANDERS"}';
    weiter.auf(); await lauf;
    assert.match(fehler, /inzwischen an anderer Stelle übernommen/);
    assert.equal(dateien['_Ergebnisse.json'], '{"synthetisch":"NEU VON WOANDERS"}', 'neuerer Stand bleibt');
    assert.ok(!('_Ergebnisse.vorher.json' in dateien), 'keine Sicherung angelegt');
    // ohne Zwischenfunk: normaler Ablauf schreibt und sichert den vorigen Stand
    fehler = ''; c.ortZumSchreiben = async () => ({ dir: ablage }); await c.uebernehmen();
    assert.equal(fehler, ''); assert.match(dateien['_Ergebnisse.json'], /MEIN ÄLTERES BILD/); assert.match(dateien['_Ergebnisse.vorher.json'], /NEU VON WOANDERS/);
  }
  console.log('OK Übernehmen: Cache je Projekt, verzögertes Übernehmen überschreibt keinen neueren Stand');
})().catch(e => { console.error(e); process.exitCode = 1; });
