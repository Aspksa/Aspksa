import { extractFileText } from './rag-extract';
import { embed, similarity } from './rag-semantic';
import {loadCache,storeCache,extractIdentifiers,extractReferences,linkDocuments,relatedPaths,type IndexedDocument,type DocumentLink} from './rag-memory';
export type RagSource={path:string;excerpt:string;score:number};
let disk:FileSystemDirectoryHandle|null=null;
const MAX_FILES=400,MAX_FILE_BYTES=8_000_000,MAX_TOTAL_CHARS=2_000_000;
type Chunk={path:string;text:string;terms:Set<string>;vector?:Float32Array};
let chunks:Chunk[]=[];
let documents:IndexedDocument[]=[];
let links:DocumentLink[]=[];
let cacheStatus:'ready'|'unavailable'|'pending'='pending';
export function ragLinks(){return [...links];}
export function ragDocuments(){return documents.map(({path,kind,identifiers,version})=>({path,kind,identifiers,version}));}
let indexed=0;
let pending:Promise<{files:number;chunks:number;skipped:number}>|null=null;
let generation=0;
let indexedGeneration=-1;
let lastError:string|null=null;
let semanticStatus:'pending'|'ready'|'fallback'='pending';
export function ragState(){return {ready:disk!==null&&indexedGeneration===generation,loading:pending!==null,error:lastError,semantic:semanticStatus,cache:cacheStatus,links:links.length};}
export function ragInvalidate(){generation++;indexedGeneration=-1;semanticStatus='pending';}
export function ragEnsureIndex(){
 if(!disk)return Promise.reject(new Error('Сначала подключи USB в разделе «Диск»'));
 if(pending)return pending.then(()=>indexedGeneration===generation?{files:indexed,chunks:chunks.length,skipped:0}:ragEnsureIndex());
 if(indexedGeneration===generation)return Promise.resolve({files:indexed,chunks:chunks.length,skipped:0});
 const target=generation;
 pending=ragIndex().then(result=>{if(target===generation){indexedGeneration=target;lastError=null;}return result;}).catch(e=>{lastError=String(e);throw e;}).finally(()=>{pending=null;});
 return pending;
}

const tokens=(s:string)=>s.toLocaleLowerCase('ru').match(/[\p{L}\p{N}]{3,}/gu)||[];
export function ragConnected(){return disk!==null;}
export function ragStats(){return {files:indexed,chunks:chunks.length};}
export function ragIndexedPaths(){return [...new Set(chunks.map(chunk=>chunk.path))];}
export function ragAttach(dir:FileSystemDirectoryHandle){disk=dir;chunks=[];documents=[];links=[];indexed=0;ragInvalidate();lastError=null;}
export function ragDetach(){disk=null;chunks=[];indexed=0;ragInvalidate();lastError=null;}
export async function ragIndex():Promise<{files:number;chunks:number;skipped:number}>{
 if(!disk)throw Error('Сначала подключи USB в разделе «Диск»');
 const source=disk;const startGeneration=generation;const fresh:Chunk[]=[];const nextDocs:IndexedDocument[]=[];let files=0,skipped=0,total=0;
 let cached=new Map<string,IndexedDocument>();try{cached=new Map((await loadCache()).map(d=>[d.path,d]));cacheStatus='ready';}catch{cacheStatus='unavailable';}
 async function walk(dir:FileSystemDirectoryHandle,path:string[],depth:number):Promise<void>{
  if(depth>12||files>=MAX_FILES||total>=MAX_TOTAL_CHARS)return;
  for await(const entry of dir.values()){
   if(path.length===0&&entry.name==='.aspksa-trash')continue;
   if(entry.kind==='directory'){await walk(await dir.getDirectoryHandle(entry.name),[...path,entry.name],depth+1);continue;}
   if(!/\.(txt|md|markdown|csv|json|log|pdf|docx|xlsx|pptx)$/i.test(entry.name)){skipped++;continue;}
   const file=await(await dir.getFileHandle(entry.name)).getFile();
   if(file.size>MAX_FILE_BYTES){skipped++;continue;}
   const label=[...path,entry.name].join('/');
   const existing=cached.get(label);
   let raw:string;try{raw=existing&&existing.size===file.size&&existing.modified===file.lastModified?existing.text:await extractFileText(file);}catch{skipped++;continue;}if(!raw.trim()){skipped++;continue;}files++;
   const remaining=MAX_TOTAL_CHARS-total;const value=raw.slice(0,remaining);total+=value.length;
   nextDocs.push({path:label,size:file.size,modified:file.lastModified,text:value,version:String(file.lastModified)+'-'+file.size,kind:entry.name.split('.').pop()?.toLowerCase()||'',identifiers:extractIdentifiers(value),references:extractReferences(value)});
   for(let i=0;i<value.length;i+=900){const part=value.slice(i,i+1200);if(part.trim())fresh.push({path:label,text:part,terms:new Set(tokens(part))});}
   if(files>=MAX_FILES||total>=MAX_TOTAL_CHARS)break;
  }
 }
 await walk(source,[],0);
 if(disk!==source||generation!==startGeneration)throw Error('Индекс устарел: файлы изменились во время индексации');
 chunks=fresh;documents=nextDocs;links=linkDocuments(nextDocs);indexed=files;
 if(cacheStatus==='ready')try{await storeCache(nextDocs);}catch{cacheStatus='unavailable';}
 // Index a bounded number of excerpts locally; if the model cannot download,
 // lexical search remains available without uploading any file content.
 try{
  for(const chunk of fresh.slice(0,100)){
   if(disk!==source||generation!==startGeneration)break;
   chunk.vector=await embed(chunk.text);
  }
  semanticStatus=fresh.length?'ready':'fallback';
 }catch(e){semanticStatus='fallback';console.warn('Semantic RAG unavailable, lexical fallback:',e);}
 return {files,chunks:chunks.length,skipped};
}
export async function ragSearch(question:string,limit=4):Promise<RagSource[]>{
 const query=[...new Set(tokens(question))];
 if(!query.length)return [];
 let vector:Float32Array|null=null;
 if(chunks.some(c=>c.vector)){try{vector=await embed(question);}catch{vector=null;}}
 const initial=chunks.map(c=>{
  let lexical=0;for(const t of query){if(c.terms.has(t))lexical+=2;else if(t.length>5&&[...c.terms].some(w=>w.startsWith(t.slice(0,5))))lexical+=1;}
  const semantic=vector&&c.vector?Math.max(0,similarity(vector,c.vector)):0;
  return {path:c.path,excerpt:c.text,score:lexical+semantic*8};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
 const candidates=initial.slice(0,Math.max(limit*3,12));
 const boosted=candidates.map(item=>{
  const neighbors=relatedPaths(item.path,links,8);
  const evidence=initial.filter(other=>neighbors.includes(other.path)).slice(0,3);
  return {...item,score:item.score+evidence.reduce((sum,x)=>sum+Math.min(x.score,4)*0.15,0)};
 }).sort((a,b)=>b.score-a.score);
 const chosen=boosted.slice(0,limit);
 // A second hop adds related evidence only when it has positive text relevance.
 if(chosen.length<limit){const seen=new Set(chosen.map(c=>c.path));for(const item of initial){if(chosen.length>=limit)break;if(seen.has(item.path))continue;chosen.push(item);seen.add(item.path);}}
 return chosen;
}
