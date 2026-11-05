// @ts-nocheck
/* ===== MOSAIK-LEISTE v3 – in allen Apps der Familie identisch halten (LabelKit, FotoKit, ResultKit, PlanKit, BerichtKit, BelegKit) =====
   Links steht der Name der App-Suite „Spektron“ (Arbeitsname war „Mosaik“; interne Kennungen bleiben).
   Schmale Leiste oben: Projekt (mit Wechsel zu den zuletzt benutzten), die sechs Arbeitsschritte mit Haken und nächstem Schritt,
   „Weiter“-Knopf. Ohne geöffnetes Projekt: „Mit <letztes Projekt> weitermachen“.
   Teilt sich mit den anderen Apps nur den Browser-Speicher: IndexedDB „mosaik-suite“ / „kv“, Schlüssel „archiv“ (Ordner-Handle)
   und „zuletzt“ (Liste der zuletzt geöffneten Projektnamen). Liest den Ordner nur, schreibt nie hinein und fragt nie selbst
   nach Ordnerrechten – ohne Recht (oder ohne Ordnerzugriff, z. B. Safari) fehlen nur die Haken. Aufruf: MosaikLeiste.start('label'|'fotos'|'ergebnis'|'plan'|'bericht'|'beleg'[, {kompakt: true, kopfband: true}]),
   danach MosaikLeiste.aktualisieren() nach dem Öffnen oder Wechseln eines Projekts.
   Optional opt.projektName: Funktion, die die bestätigte Projektzuordnung statt der angeforderten URL liefert (FotoKit).
   Optional opt.version: Version der App (Text oder Funktion) für „💬 Rückmeldung“ rechts in der Leiste und im Projektmenü – öffnet
   ../rueckmeldung/ im eigenen Fenster mit Programm, Version und Projektnummer (nur die Nummer, kein Ort).
   Projektdaten: window.SpektronProjectData (LabelKit, PlanKit) liefert den aktuellen Stand samt „möglicherweise veraltet“; sonst _Projekt.json direkt.
   v2 (01.11.2026): BerichtKit-Schritt mit Berichtsart aus _BerichtKit.json (Feld „art“, sonst Art des zuletzt gespeicherten Berichts) –
   „BerichtKit · Brandbericht“, Link mit &art=…&auto=1 (schon gemerkt); ohne gemerkte Art nur „BerichtKit“ (BerichtKit entscheidet). Haken nur bei
   gespeichertem Bericht dieser Art, dessen Datei in „Mitteilungen“ noch da ist (ohne _BerichtKit.json wie v1: Dateiname). Nach dem
   gespeicherten Bericht „Weiter: Ans Büro übergeben →“ (Projektzentrale, liest keine Büroaufgaben; fertig erst mit BelegKit-Stand).
   „Weiter“ nennt Ziel und Grund im Tooltip. Keine Nummern an den Schritten. „Aktuelles Projekt“ im Menü lädt nicht neu.
   MosaikLeiste.oeffnen(href, fenster) öffnet einen #projekt=-Link wie die Leiste (lädt im benannten Fenster neu).
   v3 (01.11.2026): Option {kopfband: true} zeigt das Kopfband (84 px, kompakt 56 px): Projekt groß (Nr · Ort, darunter Objekt · Nutzung ·
   Schaden vom … · Zuständig), sechs Kacheln mit Symbol und Arbeitsnamen (Proben, Fotos, Labor, Plan, Bericht/Brandbericht/Asbestbericht,
   Abrechnung; App-Name im Tooltip) und ein großes „Weiter: … →“ mit Grund. Ohne Option bleibt alles wie v2 (Apps ohne Umbau).
   Haken, Links, Fenster, &art=…&auto=1 und „Ans Büro übergeben“ sind in beiden Optiken dieselben. Kacheln tragen weiter .ml-step.
   MosaikLeiste.mehr(knopf, eintraege) öffnet das Menü „Mehr …“ der App: eigene Einträge ({text, title, onclick | href + target,
   hidden, trenner}), darunter immer Handbuch ↗ (AidKit-Kapitel der App), Rückmeldung ↗ und Alle Projekte ↗. */
