import { unzipSync, strFromU8 } from 'fflate';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc=pdfWorkerUrl;
// Browser-only lexical retrieval. No document index is uploaded or persisted.
export type RagSource={path:string;excerpt:string;score:number};
let disk:FileSystemDirectoryHandle|null=null;
const MAX_FILES=400,MAX_FILE_BYTES=8_000_000,MAX_TOTAL_CHARS=2_000_000;
async function extractText(file:File):Promise<string>{
 if(/\.pdf$/i.test(file.name)){
  const pdf=await getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  try{const pages:string[]=[];for(let i=1;i<=Math.min(pdf.numPages,80);i++){const page=await pdf.getPage(i);const content=await page.getTextContent();pages.push(content.items.map(item=>'str' in item?String(item.str):'').join(' '));if(pages.join('').length>100000)break;}return pages.join('\n');}finally{await pdf.destroy();}
 }
 if(/\.docx$/i.test(file.name)){
  const archive=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:entry=>entry.name==='word/document.xml'&&entry.originalSize<=10_000_000});
  const xml=archive['word/document.xml'];if(!xml)throw Error('DOCX не содержит document.xml');
  const doc=new DOMParser().parseFromString(strFromU8(xml),'application/xml');
  if(doc.querySelector('parsererror'))throw Error('Ошибка XML в DOCX');
  return [...doc.getElementsByTagName('w:p')].map(p=>[...p.getElementsByTagName('w:t')].map(t=>t.textContent||'').join('')).join('\n');
 }
 return file.text();
}

type Chunk={path:string;text:string;terms:Set<string>};
let chunks:Chunk[]=[];
let indexed=0;
let pending:Promise<{files:number;chunks:number;skipped:number}>|null=null;
let generation=0;
let indexedGeneration=-1;
let lastError:string|null=null;
export function ragState(){return {ready:disk!==null&&indexedGeneration===generation,loading:pending!==null,error:lastError};}
export function ragInvalidate(){generation++;indexedGeneration=-1;}
export function ragEnsureIndex(){
 if(!disk)return Promise.reject(new Error('Сначала подключи USB в разделе «Диск»'));
 if(pending)return pending;
 if(indexedGeneration===generation)return Promise.resolve({files:indexed,chunks:chunks.length,skipped:0});
 const target=generation;
 pending=ragIndex().then(result=>{if(target===generation)indexedGeneration=target;lastError=null;return result;}).catch(e=>{lastError=String(e);throw e;}).finally(()=>{pending=null;});
 return pending;
}

const tokens=(s:string)=>s.toLocaleLowerCase('ru').match(/[\p{L}\p{N}]{3,}/gu)||[];
export function ragConnected(){return disk!==null;}
export function ragStats(){return {files:indexed,chunks:chunks.length};}
export function ragIndexedPaths(){return [...new Set(chunks.map(chunk=>chunk.path))];}
export function ragAttach(dir:FileSystemDirectoryHandle){disk=dir;chunks=[];indexed=0;ragInvalidate();lastError=null;}
export function ragDetach(){disk=null;chunks=[];indexed=0;ragInvalidate();lastError=null;}
export async function ragIndex():Promise<{files:number;chunks:number;skipped:number}>{
 if(!disk)throw Error('Сначала подключи USB в разделе «Диск»');
 const source=disk;const fresh:Chunk[]=[];let files=0,skipped=0,total=0;
 async function walk(dir:FileSystemDirectoryHandle,path:string[],depth:number):Promise<void>{
  if(depth>12||files>=MAX_FILES||total>=MAX_TOTAL_CHARS)return;
  for await(const entry of dir.values()){
   if(path.length===0&&entry.name==='.aspksa-trash')continue;
   if(entry.kind==='directory'){await walk(await dir.getDirectoryHandle(entry.name),[...path,entry.name],depth+1);continue;}
   if(!/\.(txt|md|markdown|csv|json|log|pdf|docx)$/i.test(entry.name)){skipped++;continue;}
   const file=await(await dir.getFileHandle(entry.name)).getFile();
   if(file.size>MAX_FILE_BYTES){skipped++;continue;}
   let raw:string;try{raw=await extractText(file);}catch{skipped++;continue;}if(!raw.trim()){skipped++;continue;}files++;
   const remaining=MAX_TOTAL_CHARS-total;const value=raw.slice(0,remaining);total+=value.length;
   const label=[...path,entry.name].join('/');
   for(let i=0;i<value.length;i+=900){const part=value.slice(i,i+1200);if(part.trim())fresh.push({path:label,text:part,terms:new Set(tokens(part))});}
   if(files>=MAX_FILES||total>=MAX_TOTAL_CHARS)break;
  }
 }
 await walk(source,[],0);
 if(disk!==source)throw Error('USB-диск изменился во время индексации');
 chunks=fresh;indexed=files;
 return {files,chunks:chunks.length,skipped};
}
export function ragSearch(question:string,limit=4):RagSource[]{
 const query=[...new Set(tokens(question))];
 if(!query.length)return [];
 return chunks.map(c=>{
  let score=0;for(const t of query){if(c.terms.has(t))score+=2;else if(t.length>5&&[...c.terms].some(w=>w.startsWith(t.slice(0,5))))score+=1;}
  return {path:c.path,excerpt:c.text,score};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit);
}
