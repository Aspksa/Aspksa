export type IndexedDocument={path:string;size:number;modified:number;text:string;version:string;kind:string;references:string[];identifiers:string[]};
const DB='aspksa-rag-cache-v2',STORE='documents';
let database:Promise<IDBDatabase>|null=null;
function openDb():Promise<IDBDatabase>{
 if(!database)database=new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'path'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);}).catch(e=>{database=null;throw e;});
 return database;
}
export async function loadCache(root:FileSystemDirectoryHandle):Promise<IndexedDocument[]>{
 const db=await openDb();const items=await new Promise<Array<IndexedDocument|{path:string;handle:FileSystemDirectoryHandle}>>((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const request=tx.objectStore(STORE).getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 const marker=items.find(item=>item.path==='__aspksa_cache_root__') as {path:string;handle?:FileSystemDirectoryHandle}|undefined;
 if(!marker?.handle||!(await root.isSameEntry(marker.handle)))return [];
 return items.filter(item=>item.path!=='__aspksa_cache_root__') as IndexedDocument[];
}
export async function storeCache(items:IndexedDocument[],root:FileSystemDirectoryHandle):Promise<void>{
 const db=await openDb();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');const store=tx.objectStore(STORE);store.clear();store.put({path:'__aspksa_cache_root__',handle:root});for(const item of items)store.put(item);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
}
export function extractIdentifiers(text:string):string[]{
 const values=[...text.matchAll(/(?:договор|контракт|сч[её]т|акт|спецификация|приложение)\s*(?:№|N|номер)?\s*([А-ЯA-Z0-9][А-ЯA-Z0-9\-/]{2,35})/gi)].map(m=>m[1].toLocaleLowerCase('ru'));
 const inn=[...text.matchAll(/\b(?:ИНН\s*[:№]?\s*)(\d{10}|\d{12})\b/gi)].map(m=>'инн:'+m[1]);
 return [...new Set([...values,...inn])].slice(0,40);
}
export function extractReferences(text:string):string[]{
 return [...new Set([...text.matchAll(/(?:приложени[еяю]|спецификаци[ияю]|договор[ауом]?|акт[ауом]?|сч[её]т[ауом]?)\s*(?:№|N)?\s*[А-ЯA-Z0-9\-/]{2,35}/gi)].map(m=>m[0].toLocaleLowerCase('ru')))].slice(0,40);
}
export type DocumentLink={from:string;to:string;reason:string;confidence:'предположительная'|'по реквизиту'};
export function linkDocuments(items:IndexedDocument[]):DocumentLink[]{
 const links:DocumentLink[]=[];
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
  const a=items[i],b=items[j];
  const common=a.identifiers.filter(id=>b.identifiers.includes(id));
  if(common.length)links.push({from:a.path,to:b.path,reason:'Общий реквизит: '+common.slice(0,3).join(', '),confidence:'по реквизиту'});
  else {
   const stem=(s:string)=>s.split('/').pop()!.replace(/\.[^.]+$/,'').toLocaleLowerCase('ru').replace(/\s+/g,' ');
   const sa=stem(a.path),sb=stem(b.path);
   if(sa.length>=7&&sb.length>=7&&(a.references.some(ref=>ref.includes(sb))||b.references.some(ref=>ref.includes(sa))))
    links.push({from:a.path,to:b.path,reason:'Ссылка в тексте на имя документа',confidence:'предположительная'});
  }
  if(links.length>=1500)return links;
 }
 return links;
}
export function relatedPaths(path:string,links:DocumentLink[],max=8):string[]{
 const result:string[]=[];for(const link of links){if(link.from===path)result.push(link.to);else if(link.to===path)result.push(link.from);if(result.length>=max)break;}return [...new Set(result)];
}
