// Gemeinsame Typen für Laborberichte – gleiche Feldnamen wie in PlanKit (src/model.ts), damit PlanKit die geprüften
// Ergebnisse aus „_Ergebnisse.json“ ohne Umbau in seine Projektdatei übernehmen kann.
export interface LabSources {xml?:string;pdf?:string}
export interface LabOrigin {id:string;bericht:string;labor:string;auftragsreferenz:string;batch?:string;sources:LabSources;vorlaeufig?:true}
/** Ein Messwert: Parameter, Ergebnis wie im Bericht (Text), Einheit; loq = Bestimmungsgrenze (BG) laut Bericht. */
export interface Wert {p:string;r:string;u:string;loq?:string}
export interface LabData {ref:string;desc:string;art?:string;labNr?:string;datum?:string;bericht?:string;reportId?:string;werte?:Wert[]}
export type Surface='floor'|'wall'|'ceiling';
export interface LabSample extends LabData {label:string;typ?:string;surface?:Surface;raum?:string}
export interface Category {name:string;from:number;color?:string}
export interface Scale {name:string;cats:Category[]}
export interface ResultSettings {usage?:'residential'|'industrial';parameter?:string;scales?:Record<string,Scale>;vds?:Record<string,Scale|null>}
export const MAX_RAUM=80;
export const SURFACE_FROM_LABELKIT:Record<string,Surface>={Untersicht:'ceiling',Ansicht:'wall',Aufsicht:'floor'};
