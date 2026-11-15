import { unzipSync, strFromU8 } from 'fflate';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';
GlobalWorkerOptions.workerSrc=pdfWorkerUrl;

const MAX_XML=12_000_000;
const decode=(bytes:Uint8Array)=>strFromU8(bytes);
const xmlDoc=(bytes:Uint8Array)=>{const doc=new DOMParser().parseFromString(decode(bytes),'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('Некорректный XML');return doc;};
const tags=(node:Document|Element,tag:string)=>Array.from(node.getElementsByTagName(tag));
const strings=(node:Document|Element,tag:string)=>tags(node,tag).map(el=>el.textContent||'').join('');
const archive=(file:Uint8Array,match:(name:string)=>boolean)=>unzipSync(file,{filter:entry=>match(entry.name)&&entry.originalSize<=MAX_XML});
let workerPromise:ReturnType<typeof createWorker>|null=null;
async function ocr(canvas:HTMLCanvasElement):Promise<string>{
 if(!workerPromise)workerPromise=createWorker('rus+eng').catch(e=>{workerPromise=null;throw e;});
 const worker=await workerPromise;return (await worker.recognize(canvas)).data.text;
}
export async function extractFileText(file:File):Promise<string>{
 if(/\.pdf$/i.test(file.name)){
  const pdf=await getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  try{
   const pages:string[]=[];let usedOcr=0;
   for(let i=1;i<=Math.min(pdf.numPages,80);i++){
    const page=await pdf.getPage(i);
    const content=await page.getTextContent();
    let text=content.items.map(item=>'str' in item?String(item.str):'').join(' ');
    if(text.trim().length<24&&usedOcr<8){
     const viewport=page.getViewport({scale:1.4});
     const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
     const ctx=canvas.getContext('2d');if(ctx){await page.render({canvasContext:ctx,viewport}).promise;text=await ocr(canvas);usedOcr++;}
     canvas.width=0;canvas.height=0;
    }
    pages.push(text);
    if(pages.join('').length>100000)break;
   }
   return pages.join('\n');
  }finally{await pdf.destroy();}
 }
 if(/\.(docx|pptx|xlsx)$/i.test(file.name)){
  const kind=file.name.toLowerCase().split('.').pop();
  const match=(name:string)=>kind==='docx'?name==='word/document.xml':kind==='pptx'?/^ppt\/slides\/slide\d+\.xml$/.test(name):name==='xl/sharedStrings.xml'||/^xl\/worksheets\/sheet\d+\.xml$/.test(name);
  const entries=archive(new Uint8Array(await file.arrayBuffer()),match);
  if(kind==='docx'){
   const bytes=entries['word/document.xml'];if(!bytes)throw Error('DOCX не содержит текста');
   const doc=xmlDoc(bytes);return tags(doc,'w:p').map(p=>strings(p,'w:t')).join('\n');
  }
  if(kind==='pptx'){
   return Object.keys(entries).sort((a,b)=>Number(a.match(/slide(\d+)/)?.[1]||0)-Number(b.match(/slide(\d+)/)?.[1]||0))
    .map(name=>'['+name+'] '+tags(xmlDoc(entries[name]),'a:p').map(p=>strings(p,'a:t')).join(' ')).join('\n');
  }
  const shared=entries['xl/sharedStrings.xml']?tags(xmlDoc(entries['xl/sharedStrings.xml']),'si').map(si=>strings(si,'t')):[];
  return Object.keys(entries).filter(name=>name.startsWith('xl/worksheets/')).sort().map(name=>{
   const doc=xmlDoc(entries[name]);const rows=tags(doc,'row').slice(0,2000).map(row=>tags(row,'c').map(cell=>{
    const type=cell.getAttribute('t');const value=tags(cell,'v')[0]?.textContent||'';
    return type==='s'?shared[Number(value)]||'':type==='inlineStr'?strings(cell,'t'):value;
   }).join(' | '));return '['+name+']\n'+rows.join('\n');
  }).join('\n');
 }
 return file.text();
}
