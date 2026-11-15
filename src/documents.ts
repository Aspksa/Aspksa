import { ragAttach, ragIndex } from './rag';
import { zipSync, unzipSync } from 'fflate';
// USB file manager. Browser permission is required once per session.
type PickerWindow = Window & { showDirectoryPicker?: (options?: {mode?:'readwrite'})=>Promise<FileSystemDirectoryHandle> };
let drive:FileSystemDirectoryHandle|null=null;
let current:string[]=[];
let mode:'grid'|'list'='grid';
let tab:'all'|'favorites'|'recent'|'trash'='all';
const favoriteKey='aspksa-usb-favorites-v1';
const recentKey='aspksa-usb-recent-v1';
const stored=(key:string):string[]=>{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[];}catch{return [];}};
const save=(key:string,items:string[])=>localStorage.setItem(key,JSON.stringify(items.slice(0,100)));
const itemPath=(segments:string[],name:string)=>[...segments,name].join('/');
async function at(segments:string[]){if(!drive)throw Error('USB не подключён');let dir=drive;for(const name of segments)dir=await dir.getDirectoryHandle(name);return dir;}
async function searchAll(query:string){const results:{entry:FileSystemHandle;path:string[]}[]=[];if(!drive)return results;const walk=async(dir:FileSystemDirectoryHandle,path:string[],depth:number)=>{if(depth>12||results.length>=500)return;for await(const entry of dir.values()){if(entry.name.toLocaleLowerCase('ru').includes(query)||!query)results.push({entry,path});if(entry.kind==='directory'&&depth<12)await walk(await dir.getDirectoryHandle(entry.name),[...path,entry.name],depth+1);if(results.length>=500)return;}};await walk(drive,[],0);return results;}

