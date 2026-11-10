// Spektron-Ordner: Zugang zu spektron-ordner.js (byte-gleich in allen Projekt-Apps, setzt globalThis.SpektronOrdner).
// Wo liegen die App-Daten eines Projekts? Künftig in „<Projekt>/_Spektron/…“. Solange ein Projekt keinen „_Spektron“-Ordner
// hat und UMSTELLUNG aus ist, liefert ort() überall den bisherigen Ort – also genau das bisherige Verhalten.
import './spektron-ordner.js';
import type {Dir} from './ordner';
export type Bereich='projekt'|'fotokit'|'fotokitPruefsummen'|'labelkit'|'labelkitAblage'|'resultkit'|'plankit'|'belegkit'|'buero'|'anlagenProtokoll';
export interface Ort{dir:Dir|null;wo:'neu'|'alt';pfad:string;konflikt:boolean;umgezogen:boolean;unterbrochen?:boolean;bereich:Bereich}
/** Eintrag aus zweiOrte() – nur durchgereicht an zweiOrteText(). */
export interface ZweiOrte{bereich:Bereich;app:string;wo:'neu'|'alt'}
interface Api{ORDNER:string;AB:string;UMSTELLUNG:boolean;ort(dir:Dir,bereich:Bereich,o?:{anlegen?:boolean}):Promise<Ort>;istSpektronProjekt(dir:Dir):Promise<boolean>;
 zweiOrte?(dir:Dir,bereiche?:Bereich[]):Promise<ZweiOrte[]>;zweiOrteText?(e:ZweiOrte):string}
export const SO=(globalThis as unknown as {SpektronOrdner:Api}).SpektronOrdner;
/** Wo liegt der Bereich? Nur lesen – legt nichts an. */
export const ort=(dir:Dir,bereich:Bereich)=>SO.ort(dir,bereich);
/** Ordner zum Schreiben: legt ihn bei Bedarf an (am neuen Ort mit Hinweisdatei). */
export async function ortZumSchreiben(dir:Dir,bereich:Bereich):Promise<Ort&{dir:Dir}>{const r=await SO.ort(dir,bereich,{anlegen:true});if(!r.dir)throw Error('Ordner für '+bereich+' nicht verfügbar.');return r as Ort&{dir:Dir};}
/** K1: App-Dateien an zwei Orten (in „_Spektron“ und am früheren Ort) – je Bereich eine Zeile Klartext (aus spektron-ordner.js).
    Nur lesen; ohne Modul oder bei Lesefehlern leer. */
export async function zweiOrteZeilen(dir:Dir,bereiche:Bereich[]):Promise<string[]>{
 try{if(!SO.zweiOrte||!SO.zweiOrteText)return [];const text=SO.zweiOrteText;return (await SO.zweiOrte(dir,bereiche)).map(e=>text(e));}catch{return [];}
}