(function(){
  if (window.MosaikLeiste) return;
  var APPS = [
    ['label', 'LabelKit',  'labelkit',       '../labelkit/',       '#5469b8', 'Proben'],
    ['fotos', 'FotoKit',   'bildumbenenner', '../Bildumbenenner/', '#2f87a6', 'Fotos'],
    ['ergebnis', 'ResultKit', 'resultkit',   '../resultkit/',      '#7a5ca8', 'Labor'],
    ['plan',  'PlanKit',   'plankit',        '../Probenplan/',     '#4179b2', 'Plan'],
    ['bericht', 'BerichtKit', 'berichtkit',  '../berichtkit/',     '#b0683c', 'Bericht'],
    ['beleg', 'BelegKit',  'aufwandkit',     '../aufwandkit/',     '#2f7d6d', 'Abrechnung']
  ];
  var BUERO = ['buero', 'Ans Büro übergeben', 'projektzentrale', '../Projektzentrale/', '#5b6b78', 'Ans Büro übergeben'];   // kein Schritt der Leiste, nur Ziel von „Weiter“
  /* Kopfband (v3): kurzer Grund unter „Weiter“, Handbuch-Kapitel je App, Symbole (24er-Raster, nur Striche: p = Pfad, c = Kreis, r = Rechteck) */
  var KURZ = { label: 'noch keine Proben erfasst', fotos: 'noch keine Fotos zugeordnet', ergebnis: 'noch keine Laborergebnisse übernommen',
    plan: 'noch kein Probenplan', beleg: 'noch kein Abrechnungsstand', buero: 'Bericht ist gespeichert' };
  var AIDKIT = '../aidkit/', HANDBUCH = { label: 'app-labelkit', fotos: 'app-fotokit', ergebnis: 'app-resultkit', plan: 'app-plankit', bericht: 'app-berichtkit', beleg: 'app-belegkit' };
  var SYMBOL = {
    label: [['p', 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z'], ['c', 7.5, 7.5, 1.5]],
    fotos: [['r', 3, 7, 18, 13, 2], ['c', 12, 13.5, 3.5], ['p', 'M8 7l1.5-3h5L16 7']],
    ergebnis: [['p', 'M9 3v7L4 20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1l-5-10V3'], ['p', 'M7 3h10']],
    plan: [['p', 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z'], ['p', 'M9 4v14M15 6v14']],
    bericht: [['p', 'M6 2h8l5 5v15H6z'], ['p', 'M14 2v5h5M9 13h7M9 17h7']],
    beleg: [['c', 12, 12, 9], ['p', 'M15.5 8.5A4.5 4.5 0 0 0 8 12a4.5 4.5 0 0 0 7.5 3.5M6 10.5h7M6 13.5h7']],
    buero: [['p', 'M3 7h18v12H3zM3 7l9 6 9-6']],
    haus: [['p', 'M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z']]
  };
  var BERICHTSART = { asbest: 'Asbestbericht', brand: 'Brandbericht' };
  var GRUND = { label: 'noch keine Proben-Datei aus LabelKit', fotos: 'noch keine Fotos in FotoKit zugeordnet', ergebnis: 'noch keine Laborergebnisse in ResultKit übernommen',
    plan: 'noch kein Probenplan in PlanKit', beleg: 'noch kein Abrechnungsstand in BelegKit' };
  var ZENTRALE = '../Projektzentrale/', MAX = 6, RUECKMELDUNG = '../rueckmeldung/', RM_APP = { label: 'labelkit', fotos: 'fotokit', ergebnis: 'resultkit', plan: 'plankit', bericht: 'berichtkit', beleg: 'belegkit' };
  var ich = '', kompakt = false, projektName = null, version = null, name = '', stand = null, zuletzt = [], bar = null, pop = null, timer = 0, lauf = 0;
  var band = false, mehrPop = null, mehrKnopf = null;
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
  function href(app, projekt){   // die eigene App relativ zur aktuellen Seite (auch ohne den Pfad /<App>/)
    if (app[0] === 'buero') return app[3] + '#projekt=' + encodeURIComponent(projekt) + (stand && stand.berichtDatei ? '&uebergabe=' + encodeURIComponent('Mitteilungen/' + stand.berichtDatei) : '');
    // gemerkte Berichtsart nur für das aktuelle Projekt; &auto=1: schon gemerkt – BerichtKit prüft beim Öffnen selbst, ein alter Link überschreibt nichts
    var art = app[0] === 'bericht' && projekt && nfc(projekt) === nfc(name) && stand && stand.berichtArt ? '&art=' + stand.berichtArt + '&auto=1' : '';
    return (app[0] === ich ? '' : app[3]) + (projekt ? '#projekt=' + encodeURIComponent(projekt) + art : '');
  }
  function schrittName(a){ return a[0] === 'bericht' && stand && BERICHTSART[stand.berichtArt] ? a[1] + ' · ' + BERICHTSART[stand.berichtArt] : a[1]; }
  /* _BerichtKit.json (BerichtKit): mit spektron-ordner.js dessen Ort, sonst _Spektron/BerichtKit, dann Mitteilungen */
  async function berichtDatei(proj, mi){
    var orte = [], SO = window.SpektronOrdner;
    if (SO) try{ var o = (await SO.ort(proj, 'berichtkit')).dir; if (o) orte.push(o); }catch(e){}
    if (!orte.length){ var sp = await unterordner(proj, '_Spektron'); var bk = sp ? await unterordner(sp, 'BerichtKit') : null; if (bk) orte.push(bk); if (mi) orte.push(mi); }
    for (var i = 0; i < orte.length; i++){
      try{ var j = JSON.parse(await (await (await orte[i].getFileHandle('_BerichtKit.json')).getFile()).text()); if (j && j.format === 'spektron-bericht') return j; }catch(e){}
    }
    return null;
  }
  /* Gemerkte Berichtsart wie BerichtKit (bericht-vorgaben.js artGemerkt): Feld „art“, sonst Art des zuletzt gespeicherten Berichts (ohne Angabe: asbest) */
  function artVon(x){ var a = String(x == null ? '' : x).trim().toLowerCase(); return BERICHTSART[a] ? a : ''; }
  function gemerkteArt(j){
    var a = artVon(j && j.art); if (a) return a;
    var b = (j && Array.isArray(j.berichte) ? j.berichte : []).filter(function(x){ return x && x.datei; }).pop();
    return b ? (artVon(b.art) || (b.art ? '' : 'asbest')) : '';
  }

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
    var s = { label: false, fotos: false, ergebnis: false, plan: false, bericht: false, beleg: false, berichtArt: '', berichtDatei: '', berichtWeg: '', objekt: '', anzeige: '', person: '', nutzung: '', schadendatum: '', schadenereignis: '' }, zust = null;
    var pjFelder = function(j){   // Projektzentrale schreibt die Felder direkt in _Projekt.json (ältere Testdateien: unter „daten“)
      if (!j) return;
      ['objekt', 'nutzung', 'schadendatum', 'schadenereignis'].forEach(function(k){ var v = typeof j[k] === 'string' ? j[k] : j.daten && j.daten[k]; if (typeof v === 'string') s[k] = v.trim(); });
    };
    var activeData = window.SpektronProjectData && window.SpektronProjectData(name);
    if (activeData){ pjFelder(activeData.data); zust = activeData.data.zustaendig; }
    else try{
      var pj = await ((await bereich('projekt', '')) || proj).getFileHandle('_Projekt.json').then(function(f){ return f.getFile(); }).then(function(f){ return f.text(); }).catch(function(){ return ''; });
      if (pj){ var j = JSON.parse(pj); pjFelder(j); zust = j && j.zustaendig; }
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
      var mi = await unterordner(proj, 'Mitteilungen'), da = {}, mitteilung = null;
      if (mi) for await (var m of mi.values()) if (m.kind === 'file'){
        da[nfc(m.name).toLowerCase()] = true;
        if (/^\d+[._\s]*Mitteilung(?![a-zäöüß]).*\.docx$/i.test(nfc(m.name))){   // neueste Mitteilung merken (für „Ans Büro übergeben“ ohne _BerichtKit.json)
          var mt = 0; try{ mt = (await m.getFile()).lastModified; }catch(eM){}
          if (!mitteilung || mt > mitteilung.t) mitteilung = { name: m.name, t: mt };
        }
      }
      var bj = await berichtDatei(proj, mi), art = gemerkteArt(bj);
      s.berichtArt = art;
      if (art){   // Haken nur für einen gespeicherten Bericht der gemerkten Art, dessen Datei noch da ist
        var gb = (Array.isArray(bj.berichte) ? bj.berichte : []).filter(function(b){ return b && typeof b.datei === 'string' && (artVon(b.art) || (b.art ? '' : 'asbest')) === art; });
        var gs = gb.filter(function(b){ return da[nfc(b.datei).toLowerCase()]; });
        if (gs.length){ s.bericht = true; s.berichtDatei = gs[gs.length - 1].datei; }
        else if (gb.length) s.berichtWeg = gb[gb.length - 1].datei;   // gespeichert, aber die Datei ist nicht mehr da
      } else if (!bj && mitteilung){ s.bericht = true; s.berichtDatei = mitteilung.name; }   // ohne _BerichtKit.json: wie v1 nach dem Dateinamen
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
  /* Nächster offener Schritt → { app, frueher } – „Ans Büro übergeben“ zwischen BerichtKit und BelegKit: offen, solange ein Bericht
     gespeichert, aber noch kein BelegKit-Stand da ist (Büroaufgaben liest die Leiste nicht) */
  function naechster(){
    if (!stand) return null;
    var reihe = APPS.slice(0, 5).concat([BUERO], APPS.slice(5)), n = reihe.length;
    var offen = function(a){ return a[0] === 'buero' ? stand.bericht && !stand.beleg : !stand[a[0]]; };
    var i0 = reihe.findIndex(function(a){ return a[0] === ich; });
    for (var d = 1; d < n; d++){ var a = reihe[(i0 + d) % n]; if ((i0 + d) < n && offen(a)) return { app: a, frueher: false }; }   // zuerst ein späterer Schritt …
    for (var e = 1; e < n; e++){ var b = reihe[(i0 + e) % n]; if ((i0 + e) >= n && offen(b)) return { app: b, frueher: true }; }   // … sonst der erste offene davor
    return null;
  }
  function grund(a){
    if (a[0] === 'buero') return 'Bericht gespeichert' + (stand.berichtDatei ? ' (' + stand.berichtDatei + ')' : '') + ' – in der Projektzentrale ans Büro übergeben. Schon übergeben? Die Projektzentrale zeigt den Stand.';
    if (a[0] === 'bericht') return stand.berichtWeg ? BERICHTSART[stand.berichtArt] + ' „' + stand.berichtWeg + '“ ist nicht mehr in „Mitteilungen“ (gelöscht oder umbenannt?)'
      : BERICHTSART[stand.berichtArt] ? 'noch kein ' + BERICHTSART[stand.berichtArt] + ' gespeichert' : 'noch kein Bericht in „Mitteilungen“ – BerichtKit wählt die Berichtsart nach den Proben';
    return GRUND[a[0]] || '';
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
      '#mosaikLeiste .ml-step.hier{background:rgba(255,255,255,.14);color:#fff;font-weight:650;cursor:default;box-shadow:inset 0 -2px 0 var(--ac)}' +
      '#mosaikLeiste .ml-weiter{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 11px;background:var(--ac);color:#fff;font-weight:650}' +
      '#mosaikLeiste .ml-weiter:hover{filter:brightness(1.12)}' +
      '#mosaikLeiste .ml-hinweis{color:#9fb1be}' +
      '#mosaikLeiste .ml-rm{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 8px;margin-left:2px;color:#9fb1be}#mosaikLeiste .ml-rm:hover{background:rgba(255,255,255,.1);color:#fff}#mosaikLeiste .ml-rm b{font-weight:400}' +
      '#mosaikLeistePop{position:fixed;top:40px;left:8px;z-index:2147483001;min-width:260px;max-width:min(92vw,420px);background:#fff;color:#1b2a35;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.3);padding:6px;font:13px/1.35 "Segoe UI",system-ui,-apple-system,Arial,sans-serif}' +
      '#mosaikLeistePop h6{margin:6px 10px 4px;font:600 10.5px/1 inherit;letter-spacing:.06em;text-transform:uppercase;color:#6a7c89}' +
      '#mosaikLeistePop a{display:block;padding:8px 10px;border-radius:7px;color:inherit;text-decoration:none}#mosaikLeistePop a:hover,#mosaikLeistePop a:focus-visible{background:#eaf1f6;outline:0}' +
      '#mosaikLeistePop .aktuell{display:block;padding:8px 10px;border-radius:7px;font-weight:650;background:#f2f6f9;cursor:default}#mosaikLeistePop hr{border:0;border-top:1px solid #e2e9ee;margin:5px 4px}' +
      '#mosaikLeiste.ml-kompakt{height:24px;font-size:12px;padding:0 8px}#mosaikLeiste.ml-kompakt .ml-home,#mosaikLeiste.ml-kompakt .ml-proj,#mosaikLeiste.ml-kompakt .ml-step,#mosaikLeiste.ml-kompakt .ml-weiter,#mosaikLeiste.ml-kompakt .ml-rm{height:20px;padding:0 7px}#mosaikLeiste.ml-kompakt .ml-step i{width:14px;height:14px;font-size:9px}#mosaikLeistePop{top:30px}' +
      '#mosaikLeiste.ml-eng .ml-marke,#mosaikLeiste.ml-eng .ml-obj,#mosaikLeiste.ml-eng .ml-rm span{display:none}' +   // passt nicht: erst Marke, Objekt/Person, Rückmeldungstext …
      '#mosaikLeiste.ml-enger .ml-step span,#mosaikLeiste.ml-enger .ml-home span{display:none}#mosaikLeiste.ml-enger .ml-step.hier span{display:inline}' +   // … dann die Schrittnamen (außer der eigenen App) …
      '#mosaikLeiste.ml-engst .ml-step.hier span,#mosaikLeiste.ml-engst .ml-weiter span{display:none}#mosaikLeiste.ml-engst .ml-step{padding:0 5px}#mosaikLeiste.ml-engst .ml-proj{flex:0 1 auto;min-width:0}#mosaikLeiste.ml-engst .ml-proj b{overflow:hidden;text-overflow:ellipsis;min-width:0}' +   // … zuletzt wie auf dem Handy
      '@media (max-width:860px){#mosaikLeiste .ml-marke,#mosaikLeiste .ml-obj,#mosaikLeiste .ml-step span,#mosaikLeiste .ml-rm span{display:none}#mosaikLeiste .ml-step.hier span{display:inline}}' +
      '@media (max-width:560px){#mosaikLeiste .ml-home span,#mosaikLeiste .ml-weiter span{display:none}#mosaikLeiste .ml-rm{display:none}#mosaikLeiste .ml-step.hier span{display:none}' +
      '#mosaikLeiste{gap:4px;padding:0 6px}#mosaikLeiste .ml-steps{gap:0}#mosaikLeiste .ml-step{padding:0 5px}#mosaikLeiste .ml-proj{flex:0 1 auto;min-width:0;padding:0 6px}#mosaikLeiste .ml-proj b{overflow:hidden;text-overflow:ellipsis;min-width:0}}' +   // fünf Schritte passen auch auf 360 px
      /* v3 Kopfband: „body #mosaikLeiste.ml-band …“ geht den v2-Regeln (auch in den Media-Queries) vor; Inhalte in strong/em/small/svg statt span/i/b,
         damit die v2-Regeln für span/i/b nicht greifen. Stufen bei Platzmangel: ml-b1 Grund weg, ml-b2 Kachelnamen weg, ml-b3 zweizeilig. */
      'body #mosaikLeiste.ml-band{height:84px;gap:14px;padding:0 16px;font-size:13px;line-height:1.2}' +
      'body #mosaikLeiste.ml-band svg{width:24px;height:24px;flex:none}' +
      'body #mosaikLeiste.ml-band .ml-home{flex-direction:column;justify-content:center;gap:3px;height:64px;padding:0 10px;border-radius:10px;color:#c9d6df}' +
      'body #mosaikLeiste.ml-band .ml-home strong{font-weight:400;font-size:12px}' +
      'body #mosaikLeiste.ml-band .ml-kopf{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:2px;min-width:min(440px,40vw);flex:0 1 auto}' +   // Projekt geht vor: erst Grund und Kachelnamen weg, dann kürzen
      'body #mosaikLeiste.ml-band.ml-b3 .ml-kopf{min-width:0}' +
      'body #mosaikLeiste.ml-band .ml-proj{height:auto;max-width:calc(100% + 8px);min-width:0;margin-left:-8px;padding:2px 8px;gap:8px;color:#fff;font-size:22px;font-weight:700;border-radius:8px}' +
      'body #mosaikLeiste.ml-band .ml-proj strong{overflow:hidden;text-overflow:ellipsis;min-width:0}body #mosaikLeiste.ml-band .ml-proj em{font-style:normal;font-size:13px;font-weight:400;color:#9fb1be}' +
      'body #mosaikLeiste.ml-band .ml-z2{max-width:100%;overflow:hidden;text-overflow:ellipsis;color:#9fb1be;font-size:13px}body #mosaikLeiste.ml-band .ml-z2 strong{font-weight:400;color:#dfe8ee}body #mosaikLeiste.ml-band .ml-z2 em{font-style:normal}' +
      'body #mosaikLeiste.ml-band .ml-steps{gap:6px}' +
      'body #mosaikLeiste.ml-band .ml-step{flex-direction:column;justify-content:center;gap:4px;box-sizing:border-box;width:86px;height:64px;padding:0 4px;border-radius:10px;border:1.5px dashed #6f8597;background:#263340;color:#c9d6df;font-size:12.5px;font-weight:600;text-align:center}' +
      'body #mosaikLeiste.ml-band .ml-step strong{font-weight:inherit;max-width:100%;overflow:hidden;text-overflow:ellipsis}' +
      'body #mosaikLeiste.ml-band a.ml-step:hover{background:#2f3f4f;color:#fff}' +
      'body #mosaikLeiste.ml-band .ml-step.next{border-style:solid;border-color:var(--ac)}' +
      'body #mosaikLeiste.ml-band .ml-step.done{border:1.5px solid var(--ac);background:var(--ac);color:#fff}body #mosaikLeiste.ml-band a.ml-step.done:hover{background:var(--ac);color:#fff;filter:brightness(1.12)}' +
      'body #mosaikLeiste.ml-band .ml-step.hier{border:1.5px solid #fff;background:#fff;color:#17222c;font-weight:700;box-shadow:0 0 0 3px var(--ac);cursor:default}' +
      'body #mosaikLeiste.ml-band .ml-weiter{flex-direction:column;align-items:flex-start;justify-content:center;gap:3px;height:64px;max-width:280px;padding:0 18px;border-radius:10px}' +
      'body #mosaikLeiste.ml-band .ml-weiter strong{font-size:16px;font-weight:700}body #mosaikLeiste.ml-band .ml-weiter small{max-width:100%;overflow:hidden;text-overflow:ellipsis;font-size:12px;opacity:.92}' +
      'body #mosaikLeiste.ml-band .ml-hinweis{font-size:15px}' +
      'body #mosaikLeiste.ml-band.ml-kompakt{height:56px;gap:10px;padding:0 10px}body #mosaikLeiste.ml-band.ml-kompakt svg{width:18px;height:18px}' +
      'body #mosaikLeiste.ml-band.ml-kompakt .ml-home{height:44px}body #mosaikLeiste.ml-band.ml-kompakt .ml-proj{font-size:17px}body #mosaikLeiste.ml-band.ml-kompakt .ml-z2{font-size:12px}' +
      'body #mosaikLeiste.ml-band.ml-kompakt .ml-step{width:72px;height:44px;gap:2px;font-size:11.5px;border-radius:8px}body #mosaikLeiste.ml-band.ml-kompakt .ml-weiter{height:44px;padding:0 14px}body #mosaikLeiste.ml-band.ml-kompakt .ml-weiter strong{font-size:14px}' +
      'body #mosaikLeiste.ml-band.ml-b1 .ml-weiter small,body #mosaikLeiste.ml-band.ml-b1 .ml-home strong{display:none}' +
      'body #mosaikLeiste.ml-band.ml-b2 .ml-step:not(.hier) strong{display:none}body #mosaikLeiste.ml-band.ml-b2 .ml-step:not(.hier){width:52px}' +
      'body #mosaikLeiste.ml-band.ml-b3{height:auto;flex-wrap:wrap;row-gap:8px;padding:8px 12px}body #mosaikLeiste.ml-band.ml-b3 .ml-sp{flex:1 0 100%;height:0}' +   // Platzhalter wird Zeilenumbruch: Kacheln und „Weiter“ in die zweite Zeile
      '#mosaikMehrPop{position:fixed;z-index:2147483001;box-sizing:border-box;min-width:250px;max-width:min(92vw,380px);background:#fff;color:#1b2a35;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.3);padding:6px;font:14px/1.35 "Segoe UI",system-ui,-apple-system,Arial,sans-serif}' +
      '#mosaikMehrPop a,#mosaikMehrPop button{display:block;box-sizing:border-box;width:100%;margin:0;padding:9px 12px;border:0;border-radius:7px;background:none;box-shadow:none;color:inherit;font:inherit;text-align:left;text-decoration:none;cursor:pointer}' +
      '#mosaikMehrPop a:hover,#mosaikMehrPop button:hover,#mosaikMehrPop a:focus-visible,#mosaikMehrPop button:focus-visible{background:#eaf1f6;color:inherit;outline:0}#mosaikMehrPop button:disabled{opacity:.5;cursor:default;background:none}' +
      '#mosaikMehrPop hr{border:0;border-top:1px solid #e2e9ee;margin:5px 4px}' +
      '@media print{#mosaikLeiste,#mosaikLeistePop,#mosaikMehrPop{display:none!important}}';
    document.head.appendChild(st);
  }
  function schliessePop(){ if (pop){ pop.remove(); pop = null; } var b = bar && bar.querySelector('.ml-proj'); if (b) b.setAttribute('aria-expanded', 'false'); }
  function oeffnePop(btn){
    if (pop) return schliessePop();
    pop = h('div', { id: 'mosaikLeistePop', role: 'menu' });
    var app = APPS.filter(function(a){ return a[0] === ich; })[0];
    var rest = zuletzt.filter(function(n){ return nfc(n) !== nfc(name); });
    if (name) pop.appendChild(h('h6', { text: 'Aktuelles Projekt' })), pop.appendChild(h('div', { class: 'aktuell', text: name, title: 'Ist hier schon geöffnet' }));   // kein Link: würde die App neu laden
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
      bar = h('div', { id: 'mosaikLeiste', class: (kompakt ? 'ml-kompakt' : '') + (band ? (kompakt ? ' ' : '') + 'ml-band' : ''), role: 'navigation', 'aria-label': 'Projekt und Arbeitsschritte' });
      document.body.insertBefore(bar, document.body.firstChild);
    }
    schliessePop();
    bar.textContent = '';
    var app = APPS.filter(function(a){ return a[0] === ich; })[0] || APPS[0];
    bar.style.setProperty('--ac', app[4]);
    if (band){ zeichneBand(app); passen(); return; }
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
      APPS.forEach(function(a){
        var done = !!(stand && stand[a[0]]), cls = 'ml-step' + (done ? ' done' : '') + (nx && nx.app[0] === a[0] ? ' next' : '') + (a[0] === ich ? ' hier' : '');
        var ic = h('i', { text: done ? '✓' : '', 'aria-hidden': 'true' }), sp = h('span', { text: schrittName(a) });
        var t = schrittName(a) + (done ? ' – erledigt' + (a[0] === 'bericht' && stand.berichtDatei ? ' (' + stand.berichtDatei + ')' : '') : '') + (a[0] === ich ? ' (diese App)' : '');
        var el = a[0] === ich ? h('span', { class: cls, 'aria-current': 'page', title: t }, ic, sp) : h('a', { class: cls, href: href(a, name), target: a[2], title: t }, ic, sp);
        el.style.setProperty('--ac', a[4]); steps.appendChild(el);
      });
      bar.appendChild(steps);
      if (nx){
        var zn = schrittName(nx.app);
        var w = h('a', { class: 'ml-weiter', href: href(nx.app, name), target: nx.app[2], title: 'Weiter zu ' + zn + ': ' + grund(nx.app) + (nx.frueher ? ' (früherer Schritt, noch offen)' : '') + ' – öffnet ' + (nx.app[0] === 'buero' ? 'die Projektzentrale' : zn) + ' im eigenen Fenster.' }, h('span', { text: 'Weiter: ' + zn }), h('b', { text: '→', 'aria-hidden': 'true' }));
        w.style.setProperty('--ac', nx.app[4]); bar.appendChild(w);
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
  /* ---------- v3 Kopfband ---------- */
  function symbol(art){
    if (!document.createElementNS) return h('em', { 'aria-hidden': 'true' });
    var ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg');
    [['viewBox', '0 0 24 24'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true'], ['focusable', 'false']]
      .forEach(function(x){ s.setAttribute(x[0], x[1]); });
    (SYMBOL[art] || []).forEach(function(x){
      var el = document.createElementNS(ns, x[0] === 'p' ? 'path' : x[0] === 'c' ? 'circle' : 'rect');
      var a = x[0] === 'p' ? [['d', x[1]]] : x[0] === 'c' ? [['cx', x[1]], ['cy', x[2]], ['r', x[3]]] : [['x', x[1]], ['y', x[2]], ['width', x[3]], ['height', x[4]], ['rx', x[5]]];
      a.forEach(function(y){ el.setAttribute(y[0], String(y[1])); });
      s.appendChild(el);
    });
    return s;
  }
  function kachelName(a){ return a[0] === 'bericht' && stand && BERICHTSART[stand.berichtArt] ? BERICHTSART[stand.berichtArt] : a[5]; }
  function kurzGrund(a, frueher){
    var t = a[0] === 'bericht' ? (stand.berichtWeg ? 'Bericht-Datei fehlt in „Mitteilungen“' : 'noch kein Bericht gespeichert') : KURZ[a[0]] || '';
    return frueher ? 'früherer Schritt: ' + t : t;
  }
  function datumDe(x){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function zeichneBand(app){
    bar.appendChild(h('a', { class: 'ml-home', href: ZENTRALE, target: 'projektzentrale', title: 'Alle Projekte – Projektzentrale (Spektron)' }, symbol('haus'), h('strong', { text: 'Alle Projekte' })));
    if (!name){
      var l = zuletzt[0];
      bar.appendChild(h('span', { class: 'ml-hinweis', text: l ? 'Kein Projekt geöffnet.' : 'Projekte öffnest du über die Projektzentrale.' }));
      bar.appendChild(h('span', { class: 'ml-sp' }));
      if (zuletzt.length > 1){
        var an = h('button', { class: 'ml-proj', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, h('strong', { text: 'Anderes Projekt' }), h('em', { text: '▾', 'aria-hidden': 'true' }));
        an.style.fontSize = '15px'; an.onclick = function(ev){ ev.stopPropagation(); oeffnePop(an); }; bar.appendChild(an);
      }
      if (l){
        var wl = h('a', { class: 'ml-weiter', href: href(app, l), title: 'Öffnet dieses Projekt in dieser App' }, h('strong', { text: 'Weiter mit ' + l + ' →' }), h('small', { text: 'zuletzt geöffnet' }));
        wl.style.setProperty('--ac', app[4]); bar.appendChild(wl);
      }
      return;
    }
    var shared = window.SpektronProjectData && window.SpektronProjectData(name);
    var sharedObjekt = shared && (typeof shared.data.objekt === 'string' ? shared.data.objekt : shared.data.daten && shared.data.daten.objekt);
    var objekt = shared ? (typeof sharedObjekt === 'string' ? sharedObjekt.trim() : '') : stand && stand.objekt;
    var suffix = shared && shared.stale ? ' (möglicherweise veraltet)' : shared && shared.checking ? ' (wird geprüft)' : '';
    var anzeige = ((stand && stand.anzeige) || name).replace(/^(\d{2}\.\d{2,6})\s+/, '$1 · ');
    var kopf = h('div', { class: 'ml-kopf' });
    var pb = h('button', { class: 'ml-proj', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', title: name + ' – anderes Projekt öffnen' }, h('strong', { text: anzeige }), h('em', { text: '▾', 'aria-hidden': 'true' }));
    pb.onclick = function(ev){ ev.stopPropagation(); oeffnePop(pb); };
    kopf.appendChild(pb);
    var datum = stand ? datumDe(stand.schadendatum) : '';
    var teile = [objekt ? objekt + suffix : '', stand && stand.nutzung, datum ? 'Schaden vom ' + datum : ''].filter(Boolean);
    var person = stand && stand.person;
    if (teile.length || person){
      var z2 = h('div', { class: 'ml-z2', title: teile.concat(stand && stand.schadenereignis ? [stand.schadenereignis] : [], person ? ['Zuständig: ' + person] : []).join(' · ') });
      if (teile.length) z2.appendChild(h('em', { text: teile.join(' · ') }));
      if (person) z2.appendChild(h('strong', { text: (teile.length ? ' · ' : '') + person }));
      kopf.appendChild(z2);
    }
    bar.appendChild(kopf);
    bar.appendChild(h('span', { class: 'ml-sp' }));
    var steps = h('span', { class: 'ml-steps' });
    var nx = naechster();
    APPS.forEach(function(a){
      var done = !!(stand && stand[a[0]]), hier = a[0] === ich, cls = 'ml-step' + (done ? ' done' : '') + (nx && nx.app[0] === a[0] ? ' next' : '') + (hier ? ' hier' : '');
      var kn = kachelName(a), t = kn + ' – ' + a[1] + (done ? ' – erledigt' + (a[0] === 'bericht' && stand.berichtDatei ? ' (' + stand.berichtDatei + ')' : '') : '') + (hier ? ' (hier)' : '');
      var lbl = h('strong', { text: kn + (done ? ' ✓' : '') });
      var el = hier ? h('span', { class: cls, 'aria-current': 'page', title: t }, symbol(a[0]), lbl) : h('a', { class: cls, href: href(a, name), target: a[2], title: t }, symbol(a[0]), lbl);
      el.style.setProperty('--ac', a[4]); steps.appendChild(el);
    });
    bar.appendChild(steps);
    if (nx){
      var zn = schrittName(nx.app), kz = kachelName(nx.app);
      var w = h('a', { class: 'ml-weiter', href: href(nx.app, name), target: nx.app[2], title: 'Weiter zu ' + zn + ': ' + grund(nx.app) + (nx.frueher ? ' (früherer Schritt, noch offen)' : '') + ' – öffnet ' + (nx.app[0] === 'buero' ? 'die Projektzentrale' : zn) + ' im eigenen Fenster.' },
        h('strong', { text: 'Weiter: ' + kz + ' →' }), h('small', { text: kurzGrund(nx.app, nx.frueher) }));
      w.style.setProperty('--ac', nx.app[4]); bar.appendChild(w);
    }
  }
  /* „Mehr …“ der App: eigene Einträge, darunter immer Handbuch, Rückmeldung, Alle Projekte */
  function schliesseMehr(){ if (mehrPop){ mehrPop.remove(); mehrPop = null; } if (mehrKnopf) mehrKnopf.setAttribute('aria-expanded', 'false'); }
  function mehr(knopf, eintraege){
    if (mehrPop){ var war = mehrKnopf; schliesseMehr(); if (war === knopf) return; }
    schliessePop(); css();
    mehrKnopf = knopf;
    var app = APPS.filter(function(a){ return a[0] === ich; })[0];
    var liste = (eintraege || []).filter(function(e){ return e && !e.hidden; }).concat([{ trenner: true },
      { text: '📘 Handbuch ↗', href: AIDKIT + '#' + (HANDBUCH[ich] || ''), target: 'aidkit', rel: 'noopener', title: 'Handbuch: ' + (app ? app[1] : 'Spektron') + ' Schritt für Schritt – öffnet AidKit im eigenen Fenster' },
      { text: '💬 Rückmeldung ↗', href: rmHref(), target: 'rueckmeldung', rel: 'noopener', rm: true, title: 'Fehler oder Wunsch melden – Programm, Version und Projektnummer sind schon eingetragen' },
      { text: '⌂ Alle Projekte ↗', href: ZENTRALE, target: 'projektzentrale', title: 'Projektzentrale im eigenen Fenster' }]);
    mehrPop = h('div', { id: 'mosaikMehrPop', role: 'menu', 'aria-label': 'Mehr' });
    liste.forEach(function(e){
      if (e.trenner){ if (mehrPop.lastChild && mehrPop.lastChild.tagName !== 'HR') mehrPop.appendChild(h('hr')); return; }
      var el = e.href ? h('a', { href: e.href, target: e.target || '_self', role: 'menuitem', text: e.text }) : h('button', { type: 'button', role: 'menuitem', text: e.text });
      if (e.rel) el.setAttribute('rel', e.rel);
      if (e.title) el.setAttribute('title', e.title);
      if (e.id) el.setAttribute('id', e.id);
      if (e.disabled && !e.href) el.setAttribute('disabled', '');
      el.addEventListener('click', function(ev){
        if (e.rm) el.setAttribute('href', rmHref());
        if (e.onclick){ ev.preventDefault(); schliesseMehr(); if (mehrKnopf) mehrKnopf.focus(); e.onclick(ev); }
        else setTimeout(schliesseMehr);
      });
      mehrPop.appendChild(el);
    });
    mehrPop.addEventListener('focusout', function(ev){   // mit Tab hinaus: Menü zu
      var z = ev.relatedTarget; if (mehrPop && z && !mehrPop.contains(z) && z !== mehrKnopf) schliesseMehr();
    });
    mehrPop.addEventListener('keydown', function(ev){   // Pfeiltasten wandern durch das Menü
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
      var alle = Array.prototype.slice.call(mehrPop.querySelectorAll('a,button:not([disabled])')), i = alle.indexOf(document.activeElement);
      if (!alle.length) return; ev.preventDefault();
      alle[(i + (ev.key === 'ArrowDown' ? 1 : alle.length - 1)) % alle.length].focus();
    });
    document.body.appendChild(mehrPop);
    var r = knopf.getBoundingClientRect(), hoch = mehrPop.offsetHeight, breit = mehrPop.offsetWidth;
    var oben = r.top - hoch - 6; if (oben < 8) oben = Math.min(r.bottom + 6, innerHeight - hoch - 8);   // über dem Knopf (Fußleiste), sonst darunter
    mehrPop.style.left = Math.max(8, Math.min(r.left, innerWidth - breit - 8)) + 'px'; mehrPop.style.top = Math.max(8, oben) + 'px';
    knopf.setAttribute('aria-haspopup', 'menu'); knopf.setAttribute('aria-expanded', 'true');
    var erste = mehrPop.querySelector('a,button:not([disabled])'); if (erste) erste.focus();
  }
  /* Lange Projektnamen, Objekt und Person: Passt die Leiste nicht in die Breite, erst die Schrittnamen ausblenden, dann mehr – nie waagrecht scrollen */
  function passen(){
    if (!bar) return;
    var stufen = band ? ['ml-b1', 'ml-b2', 'ml-b3'] : ['ml-eng', 'ml-enger', 'ml-engst'];
    bar.classList.remove('ml-eng', 'ml-enger', 'ml-engst', 'ml-b1', 'ml-b2', 'ml-b3');
    var zuBreit = function(){ return bar.scrollWidth > bar.clientWidth + 1; };
    stufen.some(function(k){ if (!zuBreit()) return true; bar.classList.add(k); return false; });
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
    ich = appId; kompakt = !!(opt && opt.kompakt); band = !!(opt && opt.kopfband);
    projektName = opt && typeof opt.projektName === 'function' ? opt.projektName : null;
    version = opt && opt.version != null ? opt.version : null;
    var los = function(){
      aktualisieren();
      window.addEventListener('focus', aktualisieren);
      document.addEventListener('visibilitychange', function(){ if (!document.hidden) aktualisieren(); });
      window.addEventListener('popstate', aktualisieren);
      window.addEventListener('resize', function(){ clearTimeout(passen.t); passen.t = setTimeout(passen, 100); if (mehrPop) schliesseMehr(); });
      document.addEventListener('click', function(ev){ if (pop && !pop.contains(ev.target)) schliessePop(); if (mehrPop && !mehrPop.contains(ev.target) && !(mehrKnopf && mehrKnopf.contains(ev.target))) schliesseMehr(); });
      document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape' && pop){ var b = bar.querySelector('.ml-proj'); schliessePop(); if (b) b.focus(); } if (ev.key === 'Escape' && mehrPop){ schliesseMehr(); if (mehrKnopf) mehrKnopf.focus(); } });
      timer = setInterval(function(){ if (!document.hidden) aktualisieren(); }, 20000);
    };
    if (document.body) los(); else document.addEventListener('DOMContentLoaded', los);
  }
  window.MosaikLeiste = { start: start, aktualisieren: aktualisieren, oeffnen: projektNavigation, mehr: mehr };
})();
/* ===== Ende MOSAIK-LEISTE v3 ===== */
window.MosaikLeiste.start('ergebnis', {kopfband: true, version: () => (document.getElementById('app-version')?.textContent || '').replace(/^v/, '')});   // ResultKit 2.0: Kopfband (84 px) – Lesen-App ohne Karte
export {};
