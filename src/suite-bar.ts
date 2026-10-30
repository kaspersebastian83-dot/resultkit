// @ts-nocheck
/* ===== MOSAIK-LEISTE v1 – in allen Apps der Familie identisch halten (LabelKit, FotoKit, ResultKit, PlanKit, BerichtKit, BelegKit) =====
   Links steht der Name der App-Suite „Spektron“ (Arbeitsname war „Mosaik“; interne Kennungen bleiben).
   Schmale Leiste oben: Projekt (mit Wechsel zu den zuletzt benutzten), die sechs Arbeitsschritte mit Haken und nächstem Schritt,
   „Weiter“-Knopf. Ohne geöffnetes Projekt: „Mit <letztes Projekt> weitermachen“.
   Teilt sich mit den anderen Apps nur den Browser-Speicher: IndexedDB „mosaik-suite“ / „kv“, Schlüssel „archiv“ (Ordner-Handle)
   und „zuletzt“ (Liste der zuletzt geöffneten Projektnamen). Liest den Ordner nur, schreibt nie hinein und fragt nie selbst
   nach Ordnerrechten – ohne Recht (oder ohne Ordnerzugriff, z. B. Safari) fehlen nur die Haken. Aufruf: MosaikLeiste.start('label'|'fotos'|'ergebnis'|'plan'|'bericht'|'beleg'[, {kompakt: true}]),
   danach MosaikLeiste.aktualisieren() nach dem Öffnen oder Wechseln eines Projekts.
   Optional opt.projektName: Funktion, die die bestätigte Projektzuordnung statt der angeforderten URL liefert (FotoKit).
   Optional opt.version: Version der App (Text oder Funktion) für „💬 Rückmeldung“ rechts in der Leiste und im Projektmenü – öffnet
   ../rueckmeldung/ im eigenen Fenster mit Programm, Version und Projektnummer (nur die Nummer, kein Ort).
   Projektdaten: window.SpektronProjectData (LabelKit, PlanKit) liefert den aktuellen Stand samt „möglicherweise veraltet“; sonst _Projekt.json direkt. */
