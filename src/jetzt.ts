// „Jetzt dran“: der eine nächste Schritt in ResultKit – aus dem Ordnerstand abgeleitet, ohne Browserteile (in Node testbar).
// Je Zustand höchstens ein Hauptknopf: Berichte importieren → Ergebnisse übernehmen → (übernommen, nichts zu tun) → erneut übernehmen.
export type JetztArt='leer'|'warten'|'ohneWerte'|'importiert'|'uebernehmen'|'geaendert'|'unlesbar'|'fertig';
export type Aktion='import'|'uebernehmen'|'ansehen'|'hinweise';
export interface JetztEingabe {
 /** Zeilen der Übersicht (LabelKit-Auftrag ∪ Berichte) */proben:number;
 /** Prüfberichte im Ordner (gelesen), davon gültig: nicht ersetzt und mit Messwerten */berichte:number;gueltig:number;
 auftrag:boolean;stand:string;
 vorhanden:{stand:string;uebernommen:string;vollstaendig:boolean;
  /** übernommen vor 1.5: Oberflächenart/Raum fehlen für PlanKit */ohneLage?:boolean;
  /** übernommen vor 1.10: Nachweisgrenze der Asbestwerte fehlt */ohneNwg?:boolean}|null;vorhandenFehler:string;
 /** Hinweise insgesamt (Ordner, Laborauftrag, Berichte, Proben) */hinweise:number;
 /** Gerade importierte Berichte (bis „Übernehmen“ oder „Erst ansehen“) */importiert:string[]|null;
}
export interface Knopf {aktion:Aktion;text:string}
export interface Chip {text:string;art:'warn';aktion:Aktion}
/** stand: Stand in einem Satz (standText) über dem Text zeigen */
export interface Jetzt {art:JetztArt;eyebrow:string;titel:string;text:string;stand:boolean;chips:Chip[];haupt?:Knopf;neben?:Knopf;ok:boolean}

const uhr=(t:string)=>new Date(t).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const IMPORT:Knopf={aktion:'import',text:'📥 Berichte importieren'};
const plural=(n:number,eins:string,mehr:string)=>`${n} ${n===1?eins:mehr}`;

export function jetztDran(e:JetztEingabe):Jetzt{
 // Der Stand (vorläufig, offen, nicht beauftragt) steht als Satz darüber – als Chip nur, was man anklicken kann.
 const chips:Chip[]=[];
 if(e.hinweise)chips.push({text:`⚠ ${plural(e.hinweise,'Hinweis','Hinweise')}`,art:'warn',aktion:'hinweise'});
 const basis={eyebrow:'Jetzt dran',chips,ok:false,stand:true};
 if(!e.gueltig){
  if(!e.proben&&!e.berichte)return {...basis,stand:false,art:'leer',titel:'Prüfberichte importieren',text:'Noch keine Proben und keine Prüfberichte. In LabelKit im Projekt speichern oder hier die Prüfberichte (Eurofins-XML und PDF) importieren.',haupt:IMPORT};
  if(e.berichte)return {...basis,art:'ohneWerte',titel:'XML des Prüfberichts ergänzen',text:`Im Ordner liegt kein Prüfbericht mit Messwerten – die Werte kommen aus der XML (Eurofins EOL).`,haupt:IMPORT};
  return {...basis,art:'warten',titel:'Beim Labor – noch keine Prüfberichte',text:e.auftrag?'Die Proben sind beauftragt; sobald die Prüfberichte da sind, hier importieren.':'Kein Laborauftrag aus LabelKit gefunden – Prüfberichte können trotzdem importiert werden.',haupt:IMPORT};
 }
 if(e.vorhandenFehler)return {...basis,art:'unlesbar',titel:'Ergebnisse erneut übernehmen',text:`„_Ergebnisse.json“ ist nicht lesbar: ${e.vorhandenFehler} Erneut übernehmen schreibt eine neue Datei (die alte bleibt als „_Ergebnisse.vorher.json“).`,haupt:{aktion:'uebernehmen',text:'Erneut übernehmen'},neben:IMPORT};
 if(e.vorhanden&&e.vorhanden.stand===e.stand&&(e.vorhanden.ohneLage||e.vorhanden.ohneNwg)){
  const neu=[e.vorhanden.ohneLage?'Oberflächenart und Raum aus LabelKit gehen mit an PlanKit (Balken am Plan, Raumbuch)':'',
   e.vorhanden.ohneNwg?'Asbestwerte tragen die Nachweisgrenze aus dem Prüfbericht (0,001 % / 0,1 % / 1 %)':''].filter(Boolean).join('; ');
  return {...basis,art:'geaendert',titel:'Bitte einmal erneut übernehmen',
   text:'Neu: '+neu+'. Die Übernahme vom '+uhr(e.vorhanden.uebernommen)+' enthält das noch nicht – Werte ändern sich dadurch nicht.',haupt:{aktion:'uebernehmen',text:'Erneut übernehmen'},neben:IMPORT};}
 if(e.vorhanden&&e.vorhanden.stand===e.stand)
  return {...basis,art:'fertig',eyebrow:'Übernommen',ok:true,titel:`Übernommen am ${uhr(e.vorhanden.uebernommen)} ✓`,
   text:e.vorhanden.vollstaendig?'PlanKit und FotoKit verwenden diesen Stand.':'Zwischenstand – kommen weitere Berichte, einfach importieren und erneut übernehmen.',neben:IMPORT};
 if(e.importiert?.length&&!e.hinweise)
  return {...basis,art:'importiert',eyebrow:'Importiert',titel:`${e.importiert.join(', ')} eingelesen`,text:'Keine Hinweise. Jetzt übernehmen? PlanKit und FotoKit sehen die Werte erst danach.',
   haupt:{aktion:'uebernehmen',text:'Ergebnisse übernehmen'},neben:{aktion:'ansehen',text:'Erst ansehen'}};
 if(e.vorhanden)return {...basis,art:'geaendert',titel:'Geändert seit der Übernahme – bitte erneut übernehmen',
  text:`Übernommen am ${uhr(e.vorhanden.uebernommen)}; seitdem haben sich Prüfberichte oder der Laborauftrag geändert. PlanKit und FotoKit zeigen noch den alten Stand.`,haupt:{aktion:'uebernehmen',text:'Erneut übernehmen'},neben:IMPORT};
 return {...basis,art:'uebernehmen',titel:'Ergebnisse prüfen und übernehmen',text:'Noch nicht übernommen – PlanKit und FotoKit sehen die Werte erst danach.',haupt:{aktion:'uebernehmen',text:'Ergebnisse übernehmen'},neben:IMPORT};
}
