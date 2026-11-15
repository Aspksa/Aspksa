// Browser-only lexical retrieval. No document index is uploaded or persisted.
export type RagSource={path:string;excerpt:string;score:number};
let disk:FileSystemDirectoryHandle|null=null;
const MAX_FILES=400,MAX_FILE_BYTES=1_000_000,MAX_TOTAL_CHARS=2_000_000;
type Chunk={path:string;text:string;terms:Set<string>};
let chunks:Chunk[]=[];
let indexed=0;
const tokens=(s:string)=>s.toLocaleLowerCase('ru').match(/[\\p{L}\\p{N}]{3,}/gu)||[];
export function ragConnected(){return disk!==null;}
export function ragStats(){return {files:indexed,chunks:chunks.length};}
export function ragAttach(dir:FileSystemDirectoryHandle){disk=dir;chunks=[];indexed=0;}
export function ragDetach(){disk=null;chunks=[];indexed=0;}
export async function ragIndex():Promise<{files:number;chunks:number;skipped:number}>{
 if(!disk)throw Error('Сначала подключи USB в разделе «Диск»');
 const fresh:Chunk[]=[];let files=0,skipped=0,total=0;
 async function walk(dir:FileSystemDirectoryHandle,path:string[],depth:number):Promise<void>{
  if(depth>12||files>=MAX_FILES||total>=MAX_TOTAL_CHARS)return;
  for await(const entry of dir.values()){
   if(path.length===0&&entry.name==='.aspksa-trash')continue;
   if(entry.kind==='directory'){await walk(await dir.getDirectoryHandle(entry.name),[...path,entry.name],depth+1);continue;}
   if(!/\\.(txt|md|markdown|csv|json|log)$/i.test(entry.name)){skipped++;continue;}
   const file=await(await dir.getFileHandle(entry.name)).getFile();
   if(file.size>MAX_FILE_BYTES){skipped++;continue;}
   const raw=await file.text();files++;
   const remaining=MAX_TOTAL_CHARS-total;const value=raw.slice(0,remaining);total+=value.length;
   const label=[...path,entry.name].join('/');
   for(let i=0;i<value.length;i+=900){const part=value.slice(i,i+1200);if(part.trim())fresh.push({path:label,text:part,terms:new Set(tokens(part))});}
   if(files>=MAX_FILES||total>=MAX_TOTAL_CHARS)break;
  }
 }
 await walk(disk,[],0);
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