(function(){
  if (window.MosaikLeiste) return;
  var APPS = [
    ['label', 'LabelKit',  'labelkit',       '../labelkit/',       '#5469b8'],
    ['fotos', 'FotoKit',   'bildumbenenner', '../Bildumbenenner/', '#2f87a6'],
    ['ergebnis', 'ResultKit', 'resultkit',   '../resultkit/',      '#7a5ca8'],
    ['plan',  'PlanKit',   'plankit',        '../Probenplan/',     '#4179b2'],
    ['bericht', 'BerichtKit', 'berichtkit',  '../berichtkit/',     '#b0683c'],
    ['beleg', 'BelegKit',  'aufwandkit',     '../aufwandkit/',     '#2f7d6d']
  ];
  var ZENTRALE = '../Projektzentrale/', MAX = 6, RUECKMELDUNG = '../rueckmeldung/', RM_APP = { label: 'labelkit', fotos: 'fotokit', ergebnis: 'resultkit', plan: 'plankit', bericht: 'berichtkit', beleg: 'belegkit' };
  var ich = '', kompakt = false, projektName = null, version = null, name = '', stand = null, zuletzt = [], bar = null, pop = null, timer = 0, lauf = 0;
  var nfc = function(s){ try{ return String(s).normalize('NFC'); }catch(e){ return String(s); } };
  /* Kurzfassung von SPEKTRON-ORDNERNAME v1 (Projektzentrale): Kürzel am Ende des Ordnernamens anhand der Mitarbeiterliste */
  var maNorm = function(x){ return nfc(x == null ? '' : x).toLowerCase().replace(/[\s.]+/g, ''); };
  function ordnerName(n, personen){
    var m = /^(\d{2})\.(\d{2,6})(?:[\s_-]+(.*))?$/.exec(nfc(n).trim());
    if (!m) return null;
    var rest = (m[3] || '').trim(), r = { nr: m[1] + '.' + m[2], ort: rest, kuerzel: '' };
    if (!personen || !personen.length) return r;
    var w = [], re = /[^\s_]+/g, x;
    while ((x = re.exec(rest))) w.push(x);
    for (var k = Math.min(3, w.length); k >= 1; k--){
      var ende = maNorm(w.slice(-k).map(function(y){ return y[0]; }).join(''));
      var p = personen.find(function(q){ return q && maNorm(q.ordnerKuerzel) === ende; });
      if (p){ r.kuerzel = String(p.ordnerKuerzel).trim(); r.ort = rest.slice(0, w[w.length - k].index).replace(/[\s_-]+$/, ''); return r; }
    }
    return r;
  }
  /* Anzeige „Nr. Ort“ und zuständige Person (manuell aus _Projekt.json, sonst aus dem Ordnernamen) */
  async function personUndAnzeige(arch, s, zust){
    var personen = null;
    try{
      var mt = await arch.getFileHandle('_Spektron-Mitarbeiter.json').then(function(f){ return f.getFile(); }).then(function(f){ return f.text(); });
      var mj = JSON.parse(mt); if (mj && mj.format === 'spektron-mitarbeiter' && Array.isArray(mj.personen)) personen = mj.personen;
    }catch(e){}
    var o = ordnerName(name, personen);
    if (o) s.anzeige = o.nr + (o.ort ? ' ' + o.ort : '');
    var k = zust && typeof zust === 'object' && typeof zust.kuerzel === 'string' ? zust.kuerzel : (o ? o.kuerzel : '');
    if (k){ var pp = (personen || []).find(function(q){ return q && maNorm(q.ordnerKuerzel) === maNorm(k); }); s.person = pp && pp.name ? pp.name : k; }
  }
  var h = function(tag, attrs){
    var el = document.createElement(tag);
    for (var k in (attrs || {})){ if (k === 'text') el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]); }
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) el.appendChild(arguments[i]);
    if (tag === 'a' && attrs && typeof attrs.href === 'string' && attrs.href.includes('#projekt=')){
      el.addEventListener('click', function(ev){
        if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
        ev.preventDefault();
        projektNavigation(el.href, el.target);
      });
    }
    return el;
  };
  function projektNavigation(href, target){
    const ziel = new URL(href, location.href);
    const fenster = target ? window.open('', target) : window;
    if (!fenster) return;
    let bisher; try{ bisher = new URL(fenster.location.href); }catch(e){}
    // Gleicher Einstieg mit anderem Fragment wäre sonst nur ein Wechsel innerhalb des Dokuments.
    if (bisher && ziel.origin === bisher.origin && ziel.pathname === bisher.pathname && ziel.search === bisher.search){
      if (ziel.protocol === 'file:'){
        ziel.search = ziel.search.endsWith('&') ? ziel.search.slice(0, -1) : ziel.search + '&';
      } else {
        ziel.pathname = ziel.pathname.endsWith('/index.html') ? ziel.pathname.slice(0, -10) : ziel.pathname + (ziel.pathname.endsWith('/') ? 'index.html' : '/index.html');
      }
    }
    fenster.location.assign(ziel.href);
    if (target) fenster.focus();
  }
  function idb(){
    return new Promise(function(res){
      try{
        var r = indexedDB.open('mosaik-suite', 1);
        r.onupgradeneeded = function(){ r.result.createObjectStore('kv'); };
        r.onsuccess = function(){ res(r.result); }; r.onerror = function(){ res(null); };
      }catch(e){ res(null); }
    });
  }
  function kvGet(key){
    return idb().then(function(db){ return new Promise(function(res){
      if (!db) return res(null);
      try{ var g = db.transaction('kv').objectStore('kv').get(key); g.onsuccess = function(){ db.close(); res(g.result == null ? null : g.result); }; g.onerror = function(){ db.close(); res(null); }; }
      catch(e){ res(null); }
    }); });
  }
  function kvSet(key, val){
    return idb().then(function(db){ return new Promise(function(res){
      if (!db) return res(false);
      try{ var t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(val, key); t.oncomplete = function(){ db.close(); res(true); }; t.onerror = t.onabort = function(){ db.close(); res(false); }; }
      catch(e){ res(false); }
    }); });
  }
  function urlName(){ try{ return projektName ? projektName() || '' : new URLSearchParams(location.hash.slice(1)).get('projekt') ?? new URLSearchParams(location.search).get('projekt') ?? ''; }catch(e){ return ''; } }
  function href(app, projekt){ return (app[0] === ich ? '' : app[3]) + (projekt ? '#projekt=' + encodeURIComponent(projekt) : ''); }   // die eigene App relativ zur aktuellen Seite (auch ohne den Pfad /<App>/)

  /* Ordnerstand: nur Namen prüfen, Fotos nur über die eine Datei (der Ordner kann tausende Bilder enthalten) */
  function unterordner(proj, wunsch){
    var w = nfc(wunsch).toLowerCase();
    return (async function(){
      for await (var e of proj.values()) if (e.kind === 'directory' && nfc(e.name).toLowerCase() === w) return e;
      return null;
    })();
  }
  async function ordnerStand(){
    var arch = await kvGet('archiv');
    if (!arch || !arch.queryPermission) return null;
    if ((await arch.queryPermission({ mode: 'read' })) !== 'granted') return null;
    var proj = null;
    try{ proj = await arch.getDirectoryHandle(name); }catch(e){}
    if (!proj){
      try{ for await (var e of arch.values()) if (e.kind === 'directory' && nfc(e.name) === nfc(name)){ proj = e; break; } }catch(e2){}
    }
    if (!proj) return null;
    /* Spektron-Ordner (spektron-ordner.js, falls geladen): App-Daten künftig in „_Spektron/…“; sonst wie bisher. */
    async function bereich(b, alt){ var SO = window.SpektronOrdner; if (SO) try{ return (await SO.ort(proj, b)).dir; }catch(eb){} return alt ? unterordner(proj, alt) : proj; }
    var s = { label: false, fotos: false, ergebnis: false, plan: false, bericht: false, beleg: false, objekt: '', anzeige: '', person: '' }, zust = null;
    var activeData = window.SpektronProjectData && window.SpektronProjectData(name);
    if (activeData){ var activeObjekt = typeof activeData.data.objekt === 'string' ? activeData.data.objekt : activeData.data.daten && activeData.data.daten.objekt; if (typeof activeObjekt === 'string') s.objekt = activeObjekt.trim(); zust = activeData.data.zustaendig; }
    else try{
      var pj = await ((await bereich('projekt', '')) || proj).getFileHandle('_Projekt.json').then(function(f){ return f.getFile(); }).then(function(f){ return f.text(); }).catch(function(){ return ''; });
      if (pj){ var j = JSON.parse(pj), o = j && (typeof j.objekt === 'string' ? j.objekt : j.daten && j.daten.objekt); if (typeof o === 'string') s.objekt = o.trim(); zust = j && j.zustaendig; }   // Projektzentrale schreibt die Felder direkt in _Projekt.json (ältere Testdateien: unter „daten“)
    }catch(e3){}
    await personUndAnzeige(arch, s, zust);
    try{ var fo = await bereich('fotokit', 'Fotos'); if (fo) s.fotos = await fo.getFileHandle('_Bildumbenenner.json').then(function(){ return true; }, function(){ return false; }); }catch(e4){}
    try{
      var la = await bereich('labelkit', 'Laboraufträge');
      if (la) for await (var f of la.values()) if (f.kind === 'file' && /_Daten\.json$/i.test(f.name)){ s.label = true; break; }
    }catch(e5){}
    try{ var le = await bereich('resultkit', 'Laborergebnisse'); if (le) s.ergebnis = await le.getFileHandle('_Ergebnisse.json').then(function(){ return true; }, function(){ return false; }); }catch(e8){}   // ResultKit: geprüfte Ergebnisse übernommen
    try{
      var pl = await bereich('plankit', 'Pläne');
      if (pl) for await (var g of pl.values()) if (g.kind === 'file' && /\.probenplan$/i.test(g.name) && !/ \((vorher|Wiederherstellung|Speicherkandidat|Kopie)\b[^)]*\)\.probenplan$/i.test(g.name)){ s.plan = true; break; }
    }catch(e6){}
    try{   // Bericht in „Mitteilungen“ (bleibt dort, auch in Spektron-Projekten): „1._Mitteilung_26.0528.docx“ (BerichtKit) wie „1__Mitteilung.docx“
      var mi = await unterordner(proj, 'Mitteilungen');
      if (mi) for await (var m of mi.values()) if (m.kind === 'file' && /^\d+[._\s]*Mitteilung(?![a-zäöüß]).*\.docx$/i.test(nfc(m.name))){ s.bericht = true; break; }
    }catch(e9){}
    try{
      var ab = await bereich('belegkit', 'Abrechnung');
      if (ab) for await (var k of ab.values()) if (k.kind === 'file' && /_Aufwand_.*\.json$/i.test(k.name)){ s.beleg = true; break; }
    }catch(e7){}
    return s;
  }
  /* Rückmeldeformular: Programm, Version und – bei geöffnetem Projekt – nur die Projektnummer */
  function rmHref(){
    var q = new URLSearchParams(), v = '';
    q.set('app', RM_APP[ich] || 'suite');
    try{ v = typeof version === 'function' ? version() : version; }catch(e){ v = ''; }
    if (v) q.set('version', String(v).trim().replace(/^v/, '').slice(0, 20));
    var o = name ? ordnerName(name, null) : null;
    if (o) q.set('projekt', o.nr);
    return RUECKMELDUNG + '?' + q.toString();
  }
  function rmFrisch(el){ el.addEventListener('click', function(){ el.setAttribute('href', rmHref()); }); return el; }   // beim Klick mit aktuellem Projekt und aktueller Version
  function rmLink(cls){ return rmFrisch(h('a', { class: cls, href: rmHref(), target: 'rueckmeldung', rel: 'noopener', title: 'Fehler oder Wunsch melden – öffnet das Rückmeldeformular, Programm, Version und Projektnummer sind schon eingetragen' }, h('b', { text: '💬', 'aria-hidden': 'true' }), h('span', { text: 'Rückmeldung' }))); }
  function naechster(){
    if (!stand) return null;
    var i0 = APPS.findIndex(function(a){ return a[0] === ich; }), n = APPS.length;
    for (var d = 1; d < n; d++){ var a = APPS[(i0 + d) % n]; if ((i0 + d) < n && !stand[a[0]]) return a; }   // zuerst ein späterer Schritt …
    for (var e = 1; e < n; e++){ var b = APPS[(i0 + e) % n]; if ((i0 + e) >= n && !stand[b[0]]) return b; }   // … sonst der erste offene davor
    return null;
  }
  function css(){
    if (document.getElementById('mosaikLeisteCss')) return;
    var st = h('style', { id: 'mosaikLeisteCss' });
    st.textContent =
            '#mosaikLeiste{position:relative;flex:none;box-sizing:border-box;width:100%;height:36px;z-index:2147483000;display:flex;align-items:center;gap:6px;padding:0 10px;background:#17222c;color:#e8eef3;font:12.5px/1 "Segoe UI",system-ui,-apple-system,Arial,sans-serif;box-shadow:0 1px 0 rgba(255,255,255,.08) inset,0 1px 6px rgba(0,0,0,.25);white-space:nowrap}' +
      '#mosaikLeiste a,#mosaikLeiste button{font:inherit;color:inherit;text-decoration:none;border:0;background:none;cursor:pointer;padding:0;margin:0;min-height:0;border-radius:6px;box-shadow:none}' +
      '#mosaikLeiste .ml-home,#mosaikLeiste .ml-proj{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;color:#c9d6df}' +
      '#mosaikLeiste .ml-home:hover,#mosaikLeiste .ml-proj:hover,#mosaikLeiste .ml-proj[aria-expanded=true]{background:rgba(255,255,255,.1);color:#fff}' +
      '#mosaikLeiste .ml-marke{flex:none;padding:0 6px 0 2px;color:#8fb3d1;font-weight:700;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap}' +
      '#mosaikLeiste .ml-proj b{color:#fff;font-weight:650}#mosaikLeiste .ml-obj{color:#9fb1be;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:0 1 auto;max-width:34ch}#mosaikLeiste .ml-wer{color:#dfe8ee;flex:0 0 auto}' +
      '#mosaikLeiste .ml-sp{flex:1 1 0;min-width:4px}' +
      '#mosaikLeiste .ml-steps{display:flex;align-items:center;gap:2px}' +
      '#mosaikLeiste .ml-step{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 9px;color:#b9c8d3;position:relative}' +
      '#mosaikLeiste a.ml-step:hover{background:rgba(255,255,255,.1);color:#fff}' +
      '#mosaikLeiste .ml-step i{width:16px;height:16px;border-radius:50%;display:inline-grid;place-items:center;font:700 9.5px/1 inherit;font-style:normal;border:1.5px solid var(--ac);color:var(--ac)}' +
      '#mosaikLeiste .ml-step.done i{background:var(--ac);color:#0f1820}' +
      '#mosaikLeiste .ml-step.next i{box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 35%,transparent)}' +
      '#mosaikLeiste .ml-step.hier{background:rgba(255,255,255,.14);color:#fff;font-weight:650;cursor:default}' +
      '#mosaikLeiste .ml-weiter{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 11px;background:var(--ac);color:#fff;font-weight:650}' +
      '#mosaikLeiste .ml-weiter:hover{filter:brightness(1.12)}' +
      '#mosaikLeiste .ml-hinweis{color:#9fb1be}' +
      '#mosaikLeiste .ml-rm{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 8px;margin-left:2px;color:#9fb1be}#mosaikLeiste .ml-rm:hover{background:rgba(255,255,255,.1);color:#fff}#mosaikLeiste .ml-rm b{font-weight:400}' +
      '#mosaikLeistePop{position:fixed;top:40px;left:8px;z-index:2147483001;min-width:260px;max-width:min(92vw,420px);background:#fff;color:#1b2a35;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.3);padding:6px;font:13px/1.35 "Segoe UI",system-ui,-apple-system,Arial,sans-serif}' +
      '#mosaikLeistePop h6{margin:6px 10px 4px;font:600 10.5px/1 inherit;letter-spacing:.06em;text-transform:uppercase;color:#6a7c89}' +
      '#mosaikLeistePop a{display:block;padding:8px 10px;border-radius:7px;color:inherit;text-decoration:none}#mosaikLeistePop a:hover,#mosaikLeistePop a:focus-visible{background:#eaf1f6;outline:0}' +
      '#mosaikLeistePop a.aktuell{font-weight:650;background:#f2f6f9}#mosaikLeistePop hr{border:0;border-top:1px solid #e2e9ee;margin:5px 4px}' +
      '#mosaikLeiste.ml-kompakt{height:24px;font-size:12px;padding:0 8px}#mosaikLeiste.ml-kompakt .ml-home,#mosaikLeiste.ml-kompakt .ml-proj,#mosaikLeiste.ml-kompakt .ml-step,#mosaikLeiste.ml-kompakt .ml-weiter,#mosaikLeiste.ml-kompakt .ml-rm{height:20px;padding:0 7px}#mosaikLeiste.ml-kompakt .ml-step i{width:14px;height:14px;font-size:9px}#mosaikLeistePop{top:30px}' +
      '#mosaikLeiste.ml-eng .ml-marke,#mosaikLeiste.ml-eng .ml-obj,#mosaikLeiste.ml-eng .ml-rm span{display:none}' +   // passt nicht: erst Marke, Objekt/Person, Rückmeldungstext …
      '#mosaikLeiste.ml-enger .ml-step span,#mosaikLeiste.ml-enger .ml-home span{display:none}#mosaikLeiste.ml-enger .ml-step.hier span{display:inline}' +   // … dann die Schrittnamen (außer der eigenen App) …
      '#mosaikLeiste.ml-engst .ml-step.hier span,#mosaikLeiste.ml-engst .ml-weiter span{display:none}#mosaikLeiste.ml-engst .ml-step{padding:0 5px}#mosaikLeiste.ml-engst .ml-proj{flex:0 1 auto;min-width:0}#mosaikLeiste.ml-engst .ml-proj b{overflow:hidden;text-overflow:ellipsis;min-width:0}' +   // … zuletzt wie auf dem Handy
      '@media (max-width:860px){#mosaikLeiste .ml-marke,#mosaikLeiste .ml-obj,#mosaikLeiste .ml-step span,#mosaikLeiste .ml-rm span{display:none}#mosaikLeiste .ml-step.hier span{display:inline}}' +
      '@media (max-width:560px){#mosaikLeiste .ml-home span,#mosaikLeiste .ml-weiter span{display:none}#mosaikLeiste .ml-rm{display:none}#mosaikLeiste .ml-step.hier span{display:none}' +
      '#mosaikLeiste{gap:4px;padding:0 6px}#mosaikLeiste .ml-steps{gap:0}#mosaikLeiste .ml-step{padding:0 5px}#mosaikLeiste .ml-proj{flex:0 1 auto;min-width:0;padding:0 6px}#mosaikLeiste .ml-proj b{overflow:hidden;text-overflow:ellipsis;min-width:0}}' +   // fünf Schritte passen auch auf 360 px
      '@media print{#mosaikLeiste,#mosaikLeistePop{display:none!important}}';
    document.head.appendChild(st);
  }
  function schliessePop(){ if (pop){ pop.remove(); pop = null; } var b = bar && bar.querySelector('.ml-proj'); if (b) b.setAttribute('aria-expanded', 'false'); }
  function oeffnePop(btn){
    if (pop) return schliessePop();
    pop = h('div', { id: 'mosaikLeistePop', role: 'menu' });
    var app = APPS.filter(function(a){ return a[0] === ich; })[0];
    var rest = zuletzt.filter(function(n){ return nfc(n) !== nfc(name); });
    if (name) pop.appendChild(h('h6', { text: 'Aktuelles Projekt' })), pop.appendChild(h('a', { class: 'aktuell', href: href(app, name), text: name, role: 'menuitem' }));
    if (rest.length){ pop.appendChild(h('h6', { text: 'Zuletzt geöffnet' })); rest.forEach(function(n){ pop.appendChild(h('a', { href: href(app, n), text: n, role: 'menuitem' })); }); }
    pop.appendChild(h('hr'));
    pop.appendChild(h('a', { href: ZENTRALE, target: 'projektzentrale', text: 'Alle Projekte … (Projektzentrale)', role: 'menuitem' }));
    pop.appendChild(rmFrisch(h('a', { class: 'ml-rm-pop', href: rmHref(), target: 'rueckmeldung', rel: 'noopener', text: '💬 Rückmeldung – Fehler oder Wunsch melden', role: 'menuitem' })));
    document.body.appendChild(pop);
    var r = btn.getBoundingClientRect(); pop.style.left = Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)) + 'px'; pop.style.top = (r.bottom + 4) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    var erste = pop.querySelector('a'); if (erste) erste.focus();
  }
  function zeichne(){
    css();
    if (!bar){
      bar = h('div', { id: 'mosaikLeiste', class: kompakt ? 'ml-kompakt' : '', role: 'navigation', 'aria-label': 'Projekt und Arbeitsschritte' });
      document.body.insertBefore(bar, document.body.firstChild);
    }
    schliessePop();
    bar.textContent = '';
    var app = APPS.filter(function(a){ return a[0] === ich; })[0] || APPS[0];
    bar.style.setProperty('--ac', app[4]);
    bar.appendChild(h('span', { class: 'ml-marke', title: 'Spektron – die Büro-Apps', text: 'Spektron' }));
    bar.appendChild(h('a', { class: 'ml-home', href: ZENTRALE, target: 'projektzentrale', title: 'Alle Projekte (Projektzentrale)' }, h('b', { text: '⌂', 'aria-hidden': 'true' }), h('span', { text: 'Projektzentrale' })));
    if (name){
      var pb = h('button', { class: 'ml-proj', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', title: 'Anderes Projekt öffnen' }, h('b', { text: (stand && stand.anzeige) || name, title: name }), h('span', { text: '▾', 'aria-hidden': 'true' }));
      pb.onclick = function(ev){ ev.stopPropagation(); oeffnePop(pb); };
      bar.appendChild(pb);
      var shared = window.SpektronProjectData && window.SpektronProjectData(name);
      var sharedObjekt = shared && (typeof shared.data.objekt === 'string' ? shared.data.objekt : shared.data.daten && shared.data.daten.objekt);
      var objekt = shared ? (typeof sharedObjekt === 'string' ? sharedObjekt.trim() : '') : stand && stand.objekt;
      var suffix = shared && shared.stale ? ' · möglicherweise veraltet' : shared && shared.checking ? ' · wird geprüft' : '';
      if (stand && stand.person) bar.appendChild(h('span', { class: 'ml-obj ml-wer', text: '· ' + stand.person, title: 'Zuständig: ' + stand.person }));
      if (objekt) bar.appendChild(h('span', { class: 'ml-obj', text: objekt + suffix, title: objekt + suffix }));
      bar.appendChild(h('span', { class: 'ml-sp' }));
      var steps = h('span', { class: 'ml-steps' });
      var nx = naechster();
      APPS.forEach(function(a, i){
        var done = !!(stand && stand[a[0]]), cls = 'ml-step' + (done ? ' done' : '') + (nx && nx[0] === a[0] ? ' next' : '') + (a[0] === ich ? ' hier' : '');
        var ic = h('i', { text: done ? '✓' : String(i + 1), 'aria-hidden': 'true' }), sp = h('span', { text: a[1] });
        var t = a[1] + (done ? ' – erledigt' : '') + (a[0] === ich ? ' (diese App)' : '');
        var el = a[0] === ich ? h('span', { class: cls, 'aria-current': 'page', title: t }, ic, sp) : h('a', { class: cls, href: href(a, name), target: a[2], title: t }, ic, sp);
        el.style.setProperty('--ac', a[4]); steps.appendChild(el);
      });
      bar.appendChild(steps);
      if (nx){
        var w = h('a', { class: 'ml-weiter', href: href(nx, name), target: nx[2], title: 'Nächster offener Schritt dieses Projekts' }, h('span', { text: 'Weiter: ' + nx[1] }), h('b', { text: '→', 'aria-hidden': 'true' }));
        w.style.setProperty('--ac', nx[4]); bar.appendChild(w);
      }
    }else{
      var l = zuletzt[0];
      bar.appendChild(h('span', { class: 'ml-hinweis', text: l ? 'Kein Projekt geöffnet.' : 'Projekte öffnen Sie über die Projektzentrale.' }));
      if (l){
        var wl = h('a', { class: 'ml-weiter', href: href(app, l), title: 'Öffnet dieses Projekt in dieser App' }, h('span', { text: 'Weiter mit ' + l }), h('b', { text: '→', 'aria-hidden': 'true' }));
        wl.style.setProperty('--ac', app[4]); bar.appendChild(wl);
      }
      bar.appendChild(h('span', { class: 'ml-sp' }));
      if (zuletzt.length > 1){
        var an = h('button', { class: 'ml-proj', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, h('span', { text: 'Anderes Projekt' }), h('span', { text: '▾', 'aria-hidden': 'true' }));
        an.onclick = function(ev){ ev.stopPropagation(); oeffnePop(an); }; bar.appendChild(an);
      }
    }
    bar.appendChild(rmLink('ml-rm'));
    passen();
  }
  /* Lange Projektnamen, Objekt und Person: Passt die Leiste nicht in die Breite, erst die Schrittnamen ausblenden, dann mehr – nie waagrecht scrollen */
  function passen(){
    if (!bar) return;
    bar.classList.remove('ml-eng', 'ml-enger', 'ml-engst');
    var zuBreit = function(){ return bar.scrollWidth > bar.clientWidth + 1; };
    ['ml-eng', 'ml-enger', 'ml-engst'].some(function(k){ if (!zuBreit()) return true; bar.classList.add(k); return false; });
  }
  async function aktualisieren(){
    var n = urlName();
    if (pop && n === name) return;   // Menü offen und Projekt unverändert: nicht neu zeichnen (würde es schließen)
    if (pop) schliessePop();
    var mein = ++lauf;
    if (n !== name){ name = n; stand = null; }
    try{ zuletzt = (await kvGet('zuletzt')) || []; if (!Array.isArray(zuletzt)) zuletzt = []; }catch(e){ zuletzt = []; }
    if (name && nfc(zuletzt[0] || '') !== nfc(name)){
      zuletzt = [name].concat(zuletzt.filter(function(x){ return nfc(x) !== nfc(name); })).slice(0, MAX);
      kvSet('zuletzt', zuletzt);
    }
    if (mein !== lauf) return;
    zeichne();
    if (!name) return;
    var s = null; try{ s = await ordnerStand(); }catch(e){ s = null; }
    if (mein !== lauf) return;
    var alt = JSON.stringify(stand); stand = s;
    if (JSON.stringify(s) !== alt) zeichne();
  }
  function start(appId, opt){
    ich = appId; kompakt = !!(opt && opt.kompakt);
    projektName = opt && typeof opt.projektName === 'function' ? opt.projektName : null;
    version = opt && opt.version != null ? opt.version : null;
    var los = function(){
      aktualisieren();
      window.addEventListener('focus', aktualisieren);
      document.addEventListener('visibilitychange', function(){ if (!document.hidden) aktualisieren(); });
      window.addEventListener('popstate', aktualisieren);
      window.addEventListener('resize', function(){ clearTimeout(passen.t); passen.t = setTimeout(passen, 100); });
      document.addEventListener('click', function(ev){ if (pop && !pop.contains(ev.target)) schliessePop(); });
      document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape' && pop){ var b = bar.querySelector('.ml-proj'); schliessePop(); if (b) b.focus(); } });
      timer = setInterval(function(){ if (!document.hidden) aktualisieren(); }, 20000);
    };
    if (document.body) los(); else document.addEventListener('DOMContentLoaded', los);
  }
  window.MosaikLeiste = { start: start, aktualisieren: aktualisieren };
})();
/* ===== Ende MOSAIK-LEISTE v1 ===== */
