export const SKALEN_DATEI:string;
/** Beim Öffnen eines Projekts: gemeinsame Skalen holen. 'datei' = Stand des Archivordners, 'lokal' = ohne Archiv/Recht. */
export function skalenAbgleich():Promise<'datei'|'lokal'>;
/** Nach dem Ändern (skala) oder Löschen (null) einer Skala in der Arbeitskopie: fürs Büro teilen. true = geteilt. */
export function skalaTeilen(key:string,skala:unknown):Promise<boolean>;