const text=(tag:string,cls:string,value='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=value;return e;};
const clean=(name:string)=>name.trim().replace(/[\\/\x00-\x1f]/g,'_').slice(0,120);
async function directory(){if(!drive)throw Error('USB не подключён');let dir=drive;for(const name of current)dir=await dir.getDirectoryHandle(name);return dir;}
async function initialize(){const picker=(window as PickerWindow).showDirectoryPicker;if(!picker)throw Error('Используй Chrome или Edge на компьютере через HTTPS. Этот браузер не поддерживает доступ к USB-папкам.');const disk=await picker({mode:'readwrite'});const project=await disk.getDirectoryHandle('Aspksa',{create:true});drive=await project.getDirectoryHandle('Диск',{create:true});ragAttach(drive);current=[];}
async function exists(dir:FileSystemDirectoryHandle,name:string){try{await dir.getFileHandle(name);return true;}catch{}try{await dir.getDirectoryHandle(name);return true;}catch{}return false;}
async function collectZip(dir:FileSystemDirectoryHandle,prefix:string,files:Record<string,Uint8Array>,depth=0){if(depth>20)throw Error('Слишком глубокая структура папок');for await(const entry of dir.values()){if(!prefix&&entry.name===trashFolder)continue;const key=prefix+entry.name;if(entry.kind==='directory')await collectZip(await dir.getDirectoryHandle(entry.name),key+'/',files,depth+1);else{const file=await(await dir.getFileHandle(entry.name)).getFile();if(file.size>100_000_000)throw Error('Один файл превышает 100 МБ');files[key]=new Uint8Array(await file.arrayBuffer());if(Object.values(files).reduce((total,item)=>total+item.byteLength,0)>100_000_000)throw Error('Суммарный размер архива превышает 100 МБ');}}}

// ZIP extraction is opt-in and confined to a newly created subfolder.
async function extractZip(file:File, destination:FileSystemDirectoryHandle){
 if(file.size>30_000_000)throw Error('ZIP больше 30 МБ: извлеки его на компьютере');
 const entries=unzipSync(new Uint8Array(await file.arrayBuffer()),{
  filter:entry=>entry.originalSize<=25_000_000
 });
 let total=0;let count=0;
 const safe:{segments:string[];bytes:Uint8Array}[]=[];
 for(const [raw,bytes] of Object.entries(entries)){
  if(raw.endsWith('/'))continue;
  const segments=raw.split('/');
  if(segments.length>20||segments.some(x=>!x||x==='.'||x==='..'||x.includes('\\')||x.includes(':')||/[\x00-\x1f]/.test(x)))throw Error('Небезопасный путь внутри ZIP');
  if(++count>500)throw Error('В ZIP больше 500 файлов');
  total+=bytes.byteLength;if(total>100_000_000)throw Error('Распакованные файлы превышают 100 МБ');
  safe.push({segments,bytes});
 }
 if(!safe.length)throw Error('ZIP не содержит поддерживаемых файлов');
 const folderName=clean(file.name.replace(/\.zip$/i,''))+'-распаковано';
 if(await exists(destination,folderName))throw Error('Папка '+folderName+' уже существует');
 const folder=await destination.getDirectoryHandle(folderName,{create:true});
 try{
  for(const {segments,bytes} of safe){
   let dir=folder;
   for(const part of segments.slice(0,-1))dir=await dir.getDirectoryHandle(part,{create:true});
   const handle=await dir.getFileHandle(segments[segments.length-1],{create:true});
   const writer=await handle.createWritable();await writer.write(new Uint8Array(bytes));await writer.close();
  }
 }catch(e){throw Error('Распаковка прервана. Проверь частично созданную папку «'+folderName+'»: '+String(e));}
 return folderName;
}


const trashFolder='.aspksa-trash';
async function copyEntry(source:FileSystemDirectoryHandle,entry:FileSystemHandle,target:FileSystemDirectoryHandle,depth=0):Promise<void>{
 if(depth>30)throw Error('Слишком глубокая вложенность');
 if(entry.kind==='file'){
  const file=await(await source.getFileHandle(entry.name)).getFile();
  const handle=await target.getFileHandle(entry.name,{create:true});
  const writer=await handle.createWritable();await writer.write(file);await writer.close();
 }else{
  const from=await source.getDirectoryHandle(entry.name);
  const to=await target.getDirectoryHandle(entry.name,{create:true});
  for await(const child of from.values())await copyEntry(from,child,to,depth+1);
 }
}
type TrashMeta={name:string;path:string[];kind:'file'|'directory';deletedAt:string};
async function trashRoot(){if(!drive)throw Error('USB не подключён');return drive.getDirectoryHandle(trashFolder,{create:true});}
async function moveToTrash(dir:FileSystemDirectoryHandle,entry:FileSystemHandle,path:string[]){
 const root=await trashRoot();
 const id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
 const item=await root.getDirectoryHandle(id,{create:true});
 try{
  await copyEntry(dir,entry,item);
  const meta:TrashMeta={name:entry.name,path,kind:entry.kind,deletedAt:new Date().toISOString()};
  const handle=await item.getFileHandle('metadata.json',{create:true});
  const writer=await handle.createWritable();await writer.write(JSON.stringify(meta));await writer.close();
  await dir.removeEntry(entry.name,{recursive:true});
 }catch(e){throw Error('Не удалось переместить в корзину; оригинал мог сохраниться. Проверь обе папки: '+String(e));}
}
async function trashItems(){
 const root=await trashRoot();
 const items:{id:string;meta:TrashMeta}[]=[];
 for await(const entry of root.values()){
  if(entry.kind!=='directory')continue;
  try{
   const item=await root.getDirectoryHandle(entry.name);
   const file=await(await item.getFileHandle('metadata.json')).getFile();
   const meta=JSON.parse(await file.text()) as TrashMeta;
   if(!meta||typeof meta.name!=='string'||!Array.isArray(meta.path)||!meta.path.every(x=>typeof x==='string')||typeof meta.deletedAt!=='string'||!['file','directory'].includes(meta.kind))continue;
   items.push({id:entry.name,meta});
  }catch{continue;}
 }
 return items.sort((a,b)=>b.meta.deletedAt.localeCompare(a.meta.deletedAt));
}
async function restoreTrash(id:string,meta:TrashMeta){
 if(!drive)throw Error('USB не подключён');
 if(!meta.name||meta.name===trashFolder||meta.path.includes(trashFolder)||meta.name==='.'||meta.name==='..'||meta.name.includes('/')||meta.name.includes('\\')||meta.path.some(x=>!x||x==='.'||x==='..'||x.includes('/')||x.includes('\\')))throw Error('Небезопасный путь восстановления');
 let target=drive;
 for(const part of meta.path)target=await target.getDirectoryHandle(part,{create:true});
 if(await exists(target,meta.name))throw Error('Файл или папка с таким именем уже существует');
 const root=await trashRoot();const item=await root.getDirectoryHandle(id);
 const entry=meta.kind==='file'?await item.getFileHandle(meta.name):await item.getDirectoryHandle(meta.name);
 await copyEntry(item,entry,target);
 await root.removeEntry(id,{recursive:true});
}

async function renameEntry(dir:FileSystemDirectoryHandle,entry:FileSystemHandle,newName:string){
 if(await exists(dir,newName))throw Error('Файл или папка с таким именем уже существует');
 if(entry.kind==='file'){const original=await dir.getFileHandle(entry.name);const file=await original.getFile();const target=await dir.getFileHandle(newName,{create:true});const writable=await target.createWritable();await writable.write(file);await writable.close();await dir.removeEntry(entry.name);}
 else {const source=await dir.getDirectoryHandle(entry.name);const dest=await dir.getDirectoryHandle(newName,{create:true});for await(const child of source.values()){if(child.kind==='directory')throw Error('Переименование папки с вложенными папками пока не поддерживается');const file=await(await source.getFileHandle(child.name)).getFile();const target=await dest.getFileHandle(child.name,{create:true});const writer=await target.createWritable();await writer.write(file);await writer.close();}await dir.removeEntry(entry.name,{recursive:true});}
}
export function openDocuments(){
 const workspace=document.querySelector<HTMLElement>('.workspace')!;
 const existing=workspace.querySelector<HTMLElement>('.drive');
 if(existing){existing.remove();workspace.classList.remove('documents-open');return;}
 workspace.classList.add('documents-open');
 const root=text('section','drive');root.setAttribute('aria-label','USB-документы');
 root.innerHTML='<div class="drive-head"><div class="drive-brand"><span class="drive-brand-icon" aria-hidden="true">◈</span><div><div class="eyebrow">ЛОКАЛЬНОЕ ХРАНИЛИЩЕ</div><h2>ASPKSA Диск</h2><p>Твои файлы. Твой USB-диск.</p></div></div><div class="drive-head-right"><span class="drive-connection">● Не подключён</span><button class="drive-close" aria-label="Закрыть">✕</button></div></div><div class="drive-location-bar"><div class="drive-crumbs"></div><label class="drive-search-wrap"><span aria-hidden="true">⌕</span><input class="drive-search" type="search" placeholder="Поиск файлов и папок" aria-label="Поиск по всем папкам USB"/></label></div><div class="drive-toolbar"><div class="drive-actions"><button class="drive-connect">◉ Подключить USB</button><button class="drive-new drive-primary">＋ Создать папку</button><button class="drive-upload">↑ Загрузить</button><button class="drive-rag">◈ Индексировать для AI</button><button class="drive-archive">▣ ZIP папки</button><button class="drive-layout" title="Переключить вид" aria-label="Переключить плитки и список">▦ Вид</button></div></div><div class="drive-tools"><span class="drive-status" role="status"></span></div><div class="drive-tabs"><button data-tab="all" class="active">Все файлы</button><button data-tab="favorites">★ Избранное</button><button data-tab="recent">Недавние</button><button data-tab="trash">♻ Корзина</button></div><div class="drive-section-heading"><h3>Папки и файлы</h3><span>USB / Aspksa / Диск</span></div><div class="drive-list"></div><input class="drive-input" type="file" multiple hidden />';
 workspace.append(root);
 const preview=async(file:File,handle?:FileSystemFileHandle,parent?:FileSystemDirectoryHandle)=>{
  const overlay=text('div','drive-preview-overlay');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Просмотр '+file.name);
  const panel=text('section','drive-preview-panel');const header=text('div','drive-preview-head');const heading=text('strong','',file.name);const close=text('button','drive-preview-close','✕');close.setAttribute('aria-label','Закрыть просмотр');
  const body=text('div','drive-preview-body');const download=text('button','drive-preview-download','↓ Скачать');const saveEdit=text('button','drive-preview-save','Сохранить');let url:string|null=null;
  const dismiss=()=>{overlay.remove();if(url)URL.revokeObjectURL(url);document.removeEventListener('keydown',escape);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')dismiss();};close.addEventListener('click',dismiss);overlay.addEventListener('click',e=>{if(e.target===overlay)dismiss();});document.addEventListener('keydown',escape);
  download.addEventListener('click',()=>{const a=document.createElement('a');const link=URL.createObjectURL(file);a.href=link;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(link),60000);});
  header.append(heading,download,close);panel.append(header,body);overlay.append(panel);root.append(overlay);close.focus();
  if(/\.(txt|md|markdown|json|csv|log|html|css|js|ts)$/i.test(file.name)){if(file.size>5_000_000){body.textContent='Файл слишком большой для предварительного просмотра (максимум 5 МБ).';return;}const editor=document.createElement('textarea');editor.className='drive-preview-editor';editor.value=await file.text();editor.setAttribute('aria-label','Содержимое файла');body.append(editor);if(handle){header.insertBefore(saveEdit,download);saveEdit.addEventListener('click',async()=>{try{const writer=await handle.createWritable();await writer.write(editor.value);await writer.close();saveEdit.textContent='✓ Сохранено';}catch(e){saveEdit.textContent='Ошибка сохранения';status(String(e));}});}}
  else if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){url=URL.createObjectURL(file);const frame=document.createElement('iframe');frame.src=url;frame.title='PDF: '+file.name;frame.className='drive-preview-frame';body.append(frame);}
  else if(file.type.startsWith('image/')&&/\.(png|jpe?g|webp|gif|svg)$/i.test(file.name)){url=URL.createObjectURL(file);const image=document.createElement('img');image.src=url;image.alt=file.name;image.className='drive-preview-image';body.append(image);}
  else if(file.type.startsWith('video/')||/\.(mp4|webm|ogg)$/i.test(file.name)){url=URL.createObjectURL(file);const video=document.createElement('video');video.src=url;video.controls=true;video.className='drive-preview-media';body.append(video);}
  else if(file.type.startsWith('audio/')||/\.(mp3|wav|flac|m4a|oga)$/i.test(file.name)){url=URL.createObjectURL(file);const audio=document.createElement('audio');audio.src=url;audio.controls=true;audio.className='drive-preview-audio';body.append(audio);}
  else if(/\.zip$/i.test(file.name)){if(file.size>100_000_000){body.textContent='ZIP больше 100 МБ: скачай его для просмотра.';return;}try{const entries=unzipSync(new Uint8Array(await file.arrayBuffer()));const listing=text('div','drive-zip-list');listing.append(text('h3','','Содержимое ZIP'));for(const name of Object.keys(entries).slice(0,500))listing.append(text('div','',name+' · '+entries[name].length+' байт'));body.append(listing);if(parent){const extract=text('button','drive-preview-save','↧ Распаковать в папку');header.insertBefore(extract,download);extract.addEventListener('click',async()=>{if(!confirm('Распаковать ZIP в новую папку рядом с архивом?'))return;extract.setAttribute('disabled','true');try{const name=await extractZip(file,parent);dismiss();status('ZIP распакован в '+name);await refresh();}catch(e){status(String(e));extract.removeAttribute('disabled');}});}}catch(e){body.textContent='Не удалось прочитать ZIP: '+String(e);}}
  else body.append(text('p','drive-preview-unsupported','Предпросмотр этого формата пока недоступен. Можно скачать файл и открыть его на компьютере.'));
 };
 const status=(s:string)=>{root.querySelector<HTMLElement>('.drive-status')!.textContent=s;};
 const connection=()=>{const label=root.querySelector<HTMLElement>('.drive-connection')!;label.textContent=drive?'● USB подключён':'● Не подключён';label.classList.toggle('connected',!!drive);};
 const refresh=async()=>{
  const list=root.querySelector<HTMLElement>('.drive-list')!,crumbs=root.querySelector<HTMLElement>('.drive-crumbs')!;
  list.replaceChildren();crumbs.replaceChildren();connection();
  if(!drive){status('Подключи USB-диск — папка Aspksa/Диск создастся автоматически.');list.append(text('div','drive-empty','◈  Подключи USB-диск, чтобы увидеть свои папки и файлы.'));return;}
  const home=text('button','','⌂  Aspksa / Диск');home.addEventListener('click',()=>{current=[];void refresh();});crumbs.append(home);
  current.forEach((part,i)=>{crumbs.append(text('span','',' / '));const b=text('button','',part);b.addEventListener('click',()=>{current=current.slice(0,i+1);void refresh();});crumbs.append(b);});
  try{
   const q=root.querySelector<HTMLInputElement>('.drive-search')!.value.trim().toLocaleLowerCase('ru');
   if(tab==='trash'){
    list.className='drive-list drive-rows';
    const items=await trashItems();
    for(const {id,meta} of items.filter(x=>x.meta.name.toLocaleLowerCase('ru').includes(q))){
     const tile=text('div','drive-item');const icon=text('span','drive-icon',meta.kind==='directory'?'📁':'📄');const name=text('span','drive-name',meta.name);const location=text('span','drive-location',(meta.path.join('/')||'Диск')+' · '+new Date(meta.deletedAt).toLocaleString('ru'));
     const actions=text('div','drive-item-actions');const restore=text('button','drive-restore','↶ Восстановить');restore.addEventListener('click',async()=>{try{await restoreTrash(id,meta);await refresh();}catch(e){status('Ошибка восстановления: '+String(e));}});
     const erase=text('button','drive-delete','Удалить навсегда');erase.addEventListener('click',async()=>{if(!confirm('Безвозвратно удалить «'+meta.name+'»?'))return;try{await(await trashRoot()).removeEntry(id,{recursive:true});await refresh();}catch(e){status(String(e));}});
     actions.append(restore,erase);tile.append(icon,name,location,actions);list.append(tile);
    }
    status(items.length+' элементов в корзине');return;
   }
   const all=(q||tab!=='all')?await searchAll(q):await (async()=>{const entries:{entry:FileSystemHandle;path:string[]}[]=[];const dir=await directory();for await(const entry of dir.values())entries.push({entry,path:[...current]});return entries;})();
   const favorites=stored(favoriteKey),recent=stored(recentKey);
   const entries=all.filter(({entry,path})=>{
    if(path.length===0&&entry.name===trashFolder)return false;
    const key=itemPath(path,entry.name);
    if(tab==='favorites'&&!favorites.includes(key))return false;
    if(tab==='recent'&&!recent.includes(key))return false;
    return q?entry.name.toLocaleLowerCase('ru').includes(q):tab==='all'?path.join('/')===current.join('/'):true;
   });
   entries.sort((a,b)=>tab==='recent'?recent.indexOf(itemPath(a.path,a.entry.name))-recent.indexOf(itemPath(b.path,b.entry.name)):(a.entry.kind===b.entry.kind?a.entry.name.localeCompare(b.entry.name,'ru'):a.entry.kind==='directory'?-1:1));
   list.className='drive-list '+(mode==='grid'?'drive-grid':'drive-rows');
   for(const {entry,path} of entries){
    const dir=await at(path);
    const key=itemPath(path,entry.name);
    const tile=text('div','drive-item');
    const icon=text('span','drive-icon',entry.kind==='directory'?'📁':/\.(pdf)$/i.test(entry.name)?'📕':/\.(docx?|odt)$/i.test(entry.name)?'📘':/\.(png|jpe?g|webp|gif)$/i.test(entry.name)?'🖼️':'📄');
    const name=text('button','drive-name',entry.name);
    name.addEventListener('click',async()=>{try{if(entry.kind==='directory'){current=[...path,entry.name];await refresh();}else{save(recentKey,[key,...stored(recentKey).filter(x=>x!==key)]);const handle=await dir.getFileHandle(entry.name);const file=await handle.getFile();await preview(file,handle,dir);}}catch(e){status(String(e));}});
    const actions=text('div','drive-item-actions');
    const star=text('button','drive-star',favorites.includes(key)?'★ В избранном':'☆ Избранное');star.addEventListener('click',()=>{const list=stored(favoriteKey);save(favoriteKey,list.includes(key)?list.filter(x=>x!==key):[key,...list]);void refresh();});
    const location=text('span','drive-location',path.length?path.join(' / '):'Диск');
    const rename=text('button','','Переименовать');rename.addEventListener('click',async()=>{const proposed=prompt('Новое имя:',entry.name);if(!proposed||clean(proposed)===entry.name)return;const next=clean(proposed);if(!next||next==='.'||next==='..')return;try{await renameEntry(dir,entry,next);for(const storageKey of [favoriteKey,recentKey])save(storageKey,stored(storageKey).map(x=>x===key?itemPath(path,next):x));await refresh();}catch(e){status('Ошибка: '+String(e));}});
    const remove=text('button','drive-delete','В корзину');remove.addEventListener('click',async()=>{if(!confirm('Переместить «'+entry.name+'» в корзину?'))return;try{await moveToTrash(dir,entry,path);for(const storageKey of [favoriteKey,recentKey])save(storageKey,stored(storageKey).filter(x=>x!==key&&!x.startsWith(key+'/')));await refresh();}catch(e){status(String(e));}});
    actions.append(star,rename,remove);tile.append(icon,name,location,actions);list.append(tile);
   }
   status(entries.length+' элементов · '+(q?'Поиск по папкам':'Локальные файлы на USB'));
  }catch(e){status('Ошибка чтения: '+String(e));}
 };
 root.querySelector('.drive-close')!.addEventListener('click',()=>{root.remove();workspace.classList.remove('documents-open');});
 root.querySelector('.drive-connect')!.addEventListener('click',async()=>{try{await initialize();await refresh();}catch(e){status('Подключение отменено или недоступно: '+String(e));}});
 root.querySelector('.drive-rag')!.addEventListener('click',async()=>{if(!drive){status('Сначала подключи USB');return;}const button=root.querySelector<HTMLButtonElement>('.drive-rag')!;button.disabled=true;status('Индексация текстовых файлов на этом устройстве...');try{const result=await ragIndex();status('RAG готов: '+result.files+' файлов, '+result.chunks+' фрагментов. Пропущено: '+result.skipped);}catch(e){status('Ошибка RAG: '+String(e));}finally{button.disabled=false;}});
 root.querySelector('.drive-archive')!.addEventListener('click',async()=>{if(!drive){status('Сначала подключи USB');return;}try{const dir=await directory();const files:Record<string,Uint8Array>={};await collectZip(dir,'',files);if(!Object.keys(files).length){status('Папка пуста');return;}const zip=zipSync(files,{level:1});const name='Архив-'+new Date().toISOString().slice(0,10)+'.zip';if(await exists(dir,name)&&!confirm('Заменить '+name+'?'))return;const target=await dir.getFileHandle(name,{create:true});const writer=await target.createWritable();await writer.write(new Uint8Array(zip));await writer.close();await refresh();}catch(e){status('Ошибка создания ZIP: '+String(e));}});
 root.querySelector('.drive-layout')!.addEventListener('click',()=>{mode=mode==='grid'?'list':'grid';root.querySelector<HTMLElement>('.drive-layout')!.textContent=mode==='grid'?'▦ Вид':'☷ Вид';void refresh();});
 root.querySelector('.drive-search')!.addEventListener('input',()=>void refresh());
 root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button=>button.addEventListener('click',()=>{tab=button.dataset.tab as typeof tab;root.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===button));void refresh();}));
 root.querySelector('.drive-new')!.addEventListener('click',async()=>{if(!drive){status('Сначала подключи USB');return;}const value=prompt('Название папки:');if(!value)return;const name=clean(value);if(!name||name==='.'||name==='..')return;try{const dir=await directory();if(await exists(dir,name))throw Error('Такое имя уже существует');await dir.getDirectoryHandle(name,{create:true});await refresh();}catch(e){status(String(e));}});
 root.querySelector('.drive-upload')!.addEventListener('click',()=>{if(!drive){status('Сначала подключи USB');return;}root.querySelector<HTMLInputElement>('.drive-input')!.click();});
 async function upload(files:FileList|File[]){if(!drive){status('Сначала подключи USB');return;}try{const dir=await directory();for(const file of Array.from(files)){const name=clean(file.name);if(!name)continue;let target:FileSystemFileHandle;try{target=await dir.getFileHandle(name,{create:false});if(!confirm('Заменить существующий файл «'+name+'»?'))continue;}catch{target=await dir.getFileHandle(name,{create:true});}const writer=await target.createWritable();await writer.write(file);await writer.close();}await refresh();}catch(e){status('Ошибка записи: '+String(e));}}
 root.querySelector<HTMLInputElement>('.drive-input')!.addEventListener('change',e=>{const input=e.target as HTMLInputElement;if(input.files)void upload(input.files);input.value='';});
 root.addEventListener('dragover',e=>{e.preventDefault();root.classList.add('drive-drag');});
 root.addEventListener('dragleave',()=>root.classList.remove('drive-drag'));
 root.addEventListener('drop',e=>{e.preventDefault();root.classList.remove('drive-drag');if(e.dataTransfer?.files)void upload(e.dataTransfer.files);});
 void refresh();
}
