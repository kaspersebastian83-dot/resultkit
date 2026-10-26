import {getDocument,GlobalWorkerOptions,Util,type PDFDocumentProxy,type PDFDocumentLoadingTask} from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerURL from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
GlobalWorkerOptions.workerSrc=workerURL;
const assets=new URL(`${import.meta.env.BASE_URL}pdfjs/`,document.baseURI).href;
const mobile=()=>/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)||((navigator as Navigator & {deviceMemory?:number}).deviceMemory||8)<=4;
async function deadline<T>(promise:Promise<T>,cancel:()=>void,label:string):Promise<T>{
  let timer=0;try{return await Promise.race([promise,new Promise<T>((_r,reject)=>{timer=window.setTimeout(()=>{cancel();reject(Error(`${label} dauert zu lange. Bitte die XML des Prüfberichts verwenden.`));},45_000);})]);}finally{clearTimeout(timer);}
}
function pdfError(error:unknown):Error{
  const e=error as {name?:string;message?:string};
  if(e.name==='PasswordException')return Error('Diese PDF ist passwortgeschützt. Bitte eine ungeschützte Kopie des Prüfberichts verwenden.');
  if(e.name==='InvalidPDFException'||e.name==='MissingPDFException')return Error('Die PDF ist beschädigt oder enthält keine lesbaren Seiten. Bitte die Datei erneut als PDF oder JPG/PNG speichern.');
  if(e.message?.includes('dauert zu lange'))return Error(e.message);
  return Error('Die PDF-Seite konnte nicht verarbeitet werden. Möglicherweise ist sie zu komplex oder der Gerätespeicher reicht nicht aus. Bitte andere Apps schließen oder eine kleinere PDF/JPG/PNG verwenden.');
}
export class LocalPDF {
  constructor(private document:PDFDocumentProxy,private task:PDFDocumentLoadingTask,readonly name:string){}
  get pages(){return this.document.numPages;}
  async text():Promise<import('./labreport').TextPage[]>{
    if(this.pages>100)throw Error('Laborbericht mit mehr als 100 Seiten. Bitte einen kürzeren Bericht verwenden.');
    const pages:import('./labreport').TextPage[]=[];let count=0;
    for(let number=1;number<=this.pages;number++){const page=await this.document.getPage(number),viewport=page.getViewport({scale:1});try{const content=await deadline(page.getTextContent(),()=>{void this.task.destroy();},'Die PDF-Texterkennung');const items=content.items.flatMap(item=>{if(!('str' in item))return [];const m=Util.transform(viewport.transform,item.transform);count+=item.str.length;if(count>2_000_000)throw Error('Zu viel Text im Laborbericht. Bitte einen kleineren Bericht verwenden.');return [{text:item.str,x:m[4],y:m[5],width:item.width,height:item.height}];});pages.push({width:viewport.width,height:viewport.height,items});}finally{page.cleanup();}}
    return pages;
  }
  async close(){await this.task.destroy();}
}
export async function openPDF(name:string,bytes:Uint8Array):Promise<LocalPDF>{
  if(bytes.length>60*1024*1024)throw Error('Die PDF ist zu groß (maximal 60 MB). Bitte nur die benötigten Seiten als eigene PDF speichern.');
  const task=getDocument({data:bytes,cMapUrl:`${assets}cmaps/`,cMapPacked:true,standardFontDataUrl:`${assets}standard_fonts/`,wasmUrl:`${assets}wasm/`,iccUrl:`${assets}iccs/`,useSystemFonts:false,useWorkerFetch:true,enableXfa:false,stopAtErrors:true,canvasMaxAreaInBytes:mobile()?36_000_000:64_000_000});
  try{
    const doc=await deadline(task.promise,()=>{void task.destroy();},'Das Öffnen der PDF');
    if(doc.numPages>500){await task.destroy();throw Error('Die PDF enthält mehr als 500 Seiten. Bitte den Prüfbericht als eigene PDF speichern.');}
    return new LocalPDF(doc,task,name);
  }catch(error){await task.destroy().catch(()=>{});if(error instanceof Error&&error.message.includes('500 Seiten'))throw error;throw pdfError(error);}
}
